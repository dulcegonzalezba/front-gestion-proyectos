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
  // Semáforo operativo. Opcionales porque los checkpoints antiguos no lo traen.
  salud?: string;
  criticidad?: string;
  fase?: string;
  pausaAuto?: boolean;
  saludUpdatedAt?: string | null;
};

/** Entrada de bitácora de proyecto (incidencia, hito, nota, cambio de estatus). */
type SnapIncidencia = {
  id: number;
  proyectoId: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  severidad: string;
  fecha: string | null;
  resuelto: boolean;
  createdAt: string;
};

type SnapLiberacion = {
  id: string;
  projectId: string;
  title: string;
  version: string;
  releaseDate: string;
  status: string;   // EXITOSA | CON_ERRORES | EN_PROGRESO | REVERTIDA
  notes: string;
};

type SnapObservacion = {
  id: string;
  persona: string;
  celulaName: string;
  puesto: string;
  tipo: string;     // ERROR | COMPROMISO
  status: string;
  title: string;
  notes: string;
  fecha: string | null;
  projectId?: string;
};

type SnapEquipo = {
  totalPersonas: number;
  activos: number;
  positivos: number;
  observaciones: SnapObservacion[];
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
  // Estado vivo de la fábrica. Se adjunta al generar; un checkpoint viejo no lo trae.
  incidencias?: SnapIncidencia[];
  liberaciones?: SnapLiberacion[];
  equipo?: SnapEquipo | null;
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

// ── Semáforo de proyectos ───────────────────────────────────────────────────
// Mismo orden y semántica que el tablero: de lo sano a lo que arde.
const SALUD_ORDEN = ['SIN_ERRORES', 'EN_OBSERVACION', 'CON_PENDIENTES', 'URGENTE'] as const;
const SALUD_CFG: Record<string, { label: string; color: string }> = {
  SIN_ERRORES:    { label: 'Sin errores',       color: '#15803d' },
  EN_OBSERVACION: { label: 'En observación',    color: '#1d4ed8' },
  CON_PENDIENTES: { label: 'Con pendientes',    color: '#a16207' },
  URGENTE:        { label: 'Alerta / Bloqueado', color: '#b91c1c' },
  // El valor retirado se sigue mapeando por si el checkpoint es anterior a la fusión.
  CON_ERRORES:    { label: 'Alerta / Bloqueado', color: '#b91c1c' },
};
const saludDe = (p: SnapProject) => {
  const s = p.salud ?? 'SIN_ERRORES';
  return s === 'CON_ERRORES' ? 'URGENTE' : (SALUD_CFG[s] ? s : 'SIN_ERRORES');
};
const FASE_LABEL: Record<string, string> = {
  PRODUCCION: 'Producción', DESARROLLO: 'Desarrollo', REFACTOR: 'Refactor', PAUSA: 'En pausa',
};
const CRIT_LABEL: Record<string, string> = {
  CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja',
};

// ── Liberaciones ────────────────────────────────────────────────────────────
const LIB_CFG: Record<string, { label: string; color: string }> = {
  EXITOSA:     { label: 'Exitosa',     color: '#15803d' },
  EN_PROGRESO: { label: 'En progreso', color: '#1d4ed8' },
  CON_ERRORES: { label: 'Con errores', color: '#a16207' },
  REVERTIDA:   { label: 'Revertida',   color: '#b91c1c' },
};

// ── Severidad de incidencias ────────────────────────────────────────────────
const SEVERIDAD_CFG: Record<string, { label: string; color: string }> = {
  CRITICA: { label: 'Crítica', color: '#b91c1c' },
  ALTA:    { label: 'Alta',    color: '#c2410c' },
  MEDIA:   { label: 'Media',   color: '#a16207' },
  BAJA:    { label: 'Baja',    color: '#A9A097' },
};

// ── Observaciones de personas ───────────────────────────────────────────────
const OBS_CFG: Record<string, { label: string; color: string }> = {
  ERROR:      { label: 'Error',      color: '#b91c1c' },
  COMPROMISO: { label: 'Compromiso', color: '#a16207' },
};

/** "2026-06-01" → "01 jun". Fechas cortas para no romper las filas. */
const fechaCorta = (iso?: string | null) => {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ''}`;
};

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
  // ── Avance vs checkpoint: barra apilada proporcional + leyenda ──
  progressBarTrack: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#E7DFD2',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressSeg: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSegText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 7.5,
    color: '#5C4A35',
  },
  // ── Avance vs checkpoint: detalle compacto en 2 columnas ──
  compGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  compItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 10,
    marginBottom: 3,
  },
  compDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 3,
    marginRight: 5,
    flexShrink: 0,
  },
  compItemTitle: {
    flex: 1,
    fontSize: 8.5,
    color: '#1A1208',
  },
  compItemCell: {
    fontSize: 7,
    color: '#8A7256',
  },
  compMore: {
    fontSize: 7.5,
    color: '#9C8B72',
    marginTop: 1,
    marginBottom: 2,
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

  // ── Semáforo de proyectos ───────────────────────────────────────────────
  saludGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  saludBox: {
    flex: 1,
    borderTopWidth: 3,
    borderTopStyle: 'solid',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#E8E2D6',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  saludValue: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
  },
  saludLabel: {
    fontSize: 7.5,
    color: '#6B5540',
    marginTop: 2,
  },
  // Fila de proyecto: nombre + fase/criticidad + estado
  projRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#EFEBE1',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  projName: {
    flex: 1,
    fontSize: 9,
    color: '#2B2118',
    paddingRight: 6,
  },
  projMeta: {
    fontSize: 7.5,
    color: '#8A7A66',
    width: 128,
  },
  projTag: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    width: 92,
    textAlign: 'right',
  },
  // Nota de sección vacía, más visible que emptyNote: la ausencia de datos
  // en un reporte ejecutivo es información, no algo que deba pasar inadvertido.
  gapNote: {
    backgroundColor: '#FBF6E9',
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: '#C9A84C',
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 8.5,
    color: '#6B5540',
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

  // ── Semáforo de proyectos ──
  // Los proyectos en pausa se cuentan aparte: no son un estado de salud, y
  // mezclarlos en "Sin errores" es justo lo que hacía ilegible el tablero.
  const proyectosVivos = projects.filter(p => p.fase !== 'PAUSA');
  const proyectosPausa = projects.filter(p => p.fase === 'PAUSA');
  const saludCount: Record<string, number> = { SIN_ERRORES: 0, EN_OBSERVACION: 0, CON_PENDIENTES: 0, URGENTE: 0 };
  proyectosVivos.forEach(p => { saludCount[saludDe(p)]++; });

  // Orden de atención: primero lo que arde, y dentro de cada estado lo más crítico.
  const CRIT_ORDEN = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'];
  const requierenAtencion = proyectosVivos
    .filter(p => saludDe(p) !== 'SIN_ERRORES')
    .sort((a, b) => {
      const sa = SALUD_ORDEN.indexOf(saludDe(b) as any) - SALUD_ORDEN.indexOf(saludDe(a) as any);
      if (sa !== 0) return sa;
      return CRIT_ORDEN.indexOf(a.criticidad ?? 'MEDIA') - CRIT_ORDEN.indexOf(b.criticidad ?? 'MEDIA');
    });

  // ── Incidencias: abiertas primero, y solo las que son incidencia de verdad ──
  const incidencias = (snap.incidencias || []).filter(e => e.tipo === 'INCIDENCIA');
  const incidenciasAbiertas = incidencias.filter(e => !e.resuelto);
  const SEV_ORDEN = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'];
  const incidenciasOrden = [...incidencias].sort((a, b) => {
    if (a.resuelto !== b.resuelto) return a.resuelto ? 1 : -1;
    return SEV_ORDEN.indexOf(a.severidad) - SEV_ORDEN.indexOf(b.severidad);
  });

  // ── Liberaciones: más recientes primero ──
  const liberaciones = [...(snap.liberaciones || [])]
    .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
  const libCount: Record<string, number> = { EXITOSA: 0, EN_PROGRESO: 0, CON_ERRORES: 0, REVERTIDA: 0 };
  liberaciones.forEach(l => { if (libCount[l.status] !== undefined) libCount[l.status]++; });

  // ── Equipo ──
  const equipo = snap.equipo || null;
  const observaciones = equipo?.observaciones ?? [];

  // ── KPIs ──
  const kpiEnfoques = activeFocus.length;
  const kpiPrio     = prioritized.length;
  const kpiSemana   = weekTasks.length;
  const kpiAlerta   = saludCount.URGENTE;
  const kpiIncid    = incidenciasAbiertas.length;
  const kpiAcuerdosMal = acuerdoCounts.INCUMPLIDO + acuerdoCounts.PENDIENTE + acuerdoCounts.PARCIAL;

  // Avance global de la fábrica: tareas completadas sobre el total del plan.
  const totalTareas = allTasks.length;
  const completadas = allTasks.filter(t => DONE.includes(t.status)).length;
  const pctAvance = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0;

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

  // ── Ítem compacto para la comparativa (2 columnas, punto de color) ──
  // La categoría (Completadas / Avanzaron / Nuevas / Regresión) ya comunica el cambio,
  // así que el ítem solo muestra el título + célula: menos texto, más visual.
  const compChip = (t: CompTask, color: string, key: number) => (
    <View key={key} style={styles.compItem} wrap={false}>
      <View style={[styles.compDot, { backgroundColor: color }]} />
      <Text style={styles.compItemTitle}>
        {t.title.substring(0, 58)}
        {t.cell ? <Text style={styles.compItemCell}>{`  ${t.cell}`}</Text> : ''}
      </Text>
    </View>
  );

  // Grupos de la comparativa (mismo color en KPI, barra, leyenda y detalle)
  const COMP_CAP = 12; // máx. ítems listados por grupo; el resto se resume como "+N más"
  const compGroups = comp ? [
    { label: 'Completadas',  color: '#15803d', count: comp.summary.completadas, items: comp.completadas },
    { label: 'Avanzaron',    color: '#1d4ed8', count: comp.summary.avances,     items: comp.avances },
    { label: 'Nuevas',       color: '#C9A84C', count: comp.summary.nuevas,      items: comp.nuevas },
    { label: 'En regresión', color: '#b91c1c', count: comp.summary.regresiones, items: comp.regresiones },
  ] : [];
  const compTotal = compGroups.reduce((s, g) => s + g.count, 0);

  return (
    <Document title={`Reporte SIGOB PMO — ${snap.isoWeek}`} author="SIGOB PMO">
      <Page size="A4" style={styles.page}>

        {/* ── 1. Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>SIGOB · Fábrica de Software</Text>
            <Text style={styles.headerWeek}>Reporte ejecutivo · {snap.week}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerIso}>{snap.isoWeek}</Text>
            <Text style={styles.headerDate}>{generatedDate} · {generatedTime}</Text>
          </View>
        </View>
        <View style={styles.goldStripe} />

        {/* ── 2. Panorama ejecutivo ──────────────────────────────────── */}
        {/* Seis cifras que responden "¿cómo estamos?" sin pasar de la primera página. */}
        <View style={styles.summaryRow}>
          <View style={[styles.kpi, { borderLeftColor: '#15803d' }]}>
            <Text style={styles.kpiValue}>{pctAvance}%</Text>
            <Text style={styles.kpiLabel}>Avance del plan</Text>
          </View>
          <View style={[styles.kpi, { borderLeftColor: '#a16207' }]}>
            <Text style={styles.kpiValue}>{kpiSemana}</Text>
            <Text style={styles.kpiLabel}>Esta semana</Text>
          </View>
          <View style={[styles.kpi, { borderLeftColor: '#b91c1c' }]}>
            <Text style={styles.kpiValue}>{kpiPrio}</Text>
            <Text style={styles.kpiLabel}>Urgentes / Atrasadas</Text>
          </View>
        </View>
        <View style={[styles.summaryRow, { marginTop: -4 }]}>
          <View style={[styles.kpi, { borderLeftColor: '#b91c1c' }]}>
            <Text style={styles.kpiValue}>{kpiAlerta}</Text>
            <Text style={styles.kpiLabel}>Proyectos en alerta</Text>
          </View>
          <View style={[styles.kpi, { borderLeftColor: '#c2410c' }]}>
            <Text style={styles.kpiValue}>{kpiIncid}</Text>
            <Text style={styles.kpiLabel}>Incidencias abiertas</Text>
          </View>
          <View style={[styles.kpi, { borderLeftColor: '#C9A84C' }]}>
            <Text style={styles.kpiValue}>{kpiAcuerdosMal}</Text>
            <Text style={styles.kpiLabel}>Acuerdos sin cerrar</Text>
          </View>
        </View>

        {/* ── 2b. Estado de salud de los proyectos ───────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de salud de los proyectos</Text>
          <Text style={styles.sectionIntro}>
            Semáforo operativo de los {proyectosVivos.length} proyecto{proyectosVivos.length !== 1 ? 's' : ''} activo
            {proyectosVivos.length !== 1 ? 's' : ''}
            {proyectosPausa.length > 0 ? ` · ${proyectosPausa.length} en pausa, fuera del conteo` : ''}.
          </Text>

          {projects.length === 0 ? (
            <Text style={styles.gapNote}>
              Sin proyectos registrados. El semáforo operativo no tiene datos que reportar.
            </Text>
          ) : (
            <>
              <View style={styles.saludGrid} wrap={false}>
                {SALUD_ORDEN.map(s => (
                  <View key={s} style={[styles.saludBox, { borderTopColor: SALUD_CFG[s].color }]}>
                    <Text style={[styles.saludValue, { color: saludCount[s] > 0 ? SALUD_CFG[s].color : '#C4BCAE' }]}>
                      {saludCount[s]}
                    </Text>
                    <Text style={styles.saludLabel}>{SALUD_CFG[s].label}</Text>
                  </View>
                ))}
              </View>

              {requierenAtencion.length === 0 ? (
                <Text style={styles.emptyNote}>
                  Ningún proyecto activo requiere atención: todos en verde.
                </Text>
              ) : (
                <>
                  <Text style={[styles.sectionIntro, { marginTop: 2 }]}>
                    Requieren atención, del más grave al menos grave:
                  </Text>
                  {requierenAtencion.map((p, i) => {
                    const s = saludDe(p);
                    const meta = [FASE_LABEL[p.fase ?? ''] ?? p.fase, CRIT_LABEL[p.criticidad ?? ''] ?? p.criticidad]
                      .filter(Boolean).join('  ·  ');
                    return (
                      <View key={i} style={[styles.projRow, { borderLeftColor: SALUD_CFG[s].color }]} wrap={false}>
                        <Text style={styles.projName}>{p.name.substring(0, 62)}</Text>
                        <Text style={styles.projMeta}>{meta}</Text>
                        <Text style={[styles.projTag, { color: SALUD_CFG[s].color }]}>{SALUD_CFG[s].label}</Text>
                      </View>
                    );
                  })}
                </>
              )}
            </>
          )}
        </View>

        {/* ── 3. Enfoques de la semana (objetivos) ───────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enfoques de la semana</Text>
          <Text style={styles.sectionIntro}>Objetivos y focos de la fábrica de software para la semana.</Text>
          {activeFocus.length === 0
            ? <Text style={styles.emptyNote}>Sin enfoques activos registrados.</Text>
            : activeFocus.map((f, i) => taskCard(f, i))}
        </View>

        {/* ── 4. Comprometidas esta semana (se toman sí o sí) ────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comprometidas esta semana</Text>
          <Text style={styles.sectionIntro}>Se toman sí o sí esta semana: compromiso en firme del equipo.</Text>
          {weekTasks.length === 0
            ? <Text style={styles.emptyNote}>Sin tareas comprometidas para esta semana.</Text>
            : weekTasks.map((t, i) => taskCard(t, i))}
        </View>

        {/* ── 5. Urgentes · Importantes (atrasadas → próximas) ───────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Urgentes · Importantes · Atrasadas</Text>
          <Text style={styles.sectionIntro}>Tareas ya atrasadas. Próximas candidatas a entrar en la semana.</Text>
          {prioritized.length === 0
            ? <Text style={styles.emptyNote}>Sin tareas urgentes ni atrasadas.</Text>
            : prioritized.map((t, i) => taskCard(t, i))}
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
                    <View style={styles.miniKpiRow} wrap={false}>
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
            {!compHasData
              ? <Text style={styles.emptyNote}>Sin cambios respecto al checkpoint anterior.</Text>
              : (
                <>
                  {/* KPIs del avance */}
                  <View style={styles.miniKpiRow} wrap={false}>
                    {compGroups.map(g => (
                      <View key={g.label} style={[styles.miniKpi, { borderLeftColor: g.color }]}>
                        <Text style={styles.miniKpiValue}>{g.count}</Text>
                        <Text style={styles.miniKpiLabel}>{g.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Barra apilada proporcional: composición del avance de un vistazo */}
                  <View style={styles.progressBarTrack}>
                    {compGroups.filter(g => g.count > 0).map(g => {
                      const pct = (g.count / compTotal) * 100;
                      return (
                        <View key={g.label} style={[styles.progressSeg, { width: `${pct}%`, backgroundColor: g.color }]}>
                          {pct >= 8 && <Text style={styles.progressSegText}>{g.count}</Text>}
                        </View>
                      );
                    })}
                  </View>
                  {/* Leyenda */}
                  <View style={styles.legendRow}>
                    {compGroups.map(g => (
                      <View key={g.label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: g.color }]} />
                        <Text style={styles.legendText}>{g.label} · {g.count}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Detalle compacto por grupo (2 columnas, sin ruido de estados) */}
                  {compGroups.map(g => g.items.length > 0 && (
                    <View key={g.label}>
                      <Text style={styles.cellSubHeader}>{g.label} · {g.count}</Text>
                      <View style={styles.compGrid}>
                        {g.items.slice(0, COMP_CAP).map((t, i) => compChip(t, g.color, i))}
                      </View>
                      {g.items.length > COMP_CAP && (
                        <Text style={styles.compMore}>+{g.items.length - COMP_CAP} más</Text>
                      )}
                    </View>
                  ))}
                </>
              )}
          </View>
        )}

        {/* ── 7. Carga por Célula ────────────────────────────────────── */}
        {/* Sin wrap: son pocas filas y partir la tabla deja la cabecera huérfana
            en la página anterior, que es justo donde se leen los números. */}
        <View style={styles.section} wrap={false}>
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

        {/* ── 8. Incidencias registradas ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incidencias registradas</Text>
          <Text style={styles.sectionIntro}>
            Bitácora operativa de los proyectos. Las abiertas van primero.
          </Text>
          {incidencias.length === 0 ? (
            <Text style={styles.gapNote}>
              Sin incidencias registradas en la bitácora de proyectos. Si hubo incidentes esta
              semana, no quedaron capturados en el sistema.
            </Text>
          ) : (
            <>
              <View style={styles.miniKpiRow} wrap={false}>
                <View style={styles.miniKpi}>
                  <Text style={[styles.miniKpiValue, { color: '#b91c1c' }]}>{incidenciasAbiertas.length}</Text>
                  <Text style={styles.miniKpiLabel}>Abiertas</Text>
                </View>
                <View style={styles.miniKpi}>
                  <Text style={[styles.miniKpiValue, { color: '#15803d' }]}>{incidencias.length - incidenciasAbiertas.length}</Text>
                  <Text style={styles.miniKpiLabel}>Resueltas</Text>
                </View>
              </View>
              {incidenciasOrden.slice(0, 18).map((e, i) => {
                const sv = SEVERIDAD_CFG[e.severidad] ?? SEVERIDAD_CFG.BAJA;
                const proj = projectById[e.proyectoId];
                const meta = [proj, fechaCorta(e.fecha ?? e.createdAt), e.resuelto ? 'Resuelta' : 'Abierta']
                  .filter(Boolean).join('  ·  ');
                return (
                  <View key={i} style={[styles.projRow, { borderLeftColor: e.resuelto ? '#A9A097' : sv.color }]} wrap={false}>
                    <Text style={styles.projName}>{e.titulo.substring(0, 62)}</Text>
                    <Text style={styles.projMeta}>{meta}</Text>
                    <Text style={[styles.projTag, { color: e.resuelto ? '#A9A097' : sv.color }]}>{sv.label}</Text>
                  </View>
                );
              })}
              {incidenciasOrden.length > 18 && (
                <Text style={styles.compMore}>+{incidenciasOrden.length - 18} incidencia(s) más</Text>
              )}
            </>
          )}
        </View>

        {/* ── 9. Liberaciones ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liberaciones registradas</Text>
          <Text style={styles.sectionIntro}>Entregas a producción y su resultado.</Text>
          {liberaciones.length === 0 ? (
            <Text style={styles.gapNote}>
              Sin liberaciones registradas. Si hubo entregas a producción, no están capturadas
              en el módulo de liberaciones.
            </Text>
          ) : (
            <>
              <View style={styles.miniKpiRow} wrap={false}>
                {(['EXITOSA', 'EN_PROGRESO', 'CON_ERRORES', 'REVERTIDA'] as const).map(k => (
                  <View key={k} style={styles.miniKpi}>
                    <Text style={[styles.miniKpiValue, { color: libCount[k] > 0 ? LIB_CFG[k].color : '#C4BCAE' }]}>
                      {libCount[k]}
                    </Text>
                    <Text style={styles.miniKpiLabel}>{LIB_CFG[k].label}</Text>
                  </View>
                ))}
              </View>
              {liberaciones.slice(0, 15).map((l, i) => {
                const cfg = LIB_CFG[l.status] ?? LIB_CFG.EN_PROGRESO;
                const proj = projectById[l.projectId];
                const meta = [proj, l.version, fechaCorta(l.releaseDate)].filter(Boolean).join('  ·  ');
                return (
                  <View key={i} style={[styles.projRow, { borderLeftColor: cfg.color }]} wrap={false}>
                    <Text style={styles.projName}>{(l.title || 'Liberación').substring(0, 62)}</Text>
                    <Text style={styles.projMeta}>{meta}</Text>
                    <Text style={[styles.projTag, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                );
              })}
              {liberaciones.length > 15 && (
                <Text style={styles.compMore}>+{liberaciones.length - 15} liberación(es) más</Text>
              )}
            </>
          )}
        </View>

        {/* ── 10. Estado del equipo ──────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado del equipo</Text>
          <Text style={styles.sectionIntro}>
            Observaciones abiertas: errores registrados y compromisos sin cerrar.
          </Text>
          {!equipo || equipo.totalPersonas === 0 ? (
            <Text style={styles.gapNote}>
              Sin personal dado de alta en el módulo de personas. No hay observaciones que
              reportar sobre el equipo.
            </Text>
          ) : (
            <>
              <View style={styles.miniKpiRow} wrap={false}>
                <View style={styles.miniKpi}>
                  <Text style={styles.miniKpiValue}>{equipo.activos}</Text>
                  <Text style={styles.miniKpiLabel}>Activos</Text>
                </View>
                <View style={styles.miniKpi}>
                  <Text style={[styles.miniKpiValue, { color: observaciones.length > 0 ? '#b91c1c' : '#15803d' }]}>
                    {observaciones.length}
                  </Text>
                  <Text style={styles.miniKpiLabel}>Observaciones</Text>
                </View>
                <View style={styles.miniKpi}>
                  <Text style={[styles.miniKpiValue, { color: '#15803d' }]}>{equipo.positivos}</Text>
                  <Text style={styles.miniKpiLabel}>Aciertos / apoyos</Text>
                </View>
              </View>
              {observaciones.length === 0 ? (
                <Text style={styles.emptyNote}>
                  Sin observaciones abiertas: ningún error ni compromiso pendiente registrado.
                </Text>
              ) : (
                observaciones.slice(0, 15).map((o, i) => {
                  const cfg = OBS_CFG[o.tipo] ?? OBS_CFG.COMPROMISO;
                  const meta = [o.celulaName, o.puesto, fechaCorta(o.fecha)].filter(Boolean).join('  ·  ');
                  return (
                    <View key={i} style={[styles.projRow, { borderLeftColor: cfg.color }]} wrap={false}>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={styles.projName}>
                          {o.persona}
                          <Text style={{ color: '#8A7A66' }}>{`  —  ${o.title.substring(0, 52)}`}</Text>
                        </Text>
                      </View>
                      <Text style={styles.projMeta}>{meta}</Text>
                      <Text style={[styles.projTag, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  );
                })
              )}
              {observaciones.length > 15 && (
                <Text style={styles.compMore}>+{observaciones.length - 15} observación(es) más</Text>
              )}
            </>
          )}
        </View>

        {/* ── 11. Footer ─────────────────────────────────────────────── */}
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
