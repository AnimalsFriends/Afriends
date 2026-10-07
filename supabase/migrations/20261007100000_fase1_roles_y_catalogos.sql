-- =====================================================================
-- ANIMAL FRIENDS · Fase 1 · Paso 1 de 7
-- Roles (admin / empleado), funciones de apoyo y catálogos pequeños.
-- =====================================================================
-- Por qué empezamos por aquí:
--   Hasta hoy "ser administrador" era tener UN correo escrito a mano dentro de
--   las políticas RLS. Eso no escala (¿y el empleado?) y obliga a editar SQL cada
--   vez que cambia la persona. Ahora el rol vive en una tabla (empleados) y las
--   políticas de TODAS las tablas preguntan a es_admin() / empleado_actual_id().
--
-- Esta migración es solo aditiva: no toca site_config ni contact_requests.
-- Para deshacerla: supabase/rollbacks/20261007100000_fase1_roles_y_catalogos_down.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Función reutilizable: mantiene updated_at al día en cada UPDATE.
-- Sirve para saber cuándo se tocó por última vez un registro.
-- ---------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- EMPLEADOS (incluye a quien administra)
-- Cada fila se enlaza con un usuario de Supabase Auth (user_id). Un admin es
-- simplemente un empleado con rol = 'admin'. No guardamos sueldos aquí: los
-- sueldos son un gasto (tabla gastos) y así el empleado nunca los ve.
-- ---------------------------------------------------------------------
create table if not exists public.empleados (
  id          uuid primary key default gen_random_uuid(),
  -- on delete set null: si borran el usuario de Auth, el empleado y su historial se conservan.
  user_id     uuid unique references auth.users (id) on delete set null,
  nombre      text not null check (char_length(nombre) between 2 and 80),
  telefono    text check (telefono is null or telefono ~ '^[0-9]{7,15}$'),
  rol         text not null default 'empleado' check (rol in ('admin', 'empleado')),
  activo      boolean not null default true,   -- se desactiva en vez de borrar, para no perder historial
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists tg_empleados_updated_at on public.empleados;
create trigger tg_empleados_updated_at
  before update on public.empleados
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- Funciones de apoyo para las políticas RLS.
-- SECURITY DEFINER + search_path vacío: leen "empleados" saltándose RLS (si no,
-- la política de empleados se llamaría a sí misma en bucle) y no se pueden
-- engañar creando objetos con el mismo nombre en otro esquema.
-- ---------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.empleados e
    where e.user_id = (select auth.uid())
      and e.rol = 'admin'
      and e.activo
  );
$$;

-- Devuelve el id (de la tabla empleados) de quien tiene la sesión abierta, o NULL
-- si no es un empleado activo. Las políticas del empleado se apoyan en esto.
create or replace function public.empleado_actual_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.empleados e
  where e.user_id = (select auth.uid())
    and e.activo
  limit 1;
$$;

-- Solo usuarios con sesión pueden llamarlas; el público anónimo no.
revoke all on function public.es_admin()            from public, anon;
revoke all on function public.empleado_actual_id()  from public, anon;
grant execute on function public.es_admin()           to authenticated;
grant execute on function public.empleado_actual_id() to authenticated;

-- ---------------------------------------------------------------------
-- PARÁMETROS OPERATIVOS (una sola fila)
-- Aquí van las cifras que dependen del negocio. Quedan en NULL = "aún no
-- definido": no inventamos capacidades. El admin las llena desde el panel.
-- ---------------------------------------------------------------------
create table if not exists public.parametros_operativos (
  id                   smallint primary key default 1 check (id = 1),
  cupos_hotel          smallint check (cupos_hotel is null or cupos_hotel > 0),
  perros_por_empleado  smallint check (perros_por_empleado is null or perros_por_empleado > 0),
  updated_at           timestamptz not null default now()
);

insert into public.parametros_operativos (id) values (1) on conflict (id) do nothing;

drop trigger if exists tg_parametros_updated_at on public.parametros_operativos;
create trigger tg_parametros_updated_at
  before update on public.parametros_operativos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- SERVICIOS (catálogo)
-- Las citas y los pagos apuntan a un código de servicio en vez de repetir texto
-- libre. Así el contador "perros a cargo por servicio" siempre suma bien.
-- Son los servicios que ya aparecen en la página; se pueden editar o ampliar.
-- ---------------------------------------------------------------------
create table if not exists public.servicios (
  codigo  text primary key check (codigo ~ '^[a-z0-9_]{2,30}$'),
  nombre  text not null check (char_length(nombre) between 2 and 60),
  activo  boolean not null default true,
  orden   smallint not null default 0
);

insert into public.servicios (codigo, nombre, orden) values
  ('colegio',    'Colegio canino',        1),
  ('hotel',      'Hotel canino',          2),
  ('bano',       'Baño e higiene',        3),
  ('peluqueria', 'Peluquería y estética', 4)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------
-- SEGURIDAD (RLS)
-- ---------------------------------------------------------------------
alter table public.empleados              enable row level security;
alter table public.parametros_operativos  enable row level security;
alter table public.servicios              enable row level security;

-- El público anónimo no toca nada de esto.
revoke all on public.empleados, public.parametros_operativos, public.servicios from anon;
grant select, insert, update, delete
  on public.empleados, public.parametros_operativos, public.servicios to authenticated;

-- El admin ve y edita todo.
drop policy if exists "admin_total" on public.empleados;
create policy "admin_total" on public.empleados
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.parametros_operativos;
create policy "admin_total" on public.parametros_operativos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.servicios;
create policy "admin_total" on public.servicios
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Un empleado puede ver SU propia fila (para que la app sepa quién es y qué rol
-- tiene), pero no puede editarla: así nadie se sube el rol a sí mismo.
drop policy if exists "empleado_ve_su_fila" on public.empleados;
create policy "empleado_ve_su_fila" on public.empleados
  for select to authenticated
  using (user_id = (select auth.uid()));

-- El catálogo de servicios no es sensible: cualquiera con sesión lo puede leer.
drop policy if exists "servicios_lectura_con_sesion" on public.servicios;
create policy "servicios_lectura_con_sesion" on public.servicios
  for select to authenticated
  using (true);
