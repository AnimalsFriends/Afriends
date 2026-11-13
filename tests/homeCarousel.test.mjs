import test from "node:test";
import assert from "node:assert/strict";
import { SiteConfigModel } from "../src/models/SiteConfigModel.js";
import { syncCarouselQuotes } from "../src/controllers/HomeCarouselController.js";

test("cada slide enlaza el servicio y el texto de WhatsApp a su propia categoría", () => {
  const state = SiteConfigModel.fromDefaults();
  const links = ["colegio", "hotel", "banos"].map((id) => ({
    dataset: {},
    closest: () => ({ dataset: { serviceCategory: id } }),
    set href(value) { this.url = value; }
  }));
  syncCarouselQuotes(state, { querySelectorAll: () => links });

  links.forEach((link, index) => {
    const categoryId = ["colegio", "hotel", "banos"][index];
    const category = state.categorias.find((item) => item.id === categoryId);
    const message = new URL(link.url).searchParams.get("text");
    assert.match(link.textContent, new RegExp(`Cotizar ${categoryId === "banos" ? "baño" : categoryId} por WhatsApp`, "i"));
    assert.ok(message.includes(category.servicios[0].nombreMensaje || category.servicios[0].nombre));
    assert.ok(message.includes(category.tarjeta.titulo));
  });
});
