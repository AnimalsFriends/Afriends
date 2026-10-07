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
