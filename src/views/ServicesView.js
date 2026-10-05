/**
 * VISTA: sección "Nuestros servicios".
 *
 * Solo transforma datos en HTML (funciones puras). No hace fetch ni escucha eventos.
 * Todo texto dinámico pasa por esc() para evitar inyección de HTML.
 */
import { esc } from "../utils/dom.js";
import { formatMoney } from "../utils/format.js";
import { SiteConfigModel } from "../models/SiteConfigModel.js";

const renderBullet = (item) => {
  const text = typeof item === "string" ? item : item.texto;
  const highlight = typeof item === "object" && item.destacado ? ' class="is-highlight"' : "";
  return `<li${highlight}>${esc(text)}</li>`;
};

const renderCard = (cat, currency) => {
  const t = cat.tarjeta ?? {};
  const unit = cat.unidadPrecio ? ` ${esc(cat.unidadPrecio)}` : "";
  return `
    <li>
      <article class="card" data-category="${esc(cat.id)}">
        <div class="card__icon" aria-hidden="true">${esc(t.icono)}</div>
        <h3 class="card__title">${esc(t.titulo ?? cat.id)}</h3>
        <p class="card__text">${esc(t.descripcion)}</p>
        <ul class="card__list">${(t.puntos ?? []).map(renderBullet).join("")}</ul>
        <p class="card__price">Desde <strong>${formatMoney(SiteConfigModel.minPrice(cat), currency)}</strong>${unit}</p>
        <a class="card__link" href="#cotizador" data-goto-category="${esc(cat.id)}" aria-label="Cotizar ${esc(t.titulo ?? cat.id)}">Cotizar este servicio →</a>
      </article>
    </li>`;
};

export const ServicesView = {
  cards(categorias, currency) {
    if (!categorias.length) {
      return '<li class="state-msg">Pronto publicaremos nuestros servicios. ¡Escríbenos y te contamos todo!</li>';
    }
    return categorias.map((cat) => renderCard(cat, currency)).join("");
  }
};
