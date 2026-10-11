-- Animals Friends: esquema inicial consolidado para un proyecto Supabase nuevo y vacío.
-- Ordena las definiciones que ya utiliza el panel; no copia datos ni toca el proyecto anterior.
-- Mantener este archivo legible y revisar cambios futuros en una migración independiente.

-- ===== supabase/migrations/20261005143000_crear_site_config_contact_requests.sql =====
-- Animals Friends: tablas iniciales y RLS
-- Generada después de detectar que la migración 20261005121608 estaba vacía.
create table if not exists public.site_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_config enable row level security;

-- Revocar privilegios por defecto y conceder únicamente lectura pública explícita.
revoke all on public.site_config from anon;

drop policy if exists "lectura publica" on public.site_config;
create policy "lectura publica"
  on public.site_config for select
  using (true);

drop policy if exists "admin inserta" on public.site_config;
create policy "admin inserta"
  on public.site_config for insert to authenticated
  with check (lower(auth.jwt() ->> 'email') = lower('petcommunity.133@gmail.com'));

drop policy if exists "admin actualiza" on public.site_config;
create policy "admin actualiza"
  on public.site_config for update to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('petcommunity.133@gmail.com'))
  with check (lower(auth.jwt() ->> 'email') = lower('petcommunity.133@gmail.com'));

grant select on public.site_config to anon, authenticated;
grant insert, update on public.site_config to authenticated;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null check (char_length(nombre) between 2 and 80),
  telefono text not null check (telefono ~ '^[0-9]{7,15}$'),
  correo text check (correo is null or char_length(correo) <= 120),
  mascota text check (mascota is null or char_length(mascota) <= 60),
  servicio text check (servicio is null or servicio ~ '^[a-z0-9-]{1,40}$'),
  mensaje text check (mensaje is null or char_length(mensaje) <= 600),
  acepta_datos boolean not null check (acepta_datos = true),
  version_politica text not null,
  ip_hash text not null,
  estado text not null default 'nuevo' check (estado in ('nuevo','contactado','cerrado')),
  origen text not null default 'web'
);

create index if not exists contact_requests_ip_idx on public.contact_requests (ip_hash, created_at desc);
create index if not exists contact_requests_phone_idx on public.contact_requests (telefono, created_at desc);
create index if not exists contact_requests_state_idx on public.contact_requests (estado, created_at desc);

alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from anon;
revoke all on public.contact_requests from authenticated;
grant select, update on public.contact_requests to authenticated;

drop policy if exists "admin lee mensajes" on public.contact_requests;
create policy "admin lee mensajes"
  on public.contact_requests for select to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('petcommunity.133@gmail.com'));

drop policy if exists "admin actualiza estado" on public.contact_requests;
create policy "admin actualiza estado"
  on public.contact_requests for update to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('petcommunity.133@gmail.com'))
  with check (lower(auth.jwt() ->> 'email') = lower('petcommunity.133@gmail.com'));


-- ===== supabase/migrations/20261007100000_fase1_roles_y_catalogos.sql =====
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


