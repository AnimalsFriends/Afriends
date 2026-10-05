/**
 * MODELO: formulario de contacto.
 * Valida (con el esquema compartido), controla el tiempo de espera entre envíos y
 * envía los datos a la Function. No toca el DOM.
 */
import { ENV } from "../config/env.js";
import { validateContact } from "../shared/contactSchema.js";

const COOLDOWN_KEY = "af_last_contact";
const COOLDOWN_MS = 60_000;
export const MIN_FILL_MS = 2600;        // el servidor descarta envíos más rápidos que 2.5 s (bots)

export class ContactModel {
  static validate(data) {
    return validateContact(data);
  }

  /** Milisegundos que faltan para poder volver a enviar (0 = ya puede). */
  static cooldownRemaining() {
    try {
      const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
      return Math.max(0, COOLDOWN_MS - (Date.now() - last));
    } catch { return 0; }
  }

  static markSubmitted() {
    try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch { /* modo privado: se ignora */ }
  }

  /**
   * @returns {Promise<{status: "ok"|"captcha"|"rate"|"invalid"|"network"|"server", errors?: object}>}
   */
  static async submit({ clean, aceptaDatos, token, honeypot, elapsed }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(ENV.CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ ...clean, aceptaDatos, token: token || "", sitio_web: honeypot || "", elapsed })
      });
      if (response.ok) return { status: "ok" };
      const body = await response.json().catch(() => ({}));
      if (response.status === 403 && body.error === "captcha") return { status: "captcha" };
      if (response.status === 429) return { status: "rate" };
      if (response.status === 400) return { status: "invalid", errors: body.errors ?? {} };
      return { status: "server" };
    } catch {
      return { status: "network" };
    } finally {
      clearTimeout(timer);
    }
  }
}
