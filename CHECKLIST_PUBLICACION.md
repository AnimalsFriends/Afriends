# Lista para publicar · qué falta para el 100 %

Estado: GitHub Pages sigue disponible y el frontend también responde en el Worker
`https://afriends.petcommunity-133.workers.dev/`. El cambio de código para integrar
`/api/contact` y el workflow de Workers está preparado localmente, pero aún no se ha
desplegado. No des por probado lo que solo ha pasado la auditoría local.

## ✅ Ya está listo en el código
- Sitio MVC: servicios, cotizador por WhatsApp, formulario con antispam, páginas legales, 404, WhatsApp flotante.
- Panel `/admin/`: negocio, datos legales, servicios y precios, mensajes recibidos.
- SEO (sitemap, robots, canonical, Open Graph, JSON-LD) generado con `SITE_URL`.
- Verificación HTML de Search Console en la home y guía para enviar el sitemap.
- GA4 tiene consentimiento previo implementado, pero no está activo: falta el ID real.
- No hay un archivo suelto `git` en la raíz; `.git/` es la metadata del repositorio y no se debe borrar.
- La descripción del repositorio aún requiere un cambio manual desde GitHub.

## 🔴 Falta antes de publicar (bloqueante)

### A. Datos del cliente — enviar `DATOS_PENDIENTES_CLIENTE.md`
- [ ] Razón social / nombre del titular, NIT o cédula y dirección completa. Los campos están marcados en las páginas legales.
- [ ] Confirmar los datos de contacto y ubicación que ya aparecen en la configuración.
- [x] URL existente del Worker: `https://afriends.petcommunity-133.workers.dev/`.
- [ ] No se requiere dominio propio; conservar la URL gratuita `workers.dev`.
- [ ] Enlaces de Instagram, Facebook y TikTok; Gmail para el Perfil de Google.
- [ ] Confirmar horarios, servicios y precios, y si atienden **gatos** además de perros.
- [ ] **Fotos reales** de las instalaciones y los peluditos (hoy el sitio usa solo el logo y una imagen para compartir provisional).
- [ ] Revisión de un **asesor legal** de Aviso legal, Política de privacidad y Política de cookies (son un documento base).
      Consultar también si el negocio debe inscribir su base de datos ante la SIC.

### B. Supabase (≈ 10 min)
- [ ] Ejecutar `supabase/01_site_config.sql` y `supabase/02_contact_requests.sql` con el **mismo** correo de administrador real.
- [ ] Crear el usuario administrador (Authentication → Users, *Auto Confirm*).
- [ ] Desactivar *Allow new users to sign up*.
- [ ] Recomendado: activar autenticación en dos pasos (MFA) para esa cuenta.

### C. Hosting y Function
- [x] Destino confirmado: Cloudflare Worker `afriends.petcommunity-133.workers.dev`; `wrangler.jsonc` publica estáticos de `dist/`.
- [x] `worker.js` enruta `/api/contact` al manejador compartido `functions/api/contact.js`.
- [ ] Configurar en el Worker los secretos `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_KEY`), `TURNSTILE_SECRET` e `IP_SALT`.
- [ ] Configurar dominio `afriends.petcommunity-133.workers.dev` en Turnstile y reemplazar la Site Key de prueba en `src/config/env.js`.
- [ ] Configurar en GitHub Actions `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y `SITE_URL=https://afriends.petcommunity-133.workers.dev`.
- [ ] Ejecutar el workflow en `main` y verificar `/api/contact` y un envío de prueba controlado.

### D. Configuración pública (nunca pegar secretos en el frontend)
- [ ] Verificar que `SUPABASE_URL` y `SUPABASE_ANON_KEY` sean los valores públicos correctos (anon/publishable); nunca usar `sb_secret` ni `service_role` en el frontend.
- [ ] Sustituir la Site Key de prueba por la Site Key real de Turnstile, registrada para el hostname del Worker.
- [ ] `GA_MEASUREMENT_ID` real (`G-...`) si quieren analítica; el consentimiento previo y el texto condicional de cookies ya están implementados.
- [ ] `SITE_URL` de GitHub Actions configurada para `https://afriends.petcommunity-133.workers.dev`

### E. GitHub
- [ ] Configurar secretos y variable requeridos para que el workflow publique el Worker solo desde `main`.
- [ ] En **Settings → General → Description**, actualizar manualmente la descripción del repositorio. Sugerencia: “Sitio web de Animal Friends, guardería canina con colegio, hotel y servicios para mascotas”.

### F. Pasos externos que quedan en manos del negocio
- [ ] **Search Console:** verificar la propiedad Prefijo de URL elegida y enviar el sitemap correspondiente.
- [ ] **Perfil de Negocio de Google:** crear o reclamar la ficha, verificarla y seguir `GOOGLE_BUSINESS_PROFILE.md`.
- [ ] **Cloudflare Worker:** revisar que el endpoint y sus secretos estén configurados en el Worker `afriends`.

## 🟡 Después de publicar (verificar en producción)
- [ ] Enviar un mensaje real por el formulario → aparece en el panel (pestaña Mensajes) y en Supabase.
- [ ] Probar que un envío con el campo trampa lleno responde "ok" pero **no** crea fila.
- [ ] Entrar a `/admin/`, cambiar un precio, guardar y ver el cambio en la página.
- [ ] https://securityheaders.com y https://pagespeed.web.dev en el Worker publicado.
- [ ] Search Console: verificar la propiedad **Prefijo de URL** con la etiqueta HTML y enviar el sitemap del hosting elegido.
- [ ] GA4 → Tiempo real: aceptar cookies genera eventos; rechazar no envía nada.
- [ ] Crear/reclamar el Perfil de Negocio de Google (`GOOGLE_BUSINESS_PROFILE.md`) y pegar su enlace en el panel.
- [ ] Probar en un celular real (iPhone y Android): menú, cotizador, formulario, WhatsApp.

## 🧪 Lo que NO pude verificar desde aquí (hazlo en el siguiente despliegue)
- La ejecución del nuevo workflow y el despliegue actualizado del Worker.
- La clave privada se retiró de la configuración local; revoca/rota en Supabase cualquier clave privada que se haya usado ahí y configura solo la clave pública anon/publishable antes de reconectar el panel.
- La Function corriendo en Cloudflare (la probé con pruebas automáticas y simulaciones, no en su entorno real).
- Las políticas de seguridad (RLS) contra una base de Supabase real: los SQL no se han ejecutado.
- Turnstile y Google Analytics reales; falta activar GA4 con su ID y consentir en producción.
- Core Web Vitals en producción (solo medí en local: ~65 KB, CLS 0).

## 🟢 Mejoras recomendadas (no bloquean)
- **Aviso al dueño** por cada mensaje nuevo (correo o WhatsApp) con un Webhook de Supabase: hoy debe entrar al panel a verlos.
- Foto de portada real y mejor imagen para compartir (la actual es provisional).
- Revisión en un celular real y PageSpeed, pendiente después de la publicación/cambio de hosting.
- Regla de límite de peticiones (Rate Limiting) en Cloudflare para `/api/contact` como capa extra.
- Retiro de los archivos antiguos (`index.html`, `admin.html`, `config.js` de la versión previa) cuando todo esté en línea.
- Revisión periódica: borrar mensajes de más de 24 meses (consulta al final de `02_contact_requests.sql`).
