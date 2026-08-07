/**
 * UsuariosTab — alta de usuarios y gestión de accesos.
 *
 * Dos roles:
 *   · pmo    — administrador: ve todo, incluida esta pantalla.
 *   · viewer — ve solo las vistas que se le concedan.
 *
 * Pensado para liberar accesos acotados, por ejemplo alguien que solo deba
 * entrar a lo del SIR Plus. Solo es visible para el rol pmo.
 */

import { useCallback, useEffect, useState } from "react";
import { getToken } from "./auth";
import { VISTAS, VISTA_BASE, PRESETS } from "./vistas";

const T = {
  card: "#0F1117", surface: "#14161E", hover: "#1A1D28",
  border: "#1E2233", borderLt: "#272B40",
  text1: "#E8E3D8", text2: "#7A7F9A", text3: "#3E4260",
  gold: "#C9A84C",
};

interface Usuario {
  id: number;
  email: string;
  nombre: string | null;
  role: string;
  vistas: string[] | null;
  activo: boolean;
  createdAt: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/usuarios${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(init?.headers ?? {}),
    },
  });
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(cuerpo?.message ?? `Error ${res.status}`);
  }
  return cuerpo;
}

// ── Piezas ────────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  background: "#09090C", color: T.text1, border: `1px solid ${T.border}`,
  borderRadius: 8, padding: "8px 10px", fontSize: 12, width: "100%",
  boxSizing: "border-box", fontFamily: "system-ui,sans-serif", outline: "none",
};

const btn = (tono: "primario" | "neutro" | "peligro" = "neutro"): React.CSSProperties => ({
  background: tono === "primario" ? "#16A34A" : "transparent",
  border: `1px solid ${tono === "primario" ? "#16A34A" : tono === "peligro" ? "#7F1D1D" : T.borderLt}`,
  color: tono === "primario" ? "#fff" : tono === "peligro" ? "#F87171" : T.text2,
  borderRadius: 8, padding: "7px 14px", fontSize: 11, fontWeight: 600,
  cursor: "pointer", fontFamily: "system-ui,sans-serif", whiteSpace: "nowrap",
});

