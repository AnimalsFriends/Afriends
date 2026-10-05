-- =====================================================================
-- ANIMAL FRIENDS - Mensajes del formulario de contacto (Supabase)
-- =====================================================================
-- 1. Supabase -> SQL Editor -> New query
-- 2. Cambia CORREO_DEL_CLIENTE@ejemplo.com (4 veces) por el correo del administrador
-- 3. Pega todo y pulsa RUN
--
-- Seguridad: la tabla NO tiene políticas para visitantes anónimos. Solo la
-- Cloudflare Function (con la clave de servicio, que ignora RLS) puede insertar.
-- El administrador puede LEER y actualizar el estado desde el panel de Supabase.
-- =====================================================================

create table if not exists public.contact_requests (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  nombre           text not null check (char_length(nombre) between 2 and 80),
  telefono         text not null check (telefono ~ '^[0-9]{7,15}$'),
  correo           text check (correo is null or char_length(correo) <= 120),
  mascota          text check (mascota is null or char_length(mascota) <= 60),
  servicio         text check (servicio is null or servicio ~ '^[a-z0-9-]{1,40}$'),
  mensaje          text check (mensaje is null or char_length(mensaje) <= 600),
  acepta_datos     boolean not null check (acepta_datos = true),   -- autorización de tratamiento de datos
  version_politica text not null,                                  -- fecha de la política aceptada
  ip_hash          text not null,                                  -- hash de la IP (antispam), nunca la IP
  estado           text not null default 'nuevo' check (estado in ('nuevo','contactado','cerrado')),
  origen           text not null default 'web'
);

create index if not exists contact_requests_ip_idx    on public.contact_requests (ip_hash,  created_at desc);
create index if not exists contact_requests_phone_idx on public.contact_requests (telefono, created_at desc);
create index if not exists contact_requests_state_idx on public.contact_requests (estado,   created_at desc);

alter table public.contact_requests enable row level security;

-- Sin acceso para visitantes ni usuarios por defecto
revoke all on public.contact_requests from anon, authenticated;

-- Solo el correo del administrador puede ver y cambiar el estado
grant select, update on public.contact_requests to authenticated;

drop policy if exists "admin lee mensajes" on public.contact_requests;
create policy "admin lee mensajes"
  on public.contact_requests for select to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('CORREO_DEL_CLIENTE@ejemplo.com'));

drop policy if exists "admin actualiza estado" on public.contact_requests;
create policy "admin actualiza estado"
  on public.contact_requests for update to authenticated
  using      (lower(auth.jwt() ->> 'email') = lower('CORREO_DEL_CLIENTE@ejemplo.com'))
  with check (lower(auth.jwt() ->> 'email') = lower('CORREO_DEL_CLIENTE@ejemplo.com'));

-- Retención (opcional, recomendado): borra mensajes de más de 24 meses.
-- Ejecútalo a mano de vez en cuando, o prográmalo con pg_cron.
--   delete from public.contact_requests where created_at < now() - interval '24 months';
