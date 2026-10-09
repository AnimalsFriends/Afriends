# Servicios del panel

Los servicios encapsulan las llamadas al API REST de Supabase y comparten la sesión y el manejo
de errores. `rutasApi.js` consulta y modifica rutas, planes, ausencias, estados diarios y reservas;
para mover paradas llama la función SQL transaccional `reordenar_paradas`. `agendaApi.js` carga
citas, servicios y reservas del período, y guarda cambios en la tabla existente `citas`.
`finanzasApi.js` consulta gastos, cobros y abonos; carga y descarga recibos usando el bucket privado
`recibos` con la sesión admin.
`seguimientoApi.js` carga alertas, planes y asistencia del día, registra el SOAT y pagina el historial;
la hora de entrada y salida se valida y fija en Supabase, no en el reloj del navegador.

Las peticiones se prueban con `fetch` simulado; por sí solas no confirman permisos ni comportamiento
contra una instancia real de Supabase:
`node --test tests/rutasApi.test.mjs tests/agendaApi.test.mjs tests/finanzasApi.test.mjs tests/seguimientoApi.test.mjs`.
