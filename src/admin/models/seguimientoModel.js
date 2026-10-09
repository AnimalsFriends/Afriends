/**
 * Reglas de alertas, asistencia y SOAT. La falta escolar sigue siendo
 * ausencias_colegio; aquí solo la combinamos con la asistencia marcada hoy.
 */
import { esFechaISO, esUuid } from "./gestionModel.js";
import { servicioMascotaEnFecha } from "./rutasModel.js";

export const DIAS_ALERTA_VENCIMIENTO = 30;
export const TAMANO_PAGINA_HISTORIAL = 50;

const linea = (valor) => String(valor ?? "").replace(/\s+/g, " ").trim();

const sumarDias = (fecha, dias) => {
  const resultado = new Date(`${fecha}T00:00:00.000Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
};

const estadoVencimiento = (fecha, hoy, dias) => {
  if (fecha < hoy) return "vencido";
  if (fecha <= sumarDias(hoy, dias)) return "por_vencer";
  return null;
};

/** Reúne solo registros vencidos o que vencen dentro de los próximos 30 días. */
export function generarAlertas({ vacunas = [], mascotas = [], soat = [], hoy, dias = DIAS_ALERTA_VENCIMIENTO }) {
  if (!esFechaISO(String(hoy ?? "")) || !Number.isInteger(dias) || dias < 0 || dias > 365) {
    throw new TypeError("La fecha o la ventana de vencimiento no es válida.");
  }
  const nombreMascota = new Map(mascotas.map((mascota) => [mascota.id, mascota.nombre]));
  const alertas = [];
  for (const vacuna of vacunas) {
    const estado = estadoVencimiento(vacuna.fecha_vencimiento, hoy, dias);
    if (!estado) continue;
    alertas.push({
      id: vacuna.id, tipo: vacuna.tipo, nombre: vacuna.nombre,
      mascota: nombreMascota.get(vacuna.mascota_id) ?? "Perro no disponible",
      vencimiento: vacuna.fecha_vencimiento, estado
    });
  }
  for (const vehiculo of soat) {
    if (vehiculo.activo === false) continue;
    const estado = estadoVencimiento(vehiculo.fecha_vencimiento, hoy, dias);
    if (!estado) continue;
    alertas.push({
      id: vehiculo.id, tipo: "soat", nombre: vehiculo.vehiculo,
      mascota: "", vencimiento: vehiculo.fecha_vencimiento, estado
    });
  }
  return alertas.sort((a, b) =>
    a.vencimiento.localeCompare(b.vencimiento)
    || a.tipo.localeCompare(b.tipo)
    || a.nombre.localeCompare(b.nombre, "es")
  );
}

/** Conserva el nombre y la fecha del vehículo actual; la auditoría registra cada renovación. */
export function validarSoat(form, existentes = []) {
  const vehiculo = linea(form.vehiculo);
  const fechaVencimiento = String(form.fecha_vencimiento ?? "");
  const notas = String(form.notas ?? "").trim();
  const id = String(form.id ?? "");
  const errors = [];
  if (id && (!esUuid(id) || !existentes.some((fila) => fila.id === id))) {
    errors.push("El registro de SOAT que quieres editar ya no está disponible.");
  }
  if (vehiculo.length < 2 || vehiculo.length > 80) errors.push("Escribe el nombre o la placa del vehículo (2 a 80 caracteres).");
  if (existentes.some((fila) =>
    fila.id !== id && linea(fila.vehiculo).toLocaleLowerCase("es-CO") === vehiculo.toLocaleLowerCase("es-CO")
  )) errors.push("Ya hay un SOAT registrado para ese vehículo.");
  if (!esFechaISO(fechaVencimiento)) errors.push("Indica una fecha de vencimiento válida.");
  if (notas.length > 500) errors.push("Las notas no pueden superar 500 caracteres.");
  return {
    errors,
    clean: { vehiculo, fecha_vencimiento: fechaVencimiento, notas: notas || null }
  };
}

/**
 * Arma la lista escolar esperada para la fecha. Se calcula ignorando la falta
 * solo al determinar quién debía ir; luego la falta se muestra como asistencia.
 */
export function listaAsistencia({ fecha, mascotas = [], planes = [], reservas = [], ausencias = [], registros = [] }) {
  if (!esFechaISO(String(fecha ?? ""))) throw new TypeError("La fecha de asistencia no es válida.");
  const porMascota = new Map(registros.map((fila) => [fila.mascota_id, fila]));
  const faltas = new Map(ausencias.map((fila) => [fila.mascota_id, fila]));
  return mascotas.flatMap((mascota) => {
    const servicio = servicioMascotaEnFecha(mascota, fecha, planes, reservas, []);
    if (servicio.codigo !== "colegio" && servicio.codigo !== "hotel_colegio") return [];
    const falta = faltas.get(mascota.id);
    const registro = porMascota.get(mascota.id) ?? null;
    const estado = falta ? "ausente"
      : !registro?.entrada_en ? "pendiente"
        : registro.salida_en ? "salio" : "presente";
    return [{ mascota, servicio: servicio.codigo, estado, falta: falta ?? null, registro }];
  }).sort((a, b) => a.mascota.nombre.localeCompare(b.mascota.nombre, "es"));
}

export function validarRegistroAsistencia(mascotaId, fecha) {
  return esUuid(mascotaId) && esFechaISO(String(fecha ?? ""));
}
