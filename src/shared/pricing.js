export const PRICE_TYPE = Object.freeze({
  FIXED: "fijo",
  FREE: "gratis",
  QUOTE: "cotizar",
  UNKNOWN: "sin_definir"
});

const validTypes = new Set(Object.values(PRICE_TYPE));

function positiveAmount(value) {
  if (!(typeof value === "number" || typeof value === "string" && value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function getPricingType(service = {}) {
  if (service?.tipoPrecio != null) {
    return validTypes.has(service.tipoPrecio) ? service.tipoPrecio : PRICE_TYPE.UNKNOWN;
  }
  return positiveAmount(service?.precio) === null ? PRICE_TYPE.UNKNOWN : PRICE_TYPE.FIXED;
}

export function normalizePrice(service = {}) {
  const tipoPrecio = getPricingType(service);
  if (tipoPrecio === PRICE_TYPE.FREE) return { tipoPrecio, precio: 0 };
  if (tipoPrecio === PRICE_TYPE.FIXED) {
    const precio = positiveAmount(service?.precio);
    return precio === null
      ? { tipoPrecio: PRICE_TYPE.UNKNOWN, precio: null }
      : { tipoPrecio, precio };
  }
  return { tipoPrecio, precio: null };
}
