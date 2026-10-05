/**
 * Configuración PÚBLICA del entorno.
 *
 * - SUPABASE_URL / SUPABASE_ANON_KEY: se obtienen en Supabase → Project Settings → API.
 *   La clave "anon" / "publishable" es pública por diseño: la seguridad real la dan
 *   las políticas RLS de la base de datos. NUNCA pegues aquí la clave "service_role".
 * - Mientras estén vacías, el sitio funciona 100% con los valores de site.defaults.js.
 */
export const ENV = Object.freeze({
  // Dirección pública del sitio, SIN barra final. Ej: "https://www.animalfriends.com.co"
  // La usan el sitemap, robots.txt, las etiquetas canonical / Open Graph y los datos
  // estructurados (SEO). También puede definirse con la variable de entorno SITE_URL
  // en Cloudflare Pages (tiene prioridad). Vacío = esas piezas no se generan.
  SITE_URL: "",

  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  SITE_TABLE: "site_config",

  // --- Formulario de contacto (Fase 4) ---
  CONTACT_ENDPOINT: "/api/contact",   // Cloudflare Pages Function (functions/api/contact.js)
  TURNSTILE_SITE_KEY: "",             // clave PÚBLICA de Cloudflare Turnstile (antispam). Vacío = sin widget
                                      // Clave de prueba para desarrollo: "1x00000000000000000000AA"

  // --- Analítica (Fase 4) ---
  GA_MEASUREMENT_ID: "",              // ID de Google Analytics 4, ej. "G-ABC123XYZ". Vacío = sin analítica ni banner de cookies
   // la crea supabase/01_site_config.sql
  REQUEST_TIMEOUT_MS: 3500
});
