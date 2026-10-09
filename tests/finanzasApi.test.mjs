import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = {
  getItem: () => JSON.stringify({
    access_token: "tok", refresh_token: "ref", expires_at: Date.now() + 3_600_000, email: "admin@example.test"
  }),
  setItem() {}
};
const llamadas = [];
let respuesta = { status: 201, ok: true, json: async () => [] };
globalThis.fetch = async (url, init = {}) => {
  llamadas.push({ url: String(url), init });
  return { ...respuesta, blob: async () => new Blob(["receipt"], { type: "application/pdf" }) };
};
const { FinanzasApi } = await import("../src/admin/services/finanzasApi.js");

const GASTO = "123e4567-e89b-12d3-a456-426614174000";
const PAGO = "223e4567-e89b-12d3-a456-426614174001";
const U = () => llamadas.at(-1);

test("carga todas las tablas financieras y catálogos para calcular cartera e informes", async () => {
  llamadas.length = 0;
  await FinanzasApi.cargar();
  for (const table of ["gastos", "pagos", "abonos", "duenos", "mascotas", "servicios"]) {
    assert.ok(llamadas.some(({ url }) => new RegExp(`/rest/v1/${table}\\?`).test(url)));
  }
});

test("crea gastos y cobros y valida UUID antes de actualizar un gasto", async () => {
  llamadas.length = 0;
  const gasto = { fecha: "2026-10-01", categoria: "gasolina", valor: 20000, descripcion: null };
  await FinanzasApi.crearGasto(gasto);
  assert.match(U().url, /\/gastos$/);
  assert.deepEqual(JSON.parse(U().init.body), gasto);
  await FinanzasApi.crearCobro({ dueno_id: GASTO, valor_total: 50000 });
  assert.match(U().url, /\/pagos$/);
  const count = llamadas.length;
  assert.throws(() => FinanzasApi.actualizarGasto("no-uuid", {}), (error) => error.code === "fail");
  assert.equal(llamadas.length, count);
  await FinanzasApi.actualizarGasto(GASTO, { recibo_path: `gastos/${GASTO}/recibo` });
  assert.match(U().url, new RegExp(`gastos\\?id=eq\\.${GASTO}`));
});

test("registra abonos y traduce la salvaguarda de saldo concurrente a conflicto", async () => {
  llamadas.length = 0;
  respuesta = { status: 201, ok: true, json: async () => [] };
  await FinanzasApi.crearAbono({ pago_id: PAGO, fecha: "2026-10-01", valor: 100 });
  assert.match(U().url, /\/abonos$/);
  respuesta = {
    status: 400, ok: false,
    json: async () => ({ code: "23514", message: "El abono supera el saldo pendiente del cobro." })
  };
  await assert.rejects(FinanzasApi.crearAbono({ pago_id: PAGO, valor: 1 }), (error) => error.code === "conflict");
  respuesta = { status: 201, ok: true, json: async () => [] };
});

test("los recibos usan rutas acotadas, bucket privado y sesión autenticada", async () => {
  llamadas.length = 0;
  const archivo = new Blob(["pdf"], { type: "application/pdf" });
  await FinanzasApi.subirRecibo(GASTO, archivo);
  assert.match(U().url, new RegExp(`/storage/v1/object/recibos/gastos/${GASTO}/recibo$`));
  assert.equal(U().init.headers["x-upsert"], "true");
  assert.equal(U().init.headers["Content-Type"], "application/pdf");
  const blob = await FinanzasApi.descargarRecibo(`gastos/${GASTO}/recibo`);
  assert.equal(await blob.text(), "receipt");
  const calls = llamadas.length;
  await assert.rejects(FinanzasApi.descargarRecibo("otro/archivo"), (error) => error.code === "fail");
  assert.equal(llamadas.length, calls);
});