-- ===== supabase/migrations/20261007100100_fase1_duenos_y_mascotas.sql =====
-- =====================================================================
-- ANIMAL FRIENDS · Fase 1 · Paso 2 de 7
-- Dueños, mascotas y todo lo que cuelga de la mascota.
-- =====================================================================
-- Ideas clave de diseño:
--   * Un dueño puede tener varios perros: mascotas.dueno_id apunta a duenos.
--   * El SERVICIO del perro (colegio / hotel / sin servicio) NO se guarda como
--     campo de la mascota. Se calcula cada día a partir de las reservas de hotel
--     y del plan de colegio (ver planes_colegio). Así un perro puede pasar de
--     colegio a hotel y volver sin editar nada a mano, y el historial queda
--     completo.
--   * Nada se borra de verdad: dueños y mascotas se "desactivan". Las llaves
--     foráneas con ON DELETE RESTRICT impiden borrar algo que tenga historial.
--
-- Para deshacerla: supabase/rollbacks/20261007100100_fase1_duenos_y_mascotas_down.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- DUEÑOS (incluye contacto de emergencia)
-- ---------------------------------------------------------------------
create table if not exists public.duenos (
  id                              uuid primary key default gen_random_uuid(),
  -- Reservado para un futuro portal del cliente. Hoy no se usa ni da acceso a nada.
  user_id                         uuid unique references auth.users (id) on delete set null,
  nombre                          text not null check (char_length(nombre) between 2 and 100),
  telefono                        text not null check (telefono ~ '^[0-9]{7,15}$'),   -- solo dígitos, con código de país (para WhatsApp)
  correo                          text check (correo is null or char_length(correo) <= 120),
  direccion                       text check (direccion is null or char_length(direccion) <= 200),
  contacto_emergencia_nombre      text check (contacto_emergencia_nombre is null or char_length(contacto_emergencia_nombre) <= 100),
  contacto_emergencia_telefono    text check (contacto_emergencia_telefono is null or contacto_emergencia_telefono ~ '^[0-9]{7,15}$'),
  contacto_emergencia_parentesco  text check (contacto_emergencia_parentesco is null or char_length(contacto_emergencia_parentesco) <= 60),
  notas                           text,
  activo                          boolean not null default true,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

drop trigger if exists tg_duenos_updated_at on public.duenos;
create trigger tg_duenos_updated_at
  before update on public.duenos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- MASCOTAS
-- ---------------------------------------------------------------------
create table if not exists public.mascotas (
  id                    uuid primary key default gen_random_uuid(),
  dueno_id              uuid not null references public.duenos (id) on delete restrict,
  nombre                text not null check (char_length(nombre) between 1 and 60),
  raza                  text check (raza is null or char_length(raza) <= 60),
  genero                text check (genero is null or genero in ('macho', 'hembra')),
  -- Texto libre a propósito: las categorías de tamaño (y los precios por tamaño)
  -- las define el negocio; no las inventamos aquí.
  tamano                text check (tamano is null or char_length(tamano) <= 30),
  -- Ruta del archivo dentro del bucket privado "fotos-mascotas" (ver migración de storage).
  foto_path             text,
  tipo_comida           text check (tipo_comida is null or char_length(tipo_comida) <= 120),
  comidas_por_dia       smallint check (comidas_por_dia is null or comidas_por_dia between 1 and 10),
  es_bravo              boolean not null default false,
  nota_comportamiento   text,
  esta_enfermo          boolean not null default false,
  detalle_enfermedad    text,
  toma_medicamentos     boolean not null default false,   -- el detalle (cuál, dosis, horario) va en medicamentos_mascota
  activa                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists mascotas_dueno_idx on public.mascotas (dueno_id);

drop trigger if exists tg_mascotas_updated_at on public.mascotas;
create trigger tg_mascotas_updated_at
  before update on public.mascotas
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- MEDICAMENTOS: un perro puede tomar varios, cada uno con su dosis y horario.
-- ---------------------------------------------------------------------
create table if not exists public.medicamentos_mascota (
  id            uuid primary key default gen_random_uuid(),
  mascota_id    uuid not null references public.mascotas (id) on delete cascade,
  medicamento   text not null check (char_length(medicamento) between 2 and 120),
  dosis         text check (dosis is null or char_length(dosis) <= 120),
  horario       text check (horario is null or char_length(horario) <= 120),   -- texto libre, ej. "8:00 y 20:00"
  fecha_inicio  date,
  fecha_fin     date,
  activo        boolean not null default true,
  notas         text,
  created_at    timestamptz not null default now(),
  constraint medicamentos_fechas_ok check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

create index if not exists medicamentos_mascota_idx on public.medicamentos_mascota (mascota_id);

-- ---------------------------------------------------------------------
-- VACUNAS Y DESPARASITACIÓN, con fecha de vencimiento.
-- Una sola tabla para las dos cosas porque las alertas (Fase 7) se calculan igual.
-- ---------------------------------------------------------------------
create table if not exists public.vacunas_mascota (
  id                 uuid primary key default gen_random_uuid(),
  mascota_id         uuid not null references public.mascotas (id) on delete cascade,
  tipo               text not null default 'vacuna' check (tipo in ('vacuna', 'desparasitacion')),
  nombre             text not null check (char_length(nombre) between 2 and 100),
  fecha_aplicacion   date,
  fecha_vencimiento  date not null,
  notas              text,
  created_at         timestamptz not null default now(),
  constraint vacunas_fechas_ok check (fecha_aplicacion is null or fecha_vencimiento >= fecha_aplicacion)
);

-- Para que "qué vence pronto" sea una consulta rápida.
create index if not exists vacunas_vencimiento_idx on public.vacunas_mascota (fecha_vencimiento);
create index if not exists vacunas_mascota_idx     on public.vacunas_mascota (mascota_id);

-- ---------------------------------------------------------------------
-- PERSONAS AUTORIZADAS A RECOGER
-- Se enlazan al DUEÑO (así no hay que repetirlas por cada perro). Si mascota_id
-- viene lleno, la autorización vale solo para ese perro; si es NULL, vale para
-- todos los perros del dueño.
-- ---------------------------------------------------------------------
create table if not exists public.personas_autorizadas (
  id           uuid primary key default gen_random_uuid(),
  dueno_id     uuid not null references public.duenos (id) on delete cascade,
  mascota_id   uuid references public.mascotas (id) on delete cascade,
  nombre       text not null check (char_length(nombre) between 2 and 100),
  telefono     text check (telefono is null or telefono ~ '^[0-9]{7,15}$'),
  parentesco   text check (parentesco is null or char_length(parentesco) <= 60),
  created_at   timestamptz not null default now()
);

create index if not exists personas_autorizadas_dueno_idx on public.personas_autorizadas (dueno_id);

-- ---------------------------------------------------------------------
-- PLAN DE COLEGIO
-- Dice QUÉ DÍAS de la semana le toca colegio a cada perro y en qué período.
-- dias_semana usa numeración ISO: 1 = lunes ... 7 = domingo.
-- Con esto, "¿le toca colegio hoy?" es: el día de hoy está en dias_semana y hoy
-- cae entre desde y hasta. Un mismo perro puede tener varios planes en el tiempo.
-- ---------------------------------------------------------------------
create table if not exists public.planes_colegio (
  id            uuid primary key default gen_random_uuid(),
  mascota_id    uuid not null references public.mascotas (id) on delete cascade,
  dias_semana   smallint[] not null,
  desde         date not null,
  hasta         date,                                   -- NULL = sin fecha de fin
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint planes_dias_validos check (
    cardinality(dias_semana) between 1 and 7
    and dias_semana <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  ),
  constraint planes_fechas_ok check (hasta is null or hasta >= desde)
);

create index if not exists planes_colegio_mascota_idx on public.planes_colegio (mascota_id);

-- ---------------------------------------------------------------------
-- SEGURIDAD (RLS). Aquí solo el admin; el acceso del empleado se agrega en la
-- migración "acceso_empleado", cuando ya existen las rutas y las citas.
-- ---------------------------------------------------------------------
alter table public.duenos                enable row level security;
alter table public.mascotas              enable row level security;
alter table public.medicamentos_mascota  enable row level security;
alter table public.vacunas_mascota       enable row level security;
alter table public.personas_autorizadas  enable row level security;
alter table public.planes_colegio        enable row level security;

revoke all on
  public.duenos, public.mascotas, public.medicamentos_mascota,
  public.vacunas_mascota, public.personas_autorizadas, public.planes_colegio
from anon;

grant select, insert, update, delete on
  public.duenos, public.mascotas, public.medicamentos_mascota,
  public.vacunas_mascota, public.personas_autorizadas, public.planes_colegio
to authenticated;

drop policy if exists "admin_total" on public.duenos;
create policy "admin_total" on public.duenos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.mascotas;
create policy "admin_total" on public.mascotas
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.medicamentos_mascota;
create policy "admin_total" on public.medicamentos_mascota
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.vacunas_mascota;
create policy "admin_total" on public.vacunas_mascota
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.personas_autorizadas;
create policy "admin_total" on public.personas_autorizadas
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_total" on public.planes_colegio;
create policy "admin_total" on public.planes_colegio
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());


-- ===== supabase/migrations/20261007100200_fase1_rutas_hotel_y_agenda.sql =====
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


-- ===== supabase/migrations/20261007100300_fase1_finanzas.sql =====
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


-- ===== supabase/migrations/20261007100400_fase1_acceso_empleado.sql =====
-- =====================================================================
-- ANIMAL FRIENDS · Fase 1 · Paso 5 de 7
-- Acceso del EMPLEADO: solo lo que tiene asignado, nada de dinero.
-- =====================================================================
-- El apartado de empleados (pantallas) es la Fase 8, pero la base de datos queda
-- lista desde ya para no rehacer nada después.
--
-- "Asignado" significa una de dos cosas:
--   1. El perro tiene una parada en una ruta cuyo empleado_id es el del empleado.
--   2. El perro tiene una cita asignada a ese empleado.
-- Todo lo que cuelga de ese perro (su dueño, vacunas, medicamentos, reservas...)
-- se puede ver, y solo eso.
--
-- Lo que el empleado NUNCA puede ver: gastos, pagos, abonos, parámetros,
-- ni las filas de otros empleados (no hay políticas para ello).
-- Lo único que puede ESCRIBIR es marcar sus paradas del día (paradas_dia).
--
-- Para deshacerla: supabase/rollbacks/20261007100400_fase1_acceso_empleado_down.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones de apoyo. SECURITY DEFINER para consultar rutas y citas sin que
-- las propias políticas de esas tablas se crucen entre sí y entren en bucle.
-- ---------------------------------------------------------------------
create or replace function public.ruta_es_mia(p_ruta uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rutas_colegio r
    where r.id = p_ruta
      and r.empleado_id = public.empleado_actual_id()
  );
$$;

create or replace function public.parada_es_mia(p_parada uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.paradas_ruta p
    where p.id = p_parada
      and public.ruta_es_mia(p.ruta_id)
  );
$$;

create or replace function public.mascota_asignada_a_mi(p_mascota uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.paradas_ruta p
      where p.mascota_id = p_mascota
        and public.ruta_es_mia(p.ruta_id)
    )
    or exists (
      select 1
      from public.citas c
      where c.mascota_id = p_mascota
        and c.empleado_id = public.empleado_actual_id()
    );
$$;

create or replace function public.dueno_asignado_a_mi(p_dueno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mascotas m
    where m.dueno_id = p_dueno
      and public.mascota_asignada_a_mi(m.id)
  );
$$;

revoke all on function public.ruta_es_mia(uuid)             from public, anon;
revoke all on function public.parada_es_mia(uuid)           from public, anon;
revoke all on function public.mascota_asignada_a_mi(uuid)   from public, anon;
revoke all on function public.dueno_asignado_a_mi(uuid)     from public, anon;
grant execute on function public.ruta_es_mia(uuid)           to authenticated;
grant execute on function public.parada_es_mia(uuid)         to authenticated;
grant execute on function public.mascota_asignada_a_mi(uuid) to authenticated;
grant execute on function public.dueno_asignado_a_mi(uuid)   to authenticated;

-- ---------------------------------------------------------------------
-- Políticas de LECTURA para el empleado
-- ---------------------------------------------------------------------
drop policy if exists "empleado_ve_su_ruta" on public.rutas_colegio;
create policy "empleado_ve_su_ruta" on public.rutas_colegio
  for select to authenticated
  using (empleado_id = public.empleado_actual_id());

drop policy if exists "empleado_ve_sus_paradas" on public.paradas_ruta;
create policy "empleado_ve_sus_paradas" on public.paradas_ruta
  for select to authenticated
  using (public.ruta_es_mia(ruta_id));

drop policy if exists "empleado_ve_paradas_del_dia" on public.paradas_dia;
create policy "empleado_ve_paradas_del_dia" on public.paradas_dia
  for select to authenticated
  using (public.parada_es_mia(parada_id));

drop policy if exists "empleado_ve_sus_citas" on public.citas;
create policy "empleado_ve_sus_citas" on public.citas
  for select to authenticated
  using (empleado_id = public.empleado_actual_id());

drop policy if exists "empleado_ve_duenos_asignados" on public.duenos;
create policy "empleado_ve_duenos_asignados" on public.duenos
  for select to authenticated
  using (public.dueno_asignado_a_mi(id));

drop policy if exists "empleado_ve_mascotas_asignadas" on public.mascotas;
create policy "empleado_ve_mascotas_asignadas" on public.mascotas
  for select to authenticated
  using (public.mascota_asignada_a_mi(id));

drop policy if exists "empleado_ve_medicamentos_asignados" on public.medicamentos_mascota;
create policy "empleado_ve_medicamentos_asignados" on public.medicamentos_mascota
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

drop policy if exists "empleado_ve_vacunas_asignadas" on public.vacunas_mascota;
create policy "empleado_ve_vacunas_asignadas" on public.vacunas_mascota
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

drop policy if exists "empleado_ve_autorizados_asignados" on public.personas_autorizadas;
create policy "empleado_ve_autorizados_asignados" on public.personas_autorizadas
  for select to authenticated
  using (public.dueno_asignado_a_mi(dueno_id));

drop policy if exists "empleado_ve_planes_asignados" on public.planes_colegio;
create policy "empleado_ve_planes_asignados" on public.planes_colegio
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

drop policy if exists "empleado_ve_ausencias_asignadas" on public.ausencias_colegio;
create policy "empleado_ve_ausencias_asignadas" on public.ausencias_colegio
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

drop policy if exists "empleado_ve_reservas_asignadas" on public.reservas_hotel;
create policy "empleado_ve_reservas_asignadas" on public.reservas_hotel
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

-- ---------------------------------------------------------------------
-- ESCRITURA del empleado: SOLO marcar sus paradas del día.
-- Dos candados:
--  1) La política deja actualizar únicamente paradas de SU ruta.
--  2) El permiso de columnas deja tocar solo estado y motivo. Quién marcó y a
--     qué hora lo escribe el trigger tg_paradas_dia_marcar, no el celular.
-- (El admin también pasa por estos permisos, pero solo necesita editar esas
-- mismas columnas; crear o borrar filas del día sí lo puede hacer completo.)
-- ---------------------------------------------------------------------
revoke update on public.paradas_dia from authenticated;
grant update (estado, motivo) on public.paradas_dia to authenticated;

