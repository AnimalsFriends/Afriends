# Animals Friends — migraciones preparadas (NO APLICADAS)

Proyecto Supabase: xjpivjxagyzeeqinlzkz. Auditoría 2026-11-12.

Estado remoto: 3 migraciones registradas; 3 citas existentes; faltan mensajes_equipo, cita_empleados y citas.fecha_servicio. Las funciones es_admin, empleado_actual_id, parada_es_mia y ruta_es_mia existen.

Orden de aplicación propuesto:
1. 20261022120000_mensajes_admin_empleado.sql
2. 20261024120000_agenda_empleados_y_horario_opcional.sql
3. 20261111120000_operacion_empleado_resiliente.sql

ADVERTENCIA: No ejecutar automáticamente ni marcar como aplicadas las migraciones locales anteriores: el historial remoto utiliza versiones consolidadas diferentes. Antes de ejecutar, revisar diferencias funcionales, políticas RLS y permisos, especialmente las migraciones locales de responsable_mascota. Revisar que las 3 citas existentes puedan recibir fecha_servicio sin null. Probar con roles admin y empleado reales; verificar que la función guardar_cita_agenda pueda escribir bajo RLS.

Los archivos SQL se copian sin alterar del ZIP del usuario. No se ha modificado la base remota.
