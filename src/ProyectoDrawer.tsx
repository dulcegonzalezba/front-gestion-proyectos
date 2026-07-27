import { useEffect, useMemo, useState, CSSProperties } from "react";
import {
  Project, Evento, Salud, Criticidad, Fase, EventoTipo, Severidad,
  UI, SALUD_CFG, SALUD_ORDEN, CRITICIDAD_CFG, FASE_CFG, TIPO_CFG, SEVERIDAD_CFG,
  TASK_BLOCKED, TASK_DONE, TASK_ACTIVE,
  salud as saludDe, criticidad as critDe, fase as faseDe,
  fmtFecha, fmtFechaHora, fmtHace, hoyISO,
} from "./proyectoEstado";

interface EstadoPatch {
  salud?: Salud;
  criticidad?: Criticidad;
  fase?: Fase;
  notas?: string;
  motivo?: string;
}

interface Props {
  project: Project;
  /** Datos del plan semanal: d.cells[nombre].tasks */
  d: any;
  checklistItems: any[];
  eventos: Evento[];
  loadingEventos: boolean;
  onClose: () => void;
  /** Devuelve el resultado del guardado; al drawer solo le importa que termine. */
  onEstado: (patch: EstadoPatch) => Promise<unknown>;
  onAddEvento: (e: { tipo: EventoTipo; titulo: string; descripcion: string; severidad: Severidad; fecha: string }) => Promise<void>;
  onToggleResuelto: (evento: Evento) => Promise<void>;
  onDeleteEvento: (evento: Evento) => Promise<void>;
  onAssociateTask: (projectId: string, cellName: string, taskId: string) => Promise<void>;
  onCreateTask: (projectId: string, cellName: string, t: { title: string; resp: string; status: string }) => Promise<void>;
}

const TASK_STATUSES = ["PENDIENTE", "EN_CURSO", "ESTA_SEMANA", "ALTA_PRIORIDAD", "URGENTE", "BLOQUEADO", "COMPLETADO"];

const field: CSSProperties = {
  background: UI.surface2,
  border: `1px solid ${UI.border}`,
  borderRadius: 8,
  color: UI.text,
  fontSize: 12,
  padding: "8px 10px",
  fontFamily: "system-ui,sans-serif",
  width: "100%",
  boxSizing: "border-box",
};

const sectionTitle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: UI.dim,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  marginBottom: 10,
};

const btnGhost: CSSProperties = {
  background: "none",
  border: `1px solid ${UI.border}`,
  borderRadius: 8,
  color: UI.muted,
  cursor: "pointer",
  fontSize: 11,
  padding: "7px 12px",
  fontFamily: "system-ui,sans-serif",
};

