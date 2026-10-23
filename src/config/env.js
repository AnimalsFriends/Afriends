/**
 * Configuración PÚBLICA del entorno.
 *
 * - SUPABASE_URL / SUPABASE_ANON_KEY: se obtienen en Supabase → Project Settings → API.
 *   La clave "anon" / "publishable" es pública por diseño: la seguridad real la dan
 *   las políticas RLS de la base de datos. NUNCA pegues aquí la clave "service_role".
 * - Mientras estén vacías, el sitio funciona 100% con los valores de site.defaults.js.
 */
export const ENV = Object.freeze({
  // URL canónica pública del Worker afriends, sin barra final.
  // La usan el sitemap, robots.txt, las etiquetas canonical / Open Graph y los datos
  // estructurados (SEO). SITE_URL del entorno puede reemplazarla al desplegar.
  SITE_URL: "https://afriends.petcommunity-133.workers.dev",

  SUPABASE_URL: "https://xjpivjxagyzeeqinlzkz.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_lSN4fF9cjtra9NwX6rLX-A_MuBBH-Rk",
  SITE_TABLE: "site_config",

  // --- Formulario de contacto (Fase 4) ---
  CONTACT_ENDPOINT: "/api/contact",   // Cloudflare Worker route (worker.js -> functions/api/contact.js)
  TURNSTILE_SITE_KEY: "0x4AAAAAAFa1z5zxKG9BRcC7",             // clave PÚBLICA de Cloudflare Turnstile (antispam). Vacío = sin widget
                                      // Clave de prueba para desarrollo: "1x00000000000000000000AA"

  // --- Analítica (Fase 4) ---
  GA_MEASUREMENT_ID: "G-SQWWXCB1YS", // ID de Google Analytics 4. Solo se carga tras aceptar cookies opcionales
   // la crea supabase/01_site_config.sql
  REQUEST_TIMEOUT_MS: 3500
});
