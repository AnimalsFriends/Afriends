-- Rollback de agenda: asignación múltiple y horario opcional.
-- ADVERTENCIA: no ejecutar como rutina. La eliminación de cita_empleados pierde
-- las asignaciones adicionales; las citas conservan su empleado principal.
begin;

revoke all on function public.guardar_cita_agenda(uuid, uuid, uuid[], text, date, timestamptz, timestamptz, text, text) from public, anon, authenticated;
drop function if exists public.guardar_cita_agenda(uuid, uuid, uuid[], text, date, timestamptz, timestamptz, text, text);

drop policy if exists cita_empleados_empleado_ve_asignaciones on public.cita_empleados;
drop policy if exists cita_empleados_admin_total on public.cita_empleados;
drop table if exists public.cita_empleados;

drop policy if exists empleado_ve_sus_citas on public.citas;
create policy empleado_ve_sus_citas
  on public.citas for select to authenticated
  using (empleado_id = public.empleado_actual_id());

alter table public.citas
  drop constraint if exists citas_horario_opcional_ok;

-- No se fuerza NOT NULL: las citas creadas sin hora deben corregirse antes
-- de volver al esquema anterior. fecha_servicio se conserva para no perder datos.
commit;
