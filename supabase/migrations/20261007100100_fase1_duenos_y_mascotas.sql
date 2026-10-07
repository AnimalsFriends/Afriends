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
