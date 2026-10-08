-- ANIMAL FRIENDS · Fase 2 · Protección del historial de dueños y mascotas
-- La pantalla ya desactiva estos registros en vez de borrarlos. Este permiso
-- también cierra el borrado directo por PostgREST para sesiones autenticadas.
-- Los registros hijos conservan sus políticas actuales; el admin puede corregir
-- vacunas, medicamentos o autorizados de forma individual cuando hace falta.
revoke delete on table public.duenos, public.mascotas from authenticated;
