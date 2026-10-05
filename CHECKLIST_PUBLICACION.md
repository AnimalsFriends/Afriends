# Lista para publicar · qué falta para el 100 %

Estado: **el código está completo**. Lo que falta son cuentas, claves, datos del cliente y la verificación en producción
(cosas que no se pueden hacer desde el código). Hazlo en este orden.

## ✅ Ya está listo en el código
- Sitio MVC: servicios, cotizador por WhatsApp, formulario con antispam, páginas legales, 404, WhatsApp flotante.
- Panel `/admin/`: negocio, datos legales, servicios y precios, mensajes recibidos.
- SEO (sitemap, robots, canonical, Open Graph, JSON-LD), CSP y cabeceras de seguridad, `modulepreload`.
- Analítica GA4 con consentimiento, CI/CD con GitHub Actions, 54 pruebas automáticas, auditoría de enlaces y CSP.

## 🔴 Falta antes de publicar (bloqueante)

### A. Datos del cliente — enviar `DATOS_PENDIENTES_CLIENTE.md`
- [ ] Razón social / nombre del titular, NIT o cédula, dirección, ciudad, correo (también se pueden cargar desde el panel).
- [ ] Dominio (comprarlo si no lo tiene).
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

### C. Cloudflare (≈ 20 min)
- [ ] Crear el proyecto de Pages y conectar el dominio (HTTPS automático).
- [ ] Cargar los 4 secretos de la Function: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TURNSTILE_SECRET`, `IP_SALT`.
- [ ] Crear el widget de Turnstile (con el dominio real).
- [ ] Ajustes SSL: *Full (strict)*, *Always Use HTTPS*, redirección `www` → dominio principal.
- [ ] Opcional pero recomendado: proteger `/admin/*` con **Cloudflare Access** (gratis hasta 50 usuarios): segunda barrera antes del login.

### D. Código: pegar las claves públicas en `src/config/env.js`
- [ ] `SUPABASE_URL` y `SUPABASE_ANON_KEY` (clave **anon/publishable**, nunca la service_role)
- [ ] `TURNSTILE_SITE_KEY`
- [ ] `GA_MEASUREMENT_ID` (si quieren analítica)
- [ ] `SITE_URL` como variable de GitHub (`https://tu-dominio.com`)

### E. GitHub
- [ ] Secretos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; variables `CF_PAGES_PROJECT`, `SITE_URL`.
- [ ] Hacer push a `main` y confirmar que el workflow queda en verde.

## 🟡 Después de publicar (verificar en producción)
- [ ] Enviar un mensaje real por el formulario → aparece en el panel (pestaña Mensajes) y en Supabase.
- [ ] Probar que un envío con el campo trampa lleno responde "ok" pero **no** crea fila.
- [ ] Entrar a `/admin/`, cambiar un precio, guardar y ver el cambio en la página.
- [ ] https://securityheaders.com (cabeceras) y https://pagespeed.web.dev (Core Web Vitals reales).
- [ ] Search Console: verificar el dominio y enviar `sitemap.xml`.
- [ ] GA4 → Tiempo real: aceptar cookies genera eventos; rechazar no envía nada.
- [ ] Crear/reclamar el Perfil de Negocio de Google (`GOOGLE_BUSINESS_PROFILE.md`) y pegar su enlace en el panel.
- [ ] Probar en un celular real (iPhone y Android): menú, cotizador, formulario, WhatsApp.

## 🧪 Lo que NO pude verificar desde aquí (hazlo en el primer despliegue)
- La ejecución real del workflow de GitHub Actions y de `wrangler pages deploy`.
- La Function corriendo en Cloudflare (la probé con pruebas automáticas y simulaciones, no en su entorno real).
- Las políticas de seguridad (RLS) contra una base de Supabase real: los SQL no se han ejecutado.
- Turnstile y Google Analytics reales (los simulé en las pruebas del navegador).
- Core Web Vitals en producción (solo medí en local: ~65 KB, CLS 0).

## 🟢 Mejoras recomendadas (no bloquean)
- **Aviso al dueño** por cada mensaje nuevo (correo o WhatsApp) con un Webhook de Supabase: hoy debe entrar al panel a verlos.
- Foto de portada real y mejor imagen para compartir (la actual es provisional).
- Regla de límite de peticiones (Rate Limiting) en Cloudflare para `/api/contact` como capa extra.
- Retiro de los archivos antiguos (`index.html`, `admin.html`, `config.js` de la versión previa) cuando todo esté en línea.
- Revisión periódica: borrar mensajes de más de 24 meses (consulta al final de `02_contact_requests.sql`).
