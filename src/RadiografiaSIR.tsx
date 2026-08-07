/**
 * RadiografiaSIR — visión completa del SIR Plus.
 *
 * No es seguimiento de tareas: no lleva fechas, avances ni estados de Zoho.
 * Responde cuatro preguntas para poder definir la arquitectura:
 *
 *   1. Qué es el SIR Plus
 *   2. Cuáles son sus procesos más críticos
 *   3. Qué NO tiene y sí debe tener        (brechas funcionales)
 *   4. Qué debemos asegurarnos de que tenga (verificaciones)
 *
 * Más la deuda técnica que no debería heredar del portal actual.
 *
 * Comparte almacén de estado con el panel del inicio (SirPlusPanel): los puntos
 * de "asegurarnos" usan los mismos identificadores, así que marcarlos aquí los
 * marca allá.
 */

import { useState } from "react";
import { CAPAS, idsDeCapa, idsDeNodo, type Capa, type Nodo } from "./sirPlusCapas";
import ListaChecks from "./SirPlusNodo";
import {
  ESTADOS, CICLO, estadoDe, resumirEstados, useSirPlusEstado,
  type EstadoKey, type EstadoMap,
} from "./sirPlusEstado";

const T = {
  pageBg: "#09090C", card: "#0F1117", surface: "#14161E", hover: "#1A1D28",
  border: "#1E2233", borderLt: "#272B40",
  text1: "#E8E3D8", text2: "#7A7F9A", text3: "#3E4260",
  gold: "#C9A84C", goldDim: "#8A6E2F",
};

// ── 1 · La cadena de dependencia ──────────────────────────────────────────────
const CADENA = [
  { n: 1, nombre: "Ley de Ingresos", que: "Define las reglas: qué se cobra, cuánto y bajo qué condiciones.", dep: "No depende de nadie — es la base de todo lo demás.", color: "#818CF8" },
  { n: 2, nombre: "Padrones",        que: "El quién y el qué: contribuyentes, empresas, predios, vehículos, permisos.", dep: "Depende de Ley de Ingresos, para saber qué le aplica a cada uno.", color: "#2DD4BF" },
  { n: 3, nombre: "Trámites",        que: "El proceso: alta, baja, cambio, refrendo, licencias.", dep: "Depende de Padrones (a quién se tramita) y de Ley de Ingresos (cuánto cobrar).", color: "#F59E0B" },
  { n: 4, nombre: "Caja",            que: "El cobro y el recibo, presencial o en línea.", dep: "Depende de las tres anteriores: adeudos, cálculo y origen del cobro.", color: "#22C55E" },
];

// ── 1 · Los tres canales ──────────────────────────────────────────────────────
interface ModuloRad { nombre: string; que: string; ojo: string }
interface CanalRad { id: string; nombre: string; alias?: string; sub: string; color: string; quien: string; modulos: ModuloRad[] }

