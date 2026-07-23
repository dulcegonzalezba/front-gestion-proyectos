import { storage } from "./storage";
import { useState, useEffect, useRef, CSSProperties } from "react";
import { useNavigate } from 'react-router-dom';
import { clearToken, getToken, getRole } from './auth';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import AppHeader from './AppHeader';
import PdfTemplate from './PdfTemplate';
import DashboardTab from './DashboardTab';
import SplitLayout from './SplitLayout';
import HomePage from './HomePage';
import AcuerdosTab from './AcuerdosTab';
import LiberacionesTab from './LiberacionesTab';
import PersonalTab from './PersonalTab';
import CheckpointTimeline from './CheckpointTimeline';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

const S = {
  URGENTE:            { l:"Urgente",           c:"#ef4444" },
  BLOQUEADO:          { l:"Bloqueado",         c:"#7f1d1d" },
  BLOQUEANTE:         { l:"Bloqueante",        c:"#991b1b" },
  IMPORTANTE:         { l:"Importante",        c:"#c2410c" },
  PRIORITARIO:        { l:"Prioritario",       c:"#b91c1c" },
  PENDIENTE:          { l:"Pendiente",         c:"#f87171" },
  REVISAR:            { l:"Revisar",           c:"#e11d48" },
  ALTA_PRIORIDAD:     { l:"Alta prioridad",    c:"#ca8a04" },
  ESTA_SEMANA:        { l:"Esta semana",       c:"#a16207" },
  PENDIENTE_ANTERIOR: { l:"Pend. anterior",    c:"#d97706" },
  POSIBLE:            { l:"Posible",           c:"#92400e" },
  ESTIMACION:         { l:"Estimacion req.",   c:"#d97706" },
  ACTIVO:             { l:"Activo",            c:"#2563eb" },
  EN_CURSO:           { l:"En curso",          c:"#1d4ed8" },
  SEGUIMIENTO:        { l:"Seguimiento",       c:"#3b82f6" },
  COORDINADO:         { l:"Coordinado",        c:"#60a5fa" },
  PAUSADO:            { l:"Pausado",           c:"#9ca3af" },
  COMPLETADO:         { l:"Completado",        c:"#16a34a" },
  POR_PLANEAR:        { l:"Por planear",       c:"#7c3aed" },
  BANDERA_AMARILLA:   { l:"Bandera amarilla",  c:"#b45309" },
  LISTO_PROD:         { l:"Listo para prod",   c:"#0f766e" },
  NO_INICIADA:        { l:"No iniciada",       c:"#475569" },
  ARCHIVADO:          { l:"Archivado",         c:"#334155" },
};

const CELL_CLR = {
  "DBA":"#0ea5e9","DevOps":"#8b5cf6","Backend SIR":"#f59e0b",
  "Frontend SIR":"#ec4899","Nuevas Tec":"#10b981",
  "Reporteador Nayarit":"#64748b","Multi-celula":"#f97316"
};
// Paleta para colorear células creadas por el usuario (las nuevas no están en CELL_CLR)
const CELL_PALETTE = ["#0ea5e9","#8b5cf6","#f59e0b","#ec4899","#10b981","#f97316","#ef4444","#14b8a6","#a855f7","#64748b"];
const ISSUE_STATUS_CLR = {
  "Pendiente":"#ef4444","En proceso":"#f59e0b",
  "Pruebas internas":"#d97706","Listo":"#16a34a","Completado":"#6b7280"
};
const ISSUE_PRIO_CLR = {
  "Critico":"#dc2626","Alta":"#f59e0b","Media":"#3b82f6","Baja":"#64748b"
};

const mk = (id,title,resp,status,notes,zoho) =>
  ({id,title,resp,status,notes:notes||"",zoho:zoho||""});

// ── PLAN DE ESTABILIZACION NAYARIT ─────────────────────────
const NAY_PLAN = [

  {id:"np_be2",celula:"Backend SIR",resp:"Paolo Payan",status:"COMPLETADO",
    title:"Pagos externos — se procesan pero incorrectamente",
    zoho:"https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036001176"},
  {id:"np_be3",celula:"Backend SIR",resp:"Paolo Payan",status:"EN_CURSO",
    title:"Recibos por pago en linea salen con cantidad incorrecta",
    zoho:"https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035926044"},
  {id:"np_be4",celula:"Backend SIR",resp:"Erick Villa",status:"LISTO_PROD",
    title:"NABO-T17: Al actualizar datos borra nombre del contribuyente",zoho:""},
  {id:"np_fe1",celula:"Frontend SIR",resp:"Mario Merel",status:"COMPLETADO",
    title:"Calculo incorrecto de recargos y actualizaciones; multa no aparece en vista previa",
    zoho:"https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036146175"},
  {id:"np_fe2",celula:"Frontend SIR",resp:"Mario Merel",status:"PAUSADO",
    title:"No sale linea de captura Convenio Netpay con tiendas de conveniencia",
    zoho:"https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036162196"},

  {id:"np_dba1",celula:"DBA",resp:"Raul",status:"EN_CURSO",
    title:"Corregir BD marzo para cuadrar contabilidad",zoho:""},
  {id:"np_dba2",celula:"DBA",resp:"Abril + Raul",status:"PENDIENTE",
    title:"Corregir mes en curso (abril) y meses anteriores hasta enero + anos anteriores",zoho:""},
  {id:"np_dba3",celula:"DBA",resp:"DBA / Haniel + Raul",status:"EN_CURSO",
    title:"Reproducir casos de prueba para que desarrollo corrija descuadres en codigo",zoho:""},
];

const INIT = {
  week:"27 de Abril al 2 de Mayo de 2026",
  nay_plan: NAY_PLAN,
  focus:[
    {id:"F1",title:"TLAJOMULCO — PRIORIDAD #1 | Funcionalidades requeridas",resp:"Paolo + Mario + Alfonso",cell:"Multi-celula",status:"ESTA_SEMANA",notes:"Prioridad activa Backend + Frontend + DevOps. Monitorear lista de funcionalidades en cada sesion."},
    {id:"F2",title:"Migracion de Juarez — CERRAR",resp:"Abril (a cargo de Haniel)",cell:"DBA",status:"ESTA_SEMANA",notes:"Abril ejecuta, coordinada por Haniel. Debe cerrarse esta semana."},
    {id:"F3",title:"Plan de Estabilizacion Nayarit 2026",resp:"Paolo + Mario + Raul + Erick Villa",cell:"Backend + Frontend + DBA",status:"URGENTE",notes:"Meet 3 veces por semana. Issues de Zoho requieren cierre puntual."},
    {id:"F4",title:"PLAN DE MIGRACION DE NUBE — Meta: Mayo 2026",resp:"Dulce Gonzalez + Miguel Angel + Alfonso",cell:"DevOps / Direccion",status:"ESTA_SEMANA",notes:"Navojoa → Curiosity esta semana. Cotizacion servidor integral. Jalisco instalacion. Ver roadmap."},
    {id:"F5",title:"APP ALERTAS NAYARIT — Terminar y segmentar envios",resp:"Francisco Alegria",cell:"Nuevas Tec",status:"BANDERA_AMARILLA",notes:"Falta terminar app y segmentar geograficamente los envios. Ver posibilidad de cerrar esta semana."},
    {id:"F6",title:"NAY: Descuentos/actualizaciones motos en vehiculos — VERIFICAR",resp:"Paolo + Mario + Raul",cell:"Backend SIR",status:"SEGUIMIENTO",notes:"No debe ocurrir desde 8 de abril. Confirmar corregido en produccion."},
  ],
  cells:{
    "DevOps":{ leader:"Miguel Angel / Alfonso", members:[], tasks:[
      mk("dm1","Instalar ambiente PROD iPROVINAY","Miguel Angel","COMPLETADO","",""),
      mk("dm2","Instalar PROD NAVOJOA en CURIOSITY","Miguel Angel","EN_CURSO","CERRAR ESTA SEMANA. Prerequisito para plan de migracion de nube.",""),
      mk("dm3","OAXACA ESTADO SIR LITE MULTAS — Instalacion en servidores del cliente","Miguel Angel","COMPLETADO","Termina aprox 21 abril. Siguiente: configuracion WAF y DNS.",""),
      mk("dm4","Actualizar version Reporteador Navojoa en Produccion","Miguel Angel","COMPLETADO","",""),
      mk("dm5","NAYARIT — Switch de repositorios: apuntar nuevo repo a produccion","Miguel Angel","PAUSADO","",""),
      mk("dm6","Planear manejo de archivos bucket — pruebas y produccion","Miguel Angel","POR_PLANEAR","Ya tienen configurado Contabo. Definir estrategia.",""),
      mk("dm7","Uniformizar nomenclatura de DNS","Miguel Angel","EN_CURSO","Esquema: sir/api-sir/retys/reporteador/portal/bi — entidad — ambiente",""),
      mk("dm8","Plan distribucion de sistemas — VPS sobrepoblado","Miguel Angel","URGENTE","Ver PMO.",""),
      mk("da2","TLAJOMULCO — Robustecer seguridad y ampliar servidores","Alfonso","EN_CURSO","",""),
      mk("da3","Pasar sistema de Egresos a su propio VPS","Alfonso","POR_PLANEAR","Parte del plan de distribucion de sistemas.",""),
      mk("da4","VDS — Produccion Tlajomulco","Alfonso","POR_PLANEAR","",""),
      mk("da5","Activar VPN en VPS","Alfonso","PENDIENTE_ANTERIOR","",""),
      mk("da7","OAXACA ESTADO — Instalacion de monitoreo de servidores","Alfonso","PENDIENTE","",""),
      mk("da6","JALISCO — Instalacion de ambiente completo con librerias actualizadas (Python, Django)","Alfonso","URGENTE","CERRAR ESTA SEMANA. Frontend y Backend con librerias al dia. Primer paso del Plan de Salida Jalisco.",""),
      mk("da8","NAVOJOA — Envio de recursos para servidor integral (SIR + EGRESOS + OOMAPAS) a Curiosity","Alfonso + Miguel Angel","URGENTE","Enviar specs para que Curiosity cotice servidor que soporte ecosistema completo de Navojoa.",""),
      mk("da9","iPROVINAY — Ordenar ramas en repositorio exclusivo","Paolo + Mario + Miguel Angel","ESTA_SEMANA","Backend y Frontend deben tener repo exclusivo iPROVINAY con su propio juego de ramas.",""),
    ]},
    "DBA":{ leader:"Haniel Rojo", members:["Abril","Raul"], tasks:[
      mk("dba1","Migracion de Juarez — TERMINAR ESTA SEMANA","Abril (a cargo de Haniel)","ESTA_SEMANA","Solo Abril ejecuta, coordinada por Haniel. Meta: cierre esta semana.",""),
      mk("dba2","REPORTES DEL FAN","Haniel","ESTA_SEMANA","",""),
      mk("dba3","NAYARIT — Corregir BD marzo (Plan Estabilizacion)","Raul","EN_CURSO","Meet 3 veces/semana.",""),
      mk("dba4","NAYARIT — Corregir mes en curso (abril) y meses anteriores hasta enero + revisar anos anteriores","Abril + Raul","PENDIENTE","Post correccion de marzo. Adelantar a Abril para meses anteriores y anos anteriores.",""),
      mk("dba5","NAYARIT — Reproducir casos de prueba para que desarrollo corrija descuadres","Haniel + Raul","ALTA_PRIORIDAD","DBA reproduce los casos para que Backend y Frontend puedan identificar y corregir a nivel codigo.",""),
      mk("dba7","OAXACA MUNICIPIO — Bitacora de Trazabilidad","Haniel","PAUSADO","",""),
      mk("dba8","TLAJOMULCO — Migracion y estabilizacion de datos","Haniel + Raul","COMPLETADO","",""),
      mk("dba9","OAXACA — Numeralia de comercios","Haniel","POSIBLE","Prioridad baja.","https://projects.zoho.com/portal/sigobproyectos#zp/task-detail/106599000035747543"),
      mk("dba10","NAY — Reporte Contribuyentes Declarantes de Nomina","Raul","COMPLETADO","","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032701808"),
      mk("dba11","NAY — Mejoras reporte concentrado de ingresos","Abril","COMPLETADO","","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/tasks/custom-view/106599000021469003/list/task-detail/106599000028015199?group_by=tasklist"),
      mk("dba12","NAY — Reporte baja de placas","Abril + Jose Navarro","PENDIENTE","","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/tasks/custom-view/106599000021469003/list/task-detail/106599000032104922?group_by=tasklist"),
      mk("dba13","NAY — Porcentajes cargos por municipio en ingresos","Raul","PENDIENTE","","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/tasks/custom-view/106599000021469003/list/task-detail/106599000032116497?group_by=tasklist"),
      mk("dba14","NAY: Archivo de descuadre 22-04-2026 — falta para cerrar marzo","Raul + Haniel","URGENTE","Prerequisito para cierre contable de marzo Nayarit.","https://projects.zoho.com/portal/sigobproyectos#zp/task-detail/106599000036190335"),
      mk("dba15","NAY: Descuadres Netpay — archivo compartido para cuadrar marzo","Raul + Haniel","URGENTE","Archivo compartido en Zoho. Parte de actividades cierre marzo.","https://projects.zoho.com/portal/sigobproyectos#zp/task-detail/106599000036187252"),
      mk("nay_dba1","NA1-I1750: NAY: Arreglar folios donde no coincide el total pagado con la consulta del total","Raul Ivan Fragoso Sanchez","PENDIENTE","No iniciado. Prio: Alta. Deadline: 07/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036062083"),
      mk("nay_dba2","NA1-I1737: NAY: Error 400 al generar tarjeta de circulación o imprimir formato de baja en t","Raul Ivan Fragoso Sanchez","PENDIENTE","No iniciado. Prio: Media. Deadline: 24/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035996056"),
      mk("nay_dba3","NA1-I1730: NAY: Recibos generados por pago en linea sale con cantidad incorrecta","Erick Villa","EN_CURSO","En proceso. Prio: Alta. Deadline: 29/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035926044"),
      mk("nay_dba4","NA1-I1723: NAY: Error al emitir un documento (reporteador)","jose navarro","LISTO_PROD","Listo para producción. Prio: Alta. Deadline: 29/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035544782"),
      mk("nay_dba5","NA1-I1715: NAY: PAE: No esta representando correctamente los cargos de la cartera vencida d","Dulce Guadalupe Gonzalez Barradas","PENDIENTE","No iniciado. Prio: Alta. Deadline: 30/06/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035208726"),
      mk("nay_dba6","NA1-I1707: NAY: Tarea programada para reporte 'Sabana de vehiculos por cartera'","jose navarro","PAUSADO","En  pausa. Prio: Crítico. Deadline: 28/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000034805453"),
      mk("nay_dba7","NA1-I1617: NAY: Reporte Relacion de Contribuyentes Declarantes de Nomina","Raul Ivan Fragoso Sanchez","PAUSADO","Pausa desarrollo. Prio: Alta. Deadline: 30/06/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032701808"),
      mk("nay_dba8","NA1-I1616: NAY: Reporte Detalle de Movimientos","Haniel Rojo","PENDIENTE","No iniciado. Prio: Alta. Deadline: 28/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032701779"),
      mk("nay_dba9","NA1-I1615: NAY: Reporte Ordenes Procesadas por Instituciones Bancarias","Haniel Rojo","REVISAR","Ajustes de desarrollo. Prio: Alta. Deadline: 30/06/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032701747"),
      mk("nay_dba10","NA1-I1613: NAY: Reporte Ingresos Coordinados","Haniel Rojo","EN_CURSO","En proceso. Prio: Alta. Deadline: 30/06/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032701673"),
      mk("nay_dba11","NA1-I1612: NAY: Reporte Acumulado de Ingresos por Unidad Recaudadora","Haniel Rojo","EN_CURSO","En proceso. Prio: Alta. Deadline: 30/06/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032701638"),
      mk("nay_dba12","NA1-I1602: NAY: Visualización incorrecta de datos en inscripción al Padrón Estatal para el ","jose navarro","EN_CURSO","En proceso. Prio: Alta. Deadline: 27/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032500203"),
      mk("nay_dba13","NA1-I1583: NAY: Caidas constantes en reporteador luego de actualización","miguel angel ramos luna","REVISAR","Ajustes de desarrollo. Prio: Baja. Deadline: 31/08/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032026494"),
      mk("nay_dba14","NA1-I1568: NAY: Se requiere homologar reportes de acuerdo a la fecha del recibo para que es","jose navarro","PAUSADO","En  pausa. Prio: Alta. Deadline: 27/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000031905033"),
    ]},
    "Backend SIR":{ leader:"Paolo Payan", members:["Erick","Juan Pablo","Montse","Arlethe"], tasks:[
      mk("be1","TLAJOMULCO — PRIORIDAD #1 | Funcionalidades requeridas","Paolo Payan + Mario Merel + Alfonso","ALTA_PRIORIDAD","Prioridad activa en todos los frentes. Monitorear lista de funcionalidades en cada sesion.","https://projects.zoho.com/portal/sigobproyectos#zp/task-detail/106599000033016616"),
      mk("be2","TLAJOMULCO — Requerimientos SIMUN para endpoints de transmision patrimonial","Paolo Payan","COMPLETADO","",""),
      
      mk("be4","NAYARIT — Pagos externos incorrectos","Paolo Payan","COMPLETADO","","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036001176"),
      mk("be5","NAYARIT — Recibos por pago en linea con cantidad incorrecta","Paolo Payan","EN_CURSO","","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035926044"),
      mk("be6","NABO-T17: Al actualizar datos borra nombre del contribuyente","Erick Villa","LISTO_PROD","Listo para subir a produccion.",""),
      mk("be7","OOMAPAS — Revision de tareas activas","Paolo + Mario","ACTIVO","No pausar.",""),
      mk("be8","AUTOPAC — URLs de timbrado","Dulce gestiona","COMPLETADO","URLs gestionadas correctamente.",""),
      mk("be8b","AUTOPAC — Ordenar codigo para evaluar pase a produccion","Paolo Payan + DevOps","ESTA_SEMANA","URLs listas. Ahora ordenar codigo y definir con DevOps en que servidor queda.",""),
      mk("be9","Replicar optimizaciones Tlajomulco en productivos","Paolo Payan","ALTA_PRIORIDAD","Nayarit, Oaxaca, Navojoa.",""),
      mk("nay_be1","NA1-I1758: Filtros a adicionales con objects_with_deleted","Arlethe Mora","EN_CURSO","En proceso. Prio: Alta. Deadline: ","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036186159"),
      mk("nay_be2","NA1-I1753: NAY: Filtro por 'configuracion_de_asignacion_de_placa'","Arlethe Mora","REVISAR","Pruebas internas. Prio: Alta. Deadline: 23/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036095635"),
      mk("nay_be3","NA1-I1751: NAY: Falla intermitente en la generación de recibos en cobros rápidos en SIR Pro","Dulce Guadalupe Gonzalez Barradas","PENDIENTE","No iniciado. Prio: Alta. Deadline: 22/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036066239"),
      mk("nay_be4","NA1-I1748: NAY: Soporte a servicio/recaudacion/recibo/generar-recibo-por-referencia-de-pago","Erick Villa","REVISAR","Pruebas internas. Prio: Alta. Deadline: 30/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036052488"),
      mk("nay_be5","NA1-I1746: NAY: Indexación en campos placa y configuración","Arlethe Mora","LISTO_PROD","Listo para producción. Prio: Alta. Deadline: 24/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036046977"),
      mk("nay_be6","NA1-I1744: NAY: Al momento de procesar pagos externos se generaron dos recibos de una sola ","Erick Villa","LISTO_PROD","Listo para producción. Prio: Alta. Deadline: 06/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036046264"),
      mk("nay_be7","NA1-I1741: NAY: Diferencia en el monto al reimprimir folios de trámites de Wizard de Recaud","Dulce Guadalupe Gonzalez Barradas","PENDIENTE","No iniciado. Prio: Media. Deadline: 24/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036025551"),
      mk("nay_be8","NA1-I1736: NAY: implementación de filtro por Servicio de Vehículo (ID 77) en entorno de pru","Arlethe Mora","REVISAR","Pruebas internas. Prio: Alta. Deadline: 29/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035992076"),
      mk("nay_be9","NA1-I1733: NAY: Falta de información de convenio en padrón de remolques","Juan Pablo Campos","LISTO_PROD","Listo para producción. Prio: Media. Deadline: 29/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035964690"),
      mk("nay_be10","NA1-I1731: NAY: No permite agregar roles a un usuario en el sir","Arlethe Mora","LISTO_PROD","Listo para producción. Prio: Media. Deadline: 29/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035932443"),
      mk("nay_be11","NA1-I1685: NAY: Convenio de motocicleta no se puede cobrar","Erick Villa","LISTO_PROD","Listo para producción. Prio: Baja. Deadline: 28/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000033822884"),
      mk("nay_be12","NA1-I1684: NAY: Visualización incorrecta de recibos al realizar cobros de convenios en SIR ","Juan Pablo Campos","PAUSADO","Pausa operaciones. Prio: Media. Deadline: 28/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000033820354"),
      mk("nay_be13","NA1-I1599: NAY: Error en la generación del acuse de suspensión de actividades para impuesto","Dulce Guadalupe Gonzalez Barradas","PAUSADO","En  pausa. Prio: Alta. Deadline: 05/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032455382"),
      mk("be12","TLAJOMULCO — Funcionalidades requeridas (lista Zoho)","Paolo Payan + Mario Merel","COMPLETADO","Monitoreo constante. Revisar avances y pendientes en cada sesion.","https://projects.zoho.com/portal/sigobproyectos#zp/task-detail/106599000033016616"),
      mk("be10","REPOSITORIOS POR PROYECTO — Cada proyecto su propio repo, comenzar por iPROVINAY","Paolo Payan + Mario Merel","ESTA_SEMANA","Ordenar repositorios. Comenzar por iPROVINAY (mas sencillo) hasta que TODOS tengan su propio repo. Orden: iPROVINAY → Navojoa → Oaxaca → Tlajomulco.",""),
      mk("be11","Navojoa — Caso recibo R-26-043208 (uso interno)","Paolo Payan","SEGUIMIENTO","Coordinar con Erick Villa. No incluir en reportes generales.",""),
    ]},
    "Frontend SIR":{ leader:"Mario Merel", members:["Alfredo","Omar","Julio","German"], tasks:[
      mk("fe1","TLAJOMULCO — PRIORIDAD #1 | Funcionalidades requeridas","Mario Merel","ALTA_PRIORIDAD","Prioridad activa en todos los frentes. Monitorear lista de funcionalidades en cada sesion.","https://projects.zoho.com/portal/sigobproyectos#zp/task-detail/106599000033016616"),
      mk("fe2","NAYARIT — Calculo incorrecto de recargos; multa no aparece en vista previa","Mario Merel","COMPLETADO","","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036146175"),
      mk("fe3","NAYARIT — No sale linea de captura Convenio Netpay","Mario Merel","PAUSADO","","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036162196"),
      
      mk("fe5","OOMAPAS — Revision de tareas activas","Mario Merel","ACTIVO","No pausar.",""),
      mk("fe6","REPUVE — Hoja de verificacion","Equipo Frontend + Karina Monroy","EN_CURSO","Capacitacion a Finanzas realizada. Pidieron cambios. Se aterriza con Karina Monroy estos dias. No estaria esta semana.",""),
      mk("fe8","TLJ: Obtener el valor Referido del Avaluo seleccionado","Mario Merel","COMPLETADO","","https://projects.zoho.com/portal/sigobproyectos#zp/task-detail/106599000036190026"),
      mk("nay_fe1","NA1-I1756: NAY: No esta saliendo la linea de captura de Convenio de Netpay con tiendas de c","julio Huerta","PAUSADO","Pausa desarrollo. Prio: Alta. Deadline: 24/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036162196"),
      mk("nay_fe2","NA1-I1755: NAY: Esta calculando incorrectamente recargos, actualizaciones en el prellenado ","julio Huerta","LISTO_PROD","Listo para producción. Prio: Media. Deadline: 22/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036146175"),
      mk("nay_fe3","NA1-I1745: NAY: No permite hacer búsqueda en contribuyente y ciudadano en Alta de Padrón Al","Alejandro German","REVISAR","Pruebas internas. Prio: Baja. Deadline: 24/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036046327"),
      mk("nay_fe4","NA1-I1743: NAY: Selección automática incorrecta de cargos en Permiso Nuevo Alcoholes","Alfredo Aragón","LISTO_PROD","Listo para producción. Prio: Alta. Deadline: 23/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000036046234"),
      mk("nay_fe5","NA1-I1739: NAY: Permiso Nuevo Alcoholes – En Alta Padrón Alcohol, en campo de búsquedas de ","Alejandro German","LISTO_PROD","Listo para producción. Prio: Media. Deadline: 23/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035996317"),
      mk("nay_fe6","NA1-I1729: NAY: No se pueden hacer pago en linea en el portal de pruebas","Mario Alan Merel Tamayo","PAUSADO","Pausa operaciones. Prio: Alta. Deadline: 29/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035915770"),
      mk("nay_fe7","NA1-I1722: NAY: Error al visualizar Requisitos cargados en digital","Alfredo Aragón","LISTO_PROD","Validación en producción. Prio: Alta. Deadline: 29/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035519945"),
      mk("nay_fe8","NA1-I1721: NAY:FALLA EN EL GUARDADO DE DIRECCIÓN AL REGISTRAR UN NUEVO USUARIO – TRÁMITE PE","Alfredo Aragón","LISTO_PROD","Listo para producción. Prio: Alta. Deadline: 28/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035527201"),
      mk("nay_fe9","NA1-I1717: NAY: Clave  97000113 de un permiso de alcohol le aparece un aduedo incorrecto","Alejandro German","LISTO_PROD","Listo para producción. Prio: Media. Deadline: 30/06/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035417627"),
      mk("nay_fe10","NA1-I1716: NAY: En la captura de los impuestos estatales en el portal estan saliendo recarg","julio Huerta","PAUSADO","Pausa operaciones. Prio: Alta. Deadline: 27/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035218504"),
      mk("nay_fe11","NA1-I1712: NAY: PAE: No arroja ventana para poder imprimir carta invitacion","Alejandro German","LISTO_PROD","Listo para producción. Prio: Alta. Deadline: 30/06/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000035208196"),
      mk("nay_fe12","NA1-I1701: NAY-PRUEBAS: Fallas en el proceso de convenios de alcohol en ambiente de pruebas","julio Huerta","REVISAR","Pruebas con cliente. Prio: Alta. Deadline: 24/04/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000034288490"),
      mk("nay_fe13","NA1-I1668: NAY: Error en generación de órdenes de pago desde Caja (línea de captura y vigen","julio Huerta","LISTO_PROD","Listo para producción. Prio: Media. Deadline: 29/07/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000033664337"),
      mk("nay_fe14","NA1-I1607: NAY: Desaparece la información del formularios al guardar en alta del padrón alc","Alfredo Aragón","LISTO_PROD","Listo para producción. Prio: Media. Deadline: 28/05/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032651423"),
      mk("nay_fe15","NA1-I1606: NAY: Problema al querer almacenar campo de fecha en trámite de alcoholes","Alfredo Aragón","LISTO_PROD","Listo para producción. Prio: Media. Deadline: 30/06/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032652352"),
      mk("nay_fe16","NA1-I1600: NAY: Esta generando otros nombres en ordenes de pago en registro publico","julio Huerta","PAUSADO","En  pausa. Prio: Alta. Deadline: 07/10/2026","https://projects.zoho.com/portal/sigobproyectos#zp/projects/106599000012564540/issue-detail/106599000032500016"),
      mk("fe7","REPOSITORIOS POR PROYECTO — Cada proyecto su propio repo, comenzar por iPROVINAY","Mario Merel + Paolo","ESTA_SEMANA","Ordenar repositorios. Comenzar por iPROVINAY (mas sencillo) hasta que TODOS tengan su propio repo. Orden: iPROVINAY → Navojoa → Oaxaca → Tlajomulco.",""),
    ]},
    "Nuevas Tec":{ leader:"Francisco Alegria", members:["Kevin","J. Alfredo","Jose Ramon","Marco Delgado","Tania"], tasks:[
      mk("nt1","APP ALERTAS NAYARIT — Avances esta semana","Francisco + equipo","BANDERA_AMARILLA","Conexion Backend + OneSignal. Falta segmentar geograficamente los envios. Ver posibilidad de cerrar esta semana.",""),
      mk("nt2","OAXACA ESTADO — Modulo Multas MultApp Lite","Equipo Nuevas Tec","COMPLETADO","",""),
      mk("nt3","SIR LITE — Nueva base de datos","Francisco + Raul","EN_CURSO","Sistema nuevo desde cero.",""),
      mk("nt4","Jalisco Ventanilla Unica — Seguimiento","Jose Ramon","EN_CURSO","",""),
      mk("nt5","SIR LITE — Vulnerabilidades detectadas","Francisco + DevOps","PRIORITARIO","",""),
      mk("nt6","Certificacion MultApp y MultApp Lite — TERMINAR","Francisco Alegria","POSIBLE","Prioridad baja. Cerrar proceso de certificacion pendiente.",""),
      mk("nt7","SIR LITE — Avances primer hito con demo en Backend","Francisco Alegria","ESTA_SEMANA","ESTA SEMANA. Presentar demo funcional de backend. Ver posibilidad de arrancar proyecto en Frontend.",""),
      mk("nt8","APP ALERTAS NAYARIT — Terminar app y segmentar envios geograficamente","Francisco Alegria","ESTA_SEMANA","Falta terminar la app y segmentar geograficamente los envios. Ver posibilidad de cerrar esta semana.",""),
    ]},
    "Reporteador Nayarit":{ leader:"Jose Navarro", members:["Haniel Rojo (DBA)"], tasks:[
      mk("rn1","Reporte Contribuyentes Declarantes de Nomina","Jose + Haniel","SEGUIMIENTO","",""),
      mk("rn2","Mejoras reporte concentrado de ingresos","Jose + Haniel","SEGUIMIENTO","",""),
      mk("rn3","Reporte de baja de placas","Haniel + Jose","SEGUIMIENTO","",""),
      mk("rn4","Porcentajes cargos por municipio","Jose + Haniel","SEGUIMIENTO","",""),
      mk("rn5","Ajustes reportes declaraciones","Jose Navarro","SEGUIMIENTO","",""),
      mk("rn6","Reporte Detalle Impuesto Predial","Jose + Haniel","SEGUIMIENTO","",""),
      mk("rn7","Recibos pago en linea en poliza contable","Jose + Haniel","SEGUIMIENTO","",""),
    ]},
  },
  priorities:[
    {id:"P3",title:"AUTOPAC — Ordenar codigo para produccion",resp:"Paolo Payan + DevOps",cell:"Backend SIR",status:"ESTA_SEMANA",notes:"URLs completadas. Ordenar codigo y definir servidor con DevOps.",zoho:""},
    {id:"P16",title:"API OAXACA ESTADO SIR LITE MULTAS — Monitoreo VPN",resp:"Miguel Angel",cell:"DevOps",status:"COMPLETADO",notes:"VPN de Oaxaca estable. Sin caidas registradas.",zoho:""},
    {id:"N5",title:"Migracion de Juarez — TERMINAR ESTA SEMANA",resp:"Abril (a cargo de Haniel)",cell:"DBA",status:"ESTA_SEMANA",notes:"Solo Abril ejecuta, coordinada por Haniel. Meta: cierre esta semana.",zoho:""},
    {id:"N9",title:"Replicar optimizaciones Tlajomulco en productivos",resp:"Paolo Payan",cell:"Backend SIR",status:"ALTA_PRIORIDAD",notes:"Nayarit, Oaxaca, Navojoa.",zoho:""},
    {id:"P28",title:"NAYARIT — Migracion Mx2 a Productivo",resp:"Miguel Angel + Backend + Frontend + LTS",cell:"Multi-celula",status:"PAUSADO",notes:"Reprogramar cuando los descuadres esten estables.",zoho:"",nextWeek:true},
  ]
};