export default function ProyectoDrawer({
  project, d, checklistItems, eventos, loadingEventos,
  onClose, onEstado, onAddEvento, onToggleResuelto, onDeleteEvento,
  onAssociateTask, onCreateTask,
}: Props) {
  const sal  = saludDe(project);
  const crit = critDe(project);
  const fas  = faseDe(project);

  // Cambio de semáforo en dos pasos: permite capturar el motivo del cambio.
  const [pendingSalud, setPendingSalud] = useState<Salud | null>(null);
  const [motivo, setMotivo] = useState("");
  const [savingEstado, setSavingEstado] = useState(false);

  const [notas, setNotas] = useState(project.notas ?? "");
  const [composerTipo, setComposerTipo] = useState<EventoTipo | null>(null);
  const [form, setForm] = useState({ titulo: "", descripcion: "", severidad: "MEDIA" as Severidad, fecha: hoyISO() });
  const [savingEvento, setSavingEvento] = useState(false);
  const [filtro, setFiltro] = useState<"TODO" | EventoTipo>("TODO");
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const [asocCell, setAsocCell] = useState("");
  const [asocTask, setAsocTask] = useState("");
  const [creandoTarea, setCreandoTarea] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState({ cell: "", title: "", resp: "", status: "PENDIENTE" });
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    setNotas(project.notas ?? "");
    setPendingSalud(null);
    setMotivo("");
    setComposerTipo(null);
    setFiltro("TODO");
    setAsocCell(""); setAsocTask(""); setCreandoTarea(false);
  }, [project.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Tareas asociadas ──────────────────────────────────────────────────────
  const cells = d?.cells ?? {};
  const refs = project.taskRefs ?? [];
  const grupos = useMemo(() => {
    const g: Record<string, any[]> = {};
    refs.forEach(r => {
      const t = (cells[r.cellName]?.tasks ?? []).find((x: any) => x.id === r.taskId);
      if (!t) return;
      (g[r.cellName] ??= []).push(t);
    });
    return g;
  }, [project.id, refs.length, d]);

  const todasTareas = Object.values(grupos).flat();
  const nBloq = todasTareas.filter((t: any) => TASK_BLOCKED.includes(t.status)).length;
  const nAct  = todasTareas.filter((t: any) => TASK_ACTIVE.includes(t.status)).length;
  const nOk   = todasTareas.filter((t: any) => TASK_DONE.includes(t.status)).length;

  const asociadas = new Set(refs.map(r => r.taskId));
  const tareasDisponibles = asocCell
    ? ((cells[asocCell]?.tasks ?? []) as any[]).filter(t => !asociadas.has(t.id))
    : [];

  const pmoTasks = checklistItems.filter(x => x.projectId === project.id);

  // ── Bitácora ──────────────────────────────────────────────────────────────
  const eventosFiltrados = filtro === "TODO" ? eventos : eventos.filter(e => e.tipo === filtro);
  const incidenciasAbiertas = eventos.filter(e => e.tipo === "INCIDENCIA" && !e.resuelto).length;

  const aplicarSalud = async (nueva: Salud) => {
    setSavingEstado(true);
    try {
      await onEstado({ salud: nueva, motivo: motivo.trim() || undefined });
      setPendingSalud(null);
      setMotivo("");
    } finally { setSavingEstado(false); }
  };

  const guardarEvento = async () => {
    if (!form.titulo.trim() || !composerTipo || savingEvento) return;
    setSavingEvento(true);
    try {
      await onAddEvento({
        tipo: composerTipo,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        severidad: form.severidad,
        fecha: form.fecha,
      });
      setForm({ titulo: "", descripcion: "", severidad: "MEDIA", fecha: hoyISO() });
      setComposerTipo(null);
    } finally { setSavingEvento(false); }
  };

  const abrirComposer = (tipo: EventoTipo) => {
    setComposerTipo(tipo);
    setForm({
      titulo: "",
      descripcion: "",
      severidad: tipo === "INCIDENCIA" ? "ALTA" : "MEDIA",
      fecha: hoyISO(),
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(4,5,8,0.72)",
          zIndex: 200, animation: "sigob-fade-in 0.15s ease-out",
        }}
      />

      <aside
        className="sigob-drawer"
        role="dialog"
        aria-label={`Detalle de ${project.name}`}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          zIndex: 201,
          background: UI.bg,
          borderLeft: `1px solid ${UI.borderStrong}`,
          display: "flex", flexDirection: "column",
          fontFamily: "system-ui,sans-serif",
          boxShadow: "-24px 0 48px rgba(0,0,0,0.45)",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${UI.border}`,
          background: UI.surface,
          display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0,
        }}>
          <span style={{
            width: 4, alignSelf: "stretch", borderRadius: 2,
            background: SALUD_CFG[sal].color, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: UI.text, lineHeight: 1.3 }}>
              {project.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <Pill color={SALUD_CFG[sal].color} bg={SALUD_CFG[sal].bg} label={SALUD_CFG[sal].label} />
              <span style={{ fontSize: 10, color: UI.dim }}>
                Actualizado {fmtHace(project.saludUpdatedAt)}
              </span>
              {incidenciasAbiertas > 0 && (
                <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 600 }}>
                  ⚠ {incidenciasAbiertas} incidencia{incidenciasAbiertas !== 1 ? "s" : ""} abierta{incidenciasAbiertas !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ ...btnGhost, padding: "4px 10px", fontSize: 15, lineHeight: 1, color: UI.muted }}
          >
            ✕
          </button>
        </div>

        {/* ── Cuerpo scrolleable ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 40px" }}>

          {/* Semáforo */}
          <div style={sectionTitle}>Estatus operativo</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 10 }}>
            {SALUD_ORDEN.map(s => {
              const cfg = SALUD_CFG[s];
              const activo = sal === s;
              const seleccionado = pendingSalud === s;
              return (
                <button
                  key={s}
                  onClick={() => (activo ? setPendingSalud(null) : setPendingSalud(s))}
                  title={cfg.label}
                  style={{
                    background: activo ? cfg.bg : seleccionado ? cfg.bg : "transparent",
                    border: `1px solid ${activo || seleccionado ? cfg.color : UI.border}`,
                    borderRadius: 8,
                    color: activo || seleccionado ? cfg.color : UI.muted,
                    cursor: activo ? "default" : "pointer",
                    fontSize: 9, fontWeight: 700,
                    padding: "9px 4px",
                    lineHeight: 1.25,
                    fontFamily: "system-ui,sans-serif",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}
                >
                  <span style={{ fontSize: 12 }}>{cfg.icon}</span>
                  <span>{cfg.short}</span>
                </button>
              );
            })}
          </div>

          {pendingSalud && (
            <div style={{
              background: UI.surface, border: `1px solid ${SALUD_CFG[pendingSalud].color}`,
              borderRadius: 10, padding: 12, marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: UI.text, marginBottom: 8 }}>
                Cambiar a{" "}
                <strong style={{ color: SALUD_CFG[pendingSalud].color }}>
                  {SALUD_CFG[pendingSalud].label}
                </strong>
              </div>
              <input
                autoFocus
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") aplicarSalud(pendingSalud); }}
                placeholder="Motivo del cambio (opcional)"
                style={{ ...field, marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => aplicarSalud(pendingSalud)}
                  disabled={savingEstado}
                  style={{
                    background: SALUD_CFG[pendingSalud].color, border: "none", borderRadius: 8,
                    color: "#09090C", cursor: savingEstado ? "default" : "pointer",
                    fontSize: 11, fontWeight: 700, padding: "8px 16px", flex: 1,
                    fontFamily: "system-ui,sans-serif", opacity: savingEstado ? 0.6 : 1,
                  }}
                >
                  {savingEstado ? "Guardando…" : "Confirmar cambio"}
                </button>
                <button onClick={() => { setPendingSalud(null); setMotivo(""); }} style={btnGhost}>
                  Cancelar
                </button>
              </div>
              <div style={{ fontSize: 9, color: UI.dim, marginTop: 8 }}>
                Se guardará en la bitácora con fecha y hora.
              </div>
            </div>
          )}

          {/* Fase / Criticidad */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <div>
              <div style={{ ...sectionTitle, marginBottom: 6 }}>Fase</div>
              <select
                value={fas}
                onChange={e => onEstado({ fase: e.target.value as Fase })}
                style={{ ...field, color: FASE_CFG[fas].color }}
              >
                {(Object.keys(FASE_CFG) as Fase[]).map(f => (
                  <option key={f} value={f} style={{ color: UI.text }}>{FASE_CFG[f].label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ ...sectionTitle, marginBottom: 6 }}>Criticidad</div>
              <select
                value={crit}
                onChange={e => onEstado({ criticidad: e.target.value as Criticidad })}
                style={{ ...field, color: CRITICIDAD_CFG[crit].color }}
              >
                {(Object.keys(CRITICIDAD_CFG) as Criticidad[]).map(c => (
                  <option key={c} value={c} style={{ color: UI.text }}>{CRITICIDAD_CFG[c].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notas fijas */}
          <div style={sectionTitle}>Notas del proyecto</div>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            onBlur={() => { if ((project.notas ?? "") !== notas) onEstado({ notas }); }}
            placeholder="Contexto permanente: alcance, contactos, acuerdos base…"
            rows={3}
            style={{ ...field, resize: "vertical", marginBottom: 20, lineHeight: 1.5 }}
          />

          {/* ── Bitácora ─────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ ...sectionTitle, marginBottom: 0 }}>Bitácora</div>
            <span style={{ fontSize: 10, color: UI.dim }}>{eventos.length} registro{eventos.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Composer */}
          {!composerTipo ? (
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {(["INCIDENCIA", "NOTA", "HITO"] as EventoTipo[]).map(t => (
                <button
                  key={t}
                  onClick={() => abrirComposer(t)}
                  style={{
                    ...btnGhost,
                    flex: 1,
                    borderColor: UI.border,
                    color: TIPO_CFG[t].color,
                    fontWeight: 600,
                  }}
                >
                  {TIPO_CFG[t].icon} {TIPO_CFG[t].label}
                </button>
              ))}
            </div>
          ) : (
            <div style={{
              background: UI.surface,
              border: `1px solid ${TIPO_CFG[composerTipo].color}`,
              borderRadius: 10, padding: 12, marginBottom: 14,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TIPO_CFG[composerTipo].color }}>
                {TIPO_CFG[composerTipo].icon} Nueva {TIPO_CFG[composerTipo].label.toLowerCase()}
              </div>
              <input
                autoFocus
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder={composerTipo === "INCIDENCIA" ? "Ej. Caída de S3 del proveedor" : "Título *"}
                style={field}
              />
              <textarea
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Detalle: qué pasó, impacto, qué se hizo…"
                rows={3}
                style={{ ...field, resize: "vertical", lineHeight: 1.5 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: UI.dim, display: "block", marginBottom: 4 }}>Fecha del suceso</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    style={field}
                  />
                </div>
                {composerTipo === "INCIDENCIA" && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 9, color: UI.dim, display: "block", marginBottom: 4 }}>Severidad</label>
                    <select
                      value={form.severidad}
                      onChange={e => setForm(f => ({ ...f, severidad: e.target.value as Severidad }))}
                      style={{ ...field, color: SEVERIDAD_CFG[form.severidad].color }}
                    >
                      {(Object.keys(SEVERIDAD_CFG) as Severidad[]).map(s => (
                        <option key={s} value={s} style={{ color: UI.text }}>{SEVERIDAD_CFG[s].label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={guardarEvento}
                  disabled={!form.titulo.trim() || savingEvento}
                  style={{
                    background: form.titulo.trim() && !savingEvento ? TIPO_CFG[composerTipo].color : UI.surface2,
                    border: "none", borderRadius: 8,
                    color: form.titulo.trim() && !savingEvento ? "#09090C" : UI.dim,
                    cursor: form.titulo.trim() && !savingEvento ? "pointer" : "not-allowed",
                    fontSize: 11, fontWeight: 700, padding: "8px 16px", flex: 1,
                    fontFamily: "system-ui,sans-serif",
                  }}
                >
                  {savingEvento ? "Guardando…" : "Registrar en bitácora"}
                </button>
                <button onClick={() => setComposerTipo(null)} style={btnGhost}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Filtros de bitácora */}
          {eventos.length > 0 && (
            <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
              {([["TODO", "Todo"], ...(Object.keys(TIPO_CFG) as EventoTipo[]).map(t => [t, TIPO_CFG[t].label])] as [string, string][]).map(([k, label]) => {
                const activo = filtro === k;
                const n = k === "TODO" ? eventos.length : eventos.filter(e => e.tipo === k).length;
                if (n === 0 && k !== "TODO") return null;
                return (
                  <button
                    key={k}
                    onClick={() => setFiltro(k as any)}
                    style={{
                      background: activo ? "rgba(201,168,76,0.12)" : "transparent",
                      border: `1px solid ${activo ? UI.gold : UI.border}`,
                      borderRadius: 999,
                      color: activo ? UI.gold : UI.muted,
                      cursor: "pointer", fontSize: 10, padding: "4px 10px",
                      fontFamily: "system-ui,sans-serif",
                    }}
                  >
                    {label} {n}
                  </button>
                );
              })}
            </div>
          )}

          {/* Timeline */}
          {loadingEventos ? (
            <div style={{ color: UI.dim, fontSize: 11, padding: "12px 0" }}>Cargando bitácora…</div>
          ) : eventosFiltrados.length === 0 ? (
            <div style={{
              color: UI.dim, fontSize: 11, padding: "18px 12px", textAlign: "center",
              border: `1px dashed ${UI.border}`, borderRadius: 10, marginBottom: 20,
            }}>
              Sin registros todavía. Usa los botones de arriba para anotar lo del día.
            </div>
          ) : (
            <div style={{ marginBottom: 24 }}>
              {eventosFiltrados.map((ev, i) => (
                <TimelineItem
                  key={ev.id}
                  evento={ev}
                  ultimo={i === eventosFiltrados.length - 1}
                  confirmando={confirmDel === ev.id}
                  onConfirmDel={() => setConfirmDel(ev.id)}
                  onCancelDel={() => setConfirmDel(null)}
                  onDelete={async () => { await onDeleteEvento(ev); setConfirmDel(null); }}
                  onToggleResuelto={() => onToggleResuelto(ev)}
                />
              ))}
            </div>
          )}

          {/* ── Tareas ───────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ ...sectionTitle, marginBottom: 0 }}>Tareas asociadas</div>
            <div style={{ display: "flex", gap: 8, fontSize: 10 }}>
              {nBloq > 0 && <span style={{ color: "#EF4444" }}>{nBloq} bloq.</span>}
              {nAct > 0  && <span style={{ color: "#60A5FA" }}>{nAct} activa{nAct !== 1 ? "s" : ""}</span>}
              {nOk > 0   && <span style={{ color: "#4ADE80" }}>{nOk} lista{nOk !== 1 ? "s" : ""}</span>}
            </div>
          </div>

          {todasTareas.length === 0 ? (
            <div style={{ color: UI.dim, fontSize: 11, marginBottom: 12 }}>
              Sin tareas asociadas.
            </div>
          ) : (
            Object.entries(grupos).map(([cellName, tasks]) => (
              <div key={cellName} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: UI.dim, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 5 }}>
                  {cellName} · {tasks.length}
                </div>
                {tasks.map((t: any) => {
                  const color = TASK_BLOCKED.includes(t.status) ? "#EF4444"
                    : TASK_DONE.includes(t.status) ? "#4ADE80"
                    : TASK_ACTIVE.includes(t.status) ? "#60A5FA" : UI.muted;
                  return (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", background: UI.surface,
                      border: `1px solid ${UI.border}`, borderRadius: 8, marginBottom: 4,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, color: UI.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.title}
                      </span>
                      {t.resp && (
                        <span style={{ fontSize: 10, color: UI.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{t.resp}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {/* Asociar tarea existente */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, marginBottom: 8 }}>
            <select
              value={asocCell}
              onChange={e => { setAsocCell(e.target.value); setAsocTask(""); }}
              style={{ ...field, width: "auto", flex: "0 0 140px" }}
            >
              <option value="">Célula…</option>
              {Object.keys(cells).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              value={asocTask}
              onChange={e => setAsocTask(e.target.value)}
              disabled={!asocCell || tareasDisponibles.length === 0}
              style={{ ...field, width: "auto", flex: 1, minWidth: 140, color: asocCell && tareasDisponibles.length ? UI.text : UI.muted }}
            >
              <option value="">
                {asocCell && tareasDisponibles.length === 0 ? "Sin tareas libres" : "Tarea…"}
              </option>
              {tareasDisponibles.map(t => (
                <option key={t.id} value={t.id}>{t.title.length > 60 ? t.title.slice(0, 60) + "…" : t.title}</option>
              ))}
            </select>
            <button
              onClick={async () => {
                if (!asocCell || !asocTask || savingTask) return;
                setSavingTask(true);
                try { await onAssociateTask(project.id, asocCell, asocTask); setAsocCell(""); setAsocTask(""); }
                finally { setSavingTask(false); }
              }}
              disabled={!asocCell || !asocTask || savingTask}
              style={{
                background: asocCell && asocTask && !savingTask ? UI.gold : UI.surface2,
                border: "none", borderRadius: 8,
                color: asocCell && asocTask && !savingTask ? "#09090C" : UI.dim,
                cursor: asocCell && asocTask && !savingTask ? "pointer" : "not-allowed",
                fontSize: 11, fontWeight: 700, padding: "8px 14px",
                fontFamily: "system-ui,sans-serif",
              }}
            >
              Asociar
            </button>
          </div>

          {/* Crear tarea nueva */}
          {!creandoTarea ? (
            <button
              onClick={() => { setCreandoTarea(true); setNuevaTarea({ cell: "", title: "", resp: "", status: "PENDIENTE" }); }}
              style={{ ...btnGhost, width: "100%", borderStyle: "dashed", color: UI.muted }}
            >
              + Crear tarea nueva para este proyecto
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <select
                value={nuevaTarea.cell}
                onChange={e => setNuevaTarea(t => ({ ...t, cell: e.target.value }))}
                style={field}
              >
                <option value="">Célula… *</option>
                {Object.keys(cells).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input
                placeholder="Título de la tarea *"
                value={nuevaTarea.title}
                onChange={e => setNuevaTarea(t => ({ ...t, title: e.target.value }))}
                style={field}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="Responsable"
                  value={nuevaTarea.resp}
                  onChange={e => setNuevaTarea(t => ({ ...t, resp: e.target.value }))}
                  style={{ ...field, flex: 1 }}
                />
                <select
                  value={nuevaTarea.status}
                  onChange={e => setNuevaTarea(t => ({ ...t, status: e.target.value }))}
                  style={{ ...field, width: "auto", flex: "0 0 150px" }}
                >
                  {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={async () => {
                    if (!nuevaTarea.title.trim() || !nuevaTarea.cell || savingTask) return;
                    setSavingTask(true);
                    try {
                      await onCreateTask(project.id, nuevaTarea.cell, {
                        title: nuevaTarea.title.trim(),
                        resp: nuevaTarea.resp.trim(),
                        status: nuevaTarea.status,
                      });
                      setCreandoTarea(false);
                    } finally { setSavingTask(false); }
                  }}
                  disabled={!nuevaTarea.title.trim() || !nuevaTarea.cell || savingTask}
                  style={{
                    background: nuevaTarea.title.trim() && nuevaTarea.cell && !savingTask ? UI.gold : UI.surface2,
                    border: "none", borderRadius: 8,
                    color: nuevaTarea.title.trim() && nuevaTarea.cell && !savingTask ? "#09090C" : UI.dim,
                    cursor: nuevaTarea.title.trim() && nuevaTarea.cell && !savingTask ? "pointer" : "not-allowed",
                    fontSize: 11, fontWeight: 700, padding: "8px 14px", flex: 1,
                    fontFamily: "system-ui,sans-serif",
                  }}
                >
                  {savingTask ? "Guardando…" : "Guardar tarea"}
                </button>
                <button onClick={() => setCreandoTarea(false)} style={btnGhost}>Cancelar</button>
              </div>
            </div>
          )}

          {/* PMO operativo */}
          {pmoTasks.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={sectionTitle}>PMO operativo · {pmoTasks.length}</div>
              {pmoTasks.map((item: any) => {
                const done = item.status === "COMPLETADO";
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", background: UI.surface,
                    border: `1px solid ${UI.border}`, borderRadius: 8, marginBottom: 4,
                    opacity: done ? 0.55 : 1,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: done ? "#4ADE80" : "#F59E0B",
                    }} />
                    <span style={{
                      flex: 1, fontSize: 12, color: UI.text, minWidth: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      textDecoration: done ? "line-through" : "none",
                    }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: 9, color: UI.muted, flexShrink: 0 }}>{item.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

function Pill({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: bg, border: `1px solid ${color}40`, borderRadius: 999,
      color, fontSize: 10, fontWeight: 700, padding: "3px 9px", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function TimelineItem({
  evento, ultimo, confirmando, onConfirmDel, onCancelDel, onDelete, onToggleResuelto,
}: {
  evento: Evento;
  ultimo: boolean;
  confirmando: boolean;
  onConfirmDel: () => void;
  onCancelDel: () => void;
  onDelete: () => void;
  onToggleResuelto: () => void;
}) {
  const cfg = TIPO_CFG[evento.tipo] ?? TIPO_CFG.NOTA;
  const esIncidencia = evento.tipo === "INCIDENCIA";
  const color = evento.tipo === "CAMBIO_ESTATUS" && evento.saludNueva && SALUD_CFG[evento.saludNueva as Salud]
    ? SALUD_CFG[evento.saludNueva as Salud].color
    : cfg.color;
  const abierta = esIncidencia && !evento.resuelto;

  return (
    <div style={{ display: "flex", gap: 10, position: "relative" }}>
      {/* Rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 22 }}>
        <span style={{
          width: 22, height: 22, borderRadius: "50%",
          background: `${color}1F`, border: `1px solid ${color}`,
          color, fontSize: 10, lineHeight: "20px", textAlign: "center",
          flexShrink: 0, fontWeight: 700,
        }}>
          {cfg.icon}
        </span>
        {!ultimo && <span style={{ width: 1, flex: 1, background: UI.border, marginTop: 2 }} />}
      </div>

      {/* Contenido */}
      <div style={{
        flex: 1, minWidth: 0, paddingBottom: ultimo ? 0 : 14,
      }}>
        <div style={{
          background: UI.surface,
          border: `1px solid ${abierta ? `${color}55` : UI.border}`,
          borderLeft: `2px solid ${abierta ? color : UI.border}`,
          borderRadius: 8, padding: "9px 11px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, color: UI.text, fontWeight: 600, lineHeight: 1.35,
                textDecoration: esIncidencia && evento.resuelto ? "line-through" : "none",
                opacity: esIncidencia && evento.resuelto ? 0.7 : 1,
              }}>
                {evento.tipo === "CAMBIO_ESTATUS" ? (
                  <SaludDelta previa={evento.saludPrevia} nueva={evento.saludNueva} />
                ) : evento.titulo}
              </div>
              {evento.descripcion && (
                <div style={{ fontSize: 11, color: UI.muted, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {evento.descripcion}
                </div>
              )}
            </div>
            {esIncidencia && (
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: "0.05em",
                padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0,
                background: `${SEVERIDAD_CFG[evento.severidad]?.color ?? UI.muted}1A`,
                color: SEVERIDAD_CFG[evento.severidad]?.color ?? UI.muted,
              }}>
                {(SEVERIDAD_CFG[evento.severidad]?.label ?? evento.severidad).toUpperCase()}
              </span>
            )}
          </div>

          {/* Meta + acciones */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 7,
            flexWrap: "wrap", fontSize: 9, color: UI.dim,
          }}>
            <span title={fmtFechaHora(evento.createdAt)}>{fmtFecha(evento.fecha ?? evento.createdAt)}</span>
            <span>·</span>
            <span>{fmtHace(evento.createdAt)}</span>
            {evento.autor && <><span>·</span><span>{evento.autor}</span></>}
            {esIncidencia && evento.resuelto && evento.resueltoAt && (
              <><span>·</span><span style={{ color: "#4ADE80" }}>resuelta {fmtFecha(evento.resueltoAt)}</span></>
            )}

            <span style={{ flex: 1 }} />

            {esIncidencia && (
              <button
                onClick={onToggleResuelto}
                style={{
                  background: "none", border: `1px solid ${evento.resuelto ? UI.border : "#4ADE8055"}`,
                  borderRadius: 6, color: evento.resuelto ? UI.muted : "#4ADE80",
                  cursor: "pointer", fontSize: 9, padding: "3px 8px", fontFamily: "system-ui,sans-serif",
                }}
              >
                {evento.resuelto ? "Reabrir" : "✓ Resolver"}
              </button>
            )}

            {confirmando ? (
              <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button
                  onClick={onDelete}
                  style={{ background: "#EF4444", border: "none", borderRadius: 6, color: "#09090C", cursor: "pointer", fontSize: 9, fontWeight: 700, padding: "3px 8px" }}
                >
                  Eliminar
                </button>
                <button
                  onClick={onCancelDel}
                  style={{ background: "none", border: `1px solid ${UI.border}`, borderRadius: 6, color: UI.muted, cursor: "pointer", fontSize: 9, padding: "3px 8px" }}
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={onConfirmDel}
                aria-label="Eliminar registro"
                style={{ background: "none", border: "none", color: UI.dim, cursor: "pointer", fontSize: 12, padding: "0 2px", lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaludDelta({ previa, nueva }: { previa: string | null; nueva: string | null }) {
  const p = previa && SALUD_CFG[previa as Salud];
  const n = nueva && SALUD_CFG[nueva as Salud];
  if (!p || !n) return <>Cambio de estatus</>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontWeight: 600 }}>
      <span style={{ color: p.color, opacity: 0.75 }}>{p.label}</span>
      <span style={{ color: UI.dim }}>→</span>
      <span style={{ color: n.color }}>{n.label}</span>
    </span>
  );
}
