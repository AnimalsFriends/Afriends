# Migraciones versionadas

Los archivos se aplican en orden por nombre. La migración `20261009120000_fase3_rutas_hotel_operacion.sql`
completa la operación del hotel y las rutas: localidad, cupo inicial de 50 solo cuando está vacío,
reordenamiento transaccional y validación en base de cupos y reservas cruzadas.
La migración `20261010120000_fase4_agenda_planeacion.sql` añade capacidad opcional por ruta,
sin valor predeterminado, porque el límite puede cambiar según el recorrido.
`20261011120000_fase5_finanzas_integridad.sql` añade protecciones transaccionales para evitar abonos
por encima del total cobrado, sin tocar tablas ni datos existentes.
`20261012120000_fase7_alertas_asistencia_historial.sql` agrega registro de SOAT, asistencia escolar y auditoría
con políticas admin-only; reutiliza las tablas de vacunas, planes y faltas ya existentes.

La revisión estática se corre con `node --test tests/migrations.test.mjs`; no ejecuta SQL. Antes de
aplicarla a producción, pruébala en un proyecto Supabase de prueba y revisa el esquema. Consulta
`../README.md` para los pasos de aplicación y los límites conocidos.
