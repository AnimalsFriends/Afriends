import test from "node:test";
import assert from "node:assert/strict";

/* Sesión falsa y fetch falso: no se toca ninguna red ni ninguna base de datos real. */
globalThis.localStorage = {
  getItem: () => JSON.stringify({ access_token: "tok", refresh_token: "ref", expires_at: Date.now() + 3_600_000, email: "a@b.co" }),
  setItem() {}, removeItem() {}
};
const llamadas = [];
let respuesta = { status: 200, body: [] };
globalThis.fetch = async (url, init = {}) => {
  llamadas.push({ url: String(url), init });
  return {
    status: respuesta.status, ok: respuesta.status >= 200 && respuesta.status < 300,
    json: async () => respuesta.body, blob: async () => new Blob(["x"])
  };
};
const { GestionApi } = await import("../src/admin/services/gestionApi.js");

const ID = "123e4567-e89b-12d3-a456-426614174000";
const ultima = () => llamadas.at(-1);
const responder = (status, body = []) => { respuesta = { status, body }; };

test("todas las peticiones llevan el token del administrador", async () => {
  responder(200, []);
  await GestionApi.listDuenos();
  assert.equal(ultima().init.headers.Authorization, "Bearer tok");
});

test("lista de dueños: trae los perros anidados, ordenados por nombre", async () => {
  responder(200, [{ id: ID }]);
  const filas = await GestionApi.listDuenos();
  assert.equal(filas.length, 1);
  assert.match(ultima().url, /\/rest\/v1\/duenos\?select=\*,mascotas\(/);
  assert.match(ultima().url, /order=nombre\.asc/);
});

test("crear dueño: POST con el JSON y devuelve la fila creada", async () => {
  responder(201, [{ id: ID, nombre: "Ana" }]);
  const fila = await GestionApi.createDueno({ nombre: "Ana", telefono: "573123044174" });
  assert.equal(ultima().init.method, "POST");
  assert.equal(ultima().init.headers.Prefer, "return=representation");
  assert.deepEqual(JSON.parse(ultima().init.body), { nombre: "Ana", telefono: "573123044174" });
  assert.equal(fila.id, ID);
});

test("crear mascota: el id del dueño lo pone el servicio, no el formulario", async () => {
  responder(201, [{ id: ID }]);
  await GestionApi.createMascota(ID, { nombre: "Max", dueno_id: "intento-de-cambiarlo" });
  assert.equal(JSON.parse(ultima().init.body).dueno_id, ID);
});

test("desactivar en vez de borrar: PATCH con activo=false", async () => {
  responder(200, [{ id: ID, activo: false }]);
  await GestionApi.setDuenoActivo(ID, false);
  assert.equal(ultima().init.method, "PATCH");
  assert.match(ultima().url, new RegExp(`duenos\\?id=eq\\.${ID}$`));
  assert.deepEqual(JSON.parse(ultima().init.body), { activo: false });
});

test("un id que no es uuid se rechaza antes de llegar a la red", async () => {
  const antes = llamadas.length;
  assert.throws(() => GestionApi.updateDueno("1;drop table duenos", {}), (e) => e.code === "fail");
  assert.throws(() => GestionApi.getMascota("../../etc"), (e) => e.code === "fail");
  assert.equal(llamadas.length, antes);
});

test("códigos de error: sin permiso, sesión vencida, tabla inexistente, choque y fallo general", async () => {
  // Un 401 significa sesión vencida: authed() intenta renovarla y, si no puede, avisa "expired" (el panel cierra sesión).
  for (const [status, code] of [[403, "perm"], [401, "expired"], [404, "missing"], [409, "conflict"], [500, "fail"]]) {
    responder(status, {});
    await assert.rejects(GestionApi.listDuenos(), (e) => e.code === code, `${status} -> ${code}`);
  }
});

test("es_admin: llama a la función de la base de datos y entiende true/false", async () => {
  responder(200, true);
  assert.equal(await GestionApi.esAdmin(), true);
  assert.match(ultima().url, /rpc\/es_admin$/);
  responder(200, false);
  assert.equal(await GestionApi.esAdmin(), false);
  responder(404, {});
  await assert.rejects(GestionApi.esAdmin(), (e) => e.code === "missing");
});

test("borrar una vacuna: DELETE con el id; un 204 sin cuerpo no rompe", async () => {
  responder(204, null);
  assert.equal(await GestionApi.deleteVacuna(ID), null);
  assert.equal(ultima().init.method, "DELETE");
  assert.match(ultima().url, new RegExp(`vacunas_mascota\\?id=eq\\.${ID}$`));
});

test("subir foto: ruta fija <id>/foto, reemplaza la anterior y usa el tipo de la imagen", async () => {
  responder(200, {});
  const blob = new Blob(["img"], { type: "image/webp" });
  const ruta = await GestionApi.subirFoto(ID, blob);
  assert.equal(ruta, `${ID}/foto`);
  assert.match(ultima().url, new RegExp(`/storage/v1/object/fotos-mascotas/${ID}/foto$`));
  assert.equal(ultima().init.headers["x-upsert"], "true");
  assert.equal(ultima().init.headers["Content-Type"], "image/webp");
  responder(413, {});
  await assert.rejects(GestionApi.subirFoto(ID, blob), (e) => e.code === "fail");
});

test("bajar foto: solo rutas con el formato esperado", async () => {
  await assert.rejects(GestionApi.bajarFoto("../secreto"), (e) => e.code === "fail");
  await assert.rejects(GestionApi.bajarFoto(`${ID}/../otra`), (e) => e.code === "fail");
  await assert.rejects(GestionApi.bajarFoto(""), (e) => e.code === "fail");
});
