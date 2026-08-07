/**
 * SirPlusPanel — vista de águila de SIR Plus para el inicio.
 *
 * Cuatro capas apiladas (Sistema, DevSecOps, DevOps, Infraestructura). Cada
 * capa agrupa nodos y cada nodo una lista de puntos a reforzar/verificar con
 * su método de comprobación. El color de un nodo y de una capa se deriva del
 * peor estado de lo que contiene, así que marcar puntos repinta el panel.
 *
 * El estado vive en el KV compartido del backend: lo que marca una persona lo
 * ve el resto del equipo.
 */

import { useMemo, useState } from "react";
import {
  CAPAS, idsDeCapa, idsDeNodo,
  type Capa, type Nodo,
} from "./sirPlusCapas";
import ListaChecks, { Punto } from "./SirPlusNodo";
import {
  ESTADOS, CICLO, estadoDe, resumirEstados,
  useSirPlusEstado,
  type EstadoKey, type EstadoMap,
} from "./sirPlusEstado";

const T = {
  card: "#0F1117", surface: "#14161E", hover: "#1A1D28",
  border: "#1E2233", borderLt: "#272B40",
  text1: "#E8E3D8", text2: "#7A7F9A", text3: "#3E4260",
  gold: "#C9A84C",
};

// ── Piezas pequeñas ───────────────────────────────────────────────────────────

/** Barra que muestra la mezcla de estados de un conjunto de puntos. */
function Mezcla({ conteo, total }: { conteo: Record<EstadoKey, number>; total: number }) {
  if (!total) return null;
  return (
    <div style={{ display: "flex", height: 4, borderRadius: 3, overflow: "hidden", background: T.surface }}>
      {CICLO.filter(e => conteo[e] > 0).map(e => (
        <div key={e} title={`${ESTADOS[e].label}: ${conteo[e]}`}
          style={{ width: `${(conteo[e] / total) * 100}%`, background: ESTADOS[e].color, opacity: e === "sin_verificar" ? 0.35 : 0.9 }} />
      ))}
    </div>
  );
}

function contar(map: EstadoMap, ids: string[]): Record<EstadoKey, number> {
  const base = { sin_verificar: 0, riesgo: 0, parcial: 0, proceso: 0, ok: 0, na: 0 } as Record<EstadoKey, number>;
  ids.forEach(id => { base[estadoDe(map, id)] += 1; });
  return base;
}

// ── Panel de detalle de un nodo ───────────────────────────────────────────────

interface DetalleProps {
  nodo: Nodo;
  capa: Capa;
  map: EstadoMap;
  onCiclar: (id: string) => void;
  onActualizar: (id: string, cambios: { evidencia?: string; resp?: string; estado?: EstadoKey }) => void;
  onCerrar: () => void;
}

