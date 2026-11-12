const PREFIX = "af-route-sync:v1:";
const VALID_STATES = new Set(["recogido", "entregado", "no_se_pudo"]);

const safeParse = (raw) => {
  try { return JSON.parse(raw || "[]"); } catch { return []; }
};

const normalize = (value) => Array.isArray(value) ? value.filter((item) =>
  item && typeof item.id === "string" && VALID_STATES.has(item.estado)
).map((item) => ({
  queueId: typeof item.queueId === "string" ? item.queueId
    : JSON.stringify([item.id, item.estado, item.motivo, item.ocurridoClienteEn]),
  id: item.id,
  estado: item.estado,
  motivo: typeof item.motivo === "string" ? item.motivo.slice(0, 1000) : null,
  ocurridoClienteEn: item.ocurridoClienteEn,
  status: item.status === "error" ? "error" : "pendiente"
})) : [];

/** Cola mínima: solo identificadores, estado, motivo y hora; nunca nombres ni fichas. */
export class RouteSyncQueue {
  constructor(userId, storage = globalThis.localStorage) {
    if (!userId) throw new Error("Se necesita una identidad para aislar la cola.");
    this.userId = userId;
    this.storage = storage;
    this.key = `${PREFIX}${userId}`;
  }

  list() {
    return normalize(safeParse(this.storage?.getItem(this.key)));
  }

  save(items) {
    if (!items.length) this.storage?.removeItem(this.key);
    else this.storage?.setItem(this.key, JSON.stringify(items));
  }

  enqueue({ id, estado, motivo = null, ocurridoClienteEn = new Date().toISOString() }) {
    if (!id || !VALID_STATES.has(estado)) throw new Error("Acción de ruta inválida.");
    const queueId = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item = { queueId, id, estado, motivo: motivo?.trim().slice(0, 1000) || null, ocurridoClienteEn, status: "pendiente" };
    const rest = this.list().filter((current) => current.id !== id);
    this.save([...rest, item]);
    return item;
  }

  clear() { this.storage?.removeItem(this.key); }

  static clearForUser(userId, storage = globalThis.localStorage) {
    if (userId) storage?.removeItem(`${PREFIX}${userId}`);
  }

  static clearAll(storage = globalThis.localStorage) {
    if (!storage) return;
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  }

  async flush(send, onStatus = () => {}) {
    const items = this.list();
    for (const item of items) {
      onStatus(item.id, "sincronizando");
      try {
        await send(item);
        const current = this.list();
        const isCurrent = current.some((entry) => entry.id === item.id && entry.queueId === item.queueId);
        if (isCurrent) this.save(current.filter((entry) => entry.id !== item.id));
        onStatus(item.id, isCurrent ? "guardado" : "pendiente");
      } catch (error) {
        const current = this.list();
        const isCurrent = current.some((entry) => entry.id === item.id && entry.queueId === item.queueId);
        if (isCurrent) {
          this.save(current.map((entry) => entry.id === item.id && entry.queueId === item.queueId
            ? { ...entry, status: "error" }
            : entry));
        }
        onStatus(item.id, isCurrent ? "error" : "pendiente");
        throw error;
      }
    }
  }
}
