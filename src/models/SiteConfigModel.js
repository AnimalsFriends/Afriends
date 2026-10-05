/**
 * MODELO: datos del sitio (negocio, categorías, servicios y precios).
 *
 * Responsabilidad ÚNICA: obtener y normalizar datos. No toca el DOM.
 * Orden de prioridad:  1) Supabase (lo que publica el panel)  2) site.defaults.js
 */
import { ENV } from "../config/env.js";
import { SITE_DEFAULTS } from "../config/site.defaults.js";
import { db, isSupabaseConfigured } from "../services/supabase.js";
import { slug } from "../utils/dom.js";

const isValid = (data) => Boolean(data && data.negocio && Array.isArray(data.categorias));

export class SiteConfigModel {
  /** @returns {Promise<{source: "supabase"|"local", negocio: object, categorias: object[]}>} */
  static async load() {
    let raw = null;
    let source = "local";

    if (isSupabaseConfigured()) {
      try {
        const rows = await db.select(ENV.SITE_TABLE, "id=eq.1&select=data");
        const data = rows?.[0]?.data;
        if (isValid(data)) { raw = data; source = "supabase"; }
      } catch (error) {
        console.warn("[SiteConfigModel] Supabase no respondió; se usan valores locales:", error.code);
      }
    }

    return { source, ...SiteConfigModel.normalize(raw ?? SITE_DEFAULTS) };
  }

  /** Datos locales inmediatos (sin red). Sirven para pintar la página al instante. */
  static fromDefaults() {
    return { source: "local", ...SiteConfigModel.normalize(SITE_DEFAULTS) };
  }

  /** Deja solo lo visible: categorías activas con al menos un servicio activo. */
  static normalize(raw) {
    const negocio = { moneda: "COP", ...raw.negocio };

    const categorias = raw.categorias
      .filter((cat) => cat && cat.activa !== false)
      .map((cat) => ({
        ...cat,
        id: slug(cat.id),
        servicios: (cat.servicios ?? [])
          .filter((svc) => svc && svc.activo !== false)
          .map((svc) => ({ ...svc, id: slug(svc.id), precio: Number(svc.precio) || 0 }))
      }))
      .filter((cat) => cat.id && cat.servicios.length > 0);

    return { negocio, categorias };
  }

  /** Precio más bajo de una categoría (para mostrar "Desde $X"). */
  static minPrice(categoria) {
    return Math.min(...categoria.servicios.map((svc) => svc.precio));
  }
}
