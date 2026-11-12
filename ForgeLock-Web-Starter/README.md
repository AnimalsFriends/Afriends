# ForgeLock Web Starter · adaptación para Animals Friends

Esta carpeta reúne el contexto de marca y negocio, acuerdos, pendientes y criterios de trabajo de ForgeLock aplicados al proyecto **Animals Friends**. Se incorpora a un repositorio con una aplicación ya avanzada; no sustituye ni duplica su código.

## Dónde está cada cosa

- **Aplicación existente:** raíz del repositorio (`index.html`, `src/`, `admin/`, `functions/`, `supabase/`, `scripts/` y `tests/`).
- **Contexto del proyecto:** `client/`.
- **Decisiones, avance y mapeo de la plantilla:** `project/`.
- **Reglas de Codex:** `AGENTS.md`.
- **Comité para proyectos nuevos:** `agents/`.
- **Documentación técnica existente:** `../README.md`, `../CHECKLIST_PUBLICACION.md`, `../DATOS_PENDIENTES_CLIENTE.md`, `../supabase/README.md` y `../src/admin/README.md`.

## Cómo trabajar

1. Abrir el repositorio raíz como proyecto de trabajo.
2. Leer `AGENTS.md` y los documentos de `client/` y `project/`.
3. Revisar el código y el estado Git actual; los avances reales viven en la raíz.
4. Especificar la mejora solicitada y preservar las funciones existentes.
5. Mantener separados código implementado, configuración externa y comprobaciones de producción.
6. No publicar ni cambiar servicios externos sin autorización explícita.

## Reutilización con otros clientes

Esta copia es la adaptación de referencia para Animals Friends. Al crear otro proyecto, copiar la plantilla base por separado y reemplazar íntegramente su ficha de cliente. No trasladar datos, credenciales, bases de datos, migraciones o configuración de Animals Friends al nuevo proyecto.
