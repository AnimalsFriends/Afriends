import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const header = readFileSync("src/views/HeaderView.js", "utf8");
const quote = readFileSync("src/views/QuoteView.js", "utf8");
const publicConfig = readFileSync("src/config/env.js", "utf8");
const layoutStyles = readFileSync("assets/css/layout.css", "utf8");

test("el cotizador conserva la única llamada principal a WhatsApp", () => {
  assert.doesNotMatch(header, /btn--primary/);
  assert.match(header, /class="btn btn--ghost"[^>]*>Cotizar por WhatsApp/);
  assert.match(quote, /class="btn btn--primary"[^>]*>Cotizar por WhatsApp/);
  assert.match(layoutStyles, /\.wa-float\s*\{[^}]*background: var\(--color-surface\)/s);
});

test("la configuración del navegador no contiene claves privadas de Supabase", () => {
  assert.doesNotMatch(publicConfig, /sb_secret_[a-z0-9]+/i);
});
