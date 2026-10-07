-- =====================================================================
-- ANIMAL FRIENDS · Fase 1 · Paso 6 de 7
-- Almacenamiento de archivos: fotos de mascotas y recibos de gastos.
-- =====================================================================
-- Los dos buckets son PRIVADOS (public = false): nadie puede abrir una foto o un
-- recibo con solo conocer la dirección. La app pide un enlace temporal firmado.
--
--   fotos-mascotas  Las sube el admin. Convención de nombre: <mascota_id>/<archivo>
--                   Un empleado solo puede VER las fotos de sus perros asignados
--                   (la política lee el id del perro desde la primera carpeta).
--   recibos         Solo el admin: son documentos financieros.
--
-- Si la carpeta "storage" no existe en tu proyecto (muy raro en Supabase), esta
-- migración fallará: el resto de la Fase 1 no depende de ella.
--
-- Para deshacerla: supabase/rollbacks/20261007100500_fase1_storage_down.sql
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fotos-mascotas', 'fotos-mascotas', false, 5242880,
     array['image/jpeg', 'image/png', 'image/webp']),
  ('recibos', 'recibos', false, 8388608,
     array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- fotos-mascotas
-- ---------------------------------------------------------------------
drop policy if exists "af_fotos_admin_total" on storage.objects;
create policy "af_fotos_admin_total" on storage.objects
  for all to authenticated
  using      (bucket_id = 'fotos-mascotas' and public.es_admin())
  with check (bucket_id = 'fotos-mascotas' and public.es_admin());

-- El CASE evita que un nombre de carpeta raro (que no sea un uuid) rompa la
-- consulta al intentar convertirlo: si no parece uuid, simplemente no da acceso.
drop policy if exists "af_fotos_empleado_lee_asignadas" on storage.objects;
create policy "af_fotos_empleado_lee_asignadas" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos-mascotas'
    and case
          when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.mascota_asignada_a_mi(((storage.foldername(name))[1])::uuid)
          else false
        end
  );

-- ---------------------------------------------------------------------
-- recibos (solo admin)
-- ---------------------------------------------------------------------
drop policy if exists "af_recibos_admin_total" on storage.objects;
create policy "af_recibos_admin_total" on storage.objects
  for all to authenticated
  using      (bucket_id = 'recibos' and public.es_admin())
  with check (bucket_id = 'recibos' and public.es_admin());
