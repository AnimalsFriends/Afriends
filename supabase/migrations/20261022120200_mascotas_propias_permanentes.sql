-- Mascotas del administrador alojadas de forma permanente, sin reserva de salida.
alter table public.mascotas add column if not exists es_mascota_propia boolean not null default false;

-- Las reservas históricas de clientes conservan las mismas reglas. Si una mascota
-- está marcada como propia, cualquier fila de reserva preexistente deja de ocupar cupo.
create or replace function public.tg_reservas_hotel_validar_cupos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  capacidad smallint;
  dia date;
  ocupacion integer;
  hoy_colombia date := (now() at time zone 'America/Bogota')::date;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede modificar reservas del hotel' using errcode = '42501';
  end if;
  if new.estado = 'cancelada' then return new; end if;
  if new.estado = 'finalizada' and hoy_colombia < new.salida then
    raise exception 'La reserva solo se puede finalizar el día de salida o después' using errcode = '23514';
  end if;
  select p.cupos_hotel into capacidad from public.parametros_operativos as p where p.id = 1;
  if capacidad is null then
    raise exception 'Configura primero los cupos del hotel' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(231920, 1);

  if exists (
    select 1 from public.reservas_hotel as r
    where r.mascota_id = new.mascota_id and r.estado <> 'cancelada'
      and r.entrada < new.salida and r.salida > new.entrada
      and (tg_op = 'INSERT' or r.id <> new.id)
  ) then
    raise exception 'El perro ya tiene una reserva que se cruza con esas fechas' using errcode = '23P01';
  end if;

  dia := greatest(new.entrada, hoy_colombia);
  while dia < new.salida loop
    select count(*) into ocupacion
    from public.reservas_hotel as r
    join public.mascotas as m on m.id = r.mascota_id
    where r.estado <> 'cancelada' and not m.es_mascota_propia
      and r.entrada <= dia and r.salida > dia
      and (tg_op = 'INSERT' or r.id <> new.id);
    if not exists (
      select 1 from public.mascotas as m
      where m.id = new.mascota_id and m.es_mascota_propia
    ) and ocupacion >= capacidad then
      raise exception 'No quedan cupos para todas las noches de esa reserva' using errcode = '23514';
    end if;
    dia := dia + 1;
  end loop;
  return new;
end;
$$;

revoke all on function public.tg_reservas_hotel_validar_cupos() from public, anon;
grant execute on function public.tg_reservas_hotel_validar_cupos() to authenticated;
