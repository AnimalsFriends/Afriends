import test from "node:test";
import assert from "node:assert/strict";
import { GestionController } from "../src/admin/controllers/GestionController.js";
import { GestionApi } from "../src/admin/services/gestionApi.js";
import { RutasApi } from "../src/admin/services/rutasApi.js";
import { RutasController } from "../src/admin/controllers/RutasController.js";
import { identidadCambio, rolCambio, rolPanelAutorizado } from "../src/admin/controllers/AdminController.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const crearController = (avisos = []) => new GestionController({
  panel: () => ({ innerHTML: "" }), toast: (...args) => avisos.push(args), expire: () => avisos.push(["expired"])
});

test("detecta cambios de usuario aunque conserve el mismo rol y los diferencia de un cambio de rol", () => {
  assert.equal(identidadCambio("usuario-a", "usuario-b"), true);
  assert.equal(identidadCambio("usuario-a", "usuario-a"), false);
  assert.equal(identidadCambio(null, "usuario-a"), false);
  assert.equal(rolCambio("admin", "empleado"), true);
  assert.equal(rolCambio("admin", "admin"), false);
  assert.equal(rolCambio(null, "admin"), false);
});

test("un rol desconocido o ausente no está autorizado", () => {
  assert.equal(rolPanelAutorizado("desconocido"), false);
  assert.equal(rolPanelAutorizado(null), false);
  assert.equal(rolPanelAutorizado("admin"), true);
  assert.equal(rolPanelAutorizado("empleado"), true);
  assert.equal(rolPanelAutorizado("offline"), false);
});

test("invalidar la sesión limpia datos y descarta una carga antigua exitosa", async () => {
  const original = GestionApi.contextoActual;
  const pendiente = deferred();
  GestionApi.contextoActual = () => pendiente.promise;
  try {
    const controller = crearController();
    controller.active = true;
    controller.state.duenos = [{ id: "cuenta-anterior" }];
    const carga = controller.cargar();
    controller.invalidateSession();
    pendiente.resolve({ rol: "admin" });
    await carga;
    assert.deepEqual(controller.state.duenos, []);
    assert.equal(controller.state.isAdmin, null);
    assert.equal(controller.loaded, false);
  } finally { GestionApi.contextoActual = original; }
});

test("un error tardío de la sesión cerrada no muestra errores ni vence la sesión nueva", async () => {
  const original = GestionApi.contextoActual;
  const pendiente = deferred();
  const avisos = [];
  GestionApi.contextoActual = () => pendiente.promise;
  try {
    const controller = crearController(avisos);
    controller.active = true;
    const carga = controller.cargar();
    controller.invalidateSession();
    pendiente.reject(Object.assign(new Error("respuesta antigua"), { code: "expired" }));
    await carga;
    assert.equal(controller.state.error, null);
    assert.deepEqual(avisos, []);
  } finally { GestionApi.contextoActual = original; }
});

test("una operación terminada después del cierre no altera la interfaz ni el botón nuevo", async () => {
  const controller = crearController();
  const pendiente = deferred();
  const boton = { disabled: false, textContent: "Guardar" };
  const operacion = controller.conBoton(boton, "Guardando…", () => pendiente.promise);
  controller.invalidateSession();
  pendiente.resolve();
  await operacion;
  assert.equal(controller.active, false);
  assert.equal(controller.loaded, false);
  assert.equal(boton.disabled, true);
  assert.equal(boton.textContent, "Guardando…");
});

test("una escritura de estado de ruta que termina tras logout no actualiza ni renderiza la sesión siguiente", async () => {
  const original = RutasApi.actualizarEstadoParada;
  const pendiente = deferred();
  const avisos = [];
  let renders = 0;
  RutasApi.actualizarEstadoParada = () => pendiente.promise;
  try {
    const controller = new RutasController({ panel: () => ({ innerHTML: "" }), toast: (...args) => avisos.push(args), expire: () => avisos.push(["expired"]) });
    controller.active = true;
    controller.state.isEmpleado = true;
    controller.state.paradasDia = [{ id: "daily-1", parada_id: "stop-1" }];
    controller.state.paradas = [{ id: "stop-1", sentido: "recogida" }];
    controller.render = () => { renders += 1; };
    const action = controller.marcarParada("daily-1", "recogido");
    controller.invalidateSession();
    pendiente.resolve({ id: "daily-1" });
    await action;
    assert.deepEqual(controller.state.paradasDia, []);
    assert.equal(renders, 0);
    assert.deepEqual(avisos, []);
  } finally { RutasApi.actualizarEstadoParada = original; }
});

test("quitar una autorización descarta el resultado tardío al cambiar entre administradores", async () => {
  const original = GestionApi.deleteAutorizada;
  const confirmOriginal = globalThis.confirm;
  const pendiente = deferred();
  const avisos = [];
  let renders = 0;
  GestionApi.deleteAutorizada = () => pendiente.promise;
  globalThis.confirm = () => true;
  try {
    const controller = crearController(avisos);
    controller.active = true;
    controller.state.isAdmin = true;
    controller.state.dueno = { id: "owner-1", form: {}, autorizadas: [{ id: "auth-1", nombre: "Persona" }] };
    controller.render = () => { renders += 1; };
    const action = controller.quitarAutorizada("auth-1");
    controller.invalidateSession(); // La identidad cambia aunque el rol nuevo también sea admin.
    pendiente.resolve();
    await action;
    assert.deepEqual(controller.state.dueno.autorizadas, []);
    assert.equal(renders, 0);
    assert.deepEqual(avisos, []);
  } finally {
    GestionApi.deleteAutorizada = original;
    if (confirmOriginal === undefined) delete globalThis.confirm;
    else globalThis.confirm = confirmOriginal;
  }
});

