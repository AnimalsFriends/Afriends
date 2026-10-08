-- ANIMAL FRIENDS · Fase 3 · Operación de rutas y hotel
-- localidad es nullable para no alterar paradas que ya pudieran existir; las
-- nuevas paradas del panel sí la exigirán para agrupar el orden manual.
alter table public.paradas_ruta
  add column if not exists localidad text
  check (localidad is null or char_length(localidad) between 2 and 80);

-- Capacidad confirmada por el negocio. Solo se completa si todavía no se había
-- configurado, para no pisar un valor que ya exista.
update public.parametros_operativos
set cupos_hotel = 50
where id = 1 and cupos_hotel is null;

-- El intercambio de varias paradas debe ocurrir en una sola transacción:
-- PostgREST hace una petición por operación y dos PATCH sueltos no sirven para
-- intercambiar posiciones bajo la restricción unique de la ruta.
create or replace function public.reordenar_paradas(
  p_ruta_id uuid,
  p_sentido text,
  p_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total_paradas integer;
  ids_unicos integer;
  ids_de_ruta integer;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede reordenar paradas' using errcode = '42501';
  end if;
  if p_sentido not in ('recogida', 'entrega') then
    raise exception 'El sentido de la ruta no es válido' using errcode = '22023';
  end if;

  select count(*) into total_paradas
  from public.paradas_ruta
  where ruta_id = p_ruta_id and sentido = p_sentido;

  select count(distinct id) into ids_unicos from unnest(coalesce(p_ids, array[]::uuid[])) as u(id);
  select count(*) into ids_de_ruta
  from public.paradas_ruta
  where ruta_id = p_ruta_id and sentido = p_sentido and id = any(coalesce(p_ids, array[]::uuid[]));

  if total_paradas <> coalesce(cardinality(p_ids), 0)
     or ids_unicos <> total_paradas
     or ids_de_ruta <> total_paradas then
    raise exception 'La lista debe incluir cada parada de ese sentido una sola vez' using errcode = '22023';
  end if;

  set constraints paradas_orden_unico deferred;
  update public.paradas_ruta as p
  set orden = nueva.posicion
  from unnest(p_ids) with ordinality as nueva(id, posicion)
  where p.id = nueva.id and p.ruta_id = p_ruta_id and p.sentido = p_sentido;
end;
$$;

revoke all on function public.reordenar_paradas(uuid, text, uuid[]) from public, anon;
grant execute on function public.reordenar_paradas(uuid, text, uuid[]) to authenticated;

-- La capacidad se valida en la base además de en el formulario: así dos
-- reservas simultáneas no pueden ocupar el mismo último cupo.
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
  if new.estado = 'cancelada' then
    return new;
  end if;
  if new.estado = 'finalizada' and hoy_colombia < new.salida then
    raise exception 'La reserva solo se puede finalizar el día de salida o después' using errcode = '23514';
  end if;

  select p.cupos_hotel into capacidad
  from public.parametros_operativos as p
  where p.id = 1;
  if capacidad is null then
    raise exception 'Configura primero los cupos del hotel' using errcode = '23514';
  end if;
  -- Serializa las escrituras: sin el candado dos solicitudes podrían ver el
  -- mismo último cupo libre y aceptar una reserva cada una.
  perform pg_advisory_xact_lock(231920, 1);

  -- Un perro no puede tener dos estancias activas que se crucen.
  if exists (
    select 1
    from public.reservas_hotel as r
    where r.mascota_id = new.mascota_id
      and r.estado <> 'cancelada'
      and r.entrada < new.salida
      and r.salida > new.entrada
      and (tg_op = 'INSERT' or r.id <> new.id)
  ) then
    raise exception 'El perro ya tiene una reserva que se cruza con esas fechas' using errcode = '23P01';
  end if;

  -- Las fechas pasadas se conservan como historial aunque el cupo actual cambie.
  dia := greatest(new.entrada, hoy_colombia);
  while dia < new.salida loop
    select count(*) into ocupacion
    from public.reservas_hotel as r
    where r.estado <> 'cancelada'
      and r.entrada <= dia
      and r.salida > dia
      and (tg_op = 'INSERT' or r.id <> new.id);

    if ocupacion >= capacidad then
      raise exception 'No quedan cupos para todas las noches de esa reserva' using errcode = '23514';
    end if;
    dia := dia + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists tg_reservas_hotel_validar_cupos on public.reservas_hotel;
create trigger tg_reservas_hotel_validar_cupos
  before insert or update of mascota_id, entrada, salida, estado on public.reservas_hotel
  for each row execute function public.tg_reservas_hotel_validar_cupos();

revoke all on function public.tg_reservas_hotel_validar_cupos() from public, anon;
grant execute on function public.tg_reservas_hotel_validar_cupos() to authenticated;
