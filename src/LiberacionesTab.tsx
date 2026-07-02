import { useState, useEffect, useCallback } from "react";
import { getToken } from "./auth";

type LiberacionStatus = "EXITOSA" | "CON_ERRORES" | "EN_PROGRESO" | "REVERTIDA";

interface Liberacion {
  id: string;
  projectId: string;
  title: string;
  version: string;
  releaseDate: string;
  status: LiberacionStatus;
  notes: string;
  createdAt: string;
}

interface Seguimiento {
  id: number;
  liberacionId: string;
  fecha: string;
  status: string;
  notes: string;
  checkedAt: string;
}

interface Project {
  id: string;
  name: string;
}

interface Props {
  projects: Project[];
  filterProject?: string;
  filterStatus?: string;
}

const STATUS_CFG: Record<LiberacionStatus, { label: string; color: string; bg: string }> = {
  EXITOSA:     { label: "Exitosa",     color: "#22C55E", bg: "rgba(34,197,94,0.10)"  },
  CON_ERRORES: { label: "Con errores", color: "#EF4444", bg: "rgba(239,68,68,0.10)"  },
  EN_PROGRESO: { label: "En progreso", color: "#F59E0B", bg: "rgba(245,158,11,0.10)" },
  REVERTIDA:   { label: "Revertida",   color: "#A78BFA", bg: "rgba(167,139,250,0.10)"},
};

