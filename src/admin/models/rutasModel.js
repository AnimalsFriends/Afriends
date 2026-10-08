/**
 * Reglas puras para rutas, planes de colegio y ocupación del hotel.
 * El día se interpreta en Colombia y las noches del hotel usan [entrada, salida):
 * la fecha de salida no ocupa cupo ni cuenta como noche.
 */
import { esFechaISO, esUuid } from "./gestionModel.js";

export const SENTIDOS = [["recogida", "Recogida · casa al colegio"], ["entrega", "Entrega · colegio a casa"]];
export const ESTADOS_PARADA = ["pendiente", "recogido", "entregado", "no_se_pudo"];
export const ESTADOS_RESERVA = ["reservada", "en_curso", "finalizada", "cancelada"];
export const DIAS_COLEGIO = [
  [1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"],
  [5, "Viernes"], [6, "Sábado"], [7, "Domingo"]
];

const texto = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const nulo = (v) => v === "" ? null : v;

export const hoyBogota = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(ahora);

export function diaSemanaISO(fecha) {
  if (!esFechaISO(fecha)) return null;
  return new Date(`${fecha}T00:00:00Z`).getUTCDay() || 7;
}

export function fechaValida(fecha) {
  return esFechaISO(String(fecha ?? ""));
}

export function validarRuta(form) {
  const nombre = texto(form.nombre);
  const empleadoId = String(form.empleado_id ?? "");
  const capacidad = String(form.capacidad_perros ?? "").trim();
  const errors = [];
  if (nombre.length < 2 || nombre.length > 80) errors.push("El nombre de la ruta debe tener entre 2 y 80 caracteres.");
  if (empleadoId && !esUuid(empleadoId)) errors.push("El empleado elegido no es válido.");
  const capacidadPerros = capacidad === "" ? null : Number(capacidad);
  if (capacidadPerros !== null && (!Number.isInteger(capacidadPerros) || capacidadPerros < 1 || capacidadPerros > 32767)) {
    errors.push("La capacidad por empleado debe ser un número entero mayor que cero.");
  }
  return { errors, clean: { nombre, empleado_id: nulo(empleadoId), capacidad_perros: capacidadPerros } };
}

export function validarParada(form) {
  const localidad = texto(form.localidad);
  const direccion = texto(form.direccion);
  const sentido = String(form.sentido ?? "");
  const hora = String(form.hora_estimada ?? "");
  const errors = [];
  if (!esUuid(form.ruta_id)) errors.push("Elige una ruta válida.");
  if (!esUuid(form.mascota_id)) errors.push("Elige un perro.");
  if (!SENTIDOS.some(([value]) => value === sentido)) errors.push("Elige recogida o entrega.");
  if (localidad.length < 2 || localidad.length > 80) errors.push("Escribe una localidad (entre 2 y 80 caracteres).");
  if (direccion.length < 3 || direccion.length > 200) errors.push("Escribe una dirección (entre 3 y 200 caracteres).");
  if (hora && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) errors.push("La hora estimada no es válida.");
  return {
    errors,
    clean: { ruta_id: form.ruta_id, mascota_id: form.mascota_id, sentido, localidad, direccion, hora_estimada: nulo(hora) }
  };
}

export function validarPlan(form) {
  const dias = [...new Set((Array.isArray(form.dias_semana) ? form.dias_semana : []).map(Number))].sort((a, b) => a - b);
  const desde = String(form.desde ?? "");
  const hasta = String(form.hasta ?? "");
  const errors = [];
  if (!esUuid(form.mascota_id)) errors.push("Elige un perro para el plan.");
  if (!dias.length || dias.some((dia) => !Number.isInteger(dia) || dia < 1 || dia > 7)) errors.push("Elige al menos un día válido.");
  if (!fechaValida(desde)) errors.push("La fecha de inicio del plan no es válida.");
  if (hasta && !fechaValida(hasta)) errors.push("La fecha de fin del plan no es válida.");
  if (desde && hasta && fechaValida(desde) && fechaValida(hasta) && hasta < desde) errors.push("La fecha de fin no puede ir antes del inicio.");
  return { errors, clean: { mascota_id: form.mascota_id, dias_semana: dias, desde, hasta: nulo(hasta) } };
}

export function validarReserva(form) {
  const entrada = String(form.entrada ?? "");
  const salida = String(form.salida ?? "");
  const estado = String(form.estado ?? "reservada");
  const errors = [];
  if (!esUuid(form.mascota_id)) errors.push("Elige un perro para la reserva.");
  if (!fechaValida(entrada)) errors.push("La fecha de entrada no es válida.");
  if (!fechaValida(salida)) errors.push("La fecha de salida no es válida.");
  if (fechaValida(entrada) && fechaValida(salida) && salida <= entrada) errors.push("La salida debe ser posterior a la entrada: ese rango incluye las noches.");
  if (!ESTADOS_RESERVA.includes(estado)) errors.push("El estado de la reserva no es válido.");
  for (const key of ["notas_comida", "notas_medicacion", "notas"]) {
    if (String(form[key] ?? "").length > 1000) errors.push("Las notas no pueden superar 1000 caracteres.");
  }
  return {
    errors,
    clean: {
      mascota_id: form.mascota_id, entrada, salida, estado,
      tambien_colegio: Boolean(form.tambien_colegio),
      notas_comida: nulo(texto(form.notas_comida)),
      notas_medicacion: nulo(texto(form.notas_medicacion)),
      notas: nulo(String(form.notas ?? "").trim())
    }
  };
}

export function validarCupos(valor) {
  const cupos = Number(String(valor ?? "").trim());
  return Number.isInteger(cupos) && cupos > 0 && cupos <= 32767
    ? { errors: [], clean: cupos }
    : { errors: ["El cupo debe ser un número entero mayor que cero."], clean: null };
}

export function servicioMascotaEnFecha(mascota, fecha, planes, reservas, ausencias) {
  if (!mascota?.activa) return { codigo: "sin_servicio", ausente: false, reserva: null };
  const id = mascota.id;
  const ausente = ausencias.some((a) => a.mascota_id === id && a.fecha === fecha);
  if (ausente) return { codigo: "ausente", ausente: true, reserva: null };

  const reservasVigentes = reservas.filter((r) =>
    r.mascota_id === id && r.estado !== "cancelada" && r.entrada <= fecha && fecha < r.salida
  );
  if (reservasVigentes.length > 1) return { codigo: "conflicto", ausente: false, reserva: null };

  const dia = diaSemanaISO(fecha);
  const vaAlColegio = planes.some((p) =>
    p.mascota_id === id
    && p.activo
    && p.dias_semana?.includes(dia)
    && p.desde <= fecha
    && (!p.hasta || p.hasta >= fecha)
  );
  const reserva = reservasVigentes[0] ?? null;
  if (reserva) return {
    codigo: reserva.tambien_colegio && vaAlColegio ? "hotel_colegio" : "hotel",
    ausente: false,
    reserva
  };
  return { codigo: vaAlColegio ? "colegio" : "sin_servicio", ausente: false, reserva: null };
}

/** Los cupos cuentan perros, no filas de reserva duplicadas. */
export function resumenHotel(fecha, reservas, cupos) {
  const ocupan = reservas.filter((r) => r.estado !== "cancelada" && r.entrada <= fecha && fecha < r.salida);
  const enHotel = new Set(ocupan.map((r) => r.mascota_id)).size;
  const entradas = new Set(reservas.filter((r) => r.estado !== "cancelada" && r.entrada === fecha).map((r) => r.mascota_id)).size;
  const salidas = new Set(reservas.filter((r) => r.estado !== "cancelada" && r.salida === fecha).map((r) => r.mascota_id)).size;
  return {
    enHotel,
    entradas,
    salidas,
    cupos,
    disponibles: Number.isInteger(cupos) ? Math.max(0, cupos - enHotel) : null,
    excedido: Number.isInteger(cupos) && enHotel > cupos
  };
}

export function contarOcupacionDia(fecha, reservas) {
  return new Set(reservas
    .filter((r) => r.estado !== "cancelada" && r.entrada <= fecha && fecha < r.salida)
    .map((r) => r.mascota_id)).size;
}

export function moverItem(lista, indice, delta) {
  const destino = indice + delta;
  if (indice < 0 || destino < 0 || indice >= lista.length || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}
