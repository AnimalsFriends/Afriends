# Guía de configuración · Fase 4
Formulario con antispam, analítica con consentimiento y despliegue automático.
Hazla en este orden. Tiempo total estimado: 40–60 minutos.

## Cómo funciona (en 30 segundos)
```
Visitante → formulario → /api/contact (Cloudflare Function) → Supabase (tabla contact_requests)
                              │ valida · Turnstile · límites · guarda con clave secreta
GitHub (push a main) → Actions: build + auditoría + pruebas → despliegue a Cloudflare Pages
Analítica (GA4): solo se carga si el visitante la acepta en el aviso de cookies
```
Capas antispam: trampa oculta (honeypot) · tiempo mínimo de llenado · Cloudflare Turnstile ·
espera entre envíos · máximo 3 mensajes por IP cada 10 min y 1 por teléfono cada 2 min · validación en el servidor.

---
## 1. Supabase: tabla de mensajes
1. SQL Editor → New query → pega `supabase/02_contact_requests.sql`.
2. Cambia `CORREO_DEL_CLIENTE@ejemplo.com` (4 veces) por el correo del administrador y pulsa **Run**.
3. **Project Settings → API**: copia la **Project URL** y la clave **service_role** (o *secret*).
   ⚠️ Esa clave da acceso total: va **solo** como secreto en Cloudflare (paso 4). Nunca en el código ni en GitHub.

## 2. Cloudflare Turnstile (antispam gratis)
1. Cloudflare → **Turnstile** → *Add widget*.
2. Nombre: Animal Friends · Dominios: tu dominio (y `localhost` para pruebas) · Modo: **Managed**.
3. Copia la **Site key** (pública) a `src/config/env.js` → `TURNSTILE_SITE_KEY`.
4. Copia la **Secret key** para el paso 4.

## 3. Proyecto en Cloudflare Pages (una sola vez)
Crea el proyecto vacío para que Actions pueda desplegar en él:
```
npx wrangler login
npx wrangler pages project create animal-friends --production-branch=main
```
(o desde el panel: Workers & Pages → Create → Pages → *Direct Upload*). Anota el nombre del proyecto.
Luego conecta tu dominio en **Custom domains**.

## 4. Secretos de la Function (en Cloudflare)
Pages → tu proyecto → **Settings → Variables and secrets** (agrégalas en *Production* y *Preview*):

| Nombre | Tipo | Valor |
|---|---|---|
| `SUPABASE_URL` | Texto | Project URL del paso 1 |
| `SUPABASE_SERVICE_KEY` | **Secreto** | clave service_role / secret |
| `TURNSTILE_SECRET` | **Secreto** | Secret key del paso 2 |
| `IP_SALT` | **Secreto** | texto aleatorio largo: `openssl rand -hex 32` |

Sin estas cuatro, el formulario responde error 500 a propósito (no acepta mensajes sin protección).

## 5. GitHub Actions (despliegue continuo)
Repositorio → **Settings → Secrets and variables → Actions**:

| Nombre | Dónde | Valor |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Cloudflare → My Profile → API Tokens → *Create* → permiso **Account · Cloudflare Pages · Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Cloudflare → Workers & Pages → panel derecho |
| `CF_PAGES_PROJECT` | Variable | nombre del proyecto del paso 3 |
| `SITE_URL` | Variable | `https://tu-dominio.com` (sin barra final) |

Flujo resultante:
- **Pull Request** → build, auditoría y pruebas + despliegue de **vista previa**.
- **Push a `main`** → lo mismo + despliegue a **producción**.
- Si una prueba o la auditoría fallan, **no se despliega**.
- Sin credenciales el workflow no falla: solo avisa que omitió el despliegue.

## 6. Google Analytics 4 (opcional hasta tener dominio)
1. analytics.google.com → crear propiedad → flujo de datos **Web** → copia el **ID de medición** (`G-XXXXXXXXXX`).
2. Pégalo en `src/config/env.js` → `GA_MEASUREMENT_ID`. Con eso aparece el aviso de cookies y el botón "Configurar cookies".
3. En GA4 → Administrar → **Eventos** → marca como *evento clave*: `generate_lead` (formulario enviado) y `whatsapp_click` (clic en WhatsApp, con el parámetro `location`: flotante, encabezado, pie, servicios, formulario).
4. Vincula Search Console (Administrar → Vinculaciones de productos).

Sin ID: no hay aviso de cookies ni se carga nada de Google.

## 7. Probar en tu computador
```
cp .dev.vars.example .dev.vars     # y completa los valores
npm run dev:functions              # sirve el sitio + la Function en http://localhost:8788
npm run check                      # build + auditoría + pruebas
```
Con las claves de prueba de Turnstile del archivo de ejemplo el widget siempre aprueba.

## 8. Ver los mensajes recibidos
Desde el panel (`/admin/` → pestaña **Mensajes**) o en Supabase → **Table Editor → contact_requests**. Cambia `estado` a *contactado* o *cerrado* al atenderlos.
Conviene revisar la tabla a diario o activar una notificación (ver "Siguientes pasos").
Retención: borra los mensajes de más de 24 meses (consulta al final del SQL).

## 9. Lista de verificación antes de publicar
- [ ] `02_contact_requests.sql` ejecutado con el correo real
- [ ] 4 secretos configurados en Cloudflare
- [ ] `TURNSTILE_SITE_KEY` real en `env.js`
- [ ] Envío de prueba real: aparece la fila en `contact_requests`
- [ ] Envío con el campo trampa lleno (desde la consola): responde "ok" pero **no** crea fila
- [ ] Datos legales completos (ver `DATOS_PENDIENTES_CLIENTE.md`) y revisión de un asesor legal
- [ ] Si usas GA4: aceptar → llegan eventos en *Tiempo real*; rechazar → no llega nada
- [ ] Cabeceras en https://securityheaders.com y velocidad en https://pagespeed.web.dev

## Siguientes pasos sugeridos (fuera de la Fase 4)
- Aviso al dueño por cada mensaje nuevo (correo o WhatsApp) con un Webhook de Supabase.
- Revisar `CHECKLIST_PUBLICACION.md` para el estado final.
