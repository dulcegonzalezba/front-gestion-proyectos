import { useState } from "react";

// ── TYPES ─────────────────────────────────────────────────────────────────────
type Criticality = "CRITICA" | "ALTA" | "MEDIA";
type EstadoKey   = "produccion" | "desarrollo" | "refactor" | "pausa";

interface Task {
  id: string;
  title: string;
  resp: string;
  status: string;
  cell: string;
  notes?: string;
  zoho?: string;
}
interface Project {
  id: string;
  name: string;
  criticality: Criticality;
  estado: EstadoKey;
  tasks: Task[];
}
interface FocusItem {
  id: string;
  title: string;
  resp: string;
  cell: string;
  status: string;
  notes: string;
}

// ── COLOR MAPS ────────────────────────────────────────────────────────────────
const CRIT_COLOR: Record<Criticality, string> = {
  CRITICA: "#ef4444", ALTA: "#F59E0B", MEDIA: "#4ADE80",
};
const ESTADO_COLOR: Record<EstadoKey, string> = {
  produccion: "#4ADE80", desarrollo: "#60A5FA", refactor: "#F59E0B", pausa: "#786A58",
};
const ESTADO_LABEL: Record<EstadoKey, string> = {
  produccion: "Producción", desarrollo: "Desarrollo", refactor: "Refactor", pausa: "En pausa",
};
const CELL_CLR: Record<string, string> = {
  "DBA": "#0ea5e9",
  "DevOps": "#8b5cf6",
  "Backend SIR": "#f59e0b",
  "Frontend SIR": "#ec4899",
  "Nuevas Tec": "#10b981",
  "Reporteador Nayarit": "#64748b",
};
const STATUS_META: Record<string, { l: string; c: string }> = {
  URGENTE:            { l: "Urgente",          c: "#ef4444" },
  BLOQUEADO:          { l: "Bloqueado",         c: "#7f1d1d" },
  BLOQUEANTE:         { l: "Bloqueante",        c: "#991b1b" },
  IMPORTANTE:         { l: "Importante",        c: "#c2410c" },
  PRIORITARIO:        { l: "Prioritario",       c: "#b91c1c" },
  PENDIENTE:          { l: "Pendiente",         c: "#f87171" },
  REVISAR:            { l: "Revisar",           c: "#e11d48" },
  ALTA_PRIORIDAD:     { l: "Alta prioridad",    c: "#ca8a04" },
  ESTA_SEMANA:        { l: "Esta semana",       c: "#a16207" },
  PENDIENTE_ANTERIOR: { l: "Pend. anterior",    c: "#d97706" },
  POSIBLE:            { l: "Posible",           c: "#92400e" },
  ESTIMACION:         { l: "Estimación req.",   c: "#d97706" },
  ACTIVO:             { l: "Activo",            c: "#2563eb" },
  EN_CURSO:           { l: "En curso",          c: "#1d4ed8" },
  SEGUIMIENTO:        { l: "Seguimiento",       c: "#3b82f6" },
  COORDINADO:         { l: "Coordinado",        c: "#60a5fa" },
  PAUSADO:            { l: "Pausado",           c: "#9ca3af" },
  COMPLETADO:         { l: "Completado",        c: "#16a34a" },
  POR_PLANEAR:        { l: "Por planear",       c: "#7c3aed" },
  BANDERA_AMARILLA:   { l: "Bandera amarilla",  c: "#b45309" },
  LISTO_PROD:         { l: "Listo para prod",   c: "#0f766e" },
  NO_INICIADA:        { l: "No iniciada",       c: "#475569" },
  ARCHIVADO:          { l: "Archivado",         c: "#334155" },
};

const BLOCKED = ["URGENTE", "BLOQUEADO", "BLOQUEANTE", "IMPORTANTE", "PRIORITARIO"];
const ACTIVE  = ["EN_CURSO", "ACTIVO", "SEGUIMIENTO", "COORDINADO", "ALTA_PRIORIDAD", "ESTA_SEMANA"];
const DONE    = ["COMPLETADO", "LISTO_PROD"];

// ── Buckets de visibilidad para el panel de inicio ─────────────────────────────
// Tareas que se abordan esta semana
const WEEK_STATUSES     = ["ESTA_SEMANA"];
// Tareas que NO debemos perder de vista (ordenadas por severidad)
const PRIORITY_STATUSES = ["URGENTE", "BLOQUEANTE", "BLOQUEADO", "PRIORITARIO", "IMPORTANTE", "ALTA_PRIORIDAD"];
// En curso (sin solaparse con las dos categorías anteriores)

// ── TASK FACTORY ──────────────────────────────────────────────────────────────
const tk = (
  id: string, title: string, resp: string, status: string, cell: string,
  notes = "", zoho = ""
): Task => ({ id, title, resp, status, cell, notes, zoho });

// ── FOCUS ITEMS ───────────────────────────────────────────────────────────────
const FOCUS_INIT: FocusItem[] = [
  {
    id: "F1", status: "ESTA_SEMANA", cell: "Multi-célula",
    title: "TLAJOMULCO — PRIORIDAD #1 | Funcionalidades requeridas",
    resp: "Paolo + Mario + Alfonso",
    notes: "Prioridad activa Backend + Frontend + DevOps. Monitorear lista de funcionalidades en cada sesión.",
  },
  {
    id: "F2", status: "ESTA_SEMANA", cell: "DBA",
    title: "Migración de Juárez — CERRAR",
    resp: "Abril (a cargo de Haniel)",
    notes: "Abril ejecuta, coordinada por Haniel. Debe cerrarse esta semana.",
  },
  {
    id: "F3", status: "URGENTE", cell: "Backend + Frontend + DBA",
    title: "Plan de Estabilización Nayarit 2026",
    resp: "Paolo + Mario + Raul + Erick Villa",
    notes: "Meet 3 veces por semana. Issues de Zoho requieren cierre puntual.",
  },
  {
    id: "F4", status: "ESTA_SEMANA", cell: "DevOps / Dirección",
    title: "PLAN DE MIGRACIÓN DE NUBE — Meta: Mayo 2026",
    resp: "Dulce González + Miguel Ángel + Alfonso",
    notes: "Navojoa → Curiosity esta semana. Cotización servidor integral. Jalisco instalación. Ver roadmap.",
  },
  {
    id: "F5", status: "BANDERA_AMARILLA", cell: "Nuevas Tec",
    title: "APP ALERTAS NAYARIT — Terminar y segmentar envíos",
    resp: "Francisco Alegría",
    notes: "Falta terminar app y segmentar geográficamente los envíos. Ver posibilidad de cerrar esta semana.",
  },
  {
    id: "F6", status: "SEGUIMIENTO", cell: "Backend SIR",
    title: "NAY: Descuentos/actualizaciones motos en vehículos — VERIFICAR",
    resp: "Paolo + Mario + Raul",
    notes: "No debe ocurrir desde 8 de abril. Confirmar corregido en producción.",
  },
];

