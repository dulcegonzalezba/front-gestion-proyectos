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
};

// ── Status helpers ─────────────────────────────────────────────────────────
const DONE     = ['COMPLETADO', 'LISTO_PROD', 'ARCHIVADO'];
const CRITICAL = ['URGENTE', 'BLOQUEADO', 'BLOQUEANTE', 'ALTA_PRIORIDAD', 'PENDIENTE', 'PRIORITARIO'];
const ACTIVE   = ['ACTIVO', 'EN_CURSO', 'SEGUIMIENTO', 'ESTA_SEMANA', 'COORDINADO', 'ALTA_PRIORIDAD'];

function tagStyle(status: string): 'urgent' | 'gold' | 'gray' {
  if (['URGENTE', 'BLOQUEADO', 'BLOQUEANTE'].includes(status)) return 'urgent';
  if (['ESTA_SEMANA', 'ALTA_PRIORIDAD', 'PRIORITARIO', 'PENDIENTE'].includes(status)) return 'gold';
  return 'gray';
}

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

  const activeFocus      = (snap.data?.focus      || []).filter(f => !DONE.includes(f.status)).slice(0, 8);
  const activePriorities = (snap.data?.priorities || []).filter(p => !DONE.includes(p.status));
  const activePmo        = (snap.pmo              || []).filter(p => !DONE.includes(p.status)).slice(0, 6);

  const generatedDate = new Date(snap.savedAt).toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
  const generatedTime = new Date(snap.savedAt).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <Document title={`Reporte SIGOB PMO — ${snap.isoWeek}`} author="SIGOB PMO">
      <Page size="A4" style={styles.page}>

        {/* ── 1. Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>SIGOB PMO</Text>
            <Text style={styles.headerWeek}>{snap.week}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerIso}>{snap.isoWeek}</Text>
            <Text style={styles.headerDate}>{generatedDate} · {generatedTime}</Text>
          </View>
        </View>

        {/* ── 2. Franja dorada ───────────────────────────────────────── */}
        <View style={styles.goldStripe} />

        {/* ── 3. Enfoque Semanal ─────────────────────────────────────── */}
        {activeFocus.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Enfoque Semanal</Text>
            {activeFocus.map((f, i) => {
              const ts = tagStyle(f.status);
              return (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.bullet}>•</Text>
                  <View style={styles.itemContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Text style={styles.itemTitle}>{f.title.substring(0, 80)}</Text>
                      <Text style={ts === 'urgent' ? styles.tagUrgent : ts === 'gold' ? styles.tagGold : styles.tagGray}>
                        {f.status}
                      </Text>
                    </View>
                    <Text style={styles.itemMeta}>{f.resp}{f.cell ? ` · ${f.cell}` : ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── 4. Prioridades Activas ─────────────────────────────────── */}
        {activePriorities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prioridades Activas</Text>
            {activePriorities.map((p, i) => {
              const ts = tagStyle(p.status);
              return (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.bullet}>•</Text>
                  <View style={styles.itemContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Text style={styles.itemTitle}>{p.title.substring(0, 80)}</Text>
                      <Text style={ts === 'urgent' ? styles.tagUrgent : ts === 'gold' ? styles.tagGold : styles.tagGray}>
                        {p.status}
                      </Text>
                    </View>
                    <Text style={styles.itemMeta}>{p.resp}{p.cell ? ` · ${p.cell}` : ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── 5. Tareas Críticas por Célula ─────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tareas Críticas</Text>
          {Object.entries(cells).map(([cellName, cell]) => {
            const critical = (cell.tasks || []).filter(t => CRITICAL.includes(t.status)).slice(0, 5);
            if (critical.length === 0) return null;
            return (
              <View key={cellName}>
                <Text style={styles.cellSubHeader}>{cellName}</Text>
                {critical.map((t, i) => {
                  const ts = tagStyle(t.status);
                  return (
                    <View key={i} style={styles.itemRow}>
                      <Text style={styles.bullet}>▸</Text>
                      <View style={styles.itemContent}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <Text style={styles.itemTitle}>{t.title.substring(0, 75)}</Text>
                          <Text style={ts === 'urgent' ? styles.tagUrgent : ts === 'gold' ? styles.tagGold : styles.tagGray}>
                            {t.status}
                          </Text>
                        </View>
                        <Text style={styles.itemMeta}>{t.resp}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* ── 6. Plan PMO ───────────────────────────────────────────── */}
        {activePmo.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Plan PMO</Text>
            {activePmo.map((p, i) => {
              const ts = tagStyle(p.status);
              return (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.bullet}>•</Text>
                  <View style={styles.itemContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Text style={styles.itemTitle}>{p.title.substring(0, 80)}</Text>
                      <Text style={ts === 'urgent' ? styles.tagUrgent : ts === 'gold' ? styles.tagGold : styles.tagGray}>
                        {p.status}
                      </Text>
                    </View>
                    <Text style={styles.itemMeta}>{p.resp} · {p.area}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── 7. Carga por Célula ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Carga por Célula</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Célula</Text>
            <Text style={styles.tableHeaderNum}>🔴 Crit.</Text>
            <Text style={styles.tableHeaderNum}>🔵 Activas</Text>
            <Text style={styles.tableHeaderNum}>✅ Ok</Text>
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
          <Text style={styles.footerText}>
            SIGOB PMO  ·  checkpoint: {snap.isoWeek}  ·  {generatedDate}, {generatedTime}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
