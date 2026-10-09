# Rollbacks de migraciones

Cada archivo `_down.sql` corresponde a una migración versionada. Úsalo solo para revertir
deliberadamente un cambio, tras respaldar y revisar el efecto sobre los datos.

El rollback de Fase 3 quita el trigger de validación y las funciones nuevas, pero deja la columna
`localidad` y el valor configurado de `cupos_hotel`. El rollback de Fase 4 conserva
`rutas_colegio.capacidad_perros`. Es intencional: esos datos pueden contener configuración útil
del negocio. El rollback de Fase 5 solo quita triggers y funciones que protegen la consistencia de los abonos;
conserva todos los registros financieros. El rollback de Fase 7 quita las políticas y los triggers nuevos,
pero conserva las tablas de SOAT, asistencia e historial y todas sus filas; sin la política, el historial
queda inaccesible desde las sesiones de la app hasta que se vuelva a aplicar la migración.
Las pruebas estáticas se ejecutan desde la raíz con
`node --test tests/migrations.test.mjs`.
