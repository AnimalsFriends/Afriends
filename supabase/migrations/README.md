# Migraciones versionadas

`20261022120000_mensajes_admin_empleado.sql` crea conversaciones privadas entre
administración y cada empleado, con envío/lectura mediante funciones PL/pgSQL,
RLS por participante y fecha de lectura. Su rollback es
`../rollbacks/20261022120000_mensajes_admin_empleado_down.sql` y elimina también los mensajes.

`20261022120100_responsable_mascota.sql` agrega el responsable opcional de cada
mascota. NULL significa responsabilidad compartida por todos los empleados. Su
rollback es `../rollbacks/20261022120100_responsable_mascota_down.sql`; al quitar
la columna se pierden las asignaciones específicas.

`20261022120200_mascotas_propias_permanentes.sql` permite marcar mascotas propias
del administrador. Se listan permanentemente en Hotel sin reserva ni salida y no
cuentan para cupos de hotel o capacidad de rutas. Su rollback restaura la regla
anterior y elimina la marca propia.

> Los nombres y contenidos de estos archivos no prueban que estén aplicados en el proyecto Supabase de destino. Antes de ejecutar SQL, compara en modo de solo lectura el historial y el esquema reales; no ejecutes migraciones ni rollbacks sin revisar impacto y recibir aprobación.

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

La revisión estática se corre con `node --test tests/migrations.test.mjs`; no ejecuta SQL ni valida RLS en Supabase. Antes de aplicar una migración en producción, compara primero el historial y el esquema del proyecto objetivo, prueba en un entorno separado y revisa el impacto y el rollback. Consulta
`../README.md` para los pasos de aplicación y los límites conocidos.
