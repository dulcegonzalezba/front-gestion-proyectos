import { useCallback, useEffect, useMemo, useState, CSSProperties, DragEvent } from "react";
import { toast } from "sonner";
import ProyectoDrawer from "./ProyectoDrawer";
import {
  Project, Evento, Salud, Criticidad, Fase, EventoTipo, Severidad,
  UI, SALUD_CFG, SALUD_ORDEN, CRITICIDAD_CFG, FASE_CFG, TIPO_CFG, SEVERIDAD_CFG,
  TASK_BLOCKED, TASK_DONE, TASK_ACTIVE, DIAS_STALE, DIAS_STANDBY,
  salud as saludDe, criticidad as critDe, fase as faseDe, enPausa,
  fmtFecha, fmtHace, diasDesde, authHeaders,
} from "./proyectoEstado";

interface Props {
  projects: Project[];
  d: any;
  checklistItems: any[];
  /** "Todos" o el id del proyecto cuyo detalle está abierto. */
  selectedProject: string;
  onSelectProject: (id: string) => void;
  onProjectUpdated: (p: Project) => void;
  /** Quita el proyecto de la lista tras borrarlo en el servidor. */
  onProjectDeleted: (id: string) => void;
  onAssociateTask: (projectId: string, cellName: string, taskId: string) => Promise<void>;
  onCreateTask: (projectId: string, cellName: string, t: { title: string; resp: string; status: string; zoho: string }) => Promise<void>;
}

interface Metricas {
  bloqueadas: number;
  activas: number;
  completadas: number;
  total: number;
}

const card: CSSProperties = {
  background: UI.surface,
  border: `1px solid ${UI.border}`,
  borderRadius: 12,
};

const sectionTitle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: UI.dim,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
};

