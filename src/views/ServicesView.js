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

const IMAGE_TONES = { banos: "bath", colegio: "school", hotel: "hotel", peluqueria: "groom" };
const SERVICE_IMAGES = {
  banos: { src: "assets/img/services/banos.jpg", alt: "Imagen ilustrativa de un perro durante su baño" },
  colegio: { src: "assets/img/services/colegio.jpg", alt: "Imagen ilustrativa de perros jugando en el colegio canino" },
  hotel: { src: "assets/img/services/hotel.jpg", alt: "Imagen ilustrativa de un perro descansando en el hotel" },
  peluqueria: { src: "assets/img/services/peluqueria.jpg", alt: "Imagen ilustrativa de un perro durante su peluquería" }
};

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
  const image = SERVICE_IMAGES[cat.id];
  const media = image
    ? `<img class="service-card__image" src="${image.src}" alt="${image.alt}" width="1280" height="714" loading="lazy" decoding="async">`
    : `<div class="service-card__image service-card__image--${esc(IMAGE_TONES[cat.id] || "bath")}" role="img" aria-label="Imagen ilustrativa pendiente para ${esc(t.titulo ?? cat.id)}"><span>Imagen ilustrativa pendiente</span></div>`;
  return `
    <li>
      <article class="card" data-category="${esc(cat.id)}">
        ${media}
        <h3 class="card__title">${esc(t.titulo ?? cat.id)}</h3>
        <p class="card__text">${esc(t.descripcion)}</p>
        <ul class="card__list">${(t.puntos ?? []).map(renderBullet).join("")}</ul>
        ${minPrice !== null || hasUnknownPrice ? `<p class="card__price"><strong>${esc(priceLabel)}</strong>${minPrice === null ? "" : unit}${priceNote ? ` <small>${esc(priceNote)}</small>` : ""}</p>` : ""}
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
