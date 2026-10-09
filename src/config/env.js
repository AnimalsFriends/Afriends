/**
 * Configuración PÚBLICA del entorno.
 *
 * - SUPABASE_URL / SUPABASE_ANON_KEY: se obtienen en Supabase → Project Settings → API.
 *   La clave "anon" / "publishable" es pública por diseño: la seguridad real la dan
 *   las políticas RLS de la base de datos. NUNCA pegues aquí la clave "service_role".
 * - Mientras estén vacías, el sitio funciona 100% con los valores de site.defaults.js.
 */
export const ENV = Object.freeze({
  // URL pública, sin barra final. GitHub Pages publica este repo bajo /Afriends;
  // conservar esa ruta evita canonical, sitemap y JSON-LD apuntando al sitio equivocado.
  // La usan el sitemap, robots.txt, las etiquetas canonical / Open Graph y los datos
  // estructurados (SEO). SITE_URL del entorno puede reemplazarla al desplegar.
  SITE_URL: "https://animalsfriends.github.io/Afriends",

  SUPABASE_URL: "https://gjosvubtqtrzvqaqrmrk.supabase.co",
  SUPABASE_ANON_KEY: "",
  SITE_TABLE: "site_config",

  // --- Formulario de contacto (Fase 4) ---
  CONTACT_ENDPOINT: "/api/contact",   // Cloudflare Pages Function (functions/api/contact.js)
  TURNSTILE_SITE_KEY: "1x0000000000000000000000000000000AA",             // clave PÚBLICA de Cloudflare Turnstile (antispam). Vacío = sin widget
                                      // Clave de prueba para desarrollo: "1x00000000000000000000AA"

  // --- Analítica (Fase 4) ---
  GA_MEASUREMENT_ID: "",              // ID de Google Analytics 4, ej. "G-ABC123XYZ". Vacío = sin analítica ni banner de cookies
   // la crea supabase/01_site_config.sql
  REQUEST_TIMEOUT_MS: 3500
});
