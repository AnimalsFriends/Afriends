/**
 * VISTA: formulario de contacto accesible (etiquetas, errores asociados, autocompletado).
 * Funciones puras: devuelven HTML escapado. Sin estilos ni eventos en línea (CSP).
 */
import { esc } from "../utils/dom.js";
import { LIMITS } from "../shared/contactSchema.js";

export const ERROR_MESSAGES = {
  nombre:   { requerido: "Cuéntanos tu nombre.", corto: "Escribe al menos 2 letras.", largo: "El nombre es muy largo." },
  telefono: { requerido: "Necesitamos un número para contactarte.", invalido: "Escribe un número válido (de 7 a 15 dígitos)." },
  correo:   { invalido: "Revisa el correo: parece tener un error.", largo: "El correo es muy largo." },
  mascota:  { largo: `Máximo ${LIMITS.mascota.max} caracteres.` },
  servicio: { invalido: "Elige una opción de la lista." },
  mensaje:  { largo: `Máximo ${LIMITS.mensaje.max} caracteres.`, enlaces: `Por seguridad no aceptamos más de ${LIMITS.maxEnlaces} enlaces en el mensaje.` },
  aceptaDatos: { requerido: "Necesitamos tu autorización para poder contactarte." }
};

const field = ({ id, label, required, hint, control }) => `
  <div class="field" data-field="${id}">
    <label for="cf-${id}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ""}</label>
    ${control}
    ${hint ? `<p class="field__hint" id="cf-${id}-hint">${hint}</p>` : ""}
    <p class="field__error" id="cf-${id}-err" aria-live="polite"></p>
  </div>`;

const describedBy = (id, hasHint) => `aria-describedby="${hasHint ? `cf-${id}-hint ` : ""}cf-${id}-err"`;

export const ContactFormView = {
  form({ servicios, withCaptcha }) {
    const options = servicios.map((s) => `<option value="${esc(s.id)}">${esc(s.titulo)}</option>`).join("");
    return `
    <form id="contact-form" class="form" novalidate>
      <p class="form__note">Los campos con <span class="req" aria-hidden="true">*</span><span class="visually-hidden">asterisco</span> son obligatorios.</p>

      <div class="form__grid">
        ${field({ id: "nombre", label: "Tu nombre", required: true,
          control: `<input id="cf-nombre" name="nombre" type="text" autocomplete="name" maxlength="${LIMITS.nombre.max}" required ${describedBy("nombre")}>` })}
        ${field({ id: "telefono", label: "Tu WhatsApp o teléfono", required: true,
          control: `<input id="cf-telefono" name="telefono" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="300 123 4567" required ${describedBy("telefono")}>` })}
        ${field({ id: "correo", label: "Correo electrónico (opcional)",
          control: `<input id="cf-correo" name="correo" type="email" autocomplete="email" maxlength="${LIMITS.correo.max}" ${describedBy("correo")}>` })}
        ${field({ id: "mascota", label: "¿Cómo se llama tu peludito? (opcional)",
          control: `<input id="cf-mascota" name="mascota" type="text" maxlength="${LIMITS.mascota.max}" ${describedBy("mascota")}>` })}
        <div class="field--wide">
          ${field({ id: "servicio", label: "¿Qué servicio te interesa?",
            control: `<select id="cf-servicio" name="servicio" ${describedBy("servicio")}><option value="">Elige una opción</option>${options}<option value="otro">Otro / aún no estoy seguro</option></select>` })}
        </div>
        <div class="field--wide">
          ${field({ id: "mensaje", label: "Cuéntanos más (opcional)",
            hint: `Máximo ${LIMITS.mensaje.max} caracteres.`,
            control: `<textarea id="cf-mensaje" name="mensaje" rows="4" maxlength="${LIMITS.mensaje.max}" ${describedBy("mensaje", true)}></textarea>` })}
        </div>
      </div>

      <div class="field field--check" data-field="aceptaDatos">
        <input id="cf-aceptaDatos" name="aceptaDatos" type="checkbox" ${describedBy("aceptaDatos")} required>
        <label for="cf-aceptaDatos">Autorizo el tratamiento de mis datos para que me contacten, según la
          <a href="politica-privacidad.html" target="_blank" rel="noopener noreferrer">Política de privacidad</a> <span class="req" aria-hidden="true">*</span></label>
        <p class="field__error" id="cf-aceptaDatos-err" aria-live="polite"></p>
      </div>

      <!-- Trampa para bots: las personas no la ven ni la llenan -->
      <div class="honeypot" aria-hidden="true">
        <label for="cf-sitio_web">No llenes este campo</label>
        <input id="cf-sitio_web" name="sitio_web" type="text" tabindex="-1" autocomplete="off">
      </div>

      ${withCaptcha ? '<div id="cf-turnstile" class="turnstile-box"></div>' : ""}

      <p id="cf-status" class="form__status" role="status" aria-live="polite"></p>
      <!-- El formulario queda como alternativa secundaria a la cotización por WhatsApp. -->
      <button id="cf-submit" class="btn btn--ghost" type="submit">Enviar mensaje</button>
    </form>`;
  },

  success({ nombre, waUrl }) {
    return `
    <div class="form-success" id="cf-success" tabindex="-1" role="status">
      <h3>¡Gracias, ${esc(nombre)}! 🐾</h3>
      <p>Recibimos tu mensaje y te contactaremos muy pronto.${waUrl ? " Si quieres adelantar la conversación, escríbenos por WhatsApp:" : ""}</p>
      ${waUrl ? `<p><a class="btn btn--ghost" href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer">Continuar por WhatsApp</a></p>` : ""}
    </div>`;
  },

  /** Mensaje de error con salida por WhatsApp (nunca perdemos al cliente). */
  fallbackStatus(message, waUrl) {
    return `${esc(message)}${waUrl ? ` <a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a>.` : ""}`;
  }
};
