/**
 * Reglas puras para la agenda y la planeación. Las fechas visibles usan la zona
 * de Bogotá; así un día no cambia al abrir la agenda desde un dispositivo en otra zona.
 */
import { esFechaISO, esUuid } from "./gestionModel.js";
import { servicioMascotaEnFecha } from "./rutasModel.js";

export const VISTAS_AGENDA = [["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]];
export const ESTADOS_CITA = [
  ["pendiente", "Pendiente"], ["en_curso", "En curso"], ["listo", "Listo"], ["cancelado", "Cancelado"]
];

export const fechaMas = (fecha, dias) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};

const primerDiaSemana = (fecha) => {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return fechaMas(fecha, -((dia + 6) % 7));
};

export function rangoAgenda(fecha, vista) {
  if (!esFechaISO(fecha)) return null;
  if (vista === "dia") return { inicio: fecha, fin: fechaMas(fecha, 1) };
  if (vista === "semana") {
    const inicio = primerDiaSemana(fecha);
    return { inicio, fin: fechaMas(inicio, 7) };
  }
  if (vista === "mes") {
    const inicio = `${fecha.slice(0, 7)}-01`;
    const [year, month] = fecha.slice(0, 7).split("-").map(Number);
    const fin = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    return { inicio, fin };
  }
  return null;
}

export function diasEntre(inicio, fin) {
  const dias = [];
  for (let dia = inicio; dia < fin; dia = fechaMas(dia, 1)) dias.push(dia);
  return dias;
}

export function inicioDiaBogotaUTC(fecha) {
  return esFechaISO(fecha) ? `${fecha}T05:00:00.000Z` : null;
}

export function fechaHoraBogotaAUTC(valor) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):([0-5]\d)$/.exec(String(valor ?? ""));
  if (!match || !esFechaISO(match[1]) || Number(match[2]) > 23) return null;
  const fecha = new Date(`${valor}:00-05:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

function parteFechaBogota(valor, parte) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(fecha).find((p) => p.type === parte)?.value ?? "";
}

export function fechaBogotaDeISO(valor) {
  const [year, month, day] = ["year", "month", "day"].map((parte) => parteFechaBogota(valor, parte));
  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function fechaHoraBogotaDeISO(valor) {
  const fecha = fechaBogotaDeISO(valor);
  const [hour, minute] = ["hour", "minute"].map((parte) => parteFechaBogota(valor, parte));
  return fecha && hour && minute ? `${fecha}T${hour}:${minute}` : "";
}

export function validarCita(form) {
  const inicio = fechaHoraBogotaAUTC(form.inicio);
  const fin = fechaHoraBogotaAUTC(form.fin);
  const servicio = String(form.servicio_codigo ?? "").trim();
  const notas = String(form.notas ?? "").trim();
  const estado = String(form.estado ?? "pendiente");
  const errors = [];
  if (!esUuid(form.mascota_id)) errors.push("Elige un perro.");
  if (!esUuid(form.empleado_id)) errors.push("Asigna un empleado.");
  if (!/^[a-z0-9_]{2,30}$/.test(servicio)) errors.push("Elige un servicio válido.");
  if (!inicio) errors.push("Indica una fecha y hora de inicio válidas.");
  if (!fin) errors.push("Indica una fecha y hora de fin válidas.");
  if (inicio && fin && fin <= inicio) errors.push("La hora de fin debe ser posterior al inicio.");
  if (!ESTADOS_CITA.some(([value]) => value === estado)) errors.push("El estado de la cita no es válido.");
  if (notas.length > 1000) errors.push("Las notas no pueden superar 1000 caracteres.");
  return {
    errors,
    clean: { mascota_id: form.mascota_id, empleado_id: form.empleado_id, servicio_codigo: servicio, inicio, fin, estado, notas: notas || null }
  };
}

export function conflictosCita(cita, citas) {
  if (cita.estado === "cancelado") return [];
  const inicio = Date.parse(cita.inicio);
  const fin = Date.parse(cita.fin);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) return [];
  return citas.flatMap((otra) => {
    if (otra.id === cita.id || otra.estado === "cancelado") return [];
    const otraInicio = Date.parse(otra.inicio);
    const otraFin = Date.parse(otra.fin);
    if (!Number.isFinite(otraInicio) || !Number.isFinite(otraFin) || inicio >= otraFin || fin <= otraInicio) return [];
    const tipos = [];
    if (cita.empleado_id && cita.empleado_id === otra.empleado_id) tipos.push("empleado");
    if (cita.mascota_id === otra.mascota_id) tipos.push("mascota");
    return tipos.length ? [{ cita: otra, tipos }] : [];
  });
}

export function planificarRutas(fecha, rutas, paradas, mascotas, planes, reservas, ausencias) {
  const activas = rutas.filter((ruta) => ruta.activa);
  const perrosPorRuta = new Map(activas.map((ruta) => [ruta.id, new Set()]));
  const rutasPorPerro = new Map();
  const programados = new Set(mascotas
    .filter((mascota) => ["colegio", "hotel_colegio"].includes(
      servicioMascotaEnFecha(mascota, fecha, planes, reservas, ausencias).codigo
    ))
    .map((mascota) => mascota.id));
  for (const parada of paradas) {
    if (!parada.activa || parada.sentido !== "recogida" || !perrosPorRuta.has(parada.ruta_id)
      || !programados.has(parada.mascota_id)) continue;
    perrosPorRuta.get(parada.ruta_id).add(parada.mascota_id);
    if (!rutasPorPerro.has(parada.mascota_id)) rutasPorPerro.set(parada.mascota_id, new Set());
    rutasPorPerro.get(parada.mascota_id).add(parada.ruta_id);
  }

  const detalle = activas.map((ruta) => {
    const perros = perrosPorRuta.get(ruta.id).size;
    const capacidad = Number.isInteger(ruta.capacidad_perros) && ruta.capacidad_perros > 0
      ? ruta.capacidad_perros
      : null;
    const necesarios = perros === 0 ? 0 : capacidad ? Math.ceil(perros / capacidad) : null;
    const asignados = perros > 0 && ruta.empleado_id ? 1 : 0;
    return {
      ruta,
      perros,
      capacidad,
      necesarios,
      asignados,
      faltantes: necesarios === null ? null : Math.max(0, necesarios - asignados)
    };
  });
  const perrosSinRuta = [...programados].filter((id) => !rutasPorPerro.has(id));
  const sinCapacidad = perrosSinRuta.length > 0 || detalle.some((r) => r.perros > 0 && r.capacidad === null);
  return {
    totalPerros: programados.size,
    totalEmpleados: sinCapacidad ? null : detalle.reduce((total, r) => total + r.necesarios, 0),
    empleadosAsignados: detalle.reduce((total, r) => total + r.asignados, 0),
    empleadosFaltantes: sinCapacidad ? null : detalle.reduce((total, r) => total + r.faltantes, 0),
    perrosSinRuta,
    perrosEnVariasRutas: [...rutasPorPerro.entries()].filter(([, routeIds]) => routeIds.size > 1).map(([id]) => id),
    rutas: detalle
  };
}
