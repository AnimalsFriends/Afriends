-- Deshace el paso 3. OJO: BORRA las tablas y todo lo que tengan guardado.
-- Úsalo solo si todavía no hay datos reales (o después de sacar una copia).
drop table if exists public.citas;
drop table if exists public.reservas_hotel;
drop table if exists public.ausencias_colegio;
drop table if exists public.paradas_dia;
drop function if exists public.tg_paradas_dia_marcar();
drop table if exists public.paradas_ruta;
drop table if exists public.rutas_colegio;
