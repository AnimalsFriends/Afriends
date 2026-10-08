# Animal Friends · plataforma web

Sitio estático (HTML + CSS + JavaScript moderno) con datos en Supabase.
Hoy está publicado en **GitHub Pages** en `https://animalsfriends.github.io/Afriends/`.
El repositorio también conserva una Function y un flujo de despliegue para Cloudflare Pages; no son el mismo entorno.

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

## Publicación y despliegue
La publicación actual es GitHub Pages. La URL configurada para SEO es
`https://animalsfriends.github.io/Afriends` (sin barra final); el build conserva la ruta
`/Afriends/` y usa páginas `.html`, como requiere este hosting.

El workflow `.github/workflows/ci-cd.yml` todavía apunta a Cloudflare Pages cuando tiene
credenciales configuradas. **No lo cambies ni ejecutes un despliegue hasta decidir cuál
será el hosting oficial**: GitHub Pages no ejecuta `functions/api/contact.js`, mientras
que Cloudflare Pages sí puede hacerlo. Por eso el formulario servidor `/api/contact`
requiere Cloudflare Pages o una API equivalente; esta diferencia sigue pendiente de
resolver y probar en producción.

GitHub Pages tampoco aplica `_headers`; por tanto sus cabeceras de seguridad no se
configuran con ese archivo. Si el sitio se migra a Cloudflare Pages, configura el dominio,
`SITE_URL`, los secretos y las reglas descritas en `GUIA_FASE4_CONFIGURACION.md`.

## Base de datos del panel (Fase 1)
El panel de gestión de la guardería (dueños, mascotas, rutas del colegio, hotel, agenda, gastos y cartera)
se apoya en Supabase. La Fase 1 dejó listo el modelo de datos y la seguridad:
tablas nuevas, roles `admin` y `empleado` (tabla `empleados`) y RLS en todas las tablas; el empleado no puede
ver nada de dinero. Las pantallas de operación se agregan por fases.
Todo el detalle, cómo aplicarlo y cómo deshacerlo está en **`supabase/README.md`**.
Las migraciones nuevas están en `supabase/migrations/` y cada una tiene su rollback en `supabase/rollbacks/`.

## Dueños y mascotas en el panel (Fase 2)
La pestaña **Dueños y mascotas** de `/admin/` permite registrar dueños (con contacto de emergencia y personas
autorizadas a recoger) y sus perros: datos, comida, si es bravo o está enfermo, medicamentos, vacunas con vencimiento y foto.
Cada ficha se guarda al momento y nada se borra de verdad (se desactiva). Requiere haber aplicado la Fase 1 y
tener el usuario admin creado en `empleados`. La migración de Fase 2 también revoca `DELETE` para dueños y mascotas
en sesiones autenticadas, para que no se pueda saltar la desactivación con una llamada directa. El detalle, cómo
probarlo y lo pendiente está en **`src/admin/README.md`**.

## Rutas del colegio y hotel (Fase 3)
La pestaña **Rutas y hotel** permite armar los recorridos independientes de recogida y entrega, agrupar paradas por localidad
y moverlas a mano, asignar un empleado, registrar planes y ausencias, y seguir estados diarios. El servicio de cada perro
se calcula con el plan del colegio, sus ausencias y reservas de hotel; no se guarda un servicio fijo en su ficha. Una reserva
puede marcarse **Hotel + colegio** si el perro tiene plan ese día. El hotel muestra calendario, entradas, salidas, ocupación
y cupos: inicia con los 50 confirmados, editables más adelante. La validación de cupo y de reservas cruzadas también corre
en Supabase para evitar sobreventa concurrente. Las localidades se ordenan a mano; la sugerencia geográfica sigue pendiente
de elegir un proveedor de distancias. La migración de esta fase aún no se ha aplicado a una instancia real: instrucciones y
límites de la prueba están en **`supabase/README.md`** y **`src/admin/README.md`**.

