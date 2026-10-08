/**
 * CONTROLADOR: mantiene al día los datos estructurados (JSON-LD) de la home
 * cuando los datos publicados en Supabase difieren de los del build.
 */
import { buildBusinessSchema } from "../seo/structuredData.js";

export class SeoController {
  update({ negocio, categorias, source }) {
    if (source !== "supabase") return;                    // con datos locales, el JSON-LD del build ya es correcto
    const el = document.getElementById("ld-business");
    if (!el) return;                                      // solo la home lo tiene
    // En GitHub Pages la app vive bajo /Afriends; conservar la carpeta evita romper URLs absolutas.
    const siteUrl = new URL(".", location.href).href.replace(/\/$/, "");
    const schema = buildBusinessSchema({ negocio, categorias, siteUrl });
    el.textContent = JSON.stringify(schema);
  }
}
