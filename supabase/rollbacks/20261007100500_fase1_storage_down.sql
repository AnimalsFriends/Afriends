-- Deshace el paso 6: quita las políticas de Storage.
-- Los buckets NO se borran aquí: Supabase no deja borrar un bucket con archivos y
-- no queremos perder fotos ni recibos. Si están vacíos y quieres quitarlos, hazlo
-- desde Storage en el panel de Supabase.
drop policy if exists "af_fotos_admin_total"            on storage.objects;
drop policy if exists "af_fotos_empleado_lee_asignadas" on storage.objects;
drop policy if exists "af_recibos_admin_total"          on storage.objects;
