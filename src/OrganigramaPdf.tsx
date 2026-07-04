import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ── Tipos (espejo de PersonalTab) ───────────────────────────────────────────
export type OrgEventoTipo = 'ERROR' | 'ACIERTO' | 'COMPROMISO' | 'APOYO_EXTRA';

export interface OrgPersona {
  id: string;
  name: string;
  puesto: string;
  celulaName: string;
  email: string;
  esLider: boolean;
  activo: boolean;
}

export interface OrgEvento {
  id: string;
  tipo: OrgEventoTipo;
  status: string; // COMPROMISO: PENDIENTE | CUMPLIDO | INCUMPLIDO | PARCIAL
}

export interface OrgNode {
  persona: OrgPersona;
  eventos: OrgEvento[];
}

type Sev = 'green' | 'amber' | 'red';

// ── Semáforo ─────────────────────────────────────────────────────────────────
interface Tally {
  errores: number; incumplidos: number; pendientes: number;
  cumplidos: number; aciertos: number; apoyo: number;
}

function tally(evs: OrgEvento[]): Tally {
  const t: Tally = { errores: 0, incumplidos: 0, pendientes: 0, cumplidos: 0, aciertos: 0, apoyo: 0 };
  for (const e of evs) {
    if (e.tipo === 'ERROR') t.errores++;
    else if (e.tipo === 'ACIERTO') t.aciertos++;
    else if (e.tipo === 'APOYO_EXTRA') t.apoyo++;
    else if (e.tipo === 'COMPROMISO') {
      if (e.status === 'INCUMPLIDO') t.incumplidos++;
      else if (e.status === 'CUMPLIDO') t.cumplidos++;
      else t.pendientes++; // PENDIENTE / PARCIAL / vacío
    }
  }
  return t;
}

// Verde por defecto; escala a amarillo/rojo cuando hay incidencias.
function severity(t: Tally): Sev {
  if (t.errores >= 2 || t.incumplidos >= 1) return 'red';
  if (t.errores === 1 || t.pendientes >= 1) return 'amber';
  return 'green';
}

const SEV_CFG: Record<Sev, { accent: string; bg: string; text: string; label: string }> = {
  green: { accent: '#15803d', bg: '#EAF4EE', text: '#14532d', label: 'En orden' },
  amber: { accent: '#D08700', bg: '#FBF1DA', text: '#7A5300', label: 'En observación' },
  red:   { accent: '#B91C1C', bg: '#FBE7E7', text: '#7F1D1D', label: 'Requiere atención' },
};

function plural(n: number, s: string, p: string): string {
  return `${n} ${n === 1 ? s : p}`;
}

// Texto corto que resume el porqué del color.
function resumen(t: Tally, sev: Sev): string {
  if (sev === 'green') {
    const good: string[] = [];
    if (t.aciertos) good.push(plural(t.aciertos, 'acierto', 'aciertos'));
    if (t.apoyo) good.push(plural(t.apoyo, 'apoyo extra', 'apoyos extra'));
    if (t.cumplidos) good.push(plural(t.cumplidos, 'compromiso cumplido', 'compromisos cumplidos'));
    return good.length ? good.join(' · ') : 'Sin incidencias';
  }
  const bad: string[] = [];
  if (t.incumplidos) bad.push(plural(t.incumplidos, 'incumplido', 'incumplidos'));
  if (t.errores) bad.push(plural(t.errores, 'error', 'errores'));
  if (t.pendientes) bad.push(plural(t.pendientes, 'pendiente', 'pendientes'));
  return bad.join(' · ') || 'En seguimiento';
}

