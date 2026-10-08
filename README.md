# Animal Friends · plataforma web

Sitio estático (HTML + CSS + JavaScript moderno) con datos en Supabase.
Hosting recomendado: **Cloudflare Pages** conectado a este repositorio de GitHub.

## Arquitectura (MVC para frontend)

```
animal-friends/
├─ index.html · aviso-legal.html · politica-privacidad.html · politica-cookies.html · 404.html
├─ admin/index.html              ← panel privado del dueño (noindex, protegido con login)
├─ _headers                      ← cabeceras de seguridad (CSP, HSTS, X-Frame-Options...)
├─ robots.txt · sitemap.xml      ← los genera scripts/build.mjs (sitemap solo si hay SITE_URL)
├─ functions/api/contact.js      ← Cloudflare Function del formulario (antispam + Supabase)
├─ tests/                        ← pruebas automáticas (node --test)
├─ .github/workflows/ci-cd.yml   ← CI/CD: build + auditoría + pruebas + despliegue
├─ package.json                  ← scripts: build · audit · test · check · package · dev
├─ scripts/  build.mjs · audit.mjs · package.mjs ← SEO + preload / auditoría / empaquetado (dist/)
├─ assets/
│  ├─ css/  tokens · base · components · layout · admin
│  └─ img/  logos en WebP + favicon
├─ src/
│  ├─ main.js                    ← punto de entrada (todas las páginas)
│  ├─ config/  env.js · site.defaults.js
│  ├─ admin/                     ← panel: models · services · views · controllers (ver src/admin/README.md)
│  ├─ shared/contactSchema.js    ← validación del formulario (la usan navegador y Function)
│  ├─ seo/structuredData.js      ← JSON-LD (mismo código en build y navegador)
│  ├─ services/supabase.js       ← cliente REST sin librerías
│  ├─ models/   SiteConfig · Quote · Contact · Consent ← M: datos, cotizador, validación y consentimiento
│  ├─ views/    Header · Footer · WhatsAppFloat · Services · Quote · ContactForm · ConsentBanner ← V: HTML (funciones puras)
│  ├─ controllers/ Layout · Home · Seo · Quote · Contact · Analytics ← C: conectan modelos con vistas
│  └─ utils/    dom · format · whatsapp
└─ supabase/01_site_config.sql
```

**Flujo:** `main.js` pinta header/footer al instante con datos locales → pide los datos a Supabase
(con respaldo local si falla) → actualiza → monta las secciones de la página.

## Ejecutarlo en tu computador
Usa módulos ES: no abre con doble clic. En VS Code usa **Live Server**, o `npx serve .`.
Con `?debug=1` en la dirección ves si los datos vienen de Supabase o de los valores locales.

## Desplegar en Cloudflare Pages (recomendado)
1. Sube el proyecto a un repositorio de GitHub.
2. Cloudflare → Workers & Pages → Create → Pages → *Connect to Git* → elige el repositorio.
3. **Recomendado: despliegue con GitHub Actions** (`.github/workflows/ci-cd.yml`): sigue `GUIA_FASE4_CONFIGURACION.md`.
   Alternativa sin Actions: Framework preset **None** · Build command `node scripts/build.mjs` · Output directory `/`,
   y la variable `SITE_URL`. (Con Git directo, la carpeta `functions/` también se despliega sola.)
4. Cloudflare aplica `_headers`, sirve `404.html` y ejecuta `functions/api/contact.js` automáticamente.
5. Conecta tu dominio en *Custom domains* (HTTPS automático) y verifica las cabeceras en https://securityheaders.com

> Si más adelante usas GitHub Actions (Fase 4), el despliegue puede hacerse con `wrangler` desde el workflow.

