import test from "node:test";
import assert from "node:assert/strict";
import {
  carteraPorDueno, exportarMesCSV, resumenMensual, saldosPagos,
  validarAbono, validarCobro, validarGasto
} from "../src/admin/models/finanzasModel.js";

const OWNER = "123e4567-e89b-12d3-a456-426614174000";
const DOG = "223e4567-e89b-12d3-a456-426614174001";
const OWNER_TWO = "323e4567-e89b-12d3-a456-426614174002";
const INVOICE = "423e4567-e89b-12d3-a456-426614174003";
const INVOICE_TWO = "523e4567-e89b-12d3-a456-426614174004";
const SERVICE = "colegio";

const pagos = [
  { id: INVOICE, dueno_id: OWNER, mascota_id: DOG, servicio_codigo: SERVICE, fecha: "2026-10-02", concepto: "Colegio", valor_total: 300000 },
  { id: INVOICE_TWO, dueno_id: OWNER, mascota_id: null, servicio_codigo: null, fecha: "2026-09-30", concepto: "Baño", valor_total: 100000 }
];
const abonos = [
  { pago_id: INVOICE, fecha: "2026-10-05", valor: 120000 },
  { pago_id: INVOICE_TWO, fecha: "2026-10-06", valor: 100000 }
];
const duenos = [
  { id: OWNER, nombre: "Ana", telefono: "3123044174" },
  { id: OWNER_TWO, nombre: "Luis", telefono: "" }
];
const mascotas = [{ id: DOG, nombre: "Max", dueno_id: OWNER }];
const servicios = [{ codigo: SERVICE, nombre: "Colegio", activo: true }];

test("valida gastos con categorías reales y rechaza valores fuera de rango", () => {
  const ok = validarGasto({ fecha: "2026-10-01", categoria: "gasolina", valor: "1234.50", descripcion: "Ruta norte" });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.clean.valor, 1234.5);
  assert.equal(validarGasto({ fecha: "2026-02-30", categoria: "falso", valor: -1, descripcion: "x".repeat(301) }).errors.length, 4);
  assert.match(validarGasto({ fecha: "2026-10-01", categoria: "gas", valor: 1.001 }).errors.join(" "), /mayor que cero/);
});

test("valida cobros por dueño, comprueba pertenencia de mascota y acepta servicio general", () => {
  const data = { duenos, mascotas, servicios };
  const ok = validarCobro({
    dueno_id: OWNER, mascota_id: DOG, servicio_codigo: SERVICE, fecha: "2026-10-01",
    concepto: "Mensualidad", valor_total: 200000
  }, data);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.clean.dueno_id, OWNER);
  assert.equal(validarCobro({
    dueno_id: OWNER_TWO, mascota_id: DOG, servicio_codigo: "inexistente", fecha: "2026-10-01",
    concepto: "A", valor_total: 0
  }, data).errors.length, 4);
  assert.deepEqual(validarCobro({
    dueno_id: OWNER, mascota_id: "", servicio_codigo: "", fecha: "2026-10-01",
    concepto: "Cobro general", valor_total: 1
  }, data).errors, []);
});

test("no deja registrar abonos mayores al saldo y valida fechas y medios", () => {
  const form = { pago_id: INVOICE, fecha: "2026-10-05", valor: 180000, metodo: "Transferencia", notas: "" };
  assert.deepEqual(validarAbono(form, 180000).errors, []);
  assert.match(validarAbono({ ...form, valor: 180000.01 }, 180000).errors.join(" "), /superar el saldo/);
  assert.equal(validarAbono({ ...form, fecha: "2026-02-30" }, 180000).errors.length, 1);
});

test("agrupa el saldo de varios cobros de una persona sin duplicarla por perro", () => {
  const saldos = saldosPagos(pagos, abonos);
  assert.deepEqual(saldos.get(INVOICE), { total: 300000, pagado: 120000, saldo: 180000 });
  assert.deepEqual(carteraPorDueno(pagos, abonos, duenos).map(({ dueno, saldo }) => [dueno.nombre, saldo]), [["Ana", 180000]]);
});

test("resume cobros por fecha de factura, abonos por fecha de recaudo y gastos por fecha", () => {
  const reporte = resumenMensual("2026-10", [
    { fecha: "2026-10-03", categoria: "gasolina", valor: 50000 },
    { fecha: "2026-09-30", categoria: "agua", valor: 4000 }
  ], pagos, abonos, servicios);
  assert.equal(reporte.totalIngresos, 300000);
  assert.equal(reporte.totalRecaudado, 220000);
  assert.equal(reporte.totalGastos, 50000);
  assert.equal(reporte.utilidad, 250000);
  assert.deepEqual(reporte.ingresosPorServicio.map(({ nombre, valor }) => [nombre, valor]), [["Colegio", 300000]]);
});

test("exporta el mes a CSV compatible con Excel y evita fórmulas en campos externos", () => {
  const csv = exportarMesCSV("2026-10", [], [
    { ...pagos[0], concepto: "=HYPERLINK(\"evil\")" }
  ], abonos, [{ ...duenos[0], nombre: "@FORMULA" }], mascotas, servicios);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes(`"2026-10-02";"Cobro";"Colegio";"'@FORMULA"`));
  assert.ok(csv.includes(`"'=HYPERLINK(""evil"")"`));
  assert.match(csv, /"2026-10-05";"Recaudo"/);
  assert.match(csv, /"";"Resumen";"";"";"";"Utilidad \(cobros menos gastos\)";300000/);
});
