/**
 * Tokens, tipos y helpers compartidos por el tablero operativo de proyectos.
 * Mantener aquí la fuente de verdad evita que tarjeta, columna y drawer
 * se desincronicen de color o etiqueta.
 */
import { getToken } from "./auth";

/**
 * El eje del semáforo es "qué tipo de atención necesita", no "qué tan grave es"
 * — la gravedad la lleva `Criticidad` aparte. Por eso no hay un CON_ERRORES
 * separado de URGENTE: eran el mismo concepto partido en dos. El backend migra
 * los registros antiguos, y `salud()` cubre los que lleguen en caché.
 */
export type Salud =
  | "SIN_ERRORES"
  | "EN_OBSERVACION"
  | "CON_PENDIENTES"
  | "URGENTE";

export type Criticidad = "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
export type Fase = "PRODUCCION" | "DESARROLLO" | "REFACTOR" | "PAUSA";
export type EventoTipo = "CAMBIO_ESTATUS" | "INCIDENCIA" | "NOTA" | "HITO";
export type Severidad = "CRITICA" | "ALTA" | "MEDIA" | "BAJA";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  taskRefs?: { taskId: string; cellName: string }[];
  salud?: Salud;
  saludUpdatedAt?: string | null;
  criticidad?: Criticidad;
  fase?: Fase;
  /** true si la fase PAUSA la puso el barrido automático y no una persona. */
  pausaAuto?: boolean;
  /** Fase que se restaura al salir de una pausa automática. */
  fasePrevia?: Fase | null;
  notas?: string;
}

export interface Evento {
  id: number;
  proyectoId: string;
  tipo: EventoTipo;
  titulo: string;
  descripcion: string;
  severidad: Severidad;
  autor: string;
  fecha: string | null;
  saludPrevia: string | null;
  saludNueva: string | null;
  resuelto: boolean;
  resueltoAt: string | null;
  createdAt: string;
}

// ── Paleta ───────────────────────────────────────────────────────────────────

export const UI = {
  bg: "#09090C",
  surface: "#0F1117",
  surface2: "#14161E",
  border: "#1E2233",
  borderStrong: "#272B40",
  text: "#E8E3D8",
  muted: "#7A7F9A",
  dim: "#3E4260",
  gold: "#C9A84C",
} as const;

export const SALUD_CFG: Record<Salud, {
  label: string; short: string; color: string; bg: string; icon: string; ayuda: string;
}> = {
  SIN_ERRORES: {
    label: "Sin errores", short: "OK", color: "#22C55E", bg: "rgba(34,197,94,0.10)", icon: "✓",
    ayuda: "Operando con normalidad, sin nada que atender.",
  },
  EN_OBSERVACION: {
    label: "En observación", short: "Observado", color: "#60A5FA", bg: "rgba(96,165,250,0.10)", icon: "◉",
    ayuda: "Vigilado de cerca — típicamente desarrollo a punto de salir a producción.",
  },
  CON_PENDIENTES: {
    label: "Con pendientes", short: "Pendiente", color: "#F59E0B", bg: "rgba(245,158,11,0.10)", icon: "▲",
    ayuda: "Algo lo está bloqueando y no está fluyendo, pero no hay servicio caído.",
  },
  URGENTE: {
    label: "Alerta / Bloqueado", short: "Alerta", color: "#EF4444", bg: "rgba(239,68,68,0.12)", icon: "⬤",
    ayuda: "Producción afectada o bloqueo crítico. Requiere atención hoy.",
  },
};

/** Orden de columnas: lo más sano a la izquierda, lo que arde a la derecha. */
export const SALUD_ORDEN: Salud[] = [
  "SIN_ERRORES", "EN_OBSERVACION", "CON_PENDIENTES", "URGENTE",
];

/** Valores de salud retirados y su destino, por si llega uno en caché o en un payload viejo. */
const SALUD_LEGACY: Record<string, Salud> = { CON_ERRORES: "URGENTE" };

export const CRITICIDAD_CFG: Record<Criticidad, { label: string; color: string }> = {
  CRITICA: { label: "Crítica", color: "#EF4444" },
  ALTA:    { label: "Alta",    color: "#F59E0B" },
  MEDIA:   { label: "Media",   color: "#4ADE80" },
  BAJA:    { label: "Baja",    color: "#7A7F9A" },
};

