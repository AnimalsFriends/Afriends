import test from "node:test";
import assert from "node:assert/strict";
import { buildBusinessSchema, buildPageSchema } from "../src/seo/structuredData.js";
import { SiteConfigModel } from "../src/models/SiteConfigModel.js";

const state = SiteConfigModel.fromDefaults();
const business = (extra = {}, siteUrl = "") =>
  buildBusinessSchema({ negocio: { ...state.negocio, ...extra }, categorias: state.categorias, siteUrl })["@graph"][0];

test("no inventa datos: sin dirección ni correo no aparecen", () => {
  const b = business({ correo: "", direccion: "", ciudad: "" });
  assert.equal(b.email, undefined);
  assert.equal(b.address, undefined);
  assert.equal(b.url, undefined);
});

test("incluye teléfono, servicios y precio mínimo", () => {
  const b = business();
  assert.equal(b.telephone, "+573123044174");
  assert.equal(b.hasOfferCatalog.itemListElement.length, state.categorias.length);
  assert.ok(b.hasOfferCatalog.itemListElement.every((o) => o.priceSpecification.minPrice > 0));
});

test("omite precios desconocidos y solo usa cero cuando el servicio es gratis", () => {
  const normalized = SiteConfigModel.normalize({
    negocio: {},
    categorias: [
      { id: "unknown", tarjeta: { titulo: "Sin precio" }, servicios: [{ id: "legacy", nombre: "Legado", precio: 0 }] },
      { id: "missing", tarjeta: { titulo: "Precio ausente" }, servicios: [{ id: "missing", nombre: "Ausente" }] },
      { id: "invalid", tarjeta: { titulo: "Precio inválido" }, servicios: [{ id: "invalid", nombre: "Inválido", precio: "no es un precio" }] },
      { id: "quote", tarjeta: { titulo: "Por cotizar" }, servicios: [{ id: "quote", nombre: "Cotización", tipoPrecio: "cotizar" }] },
      { id: "free", tarjeta: { titulo: "Gratis" }, servicios: [{ id: "free", nombre: "Gratis", tipoPrecio: "gratis", precio: 0 }] },
      { id: "fixed", tarjeta: { titulo: "Precio fijo" }, servicios: [{ id: "fixed", nombre: "Fijo", precio: 45000 }] },
      { id: "mixed", tarjeta: { titulo: "Precios mixtos" }, servicios: [
        { id: "known", nombre: "Con precio", precio: 25000 },
        { id: "quote", nombre: "Por cotizar", tipoPrecio: "cotizar" }
      ] }
    ]
  });
  const offers = buildBusinessSchema({ negocio: {}, categorias: normalized.categorias })["@graph"][0].hasOfferCatalog.itemListElement;

  assert.deepEqual(normalized.categorias.slice(0, 4).map((c) => [c.servicios[0].tipoPrecio, c.servicios[0].precio]), [
    ["sin_definir", null],
    ["sin_definir", null],
    ["sin_definir", null],
    ["cotizar", null]
  ]);
  assert.ok(offers.slice(0, 4).every((offer) => !("priceSpecification" in offer)));
  assert.equal(offers[4].priceSpecification.minPrice, 0);
  assert.equal(offers[5].priceSpecification.minPrice, 45000);
  assert.ok(!("priceSpecification" in offers[6]));
});

test("con dominio genera URLs absolutas", () => {
  const b = business({}, "https://ejemplo.co");
  assert.equal(b["@id"], "https://ejemplo.co/#negocio");
  assert.equal(b.url, "https://ejemplo.co/");
});

test("sameAs descarta enlaces peligrosos o inválidos", () => {
  const b = business({ redes: { instagram: "javascript:alert(1)", facebook: "https://facebook.com/af", tiktok: "" } });
  assert.deepEqual(b.sameAs, ["https://facebook.com/af"]);
});

test("páginas internas: WebPage + migas de pan (solo con dominio)", () => {
  assert.equal(buildPageSchema({ siteUrl: "", path: "/aviso-legal", name: "Aviso legal" }), null);
  const g = buildPageSchema({ siteUrl: "https://ejemplo.co", path: "/aviso-legal", name: "Aviso legal", description: "d" })["@graph"];
  assert.deepEqual(g.map((x) => x["@type"]), ["WebPage", "BreadcrumbList"]);
});
