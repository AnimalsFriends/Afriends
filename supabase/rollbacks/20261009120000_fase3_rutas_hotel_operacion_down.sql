-- Quita las validaciones y la función de reordenamiento de Fase 3.
drop trigger if exists tg_reservas_hotel_validar_cupos on public.reservas_hotel;
drop function if exists public.tg_reservas_hotel_validar_cupos();
drop function if exists public.reordenar_paradas(uuid, text, uuid[]);

-- No borramos localidad ni restablecemos cupos_hotel: pueden contener datos
-- editados por el negocio después de aplicar la migración.
-- Si de verdad necesitas quitar la columna, primero respalda y mueve sus valores.
