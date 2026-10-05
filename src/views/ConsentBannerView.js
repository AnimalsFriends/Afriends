/**
 * VISTA: aviso de cookies. "Aceptar" y "Rechazar" tienen el mismo peso visual
 * (sin patrones oscuros). No bloquea la navegación (no es modal).
 */
export const ConsentBannerView = {
  render({ current }) {
    const note = current === true ? "Hoy tienes la analítica activada." : current === false ? "Hoy tienes la analítica desactivada." : "";
    return `
    <div class="consent" id="consent-banner" role="dialog" aria-labelledby="consent-title" aria-describedby="consent-text">
      <h2 id="consent-title" class="consent__title">¿Nos ayudas a mejorar? 🍪</h2>
      <p id="consent-text" class="consent__text">Usamos Google Analytics solo para saber, de forma agregada, cuántas personas visitan la página y qué secciones les sirven.
        No se activa si no lo aceptas. ${note} Más información en la <a href="politica-cookies.html">Política de cookies</a>.</p>
      <div class="consent__actions">
        <button type="button" class="btn btn--ghost" data-consent="reject">Rechazar</button>
        <button type="button" class="btn btn--ghost" data-consent="accept">Aceptar analítica</button>
      </div>
    </div>`;
  }
};
