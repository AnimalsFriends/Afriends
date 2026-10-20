# Guía de configuración · Fase 4
Formulario con antispam, analítica con consentimiento y despliegue automático.

> **Importante:** esta guía documenta la configuración prevista. No confirma que los secretos estén definidos, que las migraciones estén aplicadas ni que el despliegue esté activo. Primero revisa los valores y el estado actual; no pegues secretos en el repositorio ni en conversaciones. No ejecutes SQL ni cambies configuración de producción sin revisar el impacto y contar con aprobación explícita.

Sigue el orden indicado y marca cada paso solo después de comprobarlo.

## Cómo funciona (en 30 segundos)
```
Visitante → formulario → /api/contact (Worker) → Supabase (tabla contact_requests)
                              │ valida · Turnstile · límites · guarda con clave secreta
GitHub (push a main) → Actions: build + auditoría + pruebas → wrangler deploy
Analítica (GA4): solo se carga si el visitante la acepta en el aviso de cookies
```
Capas antispam: trampa oculta (honeypot) · tiempo mínimo de llenado · Cloudflare Turnstile ·
espera entre envíos · máximo 3 mensajes por IP cada 10 min y 1 por teléfono cada 2 min · validación en el servidor.

---
## 1. Supabase: tabla de mensajes
1. Confirma que el proyecto seleccionado sea `BD-AnimalsFriends`.
2. Antes de ejecutar SQL, compara en modo de solo lectura el historial de migraciones y el esquema con `supabase/02_contact_requests.sql`; el archivo puede no representar el estado actual.
3. Presenta las diferencias y el plan de cambio para aprobación. Solo después de aprobar, prepara la tabla siguiendo el procedimiento del repositorio.
4. En **Project Settings → API**, identifica la Project URL y el tipo de clave de servidor vigente.
   ⚠️ Una clave de servidor puede dar acceso amplio: se configura únicamente como secreto del Worker. Nunca en el frontend, en el código versionado ni en GitHub como texto.

## 2. Cloudflare Turnstile (antispam gratis)
1. Cloudflare → **Turnstile** → *Add widget*.
2. Nombre: Animal Friends · Dominios: `afriends.petcommunity-133.workers.dev` (y `localhost` para pruebas) · Modo: **Managed**.
3. Copia la **Site key** (pública) a `src/config/env.js` → `TURNSTILE_SITE_KEY`.
4. Copia la **Secret key** para el paso 4.

## 3. Worker existente
El destino confirmado es `afriends.petcommunity-133.workers.dev`; el Worker se llama
`afriends` y su configuración está en `wrangler.jsonc`. No crees un proyecto Pages ni
un dominio personalizado.

El Worker publica estáticos desde `dist/` y el script `worker.js`. La ruta
`/api/contact` llama al manejador compartido `functions/api/contact.js`; no copies
`functions/` dentro de `dist/`.

## 4. Secretos de la Function (en Cloudflare)
Cloudflare → Workers & Pages → Worker **afriends** → **Settings → Variables and Secrets**. Antes de modificar valores, revisa los existentes y confirma el entorno correcto:

| Nombre | Tipo | Valor |
|---|---|---|
| `SUPABASE_URL` | Texto | Project URL del paso 1 |
| `SUPABASE_SERVICE_KEY` | **Secreto** | clave service_role / secret |
| `TURNSTILE_SECRET` | **Secreto** | Secret key del paso 2 |
| `IP_SALT` | **Secreto** | texto aleatorio largo: `openssl rand -hex 32` |

El código admite `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_KEY` como clave de servidor; confirma el nombre utilizado por la implementación y configura solo uno de forma consistente. Sin las variables necesarias, el formulario debe fallar de forma segura. No cambies secretos en producción durante una inspección.

## 5. GitHub Actions (despliegue continuo)
Repositorio → **Settings → Secrets and variables → Actions**. La guía no puede confirmar si estos valores ya existen; comprueba su presencia sin revelar sus contenidos:

