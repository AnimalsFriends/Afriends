import test from "node:test";
import assert from "node:assert/strict";
import { RouteSyncQueue } from "../src/admin/services/routeSyncQueue.js";

class MemoryStorage {
  constructor() { this.data = new Map(); }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}

test("la cola conserva solo la última acción de una parada y se aísla por usuario", () => {
  const storage = new MemoryStorage();
  const a = new RouteSyncQueue("usuario-a", storage);
  const b = new RouteSyncQueue("usuario-b", storage);
  a.enqueue({ id: "parada-1", estado: "recogido", motivo: null, ocurridoClienteEn: "2026-11-11T12:00:00.000Z" });
  a.enqueue({ id: "parada-1", estado: "no_se_pudo", motivo: "Nadie atendió", ocurridoClienteEn: "2026-11-11T12:05:00.000Z" });
  assert.equal(a.list().length, 1);
  assert.equal(a.list()[0].estado, "no_se_pudo");
  assert.deepEqual(b.list(), []);
  assert.doesNotMatch(JSON.stringify(a.list()), /nombre|telefono|direccion|mascota/i);
});

test("la cola elimina acciones confirmadas y conserva errores para reintento", async () => {
  const storage = new MemoryStorage();
  const queue = new RouteSyncQueue("usuario", storage);
  queue.enqueue({ id: "ok", estado: "recogido" });
  await queue.flush(async () => {});
  assert.deepEqual(queue.list(), []);

  queue.enqueue({ id: "error", estado: "entregado" });
  await assert.rejects(queue.flush(async () => { throw new Error("sin red"); }));
  assert.equal(queue.list()[0].status, "error");
});

test("una confirmación antigua no elimina una acción nueva de la misma parada", async () => {
  const storage = new MemoryStorage();
  const queue = new RouteSyncQueue("usuario", storage);
  let confirmar;
  const confirmacion = new Promise((resolve) => { confirmar = resolve; });
  const estados = [];
  queue.enqueue({ id: "parada-1", estado: "recogido" });

  const flush = queue.flush(async () => confirmacion, (id, status) => estados.push([id, status]));
  queue.enqueue({ id: "parada-1", estado: "no_se_pudo", motivo: "No atendieron" });
  confirmar();
  await flush;

  assert.equal(queue.list().length, 1);
  assert.equal(queue.list()[0].estado, "no_se_pudo");
  assert.equal(queue.list()[0].status, "pendiente");
  assert.deepEqual(estados.at(-1), ["parada-1", "pendiente"]);
});

test("clearForUser retira solo la cola de la cuenta que cerró sesión", () => {
  const storage = new MemoryStorage();
  new RouteSyncQueue("a", storage).enqueue({ id: "1", estado: "recogido" });
  new RouteSyncQueue("b", storage).enqueue({ id: "2", estado: "entregado" });
  RouteSyncQueue.clearForUser("a", storage);
  assert.deepEqual(new RouteSyncQueue("a", storage).list(), []);
  assert.equal(new RouteSyncQueue("b", storage).list().length, 1);
});

test("clearAll retira colas de manera explícita y conserva otras claves", () => {
  const storage = new MemoryStorage();
  new RouteSyncQueue("a", storage).enqueue({ id: "1", estado: "recogido" });
  new RouteSyncQueue("b", storage).enqueue({ id: "2", estado: "entregado" });
  storage.setItem("otro", "se conserva");
  RouteSyncQueue.clearAll(storage);
  assert.equal(storage.getItem("otro"), "se conserva");
  assert.equal(storage.length, 1);
});
