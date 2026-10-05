import test from "node:test";
import assert from "node:assert/strict";
import { QuoteModel, cleanName } from "../src/models/QuoteModel.js";
import { SiteConfigModel } from "../src/models/SiteConfigModel.js";

const fresh = () => new QuoteModel(SiteConfigModel.fromDefaults());

test("sin servicios: total 0, vacío y enlace a WhatsApp sin texto", () => {
  const q = fresh();
  assert.equal(q.total, 0);
  assert.equal(q.isEmpty, true);
  assert.equal(q.url(), "https://wa.me/573123044174");
});

test("precio fijo: suma los servicios elegidos", () => {
  const q = fresh();
  q.setService("banos", "bano-normal", true);
  q.setService("banos", "bano-medicado", true);
  assert.equal(q.total, 35000 + 50000);
  q.setService("banos", "bano-normal", false);
  assert.equal(q.total, 50000);
});

test("por noches: precio x noches, ajustado al rango válido", () => {
  const q = fresh();
  assert.equal(q.setNights("hotel", 3), 3);
  assert.equal(q.isSelected("hotel", "hotel-noche"), true, "al elegir noches se activa el servicio");
  assert.equal(q.total, 60000 * 3);
  assert.match(q.items[0].name, /\(3 noches\)$/);
  assert.equal(q.setNights("hotel", 999), 30);
  assert.equal(q.setNights("hotel", 0), 1);
  assert.equal(q.setNights("hotel", "abc"), 1);
  assert.match(q.items[0].name, /\(1 noche\)$/);
});

test("por días: precio x días marcados; sin días cuenta 1 día base", () => {
  const q = fresh();
  q.setDay("colegio", "Lunes", true);
  q.setDay("colegio", "Miércoles", true);
  assert.equal(q.isSelected("colegio", "colegio-ruta"), true);
  assert.equal(q.total, 40000 * 2);
  assert.match(q.items[0].name, /\(Lunes, Miércoles\)$/);
  q.setDay("colegio", "Lunes", false); q.setDay("colegio", "Miércoles", false);
  assert.equal(q.total, 40000);
  assert.match(q.items[0].name, /\(1 día base\)$/);
});

test("los días salen en el orden del calendario, no del clic", () => {
  const q = fresh();
  q.setDay("colegio", "Viernes", true); q.setDay("colegio", "Martes", true);
  assert.match(q.items[0].name, /\(Martes, Viernes\)$/);
});

test("el pedido sigue el orden del catálogo", () => {
  const q = fresh();
  q.setNights("hotel", 1); q.setService("banos", "corte-unas", true);
  assert.deepEqual(q.items.map((i) => i.catId), ["banos", "hotel"]);
});

test("mensaje de WhatsApp: nombres opcionales y total", () => {
  const q = fresh();
  q.setService("banos", "bano-normal", true);
  assert.match(q.message(), /^¡Hola! Qué alegría saludarte 🐾\.\nQuiero agendar servicios\./);
  q.setNames({ cliente: "Ana", mascota: "Max" });
  const m = q.message();
  assert.match(m, /Mi nombre es \*Ana\* y quiero agendar servicios para mi peludito \*Max\*\./);
  assert.match(m, /- Baño normal \(\$35\.000 COP\)/);
  assert.match(m, /\*Total estimado:\* \$35\.000 COP\./);
  assert.match(m, /¿Me confirman disponibilidad por favor\?$/);
});

test("el enlace de WhatsApp codifica el mensaje con el número del negocio", () => {
  const q = fresh();
  q.setService("banos", "bano-normal", true);
  q.setNames({ cliente: "Ana" });
  const url = new URL(q.url());
  assert.equal(url.pathname, "/573123044174");
  assert.match(decodeURIComponent(url.searchParams.get("text")), /Mi nombre es \*Ana\*/);
});

test("los nombres no pueden alterar el formato de WhatsApp ni romper líneas", () => {
  assert.equal(cleanName("  *Ana*_\n  María~`  "), "Ana María");
  assert.equal(cleanName("x".repeat(100)).length, 60);
  assert.equal(cleanName(null), "");
});

test("usa nombreMensaje cuando existe", () => {
  const q = fresh();
  q.setService("colegio", "colegio-ruta", true);
  assert.match(q.items[0].name, /^Colegio con Ruta Canina/);
});

test("categoría sin días configurados usa lunes a sábado; ids inexistentes no rompen", () => {
  const q = new QuoteModel({ negocio: { whatsapp: "573000000000" }, categorias: [{ id: "x", tipo: "porDias", servicios: [{ id: "s", nombre: "S", precio: 10 }] }] });
  q.setDay("x", "Sábado", true);
  assert.equal(q.total, 10);
  q.setNights("inexistente", 2);          // no lanza
  q.setService("inexistente", "z", true);
  assert.ok(Number.isFinite(q.total));
});
