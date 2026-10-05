/**
 * POST /api/contact  ->  Cloudflare Pages Function
 *
 * El navegador NUNCA habla directo con la tabla de mensajes. Esta función:
 *   1. valida origen, tipo de contenido y tamaño
 *   2. descarta bots (trampa "honeypot" y tiempo mínimo de llenado)
 *   3. valida los datos con el esquema compartido (src/shared/contactSchema.js)
 *   4. verifica Cloudflare Turnstile en el servidor
 *   5. limita envíos por IP (hash) y por teléfono
 *   6. guarda en Supabase con la clave de servicio (que vive SOLO aquí, como secreto)
 *
 * Variables / secretos (Cloudflare Pages → Settings → Variables and secrets):
 *   SUPABASE_URL · SUPABASE_SECRET_KEY (secreto, preferido) · SUPABASE_SERVICE_KEY (compatibilidad) · TURNSTILE_SECRET (secreto) · IP_SALT (secreto)
 */
import { validateContact, POLICY_VERSION } from "../../src/shared/contactSchema.js";

const MAX_BODY_BYTES = 8 * 1024;
const MIN_FILL_MS = 2500;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 3;
const PHONE_COOLDOWN_MS = 2 * 60 * 1000;

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
  });

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Los keys nuevos de Supabase ("sb_secret_...") no son JWT: solo van en `apikey`. */
const supabaseHeaders = (key, extra = {}) => ({
  apikey: key,
  ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
  ...extra
});

async function verifyTurnstile({ secret, token, ip }) {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", body: form, signal: AbortSignal.timeout(5000)
  });
  const data = await response.json().catch(() => ({}));
  return data.success === true;
}

export async function onRequestPost({ request, env }) {
  // 0) Configuración completa
  // Supabase recomienda las claves nuevas `sb_secret_...`; mantenemos
  // `SUPABASE_SERVICE_KEY` como compatibilidad con instalaciones antiguas.
  const supabaseKey = env.SUPABASE_SECRET_KEY || supabaseKey;
  if (!env.SUPABASE_URL || !supabaseKey || !env.TURNSTILE_SECRET || !env.IP_SALT) {
    console.error("[contact] Faltan variables de entorno requeridas");
    return json(500, { error: "config" });
  }

  // 1) Origen, tipo y tamaño
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json(403, { error: "origin" });
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) return json(415, { error: "content-type" });
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) return json(413, { error: "size" });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "size" });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "json" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "json" });

  // 2) Bots: se responde "ok" sin guardar nada (no les damos pistas)
  if (typeof body.sitio_web === "string" && body.sitio_web.trim() !== "") return json(200, { ok: true });
  if (!(Number(body.elapsed) >= MIN_FILL_MS)) return json(200, { ok: true });

  // 3) Validación real
  const { ok, errors, clean } = validateContact(body);
  if (!ok) return json(400, { error: "validation", errors });

  // 4) Turnstile
  const ip = request.headers.get("CF-Connecting-IP") || "";
  let human = false;
  try { human = await verifyTurnstile({ secret: env.TURNSTILE_SECRET, token: body.token, ip }); }
  catch (error) { console.error("[contact] Turnstile no respondió:", error?.name); return json(502, { error: "captcha-service" }); }
  if (!human) return json(403, { error: "captcha" });

  // 5) Límites (identificador derivado de la IP, nunca la IP en claro)
  const ipHash = await sha256Hex(`${ip}|${env.IP_SALT}`);
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  try {
    const recent = await fetch(
      `${base}/rest/v1/contact_requests?select=ip_hash,telefono,created_at&created_at=gte.${encodeURIComponent(since)}` +
      `&or=(ip_hash.eq.${ipHash},telefono.eq.${clean.telefono})&limit=20`,
      { headers: supabaseHeaders(supabaseKey), signal: AbortSignal.timeout(5000) }
    );
    if (!recent.ok) throw new Error(`rate ${recent.status}`);
    const rows = await recent.json();
    const byIp = rows.filter((r) => r.ip_hash === ipHash).length;
    const phoneTooSoon = rows.some((r) => r.telefono === clean.telefono && Date.now() - Date.parse(r.created_at) < PHONE_COOLDOWN_MS);
    if (byIp >= MAX_PER_IP || phoneTooSoon) return json(429, { error: "rate" });

    // 6) Guardar
    const insert = await fetch(`${base}/rest/v1/contact_requests`, {
      method: "POST",
      headers: supabaseHeaders(supabaseKey, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({
        nombre: clean.nombre,
        telefono: clean.telefono,
        correo: clean.correo || null,
        mascota: clean.mascota || null,
        servicio: clean.servicio || null,
        mensaje: clean.mensaje || null,
        acepta_datos: true,
        version_politica: POLICY_VERSION,
        ip_hash: ipHash,
        origen: "web"
      }),
      signal: AbortSignal.timeout(5000)
    });
    if (!insert.ok) throw new Error(`insert ${insert.status}`);
  } catch (error) {
    console.error("[contact] Error de almacenamiento:", error?.message);   // sin datos personales en los logs
    return json(502, { error: "storage" });
  }

  return json(201, { ok: true });
}

/** Cualquier otro método → 405. */
export const onRequest = () => json(405, { error: "method" }, { Allow: "POST" });
