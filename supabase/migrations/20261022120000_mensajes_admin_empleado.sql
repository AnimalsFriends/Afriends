-- Conversaciones privadas admin-empleado, con lectura individual por usuario.
create table if not exists public.mensajes_equipo (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  remitente_user_id uuid not null references auth.users(id) on delete restrict,
  cuerpo text not null check (char_length(btrim(cuerpo)) between 1 and 4000),
  creado_en timestamptz not null default now(),
  leido_en timestamptz
);

create index if not exists mensajes_equipo_hilo_idx on public.mensajes_equipo(empleado_id, creado_en);
alter table public.mensajes_equipo enable row level security;
revoke all on public.mensajes_equipo from public, anon, authenticated;
grant select on public.mensajes_equipo to authenticated;

create or replace function public.mensaje_equipo_enviar(p_empleado uuid, p_cuerpo text)
returns public.mensajes_equipo language plpgsql security definer set search_path = '' as $$
declare v_mensaje public.mensajes_equipo;
begin
  if (select auth.uid()) is null or not (public.es_admin() or p_empleado = public.empleado_actual_id()) then
    raise exception 'No tienes permiso para enviar mensajes en esta conversación' using errcode = '42501';
  end if;
  if p_cuerpo is null or char_length(btrim(p_cuerpo)) not between 1 and 4000 then
    raise exception 'El mensaje debe tener entre 1 y 4000 caracteres' using errcode = '22023';
  end if;
  insert into public.mensajes_equipo(empleado_id, remitente_user_id, cuerpo)
  values (p_empleado, (select auth.uid()), btrim(p_cuerpo)) returning * into v_mensaje;
  return v_mensaje;
end;
$$;
revoke all on function public.mensaje_equipo_enviar(uuid, text) from public, anon;
grant execute on function public.mensaje_equipo_enviar(uuid, text) to authenticated;

create or replace function public.mensaje_equipo_marcar_leido(p_mensaje uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.mensajes_equipo m set leido_en = now()
  where m.id = p_mensaje and m.leido_en is null
    and (public.es_admin() or m.empleado_id = public.empleado_actual_id())
    and m.remitente_user_id <> (select auth.uid());
end;
$$;
revoke all on function public.mensaje_equipo_marcar_leido(uuid) from public, anon;
grant execute on function public.mensaje_equipo_marcar_leido(uuid) to authenticated;

drop policy if exists "mensajes_equipo_lectura_participantes" on public.mensajes_equipo;
create policy "mensajes_equipo_lectura_participantes" on public.mensajes_equipo for select to authenticated
  using (public.es_admin() or empleado_id = public.empleado_actual_id());
drop policy if exists "mensajes_equipo_actualizar_lectura" on public.mensajes_equipo;
create policy "mensajes_equipo_actualizar_lectura" on public.mensajes_equipo for update to authenticated
  using ((public.es_admin() or empleado_id = public.empleado_actual_id()) and remitente_user_id <> (select auth.uid()))
  with check ((public.es_admin() or empleado_id = public.empleado_actual_id()) and remitente_user_id <> (select auth.uid()));
