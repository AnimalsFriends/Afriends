-- =====================================================================
-- ANIMAL FRIENDS · Fase 1 · Paso 4 de 7
-- Dinero: gastos, pagos (lo que se cobra) y abonos (lo que ya pagaron).
-- =====================================================================
-- REGLA: nada de esto lo ve un empleado. Aquí solo hay políticas de admin y no
-- existe ninguna para empleados, y como RLS bloquea todo lo que no tiene política,
-- el empleado queda sin acceso desde la propia base de datos (no solo "oculto" en
-- la pantalla).
--
-- Sobre las tablas: acordamos 'gastos' y 'pagos'. Agrego 'abonos' porque un dueño
-- puede pagar por partes, y sin ella perderíamos la fecha y el valor de cada
-- abono. La cartera de un dueño será: suma de pagos.valor_total menos suma de
-- abonos.valor, agrupada por dueño (un solo cobro aunque tenga tres perros). Esa
-- consulta/vista se arma en la Fase 5.
--
-- Para deshacerla: supabase/rollbacks/20261007100300_fase1_finanzas_down.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- GASTOS
-- fecha por defecto = hoy en hora de Colombia. Sin esto, la base (que trabaja en
-- UTC) anotaría un gasto de las 8 p. m. con la fecha de mañana.
-- ---------------------------------------------------------------------
create table if not exists public.gastos (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null default ((now() at time zone 'America/Bogota')::date),
  categoria    text not null check (categoria in (
                 'gasolina', 'arreglos', 'soat', 'comida_mascotas', 'aseo',
                 'agua', 'luz', 'gas', 'sueldos', 'otros')),
  descripcion  text check (descripcion is null or char_length(descripcion) <= 300),
  valor        numeric(14, 2) not null check (valor >= 0),                -- pesos colombianos
  -- Ruta del archivo en el bucket privado "recibos" (foto del recibo).
  recibo_path  text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists gastos_fecha_idx on public.gastos (fecha);

drop trigger if exists tg_gastos_updated_at on public.gastos;
create trigger tg_gastos_updated_at
  before update on public.gastos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- PAGOS = cada cobro que se le hace a un dueño (esto es lo que genera ingresos)
-- ---------------------------------------------------------------------
create table if not exists public.pagos (
  id               uuid primary key default gen_random_uuid(),
  dueno_id         uuid not null references public.duenos (id) on delete restrict,
  mascota_id       uuid references public.mascotas (id) on delete restrict,   -- opcional: a qué perro corresponde
  servicio_codigo  text references public.servicios (codigo),                 -- con esto se calculan los ingresos por servicio
  fecha            date not null default ((now() at time zone 'America/Bogota')::date),
  concepto         text not null check (char_length(concepto) between 2 and 200),
  valor_total      numeric(14, 2) not null check (valor_total >= 0),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists pagos_dueno_idx on public.pagos (dueno_id);
create index if not exists pagos_fecha_idx on public.pagos (fecha);

drop trigger if exists tg_pagos_updated_at on public.pagos;
create trigger tg_pagos_updated_at
  before update on public.pagos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- ABONOS = cada vez que un dueño paga (todo o una parte) de un cobro
-- ---------------------------------------------------------------------
create table if not exists public.abonos (
  id          uuid primary key default gen_random_uuid(),
  pago_id     uuid not null references public.pagos (id) on delete restrict,
  fecha       date not null default ((now() at time zone 'America/Bogota')::date),
  valor       numeric(14, 2) not null check (valor > 0),
  metodo      text check (metodo is null or char_length(metodo) <= 40),    -- efectivo, transferencia... (texto libre)
  notas       text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists abonos_pago_idx on public.abonos (pago_id);

-- ---------------------------------------------------------------------
-- SEGURIDAD (RLS): solo admin, sin ninguna política para empleados.
-- ---------------------------------------------------------------------
alter table public.gastos  enable row level security;
alter table public.pagos   enable row level security;
alter table public.abonos  enable row level security;

revoke all on public.gastos, public.pagos, public.abonos from anon;
grant select, insert, update, delete on public.gastos, public.pagos, public.abonos to authenticated;

drop policy if exists "admin_total" on public.gastos;
create policy "admin_total" on public.gastos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.pagos;
create policy "admin_total" on public.pagos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.abonos;
create policy "admin_total" on public.abonos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
