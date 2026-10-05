/**
 * PUNTO DE ENTRADA (todas las páginas).
 *  1) Pinta header/footer al instante con datos locales.
 *  2) Inicia consentimiento de cookies / analítica (no hace nada si no está configurada).
 *  3) Descarga en paralelo los módulos de la home (cotizador y formulario) y los datos de Supabase.
 *  4) Con los datos listos, monta las secciones (con respaldo local si Supabase falla).
 */
import { SiteConfigModel } from "./models/SiteConfigModel.js";
import { LayoutController } from "./controllers/LayoutController.js";
import { HomeController } from "./controllers/HomeController.js";
import { SeoController } from "./controllers/SeoController.js";
import { AnalyticsController } from "./controllers/AnalyticsController.js";

const byId = (id) => document.getElementById(id);
const page = document.body.dataset.page ?? "home";

const layout = new LayoutController({ headerEl: byId("site-header"), footerEl: byId("site-footer") });
layout.render(SiteConfigModel.fromDefaults());
new AnalyticsController().init();

const home = page === "home" ? new HomeController({ servicesList: byId("services-list") }) : null;
const quoteRoot = byId("quote-root");
const formRoot = byId("contact-form-root");

// Los módulos de la home se piden YA, en paralelo con los datos (sin cascada de peticiones)
const quoteModule = quoteRoot ? import("./controllers/QuoteController.js") : null;
const formModule = formRoot ? import("./controllers/ContactController.js") : null;

try {
  const state = await SiteConfigModel.load();
  layout.render(state);
  layout.showDebugBadge(state);
  home?.render(state);
  new SeoController().update(state);
  document.documentElement.dataset.source = state.source;   // "supabase" | "local"

  let quote = null;
  if (quoteModule) {
    const { QuoteController } = await quoteModule;
    quote = new QuoteController({ root: quoteRoot, state });
    quote.init();
    // Los enlaces "Cotizar este servicio" de las tarjetas abren la categoría correspondiente
    byId("servicios")?.addEventListener("click", (event) => {
      const link = event.target.closest("[data-goto-category]");
      if (link) quote.select(link.dataset.gotoCategory);
    });
  }
  if (formModule) {
    const { ContactController } = await formModule;
    new ContactController({ root: formRoot, state }).init();
  }
} catch (error) {
  console.error("[main] No se pudo iniciar la página:", error);
  home?.renderError();
}
