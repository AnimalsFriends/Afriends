/** Google Tag Manager con consentimiento previo y sin configuración GA4 duplicada. */
import { ENV } from "../config/env.js";

const ID = String(ENV.GTM_CONTAINER_ID || "").trim();
let loaded = false;
let granted = false;

const consent = (analyticsStorage) => ({
  analytics_storage: analyticsStorage,
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied"
});

function ensureDataLayer() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
}

function clearAnalyticsCookies() {
  const host = location.hostname;
  const parent = host.split(".").slice(-2).join(".");
  document.cookie.split(";").map((cookie) => cookie.split("=")[0].trim())
    .filter((name) => name === "_ga" || name.startsWith("_ga_"))
    .forEach((name) => {
      for (const domain of [host, `.${host}`, `.${parent}`]) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
      }
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
}

export const analyticsConfigured = () => /^GTM-[A-Z0-9]{4,}$/.test(ID);

export const Analytics = {
  /** Establece Consent Mode v2 denegado sin descargar recursos de Google. */
  prepare() {
    if (!analyticsConfigured()) return;
    ensureDataLayer();
    window.gtag("consent", "default", consent("denied"));
  },

  enable() {
    if (!analyticsConfigured()) return;
    ensureDataLayer();
    granted = true;
    window.gtag("consent", "update", consent("granted"));
    if (loaded) return;
    loaded = true;
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(ID)}`;
    script.dataset.analyticsContainer = ID;
    document.head.appendChild(script);
  },

  disable() {
    if (!analyticsConfigured()) return;
    ensureDataLayer();
    granted = false;
    window.gtag("consent", "update", consent("denied"));
    clearAnalyticsCookies();
  },

  track(name, params = {}) {
    if (!loaded || !granted || !analyticsConfigured()) return;
    window.dataLayer.push({ event: name, ...params });
  }
};
