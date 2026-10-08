# Lista para publicar · qué falta para el 100 %

Estado: la web ya está publicada en GitHub Pages (`https://animalsfriends.github.io/Afriends/`).
Todavía hay decisiones de hosting, datos del negocio y verificaciones reales pendientes; no des por probado
lo que solo ha pasado la auditoría local.

## ✅ Ya está listo en el código
- Sitio MVC: servicios, cotizador por WhatsApp, formulario con antispam, páginas legales, 404, WhatsApp flotante.
- Panel `/admin/`: negocio, datos legales, servicios y precios, mensajes recibidos.
- SEO (sitemap, robots, canonical, Open Graph, JSON-LD) configurado para la ruta `/Afriends/`.
- Verificación HTML de Search Console en la home y guía para enviar el sitemap.
- GA4 tiene consentimiento previo implementado, pero no está activo: falta el ID real.
- Archivo `git` retirado. La descripción del repositorio aún requiere un cambio manual en GitHub.

## 🔴 Falta antes de publicar (bloqueante)

### A. Datos del cliente — enviar `DATOS_PENDIENTES_CLIENTE.md`
- [ ] Razón social / nombre del titular, NIT o cédula y dirección completa. Los campos están marcados en las páginas legales.
- [ ] Confirmar los datos de contacto y ubicación que ya aparecen en la configuración.
- [ ] Dominio propio (por ahora el sitio usa el dominio de GitHub Pages).
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
- [ ] Decidir el hosting oficial: la web está publicada en GitHub Pages, pero el workflow CI/CD y `/api/contact` están hechos para Cloudflare Pages.
- [ ] Si se decide Cloudflare Pages: crear el proyecto y configurar la Function, Turnstile y los cuatro valores `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TURNSTILE_SECRET`, `IP_SALT`.
- [ ] Si se conserva GitHub Pages: elegir una API compatible para `/api/contact`; GitHub Pages no ejecuta `functions/api/contact.js`.
- [ ] Si se usa Cloudflare: configurar SSL *Full (strict)*, *Always Use HTTPS*, redirección `www` y, opcionalmente, Cloudflare Access para `/admin/*`.

### D. Código: pegar las claves públicas en `src/config/env.js`
- [ ] `SUPABASE_URL` y `SUPABASE_ANON_KEY` (clave **anon/publishable**, nunca la service_role)
- [ ] `TURNSTILE_SITE_KEY`
- [ ] `GA_MEASUREMENT_ID` real (si quieren analítica; el aviso de consentimiento ya está implementado)
- [x] `SITE_URL` configurada para `https://animalsfriends.github.io/Afriends`

### E. GitHub
- [ ] Cambiar el workflow o su configuración cuando se decida el hosting oficial. Hoy despliega a Cloudflare si hay credenciales.
- [ ] Actualizar manualmente la descripción del repositorio en GitHub.

## 🟡 Después de publicar (verificar en producción)
- [ ] Enviar un mensaje real por el formulario → aparece en el panel (pestaña Mensajes) y en Supabase.
- [ ] Probar que un envío con el campo trampa lleno responde "ok" pero **no** crea fila.
- [ ] Entrar a `/admin/`, cambiar un precio, guardar y ver el cambio en la página.
- [ ] https://securityheaders.com y https://pagespeed.web.dev después de resolver el hosting; GitHub Pages no aplica `_headers`.
- [ ] Search Console: verificar la propiedad **Prefijo de URL** con la etiqueta HTML y enviar `https://animalsfriends.github.io/Afriends/sitemap.xml`.
- [ ] GA4 → Tiempo real: aceptar cookies genera eventos; rechazar no envía nada.
- [ ] Crear/reclamar el Perfil de Negocio de Google (`GOOGLE_BUSINESS_PROFILE.md`) y pegar su enlace en el panel.
- [ ] Probar en un celular real (iPhone y Android): menú, cotizador, formulario, WhatsApp.

## 🧪 Lo que NO pude verificar desde aquí (hazlo en el primer despliegue)
- La ejecución real del workflow y el despliegue desde GitHub Pages o Cloudflare Pages.
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
