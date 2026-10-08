import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = {
  getItem: () => JSON.stringify({
    access_token: "tok", refresh_token: "ref", expires_at: Date.now() + 3_600_000, email: "admin@example.test"
  }),
  setItem() {},
  removeItem() {}
};
const llamadas = [];
globalThis.fetch = async (url, init = {}) => {
  llamadas.push({ url: String(url), init });
  return {
    status: 200, ok: true,
    json: async () => [],
    blob: async () => new Blob()
  };
};
const { RutasApi } = await import("../src/admin/services/rutasApi.js");

const DOG = "123e4567-e89b-12d3-a456-426614174000";
const ROUTE = "223e4567-e89b-12d3-a456-426614174001";
const last = () => llamadas.at(-1);

test("carga rutas, planes, reservas del mes, ausencias del día y capacidad", async () => {
  llamadas.length = 0;
  await RutasApi.cargar({ fecha: "2026-10-12", inicioMes: "2026-10-01", finMes: "2026-11-01" });
  assert.ok(llamadas.some(({ url }) => /rutas_colegio\?/.test(url)));
  assert.ok(llamadas.some(({ url }) => /reservas_hotel\?.*entrada=lt\.2026-11-01.*salida=gt\.2026-10-01/.test(url)));
  assert.ok(llamadas.some(({ url }) => /ausencias_colegio\?.*fecha=eq\.2026-10-12/.test(url)));
  assert.ok(llamadas.some(({ url }) => /parametros_operativos\?id=eq\.1/.test(url)));
  assert.ok(llamadas.some(({ url }) => /paradas_ruta\?.*order=ruta_id\.asc,sentido\.asc,orden\.asc,id\.asc/.test(url)));
  assert.ok(llamadas.some(({ url }) => /mascotas\?.*order=nombre\.asc,id\.asc/.test(url)));
});

test("las consultas del día mantienen un orden estable al paginar", async () => {
  llamadas.length = 0;
  await RutasApi.cargarDia("2026-10-12");
  assert.ok(llamadas.some(({ url }) => /reservas_hotel\?.*order=entrada\.asc,id\.asc/.test(url)));
  assert.ok(llamadas.some(({ url }) => /paradas_dia\?.*order=parada_id\.asc,id\.asc/.test(url)));
});

test("el reordenamiento usa la función transaccional e incluye los ids en orden", async () => {
  await RutasApi.reordenarParadas(ROUTE, "recogida", [DOG]);
  assert.match(last().url, /rpc\/reordenar_paradas$/);
  assert.deepEqual(JSON.parse(last().init.body), { p_ruta_id: ROUTE, p_sentido: "recogida", p_ids: [DOG] });
});

test("las paradas del día se crean sin duplicar filas existentes", async () => {
  await RutasApi.asegurarParadasDia("2026-10-12", [DOG]);
  assert.match(last().url, /paradas_dia\?on_conflict=parada_id,fecha/);
  assert.match(last().init.headers.Prefer, /resolution=ignore-duplicates/);
  assert.deepEqual(JSON.parse(last().init.body), [{ parada_id: DOG, fecha: "2026-10-12" }]);
});

test("los ids inválidos se rechazan antes de hacer una petición", async () => {
  const count = llamadas.length;
  assert.throws(() => RutasApi.activarRuta("no-uuid", true), (error) => error.code === "fail");
  assert.equal(llamadas.length, count);
});