drop policy if exists "empleado_marca_sus_paradas" on public.paradas_dia;
create policy "empleado_marca_sus_paradas" on public.paradas_dia
  for update to authenticated
  using (public.parada_es_mia(parada_id))
  with check (public.parada_es_mia(parada_id));


-- ===== supabase/migrations/20261007100500_fase1_storage.sql =====
-- =====================================================================
-- ANIMAL FRIENDS · Fase 1 · Paso 6 de 7
-- Almacenamiento de archivos: fotos de mascotas y recibos de gastos.
-- =====================================================================
-- Los dos buckets son PRIVADOS (public = false): nadie puede abrir una foto o un
-- recibo con solo conocer la dirección. La app pide un enlace temporal firmado.
--
--   fotos-mascotas  Las sube el admin. Convención de nombre: <mascota_id>/<archivo>
--                   Un empleado solo puede VER las fotos de sus perros asignados
--                   (la política lee el id del perro desde la primera carpeta).
--   recibos         Solo el admin: son documentos financieros.
--
-- Si la carpeta "storage" no existe en tu proyecto (muy raro en Supabase), esta
-- migración fallará: el resto de la Fase 1 no depende de ella.
--
-- Para deshacerla: supabase/rollbacks/20261007100500_fase1_storage_down.sql
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fotos-mascotas', 'fotos-mascotas', false, 5242880,
     array['image/jpeg', 'image/png', 'image/webp']),
  ('recibos', 'recibos', false, 8388608,
     array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- fotos-mascotas
-- ---------------------------------------------------------------------
drop policy if exists "af_fotos_admin_total" on storage.objects;
create policy "af_fotos_admin_total" on storage.objects
  for all to authenticated
  using      (bucket_id = 'fotos-mascotas' and public.es_admin())
  with check (bucket_id = 'fotos-mascotas' and public.es_admin());

-- El CASE evita que un nombre de carpeta raro (que no sea un uuid) rompa la
-- consulta al intentar convertirlo: si no parece uuid, simplemente no da acceso.
drop policy if exists "af_fotos_empleado_lee_asignadas" on storage.objects;
create policy "af_fotos_empleado_lee_asignadas" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos-mascotas'
    and case
          when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.mascota_asignada_a_mi(((storage.foldername(name))[1])::uuid)
          else false
        end
  );