const CANALES: CanalRad[] = [
  {
    id: "admin", nombre: "ADMIN", sub: "Back-office de recaudación", color: "#C9A84C",
    quien: "Personal de la Secretaría de Finanzas: cajeros, jefaturas, administradores y área de sistemas.",
    modulos: [
      { nombre: "Ley de Ingresos", que: "Periodo fiscal vigente, tipos de cargo, tarifas por tramos, recargos, gastos, descuentos, actualizaciones y alertas. El tipo de cargo es la regla central: define la fórmula, el padrón al que aplica y todos sus accesorios.", ojo: "Es donde más se rompe el sistema en producción. Cada regla necesita casos de prueba con resultado esperado, validados por el cliente." },
      { nombre: "Padrones", que: "Contribuyente, empresa, predio, vehículo, motocicleta, remolque, el padrón genérico con sus catorce variantes (alcoholes, hospedaje, nómina, notario…) e infracciones.", ojo: "Buena parte de la información del padrón solo debe cambiar mediante un trámite, porque está ligada a cargos, convenios, órdenes y recibos." },
      { nombre: "Caja y cortes", que: "Consulta del contribuyente por RFC, CURP o clave; adeudo con o sin recálculo; orden de pago con referencias por institución; cobro con métodos combinables; corte del cajero.", ojo: "Sin corte abierto no hay cobro. Todo lo cobrado debe cuadrar contra depósitos bancarios y contra el reporte contable." },
      { nombre: "Cartera", que: "El saldo vivo: cargos, recargos, actualizaciones, gastos y descuentos contra recibos y abonos, con y sin convenio.", ojo: "El adeudo debe ser idéntico en los tres canales, en el mismo momento." },
      { nombre: "Usuarios, roles y permisos", que: "Quién entra y qué puede hacer, hasta el nivel de tipo de movimiento por padrón.", ojo: "Cada acción de seguridad debe quedar registrada en auditoría." },
      { nombre: "Auditoría", que: "Bitácora de movimientos de padrones, catálogos y cartera: tabla, registro, estado anterior y posterior, usuario y momento.", ojo: "Es lo que permite responder ante una diferencia de dinero. Debe ser inalterable desde la aplicación." },
      { nombre: "Inventarios", que: "Placas vehiculares y formas valoradas, asignadas por unidad recaudadora y por usuario, con su pago correspondiente.", ojo: "Requiere conciliación física contra sistema, con responsable nombrado." },
      { nombre: "PAE — ejecución fiscal", que: "Requerimientos, vigilancia de obligaciones y cartera vencida.", ojo: "El formato del requerimiento necesita validación jurídica del cliente." },
      { nombre: "Reporteador y BI", que: "Reportes de ingresos, cortes, padrones y tableros de dirección.", ojo: "Los reportes pesados no deben competir con la ventanilla: ejecutarlos contra réplica de lectura." },
    ],
  },
  {
    id: "portal", nombre: "PORTAL FINANCIERO", alias: "Ventanilla Única", sub: "Canal ciudadano", color: "#22C55E",
    quien: "La ciudadanía y las empresas del estado, sin intermediación de ventanilla. Es el mismo canal que en Nayarit se publica como Ventanilla Única: sus siete servicios son estos módulos.",
    modulos: [
      { nombre: "Trámites (entrada ciudadana)", que: "Catálogo de plantillas con búsqueda y filtros por dependencia, tipo y canal. Cada resultado resuelve su botón según la plantilla: puede llevar a Pagos si en realidad es un cobro, al asistente si admite canal en línea, o a Citas si exige agendar.", ojo: "Es la puerta de RETYS vista desde el ciudadano: el mismo motor, distinta piel. No deben divergir." },
      { nombre: "Pagos — consulta de adeudos", que: "Búsqueda por tipo de padrón con el monto vigente ya calculado con recargos, reutilizando el mismo modelo de cálculo que usa Trámites. La portada se arma desde un catálogo de clasificadores de tipos de cargo.", ojo: "El monto que ve el ciudadano debe coincidir con el de Caja, al centavo." },
      { nombre: "Orden de pago y línea de captura", que: "Agrupa varios cargos sueltos bajo una sola referencia bancaria, pagable en línea, en banco o en tienda de conveniencia.", ojo: "Probar una referencia por cada convenio bancario contratado, y el recálculo al vencer." },
      { nombre: "Pago en línea", que: "Cobro con tarjeta a través de la pasarela.", ojo: "El punto de mayor riesgo del canal. Hoy la integración depende del DOM — ver la sección de deuda técnica." },
      { nombre: "Convenios y parcialidades", que: "Divide un adeudo en parcialidades, filtra los cargos no saldados y da seguimiento a cada abono contra el mismo folio.", ojo: "Anticipo, calendario y saldo pendiente deben reflejarse igual en admin y en portal." },
      { nombre: "Facturación electrónica", que: "Genera el CFDI de un recibo ya emitido, capturando RFC, uso de comprobante, régimen fiscal y método de pago.", ojo: "Timbrado probado en cada ambiente, incluida la cancelación del comprobante." },
      { nombre: "Citas", que: "Asistente de tres pasos con calendario de disponibilidad por día, que reutiliza el motor de requisitos de Trámites. Se invoca también desde dentro del asistente de trámites cuando un paso lo requiere.", ojo: "Hay citas condicionadas a que exista una orden de pago ya pagada. Definir esa regla para Jalisco." },
      { nombre: "Quejas", que: "Internamente «protesta ciudadana»: cubre consultas, sugerencias y quejas. Asistente de cuatro pasos con evidencia adjunta y señalamiento opcional de servidor público. Admite registro anónimo.", ojo: "Vive en un dominio de backend propio, distinto del de pagos y trámites." },
      { nombre: "Oficinas", que: "Directorio geolocalizado con mapa y agrupación por unidad responsable.", ojo: "Hoy el listado se arma paginando hasta agotar resultados porque no hay endpoint de listado completo." },
      { nombre: "Cuenta del contribuyente", que: "Expediente digital: datos, vehículos, establecimientos, obligaciones, constancias, declaraciones e historial. Acceso por código enviado a RFC, CURP, celular o correo — sin contraseña fija.", ojo: "El menú se habilita solo si el registro está Activo. Un contribuyente solo puede ver lo suyo: probarlo explícitamente." },
      { nombre: "Contenido institucional", que: "Normateca, noticias, aviso de privacidad y guía del portal. Los PDF los genera un servicio de reporteador aparte del API principal.", ojo: "Necesita responsable nombrado que lo mantenga vigente." },
    ],
  },
  {
    id: "retys", nombre: "RETYS", sub: "Motor de trámites y servicios", color: "#F43F5E",
    quien: "El motor que resuelve el trámite, consumido tanto por el personal como por el ciudadano desde el portal.",
    modulos: [
      { nombre: "GPM — motor genérico", que: "El módulo más grande. Motor configurable por plantillas: los mismos componentes sirven para predios, empresas, licencias, alcoholes, hospedaje, nómina o comercio, según configuración y no según código distinto. Cerca de 20 tipos de paso y unos 30 tipos de padrón.", ojo: "Un trámite nuevo debe poderse configurar sin programar. Documentar la plantilla de cada trámite de Jalisco." },
      { nombre: "Cálculo de cargos del trámite", que: "El paso de cargos calcula el cobro por captura manual, monto fijo, tarifa, fórmula, múltiplo, porcentaje o función en servidor, y puede generar la referencia o entregar el trámite a Pagos.", ojo: "Cada forma de cálculo falla distinto: casos de prueba por cada una." },
      { nombre: "Trámites vehiculares", que: "Alta con asignación de placa, baja con liberación, cambio de propietario y refrendo, con variantes por tipo de vehículo y de propietario.", ojo: "Hoy el asistente vehicular está condicionado a la entidad Nayarit. Para Jalisco debe migrar al motor configurable." },
      { nombre: "Requisitos y documentos", que: "Ficha de requisitos, costo y tiempo de resolución; carga documental en orden; firma electrónica donde aplica.", ojo: "El documento emitido debe ser verificable por un tercero." },
      { nombre: "Bitácora del trámite", que: "Cada transición de paso queda registrada con comentarios y archivos adjuntos.", ojo: "Definir si esta bitácora se unifica con el módulo de auditoría o convive con él, y cuál manda en una investigación." },
    ],
  },
];

// ── 2 · Procesos más críticos ─────────────────────────────────────────────────
interface ProcesoCritico {
  nombre: string;
  flujo: string;
  porque: string;
  rompe: string;
  nivel: "vital" | "alto";
}

