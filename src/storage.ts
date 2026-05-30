/**
 * Storage API — Reemplazo de window.storage para servidor propio
 *
 * En Claude artifacts usa:  await window.storage.get(key)
 * En tu server usa:         await storage.get(key)
 *
 * La interfaz es idéntica. Solo cambia el transporte (fetch en vez de postMessage).
 */

import { getToken, clearToken } from './auth';

const API = (import.meta as any).env?.VITE_API_URL || '/api/storage';

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handle401(): null {
  clearToken();
  window.location.href = '/login';
  return null;
}

export const storage = {
  async get(key: string): Promise<{ key: string; value: string; shared: boolean } | null> {
    try {
      const res = await fetch(`${API}/get?key=${encodeURIComponent(key)}`, {
        headers: authHeaders(),
      });
      if (res.status === 401) return handle401();
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<{ key: string; value: string; shared: boolean } | null> {
    try {
      const res = await fetch(`${API}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ key, value }),
      });
      if (res.status === 401) return handle401();
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async delete(key: string): Promise<{ key: string; deleted: boolean; shared: boolean } | null> {
    try {
      const res = await fetch(`${API}/delete?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.status === 401) return handle401();
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async list(prefix?: string): Promise<{ keys: string[]; prefix?: string; shared: boolean } | null> {
    try {
      const url = prefix ? `${API}/list?prefix=${encodeURIComponent(prefix)}` : `${API}/list`;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 401) return handle401();
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },
};