function Detalle({ nodo, capa, map, onCiclar, onActualizar, onCerrar }: DetalleProps) {
  const ids = idsDeNodo(nodo);
  const conteo = contar(map, ids);
  const resumen = resumirEstados(ids.map(id => estadoDe(map, id)));

  return (
    <>
      {/* Fondo para cerrar en pantallas chicas */}
      <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60 }} />
      <aside
        role="dialog"
        aria-label={`Detalle de ${nodo.nombre}`}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 61,
          width: "min(560px, 100vw)", background: "#0B0D14",
          borderLeft: `1px solid ${T.borderLt}`, overflowY: "auto",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Encabezado */}
        <div style={{
          position: "sticky", top: 0, zIndex: 2, background: "#0B0D14",
          borderBottom: `1px solid ${T.border}`, padding: "18px 22px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: capa.color, marginBottom: 6 }}>
                {capa.nombre}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text1, letterSpacing: "-0.01em", lineHeight: 1.25 }}>
                {nodo.nombre}
              </div>
            </div>
            <button onClick={onCerrar} aria-label="Cerrar"
              style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text2, cursor: "pointer", fontSize: 14, padding: "4px 10px", flexShrink: 0 }}>
              ✕
            </button>
          </div>
          <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.55, marginTop: 10 }}>{nodo.resumen}</div>
          {nodo.pregunta && (
            <div style={{
              marginTop: 12, padding: "9px 12px", background: T.surface,
              borderLeft: `3px solid ${capa.color}`, borderRadius: "0 8px 8px 0",
              fontSize: 12, color: T.text1, fontWeight: 600, lineHeight: 1.45,
            }}>
              {nodo.pregunta}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <Punto estado={resumen} />
            <span style={{ fontSize: 10, color: ESTADOS[resumen].color, fontWeight: 700 }}>{ESTADOS[resumen].label}</span>
            <span style={{ fontSize: 10, color: T.text3 }}>
              {conteo.ok + conteo.na}/{ids.length} resueltos · {conteo.sin_verificar} sin verificar
            </span>
          </div>
        </div>

        {/* Puntos */}
        <div style={{ padding: "16px 22px 40px" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 12 }}>
            Qué reforzar y verificar
          </div>

          <ListaChecks nodo={nodo} map={map} onCiclar={onCiclar} onActualizar={onActualizar} />
        </div>
      </aside>
    </>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

interface SirPlusPanelProps {
  /** Enlace a la página de radiografía, si el contenedor la ofrece. */
  onVerRadiografia?: () => void;
}

export default function SirPlusPanel({ onVerRadiografia }: SirPlusPanelProps = {}) {
  const { map, sync, ciclar, actualizar } = useSirPlusEstado();
  // Todas colapsadas de inicio: así las cuatro capas se ven de un vistazo y ni
  // Infraestructura ni DevOps quedan empujadas debajo del contenido de Sistema.
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set());
  const [detalle, setDetalle] = useState<{ nodo: Nodo; capa: Capa } | null>(null);
  const [filtro, setFiltro] = useState<EstadoKey | "todos">("todos");

  const toggleCapa = (id: string) =>
    setAbiertas(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const totales = useMemo(() => {
    const ids = CAPAS.flatMap(idsDeCapa);
    return { ids, conteo: contar(map, ids) };
  }, [map]);

  const avance = totales.ids.length
    ? Math.round(((totales.conteo.ok + totales.conteo.na) / totales.ids.length) * 100)
    : 0;

  // "local" también aparece cuando aún no existe la clave en el servidor, así que
  // sin nada marcado todavía se anuncia como "sin cambios" y no como una falla.
  const sinMarcar = Object.keys(map).length === 0;
  const sincronia =
    sync === "guardando" ? { t: "Guardando…", c: T.gold } :
    sync === "cargando"  ? { t: "Cargando…",  c: T.text3 } :
    sync === "local"     ? (sinMarcar
                             ? { t: "Sin marcar todavía", c: T.text3 }
                             : { t: "Solo en este equipo", c: "#F59E0B" }) :
                           { t: "Compartido con el equipo", c: "#22C55E" };

  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.card} 0%, #12141C 100%)`,
      border: `1px solid ${T.border}`, borderRadius: 16,
      padding: "22px 24px", marginBottom: 20,
      boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
    }}>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: T.gold, marginBottom: 7, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 3, height: 14, background: T.gold, borderRadius: 2, display: "inline-block" }} />
            SIR Plus — Vista de águila
          </div>
          <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.55, maxWidth: 640 }}>
            Las cuatro capas que sostienen el Sistema Integral de Recaudación remasterizado. No es seguimiento de
            tareas: es el mapa de <strong style={{ color: T.text1 }}>qué debemos considerar</strong> en cada capa para
            armar la arquitectura. Abre una capa, entra a un bloque y verás qué reforzar y con qué se comprueba.
            Todo nace <strong style={{ color: T.text1 }}>sin verificar</strong> — el color lo pone el equipo conforme
            confirma cada punto con evidencia.
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: avance > 0 ? "#22C55E" : T.text3, lineHeight: 1 }}>{avance}%</div>
          <div style={{ fontSize: 9, color: T.text3, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>
            {totales.conteo.ok + totales.conteo.na} de {totales.ids.length} resueltos
          </div>
          <div style={{ fontSize: 9, color: sincronia.c, marginTop: 6, display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sincronia.c, display: "inline-block" }} />
            {sincronia.t}
          </div>
        </div>
      </div>

      {/* Leyenda / filtro */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ fontSize: 9, color: T.text3, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginRight: 4 }}>
          Semáforo
        </span>
        <button onClick={() => setFiltro("todos")} style={{
          background: filtro === "todos" ? T.hover : "transparent",
          border: `1px solid ${filtro === "todos" ? T.borderLt : T.border}`,
          borderRadius: 20, padding: "3px 10px", fontSize: 10,
          color: filtro === "todos" ? T.text1 : T.text2, cursor: "pointer", fontFamily: "system-ui,sans-serif",
        }}>
          Todos ({totales.ids.length})
        </button>
        {CICLO.map(e => {
          const activo = filtro === e;
          const n = totales.conteo[e];
          return (
            <button key={e} onClick={() => setFiltro(activo ? "todos" : e)} title={ESTADOS[e].desc}
              style={{
                display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                background: activo ? ESTADOS[e].bg : "transparent",
                border: `1px solid ${activo ? ESTADOS[e].color : T.border}`,
                borderRadius: 20, padding: "3px 10px", fontSize: 10,
                color: activo ? ESTADOS[e].color : T.text2, fontFamily: "system-ui,sans-serif",
                opacity: n === 0 && !activo ? 0.5 : 1,
              }}>
              <Punto estado={e} size={6} />
              {ESTADOS[e].label} <span style={{ color: T.text3 }}>{n}</span>
            </button>
          );
        })}
        {onVerRadiografia && (
          <button onClick={onVerRadiografia} style={{
            marginLeft: "auto", background: "transparent", border: `1px solid ${T.gold}55`,
            borderRadius: 8, padding: "4px 12px", fontSize: 10, fontWeight: 600,
            color: T.gold, cursor: "pointer", fontFamily: "system-ui,sans-serif",
          }}>
            Ver radiografía completa →
          </button>
        )}
      </div>

      {/* Capas */}
      {CAPAS.map((capa, iCapa) => {
        const ids = idsDeCapa(capa);
        const conteo = contar(map, ids);
        const resumen = resumirEstados(ids.map(id => estadoDe(map, id)));
        const abierta = abiertas.has(capa.id);

        return (
          <div key={capa.id} style={{ marginBottom: 12 }}>
            {/* Cabecera de capa */}
            <button
              onClick={() => toggleCapa(capa.id)}
              aria-expanded={abierta}
              style={{
                width: "100%", textAlign: "left", cursor: "pointer",
                background: `linear-gradient(105deg, ${capa.color}22 0%, ${capa.color}0A 40%, ${T.surface} 100%)`,
                border: `1px solid ${capa.color}55`,
                borderLeft: `5px solid ${capa.color}`,
                borderRadius: abierta ? "14px 14px 0 0" : 14,
                padding: "16px 20px", fontFamily: "system-ui,sans-serif",
                display: "flex", flexDirection: "column", gap: 12,
                boxShadow: `inset 0 1px 0 ${capa.color}20, 0 2px 14px ${capa.color}0A`,
              }}
            >
              {/* Línea 1 — identidad de la capa */}
              <span style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", width: "100%" }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: capa.color + "1F", border: `1px solid ${capa.color}66`,
                  color: capa.color, fontSize: 13, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  letterSpacing: "-0.02em",
                }}>
                  {String(CAPAS.length - iCapa).padStart(2, "0")}
                </span>
                <span style={{ flex: 1, minWidth: 180 }}>
                  <span style={{ display: "block", fontSize: 17, fontWeight: 800, color: T.text1, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    {capa.nombre}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: capa.color, marginTop: 3, fontWeight: 600 }}>{capa.sub}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
                  <Punto estado={resumen} />
                  <span style={{ fontSize: 10, color: ESTADOS[resumen].color, fontWeight: 700 }}>{ESTADOS[resumen].label}</span>
                  <span style={{
                    fontSize: 11, color: capa.color, marginLeft: 6,
                    border: `1px solid ${capa.color}44`, borderRadius: 7,
                    padding: "3px 9px", fontWeight: 700,
                  }}>
                    {abierta ? "▾ Cerrar" : "▸ Abrir"}
                  </span>
                </span>
              </span>

              {/* Línea 2 — semáforo agregado */}
              <span style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 160 }}>
                  <Mezcla conteo={conteo} total={ids.length} />
                </span>
                <span style={{ fontSize: 10, color: T.text3, flexShrink: 0 }}>
                  {ids.length} puntos · {conteo.ok + conteo.na} resueltos
                  {conteo.riesgo > 0 && <span style={{ color: ESTADOS.riesgo.color, fontWeight: 700 }}> · {conteo.riesgo} en riesgo</span>}
                </span>
              </span>

              {/* Línea 3 — qué contiene, visible sin abrir */}
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%" }}>
                {capa.grupos.map(g => (
                  <span key={g.id} style={{
                    fontSize: 9.5, color: T.text2, background: "#0B0D14",
                    border: `1px solid ${T.border}`, borderRadius: 20,
                    padding: "3px 9px", whiteSpace: "nowrap",
                  }}>
                    {g.nombre} <span style={{ color: T.text3 }}>{g.nodos.length}</span>
                  </span>
                ))}
              </span>
            </button>

            {/* Cuerpo de capa */}
            {abierta && (
              <div style={{
                border: `1px solid ${capa.color}25`, borderTop: "none",
                borderRadius: "0 0 12px 12px", padding: "14px 18px 18px",
                background: "#0C0E15",
              }}>
                <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.6, marginBottom: 16, maxWidth: 760 }}>
                  {capa.descripcion}
                </div>

                {capa.grupos.map(grupo => {
                  const nodosVisibles = grupo.nodos.filter(n =>
                    filtro === "todos" || n.checks.some(c => estadoDe(map, c.id) === filtro)
                  );
                  if (!nodosVisibles.length) return null;

                  return (
                    <div key={grupo.id} style={{ marginBottom: 18 }}>
                      <div style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
                        color: T.text3, marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: capa.color, display: "inline-block" }} />
                        {grupo.nombre}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))", gap: 10 }}>
                        {nodosVisibles.map(nodo => {
                          const nIds = idsDeNodo(nodo);
                          const nConteo = contar(map, nIds);
                          const nResumen = resumirEstados(nIds.map(id => estadoDe(map, id)));
                          const clr = ESTADOS[nResumen].color;
                          return (
                            <button
                              key={nodo.id}
                              onClick={() => setDetalle({ nodo, capa })}
                              style={{
                                textAlign: "left", cursor: "pointer", fontFamily: "system-ui,sans-serif",
                                background: nResumen === "sin_verificar" ? T.surface : ESTADOS[nResumen].bg,
                                border: `1px solid ${nResumen === "sin_verificar" ? T.border : clr + "45"}`,
                                borderRadius: 10, padding: "12px 14px",
                                display: "flex", flexDirection: "column", gap: 8, minHeight: 118,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Punto estado={nResumen} size={8} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: T.text1, lineHeight: 1.3, flex: 1 }}>
                                  {nodo.nombre}
                                </span>
                              </div>
                              <div style={{
                                fontSize: 10, color: T.text2, lineHeight: 1.5, flex: 1,
                                display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                              }}>
                                {nodo.resumen}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                <Mezcla conteo={nConteo} total={nIds.length} />
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.text3 }}>
                                  <span>{nConteo.ok + nConteo.na}/{nIds.length} resueltos</span>
                                  <span style={{ color: clr, fontWeight: 700 }}>{ESTADOS[nResumen].label}</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {detalle && (
        <Detalle
          nodo={detalle.nodo}
          capa={detalle.capa}
          map={map}
          onCiclar={ciclar}
          onActualizar={actualizar}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
