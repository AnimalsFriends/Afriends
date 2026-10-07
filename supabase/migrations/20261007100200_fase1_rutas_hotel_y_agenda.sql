-- =====================================================================
-- ANIMAL FRIENDS · Fase 1 · Paso 3 de 7
-- Rutas del colegio (recogida y entrega), hotel y agenda.
-- =====================================================================
-- Cómo está pensado el modelo de rutas:
--
--   rutas_colegio    La ruta (nombre + empleado que la hace normalmente).
--   paradas_ruta     La lista ORDENADA y permanente de paradas. Cada parada tiene
--                    un "sentido": 'recogida' (casa -> colegio) o 'entrega'
--                    (colegio -> casa). Son dos listas independientes, cada una
--                    con su propio orden, así el admin puede decidir una cosa
--                    para la ida y otra distinta para la vuelta.
--   paradas_dia      Lo que pasa CADA DÍA con una parada: pendiente, recogido,
--                    entregado o no se pudo, con quién lo marcó y a qué hora.
--                    Separar "lista permanente" de "lo del día" evita tener que
--                    reescribir la ruta todos los días y deja historial gratis.
--   ausencias_colegio  Un perro que falta un día concreto sale de la lista de ese
--                    día sin tocar su lugar en la ruta.
--
-- El orden se puede cambiar a mano. La sugerencia por cercanía y el reajuste
-- automático (cuando un perro entra al hotel o falta) se calculan en la Fase 3.
--
-- Para deshacerla: supabase/rollbacks/20261007100200_fase1_rutas_hotel_y_agenda_down.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- RUTAS
-- ---------------------------------------------------------------------
create table if not exists public.rutas_colegio (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (char_length(nombre) between 2 and 80),
  -- Empleado que hace la ruta normalmente. Es lo que le da al empleado acceso a "su" ruta.
  empleado_id  uuid references public.empleados (id) on delete set null,
  activa       boolean not null default true,
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists rutas_colegio_empleado_idx on public.rutas_colegio (empleado_id);

drop trigger if exists tg_rutas_updated_at on public.rutas_colegio;
create trigger tg_rutas_updated_at
  before update on public.rutas_colegio
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- PARADAS (lista ordenada y permanente, una por perro y sentido)
-- ---------------------------------------------------------------------
create table if not exists public.paradas_ruta (
  id             uuid primary key default gen_random_uuid(),
  -- RESTRICT: una ruta o una parada con historial no se puede borrar; se desactiva.
  ruta_id        uuid not null references public.rutas_colegio (id) on delete restrict,
  mascota_id     uuid not null references public.mascotas (id) on delete restrict,
  sentido        text not null check (sentido in ('recogida', 'entrega')),
  orden          integer not null check (orden > 0),
  -- La dirección de la parada se guarda aquí (no se lee del dueño) porque puede ser
  -- distinta: la casa de un familiar, el hotel, etc. Se puede precargar con la del dueño.
  direccion      text not null check (char_length(direccion) between 3 and 200),
  hora_estimada  time,
  notas          text,
  activa         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Un perro aparece una sola vez por ruta y sentido.
  constraint paradas_perro_unico unique (ruta_id, sentido, mascota_id),
  -- Dos paradas no pueden tener el mismo número de orden. Es DEFERRABLE para que, al
  -- intercambiar dos paradas de lugar, la base compruebe la regla al final de la
  -- operación y no a mitad (si no, el intercambio fallaría).
  constraint paradas_orden_unico unique (ruta_id, sentido, orden) deferrable initially deferred
);

create index if not exists paradas_ruta_mascota_idx on public.paradas_ruta (mascota_id);

drop trigger if exists tg_paradas_ruta_updated_at on public.paradas_ruta;
create trigger tg_paradas_ruta_updated_at
  before update on public.paradas_ruta
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- PARADAS DEL DÍA (estado + quién y cuándo lo marcó)
-- ---------------------------------------------------------------------
create table if not exists public.paradas_dia (
  id           uuid primary key default gen_random_uuid(),
  parada_id    uuid not null references public.paradas_ruta (id) on delete restrict,
  fecha        date not null,
  estado       text not null default 'pendiente'
               check (estado in ('pendiente', 'recogido', 'entregado', 'no_se_pudo')),
  motivo       text,                                                      -- sobre todo para "no se pudo"
  marcado_por  uuid references public.empleados (id) on delete set null,
  marcado_en   timestamptz,
  created_at   timestamptz not null default now(),
  constraint paradas_dia_unica unique (parada_id, fecha)
);

create index if not exists paradas_dia_fecha_idx on public.paradas_dia (fecha);

-- Quién marcó y a qué hora NO lo manda la app: lo escribe la base de datos. Así
-- el historial no se puede falsear desde el celular del empleado.
create or replace function public.tg_paradas_dia_marcar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    if new.estado = 'pendiente' then
      new.marcado_por := null;
      new.marcado_en  := null;
    else
      new.marcado_por := public.empleado_actual_id();
      new.marcado_en  := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_paradas_dia_marcar on public.paradas_dia;
create trigger tg_paradas_dia_marcar
  before insert or update on public.paradas_dia
  for each row execute function public.tg_paradas_dia_marcar();

-- ---------------------------------------------------------------------
-- AUSENCIAS DE COLEGIO (el perro falta ese día)
-- ---------------------------------------------------------------------
create table if not exists public.ausencias_colegio (
  id          uuid primary key default gen_random_uuid(),
  mascota_id  uuid not null references public.mascotas (id) on delete restrict,
  fecha       date not null,
  motivo      text,
  created_at  timestamptz not null default now(),
  constraint ausencias_unica unique (mascota_id, fecha)
);

-- ---------------------------------------------------------------------
-- RESERVAS DE HOTEL
-- Ocupa las NOCHES desde "entrada" hasta la víspera de "salida" (la noche de la
-- fecha de salida ya no se duerme). Por eso salida debe ser posterior a entrada.
-- tambien_colegio = true marca "hotel + colegio": ese perro sí aparece en la ruta.
-- ---------------------------------------------------------------------
create table if not exists public.reservas_hotel (
  id                uuid primary key default gen_random_uuid(),
  mascota_id        uuid not null references public.mascotas (id) on delete restrict,
  entrada           date not null,
  salida            date not null,
  estado            text not null default 'reservada'
                    check (estado in ('reservada', 'en_curso', 'finalizada', 'cancelada')),
  tambien_colegio   boolean not null default false,
  notas_comida      text,
  notas_medicacion  text,
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reservas_fechas_ok check (salida > entrada)
);

create index if not exists reservas_hotel_fechas_idx  on public.reservas_hotel (entrada, salida);
create index if not exists reservas_hotel_mascota_idx on public.reservas_hotel (mascota_id);

drop trigger if exists tg_reservas_updated_at on public.reservas_hotel;
create trigger tg_reservas_updated_at
  before update on public.reservas_hotel
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- CITAS (agenda)
-- Una cita de hotel puede apuntar a su reserva (reserva_hotel_id) para que la
-- agenda la pinte en varios días. La detección de choques de horario se hace en
-- la Fase 4.
-- ---------------------------------------------------------------------
create table if not exists public.citas (
  id                uuid primary key default gen_random_uuid(),
  mascota_id        uuid not null references public.mascotas (id) on delete restrict,
  servicio_codigo   text not null references public.servicios (codigo),
  empleado_id       uuid references public.empleados (id) on delete set null,
  reserva_hotel_id  uuid references public.reservas_hotel (id) on delete set null,
  inicio            timestamptz not null,
  fin               timestamptz not null,
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente', 'en_curso', 'listo', 'cancelado')),
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint citas_horas_ok check (fin > inicio)
);

create index if not exists citas_inicio_idx   on public.citas (inicio);
create index if not exists citas_empleado_idx on public.citas (empleado_id, inicio);
create index if not exists citas_mascota_idx  on public.citas (mascota_id);

drop trigger if exists tg_citas_updated_at on public.citas;
create trigger tg_citas_updated_at
  before update on public.citas
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- SEGURIDAD (RLS). Solo admin aquí; el empleado entra en la migración siguiente.
-- ---------------------------------------------------------------------
alter table public.rutas_colegio     enable row level security;
alter table public.paradas_ruta      enable row level security;
alter table public.paradas_dia       enable row level security;
alter table public.ausencias_colegio enable row level security;
alter table public.reservas_hotel    enable row level security;
alter table public.citas             enable row level security;

revoke all on
  public.rutas_colegio, public.paradas_ruta, public.paradas_dia,
  public.ausencias_colegio, public.reservas_hotel, public.citas
from anon;

grant select, insert, update, delete on
  public.rutas_colegio, public.paradas_ruta, public.paradas_dia,
  public.ausencias_colegio, public.reservas_hotel, public.citas
to authenticated;

drop policy if exists "admin_total" on public.rutas_colegio;
create policy "admin_total" on public.rutas_colegio
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.paradas_ruta;
create policy "admin_total" on public.paradas_ruta
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.paradas_dia;
create policy "admin_total" on public.paradas_dia
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.ausencias_colegio;
create policy "admin_total" on public.ausencias_colegio
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.reservas_hotel;
create policy "admin_total" on public.reservas_hotel
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.citas;
create policy "admin_total" on public.citas
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