const PROCESOS: ProcesoCritico[] = [
  {
    nombre: "Cálculo del adeudo",
    nivel: "vital",
    flujo: "Regla configurada → cargo generado → recargos, actualizaciones, gastos y descuentos → monto a pagar",
    porque: "Todo lo demás hereda su resultado. Si el adeudo está mal, están mal el portal, la ventanilla, el recibo, el reporte y la contabilidad — y el error se descubre semanas después, al cuadrar.",
    rompe: "Reglas mal configuradas en los límites de un tramo de tarifa; recargos calculados sobre base equivocada; descuentos aplicados a padrones que no corresponden; periodo fiscal no vigente.",
  },
  {
    nombre: "Cobro en ventanilla y corte de caja",
    nivel: "vital",
    flujo: "Abrir corte → consultar contribuyente → seleccionar cargos → método(s) de pago → confirmar → recibo → cerrar y cuadrar turno",
    porque: "Es dinero en efectivo con una persona responsable. Si el corte no cuadra, hay un faltante que alguien tiene que explicar.",
    rompe: "Cobros sin corte abierto; pagos mixtos mal sumados; recibos emitidos dos veces; cancelaciones que no regresan el cargo a la cartera.",
  },
  {
    nombre: "Orden de pago y línea de captura",
    nivel: "vital",
    flujo: "Selección de cargos → orden con referencia por institución → pago en banco, tienda o en línea → aplicación automática",
    porque: "Es el puente entre el sistema y el banco. Una referencia mal formada se paga pero no se aplica, y el ciudadano queda debiendo algo que ya pagó.",
    rompe: "Referencia que no cumple el formato del convenio bancario; desglose distinto entre la orden generada y la reimpresa; monto recalculado después de emitida.",
  },
  {
    nombre: "Pago en línea",
    nivel: "vital",
    flujo: "Ciudadano paga con tarjeta → pasarela confirma → sistema aplica el cobro → emite recibo",
    porque: "Es el único proceso donde entra dinero sin que haya una persona de la institución presente. Si se pierde una confirmación, nadie se entera hasta la conciliación.",
    rompe: "Confirmación duplicada del proveedor que genera dos recibos; transacción interrumpida a medias; recibo con importe distinto al cobrado; validación hecha en el navegador en vez del servidor.",
  },
  {
    nombre: "Conciliación y cuadre contable",
    nivel: "vital",
    flujo: "Lo cobrado en el sistema → contra depósitos bancarios → contra reporte de la pasarela → contra póliza contable",
    porque: "Es la prueba de que el sistema dice la verdad. Sin cuadre diario, los descuadres se acumulan y luego hay que reconstruir meses hacia atrás.",
    rompe: "Criterios distintos de fecha entre reportes; pagos externos aplicados dos veces; cancelaciones no reflejadas; recibos en línea ausentes de la póliza.",
  },
  {
    nombre: "Trámite de principio a fin",
    nivel: "alto",
    flujo: "Requisitos → validación contra padrón → pasos de la plantilla → generación y cobro de cargos → documento o constancia",
    porque: "Es el proceso que el ciudadano percibe como «el gobierno». Un trámite que se atora obliga a ir a la oficina y anula el valor del portal.",
    rompe: "Requisitos que no se visualizan tras cargarlos; pasos con configuración de otra entidad; cancelación sin regla clara sobre los cargos ya generados.",
  },
  {
    nombre: "Alta y refrendo vehicular con asignación de placa",
    nivel: "alto",
    flujo: "Propietario → vehículo → cargos → cobro → trámite → tarjeta de circulación → placa asignada desde inventario",
    porque: "Es de los mayores volúmenes de recaudación del año y toca inventario físico: una placa asignada sin existencia o sin pago es un descuadre material, no solo contable.",
    rompe: "Descuentos de un tipo de vehículo aplicados a otro; errores al generar la tarjeta de circulación; asignación de placa sin verificar inventario ni pago.",
  },
  {
    nombre: "Actualización masiva de cartera",
    nivel: "alto",
    flujo: "Publicación de UMA anual o INPC mensual → recálculo del importe base de los cargos → cartera actualizada",
    porque: "Toca toda la cartera de una sola vez. Si sale mal, el error no es de un contribuyente: es de todos, y hay que revertirlo con respaldo.",
    rompe: "Ejecución en horario de operación; falta de respaldo previo; ausencia de cuadre posterior; proceso sin punto de reversa.",
  },
  {
    nombre: "Migración de datos del cliente",
    nivel: "alto",
    flujo: "Tablas fuente del sistema anterior → mapeo → carga → cuadre de totales y saldos → corte y congelamiento del origen",
    porque: "Es un proceso de una sola oportunidad. Un saldo que llegó mal en la migración se arrastra durante años y contamina toda la cobranza.",
    rompe: "Mapeo incompleto de campos; duplicados de contribuyente; saldos que no cuadran contra el origen; ausencia de ensayo previo y de plan de reversa.",
  },
];

// ── 3 · Qué NO tiene y sí debe tener (brechas) ────────────────────────────────
interface Brecha { id: string; titulo: string; que: string; tipo: string }

const BRECHAS: { grupo: string; nota: string; items: Brecha[] }[] = [
  {
    grupo: "Padrones que no existen",
    nota: "Cuatro padrones de Jalisco que hoy no están en el sistema. Cada uno tiene identificada su tabla fuente en el sistema del cliente.",
    items: [
      { id: "brecha.estacionometros", tipo: "Padrón", titulo: "Estacionómetros", que: "Padrón nuevo. Tabla fuente del cliente: estacionometros." },
      { id: "brecha.multas", tipo: "Padrón", titulo: "Multas administrativas no fiscales", que: "Federales y estatales. Tabla fuente del cliente: multanofisc." },
      { id: "brecha.hipotecas", tipo: "Padrón", titulo: "Hipotecas", que: "Padrón nuevo. Tabla fuente del cliente: hipoteca." },
      { id: "brecha.billetes", tipo: "Padrón", titulo: "Billetes de depósito", que: "Padrón nuevo. Tabla fuente del cliente: pdrcertdep." },
    ],
  },
  {
    grupo: "Módulos que hay que construir",
    nota: "Funcionalidad que el SIR Plus necesita y que hoy no existe como tal.",
    items: [
      { id: "sis.retys.gpm.declaraciones", tipo: "Módulo", titulo: "Declaraciones empresariales", que: "Módulo de control documental de declaraciones, con el mismo estilo que los trámites GPM." },
      { id: "sis.retys.vehicular.gpm", tipo: "Módulo", titulo: "Trámites vehiculares dentro de GPM", que: "Llevar vehículos, motos, remolques y los padrones vehiculares que surjan al motor configurable, en vez del asistente fijo condicionado a otra entidad." },
      { id: "sis.admin.inventarios.placas", tipo: "Módulo", titulo: "Inventario y asignación de placas", que: "Alta y baja de placas en inventario, asignado por unidad recaudadora y por usuario, con asignación al vehículo mediante el pago correspondiente." },
      { id: "sis.admin.inventarios.formas", tipo: "Módulo", titulo: "Inventario de formas valoradas", que: "Mismo esquema que placas, para los documentos de imprenta asignables a contribuyente, vehículo o empresa." },
      { id: "sis.portal.servicios.citas", tipo: "Módulo", titulo: "Citas", que: "Agenda de atención con requisitos previos, confirmación y cancelación, invocable también desde dentro de un trámite." },
      { id: "sis.admin.bi.coordinados", tipo: "Módulo", titulo: "Ingresos coordinados", que: "Reglas de participación y reporte de distribución de ingresos coordinados." },
      { id: "sec.auditoria.log", tipo: "Módulo", titulo: "Auditoría y log de movimientos", que: "Bitácora de todos los movimientos sobre padrones, catálogos y cartera: tabla afectada, registro, estado anterior y posterior, usuario y momento." },
      { id: "sis.admin.padrones.movimientos", tipo: "Mecanismo", titulo: "Control detallado de CRUD por padrón", que: "Catálogo configurador de tipos de movimiento por padrón, que permita o bloquee cambios a campos específicos y registre cada cambio en auditoría." },
      { id: "sis.admin.ley.uma", tipo: "Capacidad", titulo: "Actualización masiva de cartera", que: "Recálculo del importe base de los cargos al publicarse la UMA anual y el INPC mensual." },
      { id: "sec.identidad.mfa", tipo: "Capacidad", titulo: "Autenticación en dos pasos", que: "Segundo factor para usuarios administrativos." },
      { id: "sis.admin.pae.personalizacion", tipo: "Ajuste", titulo: "PAE con personalización de Jalisco", que: "Emisión de requerimientos y vigilancia de obligaciones conforme a la normativa estatal. Tabla fuente del cliente: notificacion." },
      { id: "sis.admin.bi.tableros", tipo: "Configuración", titulo: "BI y tableros", que: "Configuración de inteligencia de negocio y tableros de dirección para Jalisco." },
    ],
  },
];

