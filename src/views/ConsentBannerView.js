/**
 * VISTA: aviso de cookies y preferencias.
 * Aceptar y rechazar tienen el mismo peso visual; la navegación no se bloquea.
 */
import { analyticsConfigured } from "../services/analytics.js";

export const ConsentBannerView = {
  render({ current }) {
    const configured = analyticsConfigured();
    const note = current === true ? "Tu elección guardada: aceptaste las cookies opcionales."
      : current === false ? "Tu elección guardada: rechazaste las cookies opcionales." : "";
    const detail = configured
      ? "Si aceptas, activaremos Google Analytics para medir el uso del sitio. Si rechazas, no se activará."
      : "Actualmente no hay herramientas de analítica opcional configuradas. Puedes guardar tu preferencia y cambiarla más adelante.";
    return `
    <section class="consent" id="consent-banner" role="region" aria-labelledby="consent-title" aria-describedby="consent-text">
      <h2 id="consent-title" class="consent__title">Tu privacidad importa 🍪</h2>
      <p id="consent-text" class="consent__text">Usamos almacenamiento necesario para que el sitio funcione. ${detail} Consulta nuestra <a href="politica-cookies.html">Política de cookies</a>.</p>
      ${note ? `<p class="consent__text">${note}</p>` : ""}
      <div class="consent__actions">
        <button type="button" class="btn btn--ghost" data-consent="reject">Rechazar opcionales</button>
        <button type="button" class="btn btn--ghost" data-consent="accept">Aceptar opcionales</button>
      </div>
    </section>`;
  }
};
