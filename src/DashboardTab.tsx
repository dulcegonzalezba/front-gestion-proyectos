type Project = { id: string; name: string; createdAt: string; taskRefs?: { taskId: string; cellName: string }[] };

// ── Metadata estática por proyecto ────────────────────────────────────────────
type Criticality = 'CRITICA' | 'ALTA' | 'MEDIA';
type EstadoKey   = 'produccion' | 'desarrollo' | 'refactor' | 'pausa';

const META: Record<string, { criticality: Criticality; estado: EstadoKey }> = {
  "SIR — Portal, Admin, Reporteador, BI":  { criticality: 'CRITICA', estado: 'produccion' },
  "SIR Navojoa":                            { criticality: 'CRITICA', estado: 'produccion' },
  "SIR Nayarit":                            { criticality: 'CRITICA', estado: 'produccion' },
  "SIR Oaxaca":                             { criticality: 'CRITICA', estado: 'produccion' },
  "SIR Tlajomulco":                         { criticality: 'CRITICA', estado: 'produccion' },
  "SIR Jalisco":                            { criticality: 'CRITICA', estado: 'produccion' },
  "SIR REPUVE":                             { criticality: 'CRITICA', estado: 'produccion' },
  "SIR-Lite Multas — Oaxaca Estado":        { criticality: 'ALTA',    estado: 'produccion' },
  "MultApp — Oaxaca Municipio":             { criticality: 'ALTA',    estado: 'produccion' },
  "MultApp Lite — Oaxaca Estado":           { criticality: 'ALTA',    estado: 'produccion' },
  "Nóminas — Tlajomulco & Navojoa":         { criticality: 'CRITICA', estado: 'produccion' },
  "Egresos — Navojoa":                      { criticality: 'ALTA',    estado: 'produccion' },
  "FAN Nayarit":                            { criticality: 'MEDIA',   estado: 'pausa'      },
  "App Ciudadano":                          { criticality: 'CRITICA', estado: 'desarrollo' },
  "App de Alertamientos Geográficos":       { criticality: 'ALTA',    estado: 'desarrollo' },
  "Ventanilla Única (con Payload)":         { criticality: 'CRITICA', estado: 'refactor'   },
  "Nuevo SIR-Lite":                         { criticality: 'CRITICA', estado: 'desarrollo' },
};

const CRIT_COLOR: Record<Criticality, string> = {
  CRITICA: '#ef4444',
  ALTA:    '#F59E0B',
  MEDIA:   '#4ADE80',
};

const ESTADO_LABEL: Record<EstadoKey, string> = {
  produccion: 'Producción',
  desarrollo: 'Desarrollo',
  refactor:   'Refactor',
  pausa:      'En pausa',
};

const ESTADO_COLOR: Record<EstadoKey, string> = {
  produccion: '#4ADE80',
  desarrollo: '#60A5FA',
  refactor:   '#F59E0B',
  pausa:      '#7A7F9A',
};

const BLOCKED = ['URGENTE', 'BLOQUEADO', 'BLOQUEANTE'];
const DONE    = ['COMPLETADO', 'LISTO_PROD'];
const ACTIVE  = ['EN_CURSO', 'ACTIVO', 'SEGUIMIENTO', 'COORDINADO', 'ALTA_PRIORIDAD', 'ESTA_SEMANA'];

interface DashboardTabProps {
  projects: Project[];
  d: any;
  pmoItems: any[];
  onSelectProject: (id: string) => void;
}

