# Scripts del sitio

Aquí están las herramientas de build, auditoría y empaquetado. Se ejecutan desde la raíz:

- `node scripts/build.mjs` genera `robots.txt` y `sitemap.xml`, y actualiza los bloques SEO del HTML.
- `node scripts/audit.mjs` revisa SEO básico, enlaces, imágenes, JSON-LD y CSP.
- `node scripts/package.mjs` prepara `dist/` para despliegues que necesiten empaquetado.
- `npm run check` corre build, auditoría y las pruebas.

El build usa `SITE_URL` del entorno si existe; si no, toma la URL actual de GitHub Pages
de `src/config/env.js`. La ruta del repositorio forma parte de las URLs públicas.
Si cambia el hosting o el dominio, actualiza esa configuración y vuelve a correr `npm run check`.