## Base de datos del panel (Fase 1)
El panel de gestión de la guardería (dueños, mascotas, rutas del colegio, hotel, agenda, gastos y cartera)
se apoya en Supabase. La Fase 1 deja listo el modelo de datos y la seguridad:
tablas nuevas, roles `admin` y `empleado` (tabla `empleados`) y RLS en todas las tablas; el empleado no puede
ver nada de dinero. Aún **no hay pantallas nuevas**: eso viene en las siguientes fases.
Todo el detalle, cómo aplicarlo y cómo deshacerlo está en **`supabase/README.md`**.
Las migraciones nuevas están en `supabase/migrations/` y cada una tiene su rollback en `supabase/rollbacks/`.

## Dueños y mascotas en el panel (Fase 2)
La pestaña **Dueños y mascotas** de `/admin/` permite registrar dueños (con contacto de emergencia y personas
autorizadas a recoger) y sus perros: datos, comida, si es bravo o está enfermo, medicamentos, vacunas con vencimiento y foto.
Cada ficha se guarda al momento y nada se borra de verdad (se desactiva). Requiere haber aplicado la Fase 1 y
tener el usuario admin creado en `empleados`. El detalle, cómo probarlo y lo pendiente está en **`src/admin/README.md`**.

## Cotizador y panel de administración (Fase 5)
- **Cotizador** (`#cotizador`): la lógica vive en `src/models/QuoteModel.js` (pura y probada): precio fijo, por días y por noches,
  total, y mensaje de WhatsApp (los nombres se limpian para que no alteren el formato). Pestañas accesibles con teclado
  (flechas, Inicio, Fin), resumen en vivo y botón de WhatsApp que es un **enlace real** (no lo bloquean los navegadores).
  Las tarjetas de servicios tienen "Cotizar este servicio", que abre la categoría correspondiente.
- **Panel** (`/admin/`, ver `GUIA_PANEL_ADMIN.md`): edita negocio, datos legales, horarios, redes, servicios, precios y tarjetas;
  publica en Supabase y el sitio lo refleja. Pestaña **Mensajes** con los contactos del formulario (filtros, estado, enlace a WhatsApp).
  Renueva la sesión sola, conserva los cambios sin guardar si la sesión vence y trabaja en "modo descarga" si no hay Supabase.
- Todo cumple la CSP estricta (sin estilos ni scripts en línea) y la auditoría revisa también el panel.

**Antes de publicar:** sigue `CHECKLIST_PUBLICACION.md` (qué falta, en orden).

## Formulario, analítica y despliegue (Fase 4)
Todo el paso a paso está en **`GUIA_FASE4_CONFIGURACION.md`**. Resumen:
- **Formulario de contacto** (`#formulario` en la home): validación en el navegador y, sobre todo, en la **Cloudflare Function**.
  Antispam en capas: honeypot, tiempo mínimo de llenado, **Cloudflare Turnstile**, espera entre envíos y límites por IP (hash) y teléfono.
  Los mensajes se guardan en Supabase (`supabase/02_contact_requests.sql`) sin exponer ninguna clave en el navegador.
  Guarda la autorización de datos y la versión de la política aceptada. Si algo falla, el visitante siempre tiene salida por WhatsApp.
- **Analítica GA4 con consentimiento**: no se carga nada de Google hasta que el visitante acepte; aceptar y rechazar pesan igual;
  "Configurar cookies" en el pie permite cambiar la decisión. Sin `GA_MEASUREMENT_ID` no hay aviso ni analítica.
  Eventos: `generate_lead` y `whatsapp_click` (con la ubicación del botón).
- **CI/CD**: cada PR y push a `main` ejecuta build, auditoría y las pruebas automáticas; si pasan, despliega a Cloudflare Pages (vista previa en PRs).
- **CSP** ampliada solo con lo necesario: Cloudflare Turnstile y Google Analytics.

## SEO, rendimiento y seguridad (Fase 3)

**Comandos** (Node ≥ 18, sin instalar paquetes):

| Comando | Qué hace |
|---|---|
| `node scripts/build.mjs` | Genera `sitemap.xml`, `robots.txt`; inyecta canonical, Open Graph, Twitter Cards, JSON-LD y `modulepreload` en el `<head>` |
| `node scripts/audit.mjs` | Revisa enlaces rotos, anclas, imágenes sin `alt`, título/descripción, un solo `h1`, JSON-LD válido y que no haya código en línea (CSP) |
| `npm run check` | Las dos anteriores seguidas (úsalo antes de cada `git push`) |

