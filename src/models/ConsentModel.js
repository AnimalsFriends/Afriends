/**
 * MODELO: decisión de cookies del visitante (se guarda solo en su navegador).
 */
const KEY = "af_consent_v1";

export const ConsentModel = {
  /** @returns {{analytics: boolean, ts: number} | null}  null = aún no decide */
  get() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "null");
      return value && typeof value.analytics === "boolean" ? value : null;
    } catch { return null; }
  },
  set(analytics) {
    try { localStorage.setItem(KEY, JSON.stringify({ analytics: Boolean(analytics), ts: Date.now() })); } catch { /* modo privado */ }
  }
};
