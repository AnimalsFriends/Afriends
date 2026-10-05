-- Animals Friends: tablas iniciales y RLS
-- Generada después de detectar que la migración 20261005121608 estaba vacía.
create table if not exists public.site_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_config enable row level security;

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
revoke all on public.contact_requests from anon, authenticated;
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
