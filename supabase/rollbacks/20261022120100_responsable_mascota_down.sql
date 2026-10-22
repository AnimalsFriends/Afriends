-- Restaura la función anterior al campo de responsabilidad opcional.
create or replace function public.mascota_asignada_a_mi(p_mascota uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.paradas_ruta p
    where p.mascota_id = p_mascota and public.ruta_es_mia(p.ruta_id)
  ) or exists (
    select 1 from public.citas c
    where c.mascota_id = p_mascota and c.empleado_id = public.empleado_actual_id()
  );
$$;
drop index if exists public.mascotas_responsable_empleado_idx;
alter table public.mascotas drop column if exists responsable_empleado_id;
