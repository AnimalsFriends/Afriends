import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = {
  getItem: () => JSON.stringify({
    access_token: "tok", refresh_token: "ref", expires_at: Date.now() + 3_600_000, email: "admin@example.test"
  }),
  setItem() {}
};
const llamadas = [];
let respuesta = { status: 200, ok: true, json: async () => [] };
globalThis.fetch = async (url, init = {}) => {
  llamadas.push({ url: String(url), init });
  return respuesta;
};
const { SeguimientoApi } = await import("../src/admin/services/seguimientoApi.js");

const DOG = "123e4567-e89b-12d3-a456-426614174000";
const ROW = "223e4567-e89b-12d3-a456-426614174001";
const ultima = () => llamadas.at(-1);

test("carga asistencia, asignaciones y vencimientos con filtros acotados a la fecha", async () => {
  llamadas.length = 0;
  await SeguimientoApi.cargar("2026-10-12", "2026-11-11");
  for (const table of ["mascotas", "planes_colegio", "reservas_hotel", "ausencias_colegio",
    "asistencia_colegio", "vacunas_mascota", "soat_vehiculos", "empleados"]) {
    assert.ok(llamadas.some(({ url }) => url.includes(`/rest/v1/${table}?`)), `falta consulta ${table}`);
  }
  assert.ok(llamadas.some(({ url }) => url.includes("fecha_vencimiento=lte.2026-11-11")));
  assert.ok(llamadas.some(({ url }) => url.includes("entrada=lte.2026-10-12&salida=gt.2026-10-12")));
  assert.ok(llamadas.every(({ url }) => url.includes("limit=1000")));
});

test("rechaza fechas inválidas antes de consultar Supabase y pagina el historial", async () => {
  llamadas.length = 0;
  await assert.rejects(SeguimientoApi.cargar("2026-02-31", "2026-03-31"), (error) => error.code === "fail");
  assert.equal(llamadas.length, 0);
  await SeguimientoApi.cargarHistorial(50);
  assert.match(ultima().url, /historial_cambios\?/);
  assert.match(ultima().url, /limit=50&offset=50/);
  assert.throws(() => SeguimientoApi.cargarHistorial(-1), (error) => error.code === "fail");
});

test("crea y actualiza SOAT y no permite UUID inválidos", async () => {
  llamadas.length = 0;
  const datos = { vehiculo: "Van 01", fecha_vencimiento: "2026-11-01", notas: null };
  await SeguimientoApi.crearSoat(datos);
  assert.match(ultima().url, /\/soat_vehiculos$/);
  assert.deepEqual(JSON.parse(ultima().init.body), datos);
  const total = llamadas.length;
  assert.throws(() => SeguimientoApi.actualizarSoat("no-uuid", datos), (error) => error.code === "fail");
  assert.equal(llamadas.length, total);
  await SeguimientoApi.actualizarSoat(ROW, datos);
  assert.match(ultima().url, new RegExp(`soat_vehiculos\\?id=eq\\.${ROW}`));
});

test("la llegada usa upsert que no pisa una marca existente y la salida actualiza su fila", async () => {
  llamadas.length = 0;
  await SeguimientoApi.marcarLlegada(DOG, "2026-10-12");
  assert.match(llamadas[0].url, /asistencia_colegio\?on_conflict=mascota_id,fecha$/);
  assert.match(llamadas[0].init.headers.Prefer, /resolution=ignore-duplicates/);
  assert.equal(JSON.parse(llamadas[0].init.body).mascota_id, DOG);
  assert.ok(Number.isFinite(Date.parse(JSON.parse(llamadas[0].init.body).entrada_en)));
  assert.match(ultima().url, new RegExp(`mascota_id=eq\\.${DOG}&fecha=eq\\.2026-10-12`));

  await SeguimientoApi.marcarSalida(ROW);
  assert.match(ultima().url, new RegExp(`asistencia_colegio\\?id=eq\\.${ROW}`));
  assert.ok(Number.isFinite(Date.parse(JSON.parse(ultima().init.body).salida_en)));
});

test("registra y corrige faltas usando la tabla escolar ya existente", async () => {
  llamadas.length = 0;
  await SeguimientoApi.registrarFalta(DOG, "2026-10-12", "Cita médica");
  assert.match(ultima().url, /\/ausencias_colegio$/);
  assert.deepEqual(JSON.parse(ultima().init.body), {
    mascota_id: DOG, fecha: "2026-10-12", motivo: "Cita médica"
  });
  await SeguimientoApi.quitarFalta(ROW);
  assert.match(ultima().url, new RegExp(`ausencias_colegio\\?id=eq\\.${ROW}`));
  assert.throws(() => SeguimientoApi.registrarFalta("bad", "2026-10-12", ""), (error) => error.code === "fail");
});
