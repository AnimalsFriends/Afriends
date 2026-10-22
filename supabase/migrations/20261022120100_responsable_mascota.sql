-- Responsable opcional: NULL mantiene la responsabilidad compartida por el equipo.
alter table public.mascotas add column if not exists responsable_empleado_id uuid
  references public.empleados(id) on delete set null;
create index if not exists mascotas_responsable_empleado_idx on public.mascotas(responsable_empleado_id);

create or replace function public.mascota_asignada_a_mi(p_mascota uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mascotas m
    where m.id = p_mascota
      and (m.responsable_empleado_id is null or m.responsable_empleado_id = public.empleado_actual_id())
  ) or exists (
    select 1 from public.paradas_ruta p
    where p.mascota_id = p_mascota and public.ruta_es_mia(p.ruta_id)
  ) or exists (
    select 1 from public.citas c
    where c.mascota_id = p_mascota and c.empleado_id = public.empleado_actual_id()
  );
$$;
