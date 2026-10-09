/**
 * Reglas de finanzas del panel. La cartera suma los cobros por dueño (no por perro),
 * y los ingresos del mes siguen la fecha del cobro registrado en pagos.
 */
import { esFechaISO, esUuid } from "./gestionModel.js";

export const CATEGORIAS_GASTO = [
  ["gasolina", "Gasolina"], ["arreglos", "Arreglos"], ["soat", "SOAT"],
  ["comida_mascotas", "Comida de mascotas"], ["aseo", "Aseo"], ["agua", "Agua"],
  ["luz", "Luz"], ["gas", "Gas"], ["sueldos", "Sueldos"], ["otros", "Otros"]
];

const codigoServicioValido = (value) => /^[a-z0-9_]{2,30}$/.test(String(value ?? ""));
const pesos = (value) => {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return NaN;
  const centavos = Math.round(numero * 100);
  return Math.abs(numero * 100 - centavos) < 0.000001 ? centavos : NaN;
};
const aPesos = (centavos) => centavos / 100;

export function validarGasto(form) {
  const fecha = String(form.fecha ?? "");
  const categoria = String(form.categoria ?? "");
  const descripcion = String(form.descripcion ?? "").trim();
  const valorCentavos = pesos(form.valor);
  const errors = [];
  if (!esFechaISO(fecha)) errors.push("Indica una fecha válida para el gasto.");
  if (!CATEGORIAS_GASTO.some(([id]) => id === categoria)) errors.push("Elige una categoría de gasto válida.");
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0 || valorCentavos > 99_999_999_999_999) {
    errors.push("El valor debe ser mayor que cero y caber en el registro.");
  }
  if (descripcion.length > 300) errors.push("La descripción no puede superar 300 caracteres.");
  return {
    errors,
    clean: {
      fecha, categoria, descripcion: descripcion || null,
      valor: Number.isFinite(valorCentavos) ? aPesos(valorCentavos) : null
    }
  };
}

export function validarCobro(form, { duenos, mascotas, servicios }) {
  const concepto = String(form.concepto ?? "").trim();
  const servicio = String(form.servicio_codigo ?? "");
  const fecha = String(form.fecha ?? "");
  const valorCentavos = pesos(form.valor_total);
  const mascotaId = String(form.mascota_id ?? "");
  const errors = [];
  if (!esUuid(form.dueno_id) || !duenos.some((dueno) => dueno.id === form.dueno_id)) errors.push("Elige un dueño registrado.");
  if (mascotaId && (!esUuid(mascotaId) || !mascotas.some((mascota) => mascota.id === mascotaId && mascota.dueno_id === form.dueno_id))) {
    errors.push("El perro no pertenece al dueño elegido.");
  }
  if (servicio && (!codigoServicioValido(servicio) || !servicios.some((item) => item.codigo === servicio))) errors.push("El servicio seleccionado no es válido.");
  if (!esFechaISO(fecha)) errors.push("Indica una fecha válida para el cobro.");
  if (concepto.length < 2 || concepto.length > 200) errors.push("El concepto debe tener entre 2 y 200 caracteres.");
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0 || valorCentavos > 99_999_999_999_999) errors.push("El cobro debe tener un valor mayor que cero.");
  return {
    errors,
    clean: {
      dueno_id: form.dueno_id, mascota_id: mascotaId || null, servicio_codigo: servicio || null,
      fecha, concepto, valor_total: Number.isFinite(valorCentavos) ? aPesos(valorCentavos) : null
    }
  };
}

export function validarAbono(form, saldoDisponible) {
  const fecha = String(form.fecha ?? "");
  const metodo = String(form.metodo ?? "").trim();
  const notas = String(form.notas ?? "").trim();
  const valorCentavos = pesos(form.valor);
  const errors = [];
  if (!esUuid(form.pago_id)) errors.push("Elige un cobro pendiente.");
  if (!esFechaISO(fecha)) errors.push("Indica una fecha válida para el abono.");
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) errors.push("El abono debe ser mayor que cero.");
  if (Number.isFinite(valorCentavos) && Number.isFinite(saldoDisponible) && valorCentavos > pesos(saldoDisponible)) {
    errors.push("El abono no puede superar el saldo pendiente de ese cobro.");
  }
  if (metodo.length > 40) errors.push("El método de pago no puede superar 40 caracteres.");
  if (notas.length > 1000) errors.push("Las notas no pueden superar 1000 caracteres.");
  return {
    errors,
    clean: { pago_id: form.pago_id, fecha, valor: Number.isFinite(valorCentavos) ? aPesos(valorCentavos) : null, metodo: metodo || null, notas: notas || null }
  };
}

export function saldosPagos(pagos, abonos) {
  const abonado = new Map();
  for (const abono of abonos) {
    abonado.set(abono.pago_id, (abonado.get(abono.pago_id) ?? 0) + (pesos(abono.valor) || 0));
  }
  return new Map(pagos.map((pago) => {
    const total = pesos(pago.valor_total) || 0;
    const pagado = abonado.get(pago.id) ?? 0;
    return [pago.id, {
      total: aPesos(total), pagado: aPesos(pagado),
      saldo: aPesos(Math.max(0, total - pagado))
    }];
  }));
}