## Agenda y planeación (Fase 4)
La pestaña **Agenda y planeación** ofrece vista de día, semana y mes. Registra citas con perro, servicio, empleado,
hora de inicio y fin, estado y notas; avisa si se cruza otra cita del mismo perro o empleado, pero deja al admin decidir
si continúa. Las reservas de hotel ocupan todas sus noches en el calendario. Desde una cita se abre WhatsApp con un texto
preparado para confirmar o recordar al dueño. La planeación cuenta los perros con colegio para el día y calcula los
empleados requeridos por recorrido. Cada ruta tiene una capacidad propia: como puede variar, no se asigna un valor común;
si falta capacidad o una parada de recogida, el panel lo indica en vez de inventar un cálculo.

## Cotizador y panel de administración
- **Cotizador** (`#cotizador`): la lógica vive en `src/models/QuoteModel.js` (pura y probada): precio fijo, por días y por noches,
  total, y mensaje de WhatsApp (los nombres se limpian para que no alteren el formato). Pestañas accesibles con teclado
  (flechas, Inicio, Fin), resumen en vivo y botón de WhatsApp que es un **enlace real** (no lo bloquean los navegadores).
  Las tarjetas de servicios tienen "Cotizar este servicio", que abre la categoría correspondiente.
- **Panel** (`/admin/`, ver `GUIA_PANEL_ADMIN.md`): edita negocio, datos legales, horarios, redes, servicios, precios y tarjetas;
  publica en Supabase y el sitio lo refleja. Pestaña **Mensajes** con los contactos del formulario (filtros, estado, enlace a WhatsApp).
  Renueva la sesión sola, conserva los cambios sin guardar si la sesión vence y trabaja en "modo descarga" si no hay Supabase.
- Todo cumple la CSP estricta (sin estilos ni scripts en línea) y la auditoría revisa también el panel.

**Antes de publicar:** sigue `CHECKLIST_PUBLICACION.md` (qué falta, en orden).

## Formulario, analítica y despliegue
Todo el paso a paso está en **`GUIA_FASE4_CONFIGURACION.md`**. Resumen:
- **Formulario de contacto** (`#formulario` en la home): validación en el navegador y, sobre todo, en la **Cloudflare Function**.
  Antispam en capas: honeypot, tiempo mínimo de llenado, **Cloudflare Turnstile**, espera entre envíos y límites por IP (hash) y teléfono.
  Los mensajes se guardan en Supabase (`supabase/02_contact_requests.sql`) sin exponer ninguna clave en el navegador.
  Guarda la autorización de datos y la versión de la política aceptada. Si algo falla, el visitante siempre tiene salida por WhatsApp.
- **Analítica GA4 con consentimiento**: no se carga nada de Google hasta que el visitante acepte; aceptar y rechazar pesan igual;
  "Configurar cookies" en el pie permite cambiar la decisión. Sin `GA_MEASUREMENT_ID` no hay aviso ni analítica.
  Eventos: `generate_lead` y `whatsapp_click` (con la ubicación del botón).
- **CI/CD**: cada PR y push a `main` ejecuta build, auditoría y pruebas. El workflow de despliegue que hay hoy apunta a Cloudflare Pages, no a la publicación actual de GitHub Pages.
- **CSP** ampliada solo con lo necesario: Cloudflare Turnstile y Google Analytics.

## SEO, rendimiento y seguridad (auditoría del sitio público)

**Comandos** (Node ≥ 18, sin instalar paquetes):

| Comando | Qué hace |
|---|---|
| `node scripts/build.mjs` | Genera `sitemap.xml`, `robots.txt`; inyecta canonical, Open Graph, Twitter Cards, JSON-LD y `modulepreload` en el `<head>` |
| `node scripts/audit.mjs` | Revisa enlaces rotos, anclas, imágenes sin `alt`, título/descripción, un solo `h1`, JSON-LD válido y que no haya código en línea (CSP) |
| `npm run check` | Las dos anteriores seguidas (úsalo antes de cada `git push`) |