// ── 4 · Qué debemos asegurarnos que tenga (verificaciones) ────────────────────
interface Asegurar { id: string; titulo: string; que: string; origen: string }

const ASEGURAR: { grupo: string; nota: string; items: Asegurar[] }[] = [
  {
    grupo: "Modelo de contribuyente",
    nota: "Cambios de fondo sobre lo que ya existe. Tocan todos los canales a la vez.",
    items: [
      { id: "sis.admin.padrones.contribuyente", origen: "JAL-SIR+", titulo: "Solo Contribuyente, sin Ciudadano", que: "Quitar todas las funcionalidades y referencias a la tabla de Ciudadano en todos los canales. Ojo: una bandera global decide hoy entre ciudadano y contribuyente, y la usan trámites, citas, quejas y cuenta al mismo tiempo." },
      { id: "sis.admin.padrones.considerado", origen: "JAL-SIR+ · aplica a todos", titulo: "Contribuyente considerado (jubilado, pensionado)", que: "Que todos los padrones puedan relacionarse a un contribuyente considerado, en todos los canales y catálogos que usan esa relación: tipos de cargo, recargo, gasto, actualización y descuento." },
    ],
  },
  {
    grupo: "Cartera y cobro",
    nota: "El corazón del sistema. Aquí es donde históricamente aparecen los descuadres.",
    items: [
      { id: "sis.admin.cartera.persistencia", origen: "JAL-SIR+", titulo: "Cartera calculada y persistida correctamente", que: "Que adeudos —cargos, recargos, actualizaciones, gastos y descuentos— se calculen bien y se actualicen al generar y cancelar pagos, exista o no convenio." },
      { id: "sis.transversal.pendientes.registro_pagos", origen: "aplica a todos", titulo: "Registro de pagos con el desglose de la orden", que: "Mostrar los cargos persistidos en la orden y no los cargos reales, para que los totales presentados cuadren con la orden consultada." },
      { id: "sis.transversal.pendientes.reimpresion", origen: "aplica a todos", titulo: "Reimpresión consistente de la orden de pago", que: "Que al reimprimir se muestren los recargos y el estatus saldado real." },
      { id: "sis.transversal.pendientes.validaciones", origen: "aplica a todos", titulo: "Validaciones integrales antes de persistir", que: "Impedir el procesamiento de órdenes de pago y estados de cuenta con datos inconsistentes, no solo los errores superficiales." },
      { id: "sis.transversal.pendientes.bloqueo_cargos", origen: "aplica a todos", titulo: "Bloqueo de cargos con origen propio", que: "En el módulo de cargos, bloquear los que provienen de trámites, infracciones y declaraciones empresariales." },
    ],
  },
  {
    grupo: "Seguridad y trazabilidad",
    nota: "Lo que permite responder «quién hizo qué» cuando aparezca una diferencia.",
    items: [
      { id: "sec.identidad.permisos_post", origen: "JAL-SIR+", titulo: "Alta de permisos habilitada", que: "El endpoint de permisos hoy solo permite consulta; falta habilitar el alta." },
      { id: "sec.identidad.roles", origen: "JAL-SIR+", titulo: "Usuarios, roles y permisos navegables", que: "Control intuitivo de alta y asignación. Los permisos deben crearse automáticamente al agregar una funcionalidad o reporte, dar soporte al control detallado de CRUD y registrar cada acción de seguridad en auditoría." },
      { id: "sis.transversal.pendientes.auditoria_ep", origen: "aplica a todos", titulo: "Endpoints mapeados con su acción auditable", que: "Poder responder quién y cuándo cambió propietarios de un predio, importes de cargo, pasos de un trámite o la configuración de un tipo de cargo, y quién reimprimió una orden." },
      { id: "sis.transversal.pendientes.bitacora", origen: "aplica a todos", titulo: "Bitácora que no crezca sin control", que: "Revisar el endpoint de descuentos, que consume espacio excesivo en bitácora, y definir política de niveles y retención." },
    ],
  },
];

// ── Deuda técnica heredada ────────────────────────────────────────────────────
const DEUDA = [
  { t: "El cobro con tarjeta depende del DOM", g: "Crítico",
    d: "El script de la pasarela se inyecta en el HTML base y expone un botón oculto con atributos data-* que el flujo llena por código y dispara con un clic programático. Un observador de mutaciones vigila cuándo aparece el bloque de «pago exitoso» para confirmar, y el resultado se guarda en localStorage para que otro script lo lea. Cualquier cambio de maquetado del proveedor rompe el cobro sin dar error." },
  { t: "Configuración de otra entidad viva en el código", g: "Alto",
    d: "El paso GIS depende de una configuración geográfica que solo existe para Ciudad Juárez, y el asistente vehicular no aparece si la instalación no es Nayarit. Para Jalisco hay que revisar todas las condiciones escritas por nombre de entidad y convertirlas en configuración." },
  { t: "Una bandera global decide ciudadano o contribuyente", g: "Alto",
    d: "La usan trámites, citas, quejas y cuenta al mismo tiempo. Es exactamente el mecanismo que toca «Solo Contribuyente»: hay que rastrear todos sus usos antes de eliminar la figura de Ciudadano, o se rompen cuatro módulos a la vez." },
  { t: "Identificadores y módulos fijos en código", g: "Medio",
    d: "Cuando el contribuyente está apenas «Ingresado», el portal lo manda a completar un trámite con identificador escrito fijo. Buzón y protestas existen en el código pero están deshabilitados: hay que decidir por módulo si se habilita, se completa o se retira." },
  { t: "Listados que paginan hasta agotar resultados", g: "Medio",
    d: "El listado de oficinas se arma pidiendo página tras página porque no existe un endpoint de listado completo. Crece en tiempo y memoria conforme crece el catálogo; hay que revisar dónde más ocurre." },
  { t: "Bitácoras paralelas por módulo", g: "Medio",
    d: "Trámites y citas registran su propio historial aparte del registro principal. Hay que definir si esas bitácoras se unifican con el módulo de auditoría de SIR Plus o conviven, y cuál manda en una investigación." },
];

