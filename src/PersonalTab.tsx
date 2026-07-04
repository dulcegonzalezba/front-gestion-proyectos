import { useState, useEffect, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { getToken } from "./auth";
import OrganigramaPdf, { type OrgNode } from "./OrganigramaPdf";

type EventoTipo = "ERROR" | "ACIERTO" | "COMPROMISO" | "APOYO_EXTRA";
type CompromisoStatus = "PENDIENTE" | "CUMPLIDO" | "INCUMPLIDO" | "PARCIAL";

interface Persona {
  id: string;
  name: string;
  puesto: string;
  celulaName: string;
  email: string;
  birthday?: string;
  fechaIngreso?: string;
  activo: boolean;
  esLider: boolean;
  notes: string;
  createdAt: string;
}

interface Evento {
  id: string;
  personaId: string;
  tipo: EventoTipo;
  title: string;
  fecha?: string;
  projectId?: string;
  status: string;
  notes: string;
  createdAt: string;
}

interface Project { id: string; name: string; }

interface CargaRow {
  personaId: string;
  name: string;
  celulaName: string;
  puesto: string;
  counts: Record<EventoTipo, number>;
  proyectos: Record<string, number>;
  totalProyectos: number;
  totalEventos: number;
}

interface Props {
  projects: Project[];
  filterCelula?: string;
  filterTipo?: string;
  view?: "personas" | "carga";
}

const TIPO_CFG: Record<EventoTipo, { label: string; color: string; bg: string; icon: string }> = {
  ERROR:       { label: "Error",       color: "#EF4444", bg: "rgba(239,68,68,0.10)",  icon: "⚠" },
  ACIERTO:     { label: "Acierto",     color: "#22C55E", bg: "rgba(34,197,94,0.10)",  icon: "★" },
  COMPROMISO:  { label: "Compromiso",  color: "#C9A84C", bg: "rgba(201,168,76,0.10)", icon: "◆" },
  APOYO_EXTRA: { label: "Apoyo extra", color: "#60A5FA", bg: "rgba(96,165,250,0.10)", icon: "＋" },
};
const TIPO_LIST: EventoTipo[] = ["ERROR", "ACIERTO", "COMPROMISO", "APOYO_EXTRA"];

const COMPROMISO_CFG: Record<CompromisoStatus, { label: string; color: string }> = {
  PENDIENTE:  { label: "Pendiente",  color: "#F59E0B" },
  CUMPLIDO:   { label: "Cumplido",   color: "#22C55E" },
  INCUMPLIDO: { label: "Incumplido", color: "#EF4444" },
  PARCIAL:    { label: "Parcial",    color: "#C9A84C" },
};
const COMPROMISO_LIST: CompromisoStatus[] = ["PENDIENTE", "CUMPLIDO", "INCUMPLIDO", "PARCIAL"];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, dd] = iso.split("T")[0].split("-");
  if (!y || !m || !dd) return iso;
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${dd} ${meses[+m - 1] ?? m}${y ? " " + y : ""}`;
}
function fmtBirthday(iso?: string): string {
  if (!iso) return "";
  const [, m, dd] = iso.split("T")[0].split("-");
  if (!m || !dd) return iso;
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${dd} ${meses[+m - 1] ?? m}`;
}
function daysUntilBirthday(iso?: string): number | null {
  if (!iso) return null;
  const [, m, dd] = iso.split("T")[0].split("-");
  if (!m || !dd) return null;
  const now = new Date();
  const y = now.getFullYear();
  let next = new Date(y, +m - 1, +dd);
  const t0 = new Date(y, now.getMonth(), now.getDate());
  if (next < t0) next = new Date(y + 1, +m - 1, +dd);
  return Math.round((next.getTime() - t0.getTime()) / 86400000);
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
const inputSt = {
  background: "#14161E", border: "1px solid #1E2233", borderRadius: 8,
  color: "#E8E3D8", fontSize: 13, padding: "9px 12px",
  fontFamily: "system-ui,sans-serif", outline: "none", width: "100%", boxSizing: "border-box" as const,
};

export default function PersonalTab({ projects, filterCelula, filterTipo, view = "personas" }: Props) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [eventos, setEventos] = useState<Record<string, Evento[]>>({});
  const [creando, setCreando] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfGen, setPdfGen] = useState(false);
  const [carga, setCarga] = useState<CargaRow[]>([]);

  const [form, setForm] = useState({ name: "", puesto: "", celulaName: "", email: "", birthday: "", notes: "" });
  const [evForm, setEvForm] = useState<Record<string, { tipo: EventoTipo; title: string; fecha: string; projectId: string; status: CompromisoStatus; notes: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/personas", { headers: authHeaders() });
      if (res.ok) setPersonas(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (view !== "carga") return;
    fetch("/api/personas/carga-proyectos", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setCarga)
      .catch(() => setCarga([]));
  }, [view, personas]);

  const loadEventos = async (id: string) => {
    const res = await fetch(`/api/personas/${id}/eventos`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setEventos(p => ({ ...p, [id]: data }));
    }
  };

  const toggleExpand = (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!eventos[id]) loadEventos(id);
    setEvForm(p => ({ ...p, [id]: p[id] ?? { tipo: "ACIERTO", title: "", fecha: today(), projectId: "", status: "PENDIENTE", notes: "" } }));
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/personas/seed-fsw", { method: "POST", headers: authHeaders() });
      if (res.ok) {
        const r = await res.json();
        alert(`Precarga FSW: ${r.created} nuevas, ${r.skipped} ya existían.`);
        await load();
      }
    } finally {
      setSeeding(false);
    }
  };

  const handleOrganigramaPdf = async () => {
    if (personas.length === 0) return;
    setPdfGen(true);
    try {
      // Reúne la bitácora de cada persona (usa la ya cargada; pide la faltante en paralelo).
      const nodes: OrgNode[] = await Promise.all(
        personas.map(async (p) => {
          let evs = eventos[p.id];
          if (!evs) {
            const res = await fetch(`/api/personas/${p.id}/eventos`, { headers: authHeaders() });
            evs = res.ok ? await res.json() : [];
          }
          return {
            persona: {
              id: p.id, name: p.name, puesto: p.puesto, celulaName: p.celulaName,
              email: p.email, esLider: p.esLider, activo: p.activo,
            },
            eventos: (evs ?? []).map((e) => ({ id: e.id, tipo: e.tipo, status: e.status })),
          };
        })
      );
      const blob = await pdf(<OrganigramaPdf nodes={nodes} generatedAt={new Date()} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `organigrama-equipo-${today()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("No se pudo generar el organigrama PDF. Intenta de nuevo.");
    } finally {
      setPdfGen(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/personas", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          name: form.name.trim(), puesto: form.puesto.trim(), celulaName: form.celulaName.trim(),
          email: form.email.trim(), birthday: form.birthday || undefined, notes: form.notes.trim(),
        }),
      });
      if (res.ok) {
        setForm({ name: "", puesto: "", celulaName: "", email: "", birthday: "", notes: "" });
        setCreando(false);
        await load();
      }
    } finally { setSaving(false); }
  };

  const handleDeletePersona = async (id: string) => {
    if (!confirm("¿Eliminar esta persona y toda su bitácora?")) return;
    await fetch(`/api/personas/${id}`, { method: "DELETE", headers: authHeaders() });
    setPersonas(p => p.filter(x => x.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const handleAddEvento = async (id: string) => {
    const ef = evForm[id];
    if (!ef?.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/personas/${id}/eventos`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          tipo: ef.tipo, title: ef.title.trim(), fecha: ef.fecha || today(),
          projectId: ef.projectId || undefined,
          status: ef.tipo === "COMPROMISO" ? ef.status : "",
          notes: ef.notes.trim(),
        }),
      });
      if (res.ok) {
        await loadEventos(id);
        setEvForm(p => ({ ...p, [id]: { tipo: "ACIERTO", title: "", fecha: today(), projectId: "", status: "PENDIENTE", notes: "" } }));
      }
    } finally { setSaving(false); }
  };

  const handleUpdateEventoStatus = async (personaId: string, eventoId: string, status: string) => {
    await fetch(`/api/personas/eventos/${eventoId}`, {
      method: "PUT", headers: authHeaders(), body: JSON.stringify({ status }),
    });
    await loadEventos(personaId);
  };

  const handleDeleteEvento = async (personaId: string, eventoId: string) => {
    await fetch(`/api/personas/eventos/${eventoId}`, { method: "DELETE", headers: authHeaders() });
    await loadEventos(personaId);
  };

  // ── Carga por proyecto view ─────────────────────────────────────────
  if (view === "carga") {
    const rows = [...carga].sort((a, b) => b.totalEventos - a.totalEventos);
    return (
      <div style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#C9A84C", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Carga por persona / proyecto
        </div>
        <div style={{ fontSize: 11, color: "#7A7F9A", marginBottom: 16 }}>
          Cuántos temas cubre cada persona (según su bitácora). Útil para ver quién concentra más frentes.
        </div>
        {rows.length === 0 && <div style={{ color: "#3E4260", fontSize: 13, textAlign: "center", paddingTop: 32 }}>Sin datos aún. Registra eventos ligados a proyectos.</div>}
        {rows.map(r => (
          <div key={r.personaId} style={{ background: "#0F1117", border: "1px solid #1E2233", borderRadius: 10, marginBottom: 8, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#E8E3D8" }}>{r.name}</span>
              {r.celulaName && <span style={{ fontSize: 11, color: "#7A7F9A" }}>{r.celulaName}</span>}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#C9A84C" }}>{r.totalProyectos} proyecto(s) · {r.totalEventos} registro(s)</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {TIPO_LIST.map(t => r.counts[t] > 0 && (
                <span key={t} style={{ background: TIPO_CFG[t].bg, color: TIPO_CFG[t].color, borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>
                  {TIPO_CFG[t].icon} {r.counts[t]} {TIPO_CFG[t].label}
                </span>
              ))}
            </div>
            {Object.keys(r.proyectos).length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {Object.entries(r.proyectos).map(([pid, n]) => {
                  const proj = projects.find(p => p.id === pid);
                  return <span key={pid} style={{ background: "#14161E", border: "1px solid #1E2233", color: "#7A7F9A", borderRadius: 5, padding: "2px 8px", fontSize: 10 }}>{proj?.name ?? "?"} · {n}</span>;
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Personas view ───────────────────────────────────────────────────
  let visible = personas;
  if (filterCelula && filterCelula !== "Todos") visible = visible.filter(p => p.celulaName === filterCelula);

  // Cumpleaños próximos (30 días)
  const upcoming = personas
    .map(p => ({ p, days: daysUntilBirthday(p.birthday) }))
    .filter(x => x.days !== null && (x.days as number) <= 30)
    .sort((a, b) => (a.days as number) - (b.days as number));

  return (
    <div style={{ padding: "16px 0" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#7A7F9A" }}>
          {visible.length} persona(s){filterCelula && filterCelula !== "Todos" ? ` · ${filterCelula}` : ""}
        </span>
        <button onClick={handleOrganigramaPdf} disabled={pdfGen || personas.length === 0}
          style={{ ...BTN, marginLeft: "auto", background: "#14161E", border: "1px solid #C9A84C55", borderRadius: 8, color: "#C9A84C", fontSize: 12, fontWeight: 600, padding: "6px 14px", opacity: pdfGen || personas.length === 0 ? 0.6 : 1 }}>
          {pdfGen ? "Generando..." : "📄 Organigrama PDF"}
        </button>
        <button onClick={handleSeed} disabled={seeding}
          style={{ ...BTN, background: "#14161E", border: "1px solid #1E2233", borderRadius: 8, color: "#7A7F9A", fontSize: 12, fontWeight: 600, padding: "6px 14px", opacity: seeding ? 0.6 : 1 }}>
          {seeding ? "Precargando..." : "⚡ Precargar equipo FSW"}
        </button>
        <button onClick={() => setCreando(c => !c)}
          style={{ ...BTN, background: creando ? "#0F1117" : "#C9A84C", border: creando ? "1px solid #1E2233" : "none", borderRadius: 8, color: creando ? "#7A7F9A" : "#09090C", fontSize: 12, fontWeight: 600, padding: "6px 16px" }}>
          {creando ? "Cancelar" : "+ Nueva persona"}
        </button>
      </div>

      {/* Cumpleaños */}
      {upcoming.length > 0 && (
        <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid #C9A84C33", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#C9A84C", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>🎂 Cumpleaños próximos</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {upcoming.map(({ p, days }) => (
              <span key={p.id} style={{ fontSize: 11, color: "#E8E3D8", background: "#14161E", borderRadius: 6, padding: "3px 10px" }}>
                {p.name} · {fmtBirthday(p.birthday)} {days === 0 ? "· ¡Hoy!" : `· en ${days}d`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Create persona */}
      {creando && (
        <div style={{ background: "#0F1117", border: "1px solid #C9A84C44", borderRadius: 12, padding: "16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#C9A84C", letterSpacing: "0.06em", textTransform: "uppercase" }}>Nueva persona</div>
          <input placeholder="Nombre *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputSt} />
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Puesto (Junior/Middle/Senior/Líder...)" value={form.puesto} onChange={e => setForm(f => ({ ...f, puesto: e.target.value }))} style={{ ...inputSt, flex: 1 }} />
            <input placeholder="Célula / área" value={form.celulaName} onChange={e => setForm(f => ({ ...f, celulaName: e.target.value }))} style={{ ...inputSt, flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ ...inputSt, flex: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#7A7F9A", marginBottom: 4, textTransform: "uppercase" }}>Cumpleaños</div>
              <input type="date" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} style={inputSt} />
            </div>
          </div>
          <textarea placeholder="Notas (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputSt, resize: "vertical" }} />
          <button onClick={handleCreate} disabled={!form.name.trim() || saving}
            style={{ ...BTN, background: form.name.trim() && !saving ? "#C9A84C" : "#1A1D28", color: form.name.trim() && !saving ? "#09090C" : "#3E4260", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: form.name.trim() && !saving ? "pointer" : "not-allowed" }}>
            {saving ? "Guardando..." : "Guardar persona"}
          </button>
        </div>
      )}

      {loading && <div style={{ color: "#3E4260", fontSize: 13, textAlign: "center", paddingTop: 32 }}>Cargando personal...</div>}
      {!loading && visible.length === 0 && (
        <div style={{ color: "#3E4260", fontSize: 13, textAlign: "center", paddingTop: 48 }}>
          {personas.length === 0 ? "No hay personas. Usa \"Precargar equipo FSW\" o agrega una manualmente." : "No hay personas en esta célula."}
        </div>
      )}

      {visible.map(p => {
        const isExpanded = expanded === p.id;
        let evs = eventos[p.id] ?? [];
        if (filterTipo && filterTipo !== "Todos") evs = evs.filter(e => e.tipo === filterTipo);
        const ef = evForm[p.id] ?? { tipo: "ACIERTO" as EventoTipo, title: "", fecha: today(), projectId: "", status: "PENDIENTE" as CompromisoStatus, notes: "" };

        return (
          <div key={p.id} style={{ background: "#0F1117", border: "1px solid #1E2233", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", cursor: "pointer" }} onClick={() => toggleExpand(p.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#E8E3D8" }}>
                  {p.name}
                  {p.esLider && <span style={{ marginLeft: 8, fontSize: 9, color: "#C9A84C", border: "1px solid #C9A84C55", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle" }}>LÍDER</span>}
                </span>
                <span style={{ color: "#3E4260", fontSize: 11 }}>{isExpanded ? "▲" : "▼"}</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                {p.puesto && <span style={{ fontSize: 11, color: "#7A7F9A" }}>{p.puesto}</span>}
                {p.celulaName && <span style={{ fontSize: 11, color: "#C9A84C" }}>{p.celulaName}</span>}
                {p.birthday && <span style={{ fontSize: 11, color: "#3E4260" }}>🎂 {fmtBirthday(p.birthday)}</span>}
                {p.email && <span style={{ fontSize: 11, color: "#3E4260" }}>{p.email}</span>}
              </div>
              {p.notes && <div style={{ fontSize: 11, color: "#4A4F64", marginTop: 4, fontStyle: "italic" }}>{p.notes}</div>}
            </div>

            {isExpanded && (
              <div style={{ borderTop: "1px solid #1E2233", padding: "12px 14px" }}>
                {/* Bitácora */}
                {evs.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Bitácora</div>
                    {evs.map(e => {
                      const cfg = TIPO_CFG[e.tipo];
                      const proj = e.projectId ? projects.find(pr => pr.id === e.projectId) : null;
                      return (
                        <div key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid #14161E" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{cfg.icon} {cfg.label}</span>
                            <span style={{ fontSize: 12, color: "#E8E3D8", flex: 1 }}>{e.title}</span>
                            <span style={{ fontSize: 10, color: "#3E4260", flexShrink: 0 }}>{fmtDate(e.fecha)}</span>
                            <button onClick={() => handleDeleteEvento(p.id, e.id)} style={{ ...BTN, color: "#3E4260", fontSize: 13, padding: "0 2px" }} title="Eliminar">×</button>
                          </div>
                          <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                            {proj && <span style={{ fontSize: 10, color: "#C9A84C" }}>{proj.name}</span>}
                            {e.tipo === "APOYO_EXTRA" && <span style={{ fontSize: 10, color: "#60A5FA" }}>sin remuneración</span>}
                            {e.notes && <span style={{ fontSize: 10, color: "#7A7F9A" }}>{e.notes}</span>}
                            {e.tipo === "COMPROMISO" && (
                              <select value={e.status || "PENDIENTE"} onChange={ev => handleUpdateEventoStatus(p.id, e.id, ev.target.value)}
                                style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 4, color: COMPROMISO_CFG[(e.status as CompromisoStatus)]?.color ?? "#F59E0B", fontSize: 10, padding: "2px 6px", fontFamily: "system-ui,sans-serif" }}>
                                {COMPROMISO_LIST.map(s => <option key={s} value={s}>{COMPROMISO_CFG[s].label}</option>)}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add evento */}
                <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Registrar en bitácora</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <select value={ef.tipo} onChange={e => setEvForm(pp => ({ ...pp, [p.id]: { ...ef, tipo: e.target.value as EventoTipo } }))}
                    style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 6, color: "#E8E3D8", fontSize: 12, padding: "6px 10px", fontFamily: "system-ui,sans-serif" }}>
                    {TIPO_LIST.map(t => <option key={t} value={t}>{TIPO_CFG[t].label}</option>)}
                  </select>
                  <input type="date" value={ef.fecha} onChange={e => setEvForm(pp => ({ ...pp, [p.id]: { ...ef, fecha: e.target.value } }))}
                    style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 6, color: "#E8E3D8", fontSize: 12, padding: "6px 10px", fontFamily: "system-ui,sans-serif" }} />
                  <select value={ef.projectId} onChange={e => setEvForm(pp => ({ ...pp, [p.id]: { ...ef, projectId: e.target.value } }))}
                    style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 6, color: "#E8E3D8", fontSize: 12, padding: "6px 10px", flex: 1, minWidth: 120, fontFamily: "system-ui,sans-serif" }}>
                    <option value="">Proyecto (opcional)</option>
                    {projects.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                  </select>
                  {ef.tipo === "COMPROMISO" && (
                    <select value={ef.status} onChange={e => setEvForm(pp => ({ ...pp, [p.id]: { ...ef, status: e.target.value as CompromisoStatus } }))}
                      style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 6, color: "#E8E3D8", fontSize: 12, padding: "6px 10px", fontFamily: "system-ui,sans-serif" }}>
                      {COMPROMISO_LIST.map(s => <option key={s} value={s}>{COMPROMISO_CFG[s].label}</option>)}
                    </select>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input placeholder="Descripción *" value={ef.title} onChange={e => setEvForm(pp => ({ ...pp, [p.id]: { ...ef, title: e.target.value } }))}
                    style={{ ...inputSt, flex: 2, minWidth: 160, padding: "6px 10px", fontSize: 12 }} />
                  <input placeholder="Notas" value={ef.notes} onChange={e => setEvForm(pp => ({ ...pp, [p.id]: { ...ef, notes: e.target.value } }))}
                    style={{ ...inputSt, flex: 1, minWidth: 120, padding: "6px 10px", fontSize: 12 }} />
                  <button onClick={() => handleAddEvento(p.id)} disabled={saving || !ef.title.trim()}
                    style={{ ...BTN, background: "#C9A84C", color: "#09090C", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, opacity: saving || !ef.title.trim() ? 0.6 : 1 }}>Guardar</button>
                </div>

                <div style={{ marginTop: 12, textAlign: "right" }}>
                  <button onClick={() => handleDeletePersona(p.id)} style={{ ...BTN, color: "#3E4260", fontSize: 11 }}>Eliminar persona</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
