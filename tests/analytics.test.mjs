import test from "node:test";
import assert from "node:assert/strict";

const scripts = [];
globalThis.window = globalThis;
globalThis.location = { hostname: "example.test" };
globalThis.document = {
  cookie: "",
  createElement: () => ({ dataset: {} }),
  head: { appendChild: (script) => scripts.push(script) }
};

const { Analytics, analyticsConfigured } = await import("../src/services/analytics.js");

test("GTM queda configurado sin cargar red al preparar o rechazar", () => {
  assert.equal(analyticsConfigured(), true);
  Analytics.prepare();
  Analytics.disable();
  assert.equal(scripts.length, 0);
  assert.ok(dataLayer.length >= 2);
  assert.equal(dataLayer[0][0], "consent");
  assert.equal(dataLayer[0][1], "default");
  assert.equal(dataLayer[0][2].analytics_storage, "denied");
});

test("aceptar carga un solo contenedor y los eventos usan dataLayer una vez", () => {
  Analytics.enable();
  Analytics.enable();
  assert.equal(scripts.length, 1);
  assert.match(scripts[0].src, /^https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=GTM-/);
  const before = dataLayer.length;
  Analytics.track("generate_lead", { source: "formulario" });
  assert.equal(dataLayer.length, before + 1);
  assert.deepEqual(dataLayer.at(-1), { event: "generate_lead", source: "formulario" });
});

test("revocar impide eventos posteriores", () => {
  Analytics.disable();
  const before = dataLayer.length;
  Analytics.track("whatsapp_click", { location: "pie" });
  assert.equal(dataLayer.length, before);
});
