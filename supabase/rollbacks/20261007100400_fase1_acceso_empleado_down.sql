-- Deshace el paso 5: quita las políticas del empleado y sus funciones de apoyo.
drop policy if exists "empleado_marca_sus_paradas"            on public.paradas_dia;
drop policy if exists "empleado_ve_reservas_asignadas"        on public.reservas_hotel;
drop policy if exists "empleado_ve_ausencias_asignadas"       on public.ausencias_colegio;
drop policy if exists "empleado_ve_planes_asignados"          on public.planes_colegio;
drop policy if exists "empleado_ve_autorizados_asignados"     on public.personas_autorizadas;
drop policy if exists "empleado_ve_vacunas_asignadas"         on public.vacunas_mascota;
drop policy if exists "empleado_ve_medicamentos_asignados"    on public.medicamentos_mascota;
drop policy if exists "empleado_ve_mascotas_asignadas"        on public.mascotas;
drop policy if exists "empleado_ve_duenos_asignados"          on public.duenos;
drop policy if exists "empleado_ve_sus_citas"                 on public.citas;
drop policy if exists "empleado_ve_paradas_del_dia"           on public.paradas_dia;
drop policy if exists "empleado_ve_sus_paradas"               on public.paradas_ruta;
drop policy if exists "empleado_ve_su_ruta"                   on public.rutas_colegio;

-- Devuelve a paradas_dia el permiso de actualizar todas sus columnas.
grant update on public.paradas_dia to authenticated;

drop function if exists public.dueno_asignado_a_mi(uuid);
drop function if exists public.mascota_asignada_a_mi(uuid);
drop function if exists public.parada_es_mia(uuid);
drop function if exists public.ruta_es_mia(uuid);
