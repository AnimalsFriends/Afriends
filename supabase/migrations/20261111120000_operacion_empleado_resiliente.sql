-- Operación móvil de empleados: preparación idempotente del día, citas múltiples
-- y separación entre la hora declarada por el dispositivo y la hora del servidor.
-- IMPORTANTE: conciliar primero el historial remoto de migraciones.
begin;

alter table public.paradas_dia
  add column if not exists ocurrido_cliente_en timestamptz,
  add column if not exists sincronizado_en timestamptz;

comment on column public.paradas_dia.ocurrido_cliente_en is
  'Hora informativa del toque en el dispositivo; no sustituye la hora autoritativa del servidor.';
comment on column public.paradas_dia.sincronizado_en is
  'Hora autoritativa en la que Supabase recibió el cambio de estado.';

-- Incluye tanto al empleado primario como a cualquier empleado secundario de
-- cita_empleados. Se conserva la regla existente de responsable compartido.
create or replace function public.mascota_asignada_a_mi(p_mascota uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mascotas m
    where m.id = p_mascota
      and (m.responsable_empleado_id is null
        or m.responsable_empleado_id = public.empleado_actual_id())
  ) or exists (
    select 1
    from public.paradas_ruta p
    where p.mascota_id = p_mascota
      and public.ruta_es_mia(p.ruta_id)
  ) or exists (
    select 1
    from public.citas c
    where c.mascota_id = p_mascota
      and (
        c.empleado_id = public.empleado_actual_id()
        or exists (
          select 1
          from public.cita_empleados ce
          where ce.cita_id = c.id
            and ce.empleado_id = public.empleado_actual_id()
        )
      )
  );
$$;

revoke all on function public.mascota_asignada_a_mi(uuid) from public, anon;
grant execute on function public.mascota_asignada_a_mi(uuid) to authenticated;

-- El servidor sigue siendo la autoridad. La hora del dispositivo se conserva
-- únicamente como contexto operativo y se acota para evitar fechas futuras.
create or replace function public.tg_paradas_dia_marcar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ocurrido_cliente_en is not null
     and new.ocurrido_cliente_en > statement_timestamp() + interval '10 minutes' then
    raise exception 'La hora del dispositivo no puede estar en el futuro'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    if new.estado = 'pendiente' then
      new.marcado_por := null;
      new.marcado_en := null;
      new.sincronizado_en := null;
      new.ocurrido_cliente_en := null;
    else
      new.marcado_por := public.empleado_actual_id();
      new.marcado_en := statement_timestamp();
      new.sincronizado_en := statement_timestamp();
      new.ocurrido_cliente_en := coalesce(new.ocurrido_cliente_en, statement_timestamp());
    end if;
  end if;
  return new;
end;
$$;

-- El empleado puede crear la fila mínima de una parada propia. El UNIQUE
-- (parada_id, fecha) y on_conflict del cliente hacen la operación idempotente.
revoke insert on table public.paradas_dia from authenticated;
grant insert (parada_id, fecha) on public.paradas_dia to authenticated;

drop policy if exists "empleado_prepara_sus_paradas" on public.paradas_dia;
create policy "empleado_prepara_sus_paradas"
  on public.paradas_dia for insert to authenticated
  with check (public.parada_es_mia(parada_id));

revoke update on table public.paradas_dia from authenticated;
grant update (estado, motivo, ocurrido_cliente_en) on public.paradas_dia to authenticated;

drop policy if exists "empleado_marca_sus_paradas" on public.paradas_dia;
create policy "empleado_marca_sus_paradas"
  on public.paradas_dia for update to authenticated
  using (public.parada_es_mia(parada_id))
  with check (public.parada_es_mia(parada_id));

commit;