-- ---------------------------------------------------------------------
-- recibos (solo admin)
-- ---------------------------------------------------------------------
drop policy if exists "af_recibos_admin_total" on storage.objects;
create policy "af_recibos_admin_total" on storage.objects
  for all to authenticated
  using      (bucket_id = 'recibos' and public.es_admin())
  with check (bucket_id = 'recibos' and public.es_admin());


-- ===== supabase/migrations/20261007100600_fase1_admin_por_rol_en_tablas_existentes.sql =====
-- =====================================================================
-- ANIMAL FRIENDS · Fase 1 · Paso 7 de 7
-- El admin por ROL también puede usar site_config y contact_requests.
-- =====================================================================
-- Estas dos tablas ya existen y ya funcionan con una política basada en un correo
-- escrito a mano. NO se tocan ni se borran: aquí solo se SUMAN políticas nuevas.
-- En Postgres las políticas del mismo tipo se combinan con "O", así que:
--   - quien ya podía (el correo de las políticas viejas) sigue pudiendo, y
--   - quien sea admin en la tabla empleados también puede.
-- Cuando confirmes que entras bien como admin por rol, retira las políticas
-- viejas con supabase/manual/retirar_politicas_por_correo.sql (a mano, a propósito).
--
-- Para deshacerla: supabase/rollbacks/20261007100600_fase1_admin_por_rol_en_tablas_existentes_down.sql
-- =====================================================================