const PMO_INIT = [
  {id:"pmo_nay_issues",status:"URGENTE",title:"NAYARIT — Cierre puntual de issues abiertos | DBA + Backend + Frontend",
    resp:"Raul (DBA) + Paolo (Backend) + Mario (Frontend)",area:"Nayarit",prioridad:"Cierre puntual — marca personal del equipo",doc:"",zoho:"",
    notes:"══ ANALISIS 43 ISSUES NAYARIT — 22/04/2026 ══\n\nPOR STATUS:\n✅ Listo para prod: 13 — SUBIR A PRODUCCION URGENTE\n🔄 En proceso: 3\n🔬 Pruebas internas: 5\n⏳ Pendiente / No iniciado: 7\n⏸ Pausado: 5\n\nPOR AREA (MAYOR ENFOQUE):\n🔴 BASE DE DATOS: 14 — Haniel + Raul — PRIORIDAD MAXIMA\n🟡 FRONTEND SIR: 16 — Equipo Mario\n🟡 BACKEND SIR: 13 — Equipo Paolo\n\nIssues distribuidos en sus celulas respectivas.\nLos ⚑ en la tabla = BASE DE DATOS.",
    issues:[]},
  {id:"pmo_adeudos",status:"SEGUIMIENTO",title:"Consulta de adeudos — implementar mejoras para que consultas y calculos del portal se hagan por backend",
    resp:"Paolo Payan + Mario Merel",area:"Backend SIR",prioridad:"Importante",doc:"",zoho:"",
    notes:"Mover logica de calculos del frontend al backend para mejorar rendimiento y consistencia del portal.",issues:[]},
  {id:"pmo_ramas_estandar",status:"SEGUIMIENTO",title:"Estandarizacion de ramas por proyecto — cada proyecto debe tener SU PROPIO JUEGO DE RAMAS",
    resp:"Paolo Payan + Mario Merel + Miguel Angel",area:"DevOps",prioridad:"Importante",doc:"",zoho:"",
    notes:"En tiempos libres, estandarizar y documentar ramas por sistema. Ejemplo: iPROVINAY pruebas, a cual rama apunta? Llevar registro claro. Apoyar a Miguel Angel a ajustar configuraciones donde sea necesario.",issues:[]},
  {id:"pmo_vpn_dns",status:"SEGUIMIENTO",title:"VPN y DNS — dejar de exponer dominio migob.mx al publico",
    resp:"Alfonso",area:"DevOps",prioridad:"Alta — Seguridad",doc:"",zoho:"",
    notes:"Coordinar con Alfonso. Por seguridad, migob.mx no debe seguir expuesto. Configurar VPN y DNS correctamente.",issues:[]},
    {id:"pmo_ramas",status:"POR_PLANEAR",title:"Unificacion ramas Dev y Produccion — estrategia de envs",
    resp:"Paolo Payan + Miguel Angel",area:"Arquitectura",prioridad:"Acordar esta semana",doc:"",zoho:"",
    notes:"El bucket se configura diferente para Dev y Produccion. Opciones: variables por contexto, separar bucket con nombres consistentes, servicio de secretos, pipelines que inyecten el env. Ya tienen configurado Contabo.",
    issues:[
      {id:"RR-1",desc:"Mapear proyectos afectados",reportador:"PMO",fecha:"20/04",status:"Pendiente",asignado:"Paolo + Miguel",deadline:"Esta semana",prioridad:"Alta"},
      {id:"RR-2",desc:"Definir estrategia de branching estandar",reportador:"PMO",fecha:"20/04",status:"Pendiente",asignado:"Paolo Payan",deadline:"Esta semana",prioridad:"Critico"},
      {id:"RR-3",desc:"Propuesta de manejo de env",reportador:"PMO",fecha:"20/04",status:"Pendiente",asignado:"Paolo + Miguel",deadline:"Esta semana",prioridad:"Critico"},
      {id:"RR-4",desc:"Documentar acuerdo y comunicarlo al equipo",reportador:"PMO",fecha:"20/04",status:"Pendiente",asignado:"Dulce",deadline:"Post sesion",prioridad:"Alta"},
    ]},
  {id:"pmo_vps",status:"URGENTE",title:"DevOps — Plan de distribucion de sistemas (VPS sobrepoblado)",
    resp:"Alfonso + Miguel Angel",area:"Infraestructura",prioridad:"Definir esta semana",doc:"",zoho:"",
    notes:"VPS actual generando lentitud.\nDistribucion propuesta:\n- VPS 1 Egresos: QA y Dev de Egresos\n- VPS 2 Ingresos QA\n- VPS 3 Ingresos Dev\n- VDS: Produccion Tlajomulco y Nominas Tlajomulco",
    issues:[
      {id:"VPS-1",desc:"Specs VPS Egresos",reportador:"PMO",fecha:"20/04",status:"Pendiente",asignado:"Alfonso",deadline:"Esta semana",prioridad:"Critico"},
      {id:"VPS-2",desc:"Specs VPS Ingresos QA",reportador:"PMO",fecha:"20/04",status:"Pendiente",asignado:"Alfonso",deadline:"Esta semana",prioridad:"Critico"},
      {id:"VPS-3",desc:"Specs VPS Ingresos Dev",reportador:"PMO",fecha:"20/04",status:"Pendiente",asignado:"Alfonso",deadline:"Esta semana",prioridad:"Critico"},
      {id:"VPS-4",desc:"Confirmar VDS Prod Tlajomulco y Nominas",reportador:"PMO",fecha:"20/04",status:"Pendiente",asignado:"Miguel Angel",deadline:"Esta semana",prioridad:"Alta"},
    ]},
  {id:"pmo6",status:"EN_CURSO",title:"SIR LITE — HITO 1: Ambiente, Menu, Seguridad y CRUD Contribuyente",
    resp:"Francisco Alegria + Equipo Nuevas Tec",area:"Oaxaca Estado",prioridad:"Primer hito",doc:"",zoho:"",
    notes:"Entregables: Ambiente estable, Menu, Capa de seguridad, CRUD Contribuyente, Control de auditoria.\nCriterios: Doble factor de autenticacion, usuarios sencillo, trazabilidad con timestamp, bitacora legible.\nNota: SIR Lite es proyecto independiente de Oaxaca Estado SIR Lite Multas.",
    issues:[
      {id:"H1-1",desc:"Ambiente configurado y estable",reportador:"PMO",fecha:"13 abr",status:"Pendiente",asignado:"Alfonso + Francisco",deadline:"Por definir",prioridad:"Critico"},
      {id:"H1-2",desc:"Menu del sistema",reportador:"PMO",fecha:"13 abr",status:"Pendiente",asignado:"Francisco Alegria",deadline:"Por definir",prioridad:"Alta"},
      {id:"H1-3",desc:"Capa de seguridad activa",reportador:"PMO",fecha:"13 abr",status:"Pendiente",asignado:"Francisco Alegria",deadline:"Por definir",prioridad:"Critico"},
      {id:"H1-4",desc:"CRUD de Contribuyente funcional",reportador:"PMO",fecha:"13 abr",status:"Pendiente",asignado:"Equipo Nuevas Tec",deadline:"Por definir",prioridad:"Critico"},
      {id:"H1-5",desc:"Control de auditoria del CRUD",reportador:"PMO",fecha:"13 abr",status:"Pendiente",asignado:"Equipo Nuevas Tec",deadline:"Por definir",prioridad:"Critico"},
      {id:"H1-V1",desc:"Validar: doble factor de autenticacion",reportador:"PMO",fecha:"13 abr",status:"Pendiente",asignado:"Francisco Alegria",deadline:"Por definir",prioridad:"Critico"},
      {id:"H1-V2",desc:"Validar: gestion de usuarios sencilla",reportador:"PMO",fecha:"13 abr",status:"Pendiente",asignado:"Francisco Alegria",deadline:"Por definir",prioridad:"Alta"},
      {id:"H1-V3",desc:"Validar: trazabilidad con usuario y timestamp",reportador:"PMO",fecha:"13 abr",status:"Pendiente",asignado:"Equipo Nuevas Tec",deadline:"Por definir",prioridad:"Critico"},
      {id:"H1-V4",desc:"Validar: bitacora con vistas legibles",reportador:"PMO",fecha:"13 abr",status:"Pendiente",asignado:"Equipo Nuevas Tec",deadline:"Por definir",prioridad:"Alta"},
    ]},
  {id:"pmo5",status:"ESTA_SEMANA",title:"MULTAPP LITE — Observaciones del cliente",
    resp:"Francisco Alegria + Equipo Nuevas Tec",area:"Oaxaca Estado",prioridad:"Atender esta semana",doc:"",zoho:"",
    notes:"P25: Especificar tipo de logs.\nP32: Compartir codigo anti-multi-instancia y agregar evidencia.\nPruebas 16, 20 y 22: Agregar declinaciones o repetir.\nPrueba 21.5: Reimprimir transaccion 21 y validar texto de transaccion reversada.",
    issues:[]},
  {id:"pmo7",status:"EN_CURSO",title:"NAYARIT — Acuerdos reunion PMO (16 de abril)",
    resp:"Raul + Paolo + Mario + Abril",area:"Nayarit",prioridad:"Meet 3 veces/semana",doc:"",zoho:"",
    notes:"Temas abiertos: PAE, Convenios, Almacen de Placas, Descuadres de Recibos.",
    issues:[
      {id:"NAY-A1",desc:"Corregir MARZO en base de datos",reportador:"PMO",fecha:"16/04",status:"En proceso",asignado:"Raul",deadline:"aprox 30/04",prioridad:"Critico"},
      {id:"NAY-A2",desc:"Corregir resto de meses hasta enero",reportador:"PMO",fecha:"16/04",status:"Pendiente",asignado:"Raul",deadline:"Post A1",prioridad:"Alta"},
      {id:"NAY-A3",desc:"Corregir generacion de recibos en codigo",reportador:"PMO",fecha:"16/04",status:"En proceso",asignado:"Paolo / Mario",deadline:"Por definir",prioridad:"Critico"},
      {id:"NAY-A4",desc:"Reporteria de tramites y contabilidad",reportador:"PMO",fecha:"16/04",status:"Pendiente",asignado:"Abril",deadline:"Por definir",prioridad:"Alta"},
      {id:"NAY-T1",desc:"PAE",reportador:"PMO",fecha:"16/04",status:"Pendiente",asignado:"Por asignar",deadline:"Por definir",prioridad:"Alta"},
      {id:"NAY-T2",desc:"Convenios",reportador:"PMO",fecha:"16/04",status:"Pendiente",asignado:"Por asignar",deadline:"Por definir",prioridad:"Alta"},
      {id:"NAY-T3",desc:"Almacen de Placas",reportador:"PMO",fecha:"16/04",status:"Pendiente",asignado:"Por asignar",deadline:"Por definir",prioridad:"Alta"},
      {id:"NAY-T4",desc:"Descuadres de Recibos",reportador:"PMO",fecha:"16/04",status:"En proceso",asignado:"Paolo / Mario",deadline:"Ver A3",prioridad:"Critico"},
    ]},
  {id:"pmo8",status:"REVISAR",title:"NAVOJOA — Caso recibo R-26-043208 (uso interno)",
    resp:"Dulce / Paolo Payan / Erick Villa",area:"Navojoa",prioridad:"Solo Direccion y equipo asignado",doc:"",zoho:"",
    notes:"Informacion restringida. Paolo Payan es responsable directo. Coordinar con Erick Villa.\nSintoma: descuentos en recargos mayores al propio recargo.\nNo incluir en reportes generales hasta tener diagnostico.",
    issues:[
      {id:"NVJ-R1",desc:"Verificar logica de calculo en recibo R-26-043208",reportador:"Direccion",fecha:"16/04",status:"En proceso",asignado:"Paolo Payan + Erick Villa",deadline:"Por definir",prioridad:"Critico"},
      {id:"NVJ-R2",desc:"Determinar si afecta mas recibos del mismo periodo",reportador:"Direccion",fecha:"16/04",status:"Pendiente",asignado:"Paolo + Erick + Haniel",deadline:"Post R1",prioridad:"Critico"},
      {id:"NVJ-R3",desc:"Emitir diagnostico a Direccion",reportador:"Direccion",fecha:"16/04",status:"Pendiente",asignado:"Paolo Payan",deadline:"Post R2",prioridad:"Alta"},
    ]},
  {id:"pmo1",status:"URGENTE",title:"Analisis tecnico — Modulo Gestion de Corralones Oaxaca Estado",
    resp:"Direccion / PMO",area:"Oaxaca Estado",prioridad:"Enviar pronto",
    doc:"ANEXO TECNICO DETALLADO — SIGEDEV-OAX.docx",zoho:"",
    notes:"Revisar documento y preparar analisis de viabilidad para el equipo.",issues:[]},
  {id:"pmo4",status:"PAUSADO",title:"NAYARIT — Migracion Mx2 a Productivo (aplazada)",
    resp:"Miguel Angel + Backend + Frontend + LTS",area:"Nayarit",prioridad:"Reprogramar cuando esten estables",doc:"",zoho:"",
    notes:"Sistemas a migrar: API NAY, Frontend NAY, Portal Financiero, BD, Redis, RETYS, BI, Reporteador.\nPost-migracion: levantar en VPS como entorno de pruebas.",
    issues:[
      {id:"M1",desc:"LTS sube recursos al nuevo ambiente",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Equipo LTS",deadline:"TBD",prioridad:"Critico"},
      {id:"M2",desc:"Miguel configura servicios en Mx2",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Miguel Angel",deadline:"TBD",prioridad:"Critico"},
      {id:"M3",desc:"Migrar Base de Datos",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Haniel + Miguel",deadline:"TBD",prioridad:"Critico"},
      {id:"M4",desc:"Migrar Bucket",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Haniel + Miguel",deadline:"TBD",prioridad:"Critico"},
      {id:"M5",desc:"Cambio DNS",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Miguel Angel",deadline:"TBD",prioridad:"Critico"},
      {id:"M6",desc:"Pruebas Backend y Portal Financiero",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Paolo Payan",deadline:"TBD",prioridad:"Critico"},
      {id:"M7",desc:"Pruebas Frontend",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Mario Merel",deadline:"TBD",prioridad:"Critico"},
      {id:"M8",desc:"Pruebas Reporteador",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Jose Navarro",deadline:"TBD",prioridad:"Alta"},
      {id:"M9",desc:"Verificar estabilidad Redis, RETYS, BI",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Miguel Angel",deadline:"TBD",prioridad:"Critico"},
      {id:"M10",desc:"Go / No-Go",reportador:"PMO",fecha:"TBD",status:"Pendiente",asignado:"Dulce",deadline:"TBD",prioridad:"Critico"},
    ]},
];

const isRed    = s => ["URGENTE","BLOQUEADO","BLOQUEANTE","IMPORTANTE","PRIORITARIO","PENDIENTE","REVISAR"].includes(s);
const isYellow = s => ["ALTA_PRIORIDAD","ESTA_SEMANA","PENDIENTE_ANTERIOR","POSIBLE","ESTIMACION","BANDERA_AMARILLA"].includes(s);
const isBlue   = s => ["ACTIVO","EN_CURSO","SEGUIMIENTO","COORDINADO","LISTO_PROD"].includes(s);

const SK = "sigob:plan21"; // actualizado 22-abr-2026

const CELL_NAMES = ["Todos","DBA","DevOps","Backend SIR","Frontend SIR","Nuevas Tec","Reporteador Nayarit"];

type Project = { id: string; name: string; createdAt: string; taskRefs?: { taskId: string; cellName: string }[] };

type ChecklistItem = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  projectId?: string;
};

type CheckpointSnap = {
  savedAt: string;
  week: string;
  isoWeek: string;
  data: any;
  pmo: any[];
  checklist: ChecklistItem[];
};

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function TaskTypeBadge({ zoho }: { zoho: string }) {
  const isZoho = zoho !== "";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={isZoho ? "Tarea técnica Zoho" : "Tarea PMO"}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: 3, fontSize: 10, fontWeight: 700,
            background: isZoho ? "rgba(59,130,246,0.2)" : "rgba(201,168,76,0.2)",
            color: isZoho ? "#3b82f6" : "#C9A84C",
            cursor: "default", flexShrink: 0,
          }}
        >
          {isZoho ? "Z" : "◆"}
        </span>
      </TooltipTrigger>
      <TooltipContent>{isZoho ? "Tarea técnica Zoho" : "Tarea PMO"}</TooltipContent>
    </Tooltip>
  );
}

export default function App() {
  const navigate = useNavigate();
  function handleLogout() { clearToken(); navigate('/login'); }
  const [d, setD]                       = useState(null);
  const [tab, setTab]                   = useState("home");
  const [loading, setLoading]           = useState(true);
  const [openCell, setOpenCell]         = useState(null);
  const [genLoading, setGenLoading]     = useState(false);
  const [report, setReport]             = useState("");
  const [pmoItems, setPmoItems]         = useState([]);
  const [newPMO, setNewPMO]             = useState(false);
  const [pmoForm, setPmoForm]           = useState({title:"",resp:"",area:"",prioridad:"",doc:"",zoho:"",notes:"",status:"PENDIENTE"});
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [editWeek, setEditWeek]         = useState(false);
  const [weekVal, setWeekVal]           = useState("");
  const [syncLoading, setSyncLoading]   = useState(false);
  const [syncResult, setSyncResult]     = useState("");
  const [lastSync, setLastSync]         = useState("");
  const [addingTask, setAddingTask]     = useState(null);
  const [confirmDel, setConfirmDel]     = useState(null);
  const [taskForm, setTaskForm]         = useState({title:"",resp:"",status:"PENDIENTE",notes:"",zoho:"",projectId:""});
  const [addingCell, setAddingCell]     = useState(false);
  const [cellForm, setCellForm]         = useState({name:"",leader:"",members:"",color:CELL_PALETTE[0]});
  const [editFocusId, setEditFocusId]   = useState(null);
  const [focusForm, setFocusForm]       = useState({title:"",resp:"",cell:"",notes:"",status:""});
  const [selectedCell, setSelectedCell] = useState<string>("Todos");
  const [projects, setProjects]                     = useState<Project[]>([]);
  const [selectedProject, setSelectedProject]       = useState<string>("Todos");
  const [newProjectInput, setNewProjectInput]       = useState("");
  const [creatingProject, setCreatingProject]       = useState(false);
  const [submittingProject, setSubmittingProject]   = useState(false);
  const [associatingCell, setAssociatingCell]               = useState("");
  const [associatingTask, setAssociatingTask]               = useState("");
  const [submittingAssociation, setSubmittingAssociation]   = useState(false);
  const [creatingTaskForProject, setCreatingTaskForProject] = useState(false);
  const [newTaskCell, setNewTaskCell]     = useState("");
  const [newTaskTitle, setNewTaskTitle]   = useState("");
  const [newTaskResp, setNewTaskResp]     = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("PENDIENTE");
  const [seedingProjects, setSeedingProjects] = useState(false);
  const [checklistItems, setChecklistItems]                 = useState<ChecklistItem[]>([]);
  const [checklistCapture, setChecklistCapture]             = useState("");
  const captureInputRef = useRef<HTMLInputElement>(null);
  const [liveIndicatorState, setLiveIndicatorState] = useState<"live"|"saving"|"checkpoint"|"error">("live");
  const [viewingCheckpoint, setViewingCheckpoint]       = useState<CheckpointSnap | null>(null);
  const [pdfGenerating, setPdfGenerating]               = useState(false);
  const [checkpointList, setCheckpointList]             = useState<{ id: number; isoWeek: string; week: string; savedAt: string }[]>([]);
  const [acuerdosFilterWeek, setAcuerdosFilterWeek]     = useState("");
  const [acuerdosFilterStatus, setAcuerdosFilterStatus] = useState("Todos");
  const [userRole]                                      = useState<string | null>(getRole());
  const [libFilterProject, setLibFilterProject]         = useState("Todos");
  const [libFilterStatus, setLibFilterStatus]           = useState("Todos");
  const [personalFilterCelula, setPersonalFilterCelula] = useState("Todos");
  const [personalFilterTipo, setPersonalFilterTipo]     = useState("Todos");
  const [personalView, setPersonalView]                 = useState<"personas" | "carga">("personas");

  useEffect(() => { load(); }, []);
  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    const token = getToken();
    try {
      const res = await fetch('/api/projects', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) { clearToken(); navigate('/login'); return; }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProjects(data);
      } else {
        toast.error("Error al cargar proyectos");
      }
    } catch { toast.error("Error de red"); }
  };

  const load = async () => {
    setLoading(true);
    try {
      // Buscar datos del plan anterior mas reciente
      let prevData = null;
      for (const oldKey of ["sigob:plan20","sigob:plan19","sigob:plan18","sigob:plan17","sigob:plan16","sigob:plan15","sigob:plan14","sigob:plan13","sigob:plan12","sigob:plan11","sigob:plan10","sigob:plan9","sigob:plan8","sigob:plan7","sigob:plan6","sigob:plan5","sigob:plan4"]) {
        try {
          const ro = await storage.get(oldKey);
          if (ro && !prevData) { prevData = JSON.parse(ro.value); break; }
        } catch {}
      }

      // Cargar datos actuales
      const r = await storage.get(SK);
      // Si no hay dato en SK actual, usar datos del plan anterior para merge
      const source = r ? JSON.parse(r.value) : prevData;
      let stored = JSON.parse(JSON.stringify(INIT));

      if (source) {
        // IDs eliminados explícitamente por el usuario — no deben reaparecer desde INIT
        const deletedSet = new Set<string>(source.deletedIds || []);

        // Merge: items de INIT actualizan campos base pero fuente gana en todo (status, title, etc.)
        // Items que solo existen en source (agregados por usuario) se conservan íntegros.
        // Items en deletedSet se omiten aunque estén en INIT.
        const mergeArr = (source_arr, init_arr) => {
          const sourceMap = new Map((source_arr||[]).map(x=>[x.id,x]));
          const initMap   = new Map((init_arr||[]).map(x=>[x.id,x]));
          // INIT items merged with source (source wins on all fields); skip deleted
          const merged = (init_arr||[]).filter(item => !deletedSet.has(item.id)).map(initItem => {
            const s = sourceMap.get(initItem.id);
            return s ? { ...initItem, ...s } : initItem;
          });
          // Source-only items (user-added, not in INIT)
          (source_arr||[]).forEach(srcItem => {
            if (!initMap.has(srcItem.id) && !deletedSet.has(srcItem.id)) merged.push(srcItem);
          });
          return merged;
        };
        stored.nay_plan   = mergeArr(source.nay_plan,   INIT.nay_plan);
        stored.focus      = mergeArr(source.focus,      INIT.focus);
        stored.priorities = mergeArr(source.priorities, INIT.priorities);
        stored.cells = {};
        // Include cells from source that aren't in INIT (e.g. cells added later)
        const allCellNames = new Set([...Object.keys(INIT.cells), ...Object.keys(source.cells||{})]);
        allCellNames.forEach(cell => {
          const initCell   = (INIT.cells as any)[cell]   || { leader:"", members:[], tasks:[] };
          const sourceCell = (source.cells||{})[cell] || { tasks:[] };
          stored.cells[cell] = {
            ...initCell,
            ...(sourceCell.leader ? { leader: sourceCell.leader } : {}),
            ...(sourceCell.members ? { members: sourceCell.members } : {}),
            ...(sourceCell.color ? { color: sourceCell.color } : {}),
            tasks: mergeArr(sourceCell.tasks, initCell.tasks),
          };
        });
        if (source.week)       stored.week       = source.week;
        if (source.isoWeek)    stored.isoWeek    = source.isoWeek;
        if (source.deletedIds) stored.deletedIds = source.deletedIds;
      }

      setD(stored);

      const rp = await storage.get("sigob:pmo");
      if (rp) {
        const sp = JSON.parse(rp.value);
        const ei = new Set(sp.map(x=>x.id));
        const ni = PMO_INIT.filter(x=>!ei.has(x.id));
        setPmoItems(ni.length ? [...ni,...sp] : sp);
      } else { setPmoItems(PMO_INIT); }

      try { const ls = await storage.get("sigob:lastSync"); if(ls) setLastSync(ls.value); } catch {}
      try { const rc = await storage.get("sigob:checklist"); if (rc) setChecklistItems(JSON.parse(rc.value)); } catch {}
    } catch { setD(JSON.parse(JSON.stringify(INIT))); setPmoItems(PMO_INIT); }
    setLoading(false);
  };

  const save = async nd => {
    setD(nd);
    try {
      const r = await storage.set(SK, JSON.stringify(nd));
      if (!r) {
        setLiveIndicatorState("error");
        toast.error("Error al guardar — verifica que el servidor esté activo", { id: "save-error" });
      } else if (liveIndicatorState === "error") {
        setLiveIndicatorState("live");
        toast.dismiss("save-error");
      }
    } catch {
      setLiveIndicatorState("error");
      toast.error("Error de red al guardar", { id: "save-error" });
    }
  };
  const savePmo = async items => {
    setPmoItems(items);
    try {
      const r = await storage.set("sigob:pmo", JSON.stringify(items));
      if (!r) toast.error("Error al guardar PMO");
    } catch {}
  };
  const saveChecklist = async (items: ChecklistItem[]) => {
    setChecklistItems(items);
    try {
      const r = await storage.set("sigob:checklist", JSON.stringify(items));
      if (!r) toast.error("Error al guardar checklist");
    } catch {}
  };

  const updFocus   = (id,f,v) => save({...d, focus:d.focus.map(x=>x.id===id?{...x,[f]:v}:x)});
  const updNayPlan = (id,f,v) => save({...d, nay_plan:d.nay_plan.map(x=>x.id===id?{...x,[f]:v}:x)});
  const updPrio    = (id,f,v) => save({...d, priorities:d.priorities.map(x=>x.id===id?{...x,[f]:v}:x)});
  const updTask    = (cell,tid,f,v) => save({...d, cells:{...d.cells,[cell]:{...d.cells[cell],tasks:d.cells[cell].tasks.map(x=>x.id===tid?{...x,[f]:v}:x)}}});
  const updPmoF    = (id,f,v) => savePmo(pmoItems.map(x=>x.id===id?{...x,[f]:v}:x));
  const updIssue   = (pid,iid,st) => savePmo(pmoItems.map(x=>x.id===pid?{...x,issues:x.issues.map(i=>i.id===iid?{...i,status:st}:i)}:x));

  // ── ADD / DELETE / FOCUS EDIT ──
  const createProject = async () => {
    const name = newProjectInput.trim();
    if (!name || submittingProject) return;
    setSubmittingProject(true);
    const token = getToken();
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name }),
      });
      if (res.status === 401) { clearToken(); navigate('/login'); return; }
      if (res.ok) {
        const proj: Project = await res.json();
        setProjects(prev => [...prev, proj]);
        setNewProjectInput("");
        setCreatingProject(false);
        toast.success("Proyecto creado");
      } else {
        toast.error("Error al crear proyecto");
      }
    } catch { toast.error("Error de red"); }
    finally { setSubmittingProject(false); }
  };

  const associateTask = async () => {
    if (!associatingCell || !associatingTask || submittingAssociation) return;
    const project = projects.find(p => p.id === selectedProject);
    if (!project) return;
    setSubmittingAssociation(true);
    const existingRefs = project.taskRefs ?? [];
    const taskRefs = [...existingRefs, { taskId: associatingTask, cellName: associatingCell }];
    const token = getToken();
    try {
      const res = await fetch(`/api/projects/${selectedProject}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: project.name, taskRefs }),
      });
      if (res.status === 401) { clearToken(); navigate('/login'); return; }
      if (res.ok) {
        const updated: Project = await res.json();
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
        setAssociatingCell("");
        setAssociatingTask("");
      } else {
        toast.error("Error al asociar tarea");
      }
    } catch { toast.error("Error de red"); }
    finally { setSubmittingAssociation(false); }
  };

  const createAndAssociateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskCell || !selectedProject || !d) return;
    const project = projects.find(p => p.id === selectedProject);
    if (!project) return;
    const id = newTaskCell.substring(0, 3).toLowerCase() + "_" + Date.now();
    const newTask = { id, title: newTaskTitle.trim(), resp: newTaskResp.trim(), status: newTaskStatus, notes: "", zoho: "" };
    save({ ...d, cells: { ...d.cells, [newTaskCell]: { ...d.cells[newTaskCell], tasks: [...(d.cells[newTaskCell]?.tasks ?? []), newTask] } } });
    const taskRefs = [...(project.taskRefs ?? []), { taskId: id, cellName: newTaskCell }];
    const token = getToken();
    try {
      const res = await fetch(`/api/projects/${selectedProject}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: project.name, taskRefs }),
      });
      if (res.status === 401) { clearToken(); navigate('/login'); return; }
      if (res.ok) {
        const updated: Project = await res.json();
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
        toast.success("Tarea creada y asociada al proyecto");
      } else {
        toast.error("Error al asociar tarea nueva");
      }
    } catch { toast.error("Error de red"); }
    setNewTaskTitle(""); setNewTaskResp(""); setNewTaskStatus("PENDIENTE"); setNewTaskCell(""); setCreatingTaskForProject(false);
  };

  const BASE_PROJECTS = [
    "SIR — Portal, Admin, Reporteador, BI",
    "SIR Navojoa",
    "SIR Nayarit",
    "SIR Oaxaca",
    "SIR Tlajomulco",
    "SIR Jalisco",
    "SIR REPUVE",
    "SIR-Lite Multas — Oaxaca Estado",
    "MultApp — Oaxaca Municipio",
    "MultApp Lite — Oaxaca Estado",
    "Nóminas — Tlajomulco & Navojoa",
    "Egresos — Navojoa",
    "FAN Nayarit",
    "App Ciudadano",
    "App de Alertamientos Geográficos",
    "Ventanilla Única (con Payload)",
    "Nuevo SIR-Lite",
  ];

  const seedProjects = async () => {
    if (seedingProjects) return;
    setSeedingProjects(true);
    const token = getToken();
    let created = 0;
    for (const name of BASE_PROJECTS) {
      if (projects.some(p => p.name === name)) continue;
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ name }),
        });
        if (res.ok) {
          const proj: Project = await res.json();
          setProjects(prev => [...prev, proj]);
          created++;
        }
      } catch {}
    }
    setSeedingProjects(false);
    toast.success(`${created} proyecto${created !== 1 ? "s" : ""} cargado${created !== 1 ? "s" : ""}`);
  };

  const addTask = async (cell) => {
    if (!taskForm.title) return;
    const id = cell.substring(0,3).toLowerCase() + "_" + Date.now();
    const newTask = {id, title:taskForm.title, resp:taskForm.resp, status:taskForm.status, notes:taskForm.notes, zoho:taskForm.zoho};
    await save({...d, cells:{...d.cells,[cell]:{...d.cells[cell],tasks:[...d.cells[cell].tasks,newTask]}}});
    if (taskForm.projectId) {
      const project = projects.find(p => p.id === taskForm.projectId);
      if (project) {
        const token = getToken();
        const taskRefs = [...(project.taskRefs ?? []), { taskId: id, cellName: cell }];
        try {
          const res = await fetch(`/api/projects/${taskForm.projectId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ name: project.name, taskRefs }),
          });
          if (res.ok) {
            const updated: Project = await res.json();
            setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
          }
        } catch {}
      }
    }
    setTaskForm({title:"",resp:"",status:"PENDIENTE",notes:"",zoho:"",projectId:""});
    setAddingTask(null);
  };
  const deleteTask = (cell,tid) => {
    const deletedIds = [...new Set([...(d.deletedIds||[]), tid])];
    save({...d, deletedIds, cells:{...d.cells,[cell]:{...d.cells[cell],tasks:d.cells[cell].tasks.filter(x=>x.id!==tid)}}});
  };
  const addCell = async () => {
    const name = cellForm.name.trim();
    if (!name) return;
    if (Object.keys(d.cells).some(c => c.toLowerCase() === name.toLowerCase())) {
      toast.error("Ya existe una célula con ese nombre");
      return;
    }
    const members = cellForm.members.split(",").map(s => s.trim()).filter(Boolean);
    const newCell = { leader: cellForm.leader.trim(), members, tasks: [], color: cellForm.color };
    await save({ ...d, cells: { ...d.cells, [name]: newCell } });
    toast.success(`Célula "${name}" creada`);
    setCellForm({ name:"", leader:"", members:"", color: CELL_PALETTE[0] });
    setAddingCell(false);
    setSelectedCell(name);
  };
  const addChecklistItem = () => {
    const title = checklistCapture.trim();
    if (!title) return;
    const item: ChecklistItem = { id: "ck_" + Date.now(), title, status: "PENDIENTE", createdAt: new Date().toISOString() };
    saveChecklist([item, ...checklistItems]);
    setChecklistCapture("");
    setTimeout(() => captureInputRef.current?.focus(), 0);
  };
  const deleteChecklistItem = (id: string) => {
    saveChecklist(checklistItems.filter(x => x.id !== id));
    setConfirmDel(null);
  };
  const saveFocusEdit = () => {
    save({...d, focus:d.focus.map(x=>x.id===editFocusId?{...x,...focusForm}:x)});
    setEditFocusId(null);
  };
  const addFocusItem = () => {
    const id = "F"+Date.now();
    save({...d, focus:[...d.focus,{id,title:"Nuevo enfoque",resp:"",cell:"",status:"ESTA_SEMANA",notes:""}]});
  };
  const deleteFocus = (id) => {
    const deletedIds = [...new Set([...(d.deletedIds||[]), id])];
    save({...d, deletedIds, focus:d.focus.filter(x=>x.id!==id)});
  };

  // ── BACKUP / RESTORE ──
  const [showBackup, setShowBackup] = useState(false);
  const [history, setHistory] = useState([]);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [backupJson, setBackupJson] = useState("");
  const [restoreText, setRestoreText] = useState("");
  const exportBackup = () => {
    const backup = {version:"sigob-backup",date:new Date().toISOString(),week:d.week,data:d,pmo:pmoItems};
    setBackupJson(JSON.stringify(backup));
    setShowBackup("export");
  };
  const importBackup = () => {
    try {
      const backup = JSON.parse(restoreText);
      if(backup.data) { save(backup.data); if(backup.pmo) savePmo(backup.pmo); setShowBackup(false); setRestoreText(""); }
      else { alert("JSON invalido"); }
    } catch { alert("Error al leer JSON"); }
  };

  // ── HISTORIAL ──
  const loadHistory = async () => {
    const keys = await storage.list("sigob:hist:");
    if(keys&&keys.keys){
      const items = [];
      for(const k of keys.keys.sort().reverse()){
        try { const r = await storage.get(k); if(r) items.push(JSON.parse(r.value)); } catch{}
      }
      setHistory(items);
    }
  };
  const [savingSnap, setSavingSnap] = useState(false);
  const [snapMsg, setSnapMsg] = useState("");
  const saveToHistory = async () => {
    setSavingSnap(true); setSnapMsg("");
    const snap = {version:"sigob-snapshot",date:new Date().toISOString(),week:d.week,data:d,pmo:pmoItems};
    const key = "sigob:hist:"+d.week.replace(/[^a-zA-Z0-9]/g,"_");
    try {
      await storage.set(key, JSON.stringify(snap));
      await loadHistory();
      setSnapMsg("✅ Guardado: "+d.week+" — "+new Date().toLocaleTimeString("es-MX"));
    } catch(e) { setSnapMsg("❌ Error: "+e.message); }
    setSavingSnap(false);
  };
  const loadFromHistory = (snap) => { setViewingHistory(snap); };
  const importHistoryJson = () => {
    try {
      const snap = JSON.parse(restoreText);
      if(snap.data&&snap.week){
        const key = "sigob:hist:"+snap.week.replace(/[^a-zA-Z0-9]/g,"_");
        storage.set(key, JSON.stringify(snap)).then(()=>{loadHistory();setShowBackup(false);setRestoreText("");});
      } else { alert("JSON invalido — necesita tener week y data"); }
    } catch { alert("Error al leer JSON"); }
  };
  useEffect(()=>{loadHistory();},[]);
  useEffect(() => { if (tab === "historial") loadCheckpointList(); }, [tab]);

  // ── CHECKPOINT (Story 4.1) ──
  const openCheckpointDialog = () => {
    if (!d) return;
    setWeekVal(d.week);
    setEditWeek(true);
  };

  const saveCheckpoint = async (weekOverride?: string) => {
    if (!d) return;
    setLiveIndicatorState("saving");
    const now = new Date();
    const isoWeek = getISOWeek(now);
    const week = weekOverride ?? d.week;
    try {
      const token = getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers,
        body: JSON.stringify({ isoWeek, week, data: { ...d, week }, pmo: pmoItems, checklist: checklistItems }),
      });
      if (!res.ok) throw new Error("snapshot save failed");
      const date = now.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" });
      const time = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      toast.success(`Checkpoint guardado — ${date}, ${time} (${isoWeek})`);
      loadCheckpointList();
    } catch {
      toast.error("Error al guardar checkpoint — intenta de nuevo");
    }
    setLiveIndicatorState("live");
  };

  const confirmCheckpoint = () => {
    const trimmed = weekVal.trim();
    if (!trimmed) return;
    setD(prev => prev ? { ...prev, week: trimmed } : prev);
    setEditWeek(false);
    saveCheckpoint(trimmed);
  };

  // ── CHECKPOINT (Story 4.2) ──
  const loadCheckpointList = async () => {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/snapshots", { headers });
      if (res.ok) {
        const list = await res.json();
        setCheckpointList(Array.isArray(list) ? list : []);
      }
    } catch {
      setCheckpointList([]);
    }
  };

  const loadCheckpointFromSnap = (snap: CheckpointSnap) => {
    setViewingCheckpoint(snap);
    setLiveIndicatorState("checkpoint");
  };

  const backToLive = () => {
    setViewingCheckpoint(null);
    setLiveIndicatorState("live");
  };

  const deleteCheckpoint = async (id: number) => {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/snapshots/${id}`, { method: "DELETE", headers });
      if (res.status === 401) { clearToken(); navigate('/login'); return; }
      if (!res.ok) throw new Error("delete failed");
      // Si estábamos viendo ese checkpoint, regresar a modo edición
      if (viewingCheckpoint && (viewingCheckpoint as any).id === id) backToLive();
      toast.success("Checkpoint eliminado");
      loadCheckpointList();
    } catch {
      toast.error("Error al eliminar checkpoint — intenta de nuevo");
    }
  };

  // Construye un snapshot en vivo a partir del estado actual (para el PDF "al vuelo")
  const buildLiveSnap = (): CheckpointSnap | null => {
    if (!d) return null;
    const now = new Date();
    return {
      savedAt: now.toISOString(),
      week: d.week,
      isoWeek: d.isoWeek || getISOWeek(now),
      data: d,
      pmo: pmoItems,
      checklist: checklistItems,
    };
  };

  const generatePdf = async (snapArg?: any) => {
    // Acepta override solo si es un snapshot real (tiene .data); ignora eventos de click.
    const override: CheckpointSnap | undefined = snapArg && snapArg.data ? snapArg : undefined;
    // Prioridad: checkpoint pasado explícito → checkpoint en vista → datos EN VIVO
    const snap = override ?? viewingCheckpoint ?? buildLiveSnap();
    if (!snap) return;
    setPdfGenerating(true);
    try {
      // Trae los acuerdos vigentes para incluirlos en el reporte (no viven en el snapshot)
      let acuerdos = (snap as any).acuerdos;
      if (!acuerdos) {
        try {
          const token = getToken();
          const res = await fetch('/api/acuerdos', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (res.ok) acuerdos = await res.json();
        } catch { /* sin acuerdos si falla la red */ }
      }
      // Comparativa contra el checkpoint anterior (por id si es un checkpoint guardado,
      // contra el más reciente si se genera con datos en vivo).
      let comparison = null;
      try {
        const token = getToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const listRes = await fetch('/api/snapshots', { headers });
        const list: any[] = listRes.ok ? await listRes.json() : []; // ordenada DESC por savedAt
        // El "checkpoint anterior" real: el más reciente de una SEMANA distinta y no posterior al actual.
        // (Evita comparar contra un checkpoint de la misma semana recién guardado, que daría 0 cambios.)
        const curId = (snap as any).id;
        const curIso = snap.isoWeek;
        const curSavedAt = snap.savedAt;
        // La lista viene ordenada DESC por savedAt, así que el primer match es el inmediatamente anterior.
        const prevMeta: any = curId != null
          // Reimpresión de un checkpoint guardado → SIEMPRE contra el checkpoint inmediatamente anterior.
          ? (list.find(s => s.id !== curId && s.savedAt < curSavedAt) ?? null)
          // PDF en vivo (sin id) → contra el más reciente de otra semana; respaldo: el inmediatamente anterior.
          : (list.find(s => s.isoWeek !== curIso && s.savedAt <= curSavedAt)
             ?? list.find(s => s.savedAt < curSavedAt)
             ?? null);
        if (prevMeta) {
          const prevRes = await fetch(`/api/snapshots/${prevMeta.id}`, { headers });
          if (prevRes.ok) {
            const prevSnap = await prevRes.json();
            const cmp = buildCheckpointComparison(prevSnap.data, snap.data);
            if (cmp) comparison = { ...cmp, prev: { week: prevSnap.week, isoWeek: prevSnap.isoWeek, savedAt: prevSnap.savedAt } };
          }
        }
      } catch { /* sin comparativa si falla la red */ }

      const snapForPdf = { ...snap, acuerdos: acuerdos || [], projects, comparison };
      const blob = await pdf(<PdfTemplate snap={snapForPdf} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const match = snap.isoWeek.match(/W(\d+)-(\d+)/);
      const filename = match
        ? `reporte-semana-${match[1]}-${match[2]}.pdf`
        : `reporte-sigob-${snap.isoWeek}.pdf`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast(`✓ PDF generado — ${filename}`, { duration: 4000 });
    } catch {
      toast("Error al generar PDF — intenta de nuevo", { duration: 4000 });
    } finally {
      setPdfGenerating(false);
    }
  };

  const computeCheckpointDiff = (snapData: any) => {
    if (!snapData || !d) return { completadas: 0, enProgreso: 0, bloqueadas: 0 };
    const DONE    = ["COMPLETADO", "LISTO_PROD"];
    const ACTIVE  = ["ACTIVO", "EN_CURSO", "SEGUIMIENTO", "COORDINADO", "ALTA_PRIORIDAD", "ESTA_SEMANA"];
    const BLOCKED = ["BLOQUEADO", "BLOQUEANTE"];
    const snapTasks: any[] = Object.values(snapData.cells || {}).flatMap((c: any) => c.tasks || []);
    const liveTasks: any[] = Object.values(d.cells   || {}).flatMap((c: any) => c.tasks || []);
    const snapMap = new Map(snapTasks.map((t: any) => [t.id, t]));
    let completadas = 0, enProgreso = 0, bloqueadas = 0;
    liveTasks.forEach((t: any) => {
      const s = snapMap.get(t.id);
      if (DONE.includes(t.status)    && (!s || !DONE.includes(s.status)))    completadas++;
      if (ACTIVE.includes(t.status)  && (!s || !ACTIVE.includes(s.status)))  enProgreso++;
      if (BLOCKED.includes(t.status)) bloqueadas++;
    });
    return { completadas, enProgreso, bloqueadas };
  };

  // Compara dos snapshots por id de tarea y clasifica completadas / avances / nuevas / regresiones.
  // Usa los códigos de estado reales de la app (no las etiquetas del endpoint /compare del backend).
  const buildCheckpointComparison = (prevData: any, currData: any) => {
    if (!prevData || !currData) return null;
    const DONE = ["COMPLETADO", "LISTO_PROD", "ARCHIVADO"];
    const progressRank = (s: string) => {
      if (DONE.includes(s)) return 3;
      if (["EN_CURSO", "ACTIVO", "SEGUIMIENTO", "COORDINADO"].includes(s)) return 2;
      if (["ESTA_SEMANA", "ALTA_PRIORIDAD", "REVISAR", "BANDERA_AMARILLA"].includes(s)) return 1;
      return 0; // pendiente / urgente / bloqueado / sin iniciar
    };
    const flatten = (data: any) =>
      Object.entries(data?.cells || {}).flatMap(([cellName, c]: any) =>
        (c.tasks || []).map((t: any) => ({ ...t, cell: cellName }))
      );
    const prevMap = new Map(flatten(prevData).map((t: any) => [t.id, t]));

    const completadas: any[] = [], avances: any[] = [], regresiones: any[] = [], nuevas: any[] = [];
    flatten(currData).forEach((t: any) => {
      const before: any = prevMap.get(t.id);
      if (!before) { nuevas.push(t); return; }
      if (DONE.includes(t.status) && !DONE.includes(before.status)) {
        completadas.push({ ...t, fromStatus: before.status });
      } else {
        const ra = progressRank(t.status), rb = progressRank(before.status);
        if (ra > rb) avances.push({ ...t, fromStatus: before.status });
        else if (ra < rb) regresiones.push({ ...t, fromStatus: before.status });
      }
    });
    return {
      summary: {
        completadas: completadas.length, avances: avances.length,
        nuevas: nuevas.length, regresiones: regresiones.length,
      },
      completadas, avances, nuevas, regresiones,
    };
  };

  const addPmoItem = () => {
    savePmo([...pmoItems,{...pmoForm,id:"pmo"+Date.now(),issues:[]}]);
    setNewPMO(false);
    setPmoForm({title:"",resp:"",area:"",prioridad:"",doc:"",zoho:"",notes:"",status:"PENDIENTE"});
  };

  const syncToNotion = async () => {
    setSyncLoading(true); setSyncResult("");
    const items = [
      ...(d.nay_plan||[]).map(x=>({id:x.id,tipo:"Nayarit Plan",title:x.title,resp:x.resp,celula:x.celula,status:S[x.status]?S[x.status].l:x.status,completado:x.status==="COMPLETADO",semana:d.week,notas:""})),
      ...d.focus.map(x=>({id:x.id,tipo:"Enfoque",title:x.title,resp:x.resp,celula:x.cell,status:S[x.status]?S[x.status].l:x.status,completado:x.status==="COMPLETADO",semana:d.week,notas:x.notes})),
      ...d.priorities.map(x=>({id:x.id,tipo:"Prioridad",title:x.title,resp:x.resp,celula:x.cell,status:S[x.status]?S[x.status].l:x.status,completado:x.status==="COMPLETADO",semana:d.week,notas:x.notes})),
      ...Object.entries(d.cells).flatMap(([cell,cd])=>cd.tasks.map(x=>({id:x.id,tipo:"Tarea",title:x.title,resp:x.resp,celula:cell,status:S[x.status]?S[x.status].l:x.status,completado:x.status==="COMPLETADO",semana:d.week,notas:x.notes}))),
      ...pmoItems.filter(x=>x.id!=="pmo8").map(x=>({id:x.id,tipo:"PMO",title:x.title,resp:x.resp,celula:x.area,status:S[x.status]?S[x.status].l:x.status,completado:x.status==="COMPLETADO",semana:d.week,notas:(x.notes||"").substring(0,200)})),
    ];
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:3000,
          system:"Sincronizas datos a Notion. Regla: NUNCA elimines paginas — solo crea nuevas o actualiza las existentes.",
          messages:[{role:"user",content:"Sincroniza plan SIGOB semana "+d.week+" a Notion.\n1. Busca o crea base de datos 'SIGOB Plan de Prioridades' con: Titulo(title), ID_Tarea(rich_text), Tipo(select), Status(select), Responsable(rich_text), Celula(select), Semana(rich_text), Notas(rich_text), Completado(checkbox).\n2. Por cada item: si existe ID_Tarea actualiza Status/Semana/Notas/Completado. Si no existe, crea pagina nueva. NUNCA elimines.\n3. Responde: creados, actualizados, link.\n\nItems ("+items.length+"):\n"+JSON.stringify(items,null,2)}],
          mcp_servers:[{type:"url",url:"https://mcp.notion.com/mcp",name:"notion"}]
        })
      });
      const data = await res.json();
      const text = data.content ? data.content.filter(b=>b.type==="text").map(b=>b.text).join("") : "Sin respuesta.";
      setSyncResult(text);
      const now = new Date().toLocaleString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
      setLastSync(now);
      try { await storage.set("sigob:lastSync", now); } catch {}
    } catch(e) { setSyncResult("Error: "+e.message); }
    setSyncLoading(false);
  };

  const generateReport = async () => {
    setGenLoading(true); setReport("");
    const tareas = [];
    const issuesZoho = [];
    Object.entries(d.cells).forEach(([cell,c])=>{
      c.tasks.forEach(t=>{
        const item = {t:t.title.substring(0,80),r:t.resp,s:S[t.status]?S[t.status].l:t.status,c:cell};
        if(t.id&&t.id.startsWith("nay_")) issuesZoho.push(item);
        else tareas.push(item);
      });
    });
    pmoItems.filter(x=>x.id!=="pmo8").forEach(x=>tareas.push({t:x.title.substring(0,80),r:x.resp,s:S[x.status]?S[x.status].l:x.status,c:"PMO/"+x.area}));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:3000,
          system:`Eres asistente de direccion de SIGOB. Genera el plan semanal con estas secciones en markdown:
# PLAN INTEGRAL DE PRIORIDADES Y SEGUIMIENTO — EQUIPO SIGOB
**Semana: [semana]** | **Fecha: [hoy]** | **Responsable: Direccion — Dulce Gonzalez**
---
## 1. CONTRASTE SEMANAL
### CUMPLIDOS (Completado/Listo prod) tabla: # | Objetivo | Responsable | Nota
### PARCIALES (En curso/Seguimiento/Activo) tabla: # | Objetivo | Responsable | Que falta
### NO CUMPLIDOS (Pendiente/Urgente/Bloqueado) tabla: # | Objetivo | Responsable | Por que
## 2. PLAN POR CELULA
subseccion por celula con tareas activas
## 3. HITOS CLAVE tabla: # | Hito | Responsable | Estado (max 12)
## 4. RESUMEN POR RESPONSABLE tabla: Responsable | Rol | Tareas criticas
## 5. TAREAS NO PERDER DE VISTA lista por proyecto
## 6. ISSUES REZAGADOS EN ZOHO — NAYARIT
Estos son problemas abiertos importados de Zoho que requieren cierre puntual.
tabla: # | Issue | Responsable | Status | Celula
Agrupar por celula (Backend, Frontend, DBA). Resaltar los de BASE DE DATOS.
## 7. CHECKLIST por responsable con simbolo checkbox
REGLAS: solo datos dados, no inventes, tono ejecutivo, NO Navojoa interno.`,
          messages:[{role:"user",content:`Semana: ${d.week}\nTareas:\n${JSON.stringify(tareas)}\n\nISSUES REZAGADOS ZOHO (${issuesZoho.length}):\n${JSON.stringify(issuesZoho)}`}]
        })
      });
      const data = await res.json();
      setReport(data.content ? data.content.filter(b=>b.type==="text").map(b=>b.text).join("") : "Error al generar.");
    } catch(e) { setReport("Error: "+e.message); }
    setGenLoading(false);
  };

  if (loading||!d) return (
    <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",background:"#09090C",color:"#64748b",fontFamily:"system-ui,sans-serif",fontSize:16}}>Cargando...</div>
  );

  const allTasks = [...d.priorities,...Object.values(d.cells).flatMap(c=>c.tasks)];
  const completadosCount = allTasks.filter(x=>x.status==="COMPLETADO").length;
  const inp = {background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:8,padding:"7px 10px",fontSize:13,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};

  const StatusSel = ({status,onChange}) => {
    const cfg = S[status]||{l:status,c:"#6b7280"};
    const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:12,padding:18,marginBottom:12,boxShadow:"0 2px 15px rgba(0,0,0,0.2)",border:"1px solid rgba(51,65,85,0.3)"}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
      <select value={status} onChange={e=>onChange(e.target.value)}
        style={{background:cfg.c,color:"#fff",border:"none",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer",outline:"none"}}>
        {Object.entries(S).map(([k,v])=>(
          <option key={k} value={k} style={{background:"#0F1117"}}>{v.l}</option>
        ))}
      </select>
    );
  };

  const Pill = ({status}) => {
    const cfg = S[status]||{l:status,c:"#6b7280"};
    return <span style={{background:cfg.c,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{cfg.l}</span>;
  };

  const ZLink = ({url}) => url ? (
    <a href={url} target="_blank" rel="noreferrer"
      style={{color:"#60a5fa",fontSize:11,textDecoration:"none",border:"1px solid #1e3a5c",borderRadius:6,padding:"1px 7px",marginTop:3,display:"inline-block"}}>Zoho</a>
  ) : null;

  const IssuesTable = ({issues,pmoId}) => {
    if (!issues||!issues.length) return null;
    const pending = issues.filter(i=>i.status!=="Completado").length;
    const isOpen  = expandedIssue===pmoId;
    const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:12,padding:18,marginBottom:12,boxShadow:"0 2px 15px rgba(0,0,0,0.2)",border:"1px solid rgba(51,65,85,0.3)"}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
      <div style={{marginTop:8}}>
        <div onClick={()=>setExpandedIssue(isOpen?null:pmoId)}
          style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:"#09090C",borderRadius:6,padding:"6px 12px",border:"1px solid #1E2233"}}>
          <span style={{color:"#7A7F9A",fontSize:12}}>{issues.length} items — {pending} pendientes</span>
          <span style={{color:"#475569",fontSize:14,marginLeft:"auto"}}>{isOpen?"▲":"▼"}</span>
        </div>
        {isOpen&&(
          <div style={{overflowX:"auto",marginTop:4,borderRadius:6,border:"1px solid #1E2233"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:"#0F1117"}}>
                  {["ID","Descripcion","Asignado","Fecha","Status","Prio"].map(h=>(
                    <th key={h} style={{padding:"5px 8px",color:"#64748b",fontWeight:700,textAlign:"left",borderBottom:"1px solid #1E2233",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.map((iss,i)=>(
                  <tr key={iss.id} style={{background:i%2===0?"#09090C":"#0F1117",opacity:iss.status==="Completado"?.5:1}}>
                    <td style={{padding:"5px 8px",color:"#7A7F9A",whiteSpace:"nowrap",fontWeight:700}}>{iss.id}</td>
                    <td style={{padding:"5px 8px",color:"#E8E3D8",maxWidth:200}}>{iss.desc}</td>
                    <td style={{padding:"5px 8px",color:"#7A7F9A",whiteSpace:"nowrap"}}>{iss.asignado}</td>
                    <td style={{padding:"5px 8px",color:"#7A7F9A",whiteSpace:"nowrap"}}>{iss.deadline}</td>
                    <td style={{padding:"5px 8px"}}>
                      <select value={iss.status} onChange={e=>updIssue(pmoId,iss.id,e.target.value)}
                        style={{background:ISSUE_STATUS_CLR[iss.status]||"#334155",color:"#fff",border:"none",borderRadius:10,padding:"2px 6px",fontSize:10,fontWeight:700,cursor:"pointer",outline:"none"}}>
                        {["Pendiente","En proceso","Pruebas internas","Listo","Completado"].map(s=>(
                          <option key={s} style={{background:"#0F1117"}}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{padding:"5px 8px"}}>
                      <span style={{background:ISSUE_PRIO_CLR[iss.prioridad]||"#334155",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>{iss.prioridad}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const Dashboard = () => {
    const nayPlan  = d.nay_plan||[];
    const nayDone  = nayPlan.filter(x=>x.status==="COMPLETADO").length;
    const nayTotal = nayPlan.length;
    const nayByCelula = ["Backend SIR","Frontend SIR","DBA"].map(cel=>({
      cel, items:nayPlan.filter(x=>x.celula===cel)
    }));
    const miguelTasks  = (d.cells["DevOps"]||{tasks:[]}).tasks.filter(x=>x.resp==="Miguel Angel");
    const alfonsoTasks = (d.cells["DevOps"]||{tasks:[]}).tasks.filter(x=>x.resp==="Alfonso");

    const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:12,padding:18,marginBottom:12,boxShadow:"0 2px 15px rgba(0,0,0,0.2)",border:"1px solid rgba(51,65,85,0.3)"}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
      <div>
        {/* ENFOQUE */}
        <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
          <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:10}}>ENFOQUE DE LA SEMANA</div>
          {d.focus.map((f,i)=>{
            const cfg = S[f.status]||{c:"#6b7280"};
            const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
              <div key={f.id} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid #0f172a",opacity:f.status==="ARCHIVADO"?0.45:1}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:cfg.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#fff",flexShrink:0,marginTop:2}}>{i+1}</div>
                <div style={{flex:1}}>
                  {editFocusId===f.id?(
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <input value={focusForm.title} onChange={e=>setFocusForm({...focusForm,title:e.target.value})} placeholder="Titulo" style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:"4px 8px",fontSize:12,width:"100%",boxSizing:"border-box"}}/>
                      <input value={focusForm.resp} onChange={e=>setFocusForm({...focusForm,resp:e.target.value})} placeholder="Responsable" style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:"4px 8px",fontSize:11,width:"100%",boxSizing:"border-box"}}/>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {["DBA","DevOps","Backend SIR","Frontend SIR","Nuevas Tec","Reporteador Nayarit","Multi-celula"].map(cn=>{
                          const sel = focusForm.cell.split(",").map(s=>s.trim()).includes(cn);
                          const clr = CELL_CLR[cn]||"#475569";
                          return (
                            <button key={cn} type="button" onClick={()=>{
                              const cells = focusForm.cell.split(",").map(s=>s.trim()).filter(Boolean);
                              const next = sel ? cells.filter(c=>c!==cn) : [...cells,cn];
                              setFocusForm({...focusForm,cell:next.join(", ")});
                            }} style={{background:sel?clr+"22":"#09090C",color:sel?clr:"#475569",border:`1px solid ${sel?clr:"#1E2233"}`,borderRadius:12,padding:"2px 8px",fontSize:10,cursor:"pointer",fontWeight:sel?600:400}}>
                              {cn}
                            </button>
                          );
                        })}
                      </div>
                      <input value={focusForm.notes} onChange={e=>setFocusForm({...focusForm,notes:e.target.value})} placeholder="Notas (opcional)" style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:"4px 8px",fontSize:11,width:"100%",boxSizing:"border-box"}}/>
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        <select value={focusForm.status} onChange={e=>setFocusForm({...focusForm,status:e.target.value})} style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:"4px 8px",fontSize:11,flex:1}}>
                          {Object.entries(S).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
                        </select>
                        <button onClick={saveFocusEdit} style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",fontSize:11,cursor:"pointer"}}>Guardar</button>
                        <button onClick={()=>setEditFocusId(null)} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✕</button>
                      </div>
                    </div>
                  ):(
                    <>
                      <div style={{color:f.status==="ARCHIVADO"?"#475569":"#E8E3D8",fontSize:13,fontWeight:600,textDecoration:f.status==="ARCHIVADO"?"line-through":"none"}}>{f.title}</div>
                      {f.resp&&<div style={{color:"#7A7F9A",fontSize:11,marginTop:2}}>👤 {f.resp}</div>}
                      {f.cell&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                          {f.cell.split(",").map(s=>s.trim()).filter(Boolean).map(cn=>(
                            <span key={cn} style={{background:(CELL_CLR[cn]||"#475569")+"22",color:CELL_CLR[cn]||"#7A7F9A",border:`1px solid ${(CELL_CLR[cn]||"#475569")}44`,borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:600}}>{cn}</span>
                          ))}
                        </div>
                      )}
                      {f.notes&&<div style={{color:"#475569",fontSize:10,marginTop:3}}>{f.notes}</div>}
                    </>
                  )}
                </div>
                {editFocusId!==f.id&&(
                  <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                    <Pill status={f.status}/>
                    {f.status!=="ARCHIVADO"&&(
                      <button title="Archivar" onClick={()=>updFocus(f.id,"status","ARCHIVADO")} style={{background:"none",border:"none",color:"#3E4260",cursor:"pointer",fontSize:12}}>📦</button>
                    )}
                    <button onClick={()=>{setEditFocusId(f.id);setFocusForm({title:f.title,resp:f.resp,cell:f.cell||"",notes:f.notes||"",status:f.status});}} style={{background:"none",border:"none",color:"#3E4260",cursor:"pointer",fontSize:10}}>✏️</button>
                    <button onClick={()=>deleteFocus(f.id)} style={{background:"none",border:"none",color:"#3E4260",cursor:"pointer",fontSize:10}}>🗑</button>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={addFocusItem} style={{background:"#09090C",color:"#64748b",border:"1px dashed #1E2233",borderRadius:8,padding:"8px 0",width:"100%",cursor:"pointer",fontSize:11,marginTop:6}}>+ Agregar enfoque</button>
        </div>





        {/* PLAN DE MIGRACION DE NUBE */}
        <div style={{background:"linear-gradient(135deg,#0c1a2e,#1a1a3e)",borderRadius:12,padding:18,marginBottom:12,border:"1px solid #312e81"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{color:"#818cf8",fontSize:11,fontWeight:700,letterSpacing:1}}>☁️ PLAN DE MIGRACIÓN DE NUBE</div>
              <div style={{color:"#475569",fontSize:10,marginTop:2}}>Meta: Mayo 2026 — Solo Huawei: SEIGPOL + 1 Nayarit</div>
            </div>
          </div>

          {/* TIMELINE */}
          <div style={{marginBottom:14}}>
            <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>ROADMAP</div>

            {/* Semana 1 - Navojoa */}
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:"#dc2626",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900}}>1</div>
                <div style={{width:2,flex:1,background:"#1A1D28",marginTop:4}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{color:"#E8E3D8",fontSize:12,fontWeight:700}}>Navojoa SIR → CURIOSITY</div>
                <div style={{color:"#fbbf24",fontSize:10,fontWeight:700}}>⏰ PRÓXIMA SEMANA</div>
                <div style={{color:"#7A7F9A",fontSize:10,marginTop:2,lineHeight:1.5}}>Instalar NAV-ING en Curiosity. Dar de baja instancia anterior. Evaluar capacidad para ecosistema completo: EGRESOS + SIR + OOMAPAS Navojoa.</div>
              </div>
            </div>

            {/* Paso 2 - CFDI */}
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:"#d97706",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900}}>2</div>
                <div style={{width:2,flex:1,background:"#1A1D28",marginTop:4}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{color:"#E8E3D8",fontSize:12,fontWeight:700}}>CFDI → Dar de baja instancia</div>
                <div style={{color:"#7A7F9A",fontSize:10,marginTop:2,lineHeight:1.5}}>Con CFDI ya instalado en Curiosity, dar de baja la instancia anterior.</div>
              </div>
            </div>

            {/* Paso 3 - Oaxaca + REPUVE */}
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:"#2563eb",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900}}>3</div>
                <div style={{width:2,flex:1,background:"#1A1D28",marginTop:4}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{color:"#E8E3D8",fontSize:12,fontWeight:700}}>Oaxaca + REPUVE → Migrar a Curiosity</div>
                <div style={{color:"#7A7F9A",fontSize:10,marginTop:2,lineHeight:1.5}}>Si Curiosity funciona (99.9% seguro), usar su herramienta de migración para mover Oaxaca y REPUVE.</div>
              </div>
            </div>

            {/* Paso 4 - Nayarit */}
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:"#7c3aed",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900}}>4</div>
                <div style={{width:2,flex:1,background:"#1A1D28",marginTop:4}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{color:"#E8E3D8",fontSize:12,fontWeight:700}}>Nayarit — Subir recursos en instancia de pruebas → PROD</div>
                <div style={{color:"#7A7F9A",fontSize:10,marginTop:2,lineHeight:1.5}}>La instancia de pruebas actual se sube de recursos y se convierte en producción. Quedamos con 1 sola instancia Huawei para Nayarit.</div>
              </div>
            </div>

            {/* Paso 5 - VPS */}
            <div style={{display:"flex",gap:10,marginBottom:6}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:"#16a34a",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900}}>5</div>
              </div>
              <div style={{flex:1}}>
                <div style={{color:"#E8E3D8",fontSize:12,fontWeight:700}}>VPS — Ampliar a 3 instancias</div>
                <div style={{color:"#7A7F9A",fontSize:10,marginTop:2,lineHeight:1.5}}>VPS actual sobrepoblado. Requerimos: 2 VPS para SIR + 1 VPS para Egresos. Equilibrar cargas.</div>
              </div>
            </div>
          </div>

          {/* Estado final */}
          <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
            <div style={{color:"#64748b",fontSize:9,fontWeight:700,letterSpacing:1,marginBottom:8}}>ESTADO FINAL — HUAWEI</div>
            <div style={{display:"flex",gap:8}}>
              <div style={{background:"#0F1117",borderRadius:6,padding:"8px 14px",flex:1,textAlign:"center",borderTop:"3px solid #818cf8"}}>
                <div style={{color:"#818cf8",fontSize:11,fontWeight:700}}>SEIGPOL</div>
                <div style={{color:"#3E4260",fontSize:9}}>Se mantiene</div>
              </div>
              <div style={{background:"#0F1117",borderRadius:6,padding:"8px 14px",flex:1,textAlign:"center",borderTop:"3px solid #7c3aed"}}>
                <div style={{color:"#7c3aed",fontSize:11,fontWeight:700}}>1× NAYARIT</div>
                <div style={{color:"#3E4260",fontSize:9}}>Prod unica</div>
              </div>
            </div>
            <div style={{color:"#3E4260",fontSize:9,fontWeight:700,letterSpacing:1,marginTop:10,marginBottom:6}}>ESTADO FINAL — CURIOSITY</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["Navojoa SIR","Navojoa Egresos","OOMAPAS","Oaxaca","REPUVE","CFDI"].map(s=>(
                <div key={s} style={{background:"#0F1117",borderRadius:6,padding:"4px 10px",borderTop:"2px solid #16a34a"}}>
                  <div style={{color:"#4ade80",fontSize:10,fontWeight:600}}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{color:"#3E4260",fontSize:9,fontWeight:700,letterSpacing:1,marginTop:10,marginBottom:6}}>ESTADO FINAL — VPS (3 instancias)</div>
            <div style={{display:"flex",gap:8}}>
              <div style={{background:"#0F1117",borderRadius:6,padding:"4px 10px",flex:1,textAlign:"center",borderTop:"2px solid #f59e0b"}}>
                <div style={{color:"#fbbf24",fontSize:10,fontWeight:600}}>VPS-1 SIR QA</div>
              </div>
              <div style={{background:"#0F1117",borderRadius:6,padding:"4px 10px",flex:1,textAlign:"center",borderTop:"2px solid #f59e0b"}}>
                <div style={{color:"#fbbf24",fontSize:10,fontWeight:600}}>VPS-2 SIR Dev</div>
              </div>
              <div style={{background:"#0F1117",borderRadius:6,padding:"4px 10px",flex:1,textAlign:"center",borderTop:"2px solid #f59e0b"}}>
                <div style={{color:"#fbbf24",fontSize:10,fontWeight:600}}>VPS-3 Egresos</div>
              </div>
            </div>
          </div>

          <div style={{marginTop:10,background:"#1a1a00",borderRadius:6,padding:"6px 10px",border:"1px solid #854d0e"}}>
            <span style={{color:"#fbbf24",fontSize:10}}>⚠️ Abril nos atraso Tlajomulco. Mayo = mes de ordenar y migrar a Huawei. Si no sale otro Tlajomulco, cumplimos meta.</span>
          </div>
        </div>


        {/* PLAN DE SALIDA JALISCO */}
        <div style={{background:"linear-gradient(135deg,#0c1a2e,#1a2e1a)",borderRadius:12,padding:18,marginBottom:12,border:"1px solid #166534"}}>
          <div style={{marginBottom:14}}>
            <div style={{color:"#4ade80",fontSize:11,fontWeight:700,letterSpacing:1}}>🏗️ PLAN DE SALIDA — JALISCO</div>
            <div style={{color:"#475569",fontSize:10,marginTop:2}}>Hito 1 — Meta: Mayo 2026</div>
          </div>

          {[
            {n:1,title:"Instalacion de ambiente con librerias actualizadas",detail:"Python y Django actualizados. Frontend y Backend.",resp:"Alfonso (DevOps)",status:"URGENTE — cerrar esta semana",c:"#ef4444"},
            {n:2,title:"Librerias actualizadas de Python y Django",detail:"La instalacion debe incluir versiones actualizadas como base para todo lo demas.",resp:"Alfonso (DevOps)",status:"Parte del paso 1",c:"#ef4444"},
            {n:3,title:"Copiar funcionalidad cobros con base a adeudos",detail:"Replicar desde Oaxaca/Tlajomulco. Tarea de DevOps + Backend.",resp:"DevOps + Paolo Payan",status:"Post instalacion",c:"#f59e0b"},
            {n:4,title:"Replicar bitacora de trazabilidad",detail:"Frontend y Backend. Funcionalidad critica de auditoria.",resp:"Paolo Payan + Mario Merel",status:"Post paso 3",c:"#f59e0b"},
            {n:5,title:"Migrar frontend completo a TypeScript",detail:"Todo el frontend de Jalisco debe migrarse a TypeScript.",resp:"Mario Merel + Equipo Frontend",status:"En paralelo",c:"#2563eb"},
            {n:6,title:"Pasar mejoras de consulta de adeudos de Tlajomulco",detail:"Mejoras de backend trabajadas en Tlajomulco deben replicarse.",resp:"Paolo Payan",status:"Post paso 3",c:"#7c3aed"},
          ].map(step=>(
            <div key={step.n} style={{display:"flex",gap:10,marginBottom:8}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:step.c,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900}}>{step.n}</div>
                {step.n<6&&<div style={{width:2,flex:1,background:"#1A1D28",marginTop:3}}/>}
              </div>
              <div style={{flex:1}}>
                <div style={{color:"#E8E3D8",fontSize:12,fontWeight:700}}>{step.title}</div>
                <div style={{color:"#7A7F9A",fontSize:10,marginTop:1,lineHeight:1.5}}>{step.detail}</div>
                <div style={{display:"flex",gap:8,marginTop:2}}>
                  <span style={{color:"#64748b",fontSize:9}}>👤 {step.resp}</span>
                  <span style={{color:step.c,fontSize:9,fontWeight:700}}>{step.status}</span>
                </div>
              </div>
            </div>
          ))}

          <div style={{marginTop:8,background:"#09090C",borderRadius:6,padding:"6px 10px",border:"1px solid #1E2233"}}>
            <span style={{color:"#7A7F9A",fontSize:10}}>Meta: completar estos 6 pasos durante mayo. La instalacion de ambiente es prerequisito para todo lo demas.</span>
          </div>
        </div>

        {/* ANALYTICS */}
        {(()=>{
          const cells = d.cells||{};
          const cellData = Object.entries(cells).map(([name,cell])=>{
            const tasks = cell.tasks||[];
            const total = tasks.length;
            const done = tasks.filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length;
            const blocked = tasks.filter(t=>["URGENTE","BLOQUEADO","BLOQUEANTE","PENDIENTE"].includes(t.status)).length;
            const active = tasks.filter(t=>["EN_CURSO","ACTIVO","SEGUIMIENTO","REVISAR"].includes(t.status)).length;
            return {name,total,done,blocked,active,pct:total?Math.round(done/total*100):0};
          });
          const totalAll = cellData.reduce((s,c)=>s+c.total,0);
          const doneAll = cellData.reduce((s,c)=>s+c.done,0);
          const blockedAll = cellData.reduce((s,c)=>s+c.blocked,0);
          const activeAll = cellData.reduce((s,c)=>s+c.active,0);
          const pctAll = totalAll?Math.round(doneAll/totalAll*100):0;
          const clr = {"DBA":"#0ea5e9","DevOps":"#8b5cf6","Backend SIR":"#f59e0b","Frontend SIR":"#ec4899","Nuevas Tec":"#10b981","Reporteador Nayarit":"#64748b"};
          const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
            <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
              <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:12}}>AVANCE GENERAL DEL EQUIPO</div>
              {/* Global stats */}
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                {[
                  {l:"Total tareas",v:totalAll,c:"#f1f5f9"},
                  {l:"Completadas",v:doneAll,c:"#16a34a"},
                  {l:"En proceso",v:activeAll,c:"#3b82f6"},
                  {l:"Bloqueadas / Pend.",v:blockedAll,c:"#ef4444"},
                ].map(s=>(
                  <div key={s.l} style={{background:"#09090C",borderRadius:8,padding:"8px 14px",flex:1,minWidth:70,textAlign:"center"}}>
                    <div style={{color:s.c,fontSize:20,fontWeight:900}}>{s.v}</div>
                    <div style={{color:"#64748b",fontSize:9,fontWeight:600}}>{s.l}</div>
                  </div>
                ))}
              </div>
              {/* Global progress bar */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{flex:1,height:8,borderRadius:4,background:"#1A1D28",overflow:"hidden"}}>
                  <div style={{width:pctAll+"%",height:"100%",background:"linear-gradient(90deg,#16a34a,#4ade80)",borderRadius:4,transition:"width .3s"}}/>
                </div>
                <span style={{color:"#16a34a",fontSize:12,fontWeight:700,minWidth:36}}>{pctAll}%</span>
              </div>
              {/* Per-cell bars */}
              {cellData.map(c=>(
                <div key={c.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{width:4,height:20,borderRadius:2,background:clr[c.name]||"#64748b",flexShrink:0}}/>
                  <span style={{color:"#7A7F9A",fontSize:11,minWidth:110,flexShrink:0}}>{c.name}</span>
                  <div style={{flex:1,height:6,borderRadius:3,background:"#1A1D28",overflow:"hidden"}}>
                    <div style={{width:c.pct+"%",height:"100%",background:clr[c.name]||"#64748b",borderRadius:3}}/>
                  </div>
                  <span style={{color:"#7A7F9A",fontSize:10,minWidth:60,textAlign:"right"}}>{c.done}/{c.total} ({c.pct}%)</span>
                </div>
              ))}
              {/* Urgent alerts */}
              {(()=>{
                const urgents = Object.entries(cells).flatMap(([name,cell])=>
                  cell.tasks.filter(t=>["URGENTE","BLOQUEADO","BLOQUEANTE"].includes(t.status)).map(t=>({...t,cell:name}))
                );
                if (!urgents.length) return null;
                const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
                  <div style={{marginTop:12,background:"#1a0000",borderRadius:8,padding:10,border:"1px solid #7f1d1d"}}>
                    <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:6}}>⚠️ BLOQUEANTES / URGENTES ({urgents.length})</div>
                    {urgents.slice(0,5).map((t,i)=>(
                      <div key={i} style={{color:"#fca5a5",fontSize:11,marginBottom:2}}>• {t.title.substring(0,70)} — <span style={{color:"#64748b"}}>{t.cell}</span></div>
                    ))}
                    {urgents.length>5&&<div style={{color:"#7A7F9A",fontSize:10}}>...y {urgents.length-5} mas</div>}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* CELULAS */}
        <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
          <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:10}}>ESTADO POR CELULA</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {Object.entries(d.cells).map(([name,cell])=>{
              const urgent = cell.tasks.filter(t=>isRed(t.status)).length;
              const active = cell.tasks.filter(t=>isBlue(t.status)).length;
              const done   = cell.tasks.filter(t=>t.status==="COMPLETADO").length;
              const clr    = CELL_CLR[name]||"#64748b";
              const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
                <div key={name} style={{background:"#09090C",borderRadius:8,padding:10,borderLeft:"3px solid "+clr,cursor:"pointer"}}
                  onClick={()=>{setTab("celulas");setOpenCell(name);}}>
                  <div style={{color:"#E8E3D8",fontSize:13,fontWeight:600}}>{name}</div>
                  <div style={{color:"#7A7F9A",fontSize:11,marginTop:1}}>{cell.leader}</div>
                  <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}>
                    {urgent>0&&<span style={{background:"#ef4444",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{urgent} activo</span>}
                    {active>0&&<span style={{background:"#2563eb",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{active} en curso</span>}
                    {done>0&&<span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>}
                    <span style={{color:"#475569",fontSize:10}}>{cell.tasks.length} total</span>
                    {cell.tasks.filter(t=>t.id&&t.id.startsWith("nay_")).length>0&&<span style={{background:"#7f1d1d",color:"#fca5a5",borderRadius:10,padding:"1px 7px",fontSize:9}}>{cell.tasks.filter(t=>t.id&&t.id.startsWith("nay_")).length} Zoho</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {d.priorities.filter(x=>x.nextWeek).length>0&&(
          <div style={{background:"#0F1117",borderRadius:10,padding:16}}>
            <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:10}}>EN EL RADAR</div>
            {d.priorities.filter(x=>x.nextWeek).map(x=>(
              <div key={x.id} style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:"1px solid #0f172a"}}>
                <div style={{flex:1}}><div style={{color:"#E8E3D8",fontSize:12,fontWeight:500}}>{x.title}</div></div>
                <Pill status={x.status}/>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Prioridades = () => (
    <div>
      <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:10}}>PRIORIDADES ({d.priorities.length})</div>
      {d.priorities.map(x=>{
        const cfg = S[x.status]||{c:"#6b7280"};
        const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
          <div key={x.id} style={{background:"#0F1117",borderRadius:8,padding:12,marginBottom:6,borderLeft:"3px solid "+cfg.c,opacity:x.status==="COMPLETADO"?.5:1}}>
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <span style={{color:"#3E4260",fontSize:11,minWidth:24,fontWeight:700}}>{x.id}</span>
              <div style={{flex:1}}>
                <div style={{color:"#E8E3D8",fontSize:13,fontWeight:600,marginBottom:2}}>{x.title}</div>
                <div style={{color:"#7A7F9A",fontSize:11,marginBottom:6}}>👤 {x.resp} · {x.cell}</div>
                {x.notes&&<div style={{color:"#7A7F9A",fontSize:11,marginBottom:6}}>{x.notes}</div>}
                <ZLink url={x.zoho}/>
                <div style={{marginTop:8}}><StatusSel status={x.status} onChange={s=>updPrio(x.id,"status",s)}/></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const Celulas = () => (
    <div>
      {Object.entries(d.cells).map(([name,cell])=>{
        const isOpen  = openCell===name;
        const clr     = CELL_CLR[name]||"#64748b";
        const pending = cell.tasks.filter(t=>t.status!=="COMPLETADO"&&(!t.id||!t.id.startsWith("nay_"))).length;
        const zohoActive = cell.tasks.filter(t=>t.status!=="COMPLETADO"&&t.id&&t.id.startsWith("nay_")).length;
        const done    = cell.tasks.filter(t=>t.status==="COMPLETADO").length;
        const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
          <div key={name} style={{background:"#0F1117",borderRadius:12,marginBottom:10,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.15)",border:"1px solid rgba(51,65,85,0.3)"}}>
            <div onClick={()=>setOpenCell(isOpen?null:name)}
              style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",cursor:"pointer",borderLeft:"4px solid "+clr,background:isOpen?"rgba(99,102,241,0.03)":"transparent",transition:"background 0.2s"}}>
              <div style={{flex:1}}>
                <div style={{color:"#E8E3D8",fontWeight:700,fontSize:14}}>{name}</div>
                <div style={{color:"#7A7F9A",fontSize:11,marginTop:1}}>
                  {cell.leader}{cell.members&&cell.members.length>0?" · "+cell.members.join(", "):""}
                </div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{color:"#7A7F9A",fontSize:11}}>{pending} activos</span>
                {zohoActive>0&&<span style={{background:"#7f1d1d",color:"#fca5a5",borderRadius:10,padding:"1px 7px",fontSize:10}}>{zohoActive} issues</span>}
                {done>0&&<span style={{background:"#16a34a",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:10}}>{done} ok</span>}
                <span style={{color:"#3E4260",fontSize:15}}>{isOpen?"▲":"▼"}</span>
              </div>
            </div>
            {isOpen&&(
              <div style={{padding:"0 16px 14px"}}>
                {(()=>{
                  const active = cell.tasks.filter(t=>t.status!=="COMPLETADO");
                  const regular = active.filter(t=>!t.id||!t.id.startsWith("nay_"));
                  const issues  = active.filter(t=>t.id&&t.id.startsWith("nay_"));
                  const TaskRow = ({t}) => (
                    <div key={t.id} style={{padding:"9px 0",borderBottom:"1px solid #334155"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{color:"#E8E3D8",fontSize:13,fontWeight:500}}>{t.title}</span>
                      </div>
                      <div style={{color:"#7A7F9A",fontSize:11,marginBottom:6}}>👤 {t.resp}</div>
                      {t.notes&&<div style={{color:"#7A7F9A",fontSize:11,marginBottom:6}}>{t.notes}</div>}
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <StatusSel status={t.status} onChange={s=>updTask(name,t.id,"status",s)}/>
                        <ZLink url={t.zoho}/>
                        <>{confirmDel===t.id?(<span style={{display:"flex",gap:3,alignItems:"center"}}><button onClick={()=>{deleteTask(name,t.id);setConfirmDel(null);}} style={{background:"#7f1d1d",color:"#fca5a5",border:"none",borderRadius:4,padding:"2px 8px",fontSize:10,cursor:"pointer"}}>Eliminar</button><button onClick={()=>setConfirmDel(null)} style={{background:"#1A1D28",color:"#7A7F9A",border:"none",borderRadius:4,padding:"2px 6px",fontSize:10,cursor:"pointer"}}>No</button></span>):(<button onClick={()=>setConfirmDel(t.id)} style={{background:"none",border:"none",color:"#3E4260",cursor:"pointer",fontSize:10,padding:0}}>🗑</button>)}</>
                      </div>
                    </div>
                  );
                  const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (<>
                    {/* TAREAS REGULARES */}
                    {regular.map(t=><TaskRow key={t.id} t={t}/>)}

                    {/* ISSUES ZOHO */}
                    {issues.length>0&&(
                      <div style={{marginTop:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <div style={{background:"#7f1d1d",color:"#fca5a5",borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700}}>Issues Zoho — Nayarit</div>
                          <span style={{color:"#7A7F9A",fontSize:10}}>{issues.filter(t=>t.status==="LISTO_PROD").length} listos prod · {issues.filter(t=>["PENDIENTE","URGENTE","BLOQUEADO"].includes(t.status)).length} pendientes · {issues.length} total</span>
                        </div>
                        {issues.map(t=>(
                          <div key={t.id} style={{padding:"7px 0 7px 10px",borderBottom:"1px solid #2d1515",borderLeft:"3px solid #7f1d1d"}}>
                            <div style={{color:"#E8E3D8",fontSize:12,fontWeight:500}}>{t.title}</div>
                            <div style={{color:"#7A7F9A",fontSize:10,marginTop:2}}>👤 {t.resp}</div>
                            {t.notes&&<div style={{color:"#7A7F9A",fontSize:10,marginTop:2}}>{t.notes}</div>}
                            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:4}}>
                              <StatusSel status={t.status} onChange={s=>updTask(name,t.id,"status",s)}/>
                              <ZLink url={t.zoho}/>
                              <>{confirmDel===t.id?(<span style={{display:"flex",gap:3,alignItems:"center"}}><button onClick={()=>{deleteTask(name,t.id);setConfirmDel(null);}} style={{background:"#7f1d1d",color:"#fca5a5",border:"none",borderRadius:4,padding:"2px 8px",fontSize:10,cursor:"pointer"}}>Eliminar</button><button onClick={()=>setConfirmDel(null)} style={{background:"#1A1D28",color:"#7A7F9A",border:"none",borderRadius:4,padding:"2px 6px",fontSize:10,cursor:"pointer"}}>No</button></span>):(<button onClick={()=>setConfirmDel(t.id)} style={{background:"none",border:"none",color:"#3E4260",cursor:"pointer",fontSize:10,padding:0}}>🗑</button>)}</>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>);
                })()}
                {/* ADD TASK FORM */}
                <div style={{marginTop:8}}>
                  {addingTask===name?(
                    <div style={{background:"#09090C",borderRadius:8,padding:10,border:"1px solid #1E2233"}}>
                      <input placeholder="Titulo *" value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} style={{background:"#0F1117",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:"6px 8px",fontSize:12,width:"100%",boxSizing:"border-box",marginBottom:6}}/>
                      <div style={{display:"flex",gap:4,marginBottom:6}}>
                        <input placeholder="Responsable" value={taskForm.resp} onChange={e=>setTaskForm({...taskForm,resp:e.target.value})} style={{background:"#0F1117",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:"4px 8px",fontSize:11,flex:1}}/>
                        <input placeholder="Zoho URL" value={taskForm.zoho} onChange={e=>setTaskForm({...taskForm,zoho:e.target.value})} style={{background:"#0F1117",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:"4px 8px",fontSize:11,flex:1}}/>
                      </div>
                      <input placeholder="Notas" value={taskForm.notes} onChange={e=>setTaskForm({...taskForm,notes:e.target.value})} style={{background:"#0F1117",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:"4px 8px",fontSize:11,width:"100%",boxSizing:"border-box",marginBottom:6}}/>
                      {projects.length > 0 && (
                        <select value={taskForm.projectId} onChange={e=>setTaskForm({...taskForm,projectId:e.target.value})} style={{background:"#0F1117",color:taskForm.projectId?"#C9A84C":"#7A7F9A",border:"1px solid #1E2233",borderRadius:6,padding:"4px 8px",fontSize:11,width:"100%",boxSizing:"border-box",marginBottom:6,fontFamily:"system-ui,sans-serif"}}>
                          <option value="">Asociar a proyecto (opcional)</option>
                          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>addTask(name)} disabled={!taskForm.title} style={{background:taskForm.title?"#16a34a":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:taskForm.title?"pointer":"not-allowed"}}>Guardar</button>
                        <button onClick={()=>setAddingTask(null)} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
                      </div>
                    </div>
                  ):(
                    <button onClick={()=>{setAddingTask(name);setTaskForm({title:"",resp:"",status:"PENDIENTE",notes:"",zoho:"",projectId:""});}} style={{background:"#09090C",color:"#64748b",border:"1px dashed #1E2233",borderRadius:8,padding:"8px 0",width:"100%",cursor:"pointer",fontSize:11}}>+ Agregar tarea</button>
                  )}
                </div>
                {done>0&&(
                  <div style={{marginTop:10}}>
                    <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>COMPLETADOS</div>
                    {cell.tasks.filter(t=>t.status==="COMPLETADO").map(t=>(
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",opacity:.6}}>
                        <span style={{color:"#16a34a",fontSize:12}}>✓</span>
                        <span style={{color:"#7A7F9A",fontSize:11,flex:1}}>
                          {t.id&&t.id.startsWith("nay_")&&<span style={{background:"#1A1D28",color:"#9ca3af",borderRadius:4,padding:"0 5px",fontSize:8,fontWeight:700,marginRight:4}}>Issue Zoho</span>}
                          {t.title}
                        </span>
                        <StatusSel status={t.status} onChange={s=>updTask(name,t.id,"status",s)}/>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const PMO = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,letterSpacing:1}}>PMO / DIRECCION</div>
        <button onClick={()=>setNewPMO(true)} style={{background:"#166534",color:"#4ade80",border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>+ Anadir</button>
      </div>
      {newPMO&&(
        <div style={{background:"#0F1117",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #166534"}}>
          <input placeholder="Titulo *" value={pmoForm.title} onChange={e=>setPmoForm({...pmoForm,title:e.target.value})} style={{...inp,marginBottom:8}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input placeholder="Responsable" value={pmoForm.resp} onChange={e=>setPmoForm({...pmoForm,resp:e.target.value})} style={inp}/>
            <input placeholder="Area" value={pmoForm.area} onChange={e=>setPmoForm({...pmoForm,area:e.target.value})} style={inp}/>
          </div>
          <textarea placeholder="Notas" value={pmoForm.notes} onChange={e=>setPmoForm({...pmoForm,notes:e.target.value})} style={{...inp,resize:"vertical",marginBottom:8}} rows={2}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={addPmoItem} disabled={!pmoForm.title} style={{background:pmoForm.title?"#166534":"#374151",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:pmoForm.title?"pointer":"not-allowed",fontSize:12,fontWeight:600}}>Guardar</button>
            <button onClick={()=>setNewPMO(false)} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12}}>Cancelar</button>
          </div>
        </div>
      )}
      {pmoItems.map(pm=>{
        const cfg = S[pm.status]||{c:"#6b7280"};
        const isR = pm.id==="pmo8";
        const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

    return (
          <div key={pm.id} style={{background:"#0F1117",borderRadius:10,padding:14,marginBottom:10,borderLeft:"3px solid "+cfg.c,opacity:pm.status==="COMPLETADO"?.55:1}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap",marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  {isR&&<span style={{background:"#1A1D28",color:"#9ca3af",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>Interno</span>}
                  <span style={{color:"#E8E3D8",fontSize:14,fontWeight:600}}>{pm.title}</span>
                </div>
                <div style={{display:"flex",gap:12,fontSize:11,color:"#64748b",marginBottom:6,flexWrap:"wrap"}}>
                  {pm.resp&&<span>👤 {pm.resp}</span>}
                  {pm.area&&<span>🏛 {pm.area}</span>}
                  {pm.prioridad&&<span style={{color:"#fbbf24"}}>{pm.prioridad}</span>}
                </div>
                {pm.doc&&<div style={{color:"#7A7F9A",fontSize:11,marginBottom:4}}>📄 {pm.doc}</div>}
                {pm.notes&&(
                  <div style={{background:"#09090C",borderRadius:6,padding:"8px 10px",marginBottom:6}}>
                    {pm.notes.split("\n").map((line,i)=>(
                      <div key={i} style={{color:line.startsWith("Informacion restringida")?"#f87171":"#94a3b8",fontSize:11,marginBottom:1,fontWeight:line.startsWith("Informacion")?700:400}}>{line}</div>
                    ))}
                  </div>
                )}
                <IssuesTable issues={pm.issues} pmoId={pm.id}/>
              </div>
              <StatusSel status={pm.status} onChange={v=>updPmoF(pm.id,"status",v)}/>
            </div>
          </div>
        );
      })}
    </div>
  );

  const Reporte = () => (
    <div>
      {/* BACKUP / RESTORE */}
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:14}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:8}}>Respaldo de datos</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
          <button onClick={exportBackup} style={{background:"#09090C",color:"#60a5fa",border:"1px solid #1e3a5c",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>💾 Copiar backup</button>
          <button onClick={()=>setShowBackup("import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Restaurar backup</button>
        </div>
        <div style={{color:"#7A7F9A",fontSize:10,marginBottom:8}}>Copia el JSON y guardalo en un archivo. Para restaurar, pega el JSON aqui. Para importar bugs de Excel, envia el archivo a Claude.</div>
        {showBackup==="export"&&(
          <div style={{marginTop:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{color:"#22c55e",fontSize:11,fontWeight:700}}>Backup generado</span>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>{navigator.clipboard.writeText(backupJson);}} style={{background:"#1A1D28",color:"#cbd5e1",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:11}}>📋 Copiar</button>
                <button onClick={()=>setShowBackup(false)} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11}}>x</button>
              </div>
            </div>
            <textarea readOnly value={backupJson} style={{background:"#09090C",color:"#64748b",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:9,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace"}}/>
          </div>
        )}
        {showBackup==="import"&&(
          <div style={{marginTop:8}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importBackup} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Restaurar</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:32,height:32,borderRadius:6,background:"#000",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:16,flexShrink:0}}>N</div>
          <div>
            <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>Sincronizar con Notion</div>
            <div style={{color:"#7A7F9A",fontSize:11}}>Guarda el historial. Nunca borra registros anteriores.</div>
          </div>
        </div>
        {lastSync&&<div style={{color:"#7A7F9A",fontSize:11,marginBottom:8}}>Ultima sincronizacion: {lastSync}</div>}
        <button onClick={syncToNotion} disabled={syncLoading}
          style={{background:"#0F1117",color:syncLoading?"#64748b":"#f1f5f9",border:"1px solid #1E2233",borderRadius:8,padding:"9px 18px",cursor:syncLoading?"not-allowed":"pointer",fontSize:12,fontWeight:600,width:"100%",marginBottom:syncResult?8:0}}>
          {syncLoading?"Sincronizando...":"Sincronizar ahora"}
        </button>
        {syncResult&&(
          <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
            <div style={{color:"#7A7F9A",fontSize:11,whiteSpace:"pre-wrap",lineHeight:1.6}}>{syncResult}</div>
          </div>
        )}
      </div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:14}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Generar Reporte Semanal</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>El caso Navojoa interno se excluye del reporte.</div>
        <button onClick={generateReport} disabled={genLoading}
          style={{background:genLoading?"#334155":"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",cursor:genLoading?"not-allowed":"pointer",fontSize:12,fontWeight:600}}>
          {genLoading?"Generando...":"Generar con IA"}
        </button>
      </div>
      {report&&(
        <div style={{background:"#09090C",borderRadius:10,padding:16,border:"1px solid #1E2233"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{color:"#7A7F9A",fontSize:12}}>Reporte listo</span>
            <button onClick={()=>navigator.clipboard.writeText(report)} style={{background:"#1A1D28",color:"#cbd5e1",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:11}}>Copiar</button>
          </div>
          <pre style={{color:"#E8E3D8",fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word",margin:0,fontFamily:"system-ui,sans-serif"}}>{report}</pre>
        </div>
      )}
    </div>
  );

  const HistoryDiff = ({old_d, new_d, label_old, label_new}) => {
    if(!old_d||!new_d) return null;
    const oldTasks = Object.entries(old_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const newTasks = Object.entries(new_d.cells||{}).flatMap(([c,cell])=>(cell.tasks||[]).map(t=>({...t,cell:c})));
    const oldMap = new Map(oldTasks.map(t=>[t.id,t]));
    const newMap = new Map(newTasks.map(t=>[t.id,t]));
    const changed = [], added = [], removed = [];
    newTasks.forEach(t=>{
      const o = oldMap.get(t.id);
      if(!o) added.push(t);
      else if(o.status!==t.status) changed.push({title:t.title,cell:t.cell,from:S[o.status]?S[o.status].l:o.status,to:S[t.status]?S[t.status].l:t.status});
    });
    oldTasks.forEach(t=>{ if(!newMap.has(t.id)) removed.push(t); });
    return (
      <div>
        {changed.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:4}}>CAMBIOS DE ESTATUS ({changed.length})</div>
          {changed.map((c,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>• {c.title.substring(0,60)} — <span style={{color:"#ef4444"}}>{c.from}</span> → <span style={{color:"#22c55e"}}>{c.to}</span> <span style={{color:"#475569"}}>({c.cell})</span></div>)}
        </div>}
        {added.length>0&&<div style={{marginBottom:10}}>
          <div style={{color:"#16a34a",fontSize:10,fontWeight:700,marginBottom:4}}>NUEVAS TAREAS ({added.length})</div>
          {added.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>+ {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {removed.length>0&&<div>
          <div style={{color:"#ef4444",fontSize:10,fontWeight:700,marginBottom:4}}>TAREAS ELIMINADAS ({removed.length})</div>
          {removed.map((t,i)=><div key={i} style={{color:"#7A7F9A",fontSize:11,marginBottom:2}}>- {t.title.substring(0,60)} — {t.cell}</div>)}
        </div>}
        {!changed.length&&!added.length&&!removed.length&&<div style={{color:"#3E4260",fontSize:11}}>Sin cambios detectados</div>}
      </div>
    );
  };

  var Historial = () => (
    <div>
      <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Historial de Planes Semanales</div>
        <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
          <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
        </div>
        {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
        {showBackup==="history_import"&&(
          <div style={{marginBottom:10}}>
            <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
            <div style={{display:"flex",gap:4}}>
              <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
              <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
      {history.map((snap,i)=>(
        <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
              <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {(()=>{
                const sd = snap.data;
                const total = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);
                const done = Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);
                return <>
                  <span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span>
                  <span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span>
                </>;
              })()}
            </div>
            <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
          </div>
          {viewingHistory===snap&&(
            <div style={{padding:"0 16px 14px"}}>
              {/* Enfoque de esa semana */}
              <div style={{marginBottom:12}}>
                <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                {(snap.data.focus||[]).map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div>
                    <span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span>
                  </div>
                ))}
              </div>
              {/* Diff vs actual */}
              <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
              </div>
              {/* Restore button */}
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // === HISTORIAL CON CHECKPOINTS (Story 4.2) — reemplaza la definición activa ===
  var Historial = () => (
    <div>
      {/* ── CHECKPOINTS ISO ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "#7A7F9A", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>CHECKPOINTS GUARDADOS</div>
        {viewingCheckpoint !== null && (
          <>
            <div style={{ background: "rgba(201,168,76,0.1)", border: "1px solid #C9A84C", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ color: "#C9A84C", fontWeight: 600, fontSize: 12 }}>Viendo checkpoint</div>
                <div style={{ color: "#7A7F9A", fontSize: 11 }}>
                  {new Date(viewingCheckpoint.savedAt).toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} — {viewingCheckpoint.isoWeek}
                </div>
              </div>
              <button onClick={backToLive} style={{ background: "none", border: "1px solid #C9A84C", borderRadius: 6, color: "#C9A84C", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "6px 12px", minHeight: 36, whiteSpace: "nowrap" }}>← Volver al vivo</button>
            </div>
            {(() => {
              const snapTasks: any[] = Object.values(viewingCheckpoint.data?.cells || {}).flatMap((c: any) => c.tasks || []);
              const liveTasks: any[] = Object.values(d.cells || {}).flatMap((c: any) => c.tasks || []);
              const snapMap = new Map(snapTasks.map((t: any) => [t.id, t]));
              const liveMap = new Map(liveTasks.map((t: any) => [t.id, t]));
              const changed: any[] = [], added: any[] = [], removed: any[] = [];
              liveTasks.forEach((t: any) => {
                const o = snapMap.get(t.id);
                if (!o) added.push(t);
                else if (o.status !== t.status) changed.push({ title: t.title, from: S[o.status]?.l || o.status, to: S[t.status]?.l || t.status });
              });
              snapTasks.forEach((t: any) => { if (!liveMap.has(t.id)) removed.push(t); });
              const hasChanges = changed.length > 0 || added.length > 0 || removed.length > 0;
              return (
                <div style={{ background: "#111", border: "1px solid #1E2233", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                  <div style={{ color: "#7A7F9A", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>MOVIMIENTOS DE ESTADO vs. AHORA</div>
                  {!hasChanges && <div style={{ color: "#7A7F9A", fontSize: 12 }}>Sin cambios detectados</div>}
                  {changed.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ color: "#60a5fa", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>CAMBIOS ({changed.length})</div>
                      {changed.map((c, i) => (
                        <div key={i} style={{ color: "#7A7F9A", fontSize: 11, marginBottom: 2 }}>
                          • {c.title.substring(0, 55)} — <span style={{ color: "#ef4444" }}>{c.from}</span> → <span style={{ color: "#4ADE80" }}>{c.to}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {added.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ color: "#4ADE80", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>NUEVAS TAREAS ({added.length})</div>
                      {added.map((t, i) => (
                        <div key={i} style={{ color: "#7A7F9A", fontSize: 11, marginBottom: 2 }}>+ {t.title?.substring(0, 55)}</div>
                      ))}
                    </div>
                  )}
                  {removed.length > 0 && (
                    <div>
                      <div style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>ELIMINADAS ({removed.length})</div>
                      {removed.map((t, i) => (
                        <div key={i} style={{ color: "#7A7F9A", fontSize: 11, marginBottom: 2 }}>− {t.title?.substring(0, 55)}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
        {checkpointList.length === 0 ? (
          <div style={{ background: "#0F1117", border: "1px solid #1E2233", borderRadius: 8, padding: "20px 16px", textAlign: "center", color: "#7A7F9A", fontSize: 12 }}>
            Aún no hay checkpoints. Guarda el primero con el botón del header.
          </div>
        ) : (
          ([] as CheckpointSnap[]).length === 0 ? (
            <div style={{ color: "#7A7F9A", fontSize: 12, padding: "8px 0" }}>Selecciona una semana en el panel izquierdo</div>
          ) : (
            ([] as CheckpointSnap[]).map((snap, i) => {
              const isActive = viewingCheckpoint === snap;
              const savedDate = new Date(snap.savedAt);
              const label = savedDate.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" });
              const time = savedDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
              const totalTasks = Object.values(snap.data?.cells || {}).reduce((sum, c: any) => sum + (c.tasks || []).length, 0);
              const doneTasks = Object.values(snap.data?.cells || {}).reduce((sum, c: any) => sum + (c.tasks || []).filter((t: any) => t.status === "COMPLETADO" || t.status === "LISTO_PROD").length, 0);
              const diff = computeCheckpointDiff(snap.data);
              return (
                <div key={i} style={{ background: isActive ? "rgba(201,168,76,0.08)" : "#0F1117", border: `1px solid ${isActive ? "#C9A84C" : "#1E2233"}`, borderRadius: 10, marginBottom: 6, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#C9A84C" : "#1E2233", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#E8E3D8", fontWeight: 600, fontSize: 12 }}>{label}, {time}</div>
                    <div style={{ color: "#7A7F9A", fontSize: 10, marginBottom: diff.completadas > 0 || diff.enProgreso > 0 || diff.bloqueadas > 0 ? 4 : 0 }}>{snap.isoWeek} · {totalTasks} tareas · {doneTasks} completadas</div>
                    {(diff.completadas > 0 || diff.enProgreso > 0 || diff.bloqueadas > 0) && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {diff.completadas > 0 && <span style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>+{diff.completadas} completadas</span>}
                        {diff.enProgreso > 0 && <span style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>+{diff.enProgreso} en prog.</span>}
                        {diff.bloqueadas > 0 && <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>{diff.bloqueadas} bloq.</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => loadCheckpointFromSnap(snap)} disabled={isActive}
                      style={{ background: isActive ? "rgba(201,168,76,0.12)" : "none", border: `1px solid ${isActive ? "#C9A84C" : "#1E2233"}`, borderRadius: 6, color: isActive ? "#C9A84C" : "#7A7F9A", cursor: isActive ? "default" : "pointer", fontSize: 11, fontWeight: 500, padding: "5px 10px", minHeight: 32, whiteSpace: "nowrap" }}>
                      {isActive ? "Cargado" : "Cargar"}
                    </button>
                    <button
                      onClick={() => generatePdf(snap)}
                      disabled={pdfGenerating}
                      title="Descargar PDF de este checkpoint"
                      style={{ background: "none", border: "1px solid #1E2233", borderRadius: 6, color: "#7A7F9A", cursor: pdfGenerating ? "default" : "pointer", fontSize: 13, padding: "5px 9px", minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      📄
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* ── HISTORIAL LEGACY ── */}
      <div style={{ borderTop: "1px solid #1E2233", paddingTop: 16 }}>
        <div style={{ color: "#7A7F9A", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>HISTORIAL DE PLANES SEMANALES</div>
        <div style={{background:"#0F1117",borderRadius:10,padding:16,marginBottom:12}}>
          <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13,marginBottom:4}}>Snapshots Semanales</div>
          <div style={{color:"#7A7F9A",fontSize:11,marginBottom:10}}>Guarda snapshots semanales para comparar avances. Importa JSONs de semanas anteriores.</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
            <button onClick={saveToHistory} disabled={savingSnap} style={{background:savingSnap?"#374151":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:savingSnap?"not-allowed":"pointer",fontSize:11,fontWeight:600}}>{savingSnap?"Guardando...":"📸 Guardar semana actual"}</button>
            <button onClick={()=>setShowBackup("history_import")} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:11,fontWeight:600}}>📂 Importar JSON de otra semana</button>
          </div>
          {snapMsg&&<div style={{marginBottom:8,padding:"6px 10px",borderRadius:6,background:snapMsg.startsWith("✅")?"#052e16":"#2d0000",border:"1px solid "+(snapMsg.startsWith("✅")?"#166534":"#7f1d1d")}}><span style={{color:snapMsg.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:11}}>{snapMsg}</span></div>}
          {showBackup==="history_import"&&(
            <div style={{marginBottom:10}}>
              <textarea value={restoreText} onChange={e=>setRestoreText(e.target.value)} placeholder="Pega aqui el JSON del backup de otra semana..." style={{background:"#09090C",color:"#E8E3D8",border:"1px solid #1E2233",borderRadius:6,padding:8,fontSize:10,width:"100%",height:60,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",marginBottom:6}}/>
              <div style={{display:"flex",gap:4}}>
                <button onClick={importHistoryJson} disabled={!restoreText} style={{background:restoreText?"#d97706":"#374151",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:restoreText?"pointer":"not-allowed"}}>Importar al historial</button>
                <button onClick={()=>{setShowBackup(false);setRestoreText("");}} style={{background:"#272B40",color:"#fff",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
        {history.length===0&&<div style={{color:"#475569",fontSize:12,textAlign:"center",padding:20}}>No hay snapshots guardados. Guarda la semana actual o importa JSONs.</div>}
        {history.map((snap,i)=>(
          <div key={i} style={{background:"#0F1117",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
            <div onClick={()=>setViewingHistory(viewingHistory===snap?null:snap)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:snap.week===d.week?"#22C55E":"#3E4260",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{color:"#E8E3D8",fontWeight:600,fontSize:13}}>{snap.week}</div>
                <div style={{color:"#7A7F9A",fontSize:10}}>{new Date(snap.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {(()=>{const sd=snap.data;const total=Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).length,0);const done=Object.values(sd.cells||{}).reduce((s,c)=>s+(c.tasks||[]).filter(t=>t.status==="COMPLETADO"||t.status==="LISTO_PROD").length,0);return <><span style={{color:"#7A7F9A",fontSize:10}}>{total} tareas</span><span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>{done} ok</span></>;})()}
              </div>
              <span style={{color:"#3E4260",fontSize:15}}>{viewingHistory===snap?"▲":"▼"}</span>
            </div>
            {viewingHistory===snap&&(
              <div style={{padding:"0 16px 14px"}}>
                <div style={{marginBottom:12}}>
                  <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:6}}>ENFOQUE DE LA SEMANA</div>
                  {(snap.data.focus||[]).map((f,j)=>(<div key={j} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}><div style={{width:18,height:18,borderRadius:"50%",background:S[f.status]?S[f.status].c:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>{j+1}</div><span style={{color:"#E8E3D8",fontSize:11}}>{f.title}</span></div>))}
                </div>
                <div style={{background:"#09090C",borderRadius:8,padding:12,border:"1px solid #1E2233"}}>
                  <div style={{color:"#7A7F9A",fontSize:10,fontWeight:700,marginBottom:8}}>DIFERENCIAS vs SEMANA ACTUAL ({d.week})</div>
                  <HistoryDiff old_d={snap.data} new_d={d} label_old={snap.week} label_new={d.week}/>
                </div>
                <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{save(snap.data);if(snap.pmo)savePmo(snap.pmo);setViewingHistory(null);}} style={{background:"#09090C",color:"#d97706",border:"1px solid #92400e",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>⏪ Restaurar esta semana</button><span style={{color:"#3E4260",fontSize:9}}>Reemplaza datos actuales con los de esta foto. Util para volver atras si algo salio mal.</span></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  function renderLeftPanel() {
    const itemStyle = (selected: boolean): CSSProperties => ({
      display: "block",
      width: "100%",
      textAlign: "left",
      background: selected ? "rgba(201,168,76,0.09)" : "none",
      border: "none",
      borderLeft: selected ? "2px solid #C9A84C" : "2px solid transparent",
      cursor: "pointer",
      padding: "11px 16px",
      fontSize: 12,
      color: selected ? "#E8E3D8" : "#7A7F9A",
      minHeight: 44,
      fontFamily: "system-ui,sans-serif",
      transition: "color 0.15s, background 0.15s",
    });

    if (tab === "celulas") {
      const cellNames = ["Todos", ...Object.keys(d?.cells || {})];
      return (
        <div>
          {cellNames.map(name => (
            <button
              key={name}
              onClick={() => { setSelectedCell(name); setAddingCell(false); }}
              style={itemStyle(selectedCell === name && !addingCell)}
            >
              {name}
            </button>
          ))}
          <button
            onClick={() => { setAddingCell(true); setCellForm({ name:"", leader:"", members:"", color: CELL_PALETTE[0] }); }}
            style={{ ...itemStyle(addingCell), color: "#C9A84C", fontWeight: 600 }}
          >
            + Nueva célula
          </button>
        </div>
      );
    }

    if (tab === "proyectos") {
      return (
        <div>
          <button
            onClick={() => { setSelectedProject("Todos"); setAssociatingCell(""); setAssociatingTask(""); }}
            style={itemStyle(selectedProject === "Todos")}
          >
            Todos
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelectedProject(p.id); setAssociatingCell(""); setAssociatingTask(""); }}
              style={itemStyle(selectedProject === p.id)}
            >
              {p.name}
            </button>
          ))}
          {creatingProject ? (
            <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                autoFocus
                value={newProjectInput}
                onChange={e => setNewProjectInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") createProject();
                  if (e.key === "Escape") { setCreatingProject(false); setNewProjectInput(""); }
                }}
                placeholder="Nombre del proyecto"
                style={{
                  background: "#14161E",
                  border: "1px solid #C9A84C",
                  borderRadius: 4,
                  color: "#E8E3D8",
                  fontSize: 12,
                  padding: "6px 8px",
                  width: "100%",
                  fontFamily: "system-ui,sans-serif",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={createProject}
                  disabled={!newProjectInput.trim() || submittingProject}
                  aria-label="Confirmar"
                  style={{
                    flex: 1,
                    background: newProjectInput.trim() && !submittingProject ? "#C9A84C" : "#1A1D28",
                    border: "none",
                    borderRadius: 4,
                    color: newProjectInput.trim() && !submittingProject ? "#09090C" : "#3E4260",
                    cursor: newProjectInput.trim() && !submittingProject ? "pointer" : "not-allowed",
                    fontSize: 12,
                    fontWeight: 600,
                    minHeight: 32,
                  }}
                >
                  ✓
                </button>
                <button
                  onClick={() => { setCreatingProject(false); setNewProjectInput(""); }}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "1px solid #1E2233",
                    borderRadius: 4,
                    color: "#7A7F9A",
                    cursor: "pointer",
                    fontSize: 12,
                    minHeight: 32,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              <button
                onClick={() => setCreatingProject(true)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderLeft: "2px solid transparent",
                  cursor: "pointer",
                  padding: "8px 4px",
                  fontSize: 12,
                  color: "#C9A84C",
                  minHeight: 36,
                  fontFamily: "system-ui,sans-serif",
                }}
              >
                + Nuevo proyecto
              </button>
              <button
                onClick={seedProjects}
                disabled={seedingProjects || BASE_PROJECTS.every(n => projects.some(p => p.name === n))}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderLeft: "2px solid transparent",
                  cursor: seedingProjects || BASE_PROJECTS.every(n => projects.some(p => p.name === n)) ? "default" : "pointer",
                  padding: "8px 4px",
                  fontSize: 11,
                  color: BASE_PROJECTS.every(n => projects.some(p => p.name === n)) ? "#3E4260" : "#C9A84C",
                  minHeight: 36,
                  fontFamily: "system-ui,sans-serif",
                  opacity: BASE_PROJECTS.every(n => projects.some(p => p.name === n)) ? 0.5 : 1,
                }}
              >
                {seedingProjects ? "Cargando..." : "⚡ Precargar 17 base"}
              </button>
            </div>
          )}
        </div>
      );
    }

    if (tab === "pmo") {
      return (
        <div>
          <button
            onClick={() => setSelectedProject("Todos")}
            style={itemStyle(selectedProject === "Todos")}
          >
            Todos
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              style={itemStyle(selectedProject === p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      );
    }

    if (tab === "acuerdos") {
      const statusOptions = ["Todos", "PENDIENTE", "CUMPLIDO", "INCUMPLIDO", "PARCIAL"];
      const statusLabels: Record<string, string> = { Todos:"Todos", PENDIENTE:"Pendiente", CUMPLIDO:"Cumplido", INCUMPLIDO:"Incumplido", PARCIAL:"Parcial" };
      return (
        <div>
          <div style={{ padding: "12px 16px 4px", fontSize: 10, fontWeight: 600, color: "#3E4260", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Estado
          </div>
          {statusOptions.map(s => (
            <button key={s} onClick={() => setAcuerdosFilterStatus(s)} style={itemStyle(acuerdosFilterStatus === s)}>
              {statusLabels[s]}
            </button>
          ))}
          <div style={{ padding: "12px 16px 4px", fontSize: 10, fontWeight: 600, color: "#3E4260", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 8 }}>
            Semana
          </div>
          <button onClick={() => setAcuerdosFilterWeek("")} style={itemStyle(!acuerdosFilterWeek)}>Todas</button>
          {d?.isoWeek && (
            <button onClick={() => setAcuerdosFilterWeek(d.isoWeek)} style={itemStyle(acuerdosFilterWeek === d.isoWeek)}>
              Esta semana
            </button>
          )}
        </div>
      );
    }

    if (tab === "liberaciones") {
      const statusOptions = ["Todos", "EXITOSA", "CON_ERRORES", "EN_PROGRESO", "REVERTIDA"];
      const statusLabels: Record<string, string> = { Todos:"Todos", EXITOSA:"Exitosa", CON_ERRORES:"Con errores", EN_PROGRESO:"En progreso", REVERTIDA:"Revertida" };
      return (
        <div>
          <div style={{ padding: "12px 16px 4px", fontSize: 10, fontWeight: 600, color: "#3E4260", letterSpacing: "0.08em", textTransform: "uppercase" }}>Estado</div>
          {statusOptions.map(s => (
            <button key={s} onClick={() => setLibFilterStatus(s)} style={itemStyle(libFilterStatus === s)}>{statusLabels[s]}</button>
          ))}
          <div style={{ padding: "12px 16px 4px", fontSize: 10, fontWeight: 600, color: "#3E4260", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 8 }}>Proyecto</div>
          <button onClick={() => setLibFilterProject("Todos")} style={itemStyle(libFilterProject === "Todos")}>Todos</button>
          {projects.map(p => (
            <button key={p.id} onClick={() => setLibFilterProject(p.id)} style={itemStyle(libFilterProject === p.id)}>{p.name}</button>
          ))}
        </div>
      );
    }

    if (tab === "personal") {
      const tipoOptions = ["Todos", "ERROR", "ACIERTO", "COMPROMISO", "APOYO_EXTRA"];
      const tipoLabels: Record<string, string> = { Todos:"Todos", ERROR:"Errores", ACIERTO:"Aciertos", COMPROMISO:"Compromisos", APOYO_EXTRA:"Apoyo extra" };
      const celulaOptions = ["Todos", "Nóminas / SAC", "Backend SIR", "Frontend SIR", "Nuevas Tecnologías", "DBA", "DevOps", "QA", "Diseño", "Auditoría de proyectos"];
      return (
        <div>
          <div style={{ padding: "12px 16px 4px", fontSize: 10, fontWeight: 600, color: "#3E4260", letterSpacing: "0.08em", textTransform: "uppercase" }}>Vista</div>
          <button onClick={() => setPersonalView("personas")} style={itemStyle(personalView === "personas")}>Personas</button>
          <button onClick={() => setPersonalView("carga")} style={itemStyle(personalView === "carga")}>Carga por proyecto</button>
          <div style={{ padding: "12px 16px 4px", fontSize: 10, fontWeight: 600, color: "#3E4260", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 8 }}>Célula</div>
          {celulaOptions.map(c => (
            <button key={c} onClick={() => setPersonalFilterCelula(c)} style={itemStyle(personalFilterCelula === c)}>{c}</button>
          ))}
          <div style={{ padding: "12px 16px 4px", fontSize: 10, fontWeight: 600, color: "#3E4260", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 8 }}>Tipo de registro</div>
          {tipoOptions.map(t => (
            <button key={t} onClick={() => setPersonalFilterTipo(t)} style={itemStyle(personalFilterTipo === t)}>{tipoLabels[t]}</button>
          ))}
        </div>
      );
    }

    if (tab === "historial") {
      return (
        <div style={{ padding: "8px 0" }}>
          <div style={{ padding: "4px 16px 8px", color: "#7A7F9A", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
            CHECKPOINTS ({checkpointList.length})
          </div>
          {checkpointList.length === 0 ? (
            <div style={{ padding: "8px 16px", color: "#4A4F64", fontSize: 11 }}>Sin checkpoints guardados</div>
          ) : (
            checkpointList.map(cp => (
              <div key={cp.id} style={{ padding: "8px 16px", borderBottom: "1px solid #1E2233" }}>
                <div style={{ color: "#E8E3D8", fontSize: 12, fontWeight: 600 }}>{cp.week}</div>
                <div style={{ color: "#4A4F64", fontSize: 10 }}>{cp.isoWeek}</div>
              </div>
            ))
          )}
        </div>
      );
    }

    return (
      <div>
        <button style={itemStyle(true)}>Todos</button>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div style={{
      background: "#09090C",
      height: "100vh",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      color: "#E8E3D8",
      fontFamily: "system-ui,sans-serif",
    }}>
      <AppHeader
        activeTab={tab}
        onTabChange={t => { setTab(t); setSelectedCell("Todos"); setSelectedProject("Todos"); setCreatingProject(false); setNewProjectInput(""); setAssociatingCell(""); setAssociatingTask(""); setAcuerdosFilterWeek(""); setAcuerdosFilterStatus("Todos"); setLibFilterProject("Todos"); setLibFilterStatus("Todos"); setPersonalFilterCelula("Todos"); setPersonalFilterTipo("Todos"); setPersonalView("personas"); }}
        week={d?.week}
        onLogout={handleLogout}
        onRefresh={load}
        refreshing={loading}
        liveIndicatorState={liveIndicatorState}
        onSaveCheckpoint={liveIndicatorState === "checkpoint" ? generatePdf : openCheckpointDialog}
        onGeneratePdf={() => generatePdf()}
        onBackToLive={backToLive}
        pdfGenerating={pdfGenerating}
        userRole={userRole}
      />
      {tab === "home" && (
        <main style={{ flex: 1, overflowY: "auto", background: "#09090C" }}>
          <HomePage
            focusItems={d?.focus}
            week={d?.week}
            tasks={Object.entries(d?.cells || {}).flatMap(([cell, c]: [string, any]) => ((c?.tasks || []) as any[]).map(t => ({ ...t, cell })))}
            onFocusUpdate={(id, updates) => d && save({ ...d, focus: d.focus.map(x => x.id === id ? { ...x, ...updates } : x) })}
            onFocusAdd={() => d && save({ ...d, focus: [...d.focus, { id: "F" + Date.now(), title: "Nuevo enfoque", resp: "", cell: "", status: "ESTA_SEMANA", notes: "" }] })}
            onFocusDelete={(id) => { if (d) { const deletedIds = [...new Set([...(d.deletedIds||[]), id])]; save({ ...d, deletedIds, focus: d.focus.filter(x => x.id !== id) }); } }}
          />
        </main>
      )}
      {tab !== "home" && (
      <SplitLayout leftContent={renderLeftPanel()}>
        <div style={{padding: 16}}>
          {tab === "celulas" && (
            d == null ? null :
            addingCell ? (
              <div style={{ padding: "24px 0", maxWidth: 460 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E3D8", marginBottom: 2 }}>Nueva célula</div>
                <div style={{ fontSize: 11, color: "#7A7F9A", marginBottom: 20 }}>Crea un nuevo equipo para organizar y dar seguimiento a sus tareas.</div>
                <div style={{ background: "#0F1117", borderRadius: 10, padding: 16, border: "1px solid #1E2233" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", marginBottom: 6, letterSpacing: "0.06em" }}>NOMBRE *</div>
                  <input
                    autoFocus
                    placeholder="Ej. QA, Soporte, Infraestructura"
                    value={cellForm.name}
                    onChange={e => setCellForm({ ...cellForm, name: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") addCell(); }}
                    style={{ background: "#14161E", color: "#E8E3D8", border: "1px solid #1E2233", borderRadius: 6, padding: "7px 9px", fontSize: 13, width: "100%", boxSizing: "border-box", marginBottom: 12, fontFamily: "system-ui,sans-serif" }}
                  />
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", marginBottom: 6, letterSpacing: "0.06em" }}>LÍDER</div>
                  <input
                    placeholder="Responsable de la célula (opcional)"
                    value={cellForm.leader}
                    onChange={e => setCellForm({ ...cellForm, leader: e.target.value })}
                    style={{ background: "#14161E", color: "#E8E3D8", border: "1px solid #1E2233", borderRadius: 6, padding: "7px 9px", fontSize: 13, width: "100%", boxSizing: "border-box", marginBottom: 12, fontFamily: "system-ui,sans-serif" }}
                  />
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", marginBottom: 6, letterSpacing: "0.06em" }}>INTEGRANTES</div>
                  <input
                    placeholder="Separados por coma (opcional)"
                    value={cellForm.members}
                    onChange={e => setCellForm({ ...cellForm, members: e.target.value })}
                    style={{ background: "#14161E", color: "#E8E3D8", border: "1px solid #1E2233", borderRadius: 6, padding: "7px 9px", fontSize: 13, width: "100%", boxSizing: "border-box", marginBottom: 12, fontFamily: "system-ui,sans-serif" }}
                  />
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", marginBottom: 6, letterSpacing: "0.06em" }}>COLOR</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                    {CELL_PALETTE.map(c => (
                      <button
                        key={c}
                        onClick={() => setCellForm({ ...cellForm, color: c })}
                        aria-label={`Color ${c}`}
                        style={{
                          width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                          border: cellForm.color === c ? "2px solid #E8E3D8" : "2px solid transparent",
                          outline: cellForm.color === c ? `2px solid ${c}` : "none", outlineOffset: 1,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={addCell}
                      disabled={!cellForm.name.trim()}
                      style={{
                        background: cellForm.name.trim() ? "#16a34a" : "#1A1D28",
                        color: cellForm.name.trim() ? "#fff" : "#3E4260",
                        border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 600,
                        cursor: cellForm.name.trim() ? "pointer" : "not-allowed", fontFamily: "system-ui,sans-serif",
                      }}
                    >
                      Crear célula
                    </button>
                    <button
                      onClick={() => setAddingCell(false)}
                      style={{ background: "#272B40", color: "#E8E3D8", border: "none", borderRadius: 6, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: "system-ui,sans-serif" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) :
            selectedCell === "Todos" ? (
              <div style={{ padding: "24px 0" }}>
                {Object.entries(d.cells).map(([cellName, cell]) => {
                  const pending = (cell.tasks || []).filter(t => t.status !== "COMPLETADO").length;
                  const done = (cell.tasks || []).filter(t => t.status === "COMPLETADO").length;
                  const clr = cell.color || CELL_CLR[cellName] || "#64748b";
                  return (
                    <div key={cellName} onClick={() => { setSelectedCell(cellName); setAddingCell(false); }} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", background: "#0F1117",
                      border: "1px solid #1E2233", borderRadius: 10,
                      marginBottom: 6, borderLeft: `3px solid ${clr}`, cursor: "pointer",
                    }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#E8E3D8" }}>{cellName}</span>
                      <span style={{ fontSize: 11, color: "#7A7F9A" }}>{pending} activos</span>
                      {done > 0 && (
                        <span style={{ background: "rgba(34,197,94,0.12)", color: "#22C55E", borderRadius: 10, padding: "1px 8px", fontSize: 10 }}>
                          {done} ok
                        </span>
                      )}
                      <span style={{ color: "#3E4260", fontSize: 13 }}>›</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              (() => {
                const cell = d.cells[selectedCell];
                if (!cell) return null;
                const active = (cell.tasks || []).filter(t => t.status !== "COMPLETADO");
                const completed = (cell.tasks || []).filter(t => t.status === "COMPLETADO");
                return (
                  <div style={{ padding: "24px 0" }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E3D8", marginBottom: 2 }}>
                      {selectedCell}
                    </div>
                    <div style={{ fontSize: 11, color: "#7A7F9A", marginBottom: 20 }}>
                      {cell.leader}{cell.members?.length > 0 ? " · " + cell.members.join(", ") : ""}
                    </div>
                    {active.length === 0 && completed.length === 0 && (
                      <div style={{ color: "#7A7F9A", fontSize: 13, marginBottom: 16 }}>Esta célula no tiene tareas esta semana</div>
                    )}
                    <>
                        {active.map(t => {
                          const proj = projects.find(p => (p.taskRefs ?? []).some(r => r.taskId === t.id && r.cellName === selectedCell));
                          return (
                            <div key={t.id} style={{
                              padding: "12px 14px", background: "#0F1117",
                              border: "1px solid #1E2233", borderRadius: 10, marginBottom: 6,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <TaskTypeBadge zoho={t.zoho} />
                                <input
                                  key={t.id + "-title"}
                                  defaultValue={t.title}
                                  onBlur={e => { if (e.target.value.trim() !== t.title) updTask(selectedCell, t.id, "title", e.target.value.trim()); }}
                                  style={{
                                    flex: 1, background: "transparent", border: "none",
                                    borderBottom: "1px solid transparent", color: "#E8E3D8",
                                    fontSize: 13, fontWeight: 500, outline: "none", padding: 0,
                                    fontFamily: "system-ui,sans-serif", cursor: "text",
                                  }}
                                  onFocus={e => { (e.target as HTMLInputElement).style.borderBottom = "1px solid #1E2233"; }}
                                  onBlurCapture={e => { (e.target as HTMLInputElement).style.borderBottom = "1px solid transparent"; }}
                                />
                                {proj && (
                                  <span style={{
                                    fontSize: 10, color: "#C9A84C",
                                    background: "rgba(201,168,76,0.1)", borderRadius: 4,
                                    padding: "1px 6px", flexShrink: 0, whiteSpace: "nowrap",
                                  }}>
                                    {proj.name}
                                  </span>
                                )}
                              </div>
                              <input
                                key={t.id + "-resp"}
                                defaultValue={t.resp}
                                placeholder="👤 Responsable"
                                onBlur={e => { if (e.target.value !== t.resp) updTask(selectedCell, t.id, "resp", e.target.value); }}
                                style={{
                                  width: "100%", background: "transparent", border: "none",
                                  color: "#7A7F9A", fontSize: 11, outline: "none", padding: 0,
                                  marginBottom: 4, fontFamily: "system-ui,sans-serif", cursor: "text",
                                  boxSizing: "border-box",
                                }}
                              />
                              <input
                                key={t.id + "-notes"}
                                defaultValue={t.notes}
                                placeholder="Notas..."
                                onBlur={e => { if (e.target.value !== t.notes) updTask(selectedCell, t.id, "notes", e.target.value); }}
                                style={{
                                  width: "100%", background: "transparent", border: "none",
                                  color: "#7A7F9A", fontSize: 11, outline: "none", padding: 0,
                                  marginBottom: 6, fontFamily: "system-ui,sans-serif", cursor: "text",
                                  boxSizing: "border-box",
                                }}
                              />
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <StatusSel status={t.status} onChange={s => updTask(selectedCell, t.id, "status", s)} />
                                <ZLink url={t.zoho} />
                                {confirmDel === t.id ? (
                                  <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
                                    <button onClick={() => { deleteTask(selectedCell, t.id); setConfirmDel(null); }}
                                      style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>
                                      Eliminar
                                    </button>
                                    <button onClick={() => setConfirmDel(null)}
                                      style={{ background: "#1A1D28", color: "#7A7F9A", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>
                                      No
                                    </button>
                                  </span>
                                ) : (
                                  <button onClick={() => setConfirmDel(t.id)}
                                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 10, padding: 0 }}>
                                    🗑
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Formulario agregar tarea */}
                        <div style={{ marginTop: 8 }}>
                          {addingTask === selectedCell ? (
                            <div style={{ background: "#0F1117", borderRadius: 10, padding: 12, border: "1px solid #1E2233" }}>
                              <input placeholder="Título *" value={taskForm.title}
                                onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                                style={{ background: "#14161E", color: "#E8E3D8", border: "1px solid #1E2233", borderRadius: 6, padding: "6px 8px", fontSize: 12, width: "100%", boxSizing: "border-box", marginBottom: 6, fontFamily: "system-ui,sans-serif" }} />
                              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                                <input placeholder="Responsable" value={taskForm.resp}
                                  onChange={e => setTaskForm({ ...taskForm, resp: e.target.value })}
                                  style={{ background: "#14161E", color: "#E8E3D8", border: "1px solid #1E2233", borderRadius: 6, padding: "4px 8px", fontSize: 11, flex: 1, fontFamily: "system-ui,sans-serif" }} />
                                <input placeholder="Zoho URL" value={taskForm.zoho}
                                  onChange={e => setTaskForm({ ...taskForm, zoho: e.target.value })}
                                  style={{ background: "#14161E", color: "#E8E3D8", border: "1px solid #1E2233", borderRadius: 6, padding: "4px 8px", fontSize: 11, flex: 1, fontFamily: "system-ui,sans-serif" }} />
                              </div>
                              <input placeholder="Notas" value={taskForm.notes}
                                onChange={e => setTaskForm({ ...taskForm, notes: e.target.value })}
                                style={{ background: "#14161E", color: "#E8E3D8", border: "1px solid #1E2233", borderRadius: 6, padding: "4px 8px", fontSize: 11, width: "100%", boxSizing: "border-box", marginBottom: 6, fontFamily: "system-ui,sans-serif" }} />
                              {projects.length > 0 && (
                                <select
                                  value={taskForm.projectId}
                                  onChange={e => setTaskForm({ ...taskForm, projectId: e.target.value })}
                                  style={{ background: "#14161E", color: taskForm.projectId ? "#C9A84C" : "#7A7F9A", border: "1px solid #1E2233", borderRadius: 6, padding: "4px 8px", fontSize: 11, width: "100%", boxSizing: "border-box", marginBottom: 6, fontFamily: "system-ui,sans-serif" }}
                                >
                                  <option value="">Asociar a proyecto (opcional)</option>
                                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                              )}
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={() => addTask(selectedCell)} disabled={!taskForm.title}
                                  style={{ background: taskForm.title ? "#C9A84C" : "#1A1D28", color: taskForm.title ? "#09090C" : "#3E4260", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: taskForm.title ? "pointer" : "not-allowed", fontFamily: "system-ui,sans-serif" }}>
                                  Guardar
                                </button>
                                <button onClick={() => setAddingTask(null)}
                                  style={{ background: "#14161E", color: "#7A7F9A", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "system-ui,sans-serif" }}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingTask(selectedCell); setTaskForm({ title: "", resp: "", status: "PENDIENTE", notes: "", zoho: "", projectId: "" }); }}
                              style={{ background: "#0F1117", color: "#3E4260", border: "1px dashed #1E2233", borderRadius: 10, padding: "8px 0", width: "100%", cursor: "pointer", fontSize: 11, fontFamily: "system-ui,sans-serif" }}>
                              + Agregar tarea
                            </button>
                          )}
                        </div>

                        {/* Completadas */}
                        {completed.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                              COMPLETADAS ({completed.length})
                            </div>
                            {completed.map(t => (
                              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", opacity: 0.6 }}>
                                <span style={{ color: "#22C55E", fontSize: 12 }}>✓</span>
                                <span style={{ color: "#7A7F9A", fontSize: 11, flex: 1 }}>{t.title}</span>
                                <StatusSel status={t.status} onChange={s => updTask(selectedCell, t.id, "status", s)} />
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                  </div>
                );
              })()
            )
          )}
          {/* === TAB: PROYECTOS === */}
          {tab === "proyectos" && (
            selectedProject === "Todos" ? (
              <div style={{ padding: "16px 0" }}>
                <DashboardTab
                  projects={projects}
                  d={d}
                  pmoItems={pmoItems}
                  onSelectProject={id => { setSelectedProject(id); setAssociatingCell(""); setAssociatingTask(""); }}
                />
              </div>
            ) : (
              <div style={{ padding: "24px 0" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E3D8", marginBottom: 20 }}>
                  {projects.find(p => p.id === selectedProject)?.name ?? "—"}
                </div>
                {(() => {
                  const project = projects.find(p => p.id === selectedProject);
                  const refs = project?.taskRefs ?? [];
                  if (refs.length === 0) {
                    return (
                      <div style={{ color: "#7A7F9A", fontSize: 13, marginBottom: 24 }}>
                        No hay tareas registradas para este proyecto
                      </div>
                    );
                  }
                  const groups: Record<string, { taskId: string; cellName: string }[]> = {};
                  refs.forEach(r => {
                    if (!groups[r.cellName]) groups[r.cellName] = [];
                    groups[r.cellName].push(r);
                  });
                  return Object.entries(groups).map(([cellName, cellRefs]) => {
                    const cellTasks = (d?.cells?.[cellName]?.tasks ?? []) as { id: string; title: string; resp: string; status: string; zoho: string }[];
                    const tasks = cellRefs
                      .map(r => cellTasks.find(t => t.id === r.taskId))
                      .filter((t): t is NonNullable<typeof t> => t !== undefined);
                    if (tasks.length === 0) return null;
                    return (
                      <div key={cellName} style={{ marginBottom: 20 }}>
                        <div style={{
                          fontSize: 10, fontWeight: 600, color: "#3E4260",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          marginBottom: 6,
                        }}>
                          {cellName} — {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}
                        </div>
                        {tasks.map(task => (
                          <div key={task.id} style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "10px 14px",
                            background: "#0F1117",
                            border: "1px solid #1E2233",
                            borderRadius: 10,
                            marginBottom: 4,
                          }}>
                            <TaskTypeBadge zoho={task.zoho} />
                            <span style={{
                              display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                              background: (S as Record<string, {l:string;c:string}>)[task.status]?.c ?? "#3E4260",
                              flexShrink: 0,
                            }} />
                            <span style={{
                              flex: 1, fontSize: 13, color: "#E8E3D8",
                              minWidth: 0, overflow: "hidden",
                              textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {task.title}
                            </span>
                            <span style={{ fontSize: 11, color: "#7A7F9A", whiteSpace: "nowrap", flexShrink: 0 }}>
                              {task.resp}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
                {/* Association UI */}
                {(() => {
                  const project = projects.find(p => p.id === selectedProject);
                  const associatedIds = new Set((project?.taskRefs ?? []).map(r => r.taskId));
                  const cellOptions = Object.keys(d?.cells || {});
                  const tasksInCell = associatingCell
                    ? ((d?.cells?.[associatingCell]?.tasks ?? []) as { id: string; title: string }[]).filter(t => !associatedIds.has(t.id))
                    : [];
                  return (
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #1E2233" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", marginBottom: 10, letterSpacing: "0.06em" }}>
                        ASOCIAR TAREA
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <select
                          value={associatingCell}
                          onChange={e => { setAssociatingCell(e.target.value); setAssociatingTask(""); }}
                          style={{
                            background: "#14161E", border: "1px solid #1E2233", borderRadius: 6,
                            color: "#E8E3D8", fontSize: 12, padding: "6px 8px",
                            fontFamily: "system-ui,sans-serif",
                          }}
                        >
                          <option value="">Célula...</option>
                          {cellOptions.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <select
                          value={associatingTask}
                          onChange={e => setAssociatingTask(e.target.value)}
                          disabled={!associatingCell || tasksInCell.length === 0}
                          style={{
                            background: "#14161E", border: "1px solid #1E2233", borderRadius: 6,
                            color: associatingCell && tasksInCell.length > 0 ? "#E8E3D8" : "#7A7F9A",
                            fontSize: 12, padding: "6px 8px", flex: 1, minWidth: 160,
                            fontFamily: "system-ui,sans-serif",
                          }}
                        >
                          <option value="">{tasksInCell.length === 0 && associatingCell ? "Sin tareas disponibles" : "Tarea..."}</option>
                          {tasksInCell.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.title.length > 55 ? t.title.slice(0, 55) + "…" : t.title}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={associateTask}
                          disabled={!associatingCell || !associatingTask || submittingAssociation}
                          style={{
                            background: associatingCell && associatingTask && !submittingAssociation ? "#C9A84C" : "#1A1D28",
                            border: "none", borderRadius: 6,
                            color: associatingCell && associatingTask && !submittingAssociation ? "#09090C" : "#3E4260",
                            cursor: associatingCell && associatingTask && !submittingAssociation ? "pointer" : "not-allowed",
                            fontSize: 12, fontWeight: 600, padding: "6px 14px", minHeight: 32,
                            fontFamily: "system-ui,sans-serif",
                          }}
                        >
                          Asociar
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {/* === NUEVA TAREA DIRECTA === */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1E2233" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#3E4260", marginBottom: 10, letterSpacing: "0.06em" }}>
                    NUEVA TAREA
                  </div>
                  {!creatingTaskForProject ? (
                    <button
                      onClick={() => setCreatingTaskForProject(true)}
                      style={{
                        background: "none", border: "1px dashed #2E2E2E", borderRadius: 6,
                        color: "#7A7F9A", cursor: "pointer", fontSize: 11,
                        padding: "7px 14px", width: "100%",
                      }}
                    >
                      + Crear tarea y asociar a este proyecto
                    </button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <select
                        value={newTaskCell}
                        onChange={e => setNewTaskCell(e.target.value)}
                        style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 4, color: "#E8E3D8", fontSize: 12, padding: "6px 8px", fontFamily: "system-ui,sans-serif" }}
                      >
                        <option value="">Célula...</option>
                        {Object.keys(d?.cells || {}).map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <input
                        placeholder="Título de la tarea *"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 4, color: "#E8E3D8", fontSize: 12, padding: "6px 8px", fontFamily: "system-ui,sans-serif" }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          placeholder="Responsable"
                          value={newTaskResp}
                          onChange={e => setNewTaskResp(e.target.value)}
                          style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 4, color: "#E8E3D8", fontSize: 12, padding: "6px 8px", flex: 1, fontFamily: "system-ui,sans-serif" }}
                        />
                        <select
                          value={newTaskStatus}
                          onChange={e => setNewTaskStatus(e.target.value)}
                          style={{ background: "#14161E", border: "1px solid #1E2233", borderRadius: 4, color: "#E8E3D8", fontSize: 12, padding: "6px 8px", fontFamily: "system-ui,sans-serif" }}
                        >
                          {["PENDIENTE","EN_CURSO","ESTA_SEMANA","ALTA_PRIORIDAD","URGENTE","BLOQUEADO","COMPLETADO"].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={createAndAssociateTask}
                          disabled={!newTaskTitle.trim() || !newTaskCell}
                          style={{
                            background: newTaskTitle.trim() && newTaskCell ? "#C9A84C" : "#1A1D28",
                            border: "none", borderRadius: 4,
                            color: newTaskTitle.trim() && newTaskCell ? "#09090C" : "#3E4260",
                            cursor: newTaskTitle.trim() && newTaskCell ? "pointer" : "not-allowed",
                            fontSize: 12, fontWeight: 600, padding: "6px 14px", flex: 1,
                          }}
                        >
                          Guardar tarea
                        </button>
                        <button
                          onClick={() => { setCreatingTaskForProject(false); setNewTaskTitle(""); setNewTaskResp(""); setNewTaskCell(""); setNewTaskStatus("PENDIENTE"); }}
                          style={{ background: "none", border: "1px solid #1E2233", borderRadius: 4, color: "#7A7F9A", cursor: "pointer", fontSize: 12, padding: "6px 12px" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {/* === SECCION PMO OPERATIVO en vista de proyecto === */}
                {(() => {
                  const pmoTasks = checklistItems.filter(x => x.projectId === selectedProject);
                  if (pmoTasks.length === 0) return null;
                  const activePmo = pmoTasks.filter(x => x.status !== "COMPLETADO");
                  const completedPmo = pmoTasks.filter(x => x.status === "COMPLETADO");
                  return (
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #1E2233" }}>
                      <div style={{
                        fontSize: 11, fontWeight: 600, color: "#7A7F9A",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        marginBottom: 8,
                      }}>
                        PMO OPERATIVO — {pmoTasks.length} {pmoTasks.length === 1 ? "tarea" : "tareas"}
                      </div>
                      {activePmo.map(item => (
                        <div key={item.id} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "10px 12px",
                          background: "#0F1117",
                          border: "1px solid #1E2233",
                          borderRadius: 6,
                          marginBottom: 4,
                        }}>
                          <TaskTypeBadge zoho="" />
                          <span style={{
                            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                            background: (S as Record<string, { l: string; c: string }>)[item.status]?.c ?? "#9ca3af",
                            flexShrink: 0,
                          }} />
                          <span style={{
                            flex: 1, fontSize: 13, color: "#E8E3D8",
                            minWidth: 0, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: 10, color: "#7A7F9A", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {(S as Record<string, { l: string; c: string }>)[item.status]?.l ?? item.status}
                          </span>
                        </div>
                      ))}
                      {completedPmo.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          {completedPmo.map(item => (
                            <div key={item.id} style={{
                              display: "flex", alignItems: "flex-start", gap: 8,
                              padding: "10px 12px",
                              background: "#0F1117",
                              border: "1px solid #1E2233",
                              borderRadius: 6,
                              marginBottom: 4,
                              opacity: 0.6,
                            }}>
                              <TaskTypeBadge zoho="" />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{
                                  fontSize: 13, color: "#E8E3D8",
                                  textDecoration: "line-through",
                                  display: "block",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  {item.title}
                                </span>
                                {item.completedAt && (
                                  <span style={{ fontSize: 10, color: "#4ADE80", display: "block", marginTop: 2 }}>
                                    Completada: {new Date(item.completedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )
          )}
          {/* === TAB: CHECKLIST PMO === */}
          {tab === "pmo" && (
            <div style={{ padding: "24px 0" }}>
              {/* PMOCaptureInput — siempre visible al tope */}
              <div style={{
                display: "flex", gap: 8, alignItems: "center",
                marginBottom: 20,
                position: "sticky", top: 0,
                background: "#09090C",
                paddingTop: 4, paddingBottom: 12,
                zIndex: 10,
                borderBottom: "1px solid #1E2233",
              }}>
                <input
                  ref={captureInputRef}
                  value={checklistCapture}
                  onChange={e => setChecklistCapture(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addChecklistItem(); }}
                  placeholder="Nueva tarea PMO..."
                  autoComplete="off"
                  style={{
                    flex: 1,
                    background: "#0F1117",
                    border: "1px solid #1E2233",
                    borderRadius: 8,
                    color: "#E8E3D8",
                    fontSize: 13,
                    padding: "10px 12px",
                    outline: "none",
                    fontFamily: "system-ui,sans-serif",
                    minHeight: 44,
                    boxSizing: "border-box",
                  }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#C9A84C"; }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#1E2233"; }}
                />
                <button
                  onClick={addChecklistItem}
                  disabled={!checklistCapture.trim()}
                  style={{
                    background: checklistCapture.trim() ? "#C9A84C" : "#1A1D28",
                    color: checklistCapture.trim() ? "#09090C" : "#3E4260",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: checklistCapture.trim() ? "pointer" : "not-allowed",
                    minHeight: 44,
                    minWidth: 44,
                    fontFamily: "system-ui,sans-serif",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  + Agregar
                </button>
              </div>

              {/* Lista filtrada por proyecto */}
              {(()=>{
                const visibleItems = selectedProject === "Todos"
                  ? checklistItems
                  : checklistItems.filter(x => x.projectId === selectedProject);
                const activeItems = visibleItems.filter(x => x.status !== "COMPLETADO");
                const completedItems = visibleItems.filter(x => x.status === "COMPLETADO");

                if (visibleItems.length === 0) {
                  return (
                    <div style={{ color: "#7A7F9A", fontSize: 13, textAlign: "center", paddingTop: 32 }}>
                      {selectedProject === "Todos"
                        ? "Sin pendientes PMO — usa el campo de arriba para agregar uno"
                        : "No hay tareas PMO para este proyecto"}
                    </div>
                  );
                }

                const renderCard = (item, isCompleted: boolean) => {
                  const createdDate = new Date(item.createdAt);
                  const now = new Date();
                  const diffMin = Math.floor((now.getTime() - createdDate.getTime()) / 60000);
                  const timeLabel = diffMin < 1 ? "ahora"
                    : diffMin < 60 ? `hace ${diffMin} min`
                    : diffMin < 1440 ? `hace ${Math.floor(diffMin / 60)}h`
                    : createdDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
                  const projectName = item.projectId ? projects.find(p => p.id === item.projectId)?.name : null;

                  return (
                    <div key={item.id} style={{
                      padding: "10px 12px",
                      background: "#0F1117",
                      border: "1px solid #1E2233",
                      borderRadius: 6,
                      marginBottom: 4,
                      opacity: isCompleted ? 0.6 : 1,
                    }}>
                      {/* Fila 1: badge tipo + título editable + timestamp */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <TaskTypeBadge zoho="" />
                        <input
                          key={item.id + "-title"}
                          defaultValue={item.title}
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val && val !== item.title) {
                              saveChecklist(checklistItems.map(x => x.id === item.id ? { ...x, title: val } : x));
                            } else if (!val) {
                              e.target.value = item.title;
                            }
                          }}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#E8E3D8",
                            fontSize: 13,
                            fontFamily: "system-ui,sans-serif",
                            cursor: "text",
                            textDecoration: isCompleted ? "line-through" : "none",
                            padding: 0,
                            minWidth: 0,
                          }}
                        />
                        <span style={{ fontSize: 10, color: "#7A7F9A", flexShrink: 0 }}>
                          {timeLabel}
                        </span>
                      </div>

                      {/* Fila 2: StatusSel + selector proyecto + badge proyecto + 🗑 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <StatusSel
                          status={item.status}
                          onChange={s => saveChecklist(
                            checklistItems.map(x => x.id === item.id
                              ? { ...x, status: s, ...(s === "COMPLETADO" ? { completedAt: new Date().toISOString() } : { completedAt: undefined }) }
                              : x
                            )
                          )}
                        />
                        <select
                          value={item.projectId || ""}
                          onChange={e => saveChecklist(
                            checklistItems.map(x => x.id === item.id ? { ...x, projectId: e.target.value || undefined } : x)
                          )}
                          style={{
                            background: "#14161E",
                            color: item.projectId ? "#C9A84C" : "#7A7F9A",
                            border: "1px solid #1E2233",
                            borderRadius: 6,
                            fontSize: 10,
                            padding: "2px 6px",
                            cursor: "pointer",
                            outline: "none",
                            fontFamily: "system-ui,sans-serif",
                            maxWidth: 120,
                          }}
                        >
                          <option value="">Sin proyecto</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {projectName && (
                          <span style={{
                            background: "rgba(201,168,76,0.15)",
                            color: "#C9A84C",
                            border: "1px solid rgba(201,168,76,0.3)",
                            borderRadius: 10,
                            padding: "1px 8px",
                            fontSize: 10,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}>
                            {projectName}
                          </span>
                        )}
                        {confirmDel === item.id ? (
                          <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
                            <button onClick={() => deleteChecklistItem(item.id)}
                              style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>
                              Eliminar
                            </button>
                            <button onClick={() => setConfirmDel(null)}
                              style={{ background: "#334155", color: "#94a3b8", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>
                              No
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmDel(item.id)}
                            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 10, padding: 0, marginLeft: "auto" }}>
                            🗑
                          </button>
                        )}
                      </div>

                      {/* Fecha de cierre (solo completadas) */}
                      {isCompleted && item.completedAt && (
                        <div style={{ marginTop: 4, fontSize: 10, color: "#4ADE80" }}>
                          ✓ Completada: {new Date(item.completedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <div>
                    {activeItems.map(item => renderCard(item, false))}
                    {completedItems.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{
                          fontSize: 10, fontWeight: 600, color: "#7A7F9A",
                          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
                        }}>
                          COMPLETADAS ({completedItems.length})
                        </div>
                        {completedItems.map(item => renderCard(item, true))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Items estratégicos PMO (Plan PMO del reporte PDF) ── */}
              {pmoItems.length > 0 && (
                <div style={{ marginTop: 32, borderTop: "1px solid #1E2233", paddingTop: 20 }}>
                  {PMO()}
                </div>
              )}
            </div>
          )}
          {tab === "acuerdos" && (
            <AcuerdosTab
              currentWeek={d?.isoWeek ?? ""}
              projects={projects}
              filterWeek={acuerdosFilterWeek}
              filterStatus={acuerdosFilterStatus}
            />
          )}
          {tab === "liberaciones" && (
            <LiberacionesTab
              projects={projects}
              filterProject={libFilterProject}
              filterStatus={libFilterStatus}
            />
          )}
          {tab === "personal" && userRole === "pmo" && (
            <PersonalTab
              projects={projects}
              filterCelula={personalFilterCelula}
              filterTipo={personalFilterTipo}
              view={personalView}
            />
          )}
          {tab === "historial" && (
            <CheckpointTimeline
              checkpoints={checkpointList}
              currentWeek={d?.isoWeek}
              onGeneratePdf={generatePdf}
              onDeleteCheckpoint={deleteCheckpoint}
              pdfGenerating={pdfGenerating}
            />
          )}
        </div>
      </SplitLayout>
      )}
    </div>

    {/* ── MODAL: Editar semana del checkpoint ─────────────────────────── */}
    {editWeek && (
      <div
        onClick={() => setEditWeek(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: "#0F1117",
            border: "1px solid #1E2233",
            borderRadius: 16,
            padding: "28px 32px",
            width: 420,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px #C9A84C18",
          }}
        >
          {/* header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E3D8", marginBottom: 4 }}>
              Guardar Checkpoint
            </div>
            <div style={{ fontSize: 11, color: "#4A4F64" }}>
              Edita el rango de semana antes de guardar. Este nombre aparecerá en el historial.
            </div>
          </div>

          {/* label */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "#7A7F9A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            Rango de semana
          </div>

          {/* input */}
          <input
            autoFocus
            value={weekVal}
            onChange={e => setWeekVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmCheckpoint(); if (e.key === "Escape") setEditWeek(false); }}
            placeholder="ej. 26 May — 1 Jun 2026"
            style={{
              width: "100%",
              background: "#14161E",
              border: "1px solid #272B40",
              borderRadius: 8,
              color: "#E8E3D8",
              fontSize: 14,
              fontWeight: 500,
              padding: "10px 14px",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: 6,
              fontFamily: "inherit",
            }}
          />
          <div style={{ fontSize: 10, color: "#3E4260", marginBottom: 24 }}>
            Valor actual en el sistema: <span style={{ color: "#C9A84C" }}>{d?.week}</span>
          </div>

          {/* acciones */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => setEditWeek(false)}
              style={{
                background: "none", border: "1px solid #1E2233",
                borderRadius: 8, color: "#7A7F9A",
                cursor: "pointer", fontSize: 12, fontWeight: 500,
                padding: "8px 18px", fontFamily: "inherit",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmCheckpoint}
              disabled={!weekVal.trim()}
              style={{
                background: weekVal.trim() ? "#C9A84C18" : "none",
                border: `1px solid ${weekVal.trim() ? "#C9A84C" : "#3E4260"}`,
                borderRadius: 8,
                color: weekVal.trim() ? "#C9A84C" : "#3E4260",
                cursor: weekVal.trim() ? "pointer" : "default",
                fontSize: 12, fontWeight: 700,
                padding: "8px 20px", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              Guardar Checkpoint
            </button>
          </div>
        </div>
      </div>
    )}

    </TooltipProvider>
  );
}
