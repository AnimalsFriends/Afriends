# Pruebas automáticas

Las pruebas usan el runner incluido en Node (`node --test`), sin servidor ni dependencias extra.
Desde la raíz puedes ejecutar `npm test`; para validar build, auditoría y toda la suite, usa `npm run check`.

Las pruebas de gestión cubren validación de fichas, HTML seguro, peticiones a Supabase y errores visibles
del controlador. Las pruebas `rutas*.test.mjs` cubren el servicio diario, cupos/noches, peticiones REST,
vistas y conflictos de reservas. Las pruebas `agenda*.test.mjs` cubren rangos de Bogotá, choques,
capacidad por ruta, peticiones y calendario. Las pruebas `finanzas*.test.mjs` cubren validaciones, cartera por dueño,
ingresos/recaudos, exportación CSV, recibos y vistas financieras. `migrations.test.mjs` revisa RLS y guardas estáticas
del SQL; no aplica las migraciones ni sustituye una comprobación en un proyecto Supabase real.
`seguimiento*.test.mjs` cubre vencimientos en 30 días, asistencia derivada, escritura de SOAT,
peticiones REST e interpolación segura del historial.
`publicSite.test.mjs` protege la acción principal del cotizador y evita incluir claves privadas
de Supabase en la configuración pública.
