/**
 * Cloudflare Turnstile (alternativa gratuita y respetuosa con la privacidad a reCAPTCHA).
 * El script se carga SOLO cuando el visitante llega al formulario (no penaliza el rendimiento).
 */
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let pending = null;

export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  pending ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => { pending = null; reject(new Error("turnstile")); };
    document.head.appendChild(script);
  });
  return pending;
}

export async function renderTurnstile(container, { siteKey, onToken, onExpire, onError }) {
  const turnstile = await loadTurnstile();
  return turnstile.render(container, {
    sitekey: siteKey,
    language: "es",
    theme: "light",
    callback: onToken,
    "expired-callback": onExpire,
    "error-callback": onError
  });
}

export const resetTurnstile = (widgetId) => { try { window.turnstile?.reset(widgetId); } catch { /* sin widget */ } };
