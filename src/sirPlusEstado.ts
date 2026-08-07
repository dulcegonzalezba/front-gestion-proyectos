/**
 * Estado compartido de la Radiografía SIR Plus.
 *
 * Un solo mapa `itemId -> { estado, evidencia, resp }` que persiste en el KV del
 * backend (compartido por todo el equipo) con respaldo en localStorage para que
 * el panel siga siendo usable si el API no responde.
 *
 * Lo consumen el panel de capas del inicio (SirPlusPanel) y la página de
 * radiografía (RadiografiaSIR): marcar algo en uno se refleja en el otro.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "./storage";

export const SIRPLUS_KEY = "sirplus_estado_v1";

// ── Semáforo ──────────────────────────────────────────────────────────────────
export type EstadoKey =
  | "sin_verificar"  // nadie lo ha revisado — estado por defecto de todo
  | "riesgo"         // no lo tenemos, o lo tenemos mal: hay que actuar
  | "parcial"        // existe pero incompleto o sin evidencia que lo respalde
  | "proceso"        // se está implementando ahora mismo
  | "ok"             // verificado y con evidencia documentada
  | "na";            // no aplica a este proyecto

export interface EstadoMeta {
  label: string;
  color: string;
  bg: string;
  desc: string;
}

export const ESTADOS: Record<EstadoKey, EstadoMeta> = {
  sin_verificar: { label: "Sin verificar", color: "#64748B", bg: "#141821", desc: "Nadie lo ha revisado todavía" },
  riesgo:        { label: "En riesgo",     color: "#EF4444", bg: "#1A0A0A", desc: "No lo tenemos o está mal — requiere acción" },
  parcial:       { label: "Parcial",       color: "#F59E0B", bg: "#1A1200", desc: "Existe pero incompleto o sin evidencia" },
  proceso:       { label: "En proceso",    color: "#3B82F6", bg: "#0A0F1A", desc: "Se está implementando ahora" },
  ok:            { label: "Verificado",    color: "#22C55E", bg: "#0A1A0F", desc: "Comprobado y con evidencia documentada" },
  na:            { label: "No aplica",     color: "#7C3AED", bg: "#120A1A", desc: "No aplica para este proyecto" },
};

/** Orden del ciclo al hacer clic sobre un semáforo. */
export const CICLO: EstadoKey[] = ["sin_verificar", "riesgo", "parcial", "proceso", "ok", "na"];

/** Peor estado gana: así el color de un nodo/capa resume lo que hay debajo. */
const SEVERIDAD: Record<EstadoKey, number> = {
  riesgo: 5, parcial: 4, sin_verificar: 3, proceso: 2, ok: 1, na: 0,
};

export function resumirEstados(estados: EstadoKey[]): EstadoKey {
  const reales = estados.filter(e => e !== "na");
  if (!reales.length) return estados.length ? "na" : "sin_verificar";
  return reales.reduce((peor, e) => (SEVERIDAD[e] > SEVERIDAD[peor] ? e : peor), "ok" as EstadoKey);
}

export interface ItemEstado {
  estado: EstadoKey;
  /** Con qué se comprobó: liga, folio de Zoho, nombre del documento, etc. */
  evidencia?: string;
  /** Quién responde por este punto. */
  resp?: string;
  /** Fecha ISO de la última actualización. */
  upd?: string;
}

export type EstadoMap = Record<string, ItemEstado>;

export function estadoDe(map: EstadoMap, id: string): EstadoKey {
  return map[id]?.estado ?? "sin_verificar";
}

// ── Hook de persistencia ──────────────────────────────────────────────────────

export type SyncState = "cargando" | "listo" | "guardando" | "local";

export function useSirPlusEstado() {
  const [map, setMap] = useState<EstadoMap>({});
  const [sync, setSync] = useState<SyncState>("cargando");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<EstadoMap | null>(null);

  // Carga inicial: KV del backend y, si falla, respaldo local.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const local = (() => {
        try { return JSON.parse(localStorage.getItem(SIRPLUS_KEY) || "{}") as EstadoMap; }
        catch { return {} as EstadoMap; }
      })();
      const remoto = await storage.get(SIRPLUS_KEY);
      if (!vivo) return;
      if (remoto?.value) {
        try {
          setMap(JSON.parse(remoto.value) as EstadoMap);
          setSync("listo");
          return;
        } catch { /* valor corrupto: seguimos con el respaldo local */ }
      }
      setMap(local);
      setSync(remoto ? "listo" : "local");
    })();
    return () => { vivo = false; };
  }, []);

  const persistir = useCallback((next: EstadoMap) => {
    try { localStorage.setItem(SIRPLUS_KEY, JSON.stringify(next)); } catch { /* cuota llena */ }
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    setSync("guardando");
    timer.current = setTimeout(async () => {
      const payload = pending.current;
      if (!payload) return;
      const res = await storage.set(SIRPLUS_KEY, JSON.stringify(payload));
      setSync(res ? "listo" : "local");
    }, 600);
  }, []);

  const actualizar = useCallback((id: string, cambios: Partial<ItemEstado>) => {
    setMap(prev => {
      const next: EstadoMap = {
        ...prev,
        [id]: {
          estado: "sin_verificar",
          ...prev[id],
          ...cambios,
          upd: new Date().toISOString(),
        },
      };
      persistir(next);
      return next;
    });
  }, [persistir]);

  const ciclar = useCallback((id: string) => {
    setMap(prev => {
      const actual = prev[id]?.estado ?? "sin_verificar";
      const siguiente = CICLO[(CICLO.indexOf(actual) + 1) % CICLO.length];
      const next: EstadoMap = {
        ...prev,
        [id]: { ...prev[id], estado: siguiente, upd: new Date().toISOString() },
      };
      persistir(next);
      return next;
    });
  }, [persistir]);

  return { map, sync, actualizar, ciclar };
}
