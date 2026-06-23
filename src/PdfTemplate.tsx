import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ── Types ──────────────────────────────────────────────────────────────────
type SnapTask = {
  id: string;
  title: string;
  resp: string;
  status: string;
  notes: string;
};

type SnapCell = {
  leader: string;
  members: string[];
  tasks: SnapTask[];
};

type SnapFocus = {
  id: string;
  title: string;
  resp: string;
  cell: string;
  status: string;
  notes: string;
};

type SnapPriority = {
  id: string;
  title: string;
  resp: string;
  cell: string;
  status: string;
  notes: string;
  zoho?: string;
};

type SnapPmoItem = {
  id: string;
  title: string;
  status: string;
  resp: string;
  area: string;
  prioridad: string;
  notes: string;
  issues: any[];
};

type ChecklistItem = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  projectId?: string;
};

type SnapAcuerdo = {
  id: string;
  title: string;
  resp: string;
  committedWeek: string;
  dueWeek?: string;
  status: string;          // PENDIENTE | CUMPLIDO | INCUMPLIDO | PARCIAL
  celulaName?: string;
  projectId?: string;
  notes?: string;
};

type SnapProject = {
  id: string;
  name: string;
  taskRefs?: { taskId: string; cellName: string }[];
};

// Una tarea dentro de la comparativa: lleva su estado anterior para mostrar "antes → después".
type CompTask = {
  id?: string;
  title: string;
  resp?: string;
  status: string;
  cell?: string;
  fromStatus?: string;
};

type Comparison = {
  prev?: { week: string; isoWeek: string; savedAt: string };
  summary: { completadas: number; avances: number; nuevas: number; regresiones: number };
  completadas: CompTask[];
  avances: CompTask[];
  nuevas: CompTask[];
  regresiones: CompTask[];
};

export type CheckpointSnap = {
  savedAt: string;
  week: string;
  isoWeek: string;
  data: {
    week: string;
    focus: SnapFocus[];
    priorities: SnapPriority[];
    cells: Record<string, SnapCell>;
    nay_plan?: any[];
  };
  pmo: SnapPmoItem[];
  checklist: ChecklistItem[];
  acuerdos?: SnapAcuerdo[];
  projects?: SnapProject[];
  comparison?: Comparison | null;
};

// ── Status helpers ─────────────────────────────────────────────────────────
const DONE        = ['COMPLETADO', 'LISTO_PROD', 'ARCHIVADO'];
// Buckets alineados con el panel de Inicio (nada estático)
const WEEK        = ['ESTA_SEMANA'];
const PRIORITY    = ['URGENTE', 'BLOQUEANTE', 'BLOQUEADO', 'PRIORITARIO', 'IMPORTANTE', 'ALTA_PRIORIDAD'];
const ACTIVE      = ['ACTIVO', 'EN_CURSO', 'SEGUIMIENTO', 'ESTA_SEMANA', 'COORDINADO', 'ALTA_PRIORIDAD'];

// Etiquetas legibles para directivos (en vez del código crudo del estado)
const STATUS_LABEL: Record<string, string> = {
  URGENTE: 'Urgente', BLOQUEADO: 'Bloqueado', BLOQUEANTE: 'Bloqueante', IMPORTANTE: 'Importante',
  PRIORITARIO: 'Prioritario', PENDIENTE: 'Pendiente', REVISAR: 'Revisar', ALTA_PRIORIDAD: 'Alta prioridad',
  ESTA_SEMANA: 'Esta semana', PENDIENTE_ANTERIOR: 'Pend. anterior', POSIBLE: 'Posible', ESTIMACION: 'Estimación',
  ACTIVO: 'Activo', EN_CURSO: 'En curso', SEGUIMIENTO: 'Seguimiento', COORDINADO: 'Coordinado',
  PAUSADO: 'Pausado', COMPLETADO: 'Completado', POR_PLANEAR: 'Por planear', BANDERA_AMARILLA: 'Bandera amarilla',
  LISTO_PROD: 'Listo para prod', NO_INICIADA: 'No iniciada', ARCHIVADO: 'Archivado',
};
const label = (s: string) => STATUS_LABEL[s] ?? s;

