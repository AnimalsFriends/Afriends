/**
 * MODELO de la gestión de dueños y mascotas (Fase 2).
 *
 * Todo aquí es lógica pura, sin pantalla ni red, para poder probarla con `node --test`.
 * Su trabajo: tomar lo que escribe la persona en un formulario (todo son textos),
 * validarlo con mensajes en lenguaje normal y devolver el "paquete limpio" que se
 * manda a Supabase (textos vacíos -> null, teléfonos solo con dígitos, etc.).
 *
 * Los límites (largos, rangos) copian los CHECK de las migraciones de la Fase 1
 * (supabase/migrations/20261007100100_fase1_duenos_y_mascotas.sql). Si cambias uno
 * allá, cámbialo aquí también; la base de datos es la que manda de verdad.
 */
import { leadWhatsapp } from "./siteDraft.js";

export const GENEROS = [["", "Sin indicar"], ["macho", "Macho"], ["hembra", "Hembra"]];
export const TIPOS_VACUNA = [["vacuna", "Vacuna"], ["desparasitacion", "Desparasitación"]];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------ limpieza de textos ------------------------------ */
/** Texto de una línea: sin saltos ni espacios repetidos. */
const linea = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
/** Texto largo: conserva los saltos de línea. */
const largo = (v) => String(v ?? "").replace(/\r\n?/g, "\n").trim();
const nulo = (v) => (v === "" ? null : v);

/**
 * Deja solo dígitos. Un celular colombiano de 10 dígitos que empieza por 3 recibe el
 * 57 delante (así sirve para WhatsApp). Es la misma regla que ya usa el panel para
 * los mensajes del formulario.
 */
export const normalizarTelefono = (v) => leadWhatsapp(v);
const telefonoValido = (d) => /^[0-9]{7,15}$/.test(d);

/** Fecha ISO real (aaaa-mm-dd). Rechaza cosas como 2026-02-31. */
export const esFechaISO = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/* ------------------------------ formularios en blanco ------------------------------ */
export const blankDueno = () => ({
  nombre: "", telefono: "", correo: "", direccion: "", notas: "",
  contacto_emergencia_nombre: "", contacto_emergencia_telefono: "", contacto_emergencia_parentesco: ""
});

export const blankMascota = () => ({
  nombre: "", raza: "", genero: "", tamano: "", tipo_comida: "", comidas_por_dia: "",
  es_bravo: false, nota_comportamiento: "", esta_enfermo: false, detalle_enfermedad: "", toma_medicamentos: false
});

export const blankVacuna = () => ({ tipo: "vacuna", nombre: "", fecha_aplicacion: "", fecha_vencimiento: "" });
export const blankMedicamento = () => ({ medicamento: "", dosis: "", horario: "", fecha_inicio: "", fecha_fin: "" });
export const blankAutorizada = () => ({ nombre: "", telefono: "", parentesco: "", mascota_id: "" });

/** Convierte una fila de la base de datos en el formulario (nulls -> textos vacíos). */
export function formDesdeFila(fila, blank) {
  const form = blank();
  for (const key of Object.keys(form)) {
    const v = fila?.[key];
    form[key] = typeof form[key] === "boolean" ? Boolean(v) : v == null ? "" : String(v);
  }
  return form;
}

/* ------------------------------ validaciones ------------------------------ */
/** Cada validador devuelve { errors: [...mensajes], clean: paquete para Supabase }. */