export default function ProyectosBoard({
  projects, d, checklistItems, selectedProject, onSelectProject,
  onProjectUpdated, onProjectDeleted, onAssociateTask, onCreateTask,
}: Props) {
  const [abiertas, setAbiertas]   = useState<Evento[]>([]);
  const [recientes, setRecientes] = useState<Evento[]>([]);
  const [eventosProyecto, setEventosProyecto] = useState<Evento[]>([]);
  const [loadingEventos, setLoadingEventos]   = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [focoSalud, setFocoSalud] = useState<Salud | null>(null);
  const [vista, setVista] = useState<"tablero" | "lista">("tablero");
  const [verActividad, setVerActividad] = useState(true);
  /** El stand-by se oculta por defecto: es justo el ruido que satura "Sin errores". */
  const [ocultarPausa, setOcultarPausa] = useState(true);

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const [arrastrando, setArrastrando]   = useState<string | null>(null);
  const [sobreColumna, setSobreColumna] = useState<Salud | null>(null);
  /** Salud mostrada de inmediato al soltar, antes de que el servidor confirme. */
  const [optimista, setOptimista] = useState<Record<string, Salud>>({});

  const proyectoAbierto = selectedProject !== "Todos"
    ? projects.find(p => p.id === selectedProject) ?? null
    : null;

  // ── Carga de agregados ────────────────────────────────────────────────────
  const cargarAgregados = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        fetch("/api/projects/eventos/abiertas", { headers: authHeaders() }),
        fetch("/api/projects/eventos/recientes?limit=40", { headers: authHeaders() }),
      ]);
      if (a.ok) setAbiertas(await a.json());
      if (r.ok) setRecientes(await r.json());
    } catch { /* el tablero sigue usable sin el feed */ }
  }, []);

  useEffect(() => { cargarAgregados(); }, [cargarAgregados]);

  // Bitácora del proyecto abierto
  const cargarEventosProyecto = useCallback(async (id: string) => {
    setLoadingEventos(true);
    try {
      const res = await fetch(`/api/projects/${id}/eventos`, { headers: authHeaders() });
      setEventosProyecto(res.ok ? await res.json() : []);
    } catch {
      setEventosProyecto([]);
    } finally {
      setLoadingEventos(false);
    }
  }, []);

  useEffect(() => {
    if (proyectoAbierto) cargarEventosProyecto(proyectoAbierto.id);
    else setEventosProyecto([]);
  }, [proyectoAbierto?.id, cargarEventosProyecto]);

  // ── Métricas por proyecto ─────────────────────────────────────────────────
  const cells = d?.cells ?? {};

  const metricas = useCallback((p: Project): Metricas => {
    const tasks = (p.taskRefs ?? [])
      .map(r => (cells[r.cellName]?.tasks ?? []).find((t: any) => t.id === r.taskId))
      .filter(Boolean) as any[];
    return {
      bloqueadas:  tasks.filter(t => TASK_BLOCKED.includes(t.status)).length,
      activas:     tasks.filter(t => TASK_ACTIVE.includes(t.status)).length,
      completadas: tasks.filter(t => TASK_DONE.includes(t.status)).length,
      total: tasks.length,
    };
  }, [d]);

  const incidenciasPorProyecto = useMemo(() => {
    const m: Record<string, number> = {};
    abiertas.forEach(e => { m[e.proyectoId] = (m[e.proyectoId] ?? 0) + 1; });
    return m;
  }, [abiertas]);

  const nombrePorId = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach(p => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  // ── Filtrado + agrupación ─────────────────────────────────────────────────

  /** Coinciden con la búsqueda, estén en stand-by o no. */
  const coincidentes = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return projects.filter(p => !q || p.name.toLowerCase().includes(q));
  }, [projects, busqueda]);

  const pausados = useMemo(() => coincidentes.filter(enPausa), [coincidentes]);

  /** Lo que realmente se pinta. Todo lo demás del tablero cuelga de aquí. */
  const filtrados = useMemo(
    () => (ocultarPausa ? coincidentes.filter(p => !enPausa(p)) : coincidentes),
    [coincidentes, ocultarPausa],
  );

  /** Salud a pintar: la optimista mientras el servidor confirma, si no la real. */
  const saludEf = useCallback(
    (p: Project): Salud => optimista[p.id] ?? saludDe(p),
    [optimista],
  );

  const conteoPorSalud = useMemo(() => {
    const m = {} as Record<Salud, number>;
    SALUD_ORDEN.forEach(s => { m[s] = 0; });
    filtrados.forEach(p => { m[saludEf(p)] += 1; });
    return m;
  }, [filtrados, saludEf]);

  const columnas = useMemo(() => {
    const orden = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 } as Record<Criticidad, number>;
    const m = {} as Record<Salud, Project[]>;
    SALUD_ORDEN.forEach(s => { m[s] = []; });
    filtrados.forEach(p => { m[saludEf(p)].push(p); });
    SALUD_ORDEN.forEach(s => {
      m[s].sort((a, b) => {
        const ia = incidenciasPorProyecto[a.id] ?? 0;
        const ib = incidenciasPorProyecto[b.id] ?? 0;
        if (ia !== ib) return ib - ia;
        const ca = orden[critDe(a)], cb = orden[critDe(b)];
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name, "es");
      });
    });
    return m;
  }, [filtrados, incidenciasPorProyecto, saludEf]);

  const listaOrdenada = useMemo(() => {
    const sOrden = SALUD_ORDEN.reduce((acc, s, i) => { acc[s] = SALUD_ORDEN.length - i; return acc; }, {} as Record<Salud, number>);
    return [...filtrados].sort((a, b) => {
      const da = sOrden[saludEf(a)], db = sOrden[saludEf(b)];
      if (da !== db) return db - da;
      return a.name.localeCompare(b.name, "es");
    });
  }, [filtrados, saludEf]);

  const sinActualizar = filtrados.filter(p => {
    const dias = diasDesde(p.saludUpdatedAt);
    return dias === null || dias > DIAS_STALE;
  }).length;

  // ── Mutaciones ────────────────────────────────────────────────────────────
  const patchEstado = async (
    id: string,
    patch: { salud?: Salud; criticidad?: Criticidad; fase?: Fase; notas?: string; motivo?: string },
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/projects/${id}/estado`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      if (!res.ok) { toast.error("No se pudo guardar el estatus"); return false; }
      const actualizado: Project = await res.json();
      onProjectUpdated(actualizado);
      if (patch.salud) {
        toast.success(`${actualizado.name}: ${SALUD_CFG[patch.salud].label}`);
        await Promise.all([cargarAgregados(), id === proyectoAbierto?.id ? cargarEventosProyecto(id) : Promise.resolve()]);
      }
      return true;
    } catch { toast.error("Error de red al guardar el estatus"); return false; }
  };

  /**
   * Mueve un proyecto de columna: pinta el cambio de inmediato y lo revierte
   * si el servidor lo rechaza. Es el camino que usan tanto el drag & drop
   * como los puntitos de la tarjeta.
   */
  const moverA = async (id: string, nueva: Salud) => {
    const actual = projects.find(p => p.id === id);
    if (!actual || saludDe(actual) === nueva) return;

    setOptimista(o => ({ ...o, [id]: nueva }));
    const ok = await patchEstado(id, { salud: nueva });
    setOptimista(o => {
      const { [id]: _descartado, ...resto } = o;
      return resto;
    });
    if (!ok) toast.error(`${actual.name} volvió a ${SALUD_CFG[saludDe(actual)].label}`);
  };

  // ── Handlers de drag & drop ───────────────────────────────────────────────
  const onDragStartTarjeta = (e: DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setArrastrando(id);
  };

  const onDragEndTarjeta = () => { setArrastrando(null); setSobreColumna(null); };

  const onDropColumna = (e: DragEvent, destino: Salud) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || arrastrando;
    setArrastrando(null);
    setSobreColumna(null);
    if (id) moverA(id, destino);
  };

  const addEvento = async (
    id: string,
    e: { tipo: EventoTipo; titulo: string; descripcion: string; severidad: Severidad; fecha: string },
  ) => {
    try {
      const res = await fetch(`/api/projects/${id}/eventos`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(e),
      });
      if (!res.ok) { toast.error("No se pudo registrar en la bitácora"); return; }
      toast.success(`${TIPO_CFG[e.tipo].label} registrada`);
      await Promise.all([cargarEventosProyecto(id), cargarAgregados()]);
    } catch { toast.error("Error de red al registrar"); }
  };

  const toggleResuelto = async (ev: Evento) => {
    try {
      const res = await fetch(`/api/projects/eventos/${ev.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ resuelto: !ev.resuelto }),
      });
      if (!res.ok) { toast.error("No se pudo actualizar la incidencia"); return; }
      toast.success(ev.resuelto ? "Incidencia reabierta" : "Incidencia resuelta");
      await Promise.all([cargarEventosProyecto(ev.proyectoId), cargarAgregados()]);
    } catch { toast.error("Error de red"); }
  };

  /**
   * Borra el proyecto en cascada. El drawer ya confirmó con el usuario, así que
   * aquí solo queda ejecutar, cerrar y contar qué se fue.
   */
  const deleteProject = async (p: Project) => {
    try {
      const res = await fetch(`/api/projects/${p.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { toast.error(`No se pudo eliminar ${p.name}`); return; }

      const resumen = await res.json().catch(() => null);
      const arrastrados = resumen
        ? resumen.eventos + resumen.acuerdos + resumen.acuerdoSeguimientos
          + resumen.liberaciones + resumen.liberacionSeguimientos
        : 0;

      onSelectProject("Todos");
      onProjectDeleted(p.id);
      toast.success(
        arrastrados > 0
          ? `${p.name} eliminado · ${arrastrados} registro${arrastrados !== 1 ? "s" : ""} asociado${arrastrados !== 1 ? "s" : ""}`
          : `${p.name} eliminado`,
      );
      await cargarAgregados();
    } catch { toast.error("Error de red al eliminar el proyecto"); }
  };

  const deleteEvento = async (ev: Evento) => {
    try {
      const res = await fetch(`/api/projects/eventos/${ev.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) { toast.error("No se pudo eliminar"); return; }
      await Promise.all([cargarEventosProyecto(ev.proyectoId), cargarAgregados()]);
    } catch { toast.error("Error de red"); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "system-ui,sans-serif", color: UI.text, paddingBottom: 40 }}>

      {/* ── Barra superior ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        flexWrap: "wrap", marginBottom: 16,
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: UI.text, lineHeight: 1.2 }}>
            Tablero operativo
          </div>
          <div style={{ fontSize: 11, color: UI.muted, marginTop: 2 }}>
            {filtrados.length} proyecto{filtrados.length !== 1 ? "s" : ""}
            {abiertas.length > 0 && <> · <span style={{ color: "#EF4444" }}>{abiertas.length} incidencia{abiertas.length !== 1 ? "s" : ""} abierta{abiertas.length !== 1 ? "s" : ""}</span></>}
            {sinActualizar > 0 && <> · <span style={{ color: "#F59E0B" }}>{sinActualizar} sin actualizar</span></>}
            {ocultarPausa && pausados.length > 0 && <> · <span style={{ color: UI.dim }}>{pausados.length} en pausa oculto{pausados.length !== 1 ? "s" : ""}</span></>}
          </div>
          {vista === "tablero" && (
            <div style={{ fontSize: 10, color: UI.dim, marginTop: 3 }}>
              Arrastra una tarjeta a otra columna para cambiar su estatus
            </div>
          )}
        </div>

        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar proyecto…"
          aria-label="Buscar proyecto"
          style={{
            background: UI.surface2, border: `1px solid ${UI.border}`, borderRadius: 8,
            color: UI.text, fontSize: 12, padding: "8px 12px", minWidth: 180,
            fontFamily: "system-ui,sans-serif",
          }}
        />

        <button
          onClick={() => setOcultarPausa(v => !v)}
          aria-pressed={ocultarPausa}
          title={
            ocultarPausa
              ? `Mostrar los ${pausados.length} proyecto(s) en pausa`
              : "Ocultar los proyectos en pausa"
          }
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: ocultarPausa ? "rgba(201,168,76,0.12)" : UI.surface2,
            border: `1px solid ${ocultarPausa ? "rgba(201,168,76,0.4)" : UI.border}`,
            borderRadius: 8, cursor: "pointer",
            color: ocultarPausa ? UI.gold : UI.muted,
            fontSize: 11, fontWeight: ocultarPausa ? 600 : 400,
            padding: "8px 12px", fontFamily: "system-ui,sans-serif", whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 10 }}>{ocultarPausa ? "◐" : "◯"}</span>
          Ocultar en pausa
          {pausados.length > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              background: ocultarPausa ? "rgba(201,168,76,0.2)" : UI.border,
              color: ocultarPausa ? UI.gold : UI.muted,
              borderRadius: 999, padding: "1px 6px",
            }}>
              {pausados.length}
            </span>
          )}
        </button>

        <div style={{ display: "flex", background: UI.surface2, border: `1px solid ${UI.border}`, borderRadius: 8, padding: 2 }}>
          {(["tablero", "lista"] as const).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              style={{
                background: vista === v ? "rgba(201,168,76,0.14)" : "none",
                border: "none", borderRadius: 6,
                color: vista === v ? UI.gold : UI.muted,
                cursor: "pointer", fontSize: 11, fontWeight: vista === v ? 600 : 400,
                padding: "6px 12px", fontFamily: "system-ui,sans-serif",
                textTransform: "capitalize",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Semáforo global (tiles-filtro) ──────────────────────────────── */}
      <div className="sigob-semaforo" style={{ marginBottom: 16 }}>
        {SALUD_ORDEN.map(s => {
          const cfg = SALUD_CFG[s];
          const activo = focoSalud === s;
          const n = conteoPorSalud[s];
          return (
            <button
              key={s}
              className="sigob-tile"
              onClick={() => setFocoSalud(activo ? null : s)}
              aria-pressed={activo}
              title={`${cfg.label} — ${cfg.ayuda}\n\n${activo ? "Clic para quitar el filtro" : "Clic para ver solo esta columna"}`}
              style={{
                ...card,
                borderColor: activo ? cfg.color : UI.border,
                background: activo ? cfg.bg : UI.surface,
                borderTop: `3px solid ${cfg.color}`,
                cursor: "pointer", textAlign: "left",
                padding: "12px 14px",
                fontFamily: "system-ui,sans-serif",
                display: "flex", flexDirection: "column", gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: n > 0 ? cfg.color : UI.dim, lineHeight: 1 }}>
                  {n}
                </span>
                <span style={{ fontSize: 12, color: cfg.color, opacity: 0.9 }}>{cfg.icon}</span>
              </div>
              <div style={{ fontSize: 10.5, color: activo ? cfg.color : UI.muted, fontWeight: activo ? 600 : 500, lineHeight: 1.3 }}>
                {cfg.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Atención hoy: incidencias abiertas ──────────────────────────── */}
      {abiertas.length > 0 && (
        <div style={{
          ...card,
          borderColor: "rgba(239,68,68,0.35)",
          padding: "13px 16px",
          marginBottom: 16,
        }}>
          <div style={{ ...sectionTitle, color: "#EF4444", marginBottom: 10 }}>
            ⚠ Atención — incidencias abiertas
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {abiertas.slice(0, 6).map(ev => (
              <button
                key={ev.id}
                onClick={() => onSelectProject(ev.proyectoId)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: UI.bg, border: `1px solid ${UI.border}`, borderRadius: 8,
                  padding: "8px 11px", cursor: "pointer", textAlign: "left", width: "100%",
                  fontFamily: "system-ui,sans-serif",
                }}
              >
                <span style={{
                  fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flexShrink: 0,
                  background: `${SEVERIDAD_CFG[ev.severidad]?.color ?? UI.muted}1A`,
                  color: SEVERIDAD_CFG[ev.severidad]?.color ?? UI.muted,
                  letterSpacing: "0.05em",
                }}>
                  {(SEVERIDAD_CFG[ev.severidad]?.label ?? ev.severidad).toUpperCase()}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: UI.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.titulo}
                </span>
                <span style={{ fontSize: 10, color: UI.muted, whiteSpace: "nowrap", flexShrink: 0, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {nombrePorId[ev.proyectoId] ?? "—"}
                </span>
                <span style={{ fontSize: 9, color: UI.dim, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {fmtFecha(ev.fecha ?? ev.createdAt)}
                </span>
              </button>
            ))}
            {abiertas.length > 6 && (
              <div style={{ fontSize: 10, color: UI.dim, paddingLeft: 2 }}>
                +{abiertas.length - 6} más
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tablero / Lista ─────────────────────────────────────────────── */}
      {projects.length === 0 ? (
        <div style={{ ...card, padding: "40px 20px", textAlign: "center", color: UI.muted, fontSize: 13 }}>
          Sin proyectos. Usa <span style={{ color: UI.gold }}>⚡ Precargar 17 base</span> en el panel izquierdo.
        </div>
      ) : filtrados.length === 0 && pausados.length > 0 ? (
        <div style={{ ...card, padding: "40px 20px", textAlign: "center", color: UI.muted, fontSize: 13 }}>
          Todo lo que coincide está en pausa.{" "}
          <button
            onClick={() => setOcultarPausa(false)}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              color: UI.gold, fontSize: 13, fontFamily: "system-ui,sans-serif",
              textDecoration: "underline",
            }}
          >
            Mostrar los {pausados.length} en pausa
          </button>
        </div>
      ) : vista === "tablero" ? (
        <div className={`sigob-board${focoSalud ? " sigob-board--focus" : ""}`}>
          {(focoSalud ? [focoSalud] : SALUD_ORDEN).map(s => (
            <Columna
              key={s}
              salud={s}
              proyectos={columnas[s]}
              metricas={metricas}
              incidencias={incidenciasPorProyecto}
              saludEf={saludEf}
              onOpen={onSelectProject}
              onSetSalud={moverA}
              arrastrando={arrastrando}
              activa={sobreColumna === s}
              onDragStartTarjeta={onDragStartTarjeta}
              onDragEndTarjeta={onDragEndTarjeta}
              onDragEnterColumna={() => setSobreColumna(s)}
              onDragLeaveColumna={() => setSobreColumna(prev => (prev === s ? null : prev))}
              onDropColumna={e => onDropColumna(e, s)}
            />
          ))}
        </div>
      ) : (
        <Lista
          proyectos={listaOrdenada}
          metricas={metricas}
          incidencias={incidenciasPorProyecto}
          saludEf={saludEf}
          onOpen={onSelectProject}
          onSetSalud={moverA}
        />
      )}

      {/* ── Actividad reciente ──────────────────────────────────────────── */}
      {recientes.length > 0 && (
        <div style={{ ...card, padding: "13px 16px", marginTop: 16 }}>
          <button
            onClick={() => setVerActividad(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontFamily: "system-ui,sans-serif",
            }}
          >
            <span style={{ ...sectionTitle }}>Actividad reciente</span>
            <span style={{ fontSize: 10, color: UI.dim }}>{recientes.length}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: UI.muted }}>{verActividad ? "▲" : "▼"}</span>
          </button>

          {verActividad && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {recientes.slice(0, 15).map(ev => {
                const cfg = TIPO_CFG[ev.tipo] ?? TIPO_CFG.NOTA;
                const color = ev.tipo === "CAMBIO_ESTATUS" && ev.saludNueva && SALUD_CFG[ev.saludNueva as Salud]
                  ? SALUD_CFG[ev.saludNueva as Salud].color
                  : cfg.color;
                return (
                  <button
                    key={ev.id}
                    onClick={() => onSelectProject(ev.proyectoId)}
                    style={{
                      display: "flex", alignItems: "center", gap: 9,
                      background: "none", border: "none", borderBottom: `1px solid ${UI.border}`,
                      padding: "7px 2px", cursor: "pointer", textAlign: "left", width: "100%",
                      fontFamily: "system-ui,sans-serif",
                    }}
                  >
                    <span style={{ color, fontSize: 11, width: 14, flexShrink: 0, textAlign: "center" }}>{cfg.icon}</span>
                    <span style={{ fontSize: 11, color: UI.muted, flexShrink: 0, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {nombrePorId[ev.proyectoId] ?? "—"}
                    </span>
                    <span style={{ flex: 1, fontSize: 11.5, color: UI.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.tipo === "CAMBIO_ESTATUS" && ev.saludNueva && SALUD_CFG[ev.saludNueva as Salud]
                        ? `Estatus → ${SALUD_CFG[ev.saludNueva as Salud].label}`
                        : ev.titulo}
                    </span>
                    <span style={{ fontSize: 9, color: UI.dim, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {fmtHace(ev.createdAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Drawer de detalle ───────────────────────────────────────────── */}
      {proyectoAbierto && (
        <ProyectoDrawer
          project={proyectoAbierto}
          d={d}
          checklistItems={checklistItems}
          eventos={eventosProyecto}
          loadingEventos={loadingEventos}
          onClose={() => onSelectProject("Todos")}
          onEstado={patch => patchEstado(proyectoAbierto.id, patch)}
          onAddEvento={e => addEvento(proyectoAbierto.id, e)}
          onToggleResuelto={toggleResuelto}
          onDeleteEvento={deleteEvento}
          onAssociateTask={onAssociateTask}
          onCreateTask={onCreateTask}
          onDeleteProject={deleteProject}
        />
      )}
    </div>
  );
}

// ── Columna del tablero ──────────────────────────────────────────────────────

function Columna({
  salud, proyectos, metricas, incidencias, saludEf, onOpen, onSetSalud,
  arrastrando, activa,
  onDragStartTarjeta, onDragEndTarjeta,
  onDragEnterColumna, onDragLeaveColumna, onDropColumna,
}: {
  salud: Salud;
  proyectos: Project[];
  metricas: (p: Project) => Metricas;
  incidencias: Record<string, number>;
  saludEf: (p: Project) => Salud;
  onOpen: (id: string) => void;
  onSetSalud: (id: string, s: Salud) => void;
  arrastrando: string | null;
  activa: boolean;
  onDragStartTarjeta: (e: DragEvent, id: string) => void;
  onDragEndTarjeta: () => void;
  onDragEnterColumna: () => void;
  onDragLeaveColumna: () => void;
  onDropColumna: (e: DragEvent) => void;
}) {
  const cfg = SALUD_CFG[salud];
  // Una tarjeta ya en esta columna no debe marcarla como destino válido.
  const esDestinoValido = !!arrastrando && !proyectos.some(p => p.id === arrastrando);
  const resaltada = activa && esDestinoValido;

  return (
    <div
      style={{ minWidth: 0 }}
      onDragEnter={e => { e.preventDefault(); onDragEnterColumna(); }}
      onDragOver={e => {
        // preventDefault es obligatorio para habilitar el drop.
        e.preventDefault();
        e.dataTransfer.dropEffect = esDestinoValido ? "move" : "none";
      }}
      onDragLeave={e => {
        // dragleave también salta al pasar sobre los hijos: solo cuenta si
        // el puntero salió realmente del contenedor de la columna.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDragLeaveColumna();
      }}
      onDrop={onDropColumna}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "0 4px 9px",
        borderBottom: `2px solid ${cfg.color}`,
        marginBottom: 10,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: "0.02em", flex: 1, minWidth: 0 }}>
          {cfg.label}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: proyectos.length ? cfg.color : UI.dim,
          background: proyectos.length ? cfg.bg : "transparent",
          borderRadius: 999, padding: "1px 7px", flexShrink: 0,
        }}>
          {proyectos.length}
        </span>
      </div>

      <div
        style={{
          display: "flex", flexDirection: "column", gap: 8,
          minHeight: arrastrando ? 96 : undefined,
          borderRadius: 12,
          padding: resaltada ? 6 : 0,
          margin: resaltada ? -6 : 0,
          background: resaltada ? cfg.bg : "transparent",
          outline: resaltada ? `2px dashed ${cfg.color}` : "none",
          outlineOffset: -2,
          transition: "background 0.12s, outline-color 0.12s",
        }}
      >
        {proyectos.length === 0 ? (
          <div style={{
            fontSize: 10, color: resaltada ? cfg.color : UI.dim, textAlign: "center",
            padding: "14px 8px",
            border: `1px dashed ${resaltada ? cfg.color : UI.border}`, borderRadius: 10,
          }}>
            {resaltada ? "Soltar aquí" : "—"}
          </div>
        ) : proyectos.map(p => (
          <TarjetaProyecto
            key={p.id}
            project={p}
            salud={saludEf(p)}
            m={metricas(p)}
            incidenciasAbiertas={incidencias[p.id] ?? 0}
            arrastrandose={arrastrando === p.id}
            onOpen={() => onOpen(p.id)}
            onSetSalud={s => onSetSalud(p.id, s)}
            onDragStart={e => onDragStartTarjeta(e, p.id)}
            onDragEnd={onDragEndTarjeta}
          />
        ))}
        {resaltada && proyectos.length > 0 && (
          <div style={{
            fontSize: 10, color: cfg.color, textAlign: "center", padding: "10px 8px",
            border: `1px dashed ${cfg.color}`, borderRadius: 10,
          }}>
            Soltar aquí
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tarjeta ──────────────────────────────────────────────────────────────────

function TarjetaProyecto({
  project, salud: sal, m, incidenciasAbiertas, arrastrandose, onOpen, onSetSalud,
  onDragStart, onDragEnd,
}: {
  project: Project;
  salud: Salud;
  m: Metricas;
  incidenciasAbiertas: number;
  arrastrandose: boolean;
  onOpen: () => void;
  onSetSalud: (s: Salud) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  const crit = critDe(project);
  const fas  = faseDe(project);
  const cfg  = SALUD_CFG[sal];
  const dias = diasDesde(project.saludUpdatedAt);
  const stale = dias === null || dias > DIAS_STALE;
  const pausado = fas === "PAUSA";

  return (
    <div
      className="sigob-pcard"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={
        pausado
          ? "En pausa. Arrástrala a otra columna para reactivarla."
          : "Arrástrala a otra columna para cambiar el estatus"
      }
      style={{
        ...card,
        borderLeft: `3px solid ${cfg.color}`,
        overflow: "hidden",
        cursor: arrastrandose ? "grabbing" : "grab",
        // Atenuada, no invisible: se ve que sigue ahí sin competir por la atención.
        opacity: arrastrandose ? 0.4 : pausado ? 0.55 : 1,
        transition: "opacity 0.12s",
        animation: incidenciasAbiertas > 0 && sal === "URGENTE" && !arrastrandose
          ? "sigob-alert-pulse 2.4s ease-in-out infinite" : "none",
      }}
    >
      {/* Zona clickable → detalle */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        style={{ padding: "11px 12px 9px" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
          <div style={{
            flex: 1, minWidth: 0,
            fontSize: 12.5, fontWeight: 600, color: UI.text, lineHeight: 1.32,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {project.name}
          </div>
          {incidenciasAbiertas > 0 && (
            <span
              title={`${incidenciasAbiertas} incidencia(s) abierta(s)`}
              style={{
                flexShrink: 0, fontSize: 9, fontWeight: 700,
                background: "rgba(239,68,68,0.14)", color: "#EF4444",
                border: "1px solid rgba(239,68,68,0.35)",
                borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
              }}
            >
              ⚠ {incidenciasAbiertas}
            </span>
          )}
        </div>

        {/* Chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
          <span
            title={
              pausado
                ? project.pausaAuto
                  ? `Stand-by automático: ${DIAS_STANDBY}+ días sin movimiento estando sana. `
                    + `Vuelve al tablero sola en cuanto tenga actividad`
                    + `${project.fasePrevia ? `, restaurando la fase ${FASE_CFG[project.fasePrevia]?.label ?? project.fasePrevia}` : ""}.`
                  : "En pausa manual. Solo una persona puede sacarla de aquí."
                : undefined
            }
            style={{ fontSize: 9, color: FASE_CFG[fas].color, fontWeight: 600 }}
          >
            {pausado && project.pausaAuto ? "⏸ En pausa · auto" : pausado ? "⏸ En pausa" : FASE_CFG[fas].label}
          </span>
          <span style={{ color: UI.border, fontSize: 9 }}>|</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: CRITICIDAD_CFG[crit].color }} />
            <span style={{ fontSize: 9, color: CRITICIDAD_CFG[crit].color, fontWeight: 600 }}>
              {CRITICIDAD_CFG[crit].label}
            </span>
          </span>
        </div>

        {/* Barra de tareas */}
        {m.total > 0 ? (
          <div style={{ marginTop: 9 }}>
            <div style={{ height: 5, background: UI.surface2, borderRadius: 3, overflow: "hidden", display: "flex" }}>
              {m.bloqueadas  > 0 && <div style={{ width: `${(m.bloqueadas  / m.total) * 100}%`, background: "#EF4444" }} />}
              {m.activas     > 0 && <div style={{ width: `${(m.activas     / m.total) * 100}%`, background: "#60A5FA" }} />}
              {m.completadas > 0 && <div style={{ width: `${(m.completadas / m.total) * 100}%`, background: "#4ADE80", opacity: 0.65 }} />}
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 5, fontSize: 9 }}>
              {m.bloqueadas  > 0 && <span style={{ color: "#EF4444" }}>{m.bloqueadas} bloq.</span>}
              {m.activas     > 0 && <span style={{ color: "#60A5FA" }}>{m.activas} activa{m.activas !== 1 ? "s" : ""}</span>}
              {m.completadas > 0 && <span style={{ color: "#4ADE80", opacity: 0.8 }}>{m.completadas} ok</span>}
              <span style={{ flex: 1 }} />
              <span style={{ color: UI.dim }}>{m.total} tarea{m.total !== 1 ? "s" : ""}</span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 9, fontSize: 9, color: UI.dim }}>Sin tareas asociadas</div>
        )}
      </div>

      {/* Pie: cambio rápido de semáforo */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 12px 9px",
        borderTop: `1px solid ${UI.border}`,
        background: "rgba(255,255,255,0.012)",
      }}>
        <div style={{ display: "flex", gap: 5 }} role="group" aria-label="Cambiar estatus">
          {SALUD_ORDEN.map(s => {
            const c = SALUD_CFG[s];
            const activo = s === sal;
            return (
              <button
                key={s}
                className="sigob-dot"
                onClick={e => { e.stopPropagation(); if (!activo) onSetSalud(s); }}
                title={activo ? `Actual: ${c.label}` : `Marcar como ${c.label}`}
                aria-label={`Marcar como ${c.label}`}
                style={{
                  width: 11, height: 11, borderRadius: "50%",
                  background: activo ? c.color : "transparent",
                  border: `1.5px solid ${c.color}`,
                  opacity: activo ? 1 : 0.38,
                  cursor: activo ? "default" : "pointer",
                  padding: 0, flexShrink: 0,
                }}
              />
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        <span
          title={project.saludUpdatedAt ? `Último cambio: ${fmtFecha(project.saludUpdatedAt)}` : "Nunca actualizado"}
          style={{ fontSize: 9, color: stale ? "#F59E0B" : UI.dim, whiteSpace: "nowrap" }}
        >
          {stale ? "⚑ " : ""}{fmtHace(project.saludUpdatedAt)}
        </span>
      </div>
    </div>
  );
}

// ── Vista lista (densa) ──────────────────────────────────────────────────────

function Lista({
  proyectos, metricas, incidencias, saludEf, onOpen, onSetSalud,
}: {
  proyectos: Project[];
  metricas: (p: Project) => Metricas;
  incidencias: Record<string, number>;
  saludEf: (p: Project) => Salud;
  onOpen: (id: string) => void;
  onSetSalud: (id: string, s: Salud) => void;
}) {
  const cols = "1fr 132px 96px 84px 40px 40px 40px 92px";
  return (
    <div style={{ ...card, padding: "12px 14px", overflowX: "auto" }}>
      <div style={{
        display: "grid", gridTemplateColumns: cols, gap: 8,
        padding: "0 6px 7px", borderBottom: `1px solid ${UI.border}`,
        fontSize: 9, color: UI.dim, fontWeight: 700, letterSpacing: "0.07em",
        minWidth: 780,
      }}>
        <span>PROYECTO</span>
        <span>ESTATUS</span>
        <span>FASE</span>
        <span>CRITICIDAD</span>
        <span style={{ textAlign: "center" }} title="Incidencias abiertas">⚠</span>
        <span style={{ textAlign: "center" }} title="Tareas bloqueadas">🔴</span>
        <span style={{ textAlign: "center" }} title="Tareas activas">🔵</span>
        <span style={{ textAlign: "right" }}>ACTUALIZADO</span>
      </div>

      {proyectos.map(p => {
        const sal = saludEf(p), crit = critDe(p), fas = faseDe(p);
        const cfg = SALUD_CFG[sal];
        const m = metricas(p);
        const inc = incidencias[p.id] ?? 0;
        const dias = diasDesde(p.saludUpdatedAt);
        const stale = dias === null || dias > DIAS_STALE;
        return (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(p.id)}
            onKeyDown={e => { if (e.key === "Enter") onOpen(p.id); }}
            className="sigob-pcard"
            style={{
              display: "grid", gridTemplateColumns: cols, gap: 8,
              padding: "9px 6px", borderBottom: `1px solid ${UI.border}`,
              alignItems: "center", cursor: "pointer", minWidth: 780,
              borderLeft: `2px solid ${cfg.color}`,
              background: inc > 0 ? "rgba(239,68,68,0.035)" : "transparent",
              opacity: fas === "PAUSA" ? 0.55 : 1,
            }}
          >
            <span style={{ fontSize: 12, color: UI.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name}
            </span>

            <span style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
              {SALUD_ORDEN.map(s => {
                const c = SALUD_CFG[s];
                const activo = s === sal;
                return (
                  <button
                    key={s}
                    className="sigob-dot"
                    onClick={() => { if (!activo) onSetSalud(p.id, s); }}
                    title={activo ? `Actual: ${c.label}` : `Marcar como ${c.label}`}
                    aria-label={`Marcar como ${c.label}`}
                    style={{
                      width: 11, height: 11, borderRadius: "50%",
                      background: activo ? c.color : "transparent",
                      border: `1.5px solid ${c.color}`,
                      opacity: activo ? 1 : 0.35,
                      cursor: activo ? "default" : "pointer", padding: 0,
                    }}
                  />
                );
              })}
            </span>

            <span
              title={fas === "PAUSA" && p.pausaAuto ? `Stand-by automático: ${DIAS_STANDBY}+ días sin movimiento` : undefined}
              style={{ fontSize: 10, color: FASE_CFG[fas].color }}
            >
              {fas === "PAUSA" && p.pausaAuto ? "⏸ Pausa · auto" : fas === "PAUSA" ? "⏸ Pausa" : FASE_CFG[fas].label}
            </span>
            <span style={{ fontSize: 10, color: CRITICIDAD_CFG[crit].color, fontWeight: 600 }}>
              {CRITICIDAD_CFG[crit].label}
            </span>
            <span style={{ fontSize: 11, textAlign: "center", color: inc > 0 ? "#EF4444" : UI.dim, fontWeight: inc > 0 ? 700 : 400 }}>
              {inc || "—"}
            </span>
            <span style={{ fontSize: 11, textAlign: "center", color: m.bloqueadas > 0 ? "#EF4444" : UI.dim }}>
              {m.bloqueadas || "—"}
            </span>
            <span style={{ fontSize: 11, textAlign: "center", color: m.activas > 0 ? "#60A5FA" : UI.dim }}>
              {m.activas || "—"}
            </span>
            <span style={{ fontSize: 9, textAlign: "right", color: stale ? "#F59E0B" : UI.dim, whiteSpace: "nowrap" }}>
              {stale ? "⚑ " : ""}{fmtHace(p.saludUpdatedAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
