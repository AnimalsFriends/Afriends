import test from "node:test";
import assert from "node:assert/strict";

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const userId = "223e4567-e89b-12d3-a456-426614174001";
const token = `header.${encode({ sub: userId })}.signature`;
let stored = JSON.stringify({ access_token: token, refresh_token: "refresh", email: "empleado@example.test" });
globalThis.localStorage = {
  getItem: () => stored,
  setItem: (_key, value) => { stored = value; },
  removeItem: () => { stored = null; }
};
const { Auth } = await import("../src/admin/services/authService.js");

test("identifica sesiones guardadas antiguas decodificando el subject del token", () => {
  stored = JSON.stringify({ access_token: token, refresh_token: "refresh", email: "empleado@example.test" });
  assert.equal(Auth.userId, userId);
});

test("login registra el usuario autenticado y logout invalida la generación", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({
    access_token: token, refresh_token: "refresh", expires_in: 3600,
    user: { id: userId, email: "empleado@example.test" }
  }) });
  const before = Auth.generation;
  try {
    await Auth.login("empleado@example.test", "password-falso-de-prueba");
    assert.equal(Auth.userId, userId);
    assert.equal(Auth.generation, before + 1);
    Auth.logout();
    assert.equal(Auth.userId, null);
    assert.equal(Auth.generation, before + 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
