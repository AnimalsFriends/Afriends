/**
 * Utilidades de DOM y texto (sin dependencias).
 */

/** Escapa texto para insertarlo de forma segura dentro de HTML. */
export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

/** Convierte texto a un id seguro: "Baño Normal" -> "bano-normal". */
export const slug = (value) =>
  String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Solo permite enlaces http(s). Evita "javascript:" y similares. */
export const safeUrl = (url) => (/^https?:\/\//i.test(String(url ?? "").trim()) ? String(url).trim() : "");

/** Reemplaza el contenido de un elemento con HTML ya escapado. */
export const mount = (element, html) => { element.innerHTML = html; };
