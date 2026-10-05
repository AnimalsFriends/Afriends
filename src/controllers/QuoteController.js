/**
 * CONTROLADOR: cotizador. Conecta QuoteModel (lógica) con QuoteView (HTML).
 * El resumen se actualiza sin volver a pintar los paneles (así no se pierde el foco ni lo marcado).
 * El botón de WhatsApp es un enlace real (no window.open): no lo bloquean los navegadores.
 */
import { QuoteModel } from "../models/QuoteModel.js";
import { QuoteView } from "../views/QuoteView.js";
import { formatMoney } from "../utils/format.js";
import { mount } from "../utils/dom.js";

export class QuoteController {
  constructor({ root, state }) {
    this.root = root;
    this.state = state;
    this.model = new QuoteModel(state);
  }

  init() {
    if (!this.state.categorias.length) {
      mount(this.root, '<p class="state-msg">Pronto publicaremos nuestro cotizador. ¡Escríbenos y te cotizamos por WhatsApp!</p>');
      this.finish();
      return;
    }
    mount(this.root, QuoteView.render(this.state));
    this.finish();

    this.list = this.root.querySelector("#qs-list");
    this.total = this.root.querySelector("#qs-total");
    this.status = this.root.querySelector("#qs-status");
    this.wa = this.root.querySelector("#qs-wa");
    this.tabs = [...this.root.querySelectorAll("[data-quote-tab]")];

    this.root.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-quote-tab]");
      if (tab) this.select(tab.dataset.quoteTab);
    });
    this.root.addEventListener("keydown", (event) => this.onTabKeys(event));

    this.root.addEventListener("change", (event) => {
      const t = event.target;
      if (t.matches("[data-quote-service]")) this.model.setService(t.dataset.cat, t.dataset.svc, t.checked);
      else if (t.matches("[data-quote-day]")) { this.model.setDay(t.dataset.cat, t.value, t.checked); this.syncServiceBoxes(t.dataset.cat); }
      else return;
      this.update();
    });

    this.root.addEventListener("input", (event) => {
      const t = event.target;
      if (t.matches("[data-quote-nights]")) {
        if (t.value === "") return;                              // mientras escribe, no se corrige
        this.model.setNights(t.dataset.cat, t.value);
        this.syncServiceBoxes(t.dataset.cat);
        this.update();
      } else if (t.matches("[data-quote-name]")) {
        this.model.setNames({ [t.dataset.quoteName]: t.value });
        this.update();
      }
    });

    this.root.addEventListener("focusout", (event) => {          // al salir del campo de noches, se ajusta al rango válido
      const t = event.target;
      if (t.matches("[data-quote-nights]")) { t.value = this.model.setNights(t.dataset.cat, t.value); this.syncServiceBoxes(t.dataset.cat); this.update(); }
    });

    this.wa.addEventListener("click", (event) => {
      if (!this.model.isEmpty) return;
      event.preventDefault();
      this.status.textContent = "Elige al menos un servicio para continuar por WhatsApp.";
      this.root.querySelector('[role="tabpanel"]:not([hidden]) input')?.focus();
    });

    this.update();
  }

  finish() {
    this.root.classList.remove("is-loading");
    this.root.setAttribute("aria-busy", "false");
  }

  /** Cambia de categoría (la usan las pestañas y los enlaces de las tarjetas). */
  select(catId) {
    for (const tab of this.tabs ?? []) {
      const active = tab.dataset.quoteTab === catId;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      this.root.querySelector(`#qp-${CSS.escape(tab.dataset.quoteTab)}`).hidden = !active;
    }
  }

  /** Teclado accesible: flechas, Inicio y Fin cambian de pestaña. */
  onTabKeys(event) {
    const current = event.target.closest("[data-quote-tab]");
    if (!current) return;
    const index = this.tabs.indexOf(current);
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: this.tabs.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = this.tabs[(moves[event.key] + this.tabs.length) % this.tabs.length];
    this.select(next.dataset.quoteTab);
    next.focus();
  }

  /** Si el modelo activó un servicio automáticamente (al marcar días o noches), se refleja en su casilla. */
  syncServiceBoxes(catId) {
    this.root.querySelectorAll(`[data-quote-service][data-cat="${CSS.escape(catId)}"]`).forEach((box) => {
      box.checked = this.model.isSelected(catId, box.dataset.svc);
    });
  }

  update() {
    const { items, total, currency, isEmpty } = this.model;
    this.list.innerHTML = QuoteView.summaryItems(items, currency);
    this.total.textContent = formatMoney(total, currency);
    this.wa.href = this.model.url() || "#cotizador";
    this.wa.setAttribute("aria-disabled", String(isEmpty || !this.model.url()));
    if (!isEmpty) this.status.textContent = "";
  }
}
