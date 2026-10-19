/**
 * VISTA: sección "Nuestros servicios".
 *
 * Solo transforma datos en HTML (funciones puras). No hace fetch ni escucha eventos.
 * Todo texto dinámico pasa por esc() para evitar inyección de HTML.
 */
import { esc } from "../utils/dom.js";
import { formatMoney } from "../utils/format.js";
import { SiteConfigModel } from "../models/SiteConfigModel.js";
import { PRICE_TYPE } from "../shared/pricing.js";

const renderBullet = (item) => {
  const text = typeof item === "string" ? item : item.texto;
  const highlight = typeof item === "object" && item.destacado ? ' class="is-highlight"' : "";
  return `<li${highlight}>${esc(text)}</li>`;
};

const renderCard = (cat, currency) => {
  const t = cat.tarjeta ?? {};
  const unit = cat.unidadPrecio ? ` ${esc(cat.unidadPrecio)}` : "";
  const minPrice = SiteConfigModel.minPrice(cat);
  const hasOtherServices = cat.servicios.some((service) => service.tipoPrecio !== PRICE_TYPE.FREE);
  const hasUnknownPrice = cat.servicios.some((service) => service.tipoPrecio === PRICE_TYPE.UNKNOWN);
  const hasQuotePrice = cat.servicios.some((service) => service.tipoPrecio === PRICE_TYPE.QUOTE);
  const priceLabel = minPrice === null
    ? (hasUnknownPrice ? "Precio por confirmar" : "Por cotizar")
    : minPrice === 0
      ? (hasOtherServices ? "Desde Gratis" : "Gratis")
      : `Desde ${formatMoney(minPrice, currency)}`;
  const priceNote = minPrice !== null && hasUnknownPrice && hasQuotePrice
    ? "Algunas opciones están por cotizar o confirmar."
    : minPrice !== null && hasUnknownPrice
      ? "Algunas opciones tienen precio por confirmar."
      : minPrice !== null && hasQuotePrice
        ? "Algunas opciones son por cotizar."
        : "";
  return `
    <li>
      <article class="card" data-category="${esc(cat.id)}">
        <div class="card__icon" aria-hidden="true">${esc(t.icono)}</div>
        <h3 class="card__title">${esc(t.titulo ?? cat.id)}</h3>
        <p class="card__text">${esc(t.descripcion)}</p>
        <ul class="card__list">${(t.puntos ?? []).map(renderBullet).join("")}</ul>
        <p class="card__price"><strong>${esc(priceLabel)}</strong>${minPrice === null ? "" : unit}${priceNote ? ` <small>${esc(priceNote)}</small>` : ""}</p>
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
