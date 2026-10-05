/**
 * CONTROLADOR: consentimiento de cookies + medición de conversiones.
 * Si no hay GA_MEASUREMENT_ID, no hace nada (ni siquiera muestra el aviso).
 * Eventos GA4: "whatsapp_click" (con la ubicación del botón) y "generate_lead" (formulario).
 */
import { Analytics, analyticsConfigured } from "../services/analytics.js";
import { ConsentModel } from "../models/ConsentModel.js";
import { ConsentBannerView } from "../views/ConsentBannerView.js";

const WA_LOCATIONS = [
  [".wa-float", "flotante"], ["header", "encabezado"], ["footer", "pie"], ["#cotizador", "cotizador"], ["#servicios", "servicios"], ["#formulario", "formulario"]
];

export class AnalyticsController {
  init() {
    if (!analyticsConfigured()) return;

    const consent = ConsentModel.get();
    if (consent?.analytics) Analytics.enable();
    if (!consent) this.showBanner();

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-cookie-settings]")) { this.showBanner(); return; }
      const choice = event.target.closest("[data-consent]");
      if (choice) { this.decide(choice.dataset.consent === "accept"); return; }
      const wa = event.target.closest('a[href^="https://wa.me/"]');
      if (wa) {
        const location = WA_LOCATIONS.find(([selector]) => wa.closest(selector))?.[1] ?? "otro";
        Analytics.track("whatsapp_click", { location });
      }
    });
  }

  showBanner() {
    this.hideBanner();
    const holder = document.createElement("div");
    holder.id = "consent-holder";
    holder.innerHTML = ConsentBannerView.render({ current: ConsentModel.get()?.analytics });
    document.body.appendChild(holder);
    document.body.classList.add("has-consent-banner");
    const height = holder.firstElementChild.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--consent-h", `${Math.ceil(height)}px`);   // CSSOM: permitido por la CSP
  }

  hideBanner() {
    document.getElementById("consent-holder")?.remove();
    document.body.classList.remove("has-consent-banner");
  }

  decide(accepted) {
    ConsentModel.set(accepted);
    accepted ? Analytics.enable() : Analytics.disable();
    this.hideBanner();
  }
}