export default function DashboardTab({ projects, d, pmoItems, onSelectProject }: DashboardTabProps) {
  const cells = d?.cells ?? {};

  // ── Tareas globales ────────────────────────────────────────────────────────
  const allTasks: any[] = Object.entries(cells).flatMap(([cell, c]: [string, any]) =>
    (c.tasks ?? []).map((t: any) => ({ ...t, cell }))
  );

  const totalBloqueadas = allTasks.filter(t => BLOCKED.includes(t.status)).length;
  const totalActivas    = allTasks.filter(t => ACTIVE.includes(t.status)).length;
  const totalDone       = allTasks.filter(t => DONE.includes(t.status)).length;
  const criticos        = projects.filter(p => META[p.name]?.criticality === 'CRITICA').length;

  // ── Enriquecer proyectos con métricas de tareas ───────────────────────────
  const enriched = projects.map(p => {
    const refs = p.taskRefs ?? [];
    const tasks = refs.map(r => {
      const cell = cells[r.cellName];
      return (cell?.tasks ?? []).find((t: any) => t.id === r.taskId);
    }).filter(Boolean);
    const bloqueadas  = tasks.filter((t: any) => BLOCKED.includes(t.status)).length;
    const activas     = tasks.filter((t: any) => ACTIVE.includes(t.status)).length;
    const completadas = tasks.filter((t: any) => DONE.includes(t.status)).length;
    const meta = META[p.name] ?? { criticality: 'MEDIA' as Criticality, estado: 'desarrollo' as EstadoKey };
    return { ...p, tasks, bloqueadas, activas, completadas, meta };
  });

  // Ordenar: críticos bloqueados primero
  const sorted = [...enriched].sort((a, b) => {
    const cOrder = { CRITICA: 0, ALTA: 1, MEDIA: 2 };
    if (b.bloqueadas !== a.bloqueadas) return b.bloqueadas - a.bloqueadas;
    return cOrder[a.meta.criticality] - cOrder[b.meta.criticality];
  });

  // ── Top riesgos ───────────────────────────────────────────────────────────
  const topRisks = allTasks
    .filter(t => BLOCKED.includes(t.status))
    .slice(0, 8);

  // ── Carga por célula ──────────────────────────────────────────────────────
  const cellNames = Object.keys(cells).filter(n => n !== 'Todos');
  const cellStats = cellNames.map(name => {
    const tasks = cells[name]?.tasks ?? [];
    return {
      name,
      total:     tasks.length,
      bloqueadas: tasks.filter((t: any) => BLOCKED.includes(t.status)).length,
      activas:    tasks.filter((t: any) => ACTIVE.includes(t.status)).length,
      done:       tasks.filter((t: any) => DONE.includes(t.status)).length,
    };
  }).sort((a, b) => b.total - a.total);

  const maxCellTotal = Math.max(...cellStats.map(c => c.total), 1);

  const card: React.CSSProperties = {
    background: '#0F1117',
    border: '1px solid #1E2233',
    borderRadius: 10,
    padding: '16px 20px',
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#E8E3D8', padding: '0 0 32px' }}>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Proyectos activos" value={projects.length}    color="#C9A84C" />
        <KpiCard label="Proyectos críticos" value={criticos}           color="#ef4444" />
        <KpiCard label="Tareas bloqueadas"  value={totalBloqueadas}    color="#F59E0B" />
        <KpiCard label="En curso"           value={totalActivas}       color="#60A5FA" />
      </div>

      {/* ── Grid principal ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }}>

        {/* Tabla de proyectos */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7A7F9A', letterSpacing: '0.08em', marginBottom: 12 }}>
            ESTADO DE PROYECTOS
          </div>

          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 36px 36px 36px', gap: 6, padding: '0 8px 6px', borderBottom: '1px solid #1E2233', fontSize: 9, color: '#7A7F9A', fontWeight: 700, letterSpacing: '0.07em' }}>
            <span>PROYECTO</span>
            <span>ESTADO</span>
            <span>CRITICIDAD</span>
            <span style={{ textAlign: 'center' }}>🔴</span>
            <span style={{ textAlign: 'center' }}>🔵</span>
            <span style={{ textAlign: 'center' }}>✅</span>
          </div>

          {sorted.map(p => (
            <button
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 90px 36px 36px 36px',
                gap: 6,
                width: '100%',
                padding: '9px 8px',
                background: p.bloqueadas > 0 ? 'rgba(239,68,68,0.04)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid #1E2233',
                cursor: 'pointer',
                alignItems: 'center',
                textAlign: 'left',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <span style={{ fontSize: 12, color: '#E8E3D8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
              <span style={{ fontSize: 10, color: ESTADO_COLOR[p.meta.estado] }}>
                {ESTADO_LABEL[p.meta.estado]}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: CRIT_COLOR[p.meta.criticality], flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: CRIT_COLOR[p.meta.criticality], fontWeight: 600 }}>
                  {p.meta.criticality}
                </span>
              </span>
              <span style={{ fontSize: 12, color: p.bloqueadas > 0 ? '#ef4444' : '#7A7F9A', fontWeight: p.bloqueadas > 0 ? 700 : 400, textAlign: 'center' }}>
                {p.bloqueadas || '—'}
              </span>
              <span style={{ fontSize: 12, color: p.activas > 0 ? '#60A5FA' : '#7A7F9A', textAlign: 'center' }}>
                {p.activas || '—'}
              </span>
              <span style={{ fontSize: 12, color: p.completadas > 0 ? '#4ADE80' : '#7A7F9A', textAlign: 'center' }}>
                {p.completadas || '—'}
              </span>
            </button>
          ))}

          {projects.length === 0 && (
            <div style={{ color: '#7A7F9A', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
              Sin proyectos. Usa ⚡ Precargar en el panel izquierdo.
            </div>
          )}
        </div>

        {/* Panel derecho: carga por célula */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...card, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7A7F9A', letterSpacing: '0.08em', marginBottom: 14 }}>
              CARGA POR CÉLULA
            </div>
            {cellStats.map(c => (
              <div key={c.name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#E8E3D8' }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: '#7A7F9A' }}>{c.total} tareas</span>
                </div>
                <div style={{ height: 6, background: '#1E2233', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', height: '100%' }}>
                    {c.bloqueadas > 0 && (
                      <div style={{ width: `${(c.bloqueadas / maxCellTotal) * 100}%`, background: '#ef4444', transition: 'width 0.4s' }} />
                    )}
                    {c.activas > 0 && (
                      <div style={{ width: `${(c.activas / maxCellTotal) * 100}%`, background: '#60A5FA', transition: 'width 0.4s' }} />
                    )}
                    {c.done > 0 && (
                      <div style={{ width: `${(c.done / maxCellTotal) * 100}%`, background: '#4ADE80', opacity: 0.6, transition: 'width 0.4s' }} />
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                  {c.bloqueadas > 0 && <span style={{ fontSize: 9, color: '#ef4444' }}>{c.bloqueadas} bloq.</span>}
                  {c.activas > 0    && <span style={{ fontSize: 9, color: '#60A5FA' }}>{c.activas} activas</span>}
                  {c.done > 0       && <span style={{ fontSize: 9, color: '#4ADE80', opacity: 0.7 }}>{c.done} ok</span>}
                </div>
              </div>
            ))}
          </div>

          {/* PMO Operativo resumen */}
          {pmoItems.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7A7F9A', letterSpacing: '0.08em', marginBottom: 10 }}>
                PMO OPERATIVO
              </div>
              {[
                { label: 'Pendientes', count: pmoItems.filter((p: any) => !DONE.includes(p.status)).length, color: '#F59E0B' },
                { label: 'Urgentes',   count: pmoItems.filter((p: any) => p.status === 'URGENTE').length,    color: '#ef4444' },
                { label: 'Completados',count: pmoItems.filter((p: any) => DONE.includes(p.status)).length,   color: '#4ADE80' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#7A7F9A' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.count > 0 ? row.color : '#7A7F9A' }}>{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top riesgos ───────────────────────────────────────────────────── */}
      {topRisks.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7A7F9A', letterSpacing: '0.08em', marginBottom: 12 }}>
            RIESGOS ACTIVOS — URGENTE / BLOQUEADO
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topRisks.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#09090C', borderRadius: 6, border: '1px solid #1E2233' }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                  background: t.status === 'URGENTE' ? 'rgba(239,68,68,0.15)' : 'rgba(127,29,29,0.3)',
                  color: t.status === 'URGENTE' ? '#ef4444' : '#fca5a5',
                  whiteSpace: 'nowrap',
                }}>
                  {t.status}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: '#E8E3D8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title}
                </span>
                <span style={{ fontSize: 10, color: '#7A7F9A', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.resp}</span>
                <span style={{ fontSize: 9, color: '#3E4260', background: '#14161E', padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {t.cell}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topRisks.length === 0 && allTasks.length > 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#4ADE80', fontSize: 13 }}>
          ✓ Sin tareas bloqueadas o urgentes esta semana
        </div>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: '#0F1117',
      border: `1px solid #1E2233`,
      borderTop: `3px solid ${color}`,
      borderRadius: 10,
      padding: '14px 18px',
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#7A7F9A', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}
