/**
 * ListaChecks — los puntos a considerar de un nodo, con su método de
 * comprobación, su semáforo y los campos de evidencia y responsable.
 *
 * Lo comparten el panel del inicio (SirPlusPanel, en su cajón de detalle) y la
 * radiografía (RadiografiaSIR, desplegado dentro de cada capa), para que un
 * punto se vea y se edite igual desde donde se abra.
 */

import { FUENTE_META, type Check, type Nodo } from "./sirPlusCapas";
import { ESTADOS, CICLO, estadoDe, type EstadoKey, type EstadoMap } from "./sirPlusEstado";

const T = {
  card: "#0F1117", surface: "#14161E",
  border: "#1E2233", borderLt: "#272B40",
  text1: "#E8E3D8", text2: "#7A7F9A", text3: "#3E4260",
};

export function Punto({ estado, size = 10 }: { estado: EstadoKey; size?: number }) {
  const m = ESTADOS[estado];
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: m.color, display: "inline-block",
      boxShadow: estado === "riesgo" ? `0 0 8px ${m.color}` : "none",
    }} />
  );
}

export function BotonEstado({ estado, onClick, compacto }: { estado: EstadoKey; onClick: () => void; compacto?: boolean }) {
  const m = ESTADOS[estado];
  return (
    <button
      onClick={onClick}
      title={`${m.label} — ${m.desc}. Clic para cambiar.`}
      style={{
        display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
        background: m.bg, border: `1px solid ${m.color}55`, borderRadius: 20,
        padding: compacto ? "2px 8px" : "4px 11px",
        color: m.color, fontSize: compacto ? 9 : 10, fontWeight: 700,
        whiteSpace: "nowrap", flexShrink: 0, fontFamily: "system-ui,sans-serif",
      }}
    >
      <Punto estado={estado} size={compacto ? 6 : 7} />
      {m.label}
    </button>
  );
}

export interface ListaChecksProps {
  nodo: Nodo;
  map: EstadoMap;
  onCiclar: (id: string) => void;
  onActualizar: (id: string, cambios: { evidencia?: string; resp?: string; estado?: EstadoKey }) => void;
  /** Fondo de cada tarjeta. En el cajón se usa el color de tarjeta; embebido, el de superficie. */
  fondo?: string;
}

export default function ListaChecks({ nodo, map, onCiclar, onActualizar, fondo }: ListaChecksProps) {
  const inp: React.CSSProperties = {
    background: "#09090C", color: T.text1, border: `1px solid ${T.border}`,
    borderRadius: 6, padding: "5px 8px", fontSize: 11, width: "100%",
    boxSizing: "border-box", fontFamily: "system-ui,sans-serif", outline: "none",
  };

  return (
    <>
      {nodo.checks.map((c: Check) => {
        const est = estadoDe(map, c.id);
        const item = map[c.id];
        const f = FUENTE_META[c.fuente];
        return (
          <div key={c.id} style={{
            background: fondo ?? T.card,
            border: `1px solid ${est === "sin_verificar" ? T.border : ESTADOS[est].color + "35"}`,
            borderRadius: 10, padding: "13px 14px", marginBottom: 10,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 9 }}>
              <div style={{ flex: 1, fontSize: 12, color: T.text1, fontWeight: 600, lineHeight: 1.5 }}>
                {c.label}
              </div>
              <span title={f.titulo} style={{
                fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                background: f.color + "18", color: f.color, border: `1px solid ${f.color}35`,
                whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.04em",
              }}>
                {f.label}
              </span>
            </div>

            <div style={{
              fontSize: 10.5, color: T.text2, lineHeight: 1.6,
              paddingLeft: 10, borderLeft: `2px solid ${T.borderLt}`, marginBottom: 11,
            }}>
              <span style={{ color: T.text3, fontWeight: 700 }}>Cómo se verifica: </span>
              {c.verifica}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <BotonEstado estado={est} onClick={() => onCiclar(c.id)} />
              {CICLO.filter(e => e !== est).map(e => (
                <button key={e} onClick={() => onActualizar(c.id, { estado: e })} title={ESTADOS[e].desc}
                  style={{
                    width: 14, height: 14, borderRadius: "50%", cursor: "pointer",
                    background: "transparent", border: `2px solid ${ESTADOS[e].color}`,
                    opacity: 0.45, padding: 0, flexShrink: 0,
                  }} />
              ))}
              {item?.upd && (
                <span style={{ fontSize: 9, color: T.text3, marginLeft: "auto" }}>
                  {new Date(item.upd).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 6 }}>
              <input
                style={inp}
                placeholder="Evidencia: documento, folio de Zoho, liga…"
                defaultValue={item?.evidencia ?? ""}
                onBlur={e => { if (e.target.value !== (item?.evidencia ?? "")) onActualizar(c.id, { evidencia: e.target.value }); }}
              />
              <input
                style={inp}
                placeholder="Responsable"
                defaultValue={item?.resp ?? ""}
                onBlur={e => { if (e.target.value !== (item?.resp ?? "")) onActualizar(c.id, { resp: e.target.value }); }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
