/**
 * Autenticación del panel con Supabase Auth (REST, sin librerías).
 * La sesión se guarda en el navegador de quien administra.
 */
import { ENV } from "../../config/env.js";

const API = String(ENV.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = ENV.SUPABASE_ANON_KEY || "";
const STORE = "af_admin_session";

export class AuthError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }   // invalid | unconfirmed | rate | network | expired
}

const friendly = (body) => {
  const m = String(body?.error_description || body?.msg || body?.message || "").toLowerCase();
  if (m.includes("invalid login")) return new AuthError("invalid", "Correo o contraseña incorrectos.");
  if (m.includes("not confirmed")) return new AuthError("unconfirmed", "Falta confirmar el correo de este usuario en Supabase.");
  if (m.includes("rate") || m.includes("too many")) return new AuthError("rate", "Demasiados intentos. Espera un momento e inténtalo de nuevo.");
  return new AuthError("network", "No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.");
};

let session = (() => { try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch { return null; } })();

const store = (json) => {
  session = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    email: json.user?.email || session?.email || ""
  };
  localStorage.setItem(STORE, JSON.stringify(session));
};

export const Auth = {
  isConfigured: () => Boolean(API && KEY),
  get email() { return session?.email || ""; },
  hasSession: () => Boolean(session?.access_token),

  async login(email, password) {
    let response;
    try {
      response = await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password })
      });
    } catch { throw new AuthError("network", "No se pudo conectar. Revisa tu conexión."); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw friendly(body);
    store(body);
  },

  async refresh() {
    if (!session?.refresh_token) throw new AuthError("expired");
    let response;
    try {
      response = await fetch(`${API}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: session.refresh_token })
      });
    } catch { throw new AuthError("network"); }
    if (!response.ok) throw new AuthError("expired");
    store(await response.json());
  },

  /** Token vigente (renueva si está por vencer). */
  async token() {
    if (!session) throw new AuthError("expired");
    if (Date.now() > session.expires_at - 60_000) await Auth.refresh();
    return session.access_token;
  },

  logout() { session = null; localStorage.removeItem(STORE); }
};