export function carteraPorDueno(pagos, abonos, duenos) {
  const saldos = saldosPagos(pagos, abonos);
  const acumulado = new Map();
  for (const pago of pagos) {
    const importe = saldos.get(pago.id);
    if (!importe || importe.saldo <= 0) continue;
    const actual = acumulado.get(pago.dueno_id) ?? { saldo: 0, cobros: [] };
    actual.saldo += importe.saldo;
    actual.cobros.push({ pago, ...importe });
    acumulado.set(pago.dueno_id, actual);
  }
  return [...acumulado.entries()]
    .map(([duenoId, datos]) => ({
      dueno: duenos.find((dueno) => dueno.id === duenoId) ?? { id: duenoId, nombre: "Dueño no disponible", telefono: "" },
      saldo: aPesos(pesos(datos.saldo)), cobros: datos.cobros
    }))
    .sort((a, b) => b.saldo - a.saldo || a.dueno.nombre.localeCompare(b.dueno.nombre));
}

export function resumenMensual(mes, gastos, pagos, abonos, servicios) {
  const enMes = (fila) => String(fila.fecha ?? "").startsWith(`${mes}-`);
  const gastosMes = gastos.filter(enMes);
  const pagosMes = pagos.filter(enMes);
  const abonosMes = abonos.filter(enMes);
  const agrupar = (filas, clave, importe) => {
    const totales = new Map();
    for (const fila of filas) totales.set(clave(fila), (totales.get(clave(fila)) ?? 0) + (pesos(importe(fila)) || 0));
    return [...totales.entries()].map(([id, centavos]) => ({ id, valor: aPesos(centavos) }));
  };
  const ingresosPorServicio = agrupar(
    pagosMes, (pago) => pago.servicio_codigo || "sin_servicio", (pago) => pago.valor_total
  ).map((item) => ({
    ...item, nombre: servicios.find((servicio) => servicio.codigo === item.id)?.nombre ?? "Sin servicio"
  })).sort((a, b) => b.valor - a.valor);
  const gastosPorCategoria = agrupar(
    gastosMes, (gasto) => gasto.categoria, (gasto) => gasto.valor
  ).map((item) => ({
    ...item, nombre: CATEGORIAS_GASTO.find(([id]) => id === item.id)?.[1] ?? item.id
  })).sort((a, b) => b.valor - a.valor);
  const totalGastos = aPesos(gastosMes.reduce((sum, gasto) => sum + (pesos(gasto.valor) || 0), 0));
  const totalIngresos = aPesos(pagosMes.reduce((sum, pago) => sum + (pesos(pago.valor_total) || 0), 0));
  const totalRecaudado = aPesos(abonosMes.reduce((sum, abono) => sum + (pesos(abono.valor) || 0), 0));
  return {
    mes, totalGastos, totalIngresos, totalRecaudado,
    utilidad: aPesos(pesos(totalIngresos) - pesos(totalGastos)),
    gastosPorCategoria, ingresosPorServicio
  };
}

const seguroCSV = (valor) => {
  if (typeof valor === "number") return String(valor);
  let texto = String(valor ?? "");
  if (/^\s*[=+\-@]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
};

export function exportarMesCSV(mes, gastos, pagos, abonos, duenos, mascotas, servicios) {
  const duenoPorId = new Map(duenos.map((dueno) => [dueno.id, dueno.nombre]));
  const mascotaPorId = new Map(mascotas.map((mascota) => [mascota.id, mascota.nombre]));
  const servicioPorId = new Map(servicios.map((servicio) => [servicio.codigo, servicio.nombre]));
  const filas = [["Fecha", "Tipo", "Categoría/servicio", "Dueño", "Mascota", "Concepto", "Valor"]];
  for (const gasto of gastos.filter((fila) => String(fila.fecha).startsWith(`${mes}-`))) {
    const categoria = CATEGORIAS_GASTO.find(([id]) => id === gasto.categoria)?.[1] ?? gasto.categoria;
    filas.push([gasto.fecha, "Gasto", categoria, "", "", gasto.descripcion ?? "", gasto.valor]);
  }
  for (const pago of pagos.filter((fila) => String(fila.fecha).startsWith(`${mes}-`))) {
    filas.push([
      pago.fecha, "Cobro", servicioPorId.get(pago.servicio_codigo) ?? "Sin servicio",
      duenoPorId.get(pago.dueno_id) ?? "Dueño no disponible",
      mascotaPorId.get(pago.mascota_id) ?? "", pago.concepto, pago.valor_total
    ]);
  }
  for (const abono of abonos.filter((fila) => String(fila.fecha).startsWith(`${mes}-`))) {
    const pago = pagos.find((fila) => fila.id === abono.pago_id);
    filas.push([
      abono.fecha, "Recaudo", abono.metodo ?? "", duenoPorId.get(pago?.dueno_id) ?? "Dueño no disponible",
      mascotaPorId.get(pago?.mascota_id) ?? "", pago?.concepto ?? "Cobro no disponible", abono.valor
    ]);
  }
  const resumen = resumenMensual(mes, gastos, pagos, abonos, servicios);
  filas.push(
    ["", "Resumen", "", "", "", "Ingresos registrados", resumen.totalIngresos],
    ["", "Resumen", "", "", "", "Recaudado", resumen.totalRecaudado],
    ["", "Resumen", "", "", "", "Gastos", resumen.totalGastos],
    ["", "Resumen", "", "", "", "Utilidad (cobros menos gastos)", resumen.utilidad]
  );
  return `\uFEFF${filas.map((fila) => fila.map(seguroCSV).join(";")).join("\r\n")}\r\n`;
}
