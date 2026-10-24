import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = {
  getItem: () => JSON.stringify({
    access_token: "tok", refresh_token: "ref", expires_at: Date.now() + 3_600_000, email: "admin@example.test"
  }),
  setItem() {}
};
const llamadas = [];
globalThis.fetch = async (url, init = {}) => {
  llamadas.push({ url: String(url), init });
  return { status: 200, ok: true, json: async () => [] };
};
const { AgendaApi } = await import("../src/admin/services/agendaApi.js");

const PET = "123e4567-e89b-12d3-a456-426614174000";
const EMPLOYEE = "223e4567-e89b-12d3-a456-426614174001";
const APPOINTMENT = "323e4567-e89b-12d3-a456-426614174002";
const last = () => llamadas.at(-1);
const rango = { inicio: "2026-10-12", fin: "2026-10-19" };

test("carga citas que cruzan el rango visible y reservas de hotel de la semana", async () => {
  llamadas.length = 0;
  await AgendaApi.cargar({ fecha: "2026-10-14", rango });
  assert.ok(llamadas.some(({ url }) => /citas\?select=\*,cita_empleados/.test(url) && url.includes("fecha_servicio.gte.2026-10-12") && url.includes("fecha_servicio.lt.2026-10-19")));
  assert.ok(llamadas.some(({ url }) => /reservas_hotel\?.*entrada=lt\.2026-10-19.*salida=gt\.2026-10-12/.test(url)));
  assert.ok(llamadas.some(({ url }) => /servicios\?.*activo=eq\.true/.test(url)));
});

test("crea una cita con el empleado y los datos limpios del modelo", async () => {
  llamadas.length = 0;
  const datos = {
    mascota_id: PET, empleado_ids: [EMPLOYEE], servicio_codigo: "bano", fecha_servicio: "2026-10-12",
    inicio: "2026-10-12T13:30:00.000Z", fin: "2026-10-12T14:00:00.000Z",
    estado: "pendiente", notas: null
  };
  await AgendaApi.crearCita(datos);
  assert.match(last().url, /\/rpc\/guardar_cita_agenda$/);
  assert.equal(last().init.method, "POST");
  assert.deepEqual(JSON.parse(last().init.body), {
    p_id: null, p_mascota_id: PET, p_empleado_ids: [EMPLOYEE],
    p_servicio_codigo: "bano", p_fecha_servicio: "2026-10-12",
    p_inicio: "2026-10-12T13:30:00.000Z", p_fin: "2026-10-12T14:00:00.000Z",
    p_estado: "pendiente", p_notas: null
  });
});

test("consulta choques del rango exacto aunque la fecha no esté en la vista actual", async () => {
  llamadas.length = 0;
  await AgendaApi.citasSolapadas("2026-10-12T13:30:00.000Z", "2026-10-12T14:00:00.000Z");
  assert.match(last().url, /citas\?.*inicio=lt\.2026-10-12T14%3A00%3A00\.000Z&fin=gt\.2026-10-12T13%3A30%3A00\.000Z/);
  const count = llamadas.length;
  assert.throws(() => AgendaApi.citasSolapadas("fecha", "2026-10-12T14:00:00.000Z"), (error) => error.code === "fail");
  assert.equal(llamadas.length, count);
});

test("actualiza estados y rechaza ids inválidos antes de llamar a Supabase", async () => {
  llamadas.length = 0;
  await AgendaApi.actualizarEstado(APPOINTMENT, "listo");
  assert.match(last().url, new RegExp(`citas\\?id=eq\\.${APPOINTMENT}`));
  assert.deepEqual(JSON.parse(last().init.body), { estado: "listo" });
  const count = llamadas.length;
  assert.throws(() => AgendaApi.actualizarEstado("bad", "listo"), (error) => error.code === "fail");
  assert.equal(llamadas.length, count);
});
