/**
 * VISTA: encabezado del sitio (logo + navegación + llamada a la acción).
 * Accesible: landmark <nav>, botón de menú con aria-expanded, objetivos táctiles >= 44px.
 */
import { esc } from "../utils/dom.js";

export const HeaderView = {
  render({ negocio }) {
    const nombre = esc(negocio.nombre ?? "Animal Friends");
    const cta = '<a class="btn btn--primary" href="index.html#cotizador">Cotizar por WhatsApp</a>';
    return `
      <div class="site-header__bar container">
        <a class="site-header__logo" href="index.html" aria-label="${nombre}, ir al inicio">
          <img src="assets/img/logo-horizontal.webp" alt="${nombre}" width="264" height="95">
        </a>

        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">
          <span class="visually-hidden">Abrir menú</span>
          <svg class="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>

        <nav id="primary-nav" class="site-nav" aria-label="Principal" data-open="false">
          <ul>
            <li><a href="index.html#servicios">Servicios</a></li>
            <li><a href="index.html#cotizador">Cotizador</a></li>
            <li><a href="#contacto">Contacto</a></li>
          </ul>
          ${cta}
        </nav>
      </div>`;
  }
};
