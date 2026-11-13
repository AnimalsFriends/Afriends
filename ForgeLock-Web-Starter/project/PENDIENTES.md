# Pendientes — Animals Friends

## Avances locales — 13 de noviembre de 2026

- [x] Carrusel: CTA contextual por servicio, imágenes de hero coherentes y ajuste responsive.
- [x] Tarjetas: fotos ilustrativas proporcionadas para Baños, Colegio, Hotel y Peluquería; iconos existentes en el cotizador y enlace de cotización conservado.
- [x] Cotizador: total, cotización sola y subtotal mixto distinguen precio gratis explícito de precio ausente.
- [x] Panel: navegación lateral/plegable, nombre desde perfil con respaldo de Auth/correo y cita con foto o marcador.
- [x] WhatsApp: prueba de emoji, tildes, saltos, `&` y `+` en el parámetro `text`, sin enviar mensajes.
- [x] `npm run check` y revisión responsive con navegador local; informe y capturas en `docs/QA_mejoras_publico_panel_2026-11-13.md` y `artifacts/qa/`.
- [ ] Comparar con la captura de referencia (no llegó adjunta) y verificar la cuenta/rol/RLS y fotos reales de mascotas en un entorno Supabase autorizado.

## Avances locales — 11 de noviembre de 2026

- [x] Proteger el borrador de Gestión al intentar cambiar de pestaña.
- [x] Separar el estado pendiente de los formularios de gastos, cobros y abonos.
- [x] Evitar que una respuesta antigua de sincronización de rutas borre una acción local más reciente; conservar el último estado pendiente al recargar y permitir reintento.
- [x] Limitar la limpieza de cola offline a la cuenta que cierra sesión y aclarar mensajes de permisos/configuración en los módulos administrativos.
- [x] Añadir `srcset` y `sizes` a las tres imágenes del carrusel.
- [x] Pruebas focalizadas de regresión; el build local pasó antes del último cambio de imágenes y el servidor local respondió HTTP 200 después de ese cambio.
- [ ] Suite completa limpia: última ejecución, 250/254. Revisar cuatro fallos en `ForgeLock-Web-Starter/tests/structure.test.mjs`, `tests/operacionEmpleadoMigration.test.mjs` y `tests/permissions.test.mjs`.
- [ ] Validación completa del panel en móvil y escritorio; la comprobación responsive del navegador hasta ahora cubrió el sitio público, no todos los flujos administrativos.

## Antes de declarar lista la web pública

- [ ] Confirmar datos comerciales: nombre oficial, WhatsApp, correo, horarios, servicios y precios.
- [ ] Recibir razón social/titular, NIT o cédula, dirección y responsable de datos personales.
- [ ] Confirmar si atiende gatos y modalidad (local, domicilio o ambas).
- [ ] Recibir redes y enlace de Google Business Profile, si existen.
- [ ] Recibir fotos reales de clientes/mascotas con autorización (las fotos ilustrativas de servicios no se presentan como fotos reales).
- [ ] Obtener revisión profesional de aviso legal y políticas.
- [ ] Confirmar URL canónica y último despliegue en GitHub Actions y Cloudflare.
- [ ] Confirmar resultado de build, auditoría y pruebas de la ejecución correspondiente.
- [ ] Revisar Search Console: Diego reporta páginas indexadas y sitemap rastreado con 4 páginas el 11 nov 2026; comprobar propiedad, fecha y cobertura actual.
- [ ] Hacer revisión GEO de acceso de buscadores con IA, contenido, entidades, datos estructurados y citabilidad; registrar qué se observó sin prometer inclusión.

## Antes de operar integraciones y panel con datos reales

- [ ] Confirmar en modo de solo lectura el proyecto Supabase correcto, esquema, migraciones aplicadas, funciones, RLS y buckets.
- [ ] Probar permisos de admin y empleado con cuentas de prueba.
- [ ] Confirmar variables y secretos requeridos en Cloudflare/GitHub sin mostrar sus valores.
- [ ] Probar formulario, Turnstile y guardado de mensajes en entorno controlado.
- [ ] Resolver discrepancia de GA4: Diego indica Analytics verificada y que falta Tag; el código contiene un ID en `src/config/env.js`, pero el README afirma que no hay ID real. Precisar si falta Google tag, GTM o ambos; confirmar titularidad, vigencia y consentimiento.
- [ ] Verificar inicio/cierre de sesión, sesión expirada y módulos operativos en entorno autorizado.
- [ ] Levantar con administrador y empleados las tareas más difíciles o lentas del panel; convertirlas en requisitos y prioridades antes de rediseñar o programar.

## Para cada cambio de desarrollo

- [ ] Definir alcance y archivos afectados antes de editar.
- [ ] Verificar comportamiento existente y cubrir regresiones con pruebas disponibles.
- [ ] Actualizar esta lista, `DECISIONES.md` y `PLAN.md` cuando cambie el estado.

Las listas detalladas y pasos operativos están en `../CHECKLIST_PUBLICACION.md`, `../DATOS_PENDIENTES_CLIENTE.md`, `../supabase/README.md` y `../src/admin/README.md`.
