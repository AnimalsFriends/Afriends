-- Deshace el paso 1. OJO: BORRA las tablas y todo lo que tengan guardado.
-- Hazlo al final, después de deshacer los pasos 2 a 7 (las demás tablas usan
-- es_admin() y empleados).
-- Primero las tablas (con ellas se van sus políticas, que dependen de es_admin())
-- y solo después las funciones; al revés, Postgres se negaría a borrarlas.
drop table if exists public.servicios;
drop table if exists public.parametros_operativos;
drop table if exists public.empleados;
drop function if exists public.empleado_actual_id();
drop function if exists public.es_admin();
drop function if exists public.tg_set_updated_at();
