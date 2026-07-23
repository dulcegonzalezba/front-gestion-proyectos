import { useState } from "react";
import { getToken } from "./auth";

type SnapMeta = { id: number; isoWeek: string; week: string; savedAt: string };

interface Props {
  checkpoints: SnapMeta[];
  currentWeek?: string;
  pmoItems?: any[];
  onView?: (snap: any) => void;
  onGeneratePdf?: (snap: any) => void;
  onDeleteCheckpoint?: (id: number) => void | Promise<void>;
  pdfGenerating?: boolean;
}

const API = "/api/snapshots";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STATUS_RANK = ["NO INICIADO", "EN PROGRESO", "EN REVISIÓN", "COMPLETADO", "BLOQUEADO"];
const rank = (s: string) => STATUS_RANK.indexOf(s ?? "NO INICIADO");

const CLR = {
  avance:    "#22c55e",
  regresion: "#ef4444",
  nuevas:    "#3b82f6",
  perdidas:  "#f97316",
  sinCambio: "#4a4f64",
};

const PILL = (color: string, label: string, count: number) =>
  count > 0 ? (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: color + "20", color, border: `1px solid ${color}40`,
      borderRadius: 12, padding: "1px 8px", fontSize: 10, fontWeight: 600,
    }}>
      {label} {count}
    </span>
  ) : null;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function CheckpointTimeline({ checkpoints, currentWeek, onView, onGeneratePdf, onDeleteCheckpoint, pdfGenerating }: Props) {
  const [selection, setSelection] = useState<number[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [comparison, setComparison] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [pdfRowId, setPdfRowId] = useState<number | null>(null);

  // Reimprime el PDF de un checkpoint guardado (comparado contra el inmediatamente anterior).
  // Carga el snapshot completo por id — la lista solo trae metadatos — y delega en onGeneratePdf.
  const reprintPdf = async (id: number) => {
    if (!onGeneratePdf) return;
    setPdfRowId(id);
    setError("");
    try {
      const res = await fetch(`${API}/${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Error al cargar checkpoint");
      const snap = await res.json();
      await onGeneratePdf(snap);
    } catch (e: any) {
      setError(e.message || "Error al generar PDF");
    } finally {
      setPdfRowId(null);
    }
  };

  const toggleSelect = (id: number) => {
    if (selection.includes(id)) {
      setSelection(s => s.filter(x => x !== id));
      setComparison(null);
      setDetail(null);
    } else if (selection.length < 2) {
      setSelection(s => [...s, id]);
      setComparison(null);
      setDetail(null);
    }
  };

  const viewSnap = async (id: number) => {
    setLoading(true);
    setError("");
    setComparison(null);
    try {
      const res = await fetch(`${API}/${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Error al cargar checkpoint");
      const snap = await res.json();
      setDetail(snap);
      if (onView) onView(snap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const compare = async () => {
    if (selection.length !== 2) return;
    setLoading(true);
    setError("");
    setDetail(null);
    const [fromId, toId] = [...selection].sort((a, b) => a - b);
    try {
      const res = await fetch(`${API}/compare?fromId=${fromId}&toId=${toId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Error al comparar checkpoints");
      const data = await res.json();
      setComparison(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkpoints.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#3E4260", fontSize: 13 }}>
        No hay checkpoints guardados aún.<br />
        <span style={{ fontSize: 11 }}>Usa el botón "Checkpoint" en la barra superior para crear uno.</span>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui,sans-serif" }}>

      {/* Timeline */}
      <div style={{
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        paddingBottom: 8, marginBottom: 16,
      }}>
        <div style={{ display: "flex", gap: 0, alignItems: "center", minWidth: "max-content", padding: "8px 0" }}>
          {[...checkpoints].reverse().map((cp, i, arr) => {
            const sel = selection.includes(cp.id);
            const selIdx = selection.indexOf(cp.id);
            return (
              <div key={cp.id} style={{ display: "flex", alignItems: "center" }}>
                {/* Connector */}
                {i > 0 && (
                  <div style={{ width: 40, height: 2, background: "#1E2233", flexShrink: 0 }} />
                )}
                {/* Node */}
                <div
                  onClick={() => toggleSelect(cp.id)}
                  title={`${cp.week} — ${fmtDate(cp.savedAt)}`}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    cursor: "pointer", padding: "4px 8px",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    border: `2px solid ${sel ? "#C9A84C" : "#1E2233"}`,
                    background: sel ? "rgba(201,168,76,0.15)" : "#0F1117",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: sel ? "#C9A84C" : "#7A7F9A",
                    fontSize: 11, fontWeight: 700,
                    position: "relative",
                    transition: "all 0.15s",
                  }}>
                    {sel && selIdx === 0 ? "A" : sel && selIdx === 1 ? "B" : i + 1}
                    {cp.isoWeek === currentWeek && (
                      <span style={{
                        position: "absolute", top: -4, right: -4,
                        width: 8, height: 8, borderRadius: "50%",
                        background: "#22c55e", border: "2px solid #09090C",
                      }} />
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: sel ? "#C9A84C" : "#4A4F64", textAlign: "center", maxWidth: 64, lineHeight: 1.2 }}>
                    {cp.isoWeek}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        {selection.length === 1 && (
          <>
            <button
              onClick={() => viewSnap(selection[0])}
              disabled={loading}
              style={{
                background: "rgba(201,168,76,0.1)", color: "#C9A84C",
                border: "1px solid #C9A84C40", borderRadius: 8,
                padding: "6px 14px", fontSize: 11, fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Cargando…" : "Ver checkpoint"}
            </button>
            {detail && onGeneratePdf && (
              <button
                onClick={() => onGeneratePdf(detail)}
                disabled={pdfGenerating}
                style={{
                  background: pdfGenerating ? "none" : "rgba(99,102,241,0.1)",
                  color: pdfGenerating ? "#4A4F64" : "#818cf8",
                  border: `1px solid ${pdfGenerating ? "#1E2233" : "#818cf840"}`,
                  borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 600,
                  cursor: pdfGenerating ? "not-allowed" : "pointer",
                }}
              >
                {pdfGenerating ? "Generando PDF…" : "📄 Generar PDF"}
              </button>
            )}
          </>
        )}
        {selection.length === 2 && (
          <button
            onClick={compare}
            disabled={loading}
            style={{
              background: "rgba(201,168,76,0.1)", color: "#C9A84C",
              border: "1px solid #C9A84C40", borderRadius: 8,
              padding: "6px 14px", fontSize: 11, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Comparando…" : "Comparar A → B"}
          </button>
        )}
        {selection.length > 0 && (
          <button
            onClick={() => { setSelection([]); setComparison(null); setDetail(null); }}
            style={{
              background: "none", color: "#4A4F64", border: "1px solid #1E2233",
              borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer",
            }}
          >
            Limpiar selección
          </button>
        )}
        {selection.length === 0 && (
          <div style={{ color: "#4A4F64", fontSize: 11 }}>
            Selecciona un punto para verlo · Selecciona dos para comparar · 📄 PDF en cada fila reimprime el reporte
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: "8px 12px", background: "#2d0000", border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 11, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Detail view */}
      {detail && <SnapDetail snap={detail} />}

      {/* Comparison view */}
      {comparison && <ComparisonView data={comparison} />}

      {/* Checkpoint list below timeline */}
      <div style={{ marginTop: 8 }}>
        {[...checkpoints].reverse().map((cp, i) => {
          const sel = selection.includes(cp.id);
          return (
            <div
              key={cp.id}
              onClick={() => toggleSelect(cp.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", marginBottom: 4,
                background: sel ? "rgba(201,168,76,0.07)" : "#0F1117",
                border: `1px solid ${sel ? "#C9A84C40" : "#1E2233"}`,
                borderRadius: 8, cursor: "pointer",
                transition: "background 0.1s, border-color 0.1s",
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: sel ? "rgba(201,168,76,0.2)" : "#1E2233",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: sel ? "#C9A84C" : "#4A4F64", fontSize: 10, fontWeight: 700, flexShrink: 0,
              }}>
                {sel ? (selection.indexOf(cp.id) === 0 ? "A" : "B") : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#E8E3D8", fontWeight: 600, fontSize: 12 }}>{cp.week}</div>
                <div style={{ color: "#4A4F64", fontSize: 10 }}>{cp.isoWeek} · {fmtDate(cp.savedAt)}</div>
              </div>
              {cp.isoWeek === currentWeek && (
                <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700 }}>ACTUAL</span>
              )}
              {onGeneratePdf && (
                <button
                  onClick={e => { e.stopPropagation(); reprintPdf(cp.id); }}
                  title="Reimprimir PDF (comparado con el checkpoint inmediatamente anterior)"
                  disabled={pdfRowId === cp.id || pdfGenerating}
                  style={{
                    background: "none",
                    border: `1px solid ${pdfRowId === cp.id ? "#1E2233" : "#818cf840"}`,
                    borderRadius: 6,
                    color: pdfRowId === cp.id || pdfGenerating ? "#4A4F64" : "#818cf8",
                    cursor: pdfRowId === cp.id || pdfGenerating ? "not-allowed" : "pointer",
                    fontSize: 11, fontWeight: 600, padding: "3px 9px", flexShrink: 0, whiteSpace: "nowrap",
                  }}
                >
                  {pdfRowId === cp.id ? "Generando…" : "📄 PDF"}
                </button>
              )}
              {onDeleteCheckpoint && (
                confirmDelete === cp.id ? (
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { onDeleteCheckpoint(cp.id); setConfirmDelete(null); }}
                      style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 6, padding: "3px 9px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}
                    >
                      Eliminar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{ background: "#1A1D28", color: "#7A7F9A", border: "none", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(cp.id); }}
                    title="Eliminar checkpoint"
                    style={{ background: "none", border: "none", color: "#4A4F64", cursor: "pointer", fontSize: 13, padding: "2px 4px", flexShrink: 0 }}
                  >
                    🗑
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SnapDetail({ snap }: { snap: any }) {
  const cellsObj: Record<string, any> = snap.data?.cells ?? {};
  const cellEntries = Object.entries(cellsObj);
  const allTasks = cellEntries.flatMap(([, cell]: [string, any]) => cell.tasks ?? []);
  const done = allTasks.filter((t: any) => t.status === "COMPLETADO").length;
  const total = allTasks.length;

  return (
    <div style={{ background: "#0F1117", border: "1px solid #1E2233", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#E8E3D8", fontWeight: 700, fontSize: 14 }}>{snap.week}</div>
          <div style={{ color: "#4A4F64", fontSize: 10 }}>{snap.isoWeek} · {fmtDate(snap.savedAt)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>{done}/{total}</span>
          <span style={{ color: "#4A4F64", fontSize: 12 }}>completadas</span>
        </div>
      </div>

      {cellEntries.map(([cellName, cell]: [string, any]) => {
        const tasks: any[] = cell.tasks ?? [];
        if (tasks.length === 0) return null;
        const cellDone = tasks.filter((t: any) => t.status === "COMPLETADO").length;
        return (
          <div key={cellName} style={{ marginBottom: 10 }}>
            <div style={{ color: "#7A7F9A", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>
              {cellName} · {cellDone}/{tasks.length}
            </div>
            {tasks.map((t: any) => (
              <div key={t.id} style={{
                display: "flex", gap: 8, alignItems: "center",
                padding: "4px 0", borderBottom: "1px solid #0F1117",
              }}>
                <StatusDot status={t.status} />
                <span style={{ color: "#E8E3D8", fontSize: 11, flex: 1 }}>{t.title}</span>
                <span style={{ color: "#4A4F64", fontSize: 10 }}>{t.status}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ComparisonView({ data }: { data: any }) {
  const { from, to, summary, cells } = data;
  const hasChanges = summary.totalAvance + summary.totalRegresion + summary.totalNuevas + summary.totalPerdidas > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{
        background: "#0F1117", border: "1px solid #1E2233", borderRadius: 10,
        padding: 16, marginBottom: 12,
      }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 9, color: "#4A4F64", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 2 }}>CHECKPOINT A (antes)</div>
            <div style={{ color: "#E8E3D8", fontWeight: 600, fontSize: 13 }}>{from.week}</div>
            <div style={{ color: "#4A4F64", fontSize: 10 }}>{from.isoWeek} · {fmtDate(from.savedAt)}</div>
          </div>
          <div style={{ color: "#C9A84C", fontSize: 20, alignSelf: "center" }}>→</div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 9, color: "#4A4F64", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 2 }}>CHECKPOINT B (después)</div>
            <div style={{ color: "#E8E3D8", fontWeight: 600, fontSize: 13 }}>{to.week}</div>
            <div style={{ color: "#4A4F64", fontSize: 10 }}>{to.isoWeek} · {fmtDate(to.savedAt)}</div>
          </div>
        </div>

        {/* Summary pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PILL(CLR.avance, "Avance", summary.totalAvance)}
          {PILL(CLR.regresion, "Regresión", summary.totalRegresion)}
          {PILL(CLR.nuevas, "Nuevas", summary.totalNuevas)}
          {PILL(CLR.perdidas, "Perdidas", summary.totalPerdidas)}
          {PILL(CLR.sinCambio, "Sin cambio", summary.totalSinCambio)}
        </div>

        {!hasChanges && (
          <div style={{ color: "#4A4F64", fontSize: 11, marginTop: 8 }}>Sin cambios detectados entre estos dos checkpoints.</div>
        )}
      </div>

      {/* Per-cell diff */}
      {cells.map((cell: any) => {
        const total = cell.avance.length + cell.regresion.length + cell.nuevas.length + cell.perdidas.length + cell.sinCambio.length;
        if (total === 0) return null;
        return (
          <div key={cell.cellName} style={{
            background: "#0F1117", border: "1px solid #1E2233", borderRadius: 10,
            padding: 14, marginBottom: 8,
          }}>
            <div style={{ color: "#7A7F9A", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
              {cell.cellName}
            </div>

            {cell.avance.length > 0 && (
              <Section label="Avance" color={CLR.avance} items={cell.avance} type="change" />
            )}
            {cell.regresion.length > 0 && (
              <Section label="Regresión" color={CLR.regresion} items={cell.regresion} type="change" />
            )}
            {cell.nuevas.length > 0 && (
              <Section label="Nuevas tareas" color={CLR.nuevas} items={cell.nuevas} type="task" />
            )}
            {cell.perdidas.length > 0 && (
              <Section label="Tareas perdidas" color={CLR.perdidas} items={cell.perdidas} type="task" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ label, color, items, type }: { label: string; color: string; items: any[]; type: "change" | "task" }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ color, fontSize: 10, fontWeight: 700 }}>{label.toUpperCase()}</span>
        <span style={{ color: "#4A4F64", fontSize: 10 }}>({items.length})</span>
      </div>
      {items.map((item: any, i: number) => {
        if (type === "change") {
          const { before, after } = item;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 0 4px 14px",
            }}>
              <span style={{ color: "#E8E3D8", fontSize: 11, flex: 1 }}>{after.title ?? before.title}</span>
              <span style={{ color: "#4A4F64", fontSize: 10, whiteSpace: "nowrap" }}>
                {before.status} → {after.status}
              </span>
            </div>
          );
        }
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 0 4px 14px",
          }}>
            <StatusDot status={item.status} />
            <span style={{ color: "#E8E3D8", fontSize: 11, flex: 1 }}>{item.title}</span>
            <span style={{ color: "#4A4F64", fontSize: 10 }}>{item.status}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "COMPLETADO" ? "#22c55e" :
    status === "EN PROGRESO" ? "#3b82f6" :
    status === "EN REVISIÓN" ? "#a855f7" :
    status === "BLOQUEADO"   ? "#ef4444" :
    "#4A4F64";
  return <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}
