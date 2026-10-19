# Scripts del sitio

Aquí están las herramientas de build, auditoría y empaquetado. Se ejecutan desde la raíz:

- `node scripts/build.mjs` genera `robots.txt` y `sitemap.xml`, y actualiza los bloques SEO del HTML.
- `npm run audit` construye y empaqueta `dist/`, y revisa el origen, las páginas,
  recursos, rutas, JSON-LD y CSP del paquete final.
- `node scripts/package.mjs` prepara `dist/` para despliegues que necesiten empaquetado.
- El paquete conserva `favicon.ico`, `site.webmanifest` e `img/` (favicons, iconos móviles
  y vista previa social); `scripts/build.mjs` usa esta última para Open Graph y Twitter.
- `npm run check` corre build, empaquetado, auditoría del paquete y todas las pruebas.

El build usa `SITE_URL` del entorno si existe; si no, toma la URL actual de GitHub Pages
de `src/config/env.js`. La ruta del repositorio forma parte de las URLs públicas.
Si cambia el hosting o el dominio, actualiza esa configuración y vuelve a correr `npm run check`.