// ── Estilos (paleta café / dorado, igual que PdfTemplate) ────────────────────
const styles = StyleSheet.create({
  page: { backgroundColor: '#FAFAF7', fontFamily: 'Helvetica', fontSize: 10, paddingBottom: 42 },
  header: {
    backgroundColor: '#3D2412', paddingVertical: 18, paddingHorizontal: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerTitle: { color: '#C9A84C', fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  headerSub: { color: '#F0E6C8', fontSize: 10 },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  headerDate: { color: '#A07840', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  goldStripe: { backgroundColor: '#C9A84C', height: 4 },

  // Leyenda / resumen
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 2,
  },
  legendChip: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5, marginRight: 5 },
  legendText: { fontSize: 8.5, color: '#4A3826' },

  // Célula
  celula: { paddingHorizontal: 24, paddingTop: 12 },
  celulaBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EFE7D6', borderLeftWidth: 3, borderLeftColor: '#C9A84C',
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 3, marginBottom: 8,
  },
  celulaName: { color: '#3D2412', fontSize: 12, fontFamily: 'Helvetica-Bold' },
  celulaCount: { color: '#8A6D3B', fontSize: 8.5 },

  // Tarjeta de líder (ancho completo)
  leaderCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E4DAC8', borderTopWidth: 3, borderRadius: 6,
    paddingVertical: 9, paddingHorizontal: 12, marginBottom: 8,
  },
  leaderBadge: {
    backgroundColor: '#3D2412', color: '#C9A84C', fontSize: 7, fontFamily: 'Helvetica-Bold',
    paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, marginLeft: 8,
  },

  // Cuadrícula de miembros
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  card: {
    width: '31%', marginHorizontal: '1%', marginBottom: 9,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4DAC8',
    borderTopWidth: 3, borderRadius: 6, padding: 8,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5, flexShrink: 0 },
  name: { color: '#1A1208', fontSize: 9.5, fontFamily: 'Helvetica-Bold', flex: 1 },
  puesto: { color: '#6B5540', fontSize: 8, marginBottom: 4 },
  statusPill: {
    alignSelf: 'flex-start', fontSize: 7, fontFamily: 'Helvetica-Bold',
    paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 3, marginBottom: 4,
  },
  resumen: { fontSize: 7.5, color: '#5C4A35', lineHeight: 1.3 },

  // Mini estadísticas
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  stat: { flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 2 },
  statDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 3 },
  statText: { fontSize: 7, color: '#4A3826' },

  empty: { color: '#8A8072', fontSize: 10, textAlign: 'center', paddingVertical: 40 },
  footer: {
    position: 'absolute', bottom: 16, left: 24, right: 24,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.5, borderTopColor: '#D8CEBC', paddingTop: 6,
  },
  footerText: { fontSize: 7.5, color: '#8A7A64' },
});

const STAT_COLORS = { aciertos: '#15803d', errores: '#B91C1C', comp: '#A07840', apoyo: '#2563EB' };

function MiniStats({ t }: { t: Tally }) {
  const items: { key: string; color: string; text: string }[] = [];
  if (t.aciertos) items.push({ key: 'a', color: STAT_COLORS.aciertos, text: `${t.aciertos} acierto${t.aciertos > 1 ? 's' : ''}` });
  if (t.apoyo) items.push({ key: 'x', color: STAT_COLORS.apoyo, text: `${t.apoyo} apoyo${t.apoyo > 1 ? 's' : ''}` });
  const comp = t.pendientes + t.cumplidos + t.incumplidos;
  if (comp) items.push({ key: 'c', color: STAT_COLORS.comp, text: `${comp} compromiso${comp > 1 ? 's' : ''}` });
  if (t.errores) items.push({ key: 'e', color: STAT_COLORS.errores, text: `${t.errores} error${t.errores > 1 ? 'es' : ''}` });
  if (items.length === 0) return null;
  return (
    <View style={styles.stats}>
      {items.map(it => (
        <View key={it.key} style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: it.color }]} />
          <Text style={styles.statText}>{it.text}</Text>
        </View>
      ))}
    </View>
  );
}

