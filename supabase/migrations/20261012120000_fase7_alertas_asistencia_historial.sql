-- ANIMAL FRIENDS · Fase 7 · vencimientos, asistencia e historial de cambios
-- Las tablas nuevas quedan en la base aunque se ejecute el rollback: el historial
-- operativo y las marcas de asistencia no se deben perder al retirar una pantalla.

create table if not exists public.soat_vehiculos (
  id                 uuid primary key default gen_random_uuid(),
  vehiculo           text not null check (char_length(btrim(vehiculo)) between 2 and 80),
  fecha_vencimiento  date not null,
  notas              text check (notas is null or char_length(notas) <= 500),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists soat_vehiculos_vencimiento_idx
  on public.soat_vehiculos (fecha_vencimiento);
create unique index if not exists soat_vehiculos_nombre_lower_uidx
  on public.soat_vehiculos (lower(regexp_replace(btrim(vehiculo), '\s+', ' ', 'g')));

drop trigger if exists tg_soat_vehiculos_updated_at on public.soat_vehiculos;
create trigger tg_soat_vehiculos_updated_at
  before update on public.soat_vehiculos
  for each row execute function public.tg_set_updated_at();

create table if not exists public.asistencia_colegio (
  id             uuid primary key default gen_random_uuid(),
  mascota_id     uuid not null references public.mascotas (id) on delete restrict,
  fecha          date not null,
  entrada_en     timestamptz,
  entrada_por    uuid references public.empleados (id) on delete set null,
  salida_en      timestamptz,
  salida_por     uuid references public.empleados (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint asistencia_colegio_unica unique (mascota_id, fecha),
  constraint asistencia_salida_despues_entrada
    check (salida_en is null or (entrada_en is not null and salida_en >= entrada_en))
);

create index if not exists asistencia_colegio_fecha_idx
  on public.asistencia_colegio (fecha, mascota_id);

create or replace function public.tg_asistencia_colegio_marcar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empleado uuid := public.empleado_actual_id();
  v_momento timestamptz := statement_timestamp();
begin
  if tg_op = 'INSERT' then
    if new.entrada_en is not null then
      new.entrada_en := v_momento;
      new.entrada_por := v_empleado;
    else
      new.entrada_por := null;
    end if;
    if new.salida_en is not null then
      new.salida_en := v_momento;
      new.salida_por := v_empleado;
    else
      new.salida_por := null;
    end if;
  else
    if old.entrada_en is not null then
      new.entrada_en := old.entrada_en;
      new.entrada_por := old.entrada_por;
    elsif new.entrada_en is not null then
      new.entrada_en := v_momento;
      new.entrada_por := v_empleado;
    else
      new.entrada_por := null;
    end if;

    if old.salida_en is not null then
      new.salida_en := old.salida_en;
      new.salida_por := old.salida_por;
    elsif new.salida_en is not null then
      new.salida_en := v_momento;
      new.salida_por := v_empleado;
    else
      new.salida_por := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_asistencia_colegio_marcar on public.asistencia_colegio;
create trigger tg_asistencia_colegio_marcar
  before insert or update on public.asistencia_colegio
  for each row execute function public.tg_asistencia_colegio_marcar();

drop trigger if exists tg_asistencia_colegio_updated_at on public.asistencia_colegio;
create trigger tg_asistencia_colegio_updated_at
  before update on public.asistencia_colegio
  for each row execute function public.tg_set_updated_at();

-- Una fila de historial guarda la identidad del actor y las versiones anterior
-- y nueva del registro, para que los cambios sigan explicándose tras una baja.
create table if not exists public.historial_cambios (
  id                  bigint generated always as identity primary key,
  tabla               text not null,
  registro_id         text not null,
  operacion           text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id            uuid,
  actor_empleado_id   uuid references public.empleados (id) on delete set null,
  actor_nombre        text,
  actor_correo        text,
  ocurrido_en         timestamptz not null default now(),
  valores_anteriores  jsonb,
  valores_nuevos      jsonb
);

create index if not exists historial_cambios_fecha_idx
  on public.historial_cambios (ocurrido_en desc, id desc);
create index if not exists historial_cambios_registro_idx
  on public.historial_cambios (tabla, registro_id, ocurrido_en desc);

comment on table public.historial_cambios is
  'Registro inmutable de inserciones, cambios y bajas en las tablas operativas públicas.';

create or replace function public.tg_registrar_cambio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior jsonb;
  v_nuevo jsonb;
  v_registro_id text;
  v_actor_id uuid := auth.uid();
  v_empleado_id uuid := public.empleado_actual_id();
  v_actor_nombre text;
begin
  if tg_op = 'INSERT' then
    v_nuevo := to_jsonb(new);
    v_registro_id := coalesce(v_nuevo ->> 'id', v_nuevo ->> 'codigo', 'sin-clave');
  elsif tg_op = 'UPDATE' then
    v_anterior := to_jsonb(old);
    v_nuevo := to_jsonb(new);
    v_registro_id := coalesce(v_nuevo ->> 'id', v_nuevo ->> 'codigo', v_anterior ->> 'id', v_anterior ->> 'codigo', 'sin-clave');
  else
    v_anterior := to_jsonb(old);
    v_registro_id := coalesce(v_anterior ->> 'id', v_anterior ->> 'codigo', 'sin-clave');
  end if;

  if v_empleado_id is not null then
    select e.nombre into v_actor_nombre
      from public.empleados as e
     where e.id = v_empleado_id;
  end if;

  insert into public.historial_cambios (
    tabla, registro_id, operacion, actor_id, actor_empleado_id,
    actor_nombre, actor_correo, valores_anteriores, valores_nuevos
  ) values (
    tg_table_schema || '.' || tg_table_name,
    v_registro_id,
    tg_op,
    v_actor_id,
    v_empleado_id,
    v_actor_nombre,
    nullif(auth.jwt() ->> 'email', ''),
    v_anterior,
    v_nuevo
  );

  return null;
end;
$$;

alter table public.soat_vehiculos enable row level security;
alter table public.asistencia_colegio enable row level security;
alter table public.historial_cambios enable row level security;

revoke all on public.soat_vehiculos, public.asistencia_colegio, public.historial_cambios
  from public, anon, authenticated;
grant select, insert, update on public.soat_vehiculos, public.asistencia_colegio to authenticated;
grant select on public.historial_cambios to authenticated;
revoke all on sequence public.historial_cambios_id_seq from public, anon, authenticated;

drop policy if exists "admin_total" on public.soat_vehiculos;
create policy "admin_total" on public.soat_vehiculos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.asistencia_colegio;
create policy "admin_total" on public.asistencia_colegio
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_lee_historial" on public.historial_cambios;
create policy "admin_lee_historial" on public.historial_cambios
  for select to authenticated
  using (public.es_admin());

revoke all on function public.tg_asistencia_colegio_marcar() from public, anon;
revoke all on function public.tg_registrar_cambio() from public, anon;
grant execute on function public.tg_asistencia_colegio_marcar() to authenticated;
grant execute on function public.tg_registrar_cambio() to authenticated;

do $$
declare
  v_tabla text;
  v_tablas text[] := array[
    'public.site_config',
    'public.contact_requests',
    'public.empleados',
    'public.parametros_operativos',
    'public.servicios',
    'public.duenos',
    'public.mascotas',
    'public.medicamentos_mascota',
    'public.vacunas_mascota',
    'public.personas_autorizadas',
    'public.planes_colegio',
    'public.gastos',
    'public.pagos',
    'public.abonos',
    'public.rutas_colegio',
    'public.paradas_ruta',
    'public.paradas_dia',
    'public.ausencias_colegio',
    'public.reservas_hotel',
    'public.citas',
    'public.soat_vehiculos',
    'public.asistencia_colegio'
  ];
begin
  foreach v_tabla in array v_tablas loop
    execute format('drop trigger if exists tg_auditar_cambios on %s', v_tabla);
    execute format(
      'create trigger tg_auditar_cambios after insert or update or delete on %s for each row execute function public.tg_registrar_cambio()',
      v_tabla
    );
  end loop;
end;
$$;