| Nombre | Dónde | Valor |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Cloudflare → My Profile → API Tokens → *Create* → permiso para desplegar Workers |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Cloudflare → Workers & Pages → panel derecho |
| `SITE_URL` | Variable | `https://afriends.petcommunity-133.workers.dev` (sin barra final) |

Flujo resultante:
- **Pull Request** → build, auditoría y pruebas; no despliega.
- **Push a `main`** o ejecución manual en `main` → build + despliegue del Worker de producción, si se cumplen las condiciones del workflow.
- Si una prueba o la auditoría fallan, **no se despliega**.
- Sin token, Account ID o `SITE_URL`, el workflow avisa y omite el despliegue.
- Confirma en la ejecución de Actions si el job de despliegue corrió o fue omitido; no lo deduzcas solo de la configuración.
- Antes de desplegar, el workflow rechaza `SITE_URL` distinta del hostname confirmado y una Site Key de Turnstile de prueba.

## 6. Google Analytics 4 (opcional hasta tener dominio)
1. analytics.google.com → crear propiedad → flujo de datos **Web** → copia el **ID de medición** (`G-XXXXXXXXXX`).
2. Pégalo en `src/config/env.js` → `GA_MEASUREMENT_ID`. Con eso aparece el aviso de cookies y el botón "Configurar cookies".
3. En GA4 → Administrar → **Eventos** → marca como *evento clave*: `generate_lead` (formulario enviado) y `whatsapp_click` (clic en WhatsApp, con el parámetro `location`: flotante, encabezado, pie, servicios, formulario).
4. Vincula Search Console (Administrar → Vinculaciones de productos).

Sin ID: no hay aviso de cookies ni se carga nada de Google.

## 7. Probar en tu computador

Para probar el sitio, usa el servidor local en lugar de abrir los archivos HTML con `file://`. Los comandos siguientes empaquetan el sitio y arrancan Wrangler local; no ejecutan migraciones de Supabase.

```
cp .dev.vars.example .dev.vars     # y completa los valores
npm run dev:worker                 # sirve el Worker y los estáticos con Wrangler
npm run check                      # build + empaquetado + auditoría del dist + pruebas
```
El archivo de ejemplo usa valores de prueba: no los copies a producción.

## 8. Ver los mensajes recibidos
Desde el panel (`/admin/` → pestaña **Mensajes**) o en Supabase → **Table Editor → contact_requests**. Cambia `estado` a *contactado* o *cerrado* al atenderlos.
Conviene revisar la tabla a diario o activar una notificación (ver "Siguientes pasos").
Retención: borra los mensajes de más de 24 meses (consulta al final del SQL).

## 9. Lista de verificación antes de publicar
- [ ] Proyecto objetivo y esquema Supabase comparados en modo de solo lectura
- [ ] Cambios SQL revisados y aprobados antes de ejecutarlos
- [ ] `02_contact_requests.sql` aplicado solo después de confirmar que hace falta y con el correo real
- [ ] Variables y secretos requeridos configurados en el Worker `afriends`
- [ ] `TURNSTILE_SITE_KEY` real en `env.js`
- [ ] Envío de prueba real: aparece la fila en `contact_requests`
- [ ] Envío con el campo trampa lleno (desde la consola): responde "ok" pero **no** crea fila
- [ ] Datos legales completos (ver `DATOS_PENDIENTES_CLIENTE.md`) y revisión de un asesor legal
- [ ] Si usas GA4: aceptar → llegan eventos en *Tiempo real*; rechazar → no llega nada
- [ ] Cabeceras en https://securityheaders.com y velocidad en https://pagespeed.web.dev

## Siguientes pasos sugeridos (fuera de la Fase 4)
- Aviso al dueño por cada mensaje nuevo (correo o WhatsApp) con un Webhook de Supabase.
- Revisar `CHECKLIST_PUBLICACION.md` para el estado final.
