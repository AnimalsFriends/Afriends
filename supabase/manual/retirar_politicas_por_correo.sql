-- =====================================================================
-- MANUAL · Retirar las políticas viejas basadas en un correo escrito a mano
-- =====================================================================
-- NO es una migración: no se ejecuta sola. Córrelo tú, en el SQL Editor de
-- Supabase, SOLO después de comprobar que:
--   1. Ya creaste tu fila de admin en la tabla empleados (ver supabase/README.md).
--   2. Entras al panel /admin/ con ese usuario y puedes guardar cambios del sitio
--      y ver los mensajes. (Eso funciona por las políticas nuevas "admin_rol_...")
-- Si lo corres antes, podrías quedarte sin acceso al panel actual.
--
-- Qué hace: quita las 4 políticas que dependían de CORREO_DEL_CLIENTE@... para que
-- el único camino sea el rol. Para volver atrás, vuelve a pegar 01_site_config.sql
-- y 02_contact_requests.sql (son idempotentes).
-- =====================================================================

drop policy if exists "admin inserta"         on public.site_config;
drop policy if exists "admin actualiza"       on public.site_config;
drop policy if exists "admin lee mensajes"    on public.contact_requests;
drop policy if exists "admin actualiza estado" on public.contact_requests;
