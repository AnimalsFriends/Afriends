/**
 * Acceso a Supabase para el panel:
 *   - leer / publicar los datos del sitio (tabla site_config)
 *   - leer y actualizar los mensajes del formulario (tabla contact_requests)
 * Las escrituras y la lectura de mensajes usan el token de la persona que administra;
 * la seguridad real la dan las políticas RLS y los roles activos, no una comparación de correo.
 */
import { ENV } from "../../config/env.js";
import { Auth, AuthError } from "./authService.js";

const API = String(ENV.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = ENV.SUPABASE_ANON_KEY || "";
export const rest = (path) => `${API}/rest/v1/${path}`;

export class ApiError extends Error {
  constructor(code) { super(code); this.code = code; }     // perm | missing | schema | network | conflict | fail | expired
}

/** fetch con el token del administrador; si vence, lo renueva una vez y reintenta. */
export async function authed(url, init = {}) {
  const send = async () => fetch(url, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${await Auth.token()}`, ...(init.headers || {}) } });
  let response;
  try { response = await send(); }
  catch (error) {
    if (error instanceof AuthError) throw new ApiError(error.code === "network" ? "network" : "expired");
    if (error instanceof TypeError) throw new ApiError("network");
    throw error;
  }
  if (response.status === 401) {
    try { await Auth.refresh(); response = await send(); }
    catch (error) {
      if (error instanceof AuthError) throw new ApiError(error.code === "network" ? "network" : "expired");
      if (error instanceof TypeError) throw new ApiError("network");
      throw error;
    }
  }
  return response;
}

export const SiteConfigApi = {
  /** Lectura pública (no requiere iniciar sesión). */
  async fetch() {
    try {
      const response = await fetch(rest(`${ENV.SITE_TABLE}?id=eq.1&select=data,updated_at`), { headers: { apikey: KEY }, cache: "no-store" });
      if (!response.ok) return { error: true };
      const rows = await response.json();
      if (rows?.[0]?.data?.negocio) return { data: rows[0].data, updatedAt: rows[0].updated_at };
      return { empty: true };
    } catch { return { error: true }; }
  },

  async publish(payload) {
    const response = await authed(rest(`${ENV.SITE_TABLE}?on_conflict=id`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ id: 1, data: payload, updated_at: new Date().toISOString() }])
    });
    if (response.status === 401 || response.status === 403) throw new ApiError("perm");
    if (!response.ok) throw new ApiError("fail");
  }
};

export const LeadsApi = {
  async list({ limit = 200 } = {}) {
    const response = await authed(rest(`contact_requests?select=*&order=created_at.desc&limit=${limit}`));
    if (response.status === 401 || response.status === 403) throw new ApiError("perm");
    if (response.status === 404) throw new ApiError("missing");      // el servicio no está disponible en el entorno conectado
    if (!response.ok) throw new ApiError("fail");
    return response.json();
  },

  async setStatus(id, estado) {
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw new ApiError("fail");
    const response = await authed(rest(`contact_requests?id=eq.${id}`), {
      method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ estado })
    });
    if (response.status === 401 || response.status === 403) throw new ApiError("perm");
    if (!response.ok) throw new ApiError("fail");
  }
};