drop policy if exists "admin_rol_inserta" on public.site_config;
create policy "admin_rol_inserta" on public.site_config
  for insert to authenticated
  with check (public.es_admin());

drop policy if exists "admin_rol_actualiza" on public.site_config;
create policy "admin_rol_actualiza" on public.site_config
  for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin_rol_lee_mensajes" on public.contact_requests;
create policy "admin_rol_lee_mensajes" on public.contact_requests
  for select to authenticated
  using (public.es_admin());

drop policy if exists "admin_rol_actualiza_mensajes" on public.contact_requests;
create policy "admin_rol_actualiza_mensajes" on public.contact_requests
  for update to authenticated
  using (public.es_admin()) with check (public.es_admin());


-- ===== supabase/migrations/20261008190000_fase2_evitar_borrado_duenos_mascotas.sql =====
-- ANIMAL FRIENDS · Fase 2 · Protección del historial de dueños y mascotas
-- La pantalla ya desactiva estos registros en vez de borrarlos. Este permiso
-- también cierra el borrado directo por PostgREST para sesiones autenticadas.
-- Los registros hijos conservan sus políticas actuales; el admin puede corregir
-- vacunas, medicamentos o autorizados de forma individual cuando hace falta.
revoke delete on table public.duenos, public.mascotas from authenticated;