// ── Preguntas abiertas ────────────────────────────────────────────────────────
const PREGUNTAS_ABIERTAS = [
  "¿Sobre qué infraestructura corre Jalisco hoy — VPS propio, servidor del cliente o nube — y con qué recursos?",
  "¿Existe réplica de base de datos y respaldo probado para Jalisco, o solo para las entidades ya productivas?",
  "¿SIR Plus se construye sobre la base de código actual o es una reescritura?",
  "¿Quién es la contraparte jurídica del cliente para validar el tratamiento de datos personales y el formato de los requerimientos del PAE?",
  "¿Qué convenios bancarios y qué pasarela de pago tendrá Jalisco? ¿Los mismos que Nayarit u otros?",
  "¿La integración de pago se rehace o se hereda tal como está?",
];

// ── Piezas ────────────────────────────────────────────────────────────────────

function Punto({ estado, size = 9 }: { estado: EstadoKey; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: ESTADOS[estado].color, display: "inline-block", flexShrink: 0 }} />;
}

function ChipEstado({ estado, onClick }: { estado: EstadoKey; onClick: () => void }) {
  const m = ESTADOS[estado];
  return (
    <button onClick={onClick} title={`${m.label} — ${m.desc}. Clic para cambiar.`}
      style={{
        display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
        background: m.bg, border: `1px solid ${m.color}55`, borderRadius: 20,
        padding: "2px 9px", color: m.color, fontSize: 9, fontWeight: 700,
        whiteSpace: "nowrap", flexShrink: 0, fontFamily: "system-ui,sans-serif",
      }}>
      <Punto estado={estado} size={6} />
      {m.label}
    </button>
  );
}

function contarPorEstado(map: EstadoMap, ids: string[]) {
  const base = { sin_verificar: 0, riesgo: 0, parcial: 0, proceso: 0, ok: 0, na: 0 } as Record<EstadoKey, number>;
  ids.forEach(id => { base[estadoDe(map, id)] += 1; });
  return base;
}

/** Barra que resume la mezcla de estados de un conjunto de puntos. */
function Mezcla({ ids, map }: { ids: string[]; map: EstadoMap }) {
  const c = contarPorEstado(map, ids);
  if (!ids.length) return null;
  return (
    <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: "#0B0D14" }}>
      {CICLO.filter(e => c[e] > 0).map(e => (
        <div key={e} title={`${ESTADOS[e].label}: ${c[e]}`}
          style={{ width: `${(c[e] / ids.length) * 100}%`, background: ESTADOS[e].color, opacity: e === "sin_verificar" ? 0.3 : 0.9 }} />
      ))}
    </div>
  );
}

// ── Capa desplegable: sus grupos, sus nodos y los puntos de cada nodo ──────────

interface CapaDesplegableProps {
  capa: Capa;
  map: EstadoMap;
  onCiclar: (id: string) => void;
  onActualizar: (id: string, cambios: { evidencia?: string; resp?: string; estado?: EstadoKey }) => void;
}