export function validarDueno(form) {
  const errors = [];
  const nombre = linea(form.nombre);
  const telefono = normalizarTelefono(form.telefono);
  const correo = linea(form.correo);
  const direccion = linea(form.direccion);
  const emNombre = linea(form.contacto_emergencia_nombre);
  const emTel = normalizarTelefono(form.contacto_emergencia_telefono);
  const emParentesco = linea(form.contacto_emergencia_parentesco);

  if (nombre.length < 2 || nombre.length > 100) errors.push("Escribe el nombre del dueño (entre 2 y 100 letras).");
  if (!telefonoValido(telefono)) errors.push("El teléfono del dueño debe tener entre 7 y 15 números (es el que usamos para WhatsApp).");
  if (correo && (!EMAIL.test(correo) || correo.length > 120)) errors.push("El correo no parece válido.");
  if (direccion.length > 200) errors.push("La dirección es demasiado larga (máximo 200 caracteres).");
  if (emNombre.length > 100) errors.push("El nombre del contacto de emergencia es demasiado largo.");
  if (emTel && !telefonoValido(emTel)) errors.push("El teléfono del contacto de emergencia debe tener entre 7 y 15 números.");
  if (emParentesco.length > 60) errors.push("El parentesco del contacto de emergencia es demasiado largo (máximo 60).");

  return {
    errors,
    clean: {
      nombre, telefono,
      correo: nulo(correo), direccion: nulo(direccion), notas: nulo(largo(form.notas)),
      contacto_emergencia_nombre: nulo(emNombre),
      contacto_emergencia_telefono: nulo(emTel),
      contacto_emergencia_parentesco: nulo(emParentesco)
    }
  };
}

export function validarMascota(form) {
  const errors = [];
  const nombre = linea(form.nombre);
  const raza = linea(form.raza);
  const tamano = linea(form.tamano);
  const comida = linea(form.tipo_comida);
  const genero = String(form.genero ?? "");
  const comidasTxt = String(form.comidas_por_dia ?? "").trim();
  const comidas = comidasTxt === "" ? null : Number(comidasTxt);
  const nota = largo(form.nota_comportamiento);
  const detalle = largo(form.detalle_enfermedad);
  const bravo = Boolean(form.es_bravo);
  const enfermo = Boolean(form.esta_enfermo);

  if (nombre.length < 1 || nombre.length > 60) errors.push("Escribe el nombre del perro (máximo 60 letras).");
  if (raza.length > 60) errors.push("La raza es demasiado larga (máximo 60).");
  if (!GENEROS.some(([v]) => v === genero)) errors.push("El género debe ser macho, hembra o sin indicar.");
  if (tamano.length > 30) errors.push("El tamaño es demasiado largo (máximo 30 caracteres).");
  if (comida.length > 120) errors.push("El tipo de comida es demasiado largo (máximo 120).");
  if (comidas !== null && (!Number.isInteger(comidas) || comidas < 1 || comidas > 10)) errors.push("Las comidas al día deben ser un número entre 1 y 10.");
  if (bravo && !nota) errors.push("Si es bravo, cuéntanos cómo se comporta para que el equipo lo sepa.");
  if (enfermo && !detalle) errors.push("Si está enfermo, escribe de qué para que el equipo lo sepa.");

  return {
    errors,
    clean: {
      nombre,
      raza: nulo(raza),
      genero: nulo(genero),
      tamano: nulo(tamano),
      tipo_comida: nulo(comida),
      comidas_por_dia: comidas,
      es_bravo: bravo,
      // Si apagan el interruptor, la nota vieja se descarta para que no quede información que ya no aplica.
      nota_comportamiento: bravo ? nota : null,
      esta_enfermo: enfermo,
      detalle_enfermedad: enfermo ? detalle : null,
      toma_medicamentos: Boolean(form.toma_medicamentos)
    }
  };
}

export function validarVacuna(form) {
  const errors = [];
  const nombre = linea(form.nombre);
  const tipo = String(form.tipo ?? "");
  const aplicacion = String(form.fecha_aplicacion ?? "");
  const vencimiento = String(form.fecha_vencimiento ?? "");

  if (!TIPOS_VACUNA.some(([v]) => v === tipo)) errors.push("Elige si es vacuna o desparasitación.");
  if (nombre.length < 2 || nombre.length > 100) errors.push("Escribe el nombre de la vacuna o del producto (entre 2 y 100 letras).");
  if (!esFechaISO(vencimiento)) errors.push("Falta la fecha de vencimiento (es la que usaremos para los avisos).");
  if (aplicacion && !esFechaISO(aplicacion)) errors.push("La fecha de aplicación no es válida.");
  if (esFechaISO(aplicacion) && esFechaISO(vencimiento) && vencimiento < aplicacion) errors.push("El vencimiento no puede ser anterior a la fecha de aplicación.");

  return { errors, clean: { tipo, nombre, fecha_aplicacion: nulo(aplicacion), fecha_vencimiento: vencimiento } };
}

