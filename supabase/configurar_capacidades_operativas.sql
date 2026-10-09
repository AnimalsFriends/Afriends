
-- Animals Friends - Fase 1
-- Define capacidades operativas solo si aún no están configuradas.
-- No elimina tablas ni registros y conserva valores ya definidos.

BEGIN;

UPDATE public.parametros_operativos
SET
    cupos_hotel = COALESCE(cupos_hotel, 50),
    perros_por_empleado = COALESCE(perros_por_empleado, 50),
    updated_at = CASE
        WHEN cupos_hotel IS NULL OR perros_por_empleado IS NULL
        THEN now()
        ELSE updated_at
    END
WHERE id = 1;

COMMIT;

-- Verificación posterior:
SELECT id, cupos_hotel, perros_por_empleado, updated_at
FROM public.parametros_operativos
WHERE id = 1;
