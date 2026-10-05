import test from "node:test";
import assert from "node:assert/strict";
import { buildBusinessSchema, buildPageSchema } from "../src/seo/structuredData.js";
import { SiteConfigModel } from "../src/models/SiteConfigModel.js";

const state = SiteConfigModel.fromDefaults();
const business = (extra = {}, siteUrl = "") =>
  buildBusinessSchema({ negocio: { ...state.negocio, ...extra }, categorias: state.categorias, siteUrl })["@graph"][0];

test("no inventa datos: sin dirección ni correo no aparecen", () => {
  const b = business();
  assert.equal(b.email, undefined);
  assert.equal(b.address.streetAddress, undefined);
  assert.equal(b.url, undefined);
});

test("incluye teléfono, servicios y precio mínimo", () => {
  const b = business();
  assert.equal(b.telephone, "+573123044174");
  assert.equal(b.hasOfferCatalog.itemListElement.length, state.categorias.length);
  assert.ok(b.hasOfferCatalog.itemListElement.every((o) => o.priceSpecification.minPrice > 0));
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
