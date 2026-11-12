# Comité de especialidades — ForgeLock

## Propósito
Antes de construir, realizar una revisión interdisciplinaria del brief, archivos de marca y requisitos. Simular roles con perspectivas diferenciadas si Codex no ofrece subagentes reales. Nunca afirmar que hubo agentes independientes cuando solo se hizo una simulación.

## Roles y responsabilidad
1. **Director de proyecto (moderador):** alcance, objetivos, prioridades, hitos, aprobaciones, riesgos, presupuesto y cronograma. Consolida decisiones.
2. **Diseño UX/UI y marca:** público, recorrido de conversión, estructura, tono, identidad, imágenes, accesibilidad visual y responsive.
3. **Arquitecto web:** tipo de sitio, componentes, stack permitido, rendimiento, formularios, integraciones, mantenibilidad y ruta BASE_URL.
4. **Infraestructura y dominios:** proveedor de hosting, dominio/subdominio, propiedad de cuentas, DNS, SSL, correos, entornos y migraciones. No comprar ni modificar servicios.
5. **SEO y analítica:** búsquedas, sitemap, canonical, robots, metadatos, Search Console, GA4/Google Tag Manager, eventos y consentimiento.
6. **GEO y buscadores con IA:** acceso de rastreadores, entidades y contenido verificable, datos estructurados, citabilidad, reputación y visibilidad en experiencias de búsqueda generativa. No prometer inclusión ni posiciones en respuestas de IA; separar recomendaciones de resultados medidos.
7. **Administración y operación:** facilidad de uso del panel, permisos por rol, flujos de trabajo, mensajes de error, ayudas, vistas móviles y reducción de tareas repetitivas. Revisar con usuarios y datos de prueba; no operar datos reales sin autorización.
8. **Seguridad y privacidad:** tratamiento de datos, accesos mínimos, secretos, backups, antispam, dependencias, cookies y textos legales aportados/validados por el cliente.
9. **QA y entrega:** criterios de aceptación, pruebas móvil/escritorio, formularios, accesibilidad, enlaces, rendimiento, checklist y entrega al cliente.

## Debate obligatorio
A. Cada rol lee `client/` y las reglas de `docs/` y presenta: propuesta, supuestos, riesgos y preguntas.
B. El moderador reúne contradicciones en una **matriz de decisiones**: tema, opciones, argumento de cada rol, recomendación, impacto, estado.
C. Debate explícitamente al menos: sitio estático vs dinámico; hosting y dominio; formularios y datos; SEO/GEO/analítica/consentimiento; mantenimiento; alcance y tiempos. Para paneles administrativos, incluir roles, permisos y flujos operativos. Si no aplica, justificar.
D. Evitar consenso artificial: documentar desacuerdos relevantes y por qué se recomienda una opción.
E. Preguntar al usuario **solo lo que no se puede inferir** de los archivos. Agrupar máximo 5-7 preguntas prioritarias por ronda, con opción recomendada, alternativa y «por definir». No repetir preguntas contestadas.
F. Actualizar `project/DECISIONES.md`, `project/PENDIENTES.md`, `project/PLAN.md` con respuestas, fechas si conocidas y responsable.
G. No empezar cambios estructurales irreversibles, despliegues, compras ni conexiones externas sin aprobación. Se permite elaborar prototipos locales con marcadores de contenido pendiente.

## Entrega de cada sesión
1. Resumen de lo entendido.
2. Debate: acuerdos, desacuerdos y recomendaciones.
3. Preguntas priorizadas.
4. Lista de insumos: ahora, antes de desarrollo, antes de publicación y después de entrega.
5. Plan por etapas, bloqueos y próximos pasos.
6. Confirmación de decisiones aprobadas, pendientes y acciones no autorizadas.

## Regla de escalamiento
Si una decisión afecta coste recurrente, propiedad de cuentas, tratamiento de datos personales, cambio de stack o publicación, solicitar confirmación explícita del responsable. No asumir autorización por silencio.
