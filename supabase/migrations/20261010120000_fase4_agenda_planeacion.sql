-- ANIMAL FRIENDS · Fase 4 · agenda y planeación
-- Cada recorrido tiene su propia capacidad por empleado; NULL significa que
-- aún falta que el negocio configure ese dato, no que la capacidad sea cero.
alter table public.rutas_colegio
  add column if not exists capacidad_perros smallint
  check (capacidad_perros is null or capacidad_perros > 0);
