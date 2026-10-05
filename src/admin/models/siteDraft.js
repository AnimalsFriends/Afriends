/**
 * MODELO del panel: borrador de los datos del sitio. Funciones PURAS (sin DOM ni red).
 * Normaliza, valida, limpia para publicar y genera el archivo de respaldo.
 */
import { slug } from "../../utils/dom.js";

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const clone = (o) => JSON.parse(JSON.stringify(o));

export function normalizeDraft(source) {
  const x = clone(source);
  const n = (x.negocio = {
    nombre: "Animal Friends", razonSocial: "", nit: "", whatsapp: "", telefonoVisible: "", correo: "", direccion: "",
    ciudad: "", ubicacionVisible: "", perfilGoogle: "", descripcionFooter: "", moneda: "COP",
    ...(x.negocio || {})
  });
  n.horarios = Array.isArray(n.horarios) ? n.horarios : [];
  n.redes = { instagram: "", facebook: "", tiktok: "", ...(n.redes || {}) };
  n.mensajeWhatsApp = { saludo: "", cierre: "", ...(n.mensajeWhatsApp || {}) };
  n.horarioSEO = n.horarioSEO || { dias: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], abre: "08:00", cierra: "18:00" };

  x.categorias = (x.categorias || []).map((c) => {
    const cat = { activa: true, tipo: "normal", ...c };
    cat.tarjeta = { icono: "🐾", titulo: "", descripcion: "", puntos: [], textoBoton: "Seleccionar", ...(c.tarjeta || {}) };
    cat.tarjeta.puntos = (cat.tarjeta.puntos || []).map((p) => (typeof p === "string" ? { texto: p, destacado: false } : { texto: p.texto || "", destacado: Boolean(p.destacado) }));
    cat.servicios = (c.servicios || []).map((s) => ({ activo: true, nombre: "", precio: 0, ...s }));
    if (cat.tipo === "porDias" && !Array.isArray(cat.dias)) cat.dias = DIAS.slice(0, 6);
    return cat;
  });
  return { negocio: x.negocio, categorias: x.categorias };
}

/** @returns {{errors: string[], warnings: string[]}} los errores bloquean la publicación; los avisos no. */
export function validateDraft(data) {
  const errors = [];
  const warnings = [];
  const n = data.negocio;
  n.whatsapp = String(n.whatsapp || "").replace(/\D/g, "");

  if (n.whatsapp.length < 10) errors.push("El número de WhatsApp debe incluir el código del país (ej. 573123044174).");
  if (n.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n.correo)) errors.push("El correo no parece válido.");
  for (const [key, label] of [["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"]]) {
    if (n.redes[key] && !/^https?:\/\//i.test(n.redes[key])) errors.push(`El enlace de ${label} debe empezar por https://`);
  }
  if (n.perfilGoogle && !/^https?:\/\//i.test(n.perfilGoogle)) errors.push("El enlace del perfil de Google debe empezar por https://");

  const catIds = new Set();
  data.categorias.forEach((c) => {
    const nombre = c.tarjeta.titulo.trim() || "(sin título)";
    if (!c.tarjeta.titulo.trim()) errors.push("Una categoría no tiene título en su tarjeta.");
    if (catIds.has(c.id)) errors.push(`Hay dos categorías con el mismo identificador interno ("${c.id}").`);
    catIds.add(c.id);
    c.servicios.forEach((s) => {
      if (!String(s.nombre).trim()) errors.push(`En "${nombre}" hay un servicio sin nombre.`);
      if (!(Number(s.precio) >= 0)) errors.push(`El precio de "${s.nombre}" no es válido.`);
    });
    if (c.activa && !c.servicios.some((s) => s.activo)) warnings.push(`"${nombre}" está visible pero no tiene servicios activos, así que no se mostrará.`);
  });
  return { errors, warnings };
}

export function uniqueId(base, existing) {
  const root = slug(base) || "item";
  let candidate = root;
  let n = 2;
  while (existing.includes(candidate)) candidate = `${root}-${n++}`;
  return candidate;
}

export function move(list, index, direction) {
  const j = index + direction;
  if (j < 0 || j >= list.length) return;
  [list[index], list[j]] = [list[j], list[index]];
}

export function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

export function blankService(category) {
  return { id: uniqueId("servicio", category.servicios.map((s) => s.id)), activo: true, nombre: "Nuevo servicio", precio: 0 };
}

export function blankCategory(existingIds) {
  return {
    id: uniqueId("categoria", existingIds), activa: true, tipo: "normal",
    tarjeta: { icono: "🐾", titulo: "Nueva categoría", descripcion: "Describe aquí el servicio.", puntos: [{ texto: "Primer beneficio", destacado: false }], textoBoton: "Seleccionar" },
    pestana: "🐾 Nueva categoría", tituloPanel: "Nueva categoría", descripcionPanel: "Selecciona los servicios que necesites.",
    servicios: [{ id: "servicio-1", activo: true, nombre: "Nuevo servicio", precio: 0 }]
  };
}

/** Datos listos para guardar: sin campos vacíos sobrantes, ids únicos, precios numéricos. */
export function cleanPayload(data) {
  const p = clone(data);
  p.negocio.whatsapp = String(p.negocio.whatsapp || "").replace(/\D/g, "");
  p.negocio.horarios = p.negocio.horarios.map((h) => h.trim()).filter(Boolean);
  const catIds = [];
  p.categorias.forEach((c) => {
    c.id = uniqueId(c.id || c.tarjeta.titulo, catIds);
    catIds.push(c.id);
    c.tarjeta.puntos = c.tarjeta.puntos.filter((x) => x.texto.trim());
    const svcIds = [];
    c.servicios.forEach((s) => {
      s.precio = Number(s.precio) || 0;
      if (!s.descripcion) delete s.descripcion;
      if (!s.nombreMensaje) delete s.nombreMensaje;
      s.id = uniqueId(s.id || s.nombre, svcIds);
      svcIds.push(s.id);
    });
    if (c.tipo !== "porDias") { delete c.dias; delete c.preguntaDias; }
    if (c.tipo === "normal") delete c.unidadPrecio;
    if (c.tipo !== "porNoches") { delete c.maxNoches; delete c.textoNoches; delete c.notaNoches; }
  });
  return p;
}

/** Archivo de respaldo: reemplaza src/config/site.defaults.js */
export function buildDefaultsFile(payload, date = new Date()) {
  return `/**\n * VALORES POR DEFECTO DEL SITIO - generado desde el panel de control el ${date.toLocaleString("es-CO")}.\n * Reemplaza el archivo src/config/site.defaults.js con este.\n */\nexport const SITE_DEFAULTS = ${JSON.stringify(payload, null, 2)};\n`;
}

/** Número para abrir WhatsApp desde un mensaje recibido (agrega 57 a celulares colombianos de 10 dígitos). */
export function leadWhatsapp(phoneDigits) {
  const d = String(phoneDigits || "").replace(/\D/g, "");
  return d.length === 10 && d.startsWith("3") ? `57${d}` : d;
}

export function formatPhone(phoneDigits) {
  const d = String(phoneDigits || "").replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d;
}
