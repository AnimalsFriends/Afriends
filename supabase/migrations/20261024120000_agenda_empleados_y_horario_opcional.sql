-- Agenda: asignación múltiple de empleados y horario opcional por servicio.
-- Preparada para revisión; NO ejecutar hasta conciliar el historial remoto de BD-AnimalsFriends.
begin;

alter table public.citas
  add column if not exists fecha_servicio date;

update public.citas
set fecha_servicio = (inicio at time zone 'America/Bogota')::date
where fecha_servicio is null and inicio is not null;

alter table public.citas
  alter column fecha_servicio set not null,
  alter column inicio drop not null,
  alter column fin drop not null;

alter table public.citas
  drop constraint if exists citas_horas_ok,
  add constraint citas_horario_opcional_ok
    check (
      (inicio is null and fin is null)
      or (inicio is not null and fin is not null and fin > inicio)
    );

create index if not exists citas_fecha_servicio_idx
  on public.citas (fecha_servicio);

create table if not exists public.cita_empleados (
  cita_id uuid not null references public.citas(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (cita_id, empleado_id)
);

insert into public.cita_empleados (cita_id, empleado_id)
select id, empleado_id
from public.citas
where empleado_id is not null
on conflict (cita_id, empleado_id) do nothing;

alter table public.cita_empleados enable row level security;
revoke all on public.cita_empleados from public, anon;
grant select, insert, update, delete on public.cita_empleados to authenticated;

drop policy if exists cita_empleados_admin_todo on public.cita_empleados;
create policy "cita_empleados_admin_todo" on public.cita_empleados
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists cita_empleados_empleado_ve_asignaciones on public.cita_empleados;
create policy "cita_empleados_empleado_ve_asignaciones"
  on public.cita_empleados for select to authenticated
  using (empleado_id = public.empleado_actual_id());

drop policy if exists empleado_ve_sus_citas on public.citas;
create policy "empleado_ve_sus_citas"
  on public.citas for select to authenticated
  using (
    empleado_id = public.empleado_actual_id()
    or exists (
      select 1
      from public.cita_empleados ce
      where ce.cita_id = citas.id
        and ce.empleado_id = public.empleado_actual_id()
    )
  );

-- Escritura atómica de cita + asignaciones. SECURITY INVOKER conserva las políticas RLS.
create or replace function public.guardar_cita_agenda(
  p_id uuid,
  p_mascota_id uuid,
  p_empleado_ids uuid[],
  p_servicio_codigo text,
  p_fecha_servicio date,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_estado text,
  p_notas text
)
returns public.citas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cita public.citas;
  v_empleado_ids uuid[];
begin
  if p_mascota_id is null or p_servicio_codigo is null or p_fecha_servicio is null then
    raise exception 'Faltan datos obligatorios de la cita' using errcode = '22023';
  end if;

  if (p_inicio is null) <> (p_fin is null) or (p_inicio is not null and p_fin <= p_inicio) then
    raise exception 'El horario debe estar completo y la hora final ser posterior a la inicial' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct e.id order by e.id), array[]::uuid[])
    into v_empleado_ids
  from unnest(coalesce(p_empleado_ids, array[]::uuid[])) as asignado(id)
  join public.empleados e on e.id = asignado.id and e.activo;

  if cardinality(v_empleado_ids) = 0 then
    raise exception 'Asigna al menos un empleado activo' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.citas
      (mascota_id, empleado_id, servicio_codigo, fecha_servicio, inicio, fin, estado, notas)
    values
      (p_mascota_id, v_empleado_ids[1], p_servicio_codigo, p_fecha_servicio, p_inicio, p_fin,
       coalesce(p_estado, 'pendiente'), nullif(btrim(p_notas), ''))
    returning * into v_cita;
  else
    update public.citas
    set mascota_id = p_mascota_id,
        empleado_id = v_empleado_ids[1],
        servicio_codigo = p_servicio_codigo,
        fecha_servicio = p_fecha_servicio,
        inicio = p_inicio,
        fin = p_fin,
        estado = coalesce(p_estado, 'pendiente'),
        notas = nullif(btrim(p_notas), '')
    where id = p_id
    returning * into v_cita;

    if not found then
      raise exception 'Cita no encontrada o sin permisos' using errcode = '42501';
    end if;

    delete from public.cita_empleados where cita_id = v_cita.id;
  end if;

  insert into public.cita_empleados (cita_id, empleado_id)
  select v_cita.id, unnest(v_empleado_ids)
  on conflict (cita_id, empleado_id) do nothing;

  return v_cita;
end;
$$;

revoke all on function public.guardar_cita_agenda(uuid, uuid, uuid[], text, date, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.guardar_cita_agenda(uuid, uuid, uuid[], text, date, timestamptz, timestamptz, text, text) to authenticated;

commit;
