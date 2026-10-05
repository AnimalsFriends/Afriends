/**
 * Formatos de presentación (moneda colombiana por defecto).
 */
export const formatMoney = (amount, currency = "COP") =>
  `$${Number(amount || 0).toLocaleString("es-CO")} ${currency}`;
