-- =====================================================================
-- ANIMAL FRIENDS · Fase 1 · Paso 5 de 7
-- Acceso del EMPLEADO: solo lo que tiene asignado, nada de dinero.
-- =====================================================================
-- El apartado de empleados (pantallas) es la Fase 8, pero la base de datos queda
-- lista desde ya para no rehacer nada después.
--
-- "Asignado" significa una de dos cosas:
--   1. El perro tiene una parada en una ruta cuyo empleado_id es el del empleado.
--   2. El perro tiene una cita asignada a ese empleado.
-- Todo lo que cuelga de ese perro (su dueño, vacunas, medicamentos, reservas...)
-- se puede ver, y solo eso.
--
-- Lo que el empleado NUNCA puede ver: gastos, pagos, abonos, parámetros,
-- ni las filas de otros empleados (no hay políticas para ello).
-- Lo único que puede ESCRIBIR es marcar sus paradas del día (paradas_dia).
--
-- Para deshacerla: supabase/rollbacks/20261007100400_fase1_acceso_empleado_down.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones de apoyo. SECURITY DEFINER para consultar rutas y citas sin que
-- las propias políticas de esas tablas se crucen entre sí y entren en bucle.
-- ---------------------------------------------------------------------
create or replace function public.ruta_es_mia(p_ruta uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rutas_colegio r
    where r.id = p_ruta
      and r.empleado_id = public.empleado_actual_id()
  );
$$;

create or replace function public.parada_es_mia(p_parada uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.paradas_ruta p
    where p.id = p_parada
      and public.ruta_es_mia(p.ruta_id)
  );
$$;

create or replace function public.mascota_asignada_a_mi(p_mascota uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.paradas_ruta p
      where p.mascota_id = p_mascota
        and public.ruta_es_mia(p.ruta_id)
    )
    or exists (
      select 1
      from public.citas c
      where c.mascota_id = p_mascota
        and c.empleado_id = public.empleado_actual_id()
    );
$$;

create or replace function public.dueno_asignado_a_mi(p_dueno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mascotas m
    where m.dueno_id = p_dueno
      and public.mascota_asignada_a_mi(m.id)
  );
$$;

revoke all on function public.ruta_es_mia(uuid)             from public, anon;
revoke all on function public.parada_es_mia(uuid)           from public, anon;
revoke all on function public.mascota_asignada_a_mi(uuid)   from public, anon;
revoke all on function public.dueno_asignado_a_mi(uuid)     from public, anon;
grant execute on function public.ruta_es_mia(uuid)           to authenticated;
grant execute on function public.parada_es_mia(uuid)         to authenticated;
grant execute on function public.mascota_asignada_a_mi(uuid) to authenticated;
grant execute on function public.dueno_asignado_a_mi(uuid)   to authenticated;

-- ---------------------------------------------------------------------
-- Políticas de LECTURA para el empleado
-- ---------------------------------------------------------------------
drop policy if exists "empleado_ve_su_ruta" on public.rutas_colegio;
create policy "empleado_ve_su_ruta" on public.rutas_colegio
  for select to authenticated
  using (empleado_id = public.empleado_actual_id());

drop policy if exists "empleado_ve_sus_paradas" on public.paradas_ruta;
create policy "empleado_ve_sus_paradas" on public.paradas_ruta
  for select to authenticated
  using (public.ruta_es_mia(ruta_id));

drop policy if exists "empleado_ve_paradas_del_dia" on public.paradas_dia;
create policy "empleado_ve_paradas_del_dia" on public.paradas_dia
  for select to authenticated
  using (public.parada_es_mia(parada_id));

drop policy if exists "empleado_ve_sus_citas" on public.citas;
create policy "empleado_ve_sus_citas" on public.citas
  for select to authenticated
  using (empleado_id = public.empleado_actual_id());

drop policy if exists "empleado_ve_duenos_asignados" on public.duenos;
create policy "empleado_ve_duenos_asignados" on public.duenos
  for select to authenticated
  using (public.dueno_asignado_a_mi(id));

drop policy if exists "empleado_ve_mascotas_asignadas" on public.mascotas;
create policy "empleado_ve_mascotas_asignadas" on public.mascotas
  for select to authenticated
  using (public.mascota_asignada_a_mi(id));

drop policy if exists "empleado_ve_medicamentos_asignados" on public.medicamentos_mascota;
create policy "empleado_ve_medicamentos_asignados" on public.medicamentos_mascota
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

drop policy if exists "empleado_ve_vacunas_asignadas" on public.vacunas_mascota;
create policy "empleado_ve_vacunas_asignadas" on public.vacunas_mascota
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

drop policy if exists "empleado_ve_autorizados_asignados" on public.personas_autorizadas;
create policy "empleado_ve_autorizados_asignados" on public.personas_autorizadas
  for select to authenticated
  using (public.dueno_asignado_a_mi(dueno_id));

drop policy if exists "empleado_ve_planes_asignados" on public.planes_colegio;
create policy "empleado_ve_planes_asignados" on public.planes_colegio
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

drop policy if exists "empleado_ve_ausencias_asignadas" on public.ausencias_colegio;
create policy "empleado_ve_ausencias_asignadas" on public.ausencias_colegio
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

drop policy if exists "empleado_ve_reservas_asignadas" on public.reservas_hotel;
create policy "empleado_ve_reservas_asignadas" on public.reservas_hotel
  for select to authenticated
  using (public.mascota_asignada_a_mi(mascota_id));

-- ---------------------------------------------------------------------
-- ESCRITURA del empleado: SOLO marcar sus paradas del día.
-- Dos candados:
--  1) La política deja actualizar únicamente paradas de SU ruta.
--  2) El permiso de columnas deja tocar solo estado y motivo. Quién marcó y a
--     qué hora lo escribe el trigger tg_paradas_dia_marcar, no el celular.
-- (El admin también pasa por estos permisos, pero solo necesita editar esas
-- mismas columnas; crear o borrar filas del día sí lo puede hacer completo.)
-- ---------------------------------------------------------------------
revoke update on public.paradas_dia from authenticated;
grant update (estado, motivo) on public.paradas_dia to authenticated;

drop policy if exists "empleado_marca_sus_paradas" on public.paradas_dia;
create policy "empleado_marca_sus_paradas" on public.paradas_dia
  for update to authenticated
  using (public.parada_es_mia(parada_id))
  with check (public.parada_es_mia(parada_id));
