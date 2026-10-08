# Servicios del panel

Los servicios encapsulan las llamadas al API REST de Supabase y comparten la sesión y el manejo
de errores. `rutasApi.js` consulta y modifica rutas, planes, ausencias, estados diarios y reservas;
para mover paradas llama la función SQL transaccional `reordenar_paradas`. `agendaApi.js` carga
citas, servicios y reservas del período, y guarda cambios en la tabla existente `citas`.

Las peticiones se prueban con `fetch` simulado: `node --test tests/rutasApi.test.mjs`. Esa prueba no
confirman permisos ni comportamiento contra una instancia real de Supabase:
`node --test tests/rutasApi.test.mjs tests/agendaApi.test.mjs`.
