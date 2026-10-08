# Configuración del sitio

`env.js` reúne las opciones de entorno (URL pública, conexión pública a Supabase,
GA4 y Turnstile). `site.defaults.js` contiene los datos visibles del negocio y los
servicios usados como respaldo si Supabase no está disponible.

No pongas aquí claves secretas. La URL actual de GitHub Pages está en `SITE_URL`;
si se cambia de dominio, ajusta el valor o proporciona la variable de entorno
`SITE_URL` al build. El ID de GA4 queda vacío hasta recibir el valor real.

Razón social, NIT y dirección completa siguen pendientes. Los textos legales muestran
marcadores y deben pasar por revisión legal antes de publicarse.
