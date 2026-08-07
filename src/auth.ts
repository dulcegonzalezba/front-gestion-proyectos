const TOKEN_KEY = 'token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

const payloadDelToken = (): any | null => {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

/** Decodifica el payload del JWT (sin verificar firma) para leer el rol. */
export const getRole = (): string | null => payloadDelToken()?.role ?? null;

/**
 * Vistas concedidas según el token. `null` = acceso total.
 * Sirve para pintar el menú de inmediato; la fuente de verdad es fetchPerfil().
 */
export const getVistas = (): string[] | null => {
  const p = payloadDelToken();
  if (!p || p.role === 'pmo') return null;
  return Array.isArray(p.vistas) ? p.vistas : null;
};

export interface Perfil {
  email: string;
  nombre: string | null;
  role: string;
  vistas: string[] | null;
  activo: boolean;
}

/**
 * Perfil leído del servidor. Así un cambio de permisos aplica al recargar,
 * sin obligar al usuario a volver a iniciar sesión.
 */
export const fetchPerfil = async (): Promise<Perfil | null> => {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      clearToken();
      window.location.href = '/login';
      return null;
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};
