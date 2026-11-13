# QA local: mejoras de página pública y panel

**Revisión:** 13 de noviembre de 2026
**Alcance:** aplicación web pública y panel de administración en local. No se ejecutaron migraciones ni se enviaron mensajes. La subida a `main` activa el workflow de despliegue Cloudflare.

El entorno llegó sin checkout ni captura de referencia adjunta. Se recuperó el repositorio `AnimalsFriends/Afriends` desde `main` con un árbol inicial limpio; las capturas “antes” reconstruyen esa revisión inicial, no una captura entregada por el usuario.

## Resultados por flujo

| Flujo | Resultado esperado | Resultado observado |
|---|---|---|
| Carrusel | Cada diapositiva muestra una imagen y dirige a WhatsApp con el servicio de esa diapositiva en etiqueta y mensaje. | Verificado en navegador local para Colegio, Hotel y Baños. El `text` decodificado conserva servicio, saludo con 🐾, tildes y saltos de línea. No se abrió ni envió ningún mensaje. |
| Aviso de cookies | Aceptar y rechazar guardan cada opción; el aviso no cubre el CTA principal en móvil. | Ambas opciones se probaron y ocultaron el aviso. En móvil el aviso ocupa flujo al inicio de la página; después de acortar el texto, el CTA del hero queda completo en el viewport de 390×844. |
| Tarjetas de servicios | Fotos ilustrativas consistentes, sin emoji, enlace “Cotizar este servicio” y precio coherente. | Se integraron las cuatro imágenes proporcionadas (Baños, Colegio, Hotel y Peluquería) con recorte uniforme y texto alternativo que las identifica como ilustrativas. “Por cotizar” no aparece como precio en las tarjetas quote-only; se conserva el enlace. |
| Categorías del cotizador | Mostrar el nombre y el icono local de `img/icon`. | Verificado en captura de cotizador móvil; nombres visibles, iconos desde los recursos existentes. |
| Totales | Total si todos tienen precio aplicable; esconderlo si no hay selección o todo queda por cotizar; mostrar subtotal y pendientes en mezcla; gratis explícito cuenta como $0. | Verificados en navegador con catálogo de prueba: precio fijo, cotización sola y pedido mixto. Las pruebas unitarias además cubren precio gratis explícito (`0`) frente a precio ausente (`null`). |
| Navegación del panel | En escritorio, barra lateral con selección activa; en móvil, menú plegable; permisos y accesos actuales se conservan. | Capturas con sesión admin ficticia y respuestas de lectura simuladas: barra activa en desktop y menú abierto/cerrado en móvil. El rol no altera las reglas existentes. |
| Nombre del usuario | Priorizar `empleados.nombre`, usar metadata de Auth y luego correo como respaldo. | Verificado con nombre de perfil en la captura mock y con pruebas para perfil ausente y correo de respaldo. No se usó una cuenta real. |
| Agenda y fotos | Nombre, foto o marcador, servicio y detalles autorizados por RLS; cada foto asociada a su mascota. | La proyección de agenda ahora pide `foto_path` para las mascotas devueltas por las consultas de admin/empleado. Se verificó visualmente el marcador sin foto y con pruebas de vista tanto con foto como sin ella. Las descargas se asocian por ID de mascota y los fallos quedan en el marcador. |
| Mensajes de WhatsApp | Preservar emoji, tildes, `&`, `+` y líneas en `text`; no enviar mensajes. | Prueba unitaria decodifica el parámetro final y verifica todos esos caracteres. No se abrió WhatsApp ni se envió ningún mensaje. |

## Consulta y permisos de Agenda

Las consultas actuales de admin ya obtenían mascota, nombre, dueño y cita, pero la lista de mascotas no solicitaba `foto_path`. La proyección del empleado tampoco solicitaba ese campo. La columna `mascotas.foto_path` ya está declarada en la migración `20261007100100_fase1_duenos_y_mascotas.sql`, y las fotos usan el bucket privado existente `fotos-mascotas`.

Se amplió la selección de esa columna y se usa el descargador autenticado que ya existe en `GestionApi`. Si una instancia devuelve un error de esquema, se reintenta la proyección anterior sin fotos y se muestra el marcador. No hizo falta preparar una migración ni cambiar permisos: las consultas siguen filtradas por las políticas RLS de las filas autorizadas y los bytes se descargan con la sesión. El comportamiento efectivo de RLS, el bucket y las cuentas reales requiere comprobarse en el proyecto Supabase autorizado; no se consultó ni modificó Supabase remoto.

## Validación automatizada

- `npm run check`: **build y auditoría correctos; 272/272 pruebas pasaron**. La primera corrida después de integrar los assets falló solo porque una aserción esperaba el texto viejo del placeholder; se actualizó y la suite completa volvió a pasar.
- Navegador Playwright local: **desktop 1440×1100, tablet 820×1100 y móvil 390×844**. Interacciones: 3 CTA del carrusel, consentimiento aceptar/rechazar, cotizador con precio/cotización/mixto y agenda demo con perfil y sin foto.
- Pruebas focalizadas añadidas para sincronización de CTA, nombre/fallback, fotos de agenda y codificación Unicode de WhatsApp.

## Capturas locales

“Antes” corresponde a `HEAD` inicial reconstruido en un directorio temporal. Las capturas de agenda usan datos mock de solo lectura y no contienen datos de clientes. La foto real pendiente se representa con el marcador de ausencia.

- Antes: [portada desktop](../artifacts/qa/before/home-desktop.png) · [portada móvil](../artifacts/qa/before/home-mobile.png) · [agenda desktop con mock](../artifacts/qa/before/admin-agenda-desktop-mock.png)
- Después: [portada desktop](../artifacts/qa/after/home-desktop.png) · [tablet](../artifacts/qa/after/home-tablet.png) · [móvil](../artifacts/qa/after/home-mobile.png)
- Servicios: [tarjetas desktop](../artifacts/qa/after/services-cards-desktop.png) · [cotizador móvil](../artifacts/qa/after/services-quote-mobile.png) · [resumen mixto](../artifacts/qa/after/services-quote-summary-mobile.png)
- Tarjetas con fotos: [tablet](../artifacts/qa/after/services-cards-tablet.png) · [móvil](../artifacts/qa/after/services-cards-mobile.png). Las cuatro imágenes cargaron correctamente en ambos tamaños; el chequeo hizo scroll a cada foto para activar carga diferida.
- Panel: [agenda desktop con mock](../artifacts/qa/after/admin-agenda-desktop-mock.png) · [menú móvil abierto con mock](../artifacts/qa/after/admin-agenda-mobile-menu-open-mock.png)
- [Revisión de servicios por diapositiva](../artifacts/qa/after/carousel-check.json)

## Pendientes para desbloquear QA externo

1. Adjuntar la captura de composición mencionada en el requerimiento para cotejarla con el diseño final.
2. Las imágenes ilustrativas de servicios ya están integradas. Para fotos reales de mascotas/clientes, solicitar autorización y confirmar el permiso de publicación.
3. Probar una cuenta admin y otra de empleado en un entorno autorizado para confirmar nombres, RLS y descarga de fotos reales.
4. Confirmar permisos del bucket privado `fotos-mascotas` en el proyecto Supabase correcto.

## Vista previa local

Con el servidor de desarrollo activo: `http://localhost:4173/`. El panel está en `http://localhost:4173/admin/`. El servidor corre en este entorno local y no es un despliegue.