- **Sin dominio no se inventa nada:** si `SITE_URL` está vacío, no se genera sitemap, canonical ni `og:image`
  (las redes sociales exigen URL absoluta). Al definirlo y volver a correr el build, todo se completa solo.
- **Datos estructurados:** `LocalBusiness` + `WebSite` en la home (con servicios y "precio desde" tomados de los datos),
  `WebPage` + migas de pan en las páginas legales. Solo se incluye lo que existe: dirección, correo y redes
  aparecen cuando se llenan. Si el panel publica datos nuevos en Supabase, la home actualiza su JSON-LD.
- **Rendimiento:** logo en WebP (8 KB), `modulepreload` de los 16 módulos (evita la cascada de peticiones),
  precarga del logo, espacio reservado para las tarjetas (CLS), fuentes del sistema y cero scripts de terceros.
  Medición local de la home: ~65 KB en total, LCP ≈ 160 ms, CLS = 0. Son medidas de laboratorio sin red real:
  verifica con https://pagespeed.web.dev una vez publicada.
- **URLs:** Cloudflare Pages quita el `.html` (`/aviso-legal.html` → `/aviso-legal`); por eso el sitemap y el canonical usan la forma sin extensión.

**Ajustes en el panel de Cloudflare** (no se pueden poner en el código):
1. *SSL/TLS → Overview*: modo **Full (strict)**.
2. *SSL/TLS → Edge Certificates*: activar **Always Use HTTPS** y **Automatic HTTPS Rewrites**; mínimo TLS **1.2**.
3. HSTS ya se envía desde `_headers`. Si luego quieres *preload*, primero verifica que todos los subdominios usen HTTPS.
4. *Rules → Redirect Rules*: redirige `www` → dominio principal (o al revés) para evitar contenido duplicado.
5. Compresión Brotli y HTTP/3 vienen activadas por defecto.

**Google:** sigue `GOOGLE_BUSINESS_PROFILE.md` (perfil de negocio y Search Console).

## Datos legales: completar antes de publicar
Las páginas de **Aviso legal** y **Política de privacidad** muestran marcadores amarillos
`[Completar: ...]` hasta que llenes estos campos en `src/config/site.defaults.js` (sección `negocio`):

`razonSocial` · `nit` · `direccion` · `ciudad` · `correo` · `telefonoVisible`

Los datos que faltan se piden al cliente con `DATOS_PENDIENTES_CLIENTE.md` (listo para enviarle).
Los textos legales son un **documento base** (Ley 1581 de 2012 y Decreto 1377 de 2013, Colombia):
haz que un asesor legal los revise. Cuando se instale analítica (Fase 4), actualiza la
Política de cookies y agrega el aviso de consentimiento.

## Color y accesibilidad
- Acento oficial **#D15638**. Blanco sobre #D15638 = 4.12:1, por eso:
  texto sobre terracota siempre en **blanco, negrita y ≥ 19px** (texto grande, AA ≥ 3:1).
  El texto pequeño nunca va en terracota (usa gris `#615951`, 6.48:1 sobre crema).
  Hover `#B8452B` (5.35:1).
- Enlaces: texto gris con subrayado terracota. Foco visible, enlace "saltar al contenido",
  objetivos táctiles ≥ 44px, `prefers-reduced-motion` respetado.
- Botón flotante de WhatsApp `#128C7E` (4.14:1 ≥ 3:1 para controles).

## Cabeceras de seguridad (`_headers`)
HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP y una **CSP estricta**
(`script-src 'self'`, `style-src 'self'`, `connect-src 'self' https://*.supabase.co`).
Si agregas Google Analytics u otro servicio externo, hay que ampliar la CSP (Fase 4).
Por la CSP no se permiten `style="..."` ni `<script>` en línea: usa clases CSS y módulos.
