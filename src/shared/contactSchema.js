/**
 * ESQUEMA DEL FORMULARIO DE CONTACTO - módulo puro (sin DOM, sin red).
 * Lo comparten el navegador (validación inmediata) y la Cloudflare Function
 * (validación REAL de seguridad). Nunca confíes solo en la validación del navegador.
 */

/** Fecha de la Política de privacidad vigente: queda registrada junto con cada autorización. */
export const POLICY_VERSION = "2026-10-03";

export const LIMITS = Object.freeze({
  nombre: { min: 2, max: 80 },
  telefono: { min: 7, max: 15 },       // dígitos
  correo: { max: 120 },
  mascota: { max: 60 },
  mensaje: { max: 600 },
  maxEnlaces: 2
});

// Caracteres de control (se permiten tabulación, salto de línea y retorno)
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SERVICE_ID = /^[a-z0-9-]{1,40}$/;

const oneLine = (v) => String(v ?? "").replace(CONTROL, "").replace(/\s+/g, " ").trim();
const multiLine = (v) =>
  String(v ?? "").replace(CONTROL, "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/**
 * @param {object} input  { nombre, telefono, correo, mascota, servicio, mensaje, aceptaDatos }
 * @returns {{ok: boolean, errors: Record<string,string>, clean: object}}
 *   Códigos de error: requerido | corto | largo | invalido | enlaces
 */
export function validateContact(input = {}) {
  const errors = {};

  const nombre = oneLine(input.nombre);
  if (!nombre) errors.nombre = "requerido";
  else if (nombre.length < LIMITS.nombre.min) errors.nombre = "corto";
  else if (nombre.length > LIMITS.nombre.max) errors.nombre = "largo";

  const telefono = String(input.telefono ?? "").replace(/\D/g, "");
  if (!telefono) errors.telefono = "requerido";
  else if (telefono.length < LIMITS.telefono.min || telefono.length > LIMITS.telefono.max) errors.telefono = "invalido";

  const correo = oneLine(input.correo).toLowerCase();
  if (correo) {
    if (correo.length > LIMITS.correo.max) errors.correo = "largo";
    else if (!EMAIL.test(correo)) errors.correo = "invalido";
  }

  const mascota = oneLine(input.mascota);
  if (mascota.length > LIMITS.mascota.max) errors.mascota = "largo";

  const servicio = oneLine(input.servicio).toLowerCase();
  if (servicio && !SERVICE_ID.test(servicio)) errors.servicio = "invalido";

  const mensaje = multiLine(input.mensaje);
  if (mensaje.length > LIMITS.mensaje.max) errors.mensaje = "largo";
  else if ((mensaje.match(/https?:\/\/|www\./gi) ?? []).length > LIMITS.maxEnlaces) errors.mensaje = "enlaces";

  if (input.aceptaDatos !== true) errors.aceptaDatos = "requerido";

  return { ok: Object.keys(errors).length === 0, errors, clean: { nombre, telefono, correo, mascota, servicio, mensaje } };
}
