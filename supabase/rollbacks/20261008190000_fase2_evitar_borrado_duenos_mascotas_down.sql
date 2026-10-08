-- Revierte el cambio de permisos de Fase 2.
-- ADVERTENCIA: volver a conceder DELETE permite borrar dueños, mascotas y parte
-- de su historial relacionado. No ejecutes este rollback si quieres conservarlo.
grant delete on table public.duenos, public.mascotas to authenticated;