test("un error tardío al quitar una autorización no muestra avisos en la sesión nueva", async () => {
  const original = GestionApi.deleteAutorizada;
  const confirmOriginal = globalThis.confirm;
  const pendiente = deferred();
  const avisos = [];
  GestionApi.deleteAutorizada = () => pendiente.promise;
  globalThis.confirm = () => true;
  try {
    const controller = crearController(avisos);
    controller.active = true;
    controller.state.isAdmin = true;
    controller.state.dueno.autorizadas = [{ id: "auth-1", nombre: "Persona" }];
    const action = controller.quitarAutorizada("auth-1");
    controller.invalidateSession();
    pendiente.reject(new Error("fallo de sesión anterior"));
    await action;
    assert.deepEqual(avisos, []);
    assert.deepEqual(controller.state.dueno.autorizadas, []);
  } finally {
    GestionApi.deleteAutorizada = original;
    if (confirmOriginal === undefined) delete globalThis.confirm;
    else globalThis.confirm = confirmOriginal;
  }
});

test("quitar una autorización de la sesión vigente conserva su funcionamiento", async () => {
  const original = GestionApi.deleteAutorizada;
  const confirmOriginal = globalThis.confirm;
  let renders = 0;
  GestionApi.deleteAutorizada = async () => ({ id: "auth-1" });
  globalThis.confirm = () => true;
  try {
    const controller = crearController();
    controller.active = true;
    controller.state.isAdmin = true;
    controller.state.dueno.autorizadas = [{ id: "auth-1", nombre: "Persona" }, { id: "auth-2", nombre: "Otra" }];
    controller.render = () => { renders += 1; };
    await controller.quitarAutorizada("auth-1");
    assert.deepEqual(controller.state.dueno.autorizadas.map((persona) => persona.id), ["auth-2"]);
    assert.equal(renders, 1);
  } finally {
    GestionApi.deleteAutorizada = original;
    if (confirmOriginal === undefined) delete globalThis.confirm;
    else globalThis.confirm = confirmOriginal;
  }
});

test("el reordenamiento tardío exitoso de una parada no refresca al siguiente administrador", async () => {
  const original = RutasApi.reordenarParadas;
  const pendiente = deferred();
  const avisos = [];
  RutasApi.reordenarParadas = () => pendiente.promise;
  try {
    const controller = new RutasController({ panel: () => ({ innerHTML: "" }), toast: (...args) => avisos.push(args), expire: () => avisos.push(["expired"]) });
    controller.active = true;
    controller.state.isAdmin = true;
    controller.state.paradas = [
      { id: "p1", ruta_id: "r1", sentido: "recogida", localidad: "A", orden: 1 },
      { id: "p2", ruta_id: "r1", sentido: "recogida", localidad: "A", orden: 2 }
    ];
    let reloads = 0;
    controller.recargarTrasCambio = async () => { reloads += 1; };
    const action = controller.moverParada({ dataset: { routeId: "r1", sentido: "recogida", id: "p1", indice: "0", delta: "1" } });
    controller.invalidateSession();
    pendiente.resolve();
    await action;
    assert.equal(reloads, 0);
    assert.deepEqual(avisos, []);
  } finally { RutasApi.reordenarParadas = original; }
});

test("el error tardío al mover un grupo no se muestra en la sesión siguiente", async () => {
  const original = RutasApi.reordenarParadas;
  const pendiente = deferred();
  const avisos = [];
  RutasApi.reordenarParadas = () => pendiente.promise;
  try {
    const controller = new RutasController({ panel: () => ({ innerHTML: "" }), toast: (...args) => avisos.push(args), expire: () => avisos.push(["expired"]) });
    controller.active = true;
    controller.state.isAdmin = true;
    controller.state.paradas = [
      { id: "p1", ruta_id: "r1", sentido: "recogida", localidad: "A", orden: 1 },
      { id: "p2", ruta_id: "r1", sentido: "recogida", localidad: "B", orden: 2 }
    ];
    const action = controller.moverGrupo({ dataset: { routeId: "r1", sentido: "recogida", indice: "0", delta: "1" } });
    controller.invalidateSession();
    pendiente.reject(new Error("fallo de sesión anterior"));
    await action;
    assert.deepEqual(avisos, []);
  } finally { RutasApi.reordenarParadas = original; }
});

test("mover una parada actual sigue persistiendo y refrescando el orden", async () => {
  const original = RutasApi.reordenarParadas;
  let persisted;
  let reloads = 0;
  RutasApi.reordenarParadas = async (_routeId, _sentido, ids) => { persisted = ids; };
  try {
    const controller = new RutasController({ panel: () => ({ innerHTML: "" }), toast: () => {}, expire: () => {} });
    controller.state.isAdmin = true;
    controller.state.paradas = [
      { id: "p1", ruta_id: "r1", sentido: "recogida", localidad: "A", orden: 1 },
      { id: "p2", ruta_id: "r1", sentido: "recogida", localidad: "A", orden: 2 }
    ];
    controller.recargarTrasCambio = async () => { reloads += 1; };
    await controller.moverParada({ dataset: { routeId: "r1", sentido: "recogida", id: "p1", indice: "0", delta: "1" } });
    assert.deepEqual(persisted, ["p2", "p1"]);
    assert.equal(reloads, 1);
  } finally { RutasApi.reordenarParadas = original; }
});
