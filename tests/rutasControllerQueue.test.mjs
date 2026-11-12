import test from "node:test";
import assert from "node:assert/strict";
import { RutasController } from "../src/admin/controllers/RutasController.js";
import { RutasApi } from "../src/admin/services/rutasApi.js";
import { RouteSyncQueue } from "../src/admin/services/routeSyncQueue.js";

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}

test("recargar el día conserva el estado más reciente mientras siga pendiente en la cola", async () => {
  const original = RutasApi.cargarDia;
  const queue = new RouteSyncQueue("empleado", new MemoryStorage());
  queue.enqueue({
    id: "daily-1",
    estado: "no_se_pudo",
    motivo: "No atendieron",
    ocurridoClienteEn: "2026-11-11T12:05:00.000Z"
  });
  RutasApi.cargarDia = async () => ({
    reservas: [],
    ausencias: [],
    paradasDia: [{ id: "daily-1", estado: "recogido", motivo: null }]
  });

  try {
    const controller = new RutasController({
      panel: () => ({ innerHTML: "" }), toast: () => {}, expire: () => {}
    });
    controller.syncQueue = queue;
    controller.render = () => {};
    await controller.recargarDia();

    assert.equal(controller.state.paradasDia[0].estado, "no_se_pudo");
    assert.equal(controller.state.paradasDia[0].motivo, "No atendieron");
    assert.equal(controller.state.syncStates["daily-1"], "pendiente");
  } finally {
    RutasApi.cargarDia = original;
  }
});
