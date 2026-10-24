# Auditoría de agenda — asignación múltiple y horarios opcionales

Estado: preparación en rama aislada; no se ha aplicado SQL ni se ha desplegado.

## Hallazgos confirmados en código

- `src/admin/models/agendaModel.js`: `validarCita` exige inicio y fin y solo admite un `empleado_id`.
- `src/admin/models/agendaModel.js`: `conflictosCita` detecta solapamientos de empleado sin distinguir los servicios de hotel/colegio.
- `src/admin/views/agendaViews.js`: el formulario muestra un selector único de empleado y marca inicio/fin como obligatorios.
- `src/admin/services/agendaApi.js`: crea/actualiza directamente una fila de `citas` con un único empleado.
- `src/admin/controllers/AgendaController.js`: la comprobación de conflictos se ejecuta antes de guardar una cita con horario.

## Hallazgo de Supabase que bloquea cualquier aplicación de SQL

El proyecto `BD-AnimalsFriends` (ref `xjpivjxagyzeeqinlzkz`) tiene en su historial remoto solo tres migraciones (`20261011183639`, `20261022154554`, `20261022154607`), aunque el esquema real ya contiene las tablas operativas, políticas RLS y triggers de varias fases. El proyecto anterior `AnimalsFriends's Project` sí registra un historial más extenso y también contiene `citas`, `servicios` y `reservas_hotel`. Por tanto, no debe ejecutarse `db push` ni esta migración hasta reconciliar el historial con el esquema real.

En `BD-AnimalsFriends` se confirmó:
- RLS habilitado en `citas`, `servicios`, `reservas_hotel` y `empleados`.
- `citas.empleado_id` admite NULL; `citas.inicio` y `citas.fin` son NOT NULL.
- La política de lectura de empleados para `citas` depende de `empleado_id = empleado_actual_id()`; debe ampliarse cuidadosamente para reconocer asignaciones múltiples.
- `reservas_hotel` y `citas` tienen triggers de auditoría; `reservas_hotel` tiene además un trigger de validación de cupos. La propuesta no modifica reservas ni capacidad hotelera.
- No se han leído ni mostrado datos personales de las mascotas o sus propietarios.

## Diseño de la corrección preparada

- Agregar `fecha_servicio` para que la agenda pueda mostrar servicios aunque no tengan hora.
- Permitir `inicio` y `fin` ambos NULL; si uno tiene valor, ambos deben estar presentes y el final debe ser posterior al inicio.
- Crear `cita_empleados` con clave compuesta para varios empleados por cita, conservando el empleado principal en `citas.empleado_id` por compatibilidad.
- Guardar la cita y las asignaciones en una función PostgreSQL invoker para mantener la operación atómica y sujeta a RLS.
- Mantener advertencias de conflicto por perro y por empleado para citas con horario real; no inferir horarios para servicios sin hora.

## Alcance pendiente antes de habilitar

La migración y sus pruebas estáticas quedan preparadas para revisión. La interfaz y el cliente REST deben actualizarse para:
1. seleccionar varios empleados;
2. guardar/editar mediante `guardar_cita_agenda`;
3. mostrar citas por `fecha_servicio`, con etiqueta “Horario por definir” cuando no haya horas;
4. no buscar conflictos horarios para registros sin hora;
5. añadir pruebas de modelo, API, controlador y vista, y ejecutar `npm run check`.

No aplicar esta migración hasta completar ese trabajo y revisar el SQL en una base de pruebas.