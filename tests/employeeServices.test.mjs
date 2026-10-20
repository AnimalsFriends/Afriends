import test from "node:test";
import assert from "node:assert/strict";
import { AdminViews } from "../src/admin/views/adminViews.js";
import { SITE_DEFAULTS } from "../src/config/site.defaults.js";
import { normalizeDraft } from "../src/admin/models/siteDraft.js";

test("el empleado consulta servicios publicados sin controles de edición", () => {
  const data = normalizeDraft(SITE_DEFAULTS);
  const html = AdminViews.employeeServices(data);
  assert.match(html, /Baño normal/);
  assert.match(html, /Peluquería|peluquería/i);
  assert.doesNotMatch(html, /data-action=|data-path=|<input|<select|<textarea/);
});

test("el catálogo del empleado oculta servicios y categorías inactivos y escapa contenido", () => {
  const data = normalizeDraft({
    negocio: { moneda: "COP" },
    categorias: [{ activa: true, tipo: "normal", tarjeta: { titulo: "Baños <seguro>" }, servicios: [
      { activo: true, nombre: "Baño <especial>", tipoPrecio: "fijo", precio: 35000 },
      { activo: false, nombre: "Servicio oculto", tipoPrecio: "gratis", precio: 0 }
    ] }, { activa: false, tarjeta: { titulo: "Categoría oculta" }, servicios: [{ activo: true, nombre: "No mostrar" }] }]
  });
  const html = AdminViews.employeeServices(data);
  assert.match(html, /Baños &lt;seguro&gt;/);
  assert.match(html, /Baño &lt;especial&gt;/);
  assert.match(html, /\$35\.000 COP/);
  assert.doesNotMatch(html, /Servicio oculto|Categoría oculta|No mostrar/);
});

test("sin catálogo remoto no expone los valores locales de respaldo", () => {
  const html = AdminViews.employeeServices(null);
  assert.match(html, /No pudimos cargar el catálogo publicado/);
  assert.doesNotMatch(html, /Baño normal|Peluquería/);
});