// Severidad → color del tag y del acento lateral
function sev(status: string): 'red' | 'gold' | 'gray' {
  if (['URGENTE', 'BLOQUEADO', 'BLOQUEANTE'].includes(status)) return 'red';
  if (['PRIORITARIO', 'IMPORTANTE', 'ALTA_PRIORIDAD', 'ESTA_SEMANA'].includes(status)) return 'gold';
  return 'gray';
}
const SEV_ACCENT = { red: '#b91c1c', gold: '#C9A84C', gray: '#A9A097' };

// ── Acuerdos: etiqueta, orden por relevancia y color del acento/tag ─────────
const ACUERDO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente', CUMPLIDO: 'Cumplido', INCUMPLIDO: 'Incumplido', PARCIAL: 'Parcial',
};
// Primero lo que requiere atención (incumplido/pendiente/parcial), al final lo cumplido.
const ACUERDO_ORDER = ['INCUMPLIDO', 'PENDIENTE', 'PARCIAL', 'CUMPLIDO'];
function acuerdoSev(status: string): 'red' | 'gold' | 'green' | 'gray' {
  if (status === 'INCUMPLIDO') return 'red';
  if (status === 'PENDIENTE' || status === 'PARCIAL') return 'gold';
  if (status === 'CUMPLIDO') return 'green';
  return 'gray';
}
const ACUERDO_ACCENT = { red: '#b91c1c', gold: '#C9A84C', green: '#15803d', gray: '#A9A097' };

// "2026-W18" → "W18/2026" (más legible en el reporte)
const semanaLabel = (iso?: string) =>
  iso ? iso.replace(/(\d{4})-W(\d{2})/, (_m, y, w) => `W${w}/${y}`) : '';

// ── StyleSheet — paleta PDF invertida ─────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FAFAF7',
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingBottom: 48,
  },
  // Header
  header: {
    backgroundColor: '#3D2412',
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerTitle: {
    color: '#C9A84C',
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  headerWeek: {
    color: '#F0E6C8',
    fontSize: 11,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  headerIso: {
    color: '#A07840',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  headerDate: {
    color: '#6B5540',
    fontSize: 9,
  },
  // Franja dorada
  goldStripe: {
    backgroundColor: '#C9A84C',
    height: 4,
  },
  // Secciones
  section: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    color: '#3D2412',
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 1,
    borderBottomColor: '#C9A84C',
    paddingBottom: 4,
    marginBottom: 8,
  },
  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  bullet: {
    color: '#C9A84C',
    fontSize: 10,
    width: 12,
    flexShrink: 0,
    marginTop: 1,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: '#1A1208',
    fontSize: 10,
  },
  itemMeta: {
    color: '#6B5540',
    fontSize: 8,
    marginTop: 1,
  },
  itemNote: {
    color: '#5C4A35',
    fontSize: 8,
    marginTop: 3,
    lineHeight: 1.35,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: '#E0D6C6',
  },
  // Tags
  tagUrgent: {
    backgroundColor: '#7f1d1d',
    color: '#fca5a5',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  tagGold: {
    backgroundColor: '#78350f',
    color: '#fde68a',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  tagGray: {
    backgroundColor: '#e2e8f0',
    color: '#475569',
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  tagDone: {
    backgroundColor: '#14532d',
    color: '#bbf7d0',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  // Célula sub-header
  cellSubHeader: {
    color: '#6B5540',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Tabla Carga por Célula
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#3D2412',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: '#F0E6C8',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    flex: 2,
  },
  tableHeaderNum: {
    color: '#F0E6C8',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    width: 52,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E4DC',
  },
  tableRowAlt: {
    backgroundColor: '#F5F0E8',
  },
  tableCell: {
    color: '#1A1208',
    fontSize: 9,
    flex: 2,
  },
  tableCellNum: {
    color: '#1A1208',
    fontSize: 9,
    width: 52,
    textAlign: 'center',
  },
  tableCellNumRed: {
    color: '#dc2626',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    width: 52,
    textAlign: 'center',
  },
  // Resumen ejecutivo (KPIs)
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 14,
    gap: 8,
  },
  kpi: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    borderRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
  },
  kpiValue: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: '#3D2412',
  },
  kpiLabel: {
    fontSize: 7,
    color: '#6B5540',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Intro de sección
  sectionIntro: {
    color: '#8A7256',
    fontSize: 8,
    marginTop: -4,
    marginBottom: 8,
  },
  // Fila de prioridad / objetivo (tarjeta con acento)
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: '#F5F0E8',
    borderRadius: 3,
    borderLeftWidth: 3,
  },
  cellChip: {
    fontSize: 7,
    color: '#5C4A35',
    backgroundColor: '#E7DFD2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  emptyNote: {
    fontSize: 9,
    color: '#9C8B72',
    marginBottom: 6,
  },
  // Mini-KPIs (resumen de acuerdos y comparativa) — más compactos que los KPIs del header
  miniKpiRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 9,
  },
  miniKpi: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
  },
  miniKpiValue: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#3D2412',
  },
  miniKpiLabel: {
    fontSize: 6.5,
    color: '#6B5540',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Línea compacta para listados de comparativa (antes → después)
  compArrow: {
    color: '#3D2412',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
  },
  footerSeparator: {
    backgroundColor: '#C9A84C',
    height: 1,
    marginBottom: 5,
  },
  footerText: {
    color: '#6B5540',
    fontSize: 8,
    textAlign: 'center',
  },
});