- **URL del sitio:** `src/config/env.js` tiene la URL pública actual de GitHub Pages. Si se usa un dominio propio,
  configura `SITE_URL` en el entorno de build. El generador mantiene la ruta base `/Afriends/` y usa `.html`
  para que canonical, Open Graph y sitemap apunten a URLs servidas por GitHub Pages.
- **Datos estructurados:** `LocalBusiness` + `WebSite` en la home (con servicios y "precio desde" tomados de los datos),
  `WebPage` + migas de pan en las páginas legales. Solo se incluye lo que existe: dirección, correo y redes
  aparecen cuando se llenan. Si el panel publica datos nuevos en Supabase, la home actualiza su JSON-LD.
- **Rendimiento:** logo en WebP (8 KB), `modulepreload` de los 16 módulos (evita la cascada de peticiones),
  precarga del logo, espacio reservado para las tarjetas (CLS), fuentes del sistema y cero scripts de terceros.
  Medición local de la home: ~65 KB en total, LCP ≈ 160 ms, CLS = 0. Son medidas de laboratorio sin red real:
  verifica con https://pagespeed.web.dev una vez publicada.
- **URLs:** el sitio publicado en GitHub Pages usa sus nombres de archivo (`/Afriends/aviso-legal.html`).
  El sitemap, canonical, Open Graph y JSON-LD se generan con la ruta base `/Afriends/`.

**Ajustes del hosting** (no se pueden poner en el código):
En GitHub Pages, `robots.txt` y `sitemap.xml` se publican como archivos estáticos. El archivo
`_headers` no configura cabeceras en ese hosting. Si se migra a Cloudflare Pages, entonces:
1. *SSL/TLS → Overview*: modo **Full (strict)**.
2. *SSL/TLS → Edge Certificates*: activar **Always Use HTTPS** y **Automatic HTTPS Rewrites**; mínimo TLS **1.2**.
3. HSTS ya se envía desde `_headers`. Si luego quieres *preload*, primero verifica que todos los subdominios usen HTTPS.
4. *Rules → Redirect Rules*: redirige `www` → dominio principal (o al revés) para evitar contenido duplicado.
5. Compresión Brotli y HTTP/3 vienen activadas por defecto.

**Google:** el tag de verificación de Search Console está en la página de inicio. Sigue
`GOOGLE_BUSINESS_PROFILE.md` para verificar la propiedad URL-prefix y configurar el Perfil de Negocio.

**Pendiente SEO:** no tenemos el ID real de GA4, por eso la analítica permanece desactivada.
La razón social, el NIT y la dirección completa siguen vacíos en la configuración; la página
legal marca esos campos para completar. Un asesor legal debe revisar los textos antes de publicar.
La verificación de Google usa la etiqueta HTML ya puesta en la home.
La descripción del repositorio se cambia desde GitHub (no forma parte de los archivos); una opción
coherente es: “Sitio web de Animal Friends, guardería canina con colegio, hotel y servicios para mascotas”.

## Datos legales: completar antes de publicar
Las páginas de **Aviso legal** y **Política de privacidad** muestran marcadores amarillos
`[Completar: ...]` hasta que llenes estos campos en `src/config/site.defaults.js` (sección `negocio`):

`razonSocial` · `nit` · `direccion`

El correo, teléfono y ubicación visibles ya tienen valores en `src/config/site.defaults.js`;
confírmalos antes de considerar publicados los textos legales. Los datos que faltan se piden
con `DATOS_PENDIENTES_CLIENTE.md` (listo para enviarle).
Los textos legales son un **documento base** (Ley 1581 de 2012 y Decreto 1377 de 2013, Colombia):
haz que un asesor legal los revise. La Política de cookies y el aviso se muestran según la
configuración de GA4; falta el ID real para activar y probar esa ruta.

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
