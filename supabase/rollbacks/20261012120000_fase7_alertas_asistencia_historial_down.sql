-- Rollback seguro de Fase 7.
-- Retira el comportamiento y los permisos nuevos, pero conserva tablas y filas.
-- Volver a ejecutar la migración repone los triggers y las políticas.

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
  end loop;
end;
$$;

drop trigger if exists tg_soat_vehiculos_updated_at on public.soat_vehiculos;
drop trigger if exists tg_asistencia_colegio_marcar on public.asistencia_colegio;
drop trigger if exists tg_asistencia_colegio_updated_at on public.asistencia_colegio;
drop policy if exists "admin_total" on public.soat_vehiculos;
drop policy if exists "admin_total" on public.asistencia_colegio;
drop policy if exists "admin_lee_historial" on public.historial_cambios;
revoke all on public.soat_vehiculos, public.asistencia_colegio, public.historial_cambios
  from public, anon, authenticated;
drop function if exists public.tg_asistencia_colegio_marcar();
drop function if exists public.tg_registrar_cambio();
