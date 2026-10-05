/**
 * CONTROLADOR: formulario de contacto.
 * Capas de protección anti-spam:  1) trampa (honeypot)  2) tiempo mínimo de llenado
 *   3) Cloudflare Turnstile  4) espera entre envíos  5) validación y límites en el servidor.
 * Si algo falla, el visitante siempre tiene salida por WhatsApp.
 */
import { ENV } from "../config/env.js";
import { ContactModel, MIN_FILL_MS } from "../models/ContactModel.js";
import { ContactFormView, ERROR_MESSAGES } from "../views/ContactFormView.js";
import { renderTurnstile, resetTurnstile } from "../services/turnstile.js";
import { Analytics } from "../services/analytics.js";
import { mount } from "../utils/dom.js";
import { whatsappUrl } from "../utils/whatsapp.js";

const FIELDS = ["nombre", "telefono", "correo", "mascota", "servicio", "mensaje", "aceptaDatos"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class ContactController {
  constructor({ root, state }) {
    this.root = root;
    this.state = state;
    this.siteKey = (ENV.TURNSTILE_SITE_KEY || "").trim();
    this.token = "";
    this.widgetId = null;
    this.renderedAt = 0;
  }

  init() {
    const servicios = this.state.categorias.map((c) => ({ id: c.id, titulo: c.tarjeta?.titulo ?? c.id }));
    mount(this.root, ContactFormView.form({ servicios, withCaptcha: Boolean(this.siteKey) }));
    this.form = this.root.querySelector("#contact-form");
    this.status = this.root.querySelector("#cf-status");
    this.button = this.root.querySelector("#cf-submit");
    this.renderedAt = performance.now();

    this.form.addEventListener("submit", (event) => { event.preventDefault(); this.onSubmit(); });
    this.form.addEventListener("input", (event) => this.clearError(event.target));
    this.lazyCaptcha();
  }

  /** Carga Turnstile solo cuando el formulario está cerca de la pantalla. */
  lazyCaptcha() {
    if (!this.siteKey) { console.warn("[Contacto] TURNSTILE_SITE_KEY vacío: el formulario se enviará sin verificación antispam."); return; }
    const box = this.root.querySelector("#cf-turnstile");
    const start = () => renderTurnstile(box, {
      siteKey: this.siteKey,
      onToken: (token) => { this.token = token; },
      onExpire: () => { this.token = ""; },
      onError: () => { this.token = ""; }
    }).then((id) => { this.widgetId = id; }).catch(() => this.setStatus("No pudimos cargar la verificación. Recarga la página o escríbenos por WhatsApp.", true));

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { observer.disconnect(); start(); }
      }, { rootMargin: "300px" });
      observer.observe(this.form);
    } else {
      start();
    }
  }

  get values() {
    const f = this.form.elements;
    return {
      nombre: f.nombre.value, telefono: f.telefono.value, correo: f.correo.value, mascota: f.mascota.value,
      servicio: f.servicio.value, mensaje: f.mensaje.value, aceptaDatos: f.aceptaDatos.checked
    };
  }

  waLink(values = this.values) {
    const { negocio } = this.state;
    const nombre = values.nombre?.trim();
    const servicio = this.state.categorias.find((c) => c.id === values.servicio)?.tarjeta?.titulo;
    const text = `${negocio.mensajeWhatsApp?.saludo || "¡Hola!"}${nombre ? ` Soy ${nombre}.` : ""} Quisiera información${servicio ? ` sobre ${servicio}` : " sobre sus servicios"}.`;
    return whatsappUrl(negocio.whatsapp, text);
  }

  setStatus(message, isError = false, html = false) {
    this.status.classList.toggle("is-error", isError);
    this.status[html ? "innerHTML" : "textContent"] = message;
  }

  clearError(input) {
    const name = input?.name;
    if (!FIELDS.includes(name)) return;
    input.removeAttribute("aria-invalid");
    const err = this.root.querySelector(`#cf-${name}-err`);
    if (err) err.textContent = "";
  }

  showErrors(errors) {
    let first = null;
    for (const name of FIELDS) {
      const err = this.root.querySelector(`#cf-${name}-err`);
      const input = this.form.elements[name];
      if (!err || !input) continue;
      const code = errors[name];
      err.textContent = code ? (ERROR_MESSAGES[name]?.[code] ?? "Revisa este campo.") : "";
      if (code) { input.setAttribute("aria-invalid", "true"); first ??= input; } else { input.removeAttribute("aria-invalid"); }
    }
    first?.focus();
  }

  async onSubmit() {
    this.setStatus("");
    const values = this.values;
    const { ok, errors, clean } = ContactModel.validate(values);
    if (!ok) { this.showErrors(errors); this.setStatus("Revisa los campos marcados.", true); return; }
    this.showErrors({});

    const wait = ContactModel.cooldownRemaining();
    if (wait > 0) {
      this.setStatus(ContactFormView.fallbackStatus(`Ya enviamos tu mensaje hace un momento. Espera ${Math.ceil(wait / 1000)} segundos para enviar otro.`, this.waLink(values)), true, true);
      return;
    }
    if (this.siteKey && !this.token) { this.setStatus("Confirma la verificación de seguridad antes de enviar.", true); return; }

    this.button.disabled = true;
    this.button.textContent = "Enviando…";
    this.setStatus("Enviando tu mensaje…");

    // Tiempo mínimo de llenado: si autocompletó muy rápido, esperamos en lugar de perder el mensaje
    const elapsedNow = performance.now() - this.renderedAt;
    if (elapsedNow < MIN_FILL_MS) await sleep(MIN_FILL_MS - elapsedNow);

    const result = await ContactModel.submit({
      clean, aceptaDatos: true, token: this.token,
      honeypot: this.form.elements.sitio_web.value,
      elapsed: Math.round(performance.now() - this.renderedAt)
    });

    if (result.status === "ok") {
      ContactModel.markSubmitted();
      Analytics.track("generate_lead", { form: "contacto", servicio: clean.servicio || "sin_elegir" });
      mount(this.root, ContactFormView.success({ nombre: clean.nombre, waUrl: this.waLink(values) }));
      this.root.querySelector("#cf-success")?.focus();
      return;
    }

    this.button.disabled = false;
    this.button.textContent = "Enviar mensaje";
    const wa = this.waLink(values);
    const messages = {
      captcha: "No pudimos verificar que eres una persona. Inténtalo de nuevo.",
      rate: "Enviaste varios mensajes seguidos. Intenta de nuevo más tarde.",
      invalid: "Revisa los datos del formulario.",
      network: "No pudimos enviar tu mensaje por un problema de conexión.",
      server: "No pudimos enviar tu mensaje en este momento."
    };
    if (result.status === "invalid" && result.errors) this.showErrors(result.errors);
    if (result.status === "captcha") { this.token = ""; resetTurnstile(this.widgetId); }
    this.setStatus(ContactFormView.fallbackStatus(messages[result.status] ?? messages.server, wa), true, true);
  }
}
