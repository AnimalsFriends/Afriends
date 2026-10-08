import test from "node:test";
import assert from "node:assert/strict";
import { GestionController } from "../src/admin/controllers/GestionController.js";
import { GestionApi } from "../src/admin/services/gestionApi.js";

test("un error al refrescar la lista después de guardar se informa sin perder la lista actual", async () => {
  const originalListar = GestionApi.listDuenos;
  const originalWarn = console.warn;
  const avisos = [];
  GestionApi.listDuenos = async () => { throw Object.assign(new Error("offline"), { code: "network" }); };
  console.warn = () => {};

  try {
    const controller = new GestionController({
      panel: () => null,
      toast: (...args) => avisos.push(args),
      expire: () => assert.fail("No debería vencer la sesión")
    });
    controller.state.duenos = [{ id: "dueno-previo" }];

    const actualizada = await controller.refrescarLista("El dueño se guardó, pero recarga el panel.");

    assert.equal(actualizada, false);
    assert.deepEqual(controller.state.duenos, [{ id: "dueno-previo" }]);
    assert.deepEqual(avisos, [["El dueño se guardó, pero recarga el panel.", "err"]]);
  } finally {
    GestionApi.listDuenos = originalListar;
    console.warn = originalWarn;
  }
});
