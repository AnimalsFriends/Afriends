-- Rollback no destructivo: retira la preparación autónoma del empleado y
-- restaura el marcado anterior. Las marcas de tiempo nuevas se conservan para
-- no borrar historia operativa.
begin;

drop policy if exists "empleado_prepara_sus_paradas" on public.paradas_dia;

revoke insert on table public.paradas_dia from authenticated;
grant insert on table public.paradas_dia to authenticated;

revoke update on table public.paradas_dia from authenticated;
grant update (estado, motivo) on public.paradas_dia to authenticated;

create or replace function public.tg_paradas_dia_marcar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    if new.estado = 'pendiente' then
      new.marcado_por := null;
      new.marcado_en := null;
    else
      new.marcado_por := public.empleado_actual_id();
      new.marcado_en := now();
    end if;
  end if;
  return new;
end;
$$;

-- Restaura la regla anterior a la asignación múltiple. La tabla y los datos de
-- cita_empleados no se eliminan.
create or replace function public.mascota_asignada_a_mi(p_mascota uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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

revoke all on function public.mascota_asignada_a_mi(uuid) from public, anon;
grant execute on function public.mascota_asignada_a_mi(uuid) to authenticated;

commit;
