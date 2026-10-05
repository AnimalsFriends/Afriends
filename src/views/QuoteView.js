/**
 * VISTA: cotizador. Pestañas accesibles (patrón ARIA tablist), opciones con <label>,
 * fieldsets con leyenda y resumen con regiones "en vivo". Funciones puras; sin estilos ni eventos en línea.
 */
import { esc } from "../utils/dom.js";
import { formatMoney } from "../utils/format.js";

const DEFAULT_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const optionLabel = (cat, svc, currency) => {
  const unit = cat.unidadPrecio ? ` ${esc(cat.unidadPrecio)}` : "";
  return `
    <label class="quote-option">
      <input type="checkbox" data-quote-service data-cat="${esc(cat.id)}" data-svc="${esc(svc.id)}">
      <span class="quote-option__text">
        <span class="quote-option__name">${esc(svc.nombre)}</span>
        <span class="quote-option__price">${formatMoney(svc.precio, currency)}${unit}</span>
        ${svc.descripcion ? `<span class="quote-option__desc">${esc(svc.descripcion)}</span>` : ""}
      </span>
    </label>`;
};

const panelBody = (cat, currency) => {
  const options = cat.servicios.map((s) => optionLabel(cat, s, currency)).join("");

  if (cat.tipo === "porDias") {
    const dias = cat.dias?.length ? cat.dias : DEFAULT_DAYS;
    return `
      <div class="quote-options">${options}</div>
      <fieldset class="quote-fieldset">
        <legend>${esc(cat.preguntaDias || "¿Qué días lo necesitas?")}</legend>
        <div class="quote-days">
          ${dias.map((d) => `<label class="quote-chip"><input type="checkbox" data-quote-day data-cat="${esc(cat.id)}" value="${esc(d)}"> ${esc(d)}</label>`).join("")}
        </div>
      </fieldset>`;
  }

  if (cat.tipo === "porNoches") {
    const max = Number(cat.maxNoches) || 30;
    return `
      <div class="quote-options">${options}</div>
      <div class="quote-fieldset">
        <label for="qn-${esc(cat.id)}" class="quote-fieldset__label">${esc(cat.textoNoches || "Número de noches:")}</label>
        <div class="quote-nights">
          <input id="qn-${esc(cat.id)}" class="quote-nights__input" type="number" inputmode="numeric" min="1" max="${max}" value="1" data-quote-nights data-cat="${esc(cat.id)}">
          <span>noches de hospedaje (máximo ${max})</span>
        </div>
        ${cat.notaNoches ? `<p class="field__hint">${esc(cat.notaNoches)}</p>` : ""}
      </div>`;
  }

  // normal: si hay un número impar de opciones, la última ocupa todo el ancho (clase en CSS)
  return `<div class="quote-options quote-options--grid">${options}</div>`;
};

export const QuoteView = {
  render({ categorias, negocio }) {
    const currency = negocio.moneda || "COP";
    const tabs = categorias.map((c, i) => `
      <button type="button" role="tab" class="quote-tab" id="qt-${esc(c.id)}" data-quote-tab="${esc(c.id)}"
        aria-controls="qp-${esc(c.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
        ${esc(c.pestana || c.tarjeta?.titulo || c.id)}
      </button>`).join("");

    const panels = categorias.map((c, i) => `
      <div role="tabpanel" class="quote-panel" id="qp-${esc(c.id)}" aria-labelledby="qt-${esc(c.id)}"${i === 0 ? "" : " hidden"}>
        <h3 class="quote-panel__title">${esc(c.tituloPanel || c.tarjeta?.titulo || c.id)}</h3>
        ${c.descripcionPanel ? `<p class="quote-panel__text">${esc(c.descripcionPanel)}</p>` : ""}
        ${panelBody(c, currency)}
      </div>`).join("");

    return `
    <div class="quote">
      <div class="quote__main">
        <div class="quote-tabs" role="tablist" aria-label="Categorías de servicios">${tabs}</div>
        ${panels}
      </div>

      <aside class="quote-summary" aria-labelledby="qs-title">
        <h3 id="qs-title" class="quote-summary__title">Tu pedido</h3>
        <div class="quote-names">
          <div class="field"><label for="qs-cliente">Tu nombre (opcional)</label>
            <input id="qs-cliente" type="text" maxlength="60" autocomplete="name" data-quote-name="cliente"></div>
          <div class="field"><label for="qs-mascota">Nombre de tu peludito (opcional)</label>
            <input id="qs-mascota" type="text" maxlength="60" data-quote-name="mascota"></div>
        </div>
        <ul id="qs-list" class="quote-list"></ul>
        <p class="quote-total"><span>Total estimado</span> <strong id="qs-total" aria-live="polite"></strong></p>
        <p class="quote-note">Precios de referencia en ${esc(currency)}. Te confirmamos disponibilidad y valor final por WhatsApp.</p>
        <p id="qs-status" class="form__status" role="status" aria-live="polite"></p>
        <a id="qs-wa" class="btn btn--primary" href="#cotizador" target="_blank" rel="noopener noreferrer" aria-disabled="true">Reservar por WhatsApp</a>
      </aside>
    </div>`;
  },

  summaryItems(items, currency) {
    if (!items.length) return '<li class="quote-list__empty">Aún no has elegido servicios.</li>';
    return items.map((i) => `<li><span>${esc(i.name)}</span><strong>${formatMoney(i.price, currency)}</strong></li>`).join("");
  }
};