// ── PROJECTS — carga inicial con tareas clasificadas ──────────────────────────
const PROJECTS_INIT: Project[] = [

  // ── SIR NAYARIT ────────────────────────────────────────────────────────────
  {
    id: "p-nay", name: "SIR Nayarit", criticality: "CRITICA", estado: "produccion",
    tasks: [
      // Plan de estabilización
      tk("np_be2",    "Pagos externos — se procesan pero incorrectamente",                        "Paolo Payan",           "COMPLETADO",     "Backend SIR"),
      tk("np_be3",    "Recibos por pago en línea salen con cantidad incorrecta",                  "Paolo Payan",           "EN_CURSO",       "Backend SIR"),
      tk("np_be4",    "NABO-T17: Al actualizar datos borra nombre del contribuyente",             "Erick Villa",           "LISTO_PROD",     "Backend SIR"),
      tk("np_fe1",    "Cálculo incorrecto de recargos; multa no aparece en vista previa",         "Mario Merel",           "COMPLETADO",     "Frontend SIR"),
      tk("np_fe2",    "No sale línea de captura Convenio Netpay con tiendas de conveniencia",     "Mario Merel",           "PAUSADO",        "Frontend SIR"),
      tk("np_dba1",   "Corregir BD marzo para cuadrar contabilidad",                              "Raul",                  "EN_CURSO",       "DBA"),
      tk("np_dba2",   "Corregir mes en curso (abril) y meses anteriores hasta enero + años ant.", "Abril + Raul",          "PENDIENTE",      "DBA"),
      tk("np_dba3",   "Reproducir casos de prueba para que desarrollo corrija descuadres",        "Haniel + Raul",         "EN_CURSO",       "DBA"),
      // Backend issues
      tk("be4",       "NAYARIT — Pagos externos incorrectos",                                     "Paolo Payan",           "COMPLETADO",     "Backend SIR"),
      tk("be5",       "NAYARIT — Recibos por pago en línea con cantidad incorrecta",              "Paolo Payan",           "EN_CURSO",       "Backend SIR"),
      tk("be6",       "NABO-T17: Al actualizar datos borra nombre del contribuyente",             "Erick Villa",           "LISTO_PROD",     "Backend SIR"),
      tk("be9",       "Replicar optimizaciones Tlajomulco en productivos (NAY, OAX, NVJ)",        "Paolo Payan",           "ALTA_PRIORIDAD", "Backend SIR"),
      tk("nay_be1",   "NA1-I1758: Filtros a adicionales con objects_with_deleted",                "Arlethe Mora",          "EN_CURSO",       "Backend SIR"),
      tk("nay_be2",   "NA1-I1753: Filtro por 'configuracion_de_asignacion_de_placa'",             "Arlethe Mora",          "REVISAR",        "Backend SIR"),
      tk("nay_be3",   "NA1-I1751: Falla intermitente generación recibos en cobros rápidos",       "Dulce Guadalupe",       "PENDIENTE",      "Backend SIR"),
      tk("nay_be4",   "NA1-I1748: Soporte generar-recibo-por-referencia-de-pago",                 "Erick Villa",           "REVISAR",        "Backend SIR"),
      tk("nay_be5",   "NA1-I1746: Indexación en campos placa y configuración",                    "Arlethe Mora",          "LISTO_PROD",     "Backend SIR"),
      tk("nay_be6",   "NA1-I1744: Al procesar pagos externos se generaron dos recibos",           "Erick Villa",           "LISTO_PROD",     "Backend SIR"),
      tk("nay_be7",   "NA1-I1741: Diferencia en el monto al reimprimir folios de trámites",       "Dulce Guadalupe",       "PENDIENTE",      "Backend SIR"),
      tk("nay_be8",   "NA1-I1736: Filtro por Servicio de Vehículo (ID 77) en pruebas",            "Arlethe Mora",          "REVISAR",        "Backend SIR"),
      tk("nay_be9",   "NA1-I1733: Falta información de convenio en padrón de remolques",          "Juan Pablo Campos",     "LISTO_PROD",     "Backend SIR"),
      tk("nay_be10",  "NA1-I1731: No permite agregar roles a usuario en el SIR",                  "Arlethe Mora",          "LISTO_PROD",     "Backend SIR"),
      tk("nay_be11",  "NA1-I1685: Convenio de motocicleta no se puede cobrar",                    "Erick Villa",           "LISTO_PROD",     "Backend SIR"),
      tk("nay_be12",  "NA1-I1684: Visualización incorrecta de recibos en cobros de convenios",    "Juan Pablo Campos",     "PAUSADO",        "Backend SIR"),
      tk("nay_be13",  "NA1-I1599: Error en acuse de suspensión de actividades (impuesto)",        "Dulce Guadalupe",       "PAUSADO",        "Backend SIR"),
      // Frontend issues
      tk("fe2",       "NAYARIT — Cálculo incorrecto de recargos; multa no aparece",               "Mario Merel",           "COMPLETADO",     "Frontend SIR"),
      tk("fe3",       "NAYARIT — No sale línea de captura Convenio Netpay",                       "Mario Merel",           "PAUSADO",        "Frontend SIR"),
      tk("nay_fe1",   "NA1-I1756: No sale línea de captura Convenio Netpay con tiendas",          "Julio Huerta",          "PAUSADO",        "Frontend SIR"),
      tk("nay_fe2",   "NA1-I1755: Calculando incorrectamente recargos en prellenado",             "Julio Huerta",          "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe3",   "NA1-I1745: No permite búsqueda en contribuyente en Alta de Padrón",        "Alejandro German",      "REVISAR",        "Frontend SIR"),
      tk("nay_fe4",   "NA1-I1743: Selección automática incorrecta de cargos en Alcoholes",        "Alfredo Aragón",        "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe5",   "NA1-I1739: Alta Padrón Alcohol — campo búsqueda incorrecto",               "Alejandro German",      "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe6",   "NA1-I1729: No se pueden hacer pagos en línea en portal de pruebas",        "Mario Alan Merel",      "PAUSADO",        "Frontend SIR"),
      tk("nay_fe7",   "NA1-I1722: Error al visualizar Requisitos cargados en digital",            "Alfredo Aragón",        "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe8",   "NA1-I1721: Falla en guardado de dirección al registrar usuario",           "Alfredo Aragón",        "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe9",   "NA1-I1717: Clave 97000113 — adeudo incorrecto en permiso alcohol",         "Alejandro German",      "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe10",  "NA1-I1716: Recargos incorrectos en impuestos estatales en portal",         "Julio Huerta",          "PAUSADO",        "Frontend SIR"),
      tk("nay_fe11",  "NA1-I1712: PAE: No arroja ventana para imprimir carta invitación",         "Alejandro German",      "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe12",  "NA1-I1701: Fallas en proceso de convenios de alcohol en pruebas",          "Julio Huerta",          "REVISAR",        "Frontend SIR"),
      tk("nay_fe13",  "NA1-I1668: Error en generación de órdenes de pago desde Caja",             "Julio Huerta",          "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe14",  "NA1-I1607: Desaparece información al guardar en Alta Padrón Alcohol",      "Alfredo Aragón",        "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe15",  "NA1-I1606: Problema al almacenar campo fecha en trámite alcoholes",        "Alfredo Aragón",        "LISTO_PROD",     "Frontend SIR"),
      tk("nay_fe16",  "NA1-I1600: Genera otros nombres en órdenes de pago Registro Público",      "Julio Huerta",          "PAUSADO",        "Frontend SIR"),
      // DBA issues
      tk("dba3",      "NAYARIT — Corregir BD marzo (Plan Estabilización)",                         "Raul",                  "EN_CURSO",       "DBA"),
      tk("dba4",      "NAYARIT — Corregir mes en curso y meses anteriores hasta enero",            "Abril + Raul",          "PENDIENTE",      "DBA"),
      tk("dba5",      "NAYARIT — Reproducir casos de prueba para que desarrollo corrija descuadres","Haniel + Raul",        "ALTA_PRIORIDAD", "DBA"),
      tk("dba10",     "NAY — Reporte Contribuyentes Declarantes de Nómina",                        "Raul",                  "COMPLETADO",     "DBA"),
      tk("dba11",     "NAY — Mejoras reporte concentrado de ingresos",                             "Abril",                 "COMPLETADO",     "DBA"),
      tk("dba12",     "NAY — Reporte baja de placas",                                              "Abril + Jose Navarro",  "PENDIENTE",      "DBA"),
      tk("dba13",     "NAY — Porcentajes cargos por municipio en ingresos",                        "Raul",                  "PENDIENTE",      "DBA"),
      tk("dba14",     "NAY: Archivo de descuadre 22-04-2026 — falta para cerrar marzo",            "Raul + Haniel",         "URGENTE",        "DBA", "Prerequisito para cierre contable de marzo Nayarit."),
      tk("dba15",     "NAY: Descuadres Netpay — archivo compartido para cuadrar marzo",            "Raul + Haniel",         "URGENTE",        "DBA"),
      tk("nay_dba1",  "NA1-I1750: Arreglar folios donde no coincide total pagado con consulta",    "Raul Ivan Fragoso",     "PENDIENTE",      "DBA"),
      tk("nay_dba2",  "NA1-I1737: Error 400 al generar tarjeta de circulación",                   "Raul Ivan Fragoso",     "PENDIENTE",      "DBA"),
      tk("nay_dba3",  "NA1-I1730: Recibos por pago en línea con cantidad incorrecta",              "Erick Villa",           "EN_CURSO",       "DBA"),
      tk("nay_dba4",  "NA1-I1723: Error al emitir documento (reporteador)",                        "Jose Navarro",          "LISTO_PROD",     "DBA"),
      tk("nay_dba5",  "NA1-I1715: PAE: No representa correctamente cargos de cartera vencida",    "Dulce Guadalupe",       "PENDIENTE",      "DBA"),
      tk("nay_dba6",  "NA1-I1707: Tarea programada 'Sábana de vehículos por cartera'",            "Jose Navarro",          "PAUSADO",        "DBA"),
      tk("nay_dba7",  "NA1-I1617: Reporte Declarantes de Nómina",                                  "Raul Ivan Fragoso",     "PAUSADO",        "DBA"),
      tk("nay_dba8",  "NA1-I1616: Reporte Detalle de Movimientos",                                 "Haniel Rojo",           "PENDIENTE",      "DBA"),
      tk("nay_dba9",  "NA1-I1615: Reporte Órdenes Procesadas por Instituciones Bancarias",         "Haniel Rojo",           "REVISAR",        "DBA"),
      tk("nay_dba10", "NA1-I1613: Reporte Ingresos Coordinados",                                   "Haniel Rojo",           "EN_CURSO",       "DBA"),
      tk("nay_dba11", "NA1-I1612: Reporte Acumulado de Ingresos por Unidad Recaudadora",           "Haniel Rojo",           "EN_CURSO",       "DBA"),
      tk("nay_dba12", "NA1-I1602: Visualización incorrecta en inscripción al Padrón Estatal",      "Jose Navarro",          "EN_CURSO",       "DBA"),
      tk("nay_dba13", "NA1-I1583: Caídas constantes en reporteador tras actualización",            "Miguel Angel Ramos",    "REVISAR",        "DBA"),
      tk("nay_dba14", "NA1-I1568: Homologar reportes por fecha del recibo",                        "Jose Navarro",          "PAUSADO",        "DBA"),
      // Reporteador
      tk("rn1", "Reporte Contribuyentes Declarantes de Nómina",       "Jose + Haniel", "SEGUIMIENTO", "Reporteador Nayarit"),
      tk("rn2", "Mejoras reporte concentrado de ingresos",             "Jose + Haniel", "SEGUIMIENTO", "Reporteador Nayarit"),
      tk("rn3", "Reporte de baja de placas",                           "Haniel + Jose", "SEGUIMIENTO", "Reporteador Nayarit"),
      tk("rn4", "Porcentajes cargos por municipio",                    "Jose + Haniel", "SEGUIMIENTO", "Reporteador Nayarit"),
      tk("rn5", "Ajustes reportes declaraciones",                      "Jose Navarro",  "SEGUIMIENTO", "Reporteador Nayarit"),
      tk("rn6", "Reporte Detalle Impuesto Predial",                    "Jose + Haniel", "SEGUIMIENTO", "Reporteador Nayarit"),
      tk("rn7", "Recibos pago en línea en póliza contable",            "Jose + Haniel", "SEGUIMIENTO", "Reporteador Nayarit"),
    ],
  },

  // ── SIR TLAJOMULCO ─────────────────────────────────────────────────────────
  {
    id: "p-tlj", name: "SIR Tlajomulco", criticality: "CRITICA", estado: "produccion",
    tasks: [
      tk("be1",  "TLAJOMULCO — PRIORIDAD #1 | Funcionalidades requeridas",                     "Paolo + Mario + Alfonso", "ALTA_PRIORIDAD", "Backend SIR"),
      tk("be2",  "TLAJOMULCO — Requerimientos SIMUN para endpoints de transmisión patrimonial", "Paolo Payan",             "COMPLETADO",     "Backend SIR"),
      tk("be12", "TLAJOMULCO — Funcionalidades requeridas (lista Zoho)",                       "Paolo + Mario",           "COMPLETADO",     "Backend SIR"),
      tk("be8",  "AUTOPAC — URLs de timbrado",                                                  "Dulce gestiona",          "COMPLETADO",     "Backend SIR"),
      tk("be8b", "AUTOPAC — Ordenar código para evaluación pase a producción",                  "Paolo + DevOps",          "ESTA_SEMANA",    "Backend SIR", "URLs listas. Ordenar código y definir servidor con DevOps."),
      tk("fe1",  "TLAJOMULCO — PRIORIDAD #1 | Funcionalidades requeridas",                     "Mario Merel",             "ALTA_PRIORIDAD", "Frontend SIR"),
      tk("fe8",  "TLJ: Obtener el valor Referido del Avalúo seleccionado",                     "Mario Merel",             "COMPLETADO",     "Frontend SIR"),
      tk("da2",  "TLAJOMULCO — Robustecer seguridad y ampliar servidores",                     "Alfonso",                 "EN_CURSO",       "DevOps"),
      tk("da4",  "VDS — Producción Tlajomulco",                                                 "Alfonso",                 "POR_PLANEAR",    "DevOps"),
      tk("dba8", "TLAJOMULCO — Migración y estabilización de datos",                           "Haniel + Raul",           "COMPLETADO",     "DBA"),
    ],
  },

  // ── SIR NAVOJOA ────────────────────────────────────────────────────────────
  {
    id: "p-nvj", name: "SIR Navojoa", criticality: "CRITICA", estado: "produccion",
    tasks: [
      tk("dm2",  "Instalar PROD NAVOJOA en CURIOSITY",                            "Miguel Angel",          "EN_CURSO",   "DevOps", "CERRAR ESTA SEMANA. Prerequisito para plan de migración de nube."),
      tk("dm4",  "Actualizar versión Reporteador Navojoa en Producción",          "Miguel Angel",          "COMPLETADO", "DevOps"),
      tk("da8",  "NAVOJOA — Envío de recursos para servidor integral a Curiosity","Alfonso + Miguel Angel", "URGENTE",    "DevOps", "Specs para que Curiosity cotice servidor que soporte ecosistema completo Navojoa."),
      tk("be7",  "OOMAPAS — Revisión de tareas activas",                          "Paolo + Mario",          "ACTIVO",     "Backend SIR", "No pausar."),
      tk("fe5",  "OOMAPAS — Revisión de tareas activas",                          "Mario Merel",            "ACTIVO",     "Frontend SIR", "No pausar."),
      tk("be11", "Navojoa — Caso recibo R-26-043208 (uso interno)",               "Paolo Payan",            "SEGUIMIENTO","Backend SIR", "Coordinar con Erick Villa. No incluir en reportes generales."),
    ],
  },

  // ── SIR JALISCO ────────────────────────────────────────────────────────────
  {
    id: "p-jal", name: "SIR Jalisco", criticality: "CRITICA", estado: "produccion",
    tasks: [
      tk("da6", "JALISCO — Instalación de ambiente completo con librerías actualizadas","Alfonso",   "URGENTE", "DevOps", "CERRAR ESTA SEMANA. Frontend y Backend al día. Primer paso Plan de Salida Jalisco."),
      tk("nt4", "Jalisco Ventanilla Única — Seguimiento",                               "Jose Ramon","EN_CURSO","Nuevas Tec"),
    ],
  },

  // ── SIR OAXACA ─────────────────────────────────────────────────────────────
  {
    id: "p-oax", name: "SIR Oaxaca", criticality: "CRITICA", estado: "produccion",
    tasks: [
      tk("da7",  "OAXACA ESTADO — Instalación de monitoreo de servidores", "Alfonso", "PENDIENTE", "DevOps"),
      tk("dba7", "OAXACA MUNICIPIO — Bitácora de Trazabilidad",            "Haniel",  "PAUSADO",   "DBA"),
      tk("dba9", "OAXACA — Numeralia de comercios",                        "Haniel",  "POSIBLE",   "DBA", "Prioridad baja."),
    ],
  },

  // ── SIR REPUVE ─────────────────────────────────────────────────────────────
  {
    id: "p-repuve", name: "SIR REPUVE", criticality: "CRITICA", estado: "produccion",
    tasks: [
      tk("fe6", "REPUVE — Hoja de verificación", "Equipo Frontend + Karina Monroy", "EN_CURSO", "Frontend SIR", "Capacitación a Finanzas realizada. Pidieron cambios. Se aterriza con Karina Monroy."),
    ],
  },

  // ── SIR — PORTAL, ADMIN, REPORTEADOR, BI ───────────────────────────────────
  {
    id: "p-sir-core", name: "SIR — Portal, Admin, Reporteador, BI", criticality: "CRITICA", estado: "produccion",
    tasks: [
      tk("dm1",  "Instalar ambiente PROD iPROVINAY",                              "Miguel Angel",          "COMPLETADO",        "DevOps"),
      tk("dm5",  "NAYARIT — Switch de repositorios: apuntar nuevo repo a producción","Miguel Angel",        "PAUSADO",           "DevOps"),
      tk("dm6",  "Planear manejo de archivos bucket — pruebas y producción",      "Miguel Angel",          "POR_PLANEAR",       "DevOps", "Ya tienen configurado Contabo. Definir estrategia."),
      tk("dm7",  "Uniformizar nomenclatura de DNS",                               "Miguel Angel",          "EN_CURSO",          "DevOps", "Esquema: sir/api-sir/retys/reporteador/portal/bi — entidad — ambiente"),
      tk("dm8",  "Plan distribución de sistemas — VPS sobrepoblado",             "Miguel Angel",          "URGENTE",           "DevOps"),
      tk("da5",  "Activar VPN en VPS",                                            "Alfonso",               "PENDIENTE_ANTERIOR","DevOps"),
      tk("da9",  "iPROVINAY — Ordenar ramas en repositorio exclusivo",           "Paolo + Mario + Miguel","ESTA_SEMANA",       "DevOps"),
      tk("be10", "REPOSITORIOS POR PROYECTO — comenzar por iPROVINAY",          "Paolo + Mario",          "ESTA_SEMANA",       "Backend SIR", "Orden: iPROVINAY → Navojoa → Oaxaca → Tlajomulco."),
      tk("fe7",  "REPOSITORIOS POR PROYECTO — comenzar por iPROVINAY",          "Mario + Paolo",          "ESTA_SEMANA",       "Frontend SIR"),
      tk("dba1", "Migración de Juárez — TERMINAR ESTA SEMANA",                   "Abril (a cargo de Haniel)","ESTA_SEMANA",    "DBA", "Solo Abril ejecuta, coordinada por Haniel. Meta: cierre esta semana."),
      tk("dba2", "REPORTES DEL FAN",                                              "Haniel",                 "ESTA_SEMANA",       "DBA"),
    ],
  },

  // ── NÓMINAS — TLAJOMULCO & NAVOJOA ─────────────────────────────────────────
  {
    id: "p-nominas", name: "Nóminas — Tlajomulco & Navojoa", criticality: "CRITICA", estado: "produccion",
    tasks: [],
  },

  // ── SIR-LITE MULTAS — OAXACA ESTADO ────────────────────────────────────────
  {
    id: "p-sirlite-oax", name: "SIR-Lite Multas — Oaxaca Estado", criticality: "ALTA", estado: "produccion",
    tasks: [
      tk("dm3", "OAXACA ESTADO SIR LITE MULTAS — Instalación en servidores del cliente","Miguel Angel",   "COMPLETADO","DevOps", "Siguiente: configuración WAF y DNS."),
      tk("nt2", "OAXACA ESTADO — Módulo Multas MultApp Lite",                           "Equipo Nuevas Tec","COMPLETADO","Nuevas Tec"),
    ],
  },

  // ── MULTAPP — OAXACA MUNICIPIO ──────────────────────────────────────────────
  {
    id: "p-multapp", name: "MultApp — Oaxaca Municipio", criticality: "ALTA", estado: "produccion",
    tasks: [
      tk("dba7b","OAXACA MUNICIPIO — Bitácora de Trazabilidad","Haniel","PAUSADO","DBA"),
    ],
  },

  // ── MULTAPP LITE — OAXACA ESTADO ───────────────────────────────────────────
  {
    id: "p-multapp-lite", name: "MultApp Lite — Oaxaca Estado", criticality: "ALTA", estado: "produccion",
    tasks: [
      tk("pmt1","MultApp Lite — Especificar tipo de logs (P25)",                "Francisco Alegría","ESTA_SEMANA","Nuevas Tec"),
      tk("pmt2","MultApp Lite — Código anti-multi-instancia y evidencia (P32)", "Francisco Alegría","ESTA_SEMANA","Nuevas Tec"),
      tk("nt6", "Certificación MultApp y MultApp Lite — TERMINAR",              "Francisco Alegría","POSIBLE",    "Nuevas Tec", "Prioridad baja. Cerrar proceso de certificación pendiente."),
    ],
  },

  // ── EGRESOS — NAVOJOA ───────────────────────────────────────────────────────
  {
    id: "p-egresos", name: "Egresos — Navojoa", criticality: "ALTA", estado: "produccion",
    tasks: [
      tk("da3","Pasar sistema de Egresos a su propio VPS","Alfonso","POR_PLANEAR","DevOps","Parte del plan de distribución de sistemas."),
    ],
  },

  // ── FAN NAYARIT ─────────────────────────────────────────────────────────────
  {
    id: "p-fan", name: "FAN Nayarit", criticality: "MEDIA", estado: "pausa",
    tasks: [],
  },

  // ── APP CIUDADANO ───────────────────────────────────────────────────────────
  {
    id: "p-app-ciudadano", name: "App Ciudadano", criticality: "CRITICA", estado: "desarrollo",
    tasks: [],
  },

  // ── APP DE ALERTAMIENTOS GEOGRÁFICOS ────────────────────────────────────────
  {
    id: "p-alertas", name: "App de Alertamientos Geográficos", criticality: "ALTA", estado: "desarrollo",
    tasks: [
      tk("nt1","APP ALERTAS NAYARIT — Avances esta semana",                         "Francisco + equipo","BANDERA_AMARILLA","Nuevas Tec", "Conexión Backend + OneSignal. Falta segmentar geográficamente los envíos."),
      tk("nt8","APP ALERTAS NAYARIT — Terminar app y segmentar envíos geográficamente","Francisco Alegría","ESTA_SEMANA",     "Nuevas Tec"),
    ],
  },

  // ── NUEVO SIR-LITE ──────────────────────────────────────────────────────────
  {
    id: "p-sirlite-new", name: "Nuevo SIR-Lite", criticality: "CRITICA", estado: "desarrollo",
    tasks: [
      tk("nt3","SIR LITE — Nueva base de datos",                             "Francisco + Raul",  "EN_CURSO",     "Nuevas Tec", "Sistema nuevo desde cero."),
      tk("nt5","SIR LITE — Vulnerabilidades detectadas",                     "Francisco + DevOps","PRIORITARIO",  "Nuevas Tec"),
      tk("nt7","SIR LITE — Avances primer hito con demo en Backend",        "Francisco Alegría", "ESTA_SEMANA",  "Nuevas Tec", "Presentar demo funcional de backend. Ver posibilidad de arrancar Frontend."),
    ],
  },

  // ── VENTANILLA ÚNICA (CON PAYLOAD) ─────────────────────────────────────────
  {
    id: "p-ventanilla", name: "Ventanilla Única (con Payload)", criticality: "CRITICA", estado: "refactor",
    tasks: [
      tk("nt4b","Jalisco Ventanilla Única — Seguimiento","Jose Ramon","EN_CURSO","Nuevas Tec"),
    ],
  },
];

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const T = {
  pageBg:   "#09090C",
  card:     "#0F1117",
  surface:  "#14161E",
  hover:    "#1A1D28",
  border:   "#1E2233",
  borderLt: "#272B40",
  text1:    "#E8E3D8",
  text2:    "#7A7F9A",
  text3:    "#3E4260",
  gold:     "#C9A84C",
  goldDim:  "#8A6E2F",
};

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: `linear-gradient(145deg, ${T.card} 0%, #12141C 100%)`,
      border: `1px solid ${color}28`,
      borderRadius: 14, padding: "24px 22px",
      position: "relative", overflow: "hidden",
      boxShadow: `0 0 32px ${color}0A, inset 0 1px 0 ${color}15`,
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse at 0% 0%, ${color}0D 0%, transparent 65%)`,
      }} />
      <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: 1, background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />
      <div style={{ fontSize: 42, fontWeight: 800, color, lineHeight: 1, marginBottom: 10, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 10, color: T.text2, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { l: status, c: "#786A58" };
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      background: `${meta.c}18`, color: meta.c,
      border: `1px solid ${meta.c}35`,
      whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.04em",
    }}>
      {meta.l}
    </span>
  );
}

// ── ARQUITECTURA IDEAL ────────────────────────────────────────────────────────
type NodeColor = "green" | "blue" | "purple" | "teal" | "orange" | "red" | "gray";

interface ArchNode {
  id:       string;
  label:    string;
  sublabel: string;
  color:    NodeColor;
  systems:  { name: string; tag?: string }[];
  note?:    string;
}

const NODE_CLR: Record<NodeColor, { border: string; bg: string; badge: string; dot: string }> = {
  green:  { border: "#16a34a", bg: "#0a1a0f", badge: "#14532d", dot: "#16a34a" },
  blue:   { border: "#2563eb", bg: "#0a0f1a", badge: "#1e3a8a", dot: "#3b82f6" },
  purple: { border: "#7c3aed", bg: "#0f0a1a", badge: "#4c1d95", dot: "#a78bfa" },
  teal:   { border: "#0d9488", bg: "#0a1816", badge: "#134e4a", dot: "#2dd4bf" },
  orange: { border: "#d97706", bg: "#1a1000", badge: "#78350f", dot: "#f59e0b" },
  red:    { border: "#dc2626", bg: "#1a0a0a", badge: "#7f1d1d", dot: "#ef4444" },
  gray:   { border: "#374151", bg: "#0d0f12", badge: "#1f2937", dot: "#6b7280" },
};

const ARCH_NODES: ArchNode[] = [
  {
    id: "curiosity", label: "CURIOSITY", sublabel: "Navojoa — servidor dedicado",
    color: "green",
    systems: [
      { name: "SIR Navojoa",          tag: "prod" },
      { name: "Egresos Navojoa",       tag: "prod" },
      { name: "OOMAPAS Navojoa",       tag: "prod" },
      { name: "Reporteador Navojoa",   tag: "prod" },
    ],
    note: "Servidor integral cotizado por Curiosity para todo el ecosistema Navojoa",
  },
  {
    id: "vps-vds", label: "VPS / VDS", sublabel: "Infraestructura interna distribuida",
    color: "blue",
    systems: [
      { name: "VPS 1 — Egresos QA + Dev",  tag: "qa" },
      { name: "VPS 2 — Ingresos QA",        tag: "qa" },
      { name: "VPS 3 — Ingresos Dev",       tag: "dev" },
      { name: "VDS — Tlajomulco Prod",      tag: "prod" },
      { name: "VDS — Nóminas Tlajomulco",   tag: "prod" },
    ],
    note: "Distribución post-reorganización. Un VPS por ambiente para evitar sobrepoblación",
  },
  {
    id: "contabo", label: "CONTABO", sublabel: "Object storage / Buckets",
    color: "teal",
    systems: [
      { name: "Bucket Pruebas",    tag: "qa" },
      { name: "Bucket Producción", tag: "prod" },
    ],
    note: "Estrategia de buckets pendiente de definir: separar por entidad + ambiente",
  },
  {
    id: "oaxaca-estado", label: "OAXACA ESTADO", sublabel: "Servidores del cliente (WAF + DNS)",
    color: "orange",
    systems: [
      { name: "SIR Lite Multas",   tag: "prod" },
      { name: "Proxy → backend",   tag: "config" },
      { name: "Monitoreo",         tag: "config" },
    ],
    note: "Cliente aloja en su propia infraestructura. SIGOB configura y da soporte",
  },
  {
    id: "jalisco", label: "JALISCO", sublabel: "Ambiente completo en proceso",
    color: "orange",
    systems: [
      { name: "SIR Frontend",    tag: "dev" },
      { name: "SIR Backend",     tag: "dev" },
      { name: "Reporteador",     tag: "dev" },
      { name: "RETYS",           tag: "dev" },
    ],
    note: "Librerías actualizadas (Python + Django). Primer paso del Plan de Salida Jalisco",
  },
  {
    id: "repuve", label: "REPUVE", sublabel: "Ambiente independiente",
    color: "purple",
    systems: [
      { name: "Portal de citas",  tag: "dev" },
      { name: "RETYS",            tag: "dev" },
      { name: "BD pruebas",       tag: "qa" },
    ],
    note: "Refactorización de seguridad activa: login, captcha, rate limit, ofuscación de IDs",
  },
];

const TAG_CLR: Record<string, { bg: string; color: string }> = {
  prod:   { bg: "#14532d", color: "#4ade80" },
  qa:     { bg: "#1e3a8a", color: "#93c5fd" },
  dev:    { bg: "#312e81", color: "#a5b4fc" },
  config: { bg: "#1c1917", color: "#a8a29e" },
};

// ── PLAN DE SALIDA HUAWEI ─────────────────────────────────────────────────────
// Orden de apagado en Huawei. `done` marca los ya completados por defecto.
const HUAWEI_STEPS = [
  { id: "h1", orden: 1, sistema: "Navojoa",          done: true, detalle: "Apagado. SIR + Egresos + OOMAPAS migrados a Curiosity y estables. ✓ Listo." },
  { id: "h2", orden: 2, sistema: "SEIGPOL",          detalle: "Siguiente en salir. Verificar que no haya dependencias activas antes de dar de baja." },
  { id: "h-cfdi",    orden: 3, sistema: "CFDI",                 detalle: "Migrar CFDI a Curiosity antes de continuar con el apagado en Huawei." },
  { id: "h-autopac", orden: 4, sistema: "AUTOPAC",              detalle: "Migrar AUTOPAC a Curiosity. Confirmar URLs de timbrado y pase a producción." },
  { id: "h-concil",  orden: 5, sistema: "Conciliación Bancaria", detalle: "Migrar Conciliación Bancaria a Curiosity y validar antes de dar de baja en Huawei." },
  { id: "h3", orden: 6, sistema: "REPUVE",           detalle: "Apagar tras confirmar el ambiente independiente de REPUVE estable en el nuevo servidor." },
  { id: "h4", orden: 7, sistema: "Oaxaca Municipio", detalle: "Apagar instancia de Oaxaca Municipio (SIR / MultApp) en Huawei. Confirmar DNS apuntando al nuevo servidor." },
  { id: "h5", orden: 8, sistema: "Nayarit",          detalle: "Último en salir. Confirmar estabilidad del Plan de Estabilización antes de apagar en Huawei." },
];

const STORAGE_KEY = "huawei_exit_plan_done_v2";

function loadHuaweiDone(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
    // Sin estado guardado: sembrar los pasos marcados como `done` por defecto
    return new Set(HUAWEI_STEPS.filter(s => (s as any).done).map(s => s.id));
  } catch { return new Set(); }
}

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
interface HomePageProps {
  focusItems?: FocusItem[];
  tasks?: Task[];
  week?: string;
  onFocusUpdate?: (id: string, updates: Partial<FocusItem>) => void;
  onFocusAdd?: () => void;
  onFocusDelete?: (id: string) => void;
}

const FOCUS_CELLS = ["DBA", "DevOps", "Backend SIR", "Frontend SIR", "Nuevas Tec", "Reporteador Nayarit", "Multi-celula"];

export default function HomePage({ focusItems, tasks, week, onFocusUpdate, onFocusAdd, onFocusDelete }: HomePageProps = {}) {
  const [huaweiDone, setHuaweiDone] = useState<Set<string>>(loadHuaweiDone);
  const [editFocusId, setEditFocusId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FocusItem>>({});

  const toggleHuawei = (id: string) => {
    setHuaweiDone(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // ── Tareas en vivo (desde las células). Fallback a datos demo si no hay props.
  const liveTasks: Task[] = (tasks && tasks.length ? tasks : PROJECTS_INIT.flatMap(p => p.tasks));

  // Tareas que NO debemos perder de vista
  const weekTasks = liveTasks.filter(t => WEEK_STATUSES.includes(t.status));
  const prioTasks = liveTasks
    .filter(t => PRIORITY_STATUSES.includes(t.status))
    .sort((a, b) => PRIORITY_STATUSES.indexOf(a.status) - PRIORITY_STATUSES.indexOf(b.status));

  // KPIs en vivo
  const kpiDone    = liveTasks.filter(t => DONE.includes(t.status)).length;

  // ── helpers de estilo ─────────────────────────────────────────────────────
  const section = (mb = 20): React.CSSProperties => ({
    background: `linear-gradient(160deg, ${T.card} 0%, #12141C 100%)`,
    border: `1px solid ${T.border}`,
    borderRadius: 16, padding: "22px 24px",
    marginBottom: mb,
    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
  });

  const sectionLabel = (color = T.text3): React.CSSProperties => ({
    fontSize: 9, fontWeight: 800, letterSpacing: "0.14em",
    textTransform: "uppercase", color, marginBottom: 14,
    display: "flex", alignItems: "center", gap: 8,
  });

  // Fila de tarea para los paneles de seguimiento del inicio
  const taskRow = (t: Task) => {
    const cc = CELL_CLR[t.cell] ?? T.text3;
    const isPrio = PRIORITY_STATUSES.includes(t.status);
    return (
      <div key={t.id + t.cell} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
        background: T.surface, borderRadius: 10, marginBottom: 6,
        border: `1px solid ${isPrio ? "rgba(239,68,68,0.2)" : T.border}`,
      }}>
        <StatusBadge status={t.status} />
        <span style={{ flex: 1, fontSize: 12, color: T.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.title}>
          {t.title}
        </span>
        {t.resp && <span style={{ fontSize: 10, color: T.text2, whiteSpace: "nowrap", flexShrink: 0 }}>{t.resp}</span>}
        {t.cell && (
          <span style={{ fontSize: 9, color: cc, background: cc + "18", padding: "2px 8px", borderRadius: 20, border: `1px solid ${cc}35`, whiteSpace: "nowrap", flexShrink: 0 }}>
            {t.cell}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif", color: T.text1,
      padding: "28px 28px 60px", background: T.pageBg, minHeight: "100%",
    }}>

      {/* ── ENCABEZADO ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: T.goldDim, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>
            SIGOB — Panel de Operaciones
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.text1, lineHeight: 1, letterSpacing: "-0.02em" }}>
            Panel de Proyectos
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 2 }}>
            {week ? `Semana ${week}` : "Semana en curso"}
          </div>
          <div style={{ fontSize: 10, color: T.text3 }}>
            {liveTasks.length} tareas en seguimiento · {weekTasks.length + prioTasks.length} a no perder de vista
          </div>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
        <KpiCard label="Esta semana"             value={weekTasks.length} color={T.gold}  />
        <KpiCard label="Urgentes / prioritarias" value={prioTasks.length} color="#ef4444" />
        <KpiCard label="Completadas"             value={kpiDone}          color="#4ADE80" />
      </div>

      {/* ── FOCOS DE LA SEMANA ──────────────────────────────────────────── */}
      {(() => {
        const items = focusItems ?? FOCUS_INIT;
        const active   = items.filter(f => f.status !== "ARCHIVADO");
        const archived = items.filter(f => f.status === "ARCHIVADO");
        const inp: React.CSSProperties = { background: "#09090C", color: "#E8E3D8", border: "1px solid #1E2233", borderRadius: 6, padding: "5px 8px", fontSize: 11, width: "100%", boxSizing: "border-box", fontFamily: "system-ui,sans-serif", outline: "none" };
        const saveFocusEdit = () => {
          if (editFocusId && onFocusUpdate) { onFocusUpdate(editFocusId, editForm); setEditFocusId(null); }
        };
        const renderCard = (f: FocusItem) => {
          const meta = STATUS_META[f.status] ?? { c: "#786A58", l: f.status };
          const isArchived = f.status === "ARCHIVADO";
          const isEditing  = editFocusId === f.id;
          return (
            <div key={f.id} style={{ background: T.surface, borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${isArchived ? "#334155" : meta.c}`, boxShadow: `0 0 16px ${meta.c}08`, opacity: isArchived ? 0.45 : 1, position: "relative" }}>
              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input value={editForm.title ?? ""} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} placeholder="Título" style={inp} />
                  <input value={editForm.resp ?? ""} onChange={e => setEditForm(p => ({ ...p, resp: e.target.value }))} placeholder="Responsable" style={inp} />
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {FOCUS_CELLS.map(cn => {
                      const cells = (editForm.cell ?? "").split(",").map(s => s.trim()).filter(Boolean);
                      const sel = cells.includes(cn);
                      const clr = CELL_CLR[cn] ?? "#475569";
                      return (
                        <button key={cn} type="button" onClick={() => {
                          const next = sel ? cells.filter(c => c !== cn) : [...cells, cn];
                          setEditForm(p => ({ ...p, cell: next.join(", ") }));
                        }} style={{ background: sel ? clr + "22" : "#09090C", color: sel ? clr : "#475569", border: `1px solid ${sel ? clr : "#1E2233"}`, borderRadius: 12, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontWeight: sel ? 600 : 400 }}>
                          {cn}
                        </button>
                      );
                    })}
                  </div>
                  <input value={editForm.notes ?? ""} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas (opcional)" style={inp} />
                  <select value={editForm.status ?? ""} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} style={{ ...inp, padding: "5px 8px" }}>
                    {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={saveFocusEdit} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Guardar</button>
                    <button onClick={() => setEditFocusId(null)} style={{ background: "#272B40", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <StatusBadge status={f.status} />
                    {f.cell && f.cell.split(",").map(s => s.trim()).filter(Boolean).map(cn => (
                      <span key={cn} style={{ fontSize: 9, color: CELL_CLR[cn] ?? T.text3, background: (CELL_CLR[cn] ?? "#475569") + "18", padding: "2px 7px", borderRadius: 20, border: `1px solid ${(CELL_CLR[cn] ?? "#475569")}35` }}>{cn}</span>
                    ))}
                    {onFocusUpdate && (
                      <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                        {!isArchived && <button title="Archivar" onClick={() => onFocusUpdate(f.id, { status: "ARCHIVADO" })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 13, padding: 0 }}>📦</button>}
                        <button title="Editar" onClick={() => { setEditFocusId(f.id); setEditForm({ title: f.title, resp: f.resp, cell: f.cell ?? "", notes: f.notes ?? "", status: f.status }); }} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 13, padding: 0 }}>✏️</button>
                        {onFocusDelete && <button title="Eliminar" onClick={() => onFocusDelete(f.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 13, padding: 0 }}>🗑</button>}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: T.text1, fontWeight: 600, lineHeight: 1.45, marginBottom: 5, textDecoration: isArchived ? "line-through" : "none" }}>{f.title}</div>
                  <div style={{ fontSize: 10, color: T.text2, marginBottom: f.notes ? 6 : 0 }}>{f.resp}</div>
                  {f.notes && <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.5, paddingTop: 6, borderTop: `1px solid ${T.border}` }}>{f.notes}</div>}
                </>
              )}
            </div>
          );
        };
        return (
          <div style={section()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={sectionLabel(T.gold)}>
                <span style={{ width: 3, height: 14, background: T.gold, borderRadius: 2, display: "inline-block" }} />
                Focos de la semana
              </div>
              {onFocusAdd && <button onClick={onFocusAdd} style={{ background: "none", border: "1px dashed #334155", borderRadius: 8, color: "#475569", padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>+ Agregar</button>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
              {active.map(renderCard)}
            </div>
            {archived.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #1E2233" }}>
                <div style={{ fontSize: 9, color: "#334155", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Archivados ({archived.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
                  {archived.map(renderCard)}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── PLAN DE SALIDA HUAWEI ───────────────────────────────────────── */}
      <div style={section()}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={sectionLabel("#f87171")}>
            <span style={{ width: 3, height: 14, background: "#ef4444", borderRadius: 2, display: "inline-block" }} />
            Plan de Salida Huawei
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 10, color: T.text3 }}>{huaweiDone.size}/{HUAWEI_STEPS.length} completados</div>
            <div style={{ width: 100, height: 4, background: T.surface, borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                background: huaweiDone.size === HUAWEI_STEPS.length
                  ? "linear-gradient(90deg,#16a34a,#4ade80)"
                  : "linear-gradient(90deg,#ef4444,#f97316)",
                width: `${(huaweiDone.size / HUAWEI_STEPS.length) * 100}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        </div>

        {/* timeline vertical */}
        <div style={{ position: "relative", paddingLeft: 36 }}>
          {/* línea de conexión */}
          <div style={{
            position: "absolute", left: 11, top: 12, bottom: 12,
            width: 2, background: `linear-gradient(180deg, ${T.borderLt}, ${T.border})`,
            borderRadius: 2,
          }} />

          {HUAWEI_STEPS.map((step, i) => {
            const done     = huaweiDone.has(step.id);
            const prevDone = i === 0 || huaweiDone.has(HUAWEI_STEPS[i - 1].id);
            const isNext   = !done && prevDone;
            const dotClr   = done ? "#16a34a" : isNext ? T.gold : T.border;
            return (
              <div key={step.id} style={{ position: "relative", marginBottom: i < HUAWEI_STEPS.length - 1 ? 12 : 0 }}>
                {/* dot */}
                <div style={{
                  position: "absolute", left: -36, top: 14,
                  width: 22, height: 22, borderRadius: "50%",
                  background: done ? "#14532d" : isNext ? "#2A1F00" : T.surface,
                  border: `2px solid ${dotClr}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isNext ? `0 0 10px ${T.gold}50` : done ? `0 0 8px #16a34a40` : "none",
                  transition: "all 0.3s",
                }}>
                  {done
                    ? <span style={{ color: "#4ade80", fontSize: 11, fontWeight: 800 }}>✓</span>
                    : <span style={{ fontSize: 9, fontWeight: 800, color: dotClr }}>{step.orden}</span>
                  }
                </div>

                {/* card */}
                <div
                  onClick={() => toggleHuawei(step.id)}
                  style={{
                    background: done ? "#0D1A0E" : isNext ? "#1A1400" : T.surface,
                    border: `1px solid ${done ? "#16a34a30" : isNext ? `${T.gold}50` : T.border}`,
                    borderRadius: 10, padding: "12px 16px",
                    cursor: "pointer", opacity: !prevDone && !done ? 0.4 : 1,
                    transition: "all 0.25s",
                    boxShadow: isNext ? `0 0 20px ${T.gold}12` : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: done ? "#4A5060" : T.text1, textDecoration: done ? "line-through" : "none" }}>
                          {step.sistema}
                        </span>
                        {isNext && (
                          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: `${T.gold}20`, color: T.gold, border: `1px solid ${T.gold}40`, fontWeight: 700 }}>
                            SIGUIENTE
                          </span>
                        )}
                        {done && (
                          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: "#14532d", color: "#4ade80", fontWeight: 700 }}>
                            APAGADO
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.5 }}>{step.detalle}</div>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${done ? "#16a34a" : T.borderLt}`,
                      background: done ? "#16a34a" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.25s",
                    }}>
                      {done && <span style={{ color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ARQUITECTURA OBJETIVO ──────────────────────────────────────── */}
      <div style={section()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={sectionLabel("#818CF8")}>
            <span style={{ width: 3, height: 14, background: "#818CF8", borderRadius: 2, display: "inline-block" }} />
            Mapa de Instalaciones
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {[["prod","#4ade80"],["qa","#93c5fd"],["dev","#a5b4fc"],["config","#a8a29e"]].map(([lbl,clr]) => (
              <span key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.text2 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: clr, display: "inline-block" }} />
                {lbl}
              </span>
            ))}
          </div>
        </div>

        {/* ── ZONA: NUBE PROPIA ─────────────────────────────────────── */}
        <div style={{
          border: `1.5px dashed #2563eb40`, borderRadius: 14,
          padding: "16px 16px 12px", marginBottom: 16,
          background: "linear-gradient(135deg,#08101A 0%,#09090E 100%)",
        }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: "#3b82f6", letterSpacing: "0.16em", marginBottom: 14, textTransform: "uppercase" }}>
            Nube Propia
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: 12 }}>

            {/* CURIOSITY */}
            <div style={{
              background: "linear-gradient(135deg,#0A1A0F,#0D1D12)", border: "1px solid #16a34a35",
              borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden",
              boxShadow: "0 0 24px #16a34a0A",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#16a34a,transparent)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", boxShadow: "0 0 8px #16a34a" }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: T.text1, letterSpacing: "0.06em" }}>CURIOSITY</span>
              </div>
              <div style={{ fontSize: 9, color: "#4ade8070", marginBottom: 12 }}>Navojoa — servidor dedicado</div>
              {[
                { name: "SIR Navojoa",        tag: "prod" },
                { name: "Egresos Navojoa",     tag: "prod" },
                { name: "OOMAPAS Navojoa",     tag: "prod" },
                { name: "Reporteador Navojoa", tag: "prod" },
              ].map(s => (
                <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: "#D1FAE5" }}>{s.name}</span>
                  <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 20, background: "#14532d", color: "#4ade80" }}>prod</span>
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 9, color: "#3E4260", lineHeight: 1.4, borderTop: "1px solid #16a34a15", paddingTop: 8 }}>
                Migrado y operativo. Ecosistema completo de Navojoa en servidor dedicado
              </div>
            </div>

            {/* VPS / VDS STACK */}
            <div style={{
              background: "linear-gradient(135deg,#080F1A,#0A0E18)", border: "1px solid #2563eb35",
              borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden",
              boxShadow: "0 0 24px #2563eb0A",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#3b82f6,transparent)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 8px #3b82f6" }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: T.text1, letterSpacing: "0.06em" }}>VPS / VDS</span>
              </div>
              <div style={{ fontSize: 9, color: "#93c5fd70", marginBottom: 12 }}>VPS: pruebas + iPROVINAY · VDS: producción</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { name: "VPS", sub: "iPROVINAY Prod",      tag: "prod" },
                  { name: "VPS", sub: "Jalisco — SIR",       tag: "dev" },
                  { name: "VPS", sub: "Egresos QA + Dev",    tag: "qa" },
                  { name: "VPS", sub: "Ingresos QA",         tag: "qa" },
                  { name: "VPS", sub: "Ingresos Dev",        tag: "dev" },
                  { name: "VDS", sub: "Tlajomulco SIR Prod", tag: "prod" },
                  { name: "VDS", sub: "Salamanca",           tag: "prod" },
                  { name: "VDS", sub: "Nóminas Tlajomulco",  tag: "prod" },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: T.surface, borderRadius: 7, padding: "7px 9px",
                    border: `1px solid ${T.border}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#93c5fd" }}>{s.name}</span>
                      <span style={{ fontSize: 7, padding: "1px 5px", borderRadius: 20,
                        background: s.tag === "prod" ? "#14532d" : s.tag === "qa" ? "#1e3a8a" : "#312e81",
                        color: s.tag === "prod" ? "#4ade80" : s.tag === "qa" ? "#93c5fd" : "#a5b4fc",
                      }}>{s.tag}</span>
                    </div>
                    <div style={{ fontSize: 9, color: T.text3 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 9, color: "#3E4260", lineHeight: 1.4, borderTop: "1px solid #2563eb15", paddingTop: 8 }}>
                VPS: sistemas de pruebas + iPROVINAY (único prod en VPS). VDS: producción — Tlajomulco y Salamanca
              </div>
            </div>

            {/* CONTABO */}
            <div style={{
              background: "linear-gradient(135deg,#081816,#090E14)", border: "1px solid #0d948835",
              borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden",
              boxShadow: "0 0 24px #0d94880A",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#2dd4bf,transparent)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2dd4bf", boxShadow: "0 0 8px #2dd4bf" }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: T.text1, letterSpacing: "0.06em" }}>CONTABO</span>
              </div>
              <div style={{ fontSize: 9, color: "#2dd4bf70", marginBottom: 12 }}>Object storage / Buckets</div>
              {[
                { name: "Bucket Pruebas",    tag: "qa" },
                { name: "Bucket Producción", tag: "prod" },
              ].map(s => (
                <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: "#CCFBF1" }}>{s.name}</span>
                  <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 20,
                    background: s.tag === "prod" ? "#14532d" : "#1e3a8a",
                    color: s.tag === "prod" ? "#4ade80" : "#93c5fd",
                  }}>{s.tag}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 9, color: "#3E4260", lineHeight: 1.4, borderTop: "1px solid #0d948815", paddingTop: 8 }}>
                Estrategia pendiente: separar por entidad + ambiente
              </div>
            </div>
          </div>
        </div>

        {/* ── ZONA: AMBIENTES DE CLIENTE ────────────────────────────── */}
        <div style={{
          border: "1.5px dashed #d9770640", borderRadius: 14,
          padding: "16px 16px 12px", marginBottom: 16,
          background: "linear-gradient(135deg,#110A00 0%,#09090E 100%)",
        }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: "#d97706", letterSpacing: "0.16em", marginBottom: 14, textTransform: "uppercase" }}>
            Ambiente de Cliente
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              {
                label: "OAXACA ESTADO", sublabel: "Servidores del cliente",
                dot: "#f59e0b", glow: "#f59e0b", border: "#d9770630",
                topLine: "#d97706",
                systems: [
                  { name: "SIR Lite Multas", tag: "prod" },
                  { name: "Proxy → backend", tag: "config" },
                  { name: "Monitoreo",       tag: "config" },
                ],
                note: "WAF + DNS configurados por SIGOB. Infraestructura propia del cliente, aparte del resto",
              },
            ].map(node => (
              <div key={node.label} style={{
                background: `linear-gradient(135deg,${T.surface},${T.card})`,
                border: `1px solid ${node.border}`,
                borderRadius: 12, padding: "14px 16px",
                position: "relative", overflow: "hidden",
                boxShadow: `0 0 20px ${node.glow}08`,
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${node.topLine},transparent)` }} />
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: node.dot, boxShadow: `0 0 6px ${node.dot}` }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: T.text1, letterSpacing: "0.06em" }}>{node.label}</span>
                </div>
                <div style={{ fontSize: 9, color: T.text3, marginBottom: 10 }}>{node.sublabel}</div>
                {node.systems.map(s => (
                  <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: T.text1 }}>{s.name}</span>
                    <span style={{ fontSize: 7, padding: "1px 6px", borderRadius: 20,
                      background: s.tag === "prod" ? "#14532d" : s.tag === "qa" ? "#1e3a8a" : s.tag === "dev" ? "#312e81" : "#1c1917",
                      color:      s.tag === "prod" ? "#4ade80" : s.tag === "qa" ? "#93c5fd" : s.tag === "dev" ? "#a5b4fc" : "#a8a29e",
                    }}>{s.tag}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 9, color: T.text3, lineHeight: 1.4, borderTop: `1px solid ${node.border}`, paddingTop: 8 }}>
                  {node.note}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ZONA: SALIENDO ────────────────────────────────────────── */}
        <div style={{
          border: "1.5px dashed #ef444440", borderRadius: 14,
          padding: "14px 16px",
          background: "linear-gradient(135deg,#180808 0%,#09090E 100%)",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: "#ef4444", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Saliendo
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: huaweiDone.size === HUAWEI_STEPS.length ? "#4ade80" : "#fca5a5" }}>
              {huaweiDone.size === HUAWEI_STEPS.length ? "✓ APAGADO COMPLETO" : `${huaweiDone.size}/${HUAWEI_STEPS.length} apagados`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#1A0808", border: "1px solid #ef444430",
              borderRadius: 10, padding: "8px 14px", marginRight: 4,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5", letterSpacing: "0.06em" }}>HUAWEI CLOUD</span>
            </div>
            {HUAWEI_STEPS.map(step => {
              const done = huaweiDone.has(step.id);
              return (
                <div key={step.id} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: done ? "#0D1A0E" : "#1A0A0A",
                  border: `1px solid ${done ? "#16a34a40" : "#7f1d1d50"}`,
                  borderRadius: 8, padding: "6px 12px",
                  transition: "all 0.25s",
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: done ? "#4ade80" : "#fca5a5", textDecoration: done ? "line-through" : "none" }}>
                    {done ? "✓" : "○"} {step.sistema}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SERVICIOS TRANSVERSALES ───────────────────────────────── */}
        <div style={{
          padding: "12px 16px", background: T.surface, borderRadius: 10,
          border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 8, color: T.text3, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginRight: 6 }}>
            Transversal
          </span>
          {[
            { label: "DNS migob.mx",  sub: "VPN pendiente" },
            { label: "VPN",           sub: "activar en VPS" },
            { label: "Monitoreo",     sub: "Oaxaca Estado" },
            { label: "Contabo CDN",   sub: "estrategia buckets" },
            { label: "CI/CD",         sub: "ramas por proyecto" },
          ].map(s => (
            <span key={s.label} style={{
              fontSize: 10, padding: "4px 10px", borderRadius: 20,
              background: T.hover, color: T.text2,
              border: `1px solid ${T.borderLt}`, display: "flex", gap: 5,
            }}>
              {s.label}
              <span style={{ color: T.text3 }}>· {s.sub}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── TAREAS A NO PERDER DE VISTA (en vivo) ───────────────────────── */}
      <div style={section(20)}>
        <div style={sectionLabel(T.gold)}>
          <span style={{ width: 3, height: 14, background: T.gold, borderRadius: 2, display: "inline-block" }} />
          Tareas a no perder de vista
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 22 }}>

          {/* Esta semana */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a16207", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#d4a017" }}>Esta semana</span>
              <span style={{ fontSize: 10, color: T.text3 }}>{weekTasks.length}</span>
            </div>
            {weekTasks.length === 0
              ? <div style={{ fontSize: 11, color: T.text3, padding: "8px 0" }}>Sin tareas marcadas para esta semana.</div>
              : weekTasks.map(taskRow)}
          </div>

          {/* Urgentes / Alta prioridad / Importantes */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f87171" }}>Urgentes · Alta prioridad · Importantes</span>
              <span style={{ fontSize: 10, color: T.text3 }}>{prioTasks.length}</span>
            </div>
            {prioTasks.length === 0
              ? <div style={{ fontSize: 11, color: T.text3, padding: "8px 0" }}>Sin tareas urgentes ni prioritarias.</div>
              : prioTasks.map(taskRow)}
          </div>

        </div>
      </div>

    </div>
  );
}
