# Rollbacks de migraciones

Cada archivo `_down.sql` corresponde a una migración versionada. Úsalo solo para revertir
deliberadamente un cambio, tras respaldar y revisar el efecto sobre los datos.

El rollback de Fase 3 quita el trigger de validación y las funciones nuevas, pero deja la columna
`localidad` y el valor configurado de `cupos_hotel`. El rollback de Fase 4 conserva
`rutas_colegio.capacidad_perros`. Es intencional: esos datos pueden contener configuración útil
del negocio. Las pruebas estáticas se ejecutan desde la raíz con `node --test tests/migrations.test.mjs`.