export const FASE_CFG: Record<Fase, { label: string; color: string }> = {
  PRODUCCION: { label: "Producción", color: "#4ADE80" },
  DESARROLLO: { label: "Desarrollo", color: "#60A5FA" },
  REFACTOR:   { label: "Refactor",   color: "#F59E0B" },
  PAUSA:      { label: "En pausa",   color: "#7A7F9A" },
};

export const TIPO_CFG: Record<EventoTipo, { label: string; icon: string; color: string }> = {
  CAMBIO_ESTATUS: { label: "Cambio de estatus", icon: "⇄", color: "#7A7F9A" },
  INCIDENCIA:     { label: "Incidencia",        icon: "⚠", color: "#EF4444" },
  NOTA:           { label: "Nota",              icon: "✎", color: "#60A5FA" },
  HITO:           { label: "Hito",              icon: "◆", color: "#C9A84C" },
};

export const SEVERIDAD_CFG: Record<Severidad, { label: string; color: string }> = {
  CRITICA: { label: "Crítica", color: "#EF4444" },
  ALTA:    { label: "Alta",    color: "#F97316" },
  MEDIA:   { label: "Media",   color: "#F59E0B" },
  BAJA:    { label: "Baja",    color: "#7A7F9A" },
};

// Clasificación de estatus de tareas (alineada con el resto de la app).
export const TASK_BLOCKED = ["URGENTE", "BLOQUEADO", "BLOQUEANTE"];
export const TASK_DONE    = ["COMPLETADO", "LISTO_PROD"];
export const TASK_ACTIVE  = ["EN_CURSO", "ACTIVO", "SEGUIMIENTO", "COORDINADO", "ALTA_PRIORIDAD", "ESTA_SEMANA"];

/** Días sin tocar el semáforo a partir de los cuales la tarjeta avisa. */
export const DIAS_STALE = 7;

/**
 * Días sin movimiento tras los cuales el backend manda un proyecto sano a
 * stand-by. Debe coincidir con UMBRAL_STANDBY_DIAS del servidor; aquí solo se
 * usa para redactar los textos de ayuda.
 */
export const DIAS_STANDBY = 21;

// ── Defaults ─────────────────────────────────────────────────────────────────

export const salud = (p: Project): Salud => {
  if (!p.salud) return "SIN_ERRORES";
  if (SALUD_CFG[p.salud]) return p.salud;
  return SALUD_LEGACY[p.salud as string] ?? "SIN_ERRORES";
};
export const criticidad = (p: Project): Criticidad => (p.criticidad && CRITICIDAD_CFG[p.criticidad] ? p.criticidad : "MEDIA");
export const fase      = (p: Project): Fase       => (p.fase && FASE_CFG[p.fase] ? p.fase : "DESARROLLO");

/**
 * Un proyecto está en stand-by si su fase es PAUSA, la haya puesto una persona
 * o el barrido automático. Es el criterio que usa el tablero para ocultarlo.
 */
export const enPausa = (p: Project): boolean => fase(p) === "PAUSA";

// ── Fechas ───────────────────────────────────────────────────────────────────

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "27 jul 2026" — acepta YYYY-MM-DD o ISO datetime. */
export function fmtFecha(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${Number(d)} ${MESES[Number(m) - 1] ?? m} ${y}`;
}

/** "27 jul 2026 · 14:32" */
export function fmtFechaHora(iso?: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return fmtFecha(iso);
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${fmtFecha(iso)} · ${hh}:${mm}`;
}

export function diasDesde(iso?: string | null): number | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const a = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const hoy = new Date();
  const b = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** "hoy" · "ayer" · "hace 5 d" · "hace 3 sem" */
export function fmtHace(iso?: string | null): string {
  const dias = diasDesde(iso);
  if (dias === null) return "sin registro";
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 21) return `hace ${dias} d`;
  if (dias < 60) return `hace ${Math.round(dias / 7)} sem`;
  return `hace ${Math.round(dias / 30)} meses`;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
