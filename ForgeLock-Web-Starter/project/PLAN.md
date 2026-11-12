# Plan de continuidad — Animals Friends

## Objetivo

Continuar la aplicación ya avanzada de Animals Friends con cambios pequeños, revisables y compatibles con su arquitectura. Mantener el sitio público, el panel privado y las integraciones coherentes sin dar por validado el entorno externo.

## Estado general

El repositorio documenta funciones implementadas en código y dispone de build, auditoría y pruebas. El estado real de despliegue, base de datos y secretos no queda demostrado por esos archivos. Consultar `MAPA-ADAPTACION.md`.

## Etapas

1. **Contexto y preservación — completada para esta adaptación.** Documentada la separación entre la aplicación raíz y la guía ForgeLock-Web-Starter.
2. **Confirmación de datos — pendiente.** Validar identidad comercial, datos legales, contacto, horarios, precios y contenido con el negocio.
3. **Verificación técnica externa — pendiente.** En modo de solo lectura, confirmar el despliegue, Worker, proyecto Supabase, esquema/RLS y configuración de integraciones. Contrastar también el reporte de Search Console: páginas indexadas y sitemap rastreado con cuatro páginas (dato aportado por Diego, 11 nov 2026).
4. **Analítica y etiquetas — pendiente.** Reconciliar Analytics verificada, el ID presente en el código y la etiqueta faltante. Identificar si se requiere Google tag, Google Tag Manager o ambos antes de tocar el sitio.
5. **GEO y buscadores con IA — pendiente de línea base.** Revisar rastreabilidad, contenido, entidades, datos estructurados y citabilidad; anotar hallazgos medibles sin garantizar inclusión.
6. **Mejora administrativa — en curso.** Se implementó una primera tanda local: protección de borradores al cambiar de módulo, estado independiente por formulario financiero, conservación/reintento de cambios de ruta y mensajes de permisos/configuración más claros. También se añadieron variantes responsivas a las imágenes del carrusel público. Falta validar tareas con administrador y empleados y completar la revisión móvil del panel.
7. **Revisión previa a publicación — parcial, no aprobada para publicar.** El build local pasó antes del último cambio de `srcset`; la página local respondió HTTP 200 y se comprobó la selección de imágenes responsivas en navegador. La última suite completa registró 250/254 pruebas correctas y cuatro fallos por revisar. Falta una suite limpia y revisar formularios, panel en móvil/escritorio, privacidad y evidencia del entorno correspondiente.
8. **Publicación y entrega — bloqueada hasta autorización explícita.** Desplegar desde el flujo aprobado, confirmar la versión y documentar resultados.

## Criterio de avance

Marcar una capacidad como **implementada** solo si el código correspondiente existe; como **operativa** solo después de probarla en el servicio correcto; y como **publicada** solo después de verificar la versión activa. No inferir cumplimiento desde documentación estática.

### Evidencia local — 11 nov 2026

- Cambios del panel verificados con pruebas focalizadas; la suite completa más reciente tuvo 250 aprobadas y 4 fallidas. Entre los fallos observados: dos expectativas de estructura/noindex del scaffold, una expectativa estática de migración y una expectativa de permisos que no coincide con los módulos definidos.
- `npm run build` terminó correctamente antes del cambio responsivo del carrusel. Después de ese cambio, `http://localhost:4173/` respondió HTTP 200 y el navegador mostró `srcset` con variantes de 480, 768, 1024, 1440 y 1800 px.
- Esta evidencia solo es local; no verifica el Worker publicado, Supabase remoto ni la configuración de servicios externos.

## Bloqueos

- Datos comerciales y legales que debe confirmar el negocio.
- Acceso de lectura y evidencia del estado actual de Cloudflare, GitHub Actions y Supabase.
- Aprobación explícita para operaciones externas o publicación.
