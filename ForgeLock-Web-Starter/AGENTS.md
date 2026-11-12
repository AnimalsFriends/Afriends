# Guía de trabajo — ForgeLock Web Starter en Animals Friends

## Contexto y alcance
Esta carpeta adapta la plantilla ForgeLock Web Starter al proyecto existente **Animals Friends**. La aplicación activa está en la raíz del repositorio (`index.html`, `src/`, `admin/`, `functions/`, `supabase/`, `scripts/` y `tests/`). Esta carpeta es documentación y material de referencia; **no es una segunda copia de la aplicación**.

ForgeLock presta el servicio. Animals Friends conserva su propia marca y datos.

## Orden de lectura
1. `client/brief.md`, `client/company.md`, `client/brand.md` y `client/content.md`.
2. `project/DECISIONES.md`, `project/PENDIENTES.md`, `project/PLAN.md` y `project/MAPA-ADAPTACION.md`.
3. El `README.md` raíz y la documentación aplicable (`CHECKLIST_PUBLICACION.md`, `DATOS_PENDIENTES_CLIENTE.md`, `supabase/README.md`, `src/admin/README.md`).
4. Inspeccionar el estado actual de Git y el código real antes de cualquier cambio.

## Reglas específicas de este proyecto
- Preservar los avances existentes. No reemplazar la aplicación con el scaffold que vive dentro de esta carpeta.
- Para cambios funcionales, trabajar en los archivos del proyecto raíz y respetar sus módulos, convenciones, migraciones y pruebas existentes.
- No duplicar ni mover archivos de producción a `client/assets`. Allí solo van los originales de marca aportados por el cliente y recursos autorizados.
- Tratar `src/config/site.defaults.js`, `src/config/env.js`, migraciones y documentación como fuentes distintas: verificar cuál está vigente antes de inferir el estado de producción.
- Distinguir siempre entre **presente en el repositorio**, **aplicado en el servicio externo** y **verificado en producción**. El código o una migración versionada no demuestra por sí sola que esté activa.
- No inventar datos comerciales, legales, testimonios ni enlaces. Registrar faltantes como `PENDIENTE`.
- No alterar logos originales. Los activos de `client/assets/` se conservan como referencia; comprobar autorización antes de publicarlos.
- No revelar ni copiar secretos. Las claves públicas destinadas al navegador no son claves privadas, pero evitar repetir sus valores en documentos, informes o conversaciones.
- No ejecutar migraciones SQL, rollbacks, cambios de configuración de Supabase/Cloudflare/GitHub, despliegues, pushes, merges ni cambios DNS sin autorización explícita.
- No instalar dependencias ni cambiar el stack sin necesidad justificada y autorización.
- Respetar `noindex`/configuración local cuando corresponda; no abrir indexación ni publicar desde una vista previa local.

## Flujo de trabajo para continuar Animals Friends
1. Confirmar el objetivo concreto y leer el estado Git.
2. Revisar el comportamiento y los módulos existentes antes de editar.
3. Proponer el alcance mínimo y registrar decisiones o pendientes que cambien.
4. Implementar solo el cambio autorizado, evitando duplicar código.
5. Ejecutar las validaciones existentes cuando el usuario pida verificar o cuando el cambio lo requiera expresamente; informar qué quedó sin comprobar.
6. Mantener actualizados el plan y las evidencias sin presentar estados externos como confirmados.
7. Preparar vista previa o instrucciones de revisión. Publicar solo con autorización explícita.

## Uso en proyectos nuevos
Al reutilizar esta carpeta para otro cliente, reemplazar la ficha de `client/` y las decisiones específicas de Animals Friends por datos del nuevo cliente. No copiar secretos, datos personales, migraciones ni configuraciones de este proyecto. Consultar el comité de descubrimiento de `agents/` para proyectos nuevos.
