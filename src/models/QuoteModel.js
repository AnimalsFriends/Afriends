/**
 * MODELO: cotizador. Lógica pura (sin DOM): selección, cantidades, total y mensaje de WhatsApp.
 *
 * Tipos de categoría:
 *   "normal"    precio fijo por servicio
 *   "porDias"   precio x cantidad de días marcados (si no marca ninguno: 1 día base)
 *   "porNoches" precio x número de noches
 * Cada servicio distingue precio fijo, gratis, por cotizar o sin precio definido.
 */
import { formatMoney } from "../utils/format.js";
import { whatsappUrl } from "../utils/whatsapp.js";
import { normalizePrice, PRICE_TYPE } from "../shared/pricing.js";

const DEFAULT_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MAX_NAME = 60;

/** Quita caracteres que WhatsApp interpretaría como formato (*negrita*, _cursiva_...) y saltos de línea. */
export const cleanName = (value) => String(value ?? "").replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);

export class QuoteModel {
  constructor({ categorias, negocio }) {
    this.categorias = categorias;
    this.negocio = negocio;
    this.byId = new Map(categorias.map((c) => [c.id, c]));
    this.selected = new Set();      // "categoria::servicio"
    this.days = new Map();          // categoria -> Set(días)
    this.nights = new Map();        // categoria -> número de noches
    this.cliente = "";
    this.mascota = "";
  }

  static key(catId, svcId) { return `${catId}::${svcId}`; }

  isSelected(catId, svcId) { return this.selected.has(QuoteModel.key(catId, svcId)); }

  setService(catId, svcId, checked) {
    const key = QuoteModel.key(catId, svcId);
    checked ? this.selected.add(key) : this.selected.delete(key);
  }

  /** Marcar un día activa el primer servicio de la categoría si no había ninguno. */
  setDay(catId, day, checked) {
    const set = this.days.get(catId) ?? new Set();
    checked ? set.add(day) : set.delete(day);
    this.days.set(catId, set);
    if (checked) this.ensureService(catId);
  }

  /** @returns {number} noches ya ajustadas al rango válido */
  setNights(catId, value) {
    const max = this.maxNights(catId);
    let n = Math.trunc(Number(value));
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > max) n = max;
    this.nights.set(catId, n);
    this.ensureService(catId);
    return n;
  }

  maxNights(catId) { return Number(this.byId.get(catId)?.maxNoches) || 30; }
  getNights(catId) { return this.nights.get(catId) ?? 1; }

  ensureService(catId) {
    const cat = this.byId.get(catId);
    if (!cat?.servicios.length) return;
    if (!cat.servicios.some((s) => this.isSelected(catId, s.id))) this.setService(catId, cat.servicios[0].id, true);
  }

  selectedDays(cat) {
    const chosen = this.days.get(cat.id) ?? new Set();
    return (cat.dias?.length ? cat.dias : DEFAULT_DAYS).filter((d) => chosen.has(d));
  }

  setNames({ cliente, mascota }) {
    if (cliente !== undefined) this.cliente = cleanName(cliente);
    if (mascota !== undefined) this.mascota = cleanName(mascota);
  }

  /** Servicios elegidos, en el orden del catálogo, con su precio ya multiplicado. */
  get items() {
    const items = [];
    for (const cat of this.categorias) {
      for (const svc of cat.servicios) {
        if (!this.isSelected(cat.id, svc.id)) continue;
        let qty = 1;
        let detail = "";
        if (cat.tipo === "porNoches") {
          qty = this.getNights(cat.id);
          detail = ` (${qty} noche${qty > 1 ? "s" : ""})`;
        } else if (cat.tipo === "porDias") {
          const days = this.selectedDays(cat);
          if (days.length) { qty = days.length; detail = ` (${days.join(", ")})`; } else { detail = " (1 día base)"; }
        }
        const pricing = normalizePrice(svc);
        items.push({
          key: QuoteModel.key(cat.id, svc.id),
          catId: cat.id,
          name: `${svc.nombreMensaje || svc.nombre}${detail}`,
          qty,
          tipoPrecio: pricing.tipoPrecio,
          price: pricing.precio === null ? null : pricing.precio * qty
        });
      }
    }
    return items;
  }

  get total() { return this.items.reduce((sum, item) => sum + (item.price ?? 0), 0); }
  get hasPricedItems() { return this.items.some((item) => item.price !== null); }
  get hasPartialTotal() { return this.items.some((item) => item.price === null); }
  get isEmpty() { return this.selected.size === 0; }

  get currency() { return this.negocio.moneda || "COP"; }

  message() {
    const { saludo = "¡Hola!", cierre = "¿Me confirman disponibilidad por favor?" } = this.negocio.mensajeWhatsApp ?? {};
    const who = this.cliente ? `Mi nombre es *${this.cliente}* y quiero` : "Quiero";
    const pet = this.mascota ? ` para mi peludito *${this.mascota}*` : "";
    const lines = this.items.map((i) => {
      const price = i.tipoPrecio === PRICE_TYPE.FREE ? "Gratis"
        : i.tipoPrecio === PRICE_TYPE.QUOTE ? "Por cotizar"
          : i.price === null ? "Precio por confirmar"
            : formatMoney(i.price, this.currency);
      return `- ${i.name} (${price})`;
    }).join("\n");
    const unpricedItems = this.items.filter((item) => item.price === null);
    const total = this.hasPricedItems ? formatMoney(this.total, this.currency)
      : unpricedItems.length && unpricedItems.every((item) => item.tipoPrecio === PRICE_TYPE.QUOTE) ? "Por cotizar"
        : this.hasPartialTotal ? "Precio por confirmar"
          : formatMoney(this.total, this.currency);
    const totalLabel = this.hasPartialTotal ? "Total estimado parcial" : "Total estimado";
    const note = this.hasPartialTotal ? "\nEl total parcial no incluye los servicios sin precio definido o por cotizar." : "";
    return `${saludo}\n${who} agendar servicios${pet}.\n\n*Servicios y detalles seleccionados:*\n${lines}\n\n*${totalLabel}:* ${total}.${note}\n\n${cierre}`;
  }

  /** Enlace a WhatsApp con el pedido ("" si no hay número). Sin servicios: enlace al chat sin texto. */
  url() {
    return whatsappUrl(this.negocio.whatsapp, this.isEmpty ? "" : this.message());
  }
}
