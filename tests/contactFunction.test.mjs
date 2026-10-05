import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequest } from "../functions/api/contact.js";
import { POLICY_VERSION } from "../src/shared/contactSchema.js";

const ORIGIN = "https://animalfriends.test";
const ENV = { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_KEY: "sb_secret_TOPSECRET", TURNSTILE_SECRET: "ts-secret", IP_SALT: "salt-123" };
const GOOD = { nombre: "Ana", telefono: "3001234567", correo: "", mascota: "Max", servicio: "banos", mensaje: "Hola", aceptaDatos: true, token: "tok", sitio_web: "", elapsed: 5000 };

/** Mock de fetch: registra llamadas y responde según opciones. */
function mockFetch({ turnstile = { success: true }, recent = [], insertStatus = 201, recentStatus = 200, turnstileThrows = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("challenges.cloudflare.com")) {
      if (turnstileThrows) throw new Error("boom");
      return new Response(JSON.stringify(turnstile), { status: 200 });
    }
    if (init.method === "POST") return new Response("", { status: insertStatus });
    return new Response(JSON.stringify(recent), { status: recentStatus });
  };
  return calls;
}

const req = (body, { origin = ORIGIN, type = "application/json", ip = "1.2.3.4", raw } = {}) =>
  new Request(`${ORIGIN}/api/contact`, {
    method: "POST",
    headers: { ...(origin ? { Origin: origin } : {}), "Content-Type": type, "CF-Connecting-IP": ip },
    body: raw ?? JSON.stringify(body)
  });
const call = (request, env = ENV) => onRequestPost({ request, env });

test("éxito: guarda con la clave de servicio, hash de IP y versión de política", async () => {
  const calls = mockFetch();
  const res = await call(req(GOOD));
  assert.equal(res.status, 201);
  const responseText = await res.text();
  assert.deepEqual(JSON.parse(responseText), { ok: true });
  const insert = calls.find((c) => c.init.method === "POST" && c.url.includes("/contact_requests"));
  const row = JSON.parse(insert.init.body);
  assert.equal(row.telefono, "3001234567");
  assert.equal(row.acepta_datos, true);
  assert.equal(row.version_politica, POLICY_VERSION);
  assert.match(row.ip_hash, /^[0-9a-f]{64}$/);
  assert.ok(!insert.init.body.includes("1.2.3.4"), "la IP en claro no debe guardarse");
  assert.equal(insert.init.headers.apikey, "sb_secret_TOPSECRET");
  assert.equal(insert.init.headers.Authorization, undefined, "las claves sb_secret_ no van como Bearer");
  assert.ok(!responseText.includes("TOPSECRET"), "la respuesta no debe revelar secretos");
});

test("clave JWT legada: se envía también como Bearer", async () => {
  const calls = mockFetch();
  await call(req(GOOD), { ...ENV, SUPABASE_SERVICE_KEY: "eyJhbGciOi.payload.sig" });
  const insert = calls.find((c) => c.init.method === "POST" && c.url.includes("/contact_requests"));
  assert.equal(insert.init.headers.Authorization, "Bearer eyJhbGciOi.payload.sig");
});

test("honeypot lleno: responde ok pero NO guarda ni consulta", async () => {
  const calls = mockFetch();
  const res = await call(req({ ...GOOD, sitio_web: "http://spam.com" }));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

test("envío demasiado rápido (bot): responde ok pero NO guarda", async () => {
  const calls = mockFetch();
  assert.equal((await call(req({ ...GOOD, elapsed: 300 }))).status, 200);
  assert.equal((await call(req({ ...GOOD, elapsed: undefined }))).status, 200);
  assert.equal(calls.length, 0);
});

test("validación: 400 con códigos de error, sin tocar red", async () => {
  const calls = mockFetch();
  const res = await call(req({ ...GOOD, nombre: "", aceptaDatos: false }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.errors.nombre, "requerido");
  assert.equal(body.errors.aceptaDatos, "requerido");
  assert.equal(calls.length, 0);
});

test("Turnstile inválido o ausente: 403 captcha y no guarda", async () => {
  let calls = mockFetch({ turnstile: { success: false } });
  let res = await call(req(GOOD));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "captcha");
  assert.ok(!calls.some((c) => c.url.includes("/contact_requests")));
  calls = mockFetch();
  assert.equal((await call(req({ ...GOOD, token: "" }))).status, 403);
});

test("Turnstile caído: 502 (no se acepta sin verificar)", async () => {
  mockFetch({ turnstileThrows: true });
  assert.equal((await call(req(GOOD))).status, 502);
});

test("límite por IP: 3 en 10 minutos -> 429", async () => {
  const now = new Date().toISOString();
  const { createHash } = await import("node:crypto");
  const ipHash = createHash("sha256").update("1.2.3.4|salt-123").digest("hex");
  const rows = [1, 2, 3].map((i) => ({ ip_hash: ipHash, telefono: `300000000${i}`, created_at: now }));
  mockFetch({ recent: rows });
  const res = await call(req(GOOD));
  assert.equal(res.status, 429);
});

test("mismo teléfono en menos de 2 minutos -> 429", async () => {
  mockFetch({ recent: [{ ip_hash: "otro", telefono: "3001234567", created_at: new Date().toISOString() }] });
  assert.equal((await call(req(GOOD))).status, 429);
});

test("la consulta de límites no permite inyección (solo hex y dígitos)", async () => {
  const calls = mockFetch();
  await call(req({ ...GOOD, telefono: "3001234) or (id.neq.0" }));   // los no-dígitos se eliminan antes de consultar
  const q = calls.find((c) => c.url.includes("or=("));
  assert.ok(q, "debe llegar a la consulta de límites");
  const filter = decodeURIComponent(q.url).match(/or=\((.*)\)&limit/)[1];
  assert.match(filter, /^ip_hash\.eq\.[0-9a-f]{64},telefono\.eq\.\d+$/);   // solo hex y dígitos: sin inyección
});

test("error de Supabase: 502 sin filtrar detalles", async () => {
  mockFetch({ insertStatus: 500 });
  const res = await call(req(GOOD));
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: "storage" });
});

test("origen distinto o ausente: 403", async () => {
  mockFetch();
  assert.equal((await call(req(GOOD, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await call(req(GOOD, { origin: null }))).status, 403);
});

test("tipo de contenido, JSON inválido y tamaño", async () => {
  mockFetch();
  assert.equal((await call(req(GOOD, { type: "text/plain" }))).status, 415);
  assert.equal((await call(req(null, { raw: "{no json" }))).status, 400);
  assert.equal((await call(req(null, { raw: "[1,2]" }))).status, 400);
  assert.equal((await call(req(null, { raw: JSON.stringify({ ...GOOD, mensaje: "x".repeat(9000) }) }))).status, 413);
});

test("sin variables de entorno: 500 'config'", async () => {
  mockFetch();
  const res = await call(req(GOOD), { SUPABASE_URL: ENV.SUPABASE_URL });
  assert.equal(res.status, 500);
});

test("otros métodos: 405 con cabecera Allow", async () => {
  const res = onRequest();
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("Allow"), "POST");
});

test("las respuestas nunca se cachean", async () => {
  mockFetch();
  assert.equal((await call(req(GOOD))).headers.get("Cache-Control"), "no-store");
});
