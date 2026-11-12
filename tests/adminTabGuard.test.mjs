import test from "node:test";
import assert from "node:assert/strict";
import { AdminController } from "../src/admin/controllers/AdminController.js";

test("no cambia de pestaña si Gestión rechaza descartar el borrador", () => {
  const controller = Object.create(AdminController.prototype);
  controller.role = "admin";
  controller.tab = "gestion";
  let confirmations = 0;
  controller.gestion = { puedeSalir: () => { confirmations += 1; return false; } };

  controller.setTab("rutas");

  assert.equal(confirmations, 1);
  assert.equal(controller.tab, "gestion");
});
