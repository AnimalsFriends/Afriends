# Arquitectura de referencia

## Objetivo
Separar información del cliente, configuración, componentes visuales y procesos de construcción. Cada cliente recibe una copia independiente de la plantilla.

## Capas
- `client/`: fuente de verdad del cliente y activos originales.
- `src/config/`: datos configurables de sitio, marca y navegación.
- `src/models/`: transformación y validación de datos (si se necesita).
- `src/views/`: componentes, layouts y páginas.
- `src/controllers/`: eventos e interacciones.
- `src/services/`: integraciones opcionales con contratos claros.
- `src/styles/`: estilos globales y tokens.
- `public/`: archivos públicos estáticos.
- `scripts/`: compilación, validación y generación SEO.
- `dist/`: resultado generado, nunca fuente editable.

## Decisiones
- Inicio con HTML, CSS y JS nativos, sin framework obligatorio.
- Progresividad: primero contenido funcional, luego interacciones.
- No incorporar dependencias por anticipado.
- `BASE_URL` controla rutas del sitio y se configura por proyecto.
- Los datos del cliente no se copian a la plantilla maestra compartida.
- La estructura MVC es una convención modular, no obliga a crear archivos vacíos.

## Evolución
Cuando existan varios proyectos reales, extraer componentes repetidos, versionarlos y probarlos antes de actualizar la plantilla. Las mejoras no se propagan automáticamente a sitios entregados.
