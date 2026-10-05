-- =====================================================================
-- ANIMAL FRIENDS - Tabla de configuración del sitio (Supabase)
-- =====================================================================
-- 1. Supabase -> SQL Editor -> New query
-- 2. Cambia petcommunity.133@gmail.com (2 veces) por el correo del admin
-- 3. Pega y pulsa RUN
-- =====================================================================

create table if not exists public.site_config (
  id          int primary key default 1 check (id = 1),   -- una sola fila
  data        jsonb not null,                              -- datos del sitio
  updated_at  timestamptz not null default now()
);

alter table public.site_config enable row level security;

-- Cualquier visitante puede LEER (el sitio público necesita los datos)
drop policy if exists "lectura publica" on public.site_config;
create policy "lectura publica"
  on public.site_config for select
  using (true);

-- Solo el correo del administrador puede CREAR / EDITAR
drop policy if exists "admin inserta" on public.site_config;
create policy "admin inserta"
  on public.site_config for insert to authenticated
  with check (lower(auth.jwt() ->> 'email') = lower('petcommunity.133@gmail.com'));

drop policy if exists "admin actualiza" on public.site_config;
create policy "admin actualiza"
  on public.site_config for update to authenticated
  using      (lower(auth.jwt() ->> 'email') = lower('petcommunity.133@gmail.com'))
  with check (lower(auth.jwt() ->> 'email') = lower('petcommunity.133@gmail.com'));

grant select on public.site_config to anon, authenticated;
grant insert, update on public.site_config to authenticated;
