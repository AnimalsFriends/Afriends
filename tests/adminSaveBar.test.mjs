import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const controller = readFileSync("src/admin/controllers/AdminController.js", "utf8");
const html = readFileSync("admin/index.html", "utf8");
const css = readFileSync("assets/css/admin.css", "utf8");

test("la barra comienza oculta en el HTML y no se fuerza visible al iniciar el editor", () => {
  assert.match(html, /id="adm-bar" class="adm-bar" hidden/);
  assert.doesNotMatch(controller, /\$\("adm-bar"\)\.hidden\s*=\s*false/);
});

test("setDirty es la fuente única de visibilidad según rol, pestaña y cambios pendientes", () => {
  assert.match(controller, /bar\.hidden\s*=\s*this\.role\s*===\s*"empleado"\s*\|\|\s*!this\.dirty\s*\|\|\s*!barTab/);
  assert.match(controller, /const barTab = this\.tab === "negocio" \|\| this\.tab === "servicios"/);
  assert.match(controller, /setDirty\(this\.dirty\)/);
  assert.doesNotMatch(controller, /\$\("adm-bar"\)\.hidden\s*=\s*\[.*\]\.includes\(tab\)/);
});

test("el CSS no anula el atributo hidden ni fuerza la barra a mostrarse", () => {
  const rule = css.match(/\.adm-bar\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(rule, /display\s*:\s*[^;]*!important/i);
  assert.doesNotMatch(css, /#adm-bar\s*\{[^}]*display\s*:\s*(?:flex|block|grid)\s*!important/i);
});