function SelectorVistas({
  valor, onChange, deshabilitado,
}: { valor: string[]; onChange: (v: string[]) => void; deshabilitado?: boolean }) {
  const alternar = (key: string) => {
    if (key === VISTA_BASE) return; // Inicio siempre concedida
    onChange(valor.includes(key) ? valor.filter(v => v !== key) : [...valor, key]);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 9, color: T.text3, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", alignSelf: "center", marginRight: 2 }}>
          Atajos
        </span>
        {PRESETS.map(p => (
          <button key={p.nombre} type="button" title={p.desc} disabled={deshabilitado}
            onClick={() => onChange(p.vistas)}
            style={{
              ...btn(), padding: "4px 10px", fontSize: 10,
              opacity: deshabilitado ? 0.4 : 1,
              cursor: deshabilitado ? "default" : "pointer",
            }}>
            {p.nombre}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 7 }}>
        {VISTAS.map(v => {
          const activa = deshabilitado || valor.includes(v.key);
          const fija = v.key === VISTA_BASE;
          return (
            <button key={v.key} type="button" onClick={() => !deshabilitado && alternar(v.key)}
              title={fija ? "El inicio siempre está concedido" : v.desc}
              style={{
                textAlign: "left", cursor: deshabilitado || fija ? "default" : "pointer",
                background: activa ? "#0A1A0F" : T.surface,
                border: `1px solid ${activa ? "#22C55E55" : T.border}`,
                borderRadius: 9, padding: "9px 11px", fontFamily: "system-ui,sans-serif",
                opacity: deshabilitado ? 0.55 : 1,
                display: "flex", gap: 9, alignItems: "flex-start",
              }}>
              <span style={{
                width: 15, height: 15, borderRadius: 4, flexShrink: 0, marginTop: 1,
                border: `1.5px solid ${activa ? "#22C55E" : T.borderLt}`,
                background: activa ? "#22C55E" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#062012", fontSize: 10, fontWeight: 900, lineHeight: 1,
              }}>
                {activa ? "✓" : ""}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: T.text1 }}>
                  {v.label}{fija && <span style={{ color: T.text3, fontWeight: 400 }}> · fija</span>}
                </span>
                <span style={{ display: "block", fontSize: 9.5, color: T.text3, lineHeight: 1.45, marginTop: 2 }}>{v.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

interface UsuariosTabProps {
  /** Correo de quien está usando la app: no puede eliminarse ni desactivarse. */
  emailActual?: string | null;
}

export default function UsuariosTab({ emailActual }: UsuariosTabProps = {}) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({ email: "", nombre: "", password: "", role: "viewer", vistas: ["home", "sirplus"] as string[] });

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [edicion, setEdicion] = useState<{ nombre: string; role: string; vistas: string[] }>({ nombre: "", role: "viewer", vistas: [] });
  const [passwordId, setPasswordId] = useState<number | null>(null);
  const [passwordNueva, setPasswordNueva] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setUsuarios(await api(""));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "No se pudo cargar la lista de usuarios");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const notificar = (msg: string) => {
    setAviso(msg);
    setTimeout(() => setAviso(a => (a === msg ? null : a)), 4000);
  };

  const conError = async (fn: () => Promise<void>) => {
    try { await fn(); setError(null); }
    catch (e: any) { setError(e.message ?? "Ocurrió un error"); }
  };

  const crear = () => conError(async () => {
    await api("", { method: "POST", body: JSON.stringify(nuevo) });
    setNuevo({ email: "", nombre: "", password: "", role: "viewer", vistas: ["home", "sirplus"] });
    setCreando(false);
    notificar("Usuario creado. Ya puede iniciar sesión.");
    await cargar();
  });

  const guardarEdicion = (id: number) => conError(async () => {
    await api(`/${id}`, { method: "PATCH", body: JSON.stringify(edicion) });
    setEditandoId(null);
    notificar("Accesos actualizados. Aplican cuando la persona recargue.");
    await cargar();
  });

  const alternarActivo = (u: Usuario) => conError(async () => {
    await api(`/${u.id}`, { method: "PATCH", body: JSON.stringify({ activo: !u.activo }) });
    notificar(u.activo ? "Usuario desactivado: ya no puede entrar." : "Usuario reactivado.");
    await cargar();
  });

  const guardarPassword = (id: number) => conError(async () => {
    await api(`/${id}/password`, { method: "POST", body: JSON.stringify({ password: passwordNueva }) });
    setPasswordId(null);
    setPasswordNueva("");
    notificar("Contraseña actualizada.");
  });

  const eliminar = (u: Usuario) => {
    if (!confirm(`¿Eliminar a ${u.email}? Esta acción no se puede deshacer.`)) return;
    conError(async () => {
      await api(`/${u.id}`, { method: "DELETE" });
      notificar("Usuario eliminado.");
      await cargar();
    });
  };

  const seccion: React.CSSProperties = {
    background: `linear-gradient(160deg, ${T.card} 0%, #12141C 100%)`,
    border: `1px solid ${T.border}`, borderRadius: 16,
    padding: "22px 24px", marginBottom: 18,
    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
  };

  const admins = usuarios.filter(u => u.role === "pmo" && u.activo).length;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: T.text1, paddingBottom: 40 }}>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 5 }}>Usuarios y accesos</div>
          <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.6, maxWidth: 660 }}>
            Da de alta a quien necesite entrar y concédele solo las vistas que le correspondan. Para liberar a alguien
            que únicamente deba ver lo del SIR Plus, usa el atajo <strong style={{ color: T.text1 }}>Solo SIR Plus</strong>.
          </div>
        </div>
        <button onClick={() => setCreando(c => !c)} style={btn("primario")}>
          {creando ? "Cancelar" : "+ Nuevo usuario"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#1A0A0A", border: "1px solid #EF444455", borderRadius: 10, padding: "11px 14px", marginBottom: 14, fontSize: 11.5, color: "#F87171", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ ...btn(), padding: "3px 9px", fontSize: 10 }}>Cerrar</button>
        </div>
      )}
      {aviso && (
        <div style={{ background: "#0A1A0F", border: "1px solid #22C55E55", borderRadius: 10, padding: "11px 14px", marginBottom: 14, fontSize: 11.5, color: "#4ADE80" }}>
          {aviso}
        </div>
      )}

      {/* Alta */}
      {creando && (
        <div style={seccion}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: T.gold, marginBottom: 16 }}>
            Nuevo usuario
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 10, color: T.text3, fontWeight: 700, marginBottom: 5 }}>CORREO *</span>
              <input style={inp} type="email" autoComplete="off" value={nuevo.email}
                onChange={e => setNuevo(n => ({ ...n, email: e.target.value }))} placeholder="persona@sigob.com.mx" />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 10, color: T.text3, fontWeight: 700, marginBottom: 5 }}>NOMBRE</span>
              <input style={inp} value={nuevo.nombre}
                onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} placeholder="Nombre para mostrar" />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 10, color: T.text3, fontWeight: 700, marginBottom: 5 }}>CONTRASEÑA * <span style={{ fontWeight: 400 }}>(mínimo 8)</span></span>
              <input style={inp} type="text" autoComplete="new-password" value={nuevo.password}
                onChange={e => setNuevo(n => ({ ...n, password: e.target.value }))} placeholder="Se la compartes a la persona" />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 10, color: T.text3, fontWeight: 700, marginBottom: 5 }}>ROL</span>
              <select style={inp} value={nuevo.role} onChange={e => setNuevo(n => ({ ...n, role: e.target.value }))}>
                <option value="viewer">Acceso limitado</option>
                <option value="pmo">Administrador (ve todo)</option>
              </select>
            </label>
          </div>

          <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, marginBottom: 10, letterSpacing: "0.06em" }}>
            VISTAS QUE PODRÁ ABRIR
          </div>
          <SelectorVistas valor={nuevo.vistas} deshabilitado={nuevo.role === "pmo"}
            onChange={v => setNuevo(n => ({ ...n, vistas: v }))} />
          {nuevo.role === "pmo" && (
            <div style={{ fontSize: 10.5, color: "#F59E0B", marginTop: 10 }}>
              El administrador ve todas las vistas, incluidas RH y esta pantalla de usuarios.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button onClick={crear} style={btn("primario")}>Crear usuario</button>
            <button onClick={() => setCreando(false)} style={btn()}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={seccion}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: T.text3 }}>
            Usuarios registrados
          </div>
          <div style={{ fontSize: 10, color: T.text3 }}>
            {usuarios.length} en total · {usuarios.filter(u => u.activo).length} activos · {admins} administrador{admins === 1 ? "" : "es"}
          </div>
        </div>

        {cargando ? (
          <div style={{ fontSize: 12, color: T.text3, padding: "20px 0" }}>Cargando…</div>
        ) : usuarios.length === 0 ? (
          <div style={{ fontSize: 12, color: T.text3, padding: "20px 0" }}>Todavía no hay usuarios registrados.</div>
        ) : usuarios.map(u => {
          const esUnoMismo = !!emailActual && u.email === emailActual;
          const editando = editandoId === u.id;
          const esAdmin = u.role === "pmo";
          const vistasVisibles = esAdmin ? null : (u.vistas ?? null);

          return (
            <div key={u.id} style={{
              background: T.surface,
              border: `1px solid ${u.activo ? T.border : "#7F1D1D40"}`,
              borderRadius: 12, padding: "14px 16px", marginBottom: 9,
              opacity: u.activo ? 1 : 0.6,
            }}>
              {/* Cabecera de la fila */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: editando ? 14 : 0 }}>
                <span style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: esAdmin ? "#2A1F00" : "#0A1420",
                  border: `1px solid ${esAdmin ? T.gold + "66" : "#2563EB55"}`,
                  color: esAdmin ? T.gold : "#60A5FA",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800,
                }}>
                  {(u.nombre ?? u.email).charAt(0).toUpperCase()}
                </span>

                <span style={{ flex: 1, minWidth: 190 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text1 }}>{u.nombre ?? u.email}</span>
                    {esUnoMismo && (
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: T.gold, border: `1px solid ${T.gold}44`, borderRadius: 20, padding: "1px 7px" }}>Tú</span>
                    )}
                    {!u.activo && (
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: "#F87171", border: "1px solid #7F1D1D", borderRadius: 20, padding: "1px 7px" }}>Desactivado</span>
                    )}
                  </span>
                  {u.nombre && <span style={{ display: "block", fontSize: 10, color: T.text3, marginTop: 2 }}>{u.email}</span>}
                </span>

                <span style={{
                  fontSize: 9.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap",
                  background: esAdmin ? T.gold + "18" : "#1E3A8A22",
                  color: esAdmin ? T.gold : "#93C5FD",
                  border: `1px solid ${esAdmin ? T.gold + "44" : "#2563EB44"}`,
                }}>
                  {esAdmin ? "Administrador" : "Acceso limitado"}
                </span>

                {!editando && (
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { setEditandoId(u.id); setEdicion({ nombre: u.nombre ?? "", role: u.role, vistas: u.vistas ?? VISTAS.map(v => v.key) }); }} style={{ ...btn(), padding: "5px 11px" }}>
                      Accesos
                    </button>
                    <button onClick={() => setPasswordId(passwordId === u.id ? null : u.id)} style={{ ...btn(), padding: "5px 11px" }}>
                      Contraseña
                    </button>
                    {!esUnoMismo && (
                      <>
                        <button onClick={() => alternarActivo(u)} style={{ ...btn(), padding: "5px 11px" }}>
                          {u.activo ? "Desactivar" : "Reactivar"}
                        </button>
                        <button onClick={() => eliminar(u)} style={{ ...btn("peligro"), padding: "5px 11px" }}>
                          Eliminar
                        </button>
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* Vistas concedidas, en modo lectura */}
              {!editando && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                  {vistasVisibles === null ? (
                    <span style={{ fontSize: 10, color: T.text2 }}>Acceso a todas las vistas</span>
                  ) : vistasVisibles.length === 0 ? (
                    <span style={{ fontSize: 10, color: T.text3 }}>Sin vistas concedidas</span>
                  ) : (
                    vistasVisibles.map(k => {
                      const v = VISTAS.find(x => x.key === k);
                      return (
                        <span key={k} style={{
                          fontSize: 9.5, color: "#4ADE80", background: "#0A1A0F",
                          border: "1px solid #22C55E33", borderRadius: 20, padding: "2px 9px",
                        }}>
                          {v?.label ?? k}
                        </span>
                      );
                    })
                  )}
                </div>
              )}

              {/* Cambio de contraseña */}
              {passwordId === u.id && !editando && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input style={{ ...inp, width: 260 }} type="text" autoComplete="new-password" value={passwordNueva}
                    onChange={e => setPasswordNueva(e.target.value)} placeholder="Nueva contraseña (mínimo 8)" />
                  <button onClick={() => guardarPassword(u.id)} style={btn("primario")}>Guardar</button>
                  <button onClick={() => { setPasswordId(null); setPasswordNueva(""); }} style={btn()}>Cancelar</button>
                </div>
              )}

              {/* Edición de accesos */}
              {editando && (
                <div style={{ paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 10, color: T.text3, fontWeight: 700, marginBottom: 5 }}>NOMBRE</span>
                      <input style={inp} value={edicion.nombre} onChange={e => setEdicion(x => ({ ...x, nombre: e.target.value }))} />
                    </label>
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 10, color: T.text3, fontWeight: 700, marginBottom: 5 }}>ROL</span>
                      <select style={inp} value={edicion.role} onChange={e => setEdicion(x => ({ ...x, role: e.target.value }))}
                        disabled={esUnoMismo && u.role === "pmo"}>
                        <option value="viewer">Acceso limitado</option>
                        <option value="pmo">Administrador (ve todo)</option>
                      </select>
                      {esUnoMismo && u.role === "pmo" && (
                        <span style={{ display: "block", fontSize: 9.5, color: T.text3, marginTop: 4 }}>
                          No puedes quitarte a ti mismo el rol de administrador.
                        </span>
                      )}
                    </label>
                  </div>

                  <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, marginBottom: 10, letterSpacing: "0.06em" }}>
                    VISTAS QUE PODRÁ ABRIR
                  </div>
                  <SelectorVistas valor={edicion.vistas} deshabilitado={edicion.role === "pmo"}
                    onChange={v => setEdicion(x => ({ ...x, vistas: v }))} />

                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={() => guardarEdicion(u.id)} style={btn("primario")}>Guardar accesos</button>
                    <button onClick={() => setEditandoId(null)} style={btn()}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Alcance real de estos permisos */}
      <div style={{ ...seccion, marginBottom: 0, borderColor: "#F59E0B35" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#F59E0B", marginBottom: 12 }}>
          Alcance de estos permisos
        </div>
        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.7, maxWidth: 780 }}>
          Lo que se controla aquí es <strong style={{ color: T.text1 }}>qué vistas puede abrir cada persona</strong>. En
          el servidor están protegidos los datos sensibles: RH y esta misma pantalla de usuarios solo responden al rol
          administrador. En cambio, el resto de la información del tablero —proyectos, acuerdos, liberaciones y el
          estado del panel del SIR Plus— sigue siendo legible por cualquier usuario con sesión iniciada si consulta la
          API directamente. Sirve perfecto para acotar la navegación de gente de confianza; si necesitas que un
          usuario <em>no pueda</em> acceder a esos datos de ninguna forma, hay que llevar el permiso también al
          servidor, módulo por módulo.
        </div>
      </div>
    </div>
  );
}
