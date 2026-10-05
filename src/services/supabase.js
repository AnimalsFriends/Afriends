/**
 * Cliente mínimo de Supabase (REST / PostgREST) SIN dependencias.
 *
 * Por qué no usamos supabase-js todavía: cero kilobytes extra y cero scripts de terceros
 * (más fácil de proteger con CSP). En la Fase 4 (formularios) y para el login del panel
 * admin se puede cambiar por supabase-js sin tocar modelos ni controladores: solo este archivo.
 */
import { ENV } from "../config/env.js";

export class SupabaseError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = "SupabaseError";
    this.code = code;       // "not_configured" | "timeout" | "network" | "http_401" ...
    this.status = status;
  }
}

export const isSupabaseConfigured = () => Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);

const restBase = () => `${ENV.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`;

async function request(path, { method = "GET", body, headers = {}, token } = {}) {
  if (!isSupabaseConfigured()) throw new SupabaseError("not_configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENV.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(restBase() + path, {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        apikey: ENV.SUPABASE_ANON_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new SupabaseError(`http_${response.status}`, response.status);
    return await response.json().catch(() => null);   // 201/204 sin cuerpo -> null
  } catch (error) {
    if (error instanceof SupabaseError) throw error;
    throw new SupabaseError(error.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}

/** Acceso a datos. `query` usa la sintaxis de PostgREST: "id=eq.1&select=data". */
export const db = {
  select: (table, query = "") => request(`${table}?${query}`),
  insert: (table, rows, { token } = {}) =>
    request(table, { method: "POST", body: rows, token, headers: { Prefer: "return=minimal" } })
};