-- ===== supabase/migrations/20261009120000_fase3_rutas_hotel_operacion.sql =====
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


-- ===== supabase/migrations/20261010120000_fase4_agenda_planeacion.sql =====
-- ANIMAL FRIENDS · Fase 4 · agenda y planeación
-- Cada recorrido tiene su propia capacidad por empleado; NULL significa que
-- aún falta que el negocio configure ese dato, no que la capacidad sea cero.
alter table public.rutas_colegio
  add column if not exists capacidad_perros smallint
  check (capacidad_perros is null or capacidad_perros > 0);


-- ===== supabase/migrations/20261011120000_fase5_finanzas_integridad.sql =====
-- FASE 5: evita que dos abonos simultáneos dejen un cobro sobrepagado.
-- La fila del cobro se bloquea antes de sumar abonos para serializar los cobros
-- concurrentes; también se impide reducir el valor de una factura ya abonada.
create or replace function public.tg_validar_abono_en_saldo()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_total numeric(14, 2);
  v_abonado numeric(14, 2);
begin
  if tg_op = 'UPDATE' and old.pago_id <> new.pago_id then
    perform id
      from public.pagos
     where id in (old.pago_id, new.pago_id)
     order by id
     for update;
  else
    perform id
      from public.pagos
     where id = new.pago_id
     for update;
  end if;

  select valor_total into v_total
    from public.pagos
   where id = new.pago_id;

  if v_total is null then
    raise exception 'El cobro indicado no existe.' using errcode = '23503';
  end if;

  select coalesce(sum(a.valor), 0) into v_abonado
    from public.abonos as a
   where a.pago_id = new.pago_id
     and (tg_op <> 'UPDATE' or a.id <> new.id);

  if v_abonado + new.valor > v_total then
    raise exception 'El abono supera el saldo pendiente del cobro.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tg_abonos_no_sobrepagar on public.abonos;
create trigger tg_abonos_no_sobrepagar
  before insert or update on public.abonos
  for each row execute function public.tg_validar_abono_en_saldo();

create or replace function public.tg_validar_total_pago()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_abonado numeric(14, 2);
begin
  if new.valor_total < old.valor_total then
    select coalesce(sum(a.valor), 0) into v_abonado
      from public.abonos as a
     where a.pago_id = old.id;
    if new.valor_total < v_abonado then
      raise exception 'El total no puede quedar por debajo de los abonos recibidos.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_pagos_respetar_abonos on public.pagos;
create trigger tg_pagos_respetar_abonos
  before update of valor_total on public.pagos
  for each row execute function public.tg_validar_total_pago();


-- ===== supabase/migrations/20261012120000_fase7_alertas_asistencia_historial.sql =====
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
