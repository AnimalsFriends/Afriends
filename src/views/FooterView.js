/**
 * VISTA: pie de página con datos de contacto, horarios, redes y enlaces legales.
 * Los campos vacíos simplemente no se muestran.
 */
import { esc, safeUrl } from "../utils/dom.js";

const LEGAL_LINKS = [
  ["aviso-legal.html", "Aviso legal"],
  ["politica-privacidad.html", "Política de privacidad"],
  ["politica-cookies.html", "Política de cookies"]
];

export const FooterView = {
  render({ negocio, waUrl, analyticsEnabled = false }) {
    const n = negocio;
    const nombre = esc(n.nombre ?? "Animal Friends");

    const horarios = (n.horarios ?? []).map((h) => `<li>${esc(h)}</li>`).join("");

    const redes = [["Instagram", n.redes?.instagram], ["Facebook", n.redes?.facebook], ["TikTok", n.redes?.tiktok]]
      .map(([label, url]) => [label, safeUrl(url)])
      .filter(([, url]) => url)
      .map(([label, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a></li>`)
      .join("");

    const contacto = [
      waUrl && n.telefonoVisible ? `<li>WhatsApp: <a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer">${esc(n.telefonoVisible)}</a></li>` : "",
      n.correo ? `<li><a href="mailto:${esc(n.correo)}">${esc(n.correo)}</a></li>` : "",
      n.direccion ? `<li>${esc(n.direccion)}</li>` : "",
      n.ubicacionVisible ? `<li>${esc(n.ubicacionVisible)}</li>` : ""
    ].join("");

    const razon = n.razonSocial ? ` · ${esc(n.razonSocial)}${n.nit ? ` · NIT ${esc(n.nit)}` : ""}` : "";

    return `
      <div class="container">
        <div class="site-footer__grid">
          <div class="site-footer__brand">
            <img src="assets/img/logo-icon.webp" alt="" width="72" height="72" loading="lazy">
            <p><strong>${nombre}</strong></p>
            <p>${esc(n.descripcionFooter ?? "")}</p>
          </div>
          ${horarios ? `<div><h2>Horarios de atención</h2><ul class="site-footer__list">${horarios}</ul></div>` : ""}
          <div id="contacto">
            <h2>Contacto</h2>
            <ul class="site-footer__list">${contacto}</ul>
            ${redes ? `<h2 class="site-footer__subtitle">Síguenos</h2><ul class="site-footer__list">${redes}</ul>` : ""}
          </div>
          <div>
            <h2>Información legal</h2>
            <ul class="site-footer__list">
              ${LEGAL_LINKS.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("")}
              ${analyticsEnabled ? '<li><button type="button" class="link-button" data-open-cookie-settings>Configurar cookies</button></li>' : ""}
            </ul>
          </div>
        </div>
        <p class="site-footer__legal">© ${new Date().getFullYear()} ${nombre}${razon}. Todos los derechos reservados.</p>
      </div>`;
  }
};
