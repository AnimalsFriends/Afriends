/**
 * Google Analytics 4 con CONSENTIMIENTO PREVIO.
 *  - Nada se descarga ni se envía a Google hasta que el visitante acepte.
 *  - Sin GA_MEASUREMENT_ID configurado, este módulo no hace nada.
 */
import { ENV } from "../config/env.js";

const ID = String(ENV.GA_MEASUREMENT_ID || "").trim();
let loaded = false;

export const analyticsConfigured = () => /^G-[A-Z0-9]{4,}$/.test(ID);

export const Analytics = {
  enable() {
    if (!analyticsConfigured()) return;
    window[`ga-disable-${ID}`] = false;
    if (loaded) return;
    loaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };   // GA4 exige "arguments"

    // Privacidad: solo medición; sin señales de publicidad ni personalización
    window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    window.gtag("js", new Date());
    window.gtag("config", ID, { allow_google_signals: false, allow_ad_personalization_signals: false });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;
    document.head.appendChild(script);
  },

  /** Revoca el consentimiento: detiene el envío y borra las cookies de GA. */
  disable() {
    if (!analyticsConfigured()) return;
    window[`ga-disable-${ID}`] = true;
    const host = location.hostname;
    const parent = host.split(".").slice(-2).join(".");
    document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => n === "_ga" || n.startsWith("_ga_")).forEach((name) => {
      for (const domain of [host, `.${host}`, `.${parent}`]) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
      }
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  },

  track(name, params = {}) {
    if (!loaded || !analyticsConfigured() || window[`ga-disable-${ID}`] === true) return;
    window.gtag("event", name, params);
  }
};
