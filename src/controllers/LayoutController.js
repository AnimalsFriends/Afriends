/**
 * CONTROLADOR: elementos compartidos por TODAS las páginas
 * (header, footer, botón flotante de WhatsApp, menú móvil, datos legales).
 *
 * render() es idempotente: se llama primero con datos locales (pintado inmediato)
 * y de nuevo cuando llegan los datos de Supabase.
 */
import { HeaderView } from "../views/HeaderView.js";
import { FooterView } from "../views/FooterView.js";
import { WhatsAppFloatView } from "../views/WhatsAppFloatView.js";
import { mount } from "../utils/dom.js";
import { whatsappUrl } from "../utils/whatsapp.js";
import { analyticsConfigured } from "../services/analytics.js";

const LEGAL_LABELS = {
  razonSocial: "razón social",
  nit: "NIT o documento de identidad",
  direccion: "dirección",
  ciudad: "ciudad",
  correo: "correo electrónico",
  telefono: "teléfono",
  nombre: "nombre comercial"
};

export class LayoutController {
  constructor({ headerEl, footerEl }) {
    this.headerEl = headerEl;
    this.footerEl = footerEl;
    this.floatEl = null;
    this.bindMenu();
  }

  render(state) {
    const { negocio } = state;
    const saludo = negocio.mensajeWhatsApp?.saludo || "¡Hola!";
    const waUrl = whatsappUrl(negocio.whatsapp, `${saludo} Quisiera más información sobre sus servicios.`);

    mount(this.headerEl, HeaderView.render({ negocio, waUrl }));
    mount(this.footerEl, FooterView.render({ negocio, waUrl, analyticsEnabled: analyticsConfigured() }));
    this.renderWhatsAppFloat(waUrl);
    this.fillLegal(negocio);
    this.toggleAnalyticsBlocks();
    this.waUrl = waUrl;
  }

  renderWhatsAppFloat(waUrl) {
    if (!this.floatEl) {
      this.floatEl = document.createElement("div");
      document.body.appendChild(this.floatEl);
    }
    mount(this.floatEl, WhatsAppFloatView.render(waUrl));
  }

  /** Rellena [data-legal="campo"] en las páginas legales con los datos del negocio. */
  fillLegal(negocio) {
    const values = {
      razonSocial: negocio.razonSocial,
      nit: negocio.nit,
      direccion: negocio.direccion,
      ciudad: negocio.ciudad,
      correo: negocio.correo,
      telefono: negocio.telefonoVisible,
      nombre: negocio.nombre
    };
    const missing = new Set();
    document.querySelectorAll("[data-legal]").forEach((el) => {
      const key = el.dataset.legal;
      const value = (values[key] ?? "").toString().trim();
      if (value) {
        el.textContent = value;
        el.classList.remove("legal-missing");
      } else {
        el.textContent = `[Completar: ${LEGAL_LABELS[key] ?? key}]`;
        el.classList.add("legal-missing");
        missing.add(LEGAL_LABELS[key] ?? key);
      }
    });
    if (missing.size) console.warn("[Legal] Faltan datos por completar en site.defaults.js:", [...missing].join(", "));
  }

  /** Textos legales que dependen de si hay analítica configurada. */
  toggleAnalyticsBlocks() {
    const on = analyticsConfigured();
    document.querySelectorAll("[data-analytics-only]").forEach((el) => { el.hidden = !on; });
    document.querySelectorAll("[data-no-analytics-only]").forEach((el) => { el.hidden = on; });
  }

  /** Menú móvil por delegación de eventos (sobrevive a los re-render). */
  bindMenu() {
    const close = (returnFocus = false) => {
      const nav = this.headerEl.querySelector("#primary-nav");
      const toggle = this.headerEl.querySelector(".nav-toggle");
      if (!nav || !toggle) return;
      nav.dataset.open = "false";
      toggle.setAttribute("aria-expanded", "false");
      toggle.querySelector(".visually-hidden").textContent = "Abrir menú";
      if (returnFocus) toggle.focus();
    };

    this.headerEl.addEventListener("click", (event) => {
      const toggle = event.target.closest(".nav-toggle");
      if (toggle) {
        const nav = this.headerEl.querySelector("#primary-nav");
        const open = nav.dataset.open !== "true";
        nav.dataset.open = String(open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.querySelector(".visually-hidden").textContent = open ? "Cerrar menú" : "Abrir menú";
        return;
      }
      if (event.target.closest("#primary-nav a")) close();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close(true);
    });
  }

  /** Solo con ?debug=1: indica de dónde salieron los datos. */
  showDebugBadge(state) {
    if (new URLSearchParams(location.search).get("debug") !== "1") return;
    document.querySelector(".debug-badge")?.remove();
    const badge = document.createElement("div");
    badge.className = "debug-badge";
    badge.setAttribute("role", "status");
    badge.textContent = state.source === "supabase" ? "Datos: Supabase ✔" : "Datos: valores locales (site.defaults.js)";
    document.body.appendChild(badge);
  }
}
