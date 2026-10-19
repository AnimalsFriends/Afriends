# Configuración del sitio

`env.js` reúne las opciones de entorno (URL pública, conexión pública a Supabase,
GA4 y Turnstile). `site.defaults.js` contiene los datos visibles del negocio y los
servicios usados como respaldo si Supabase no está disponible.

No pongas aquí claves secretas: `SUPABASE_ANON_KEY` solo puede contener la clave
pública anon/publishable. El workflow debe recibir `SITE_URL` como variable con la URL
confirmada del Worker para generar canonical, sitemap y metadatos de producción. El
valor del archivo es solo respaldo para el build local. El ID de GA4 queda vacío hasta
recibir el valor real.

Razón social, NIT y dirección completa siguen pendientes. Los textos legales muestran
marcadores y deben pasar por revisión legal antes de publicarse. La clave pública de
Supabase también debe configurarse antes de volver a conectar el panel con la base de
datos; nunca uses una clave privada del proyecto en el navegador.