function CapaDesplegable({ capa, map, onCiclar, onActualizar }: CapaDesplegableProps) {
  const [abierta, setAbierta] = useState(false);
  const [nodoAbierto, setNodoAbierto] = useState<string | null>(null);

  const ids = idsDeCapa(capa);
  const c = contarPorEstado(map, ids);
  const resumen = resumirEstados(ids.map(id => estadoDe(map, id)));
  const pct = ids.length ? Math.round(((c.ok + c.na) / ids.length) * 100) : 0;

  return (
    <div style={{
      background: `linear-gradient(160deg, ${capa.color}10 0%, ${T.surface} 60%)`,
      border: `1px solid ${capa.color}40`,
      borderTop: `3px solid ${capa.color}`,
      borderRadius: 12, overflow: "hidden",
      gridColumn: abierta ? "1 / -1" : "auto",
    }}>
      {/* Cabecera */}
      <button
        onClick={() => setAbierta(a => !a)}
        aria-expanded={abierta}
        style={{
          width: "100%", textAlign: "left", cursor: "pointer", background: "none",
          border: "none", padding: "15px 16px", fontFamily: "system-ui,sans-serif",
          display: "block",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Punto estado={resumen} />
          <span style={{ fontSize: 14, fontWeight: 800, color: T.text1, flex: 1 }}>{capa.nombre}</span>
          <span style={{
            fontSize: 10, color: capa.color, fontWeight: 700,
            border: `1px solid ${capa.color}44`, borderRadius: 7, padding: "3px 9px", whiteSpace: "nowrap",
          }}>
            {abierta ? "▾ Cerrar" : "▸ Ver los puntos"}
          </span>
        </div>
        <div style={{ fontSize: 10, color: capa.color, marginBottom: 10, fontWeight: 600 }}>{capa.sub}</div>
        <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.55, marginBottom: 12, minHeight: abierta ? 0 : 46 }}>
          {capa.descripcion}
        </div>
        <Mezcla ids={ids} map={map} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.text3, marginTop: 8 }}>
          <span>{ids.length} puntos a considerar · {capa.grupos.length} bloques</span>
          <span style={{ color: pct > 0 ? "#22C55E" : T.text3, fontWeight: 700 }}>{pct}%</span>
        </div>
      </button>

      {/* Contenido */}
      {abierta && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${capa.color}25` }}>
          {capa.grupos.map(grupo => (
            <div key={grupo.id} style={{ marginTop: 16 }}>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
                color: T.text3, marginBottom: 9, display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: capa.color, display: "inline-block" }} />
                {grupo.nombre}
              </div>

              {grupo.nodos.map((nodo: Nodo) => {
                const nIds = idsDeNodo(nodo);
                const nResumen = resumirEstados(nIds.map(id => estadoDe(map, id)));
                const nc = contarPorEstado(map, nIds);
                const expandido = nodoAbierto === nodo.id;
                return (
                  <div key={nodo.id} style={{
                    background: expandido ? "#0B0D14" : T.card,
                    border: `1px solid ${nResumen === "sin_verificar" ? T.border : ESTADOS[nResumen].color + "35"}`,
                    borderRadius: 10, marginBottom: 7, overflow: "hidden",
                  }}>
                    <button
                      onClick={() => setNodoAbierto(expandido ? null : nodo.id)}
                      aria-expanded={expandido}
                      style={{
                        width: "100%", textAlign: "left", cursor: "pointer", background: "none",
                        border: "none", padding: "12px 14px", fontFamily: "system-ui,sans-serif",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                        <Punto estado={nResumen} size={8} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text1, flex: 1, minWidth: 160 }}>{nodo.nombre}</span>
                        <span style={{ fontSize: 9.5, color: T.text3, whiteSpace: "nowrap" }}>
                          {nc.ok + nc.na}/{nIds.length} resueltos
                        </span>
                        <span style={{ fontSize: 11, color: T.text3 }}>{expandido ? "▾" : "▸"}</span>
                      </div>
                      {!expandido && (
                        <div style={{ fontSize: 10, color: T.text2, lineHeight: 1.5, marginTop: 6 }}>{nodo.resumen}</div>
                      )}
                    </button>

                    {expandido && (
                      <div style={{ padding: "0 14px 14px" }}>
                        <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.6, marginBottom: 10 }}>{nodo.resumen}</div>
                        {nodo.pregunta && (
                          <div style={{
                            padding: "9px 12px", background: T.surface, marginBottom: 12,
                            borderLeft: `3px solid ${capa.color}`, borderRadius: "0 8px 8px 0",
                            fontSize: 11.5, color: T.text1, fontWeight: 600, lineHeight: 1.45,
                          }}>
                            {nodo.pregunta}
                          </div>
                        )}
                        <ListaChecks nodo={nodo} map={map} onCiclar={onCiclar} onActualizar={onActualizar} fondo={T.surface} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

interface RadiografiaSIRProps {
  onIrAlPanel?: () => void;
}

export default function RadiografiaSIR({ onIrAlPanel }: RadiografiaSIRProps = {}) {
  const { map, ciclar, actualizar } = useSirPlusEstado();

  const seccion = (mb = 20): React.CSSProperties => ({
    background: `linear-gradient(160deg, ${T.card} 0%, #12141C 100%)`,
    border: `1px solid ${T.border}`, borderRadius: 16,
    padding: "22px 24px", marginBottom: mb,
    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
  });

  const etiqueta = (color = T.text3): React.CSSProperties => ({
    fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
    color, marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
  });

  const totalBrechas  = BRECHAS.reduce((n, g) => n + g.items.length, 0);
  const totalAsegurar = ASEGURAR.reduce((n, g) => n + g.items.length, 0);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: T.text1, padding: "28px 28px 60px", background: T.pageBg, minHeight: "100%" }}>

      {/* ── Encabezado ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: T.goldDim, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
          SIGOB · Proyecto Jalisco
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: 10 }}>
          Radiografía del SIR Plus
        </div>
        <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.7, maxWidth: 880 }}>
          El Sistema Integral de Recaudación es el sistema con el que un gobierno estatal cobra: define sus reglas
          fiscales, registra a quién y qué puede cobrar, procesa los trámites que generan esos cobros y recibe el
          dinero, en ventanilla o en línea. <strong style={{ color: T.text1 }}>SIR Plus</strong> es su versión
          remasterizada para Jalisco, con tres canales: ADMIN, Portal Financiero — que es lo mismo que Ventanilla
          Única — y RETYS.
        </div>

        {/* Índice de lo que responde esta página */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 20 }}>
          {[
            { n: "01", t: "Qué es el SIR Plus", d: "Los tres canales, sus módulos y cómo dependen entre sí", c: "#818CF8" },
            { n: "02", t: "Procesos más críticos", d: "Dónde se juega el dinero y qué los rompe", c: "#EF4444" },
            { n: "03", t: "Qué no tiene y debe tener", d: `${totalBrechas} brechas funcionales por construir`, c: "#F59E0B" },
            { n: "04", t: "Qué asegurarnos que tenga", d: `${totalAsegurar} puntos a verificar en la nueva versión`, c: "#22C55E" },
          ].map(x => (
            <div key={x.n} style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${x.c}`, borderRadius: 10, padding: "13px 15px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: x.c, marginBottom: 6, letterSpacing: "0.08em" }}>{x.n}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text1, marginBottom: 4, lineHeight: 1.3 }}>{x.t}</div>
              <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.5 }}>{x.d}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.6, maxWidth: 880, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          Armada con la Guía Funcional OPENSIR y la Documentación de Procesos del Sistema (elaboradas desde el código
          fuente), la referencia técnica de módulos del portal, el alcance publicado de Ventanilla Única y los
          requerimientos registrados para Jalisco. Todo esto es insumo para definir la arquitectura: lo que no está
          respaldado por esas fuentes va marcado como recomendación, y lo que no pude confirmar está al final.
        </div>
      </div>

      {/* ══ 01 · QUÉ ES ═══════════════════════════════════════════════════ */}

      <div style={seccion()}>
        <div style={etiqueta("#818CF8")}>
          <span style={{ width: 3, height: 14, background: "#818CF8", borderRadius: 2, display: "inline-block" }} />
          01 · Cómo encajan las piezas
        </div>
        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.7, marginBottom: 18, maxWidth: 840 }}>
          El orden importa: primero se configura la regla de cobro, luego se identifica a quién o a qué aplica, después
          se sigue el proceso del trámite y al final se cobra. Si una capa está mal configurada, todo lo que viene
          después hereda el error — y por eso los descuadres casi siempre nacen arriba, no en la caja.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          {CADENA.map((p, i) => (
            <div key={p.n} style={{ position: "relative" }}>
              <div style={{
                background: T.surface, border: `1px solid ${p.color}35`,
                borderTop: `2px solid ${p.color}`, borderRadius: 12,
                padding: "16px 16px 14px", height: "100%",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%", background: p.color + "22",
                    border: `1px solid ${p.color}66`, color: p.color, fontSize: 10, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{p.n}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.text1 }}>{p.nombre}</span>
                </div>
                <div style={{ fontSize: 11, color: T.text1, lineHeight: 1.55, marginBottom: 9 }}>{p.que}</div>
                <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.5, paddingTop: 9, borderTop: `1px solid ${T.border}` }}>{p.dep}</div>
              </div>
              {i < CADENA.length - 1 && (
                <span aria-hidden style={{ position: "absolute", right: -12, top: "50%", transform: "translateY(-50%)", color: T.text3, fontSize: 14, zIndex: 1 }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={seccion()}>
        <div style={etiqueta(T.gold)}>
          <span style={{ width: 3, height: 14, background: T.gold, borderRadius: 2, display: "inline-block" }} />
          01 · Los tres canales y sus módulos
        </div>
        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.7, marginBottom: 18, maxWidth: 840 }}>
          Los tres consumen las mismas reglas y los mismos padrones. La regla de oro del sistema: el mismo
          contribuyente, el mismo día, debe ver el mismo adeudo en los tres. Cuando eso deja de cumplirse aparecen las
          diferencias que después hay que cuadrar a mano.
        </div>

        {CANALES.map(canal => (
          <div key={canal.id} style={{ marginBottom: 20 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              background: `linear-gradient(100deg, ${canal.color}14 0%, ${T.surface} 60%)`,
              border: `1px solid ${canal.color}35`, borderLeft: `3px solid ${canal.color}`,
              borderRadius: 12, padding: "13px 16px", marginBottom: 10,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: T.text1, letterSpacing: "0.02em" }}>{canal.nombre}</span>
              {canal.alias && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: canal.color,
                  background: canal.color + "18", border: `1px solid ${canal.color}44`,
                  borderRadius: 20, padding: "2px 10px",
                }}>
                  = {canal.alias}
                </span>
              )}
              <span style={{ fontSize: 10.5, color: canal.color, fontWeight: 600 }}>{canal.sub}</span>
              <span style={{ fontSize: 10, color: T.text3, marginLeft: "auto" }}>{canal.modulos.length} módulos</span>
              <span style={{ fontSize: 10.5, color: T.text2, width: "100%", lineHeight: 1.55 }}>{canal.quien}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
              {canal.modulos.map(m => (
                <div key={m.nombre} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "13px 15px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text1, marginBottom: 7 }}>{m.nombre}</div>
                  <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.6, marginBottom: 9 }}>{m.que}</div>
                  <div style={{
                    fontSize: 10, color: canal.color, lineHeight: 1.55,
                    background: canal.color + "0D", borderLeft: `2px solid ${canal.color}55`,
                    borderRadius: "0 6px 6px 0", padding: "7px 9px",
                  }}>
                    <strong style={{ letterSpacing: "0.04em" }}>OJO: </strong>{m.ojo}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ══ 02 · PROCESOS CRÍTICOS ════════════════════════════════════════ */}

      <div style={seccion()}>
        <div style={etiqueta("#F87171")}>
          <span style={{ width: 3, height: 14, background: "#EF4444", borderRadius: 2, display: "inline-block" }} />
          02 · Procesos más críticos
        </div>
        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.7, marginBottom: 18, maxWidth: 840 }}>
          No todos los procesos pesan igual. Estos son los que, si fallan, se traducen en dinero mal cobrado, dinero
          perdido o un cierre contable que no cuadra. Son los que deben tener pruebas propias, monitoreo propio y
          responsable nombrado.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
          {PROCESOS.map(p => {
            const clr = p.nivel === "vital" ? "#EF4444" : "#F59E0B";
            return (
              <div key={p.nombre} style={{
                background: p.nivel === "vital" ? "linear-gradient(160deg,#1A0A0A 0%,#12141C 70%)" : T.surface,
                border: `1px solid ${clr}35`, borderLeft: `3px solid ${clr}`,
                borderRadius: "0 12px 12px 0", padding: "15px 17px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.text1, flex: 1, minWidth: 160, lineHeight: 1.3 }}>{p.nombre}</span>
                  <span style={{
                    fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: clr, border: `1px solid ${clr}55`, borderRadius: 20, padding: "2px 8px",
                  }}>
                    {p.nivel === "vital" ? "Vital" : "Alto"}
                  </span>
                </div>

                <div style={{
                  fontSize: 10, color: T.text2, lineHeight: 1.6, fontFamily: "ui-monospace, monospace",
                  background: "#0B0D14", border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: "8px 10px", marginBottom: 11,
                }}>
                  {p.flujo}
                </div>

                <div style={{ fontSize: 10.5, color: T.text1, lineHeight: 1.6, marginBottom: 10 }}>
                  <span style={{ color: T.text3, fontWeight: 700, letterSpacing: "0.04em" }}>POR QUÉ IMPORTA · </span>
                  {p.porque}
                </div>

                <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.6, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                  <span style={{ color: clr, fontWeight: 700, letterSpacing: "0.04em" }}>QUÉ LO ROMPE · </span>
                  {p.rompe}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ 03 · QUÉ NO TIENE Y DEBE TENER ════════════════════════════════ */}

      <div style={seccion()}>
        <div style={etiqueta("#FBBF24")}>
          <span style={{ width: 3, height: 14, background: "#F59E0B", borderRadius: 2, display: "inline-block" }} />
          03 · Qué NO tiene el SIR Plus que SÍ debe tener
        </div>
        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.7, marginBottom: 18, maxWidth: 840 }}>
          Brechas funcionales: piezas que hoy no existen en el sistema y que Jalisco necesita. Definen alcance de
          construcción, no de verificación — cada una es un módulo, un padrón o una capacidad que hay que diseñar
          desde cero.
        </div>

        {BRECHAS.map(g => (
          <div key={g.grupo} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#FBBF24", letterSpacing: "0.06em", textTransform: "uppercase" }}>{g.grupo}</span>
              <span style={{ fontSize: 10, color: T.text3 }}>{g.items.length}</span>
            </div>
            <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.6, marginBottom: 11, maxWidth: 760 }}>{g.nota}</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 9 }}>
              {g.items.map(b => {
                const est = estadoDe(map, b.id);
                return (
                  <div key={b.id} style={{
                    background: est === "sin_verificar" ? T.surface : ESTADOS[est].bg,
                    border: `1px dashed ${est === "sin_verificar" ? "#3A3520" : ESTADOS[est].color + "45"}`,
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text1, flex: 1, minWidth: 150, lineHeight: 1.35 }}>{b.titulo}</span>
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: "#FBBF24", border: "1px solid #F59E0B44", borderRadius: 20, padding: "1px 7px", letterSpacing: "0.04em" }}>{b.tipo}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.6, marginBottom: 9 }}>{b.que}</div>
                    <ChipEstado estado={est} onClick={() => ciclar(b.id)} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ══ 04 · QUÉ ASEGURARNOS QUE TENGA ════════════════════════════════ */}

      <div style={seccion()}>
        <div style={etiqueta("#4ADE80")}>
          <span style={{ width: 3, height: 14, background: "#22C55E", borderRadius: 2, display: "inline-block" }} />
          04 · Qué debemos asegurarnos que el SIR Plus tenga
        </div>
        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.7, marginBottom: 18, maxWidth: 840 }}>
          Esto ya existe de alguna forma, o se corrigió en otra entidad. No hay que construirlo: hay que
          <strong style={{ color: T.text1 }}> comprobar que la versión nueva lo tenga bien</strong>. Marcar un punto
          aquí lo marca también en el panel del inicio.
        </div>

        {ASEGURAR.map(g => (
          <div key={g.grupo} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#4ADE80", letterSpacing: "0.06em", textTransform: "uppercase" }}>{g.grupo}</span>
              <span style={{ fontSize: 10, color: T.text3 }}>{g.items.length}</span>
            </div>
            <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.6, marginBottom: 11, maxWidth: 760 }}>{g.nota}</div>

            {g.items.map(a => {
              const est = estadoDe(map, a.id);
              return (
                <div key={a.id} style={{
                  background: est === "sin_verificar" ? T.surface : ESTADOS[est].bg,
                  border: `1px solid ${est === "sin_verificar" ? T.border : ESTADOS[est].color + "35"}`,
                  borderRadius: 10, padding: "12px 14px", marginBottom: 7,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text1, flex: 1, minWidth: 200, lineHeight: 1.4 }}>{a.titulo}</span>
                    <span style={{ fontSize: 8.5, color: T.text3, border: `1px solid ${T.borderLt}`, borderRadius: 20, padding: "1px 8px", whiteSpace: "nowrap" }}>{a.origen}</span>
                    <ChipEstado estado={est} onClick={() => ciclar(a.id)} />
                  </div>
                  <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.65 }}>{a.que}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ══ DEUDA TÉCNICA ═════════════════════════════════════════════════ */}

      <div style={seccion()}>
        <div style={etiqueta("#F59E0B")}>
          <span style={{ width: 3, height: 14, background: "#F59E0B", borderRadius: 2, display: "inline-block" }} />
          Deuda técnica que SIR Plus no debería heredar
        </div>
        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.7, marginBottom: 16, maxWidth: 840 }}>
          Sale de la referencia técnica de los módulos del portal actual. No son opiniones: son comportamientos del
          código en operación. Cada uno tiene su punto correspondiente en la capa Sistema del panel del inicio.
        </div>
        {DEUDA.map(h => (
          <div key={h.t} style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${h.g === "Crítico" ? "#EF4444" : h.g === "Alto" ? "#F59E0B" : "#64748B"}`,
            borderRadius: "0 10px 10px 0", padding: "12px 15px", marginBottom: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text1, flex: 1, minWidth: 200 }}>{h.t}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                color: h.g === "Crítico" ? "#EF4444" : h.g === "Alto" ? "#F59E0B" : "#94A3B8",
                border: `1px solid ${h.g === "Crítico" ? "#EF4444" : h.g === "Alto" ? "#F59E0B" : "#64748B"}55`,
              }}>{h.g}</span>
            </div>
            <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.65 }}>{h.d}</div>
          </div>
        ))}
      </div>

      {/* ══ QUÉ CONSIDERAR — LAS CUATRO CAPAS ═════════════════════════════ */}

      <div style={seccion()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ ...etiqueta("#0EA5E9"), marginBottom: 0 }}>
            <span style={{ width: 3, height: 14, background: "#0EA5E9", borderRadius: 2, display: "inline-block" }} />
            Qué debemos considerar — las cuatro capas
          </div>
          {onIrAlPanel && (
            <button onClick={onIrAlPanel} style={{
              background: "transparent", border: `1px solid ${T.gold}55`, borderRadius: 8,
              padding: "4px 12px", fontSize: 10, fontWeight: 600, color: T.gold,
              cursor: "pointer", fontFamily: "system-ui,sans-serif",
            }}>
              Abrir el panel interactivo →
            </button>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.7, marginBottom: 16, maxWidth: 840 }}>
          El sistema no vive solo: se sostiene sobre infraestructura, sobre la forma en que el código llega a
          producción y sobre las decisiones de seguridad y datos personales. Estas cuatro capas son el índice de todo
          lo que hay que considerar para armar la arquitectura. Abre una capa para ver sus bloques, y un bloque para
          leer punto por punto qué hay que reforzar y con qué se comprueba — se pueden marcar aquí mismo.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, alignItems: "start" }}>
          {CAPAS.map(capa => (
            <CapaDesplegable key={capa.id} capa={capa} map={map} onCiclar={ciclar} onActualizar={actualizar} />
          ))}
        </div>
      </div>

      {/* ══ PREGUNTAS ABIERTAS ════════════════════════════════════════════ */}

      <div style={seccion(0)}>
        <div style={etiqueta("#A78BFA")}>
          <span style={{ width: 3, height: 14, background: "#7C3AED", borderRadius: 2, display: "inline-block" }} />
          Lo que no pude confirmar
        </div>
        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.7, marginBottom: 14, maxWidth: 840 }}>
          Con la documentación disponible alcanza para describir el sistema, pero no para afirmar cómo está montado
          hoy Jalisco. Estas preguntas hay que responderlas antes de cerrar la arquitectura:
        </div>
        {PREGUNTAS_ABIERTAS.map((q, i) => (
          <div key={i} style={{
            display: "flex", gap: 10, alignItems: "flex-start",
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 6,
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#A78BFA", flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontSize: 11.5, color: T.text1, lineHeight: 1.55 }}>{q}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