const STATUS_LIST: LiberacionStatus[] = ["EXITOSA", "CON_ERRORES", "EN_PROGRESO", "REVERTIDA"];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, dd] = iso.split("T")[0].split("-");
  if (!y || !m || !dd) return iso;
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${dd} ${meses[+m - 1] ?? m} ${y}`;
}

function authHeaders(extra: Record<string, string> = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

const BTN = { background: "none", border: "none", cursor: "pointer", fontFamily: "system-ui,sans-serif" };

export default function LiberacionesTab({ projects, filterProject, filterStatus }: Props) {
  const [items, setItems] = useState<Liberacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [seguimientos, setSeguimientos] = useState<Record<string, Seguimiento[]>>({});
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({
    projectId: "", title: "", version: "", releaseDate: today(), status: "EN_PROGRESO" as LiberacionStatus, notes: "",
  });
  const [segForm, setSegForm] = useState<Record<string, { status: string; notes: string }>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/liberaciones", { headers: authHeaders() });
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSeguimiento = async (id: string) => {
    if (seguimientos[id]) return;
    const res = await fetch(`/api/liberaciones/${id}/seguimiento`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setSeguimientos(p => ({ ...p, [id]: data }));
    }
  };

  const toggleExpand = (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    loadSeguimiento(id);
    setSegForm(p => ({ ...p, [id]: p[id] ?? { status: "EN_PROGRESO", notes: "" } }));
  };

  const handleCreate = async () => {
    if (!form.projectId || !form.releaseDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/liberaciones", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          projectId: form.projectId,
          title: form.title.trim(),
          version: form.version.trim(),
          releaseDate: form.releaseDate,
          status: form.status,
          notes: form.notes.trim(),
        }),
      });
      if (res.ok) {
        setForm({ projectId: "", title: "", version: "", releaseDate: today(), status: "EN_PROGRESO", notes: "" });
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
      const res = await fetch(`/api/liberaciones/${id}/seguimiento`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ fecha: today(), status: sf.status, notes: sf.notes }),
      });
      if (res.ok) {
        setSeguimientos(p => ({ ...p, [id]: undefined as any }));
        await loadSeguimiento(id);
        setSegForm(p => ({ ...p, [id]: { status: "EN_PROGRESO", notes: "" } }));
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta liberación y su historial?")) return;
    await fetch(`/api/liberaciones/${id}`, { method: "DELETE", headers: authHeaders() });
    setItems(p => p.filter(a => a.id !== id));
    if (expanded === id) setExpanded(null);
  };

  // Filtros
  let visible = items;
  if (filterProject && filterProject !== "Todos") visible = visible.filter(a => a.projectId === filterProject);
  if (filterStatus && filterStatus !== "Todos") visible = visible.filter(a => a.status === filterStatus);

  const stats = STATUS_LIST.map(s => ({ s, count: items.filter(a => a.status === s).length }));

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
              borderRadius: 8, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{count}</span>
              <span style={{ fontSize: 10, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cfg.label}</span>
            </div>
          );
        })}
        <button
          onClick={() => setCreando(c => !c)}
          style={{
            ...BTN, marginLeft: "auto",
            background: creando ? "#0F1117" : "#C9A84C",
            border: creando ? "1px solid #1E2233" : "none",
            borderRadius: 8, color: creando ? "#7A7F9A" : "#09090C",
            fontSize: 12, fontWeight: 600, padding: "6px 16px",
          }}
        >
          {creando ? "Cancelar" : "+ Nueva liberación"}
        </button>
      </div>

      {/* Create form */}
      {creando && (
        <div style={{
          background: "#0F1117", border: "1px solid #C9A84C44", borderRadius: 12,
          padding: "16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#C9A84C", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
            Nueva Liberación
          </div>

          <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={inputSt}>
            <option value="">Proyecto * </option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Título / nombre (opcional)" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...inputSt, flex: 2 }} />
            <input placeholder="Versión" value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))} style={{ ...inputSt, flex: 1 }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#7A7F9A", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Fecha de liberación *</div>
              <input type="date" value={form.releaseDate} onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))} style={inputSt} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#7A7F9A", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Estado inicial</div>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LiberacionStatus }))} style={inputSt}>
                {STATUS_LIST.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
              </select>
            </div>
          </div>

          <textarea placeholder="Notas sobre la liberación (opcional)" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
            style={{ ...inputSt, resize: "vertical" }} />

          <button onClick={handleCreate} disabled={!form.projectId || !form.releaseDate || saving}
            style={{
              ...BTN,
              background: form.projectId && form.releaseDate && !saving ? "#C9A84C" : "#1A1D28",
              color: form.projectId && form.releaseDate && !saving ? "#09090C" : "#3E4260",
              borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700,
              cursor: form.projectId && form.releaseDate && !saving ? "pointer" : "not-allowed",
            }}>
            {saving ? "Guardando..." : "Guardar liberación"}
          </button>
        </div>
      )}

      {/* List */}
      {loading && <div style={{ color: "#3E4260", fontSize: 13, textAlign: "center", paddingTop: 32 }}>Cargando liberaciones...</div>}

      {!loading && visible.length === 0 && (
        <div style={{ color: "#3E4260", fontSize: 13, textAlign: "center", paddingTop: 48 }}>
          {items.length === 0
            ? "No hay liberaciones registradas. Crea la primera con el botón de arriba."
            : "No hay liberaciones que coincidan con los filtros."}
        </div>
      )}

      {visible.map(a => {
        const cfg = STATUS_CFG[a.status] ?? STATUS_CFG.EN_PROGRESO;
        const isExpanded = expanded === a.id;
        const segs = seguimientos[a.id] ?? [];
        const proj = projects.find(p => p.id === a.projectId);
        const sf = segForm[a.id] ?? { status: "EN_PROGRESO", notes: "" };

        return (
          <div key={a.id} style={{
            background: "#0F1117", border: "1px solid #1E2233", borderRadius: 10,
            marginBottom: 8, borderLeft: `3px solid ${cfg.color}`, overflow: "hidden",
          }}>
            <div style={{ padding: "12px 14px", cursor: "pointer" }} onClick={() => toggleExpand(a.id)}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{
                  background: cfg.bg, color: cfg.color, borderRadius: 6, padding: "2px 8px",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap", flexShrink: 0, marginTop: 1,
                }}>{cfg.label}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#E8E3D8", lineHeight: 1.4 }}>
                  {proj?.name ?? "Proyecto desconocido"}
                  {a.title ? ` — ${a.title}` : ""}
                  {a.version ? ` (${a.version})` : ""}
                </span>
                <span style={{ color: "#3E4260", fontSize: 11, flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#C9A84C" }}>📅 {fmtDate(a.releaseDate)}</span>
                {segs.length === 0 && a.notes && (
                  <span style={{ fontSize: 11, color: "#7A7F9A" }}>{a.notes}</span>
                )}
              </div>

              {a.notes && (
                <div style={{ fontSize: 11, color: "#4A4F64", marginTop: 4, fontStyle: "italic" }}>{a.notes}</div>
              )}
            </div>

            {isExpanded && (
              <div style={{ borderTop: "1px solid #1E2233", padding: "12px 14px" }}>
                {segs.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Seguimiento de la liberación
                    </div>
                    {segs.map(seg => {
                      const segCfg = STATUS_CFG[seg.status as LiberacionStatus] ?? STATUS_CFG.EN_PROGRESO;
                      return (
                        <div key={seg.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #14161E" }}>
                          <span style={{ background: segCfg.bg, color: segCfg.color, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{segCfg.label}</span>
                          <span style={{ fontSize: 11, color: "#3E4260", flexShrink: 0 }}>{fmtDate(seg.fecha)}</span>
                          {seg.notes && <span style={{ fontSize: 11, color: "#7A7F9A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seg.notes}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Registrar seguimiento
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={sf.status} onChange={e => setSegForm(p => ({ ...p, [a.id]: { ...sf, status: e.target.value } }))}
                    style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 6, color: "#E8E3D8", fontSize: 12, padding: "6px 10px", fontFamily: "system-ui,sans-serif" }}>
                    {STATUS_LIST.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                  </select>
                  <input placeholder="Notas del seguimiento..." value={sf.notes}
                    onChange={e => setSegForm(p => ({ ...p, [a.id]: { ...sf, notes: e.target.value } }))}
                    style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 6, color: "#E8E3D8", fontSize: 12, padding: "6px 10px", flex: 1, minWidth: 120, fontFamily: "system-ui,sans-serif", outline: "none" }} />
                  <button onClick={() => handleAddSeguimiento(a.id)} disabled={saving}
                    style={{ ...BTN, background: "#C9A84C", color: "#09090C", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                    Guardar
                  </button>
                </div>

                <div style={{ marginTop: 12, textAlign: "right" }}>
                  <button onClick={() => handleDelete(a.id)} style={{ ...BTN, color: "#3E4260", fontSize: 11 }}>Eliminar liberación</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