export function validarMedicamento(form) {
  const errors = [];
  const medicamento = linea(form.medicamento);
  const dosis = linea(form.dosis);
  const horario = linea(form.horario);
  const inicio = String(form.fecha_inicio ?? "");
  const fin = String(form.fecha_fin ?? "");

  if (medicamento.length < 2 || medicamento.length > 120) errors.push("Escribe el nombre del medicamento (entre 2 y 120 letras).");
  if (dosis.length > 120) errors.push("La dosis es demasiado larga (máximo 120).");
  if (horario.length > 120) errors.push("El horario es demasiado largo (máximo 120).");
  if (inicio && !esFechaISO(inicio)) errors.push("La fecha de inicio no es válida.");
  if (fin && !esFechaISO(fin)) errors.push("La fecha de fin no es válida.");
  if (esFechaISO(inicio) && esFechaISO(fin) && fin < inicio) errors.push("La fecha de fin no puede ser anterior a la de inicio.");

  return { errors, clean: { medicamento, dosis: nulo(dosis), horario: nulo(horario), fecha_inicio: nulo(inicio), fecha_fin: nulo(fin) } };
}

export function validarAutorizada(form) {
  const errors = [];
  const nombre = linea(form.nombre);
  const telefono = normalizarTelefono(form.telefono);
  const parentesco = linea(form.parentesco);
  const mascotaId = String(form.mascota_id ?? "");

  if (nombre.length < 2 || nombre.length > 100) errors.push("Escribe el nombre de la persona autorizada (entre 2 y 100 letras).");
  if (telefono && !telefonoValido(telefono)) errors.push("El teléfono de la persona autorizada debe tener entre 7 y 15 números.");
  if (parentesco.length > 60) errors.push("El parentesco es demasiado largo (máximo 60).");
  if (mascotaId && !UUID.test(mascotaId)) errors.push("El perro elegido no es válido.");

  // mascota_id vacío = la autorización vale para todos los perros del dueño.
  return { errors, clean: { nombre, telefono: nulo(telefono), parentesco: nulo(parentesco), mascota_id: nulo(mascotaId) } };
}

/* ------------------------------ ayudas para mostrar ------------------------------ */
/** "Hoy" en Colombia (aaaa-mm-dd), sin depender de la zona horaria del computador. */
export const hoyBogota = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);

/**
 * Solo distingue "vencida" de "vigente". A propósito NO decide cuántos días antes se
 * avisa un vencimiento próximo: esa regla se define con el negocio en la Fase 7.
 */
export const estadoVencimiento = (fechaISO, hoy = hoyBogota()) => (fechaISO < hoy ? "vencida" : "vigente");

/** Fecha legible ("12 oct 2026") sin el desfase de zona horaria que da new Date("2026-10-12"). */
export function fechaLegible(fechaISO) {
  if (!esFechaISO(fechaISO)) return "";
  const [y, m, d] = fechaISO.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

const plano = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Filtra la lista de dueños. Busca por nombre del dueño, nombre de sus perros o
 * teléfono (ignora tildes y mayúsculas). Los desactivados solo salen si se pide.
 */
export function filtrarDuenos(duenos, texto = "", verInactivos = false) {
  const q = plano(texto).trim();
  const qDigitos = q.replace(/\D/g, "");
  return duenos
    .filter((d) => verInactivos || d.activo)
    .filter((d) => {
      if (!q) return true;
      if (plano(d.nombre).includes(q)) return true;
      if (qDigitos.length >= 3 && String(d.telefono ?? "").includes(qDigitos)) return true;
      return (d.mascotas ?? []).some((m) => plano(m.nombre).includes(q));
    });
}

export const mascotasActivas = (dueno) => (dueno.mascotas ?? []).filter((m) => m.activa);
export const esUuid = (v) => UUID.test(String(v ?? ""));
