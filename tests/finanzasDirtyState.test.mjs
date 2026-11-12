import test from "node:test";
import assert from "node:assert/strict";
import { FinanzasController } from "../src/admin/controllers/FinanzasController.js";

test("descartar un formulario financiero no limpia otros borradores pendientes", () => {
  const controller = new FinanzasController({
    panel: () => ({ innerHTML: "" }), toast: () => {}, expire: () => {}
  });
  const confirmOriginal = globalThis.confirm;
  controller.state.forms.gasto.descripcion = "Combustible";
  controller.state.forms.cobro.concepto = "Mensualidad";
  controller.setDirty(true, "gasto");
  controller.setDirty(true, "cobro");
  globalThis.confirm = () => true;

  try {
    assert.equal(controller.puedeSalir("gasto"), true);
    assert.equal(controller.state.forms.gasto.descripcion, "");
    assert.equal(controller.state.forms.cobro.concepto, "Mensualidad");
    assert.equal(controller.dirty, true);
    assert.deepEqual([...controller.dirtyForms], ["cobro"]);
  } finally {
    if (confirmOriginal === undefined) delete globalThis.confirm;
    else globalThis.confirm = confirmOriginal;
  }
});

test("guardar un formulario financiero no limpia los demás borradores", () => {
  const controller = new FinanzasController({
    panel: () => ({ innerHTML: "" }), toast: () => {}, expire: () => {}
  });
  controller.setDirty(true, "gasto");
  controller.setDirty(true, "cobro");

  controller.setDirty(false, "gasto");

  assert.equal(controller.dirty, true);
  assert.deepEqual([...controller.dirtyForms], ["cobro"]);
});

test("cancelar la salida conserva todos los borradores financieros", () => {
  const controller = new FinanzasController({
    panel: () => ({ innerHTML: "" }), toast: () => {}, expire: () => {}
  });
  const confirmOriginal = globalThis.confirm;
  controller.setDirty(true, "gasto");
  controller.setDirty(true, "abono");
  globalThis.confirm = () => false;

  try {
    assert.equal(controller.puedeSalir("gasto"), false);
    assert.deepEqual([...controller.dirtyForms], ["gasto", "abono"]);
  } finally {
    if (confirmOriginal === undefined) delete globalThis.confirm;
    else globalThis.confirm = confirmOriginal;
  }
});
