import { useState, useEffect, useCallback } from "react";
import { getToken } from "./auth";

type AcuerdoStatus = "PENDIENTE" | "CUMPLIDO" | "INCUMPLIDO" | "PARCIAL";

interface Acuerdo {
  id: string;
  title: string;
  resp: string;
  committedWeek: string;
  dueWeek?: string;
  status: AcuerdoStatus;
  celulaName?: string;
  projectId?: string;
  notes: string;
  createdAt: string;
}

interface Seguimiento {
  id: number;
  acuerdoId: string;
  week: string;
  status: string;
  notes: string;
  checkedAt: string;
}

interface Project {
  id: string;
  name: string;
}

interface Props {
  currentWeek: string;
  projects: Project[];
  filterWeek?: string;
  filterStatus?: string;
}

const STATUS_CFG: Record<AcuerdoStatus, { label: string; color: string; bg: string }> = {
  PENDIENTE:  { label: "Pendiente",  color: "#F59E0B", bg: "rgba(245,158,11,0.10)" },
  CUMPLIDO:   { label: "Cumplido",   color: "#22C55E", bg: "rgba(34,197,94,0.10)"  },
  INCUMPLIDO: { label: "Incumplido", color: "#EF4444", bg: "rgba(239,68,68,0.10)"  },
  PARCIAL:    { label: "Parcial",    color: "#C9A84C", bg: "rgba(201,168,76,0.10)" },
};

const CELL_NAMES = ["DevOps","DBA","Backend SIR","Frontend SIR","Nuevas Tec","Reporteador Nayarit","Multi-celula"];

function isoWeekLabel(iso: string): string {
  if (!iso) return "";
  return iso.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `W${w}/${y}`);
}

