# Migraciones versionadas

Los archivos se aplican en orden por nombre. La migración `20261009120000_fase3_rutas_hotel_operacion.sql`
completa la operación del hotel y las rutas: localidad, cupo inicial de 50 solo cuando está vacío,
reordenamiento transaccional y validación en base de cupos y reservas cruzadas.

La revisión estática se corre con `node --test tests/migrations.test.mjs`; no ejecuta SQL. Antes de
aplicarla a producción, pruébala en un proyecto Supabase de prueba y revisa el esquema. Consulta
`../README.md` para los pasos de aplicación y los límites conocidos.