// ── Componente principal ───────────────────────────────────────────────────
export default function PdfTemplate({ snap }: { snap: CheckpointSnap }) {
  const cells = snap.data?.cells || {};
  const focus = snap.data?.focus || [];

  // ── Fuente única: tareas reales de las células (mismas que el panel de Inicio).
  // NO se usa la lista 'priorities' porque se desincroniza y muestra como
  // pendientes/semana tareas que en realidad ya están completadas en su célula.
  const allTasks = Object.entries(cells).flatMap(([cellName, cell]) =>
    (cell.tasks || []).map(t => ({ ...t, cell: cellName }))
  );

  // ── Enfoques / objetivos de la semana (activos, no completados) ──
  const activeFocus = focus.filter(f => !DONE.includes(f.status));

  // ── Urgentes · Importantes · Alta prioridad (activas, ordenadas por severidad) ──
  const prioritized = allTasks
    .filter(t => PRIORITY.includes(t.status) && !DONE.includes(t.status))
    .sort((a, b) => PRIORITY.indexOf(a.status) - PRIORITY.indexOf(b.status));

  // ── Tareas de esta semana (activas, excluye completadas) ──
  const weekTasks = allTasks.filter(t => WEEK.includes(t.status) && !DONE.includes(t.status));

  // ── Acuerdos tomados (ordenados: incumplido/pendiente/parcial primero) ──
  const acuerdos = (snap.acuerdos || [])
    .slice()
    .sort((a, b) => ACUERDO_ORDER.indexOf(a.status) - ACUERDO_ORDER.indexOf(b.status));

  // Conteo de acuerdos por estado (para los KPIs de la sección)
  const acuerdoCounts: Record<string, number> = { INCUMPLIDO: 0, PENDIENTE: 0, PARCIAL: 0, CUMPLIDO: 0 };
  acuerdos.forEach(a => { if (acuerdoCounts[a.status] !== undefined) acuerdoCounts[a.status]++; });

  // ── Proyectos: mapas para resolver el proyecto de cada tarea / acuerdo ──
  const projects = snap.projects || [];
  const projectByTask: Record<string, string> = {};
  projects.forEach(p => (p.taskRefs || []).forEach(r => { if (r.taskId) projectByTask[r.taskId] = p.name; }));
  const projectById: Record<string, string> = {};
  projects.forEach(p => { projectById[p.id] = p.name; });

  // ── Comparativa contra el checkpoint anterior ──
  const comp = snap.comparison || null;
  const compHasData = !!comp && (comp.completadas.length + comp.avances.length + comp.nuevas.length + comp.regresiones.length) > 0;

  // ── KPIs ──
  const kpiEnfoques = activeFocus.length;
  const kpiPrio     = prioritized.length;
  const kpiSemana   = weekTasks.length;

  const generatedDate = new Date(snap.savedAt).toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
  const generatedTime = new Date(snap.savedAt).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });

  // ── Tarjeta reutilizable (título + tag + responsable/célula + notas) ──
  const taskCard = (t: { id?: string; title: string; resp: string; status: string; cell?: string; notes?: string }, key: number) => {
    const s = sev(t.status);
    const note = (t.notes || '').trim();
    const proj = t.id ? projectByTask[t.id] : undefined;
    const meta = [t.resp || 'Sin responsable', t.cell, proj].filter(Boolean).join('  ·  ');
    return (
      <View key={key} style={[styles.cardRow, { borderLeftColor: SEV_ACCENT[s] }]} wrap={false}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={styles.itemTitle}>{t.title.substring(0, 95)}</Text>
            <Text style={s === 'red' ? styles.tagUrgent : s === 'gold' ? styles.tagGold : styles.tagGray}>
              {label(t.status)}
            </Text>
          </View>
          <Text style={styles.itemMeta}>{meta}</Text>
          {note.length > 0 && <Text style={styles.itemNote}>{note.substring(0, 220)}</Text>}
        </View>
      </View>
    );
  };

  // ── Línea compacta para los listados de la comparativa ──
  // showArrow = true muestra "Estado anterior → Estado actual"; si no, solo el estado actual.
  const compLine = (t: CompTask, key: number, showArrow: boolean) => {
    const proj = t.id ? projectByTask[t.id] : undefined;
    const metaTail = [t.cell, proj].filter(Boolean).join('  ·  ');
    return (
      <View key={key} style={styles.itemRow} wrap={false}>
        <Text style={styles.bullet}>•</Text>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{t.title.substring(0, 90)}</Text>
          <Text style={styles.itemMeta}>
            {showArrow && t.fromStatus
              ? `${label(t.fromStatus)} → ${label(t.status)}`
              : label(t.status)}
            {metaTail ? `  ·  ${metaTail}` : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Document title={`Reporte SIGOB PMO — ${snap.isoWeek}`} author="SIGOB PMO">
      <Page size="A4" style={styles.page}>

        {/* ── 1. Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>SIGOB · Fábrica de Software</Text>
            <Text style={styles.headerWeek}>Reporte semanal · {snap.week}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerIso}>{snap.isoWeek}</Text>
            <Text style={styles.headerDate}>{generatedDate} · {generatedTime}</Text>
          </View>
        </View>
        <View style={styles.goldStripe} />

        {/* ── 2. Resumen ejecutivo ───────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.kpi, { borderLeftColor: '#C9A84C' }]}>
            <Text style={styles.kpiValue}>{kpiEnfoques}</Text>
            <Text style={styles.kpiLabel}>Enfoques</Text>
          </View>
          <View style={[styles.kpi, { borderLeftColor: '#b91c1c' }]}>
            <Text style={styles.kpiValue}>{kpiPrio}</Text>
            <Text style={styles.kpiLabel}>Urgentes / Prioridad</Text>
          </View>
          <View style={[styles.kpi, { borderLeftColor: '#a16207' }]}>
            <Text style={styles.kpiValue}>{kpiSemana}</Text>
            <Text style={styles.kpiLabel}>Esta semana</Text>
          </View>
        </View>

        {/* ── 3. Enfoques de la semana (objetivos) ───────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enfoques de la semana</Text>
          <Text style={styles.sectionIntro}>Objetivos y focos de la fábrica de software para la semana.</Text>
          {activeFocus.length === 0
            ? <Text style={styles.emptyNote}>Sin enfoques activos registrados.</Text>
            : activeFocus.map((f, i) => taskCard(f, i))}
        </View>

        {/* ── 4. Urgentes · Importantes · Alta prioridad ─────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Urgentes · Importantes · Alta prioridad</Text>
          <Text style={styles.sectionIntro}>Tareas que no deben perder visibilidad esta semana.</Text>
          {prioritized.length === 0
            ? <Text style={styles.emptyNote}>Sin tareas urgentes ni prioritarias.</Text>
            : prioritized.map((t, i) => taskCard(t, i))}
        </View>

        {/* ── 5. Tareas comprometidas esta semana ────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comprometidas esta semana</Text>
          <Text style={styles.sectionIntro}>Tareas marcadas para abordarse en la semana en curso.</Text>
          {weekTasks.length === 0
            ? <Text style={styles.emptyNote}>Sin tareas comprometidas para esta semana.</Text>
            : weekTasks.map((t, i) => taskCard(t, i))}
        </View>

        {/* ── 6. Acuerdos tomados ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acuerdos tomados</Text>
          <Text style={styles.sectionIntro}>Compromisos del equipo y su estado de cumplimiento.</Text>
          {acuerdos.length === 0
            ? <Text style={styles.emptyNote}>Sin acuerdos registrados.</Text>
            : (() => {
                const renderAcuerdo = (a: SnapAcuerdo, i: number) => {
                  const s = acuerdoSev(a.status);
                  const tagStyle = s === 'red' ? styles.tagUrgent
                    : s === 'green' ? styles.tagDone
                    : s === 'gold' ? styles.tagGold : styles.tagGray;
                  const proj = a.projectId ? projectById[a.projectId] : undefined;
                  const meta = [
                    a.resp || 'Sin responsable',
                    a.celulaName,
                    proj,
                    a.committedWeek ? `comprometido ${semanaLabel(a.committedWeek)}${a.dueWeek ? ` → ${semanaLabel(a.dueWeek)}` : ''}` : '',
                  ].filter(Boolean).join('  ·  ');
                  const note = (a.notes || '').trim();
                  return (
                    <View key={a.id || i} style={[styles.cardRow, { borderLeftColor: ACUERDO_ACCENT[s] }]} wrap={false}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <Text style={styles.itemTitle}>{a.title.substring(0, 95)}</Text>
                          <Text style={tagStyle}>{ACUERDO_LABEL[a.status] ?? a.status}</Text>
                        </View>
                        <Text style={styles.itemMeta}>{meta}</Text>
                        {note.length > 0 && <Text style={styles.itemNote}>{note.substring(0, 220)}</Text>}
                      </View>
                    </View>
                  );
                };
                return (
                  <>
                    {/* Resumen por estado */}
                    <View style={styles.miniKpiRow}>
                      {ACUERDO_ORDER.map(st => (
                        <View key={st} style={[styles.miniKpi, { borderLeftColor: ACUERDO_ACCENT[acuerdoSev(st)] }]}>
                          <Text style={styles.miniKpiValue}>{acuerdoCounts[st]}</Text>
                          <Text style={styles.miniKpiLabel}>{ACUERDO_LABEL[st]}</Text>
                        </View>
                      ))}
                    </View>
                    {/* Agrupados por estado (atención primero) */}
                    {ACUERDO_ORDER.map(st => {
                      const grupo = acuerdos.filter(a => a.status === st);
                      if (grupo.length === 0) return null;
                      return (
                        <View key={st}>
                          <Text style={styles.cellSubHeader}>{ACUERDO_LABEL[st]} · {grupo.length}</Text>
                          {grupo.map((a, i) => renderAcuerdo(a, i))}
                        </View>
                      );
                    })}
                  </>
                );
              })()}
        </View>

        {/* ── 6b. Avance respecto al checkpoint anterior ─────────────── */}
        {comp && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Avance respecto al checkpoint anterior</Text>
            <Text style={styles.sectionIntro}>
              {comp.prev
                ? `Cambios desde ${comp.prev.week} (${semanaLabel(comp.prev.isoWeek)}).`
                : 'Cambios desde el checkpoint anterior.'}
            </Text>
            {!compHasData && (
              <Text style={styles.emptyNote}>Sin cambios respecto al checkpoint anterior.</Text>
            )}
            {/* KPIs del avance */}
            <View style={styles.miniKpiRow}>
              <View style={[styles.miniKpi, { borderLeftColor: '#15803d' }]}>
                <Text style={styles.miniKpiValue}>{comp!.summary.completadas}</Text>
                <Text style={styles.miniKpiLabel}>Completadas</Text>
              </View>
              <View style={[styles.miniKpi, { borderLeftColor: '#1d4ed8' }]}>
                <Text style={styles.miniKpiValue}>{comp!.summary.avances}</Text>
                <Text style={styles.miniKpiLabel}>Avanzaron</Text>
              </View>
              <View style={[styles.miniKpi, { borderLeftColor: '#C9A84C' }]}>
                <Text style={styles.miniKpiValue}>{comp!.summary.nuevas}</Text>
                <Text style={styles.miniKpiLabel}>Nuevas</Text>
              </View>
              <View style={[styles.miniKpi, { borderLeftColor: '#b91c1c' }]}>
                <Text style={styles.miniKpiValue}>{comp!.summary.regresiones}</Text>
                <Text style={styles.miniKpiLabel}>En regresión</Text>
              </View>
            </View>
            {/* Detalle por tarea */}
            {comp!.completadas.length > 0 && (
              <View>
                <Text style={styles.cellSubHeader}>Completadas · {comp!.completadas.length}</Text>
                {comp!.completadas.map((t, i) => compLine(t, i, true))}
              </View>
            )}
            {comp!.avances.length > 0 && (
              <View>
                <Text style={styles.cellSubHeader}>Avanzaron · {comp!.avances.length}</Text>
                {comp!.avances.map((t, i) => compLine(t, i, true))}
              </View>
            )}
            {comp!.nuevas.length > 0 && (
              <View>
                <Text style={styles.cellSubHeader}>Nuevas · {comp!.nuevas.length}</Text>
                {comp!.nuevas.map((t, i) => compLine(t, i, false))}
              </View>
            )}
            {comp!.regresiones.length > 0 && (
              <View>
                <Text style={styles.cellSubHeader}>En regresión · {comp!.regresiones.length}</Text>
                {comp!.regresiones.map((t, i) => compLine(t, i, true))}
              </View>
            )}
          </View>
        )}

        {/* ── 7. Carga por Célula ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Carga por Célula</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Célula</Text>
            <Text style={styles.tableHeaderNum}>Urgentes</Text>
            <Text style={styles.tableHeaderNum}>En curso</Text>
            <Text style={styles.tableHeaderNum}>Listas</Text>
          </View>
          {Object.entries(cells).map(([cellName, cell], i) => {
            const tasks       = cell.tasks || [];
            const criticas    = tasks.filter(t => ['URGENTE', 'BLOQUEADO', 'BLOQUEANTE'].includes(t.status)).length;
            const activas     = tasks.filter(t => ACTIVE.includes(t.status)).length;
            const completadas = tasks.filter(t => DONE.includes(t.status)).length;
            return (
              <View key={cellName} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={styles.tableCell}>{cellName}</Text>
                <Text style={criticas > 0 ? styles.tableCellNumRed : styles.tableCellNum}>{criticas}</Text>
                <Text style={styles.tableCellNum}>{activas}</Text>
                <Text style={styles.tableCellNum}>{completadas}</Text>
              </View>
            );
          })}
        </View>

        {/* ── 8. Footer ──────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <View style={styles.footerSeparator} />
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `SIGOB · Fábrica de Software  ·  ${snap.week}  ·  ${generatedDate}, ${generatedTime}  ·  Pág. ${pageNumber}/${totalPages}`
            }
          />
        </View>

      </Page>
    </Document>
  );
}
