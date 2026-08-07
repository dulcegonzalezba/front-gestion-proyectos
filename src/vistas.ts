/**
 * Catálogo de vistas que se pueden conceder a un usuario.
 * Debe mantenerse alineado con el backend (src/usuarios/usuarios.service.ts).
 */

export interface Vista {
  key: string;
  label: string;
  desc: string;
}

export const VISTAS: Vista[] = [
  { key: "home",         label: "Inicio",       desc: "Panel de capas del SIR Plus, focos de la semana y tareas en seguimiento" },
  { key: "sirplus",      label: "SIR Plus",     desc: "Radiografía completa del sistema: módulos, procesos críticos y brechas" },
  { key: "celulas",      label: "Células",      desc: "Tareas por célula de trabajo" },
  { key: "proyectos",    label: "Proyectos",    desc: "Tablero de proyectos, semáforo y bitácora" },
  { key: "pmo",          label: "PMO",          desc: "Seguimiento de dirección de proyectos" },
  { key: "acuerdos",     label: "Acuerdos",     desc: "Acuerdos de las sesiones y su seguimiento" },
  { key: "liberaciones", label: "Liberaciones", desc: "Liberaciones por proyecto" },
  { key: "historial",    label: "Historial",    desc: "Checkpoints guardados y generación de PDF" },
];

/** La vista de aterrizaje: todo usuario la trae, no se puede quitar. */
export const VISTA_BASE = "home";

/** Vistas exclusivas del administrador; no se conceden por separado. */
export const VISTAS_ADMIN: { key: string; label: string }[] = [
  { key: "personal", label: "RH" },
  { key: "usuarios", label: "Usuarios" },
];

export const PRESETS: { nombre: string; desc: string; vistas: string[] }[] = [
  { nombre: "Solo SIR Plus", desc: "Únicamente el panel de capas y la radiografía", vistas: ["home", "sirplus"] },
  { nombre: "Consulta operativa", desc: "SIR Plus más el seguimiento de células y proyectos", vistas: ["home", "sirplus", "celulas", "proyectos"] },
  { nombre: "Seguimiento completo", desc: "Todas las vistas salvo las de administrador", vistas: VISTAS.map(v => v.key) },
];

/** ¿Este usuario puede abrir esta vista? `vistas === null` significa acceso total. */
export function puedeVer(vistas: string[] | null, key: string, esAdmin: boolean): boolean {
  if (esAdmin) return true;
  if (VISTAS_ADMIN.some(v => v.key === key)) return false;
  if (vistas === null) return true;
  return vistas.includes(key);
}