function PersonCard({ node, leader }: { node: OrgNode; leader?: boolean }) {
  const t = tally(node.eventos);
  const sev = severity(t);
  const cfg = SEV_CFG[sev];

  if (leader) {
    return (
      <View style={[styles.leaderCard, { borderTopColor: cfg.accent }]} wrap={false}>
        <View style={[styles.dot, { backgroundColor: cfg.accent, width: 10, height: 10, borderRadius: 5 }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.name, { fontSize: 11, flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }]}>{node.persona.name}</Text>
            <Text style={styles.leaderBadge}>LÍDER</Text>
          </View>
          {!!node.persona.puesto && <Text style={[styles.puesto, { marginBottom: 0, marginTop: 2 }]}>{node.persona.puesto}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.statusPill, { backgroundColor: cfg.bg, color: cfg.text, marginBottom: 3 }]}>{cfg.label.toUpperCase()}</Text>
          <Text style={[styles.resumen, { textAlign: 'right' }]}>{resumen(t, sev)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderTopColor: cfg.accent }]} wrap={false}>
      <View style={styles.nameRow}>
        <View style={[styles.dot, { backgroundColor: cfg.accent }]} />
        <Text style={styles.name}>{node.persona.name}</Text>
      </View>
      {!!node.persona.puesto && <Text style={styles.puesto}>{node.persona.puesto}</Text>}
      <Text style={[styles.statusPill, { backgroundColor: cfg.bg, color: cfg.text }]}>{cfg.label.toUpperCase()}</Text>
      <Text style={styles.resumen}>{resumen(t, sev)}</Text>
      <MiniStats t={t} />
    </View>
  );
}

// ── Documento ────────────────────────────────────────────────────────────────
export default function OrganigramaPdf({
  nodes,
  generatedAt = new Date(),
}: {
  nodes: OrgNode[];
  generatedAt?: Date;
}) {
  // Solo personas activas
  const active = nodes.filter(n => n.persona.activo !== false);

  // Agrupar por célula
  const groups = new Map<string, OrgNode[]>();
  for (const n of active) {
    const key = n.persona.celulaName?.trim() || 'Sin célula asignada';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }
  // Orden alfabético; "Sin célula" al final
  const celulas = [...groups.keys()].sort((a, b) => {
    if (a === 'Sin célula asignada') return 1;
    if (b === 'Sin célula asignada') return -1;
    return a.localeCompare(b, 'es');
  });

  // Conteo global del semáforo
  let g = 0, y = 0, r = 0;
  for (const n of active) {
    const sev = severity(tally(n.eventos));
    if (sev === 'green') g++; else if (sev === 'amber') y++; else r++;
  }

  const fecha = generatedAt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const hora = generatedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Encabezado */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.headerTitle}>Organigrama de Operaciones</Text>
            <Text style={styles.headerSub}>Estructura del equipo y estado por persona</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>{fecha}</Text>
            <Text style={[styles.headerSub, { fontSize: 9 }]}>{hora} · {active.length} personas</Text>
          </View>
        </View>
        <View style={styles.goldStripe} fixed />

        {/* Leyenda del semáforo */}
        <View style={styles.legend}>
          <View style={styles.legendChip}>
            <View style={[styles.legendDot, { backgroundColor: SEV_CFG.green.accent }]} />
            <Text style={styles.legendText}>En orden / a favor — {g}</Text>
          </View>
          <View style={styles.legendChip}>
            <View style={[styles.legendDot, { backgroundColor: SEV_CFG.amber.accent }]} />
            <Text style={styles.legendText}>En observación — {y}</Text>
          </View>
          <View style={styles.legendChip}>
            <View style={[styles.legendDot, { backgroundColor: SEV_CFG.red.accent }]} />
            <Text style={styles.legendText}>Requiere atención — {r}</Text>
          </View>
        </View>

        {active.length === 0 && <Text style={styles.empty}>No hay personas registradas.</Text>}

        {/* Células */}
        {celulas.map(cel => {
          const list = groups.get(cel)!;
          const leaders = list.filter(n => n.persona.esLider).sort((a, b) => a.persona.name.localeCompare(b.persona.name, 'es'));
          const miembros = list.filter(n => !n.persona.esLider).sort((a, b) => a.persona.name.localeCompare(b.persona.name, 'es'));
          return (
            <View key={cel} style={styles.celula} wrap>
              <View style={styles.celulaBar} wrap={false}>
                <Text style={styles.celulaName}>{cel}</Text>
                <Text style={styles.celulaCount}>{list.length} persona{list.length > 1 ? 's' : ''}</Text>
              </View>
              {leaders.map(n => <PersonCard key={n.persona.id} node={n} leader />)}
              <View style={styles.grid}>
                {miembros.map(n => <PersonCard key={n.persona.id} node={n} />)}
              </View>
            </View>
          );
        })}

        {/* Pie */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>SIGOB · Gestión de Proyectos</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