function getCurrentISOWeek(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function authHeaders(extra: Record<string, string> = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

const BTN = {
  background: "none", border: "none", cursor: "pointer",
  fontFamily: "system-ui,sans-serif",
};

export default function AcuerdosTab({ currentWeek, projects, filterWeek, filterStatus }: Props) {
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [seguimientos, setSeguimientos] = useState<Record<string, Seguimiento[]>>({});
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({
    title: "", resp: "", committedWeek: currentWeek,
    dueWeek: "", celulaName: "", projectId: "", notes: "",
  });
  const [segForm, setSegForm] = useState<Record<string, { status: string; notes: string }>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/acuerdos", { headers: authHeaders() });
      if (res.ok) setAcuerdos(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSeguimiento = async (id: string) => {
    if (seguimientos[id]) return;
    const res = await fetch(`/api/acuerdos/${id}/seguimiento`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setSeguimientos(p => ({ ...p, [id]: data }));
    }
  };

  const toggleExpand = (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    loadSeguimiento(id);
    setSegForm(p => ({ ...p, [id]: p[id] ?? { status: "PENDIENTE", notes: "" } }));
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.committedWeek) return;
    setSaving(true);
    try {
      const res = await fetch("/api/acuerdos", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title: form.title.trim(),
          resp: form.resp.trim(),
          committedWeek: form.committedWeek,
          dueWeek: form.dueWeek || undefined,
          celulaName: form.celulaName || undefined,
          projectId: form.projectId || undefined,
          notes: form.notes.trim(),
        }),
      });
      if (res.ok) {
        setForm({ title: "", resp: "", committedWeek: currentWeek, dueWeek: "", celulaName: "", projectId: "", notes: "" });
        setCreando(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddSeguimiento = async (id: string) => {
    const sf = segForm[id];
    if (!sf?.status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/acuerdos/${id}/seguimiento`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ week: getCurrentISOWeek(), status: sf.status, notes: sf.notes }),
      });
      if (res.ok) {
        setSeguimientos(p => ({ ...p, [id]: undefined as any }));
        await loadSeguimiento(id);
        setSegForm(p => ({ ...p, [id]: { status: "PENDIENTE", notes: "" } }));
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este acuerdo?")) return;
    await fetch(`/api/acuerdos/${id}`, { method: "DELETE", headers: authHeaders() });
    setAcuerdos(p => p.filter(a => a.id !== id));
    if (expanded === id) setExpanded(null);
  };

  // Apply filters
  let visible = acuerdos;
  if (filterWeek) visible = visible.filter(a => a.committedWeek === filterWeek);
  if (filterStatus && filterStatus !== "Todos") visible = visible.filter(a => a.status === filterStatus);

  // Stats
  const stats = (["PENDIENTE","CUMPLIDO","INCUMPLIDO","PARCIAL"] as AcuerdoStatus[]).map(s => ({
    s, count: acuerdos.filter(a => a.status === s).length,
  }));

  const inputSt = {
    background: "#14161E", border: "1px solid #1E2233", borderRadius: 8,
    color: "#E8E3D8", fontSize: 13, padding: "9px 12px",
    fontFamily: "system-ui,sans-serif", outline: "none", width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ padding: "16px 0" }}>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {stats.map(({ s, count }) => {
          const cfg = STATUS_CFG[s];
          return (
            <div key={s} style={{
              background: cfg.bg, border: `1px solid ${cfg.color}33`,
              borderRadius: 8, padding: "6px 14px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{count}</span>
              <span style={{ fontSize: 10, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cfg.label}</span>
            </div>
          );
        })}

        <button
          onClick={() => setCreando(c => !c)}
          style={{
            ...BTN,
            marginLeft: "auto",
            background: creando ? "#0F1117" : "#C9A84C",
            border: creando ? "1px solid #1E2233" : "none",
            borderRadius: 8,
            color: creando ? "#7A7F9A" : "#09090C",
            fontSize: 12, fontWeight: 600,
            padding: "6px 16px",
          }}
        >
          {creando ? "Cancelar" : "+ Nuevo acuerdo"}
        </button>
      </div>

      {/* Create form */}
      {creando && (
        <div style={{
          background: "#0F1117", border: "1px solid #C9A84C44",
          borderRadius: 12, padding: "16px", marginBottom: 20,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#C9A84C", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
            Nuevo Acuerdo
          </div>

          <input
            placeholder="Descripción del acuerdo *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={inputSt}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Responsable"
              value={form.resp}
              onChange={e => setForm(f => ({ ...f, resp: e.target.value }))}
              style={{ ...inputSt, flex: 1 }}
            />
            <select
              value={form.celulaName}
              onChange={e => setForm(f => ({ ...f, celulaName: e.target.value }))}
              style={{ ...inputSt, flex: 1 }}
            >
              <option value="">Célula (opcional)</option>
              {CELL_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#7A7F9A", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Semana comprometida
              </div>
              <input
                type="week"
                value={form.committedWeek}
                onChange={e => setForm(f => ({ ...f, committedWeek: e.target.value }))}
                style={inputSt}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#7A7F9A", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Fecha límite (semana)
              </div>
              <input
                type="week"
                value={form.dueWeek}
                onChange={e => setForm(f => ({ ...f, dueWeek: e.target.value }))}
                style={inputSt}
              />
            </div>
          </div>

          {projects.length > 0 && (
            <select
              value={form.projectId}
              onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
              style={inputSt}
            >
              <option value="">Proyecto (opcional)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          <textarea
            placeholder="Notas (opcional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            style={{ ...inputSt, resize: "vertical" }}
          />

          <button
            onClick={handleCreate}
            disabled={!form.title.trim() || !form.committedWeek || saving}
            style={{
              ...BTN,
              background: form.title.trim() && form.committedWeek && !saving ? "#C9A84C" : "#1A1D28",
              color: form.title.trim() && form.committedWeek && !saving ? "#09090C" : "#3E4260",
              borderRadius: 8, padding: "10px 0",
              fontSize: 13, fontWeight: 700,
              cursor: form.title.trim() && form.committedWeek && !saving ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Guardando..." : "Guardar acuerdo"}
          </button>
        </div>
      )}

      {/* List */}
      {loading && (
        <div style={{ color: "#3E4260", fontSize: 13, textAlign: "center", paddingTop: 32 }}>
          Cargando acuerdos...
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div style={{ color: "#3E4260", fontSize: 13, textAlign: "center", paddingTop: 48 }}>
          {acuerdos.length === 0
            ? "No hay acuerdos registrados. Crea el primero con el botón de arriba."
            : "No hay acuerdos que coincidan con los filtros."}
        </div>
      )}

      {visible.map(a => {
        const cfg = STATUS_CFG[a.status] ?? STATUS_CFG.PENDIENTE;
        const isExpanded = expanded === a.id;
        const segs = seguimientos[a.id] ?? [];
        const proj = a.projectId ? projects.find(p => p.id === a.projectId) : null;
        const sf = segForm[a.id] ?? { status: "PENDIENTE", notes: "" };

        return (
          <div key={a.id} style={{
            background: "#0F1117", border: "1px solid #1E2233",
            borderRadius: 10, marginBottom: 8,
            borderLeft: `3px solid ${cfg.color}`,
            overflow: "hidden",
          }}>
            {/* Card header */}
            <div
              style={{ padding: "12px 14px", cursor: "pointer" }}
              onClick={() => toggleExpand(a.id)}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                {/* Status badge */}
                <span style={{
                  background: cfg.bg, color: cfg.color,
                  borderRadius: 6, padding: "2px 8px",
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.05em", whiteSpace: "nowrap", flexShrink: 0,
                  marginTop: 1,
                }}>
                  {cfg.label}
                </span>

                {/* Title */}
                <span style={{
                  flex: 1, fontSize: 13, fontWeight: 500, color: "#E8E3D8",
                  lineHeight: 1.4,
                }}>
                  {a.title}
                </span>

                {/* Expand indicator */}
                <span style={{ color: "#3E4260", fontSize: 11, flexShrink: 0 }}>
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>

              {/* Meta row */}
              <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                {a.resp && (
                  <span style={{ fontSize: 11, color: "#7A7F9A" }}>
                    {a.resp}
                  </span>
                )}
                <span style={{ fontSize: 11, color: "#3E4260" }}>
                  Comprometido: {isoWeekLabel(a.committedWeek)}
                  {a.dueWeek ? ` → ${isoWeekLabel(a.dueWeek)}` : ""}
                </span>
                {a.celulaName && (
                  <span style={{ fontSize: 11, color: "#7A7F9A" }}>
                    {a.celulaName}
                  </span>
                )}
                {proj && (
                  <span style={{ fontSize: 11, color: "#C9A84C" }}>
                    {proj.name}
                  </span>
                )}
              </div>

              {a.notes && (
                <div style={{ fontSize: 11, color: "#4A4F64", marginTop: 4, fontStyle: "italic" }}>
                  {a.notes}
                </div>
              )}
            </div>

            {/* Expanded: seguimiento */}
            {isExpanded && (
              <div style={{ borderTop: "1px solid #1E2233", padding: "12px 14px" }}>
                {/* History */}
                {segs.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Historial de seguimiento
                    </div>
                    {segs.map(seg => {
                      const segCfg = STATUS_CFG[seg.status as AcuerdoStatus] ?? STATUS_CFG.PENDIENTE;
                      return (
                        <div key={seg.id} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "6px 0", borderBottom: "1px solid #14161E",
                        }}>
                          <span style={{
                            background: segCfg.bg, color: segCfg.color,
                            borderRadius: 4, padding: "1px 6px",
                            fontSize: 10, fontWeight: 600, flexShrink: 0,
                          }}>
                            {segCfg.label}
                          </span>
                          <span style={{ fontSize: 11, color: "#3E4260", flexShrink: 0 }}>
                            {isoWeekLabel(seg.week)}
                          </span>
                          {seg.notes && (
                            <span style={{ fontSize: 11, color: "#7A7F9A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {seg.notes}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add seguimiento */}
                <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Registrar seguimiento esta semana
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={sf.status}
                    onChange={e => setSegForm(p => ({ ...p, [a.id]: { ...sf, status: e.target.value } }))}
                    style={{
                      background: "#14161E", border: "1px solid #1E2233",
                      borderRadius: 6, color: "#E8E3D8", fontSize: 12,
                      padding: "6px 10px", fontFamily: "system-ui,sans-serif",
                    }}
                  >
                    {(["PENDIENTE","CUMPLIDO","INCUMPLIDO","PARCIAL"] as AcuerdoStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Notas del seguimiento..."
                    value={sf.notes}
                    onChange={e => setSegForm(p => ({ ...p, [a.id]: { ...sf, notes: e.target.value } }))}
                    style={{
                      background: "#14161E", border: "1px solid #1E2233",
                      borderRadius: 6, color: "#E8E3D8", fontSize: 12,
                      padding: "6px 10px", flex: 1, minWidth: 120,
                      fontFamily: "system-ui,sans-serif", outline: "none",
                    }}
                  />
                  <button
                    onClick={() => handleAddSeguimiento(a.id)}
                    disabled={saving}
                    style={{
                      ...BTN,
                      background: "#C9A84C", color: "#09090C",
                      borderRadius: 6, padding: "6px 14px",
                      fontSize: 12, fontWeight: 600,
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    Guardar
                  </button>
                </div>

                {/* Delete */}
                <div style={{ marginTop: 12, textAlign: "right" }}>
                  <button
                    onClick={() => handleDelete(a.id)}
                    style={{ ...BTN, color: "#3E4260", fontSize: 11 }}
                  >
                    Eliminar acuerdo
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
