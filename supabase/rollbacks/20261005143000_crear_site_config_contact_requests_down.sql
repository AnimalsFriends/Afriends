-- Rollback manual de la migración 20261005143000.
-- ADVERTENCIA: elimina las tablas y sus datos. Ejecutar solo si se desea deshacer
-- explícitamente esta migración y después de verificar que no hay datos necesarios.
drop table if exists public.contact_requests;
drop table if exists public.site_config;
