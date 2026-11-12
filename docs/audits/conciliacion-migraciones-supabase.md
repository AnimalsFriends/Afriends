# Conciliación de migraciones — BD-AnimalsFriends

**Fecha:** 2026-11-12  
**Proyecto objetivo:** `BD-AnimalsFriends` (`xjpivjxagyzeeqinlzkz`)  
**Alcance:** diagnóstico y preparación; no se ejecutó SQL contra Supabase ni se modificó el historial remoto.

## Conclusión ejecutiva

La aplicación de producción queda **bloqueada hasta una verificación remota de solo lectura**. El repositorio contiene 19 migraciones locales, mientras que el historial remoto reportado contiene 3 entradas. El esquema remoto, según el contexto suministrado, ya incluye la mayoría de las estructuras operativas, pero no `mensajes_equipo` ni `cita_empleados`; por tanto, un `supabase db push` podría intentar reproducir migraciones históricas contra objetos y políticas que ya existen.

La secuencia funcional que debe probarse, una vez confirmadas todas las precondiciones, es:

1. `20261022120000_mensajes_admin_empleado.sql`
2. `20261024120000_agenda_empleados_y_horario_opcional.sql`
3. `20261111120000_operacion_empleado_resiliente.sql`

La primera y segunda migración no dependen entre sí; ese orden respeta la secuencia versionada. La tercera requiere las estructuras `responsable_empleado_id`, `paradas_dia` y `cita_empleados`. No volver a aplicar `20261022120100_responsable_mascota.sql` ni `20261022120200_mascotas_propias_permanentes.sql` si la lectura remota confirma que ya están implementadas.

No es seguro afirmar que la secuencia concilia el registro remoto hasta mapear las tres entradas remotas con sus SQL exactos, revisar los objetos y permisos actuales, y verificar los datos reales. Con las herramientas disponibles en esta sesión no se pudo abrir una conexión de solo lectura al proyecto: no hay CLI `supabase`/`psql` disponible ni un conector de base de datos. El ID, estado y conteo remoto se tratan como datos proporcionados por el usuario, no como hallazgos consultados ahora.

## Evidencia y límites

- No se encontró `AGENTS.md`.
- Se revisaron `README.md`, `supabase/README.md`, `supabase/migrations/README.md`, `supabase/rollbacks/README.md` y `docs/audits/agenda-correccion-plan.md`, además de los 19 archivos SQL locales.
- La migración `20261005121608_crear_tablas_iniciales.sql` está vacía y es un artefacto histórico; no debe rellenarse ni reutilizarse.
- Los documentos contienen observaciones históricas sobre conexiones y conteos remotos, algunas fechadas antes de esta revisión. No son evidencia suficiente del estado remoto actual.
- El test de integración usa PGlite y un conjunto de tablas/funciones Supabase simulado. No es una copia estructural generada desde el proyecto remoto ni verifica datos reales, extensiones, roles, objetos administrados por Supabase, buckets existentes o políticas no representadas en sus fixtures.

### Inventario local (19 archivos)

| Orden | Migración | Evaluación respecto al estado reportado |
|---:|---|---|
| 1 | `20261005121608_crear_tablas_iniciales.sql` | Vacía; conservar como historia, no ejecutar ni completar. |
| 2 | `20261005143000_crear_site_config_contact_requests.sql` | Base pública histórica. Confirmar esquema y políticas reales; no asumir que el historial escaso significa que falten las tablas. |
| 3 | `20261007100000_fase1_roles_y_catalogos.sql` | Roles, funciones comunes y catálogos; el esquema reportado ya incluye estas estructuras. |
| 4 | `20261007100100_fase1_duenos_y_mascotas.sql` | Modelo de dueños/mascotas y tablas relacionadas; no reejecutar a ciegas. |
| 5 | `20261007100200_fase1_rutas_hotel_y_agenda.sql` | Rutas, hotel, citas y políticas iniciales; verificar definiciones actuales. |
| 6 | `20261007100300_fase1_finanzas.sql` | Tablas financieras y acceso admin-only; verificar permisos efectivos. |
| 7 | `20261007100400_fase1_acceso_empleado.sql` | Función de asignación, RLS y privilegios por columna. |
| 8 | `20261007100500_fase1_storage.sql` | Buckets y políticas de storage; confirmar aparte porque no forman parte del esquema `public`. |
| 9 | `20261007100600_fase1_admin_por_rol_en_tablas_existentes.sql` | Añade políticas admin por rol a tablas preexistentes; RLS permisivo combina políticas con OR. |
| 10 | `20261008190000_fase2_evitar_borrado_duenos_mascotas.sql` | Revoca `DELETE`; comprobar el permiso efectivo remoto antes de cualquier intervención. |
| 11 | `20261009120000_fase3_rutas_hotel_operacion.sql` | Añade localidad, inicializa cupo solo si es NULL y crea funciones/triggers. Su `UPDATE` puede cambiar `cupos_hotel` de NULL a 50. |
| 12 | `20261010120000_fase4_agenda_planeacion.sql` | Añade capacidad opcional a rutas. |
| 13 | `20261011120000_fase5_finanzas_integridad.sql` | Añade triggers de saldo; revisar compatibilidad con triggers ya existentes. |
| 14 | `20261012120000_fase7_alertas_asistencia_historial.sql` | Crea tablas, RLS y triggers de auditoría. Puede ser costosa; no recrear sobre objetos existentes sin comparar definiciones. |
| 15 | `20261022120000_mensajes_admin_empleado.sql` | Pendiente según el contexto; crea mensajería y funciones restringidas. |
| 16 | `20261022120100_responsable_mascota.sql` | El campo existe según el contexto, pero hay una diferencia de SQL/ACL que se debe comprobar. |
| 17 | `20261022120200_mascotas_propias_permanentes.sql` | Se modela como existente en el test local; confirmar columna y definición del trigger de cupos en remoto. |
| 18 | `20261024120000_agenda_empleados_y_horario_opcional.sql` | Pendiente según el contexto; crea `cita_empleados`, migra asignaciones y hace opcional el horario. |
| 19 | `20261111120000_operacion_empleado_resiliente.sql` | Objetivo final; no ejecutar antes de la migración de agenda. |

El inventario no demuestra cuáles de las 19 entradas constan en el historial remoto: la historia reportada de solo tres versiones no proporciona una correspondencia verificable con estos nombres.

## Dependencias y revisión de seguridad

### `responsable_mascota`

La función `public.mascota_asignada_a_mi(uuid)` es `SECURITY DEFINER` y fija `search_path = ''`. El archivo local `20261022120100_responsable_mascota.sql` reemplaza la función, pero no declara explícitamente su ACL; en la secuencia local, la migración de acceso empleado anterior ya había revocado el acceso a `PUBLIC`/`anon` y concedido `authenticated`. En PostgreSQL, `CREATE OR REPLACE FUNCTION` conserva el propietario y los privilegios existentes, por lo que la omisión no implica por sí sola que el acceso se haya abierto.

El fixture de integración añade explícitamente el `REVOKE`/`GRANT` reportado en la versión remota. Esto modela una diferencia del SQL, pero no verifica la ACL actual de producción. Antes de decidir, comprobar:

- `anon` y `PUBLIC` no tienen `EXECUTE`;
- `authenticated` sí tiene `EXECUTE`;
- `prosecdef = true` y `search_path` permanece vacío;
- la definición conserva la lógica prevista: responsable compartido si el responsable es NULL, sin excluir asignaciones por ruta o cita.

**Acción propuesta:** si el ACL remoto ya es correcto, no cambiar esta migración histórica ni añadir una migración redundante. Si no lo es, preparar una migración nueva, versionada y aditiva con el `REVOKE`/`GRANT` de abajo; revisarla y solicitar aprobación antes de ejecutarla.

```sql
-- SQL correctivo propuesto; no ejecutado.
revoke all on function public.mascota_asignada_a_mi(uuid) from public, anon;
grant execute on function public.mascota_asignada_a_mi(uuid) to authenticated;
```

### `mensajes_equipo` antes de agenda

`mensajes_equipo` no tiene dependencia con `cita_empleados` ni `citas`; puede desplegarse antes de agenda. Tiene RLS, `SELECT` autenticado y sin `INSERT`/`UPDATE` directo para `authenticated`; el envío y el marcado de lectura se realizan mediante funciones `SECURITY DEFINER` con `search_path` vacío y `EXECUTE` solo para `authenticated`. La política de lectura limita las filas al administrador o al empleado de la conversación. La prueba sintética confirma que el empleado no puede enviar un mensaje a otra conversación.

### Agenda

- Backfillea `fecha_servicio` desde `inicio` en hora de Bogotá antes de hacerla `NOT NULL`.
- Permite que ambas horas sean NULL; rechaza una sola hora NULL o `fin <= inicio`.
- Crea `cita_empleados` con clave compuesta y FKs; copia el `empleado_id` existente sin borrar ni cambiar la columna principal.
- Solo administradores reciben política de escritura en `cita_empleados`; los empleados tienen lectura de sus asignaciones. La política de lectura de citas reconoce asignación principal y secundaria.
- `guardar_cita_agenda` es `SECURITY INVOKER`, por lo que conserva la evaluación de RLS y requiere permisos efectivos del usuario llamante.
- Antes de crear la tabla, contar citas con empleado asignado y revisar asignaciones a empleados inactivos. La función de backfill no filtra empleados inactivos.

### Operación resiliente

La última migración añade dos columnas informativas/operativas a `paradas_dia`, incluye asignaciones secundarias de cita en `mascota_asignada_a_mi`, y da permisos de columna para que el empleado pueda insertar solo `parada_id`/`fecha` y actualizar `estado`/`motivo`/`ocurrido_cliente_en`. El trigger conserva `marcado_por`, `marcado_en` y `sincronizado_en` como marcas autoritativas de servidor y limita la hora declarada del dispositivo. Su política de inserción exige una parada propia.

## Preflight remoto de solo lectura

Ejecutar únicamente en el SQL Editor del proyecto cuyo ref se haya confirmado, tras abrir una sesión de solo lectura. Estas consultas no cambian datos. Guardar resultados agregados y metadatos, no exportar datos personales.

```sql
-- Objetos, RLS y columnas críticas.
select n.nspname as esquema, c.relname as tabla,
       c.relrowsecurity as rls_habilitado, c.relforcerowsecurity as rls_forzado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('mascotas', 'citas', 'paradas_dia', 'cita_empleados', 'mensajes_equipo')
order by c.relname;

select table_name, column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('mascotas', 'responsable_empleado_id'),
    ('mascotas', 'es_mascota_propia'),
    ('citas', 'empleado_id'), ('citas', 'inicio'), ('citas', 'fin'),
    ('citas', 'fecha_servicio'),
    ('paradas_dia', 'ocurrido_cliente_en'), ('paradas_dia', 'sincronizado_en')
  )
order by table_name, ordinal_position;

-- Definición y permisos efectivos de la función de acceso por mascota.
select p.prosecdef, p.proconfig, p.proacl,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.oid = 'public.mascota_asignada_a_mi(uuid)'::regprocedure;

-- Políticas y triggers existentes en las tablas afectadas.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('mascotas', 'citas', 'paradas_dia', 'cita_empleados', 'mensajes_equipo')
order by tablename, policyname;

select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('mascotas', 'citas', 'paradas_dia')
order by event_object_table, trigger_name;

-- Integridad de los datos que la migración de agenda transforma.
select
  count(*) filter (where inicio is null or fin is null) as citas_sin_horario,
  count(*) filter (where inicio is not null and fin is not null and fin <= inicio) as horarios_invalidos,
  count(*) filter (where empleado_id is not null) as asignaciones_primarias_a_migrar
from public.citas;

select count(*) as asignaciones_a_empleados_inactivos
from public.citas c
join public.empleados e on e.id = c.empleado_id
where e.activo is false;

select count(*) as responsables_inactivos
from public.mascotas m
join public.empleados e on e.id = m.responsable_empleado_id
where e.activo is false;
```

También se debe inspeccionar `supabase_migrations.schema_migrations` sin insertar, borrar ni actualizar filas; registrar los tres `version`/`name` remotos y compararlos con el contenido/hashes de los SQL que realmente los originaron. Si el nombre o SQL original no puede recuperarse, documentar la discrepancia como no resuelta; no marcar versiones como aplicadas para hacer coincidir conteos.

## Validación aislada ejecutada

Comandos ejecutados localmente:

- `node --test tests\migrationSequence.integration.test.mjs`: **5/5** pruebas, incluye mensajería, backfill/asignaciones de agenda, operación resiliente y rollback sintético.
- `npm test`: **263/263** pruebas, 0 fallos.

La prueba de secuencia construye con PGlite un esquema ficticio aplicando las migraciones locales base, agrega el ACL remoto esperado para la función de responsable, simula filas de empleados/mascotas/rutas/citas y aplica las tres migraciones en orden. No incluye una restauración de backup remoto ni prueba contra extensiones, roles, datos, triggers o políticas desconocidos del proyecto. Por tanto, valida la secuencia SQL modelada, no la equivalencia del modelo con producción.

El árbol ya tenía cambios previos en `package.json` y archivos no rastreados `package-lock.json` y `tests/migrationSequence.integration.test.mjs`. Se conservaron intactos. Las pruebas incluyen dicho test existente; no se atribuyen esos cambios a este diagnóstico.

## Procedimiento de despliegue (solo tras aprobación)

1. Obtener y comprobar un backup/restauración o branch aislado creado desde el estado actual de `BD-AnimalsFriends`; verificar que el destino no es producción.
2. Ejecutar el preflight de solo lectura y conservar conteos, metadatos de esquema, políticas, triggers, ACL y versiones remotas. Resolver diferencias de `responsable_mascota` sin suponer que el nombre de la migración equivale a su SQL aplicado.
3. Reproducir el esquema/datos relevantes del backup en una base aislada PostgreSQL/Supabase y aplicar allí, en orden, `20261022120000`, `20261024120000` y `20261111120000`. Correr la suite completa, probar admin y empleados distintos y comparar conteos/ACL antes y después.
4. No usar `supabase db push` en el proyecto con solo tres registros remotos y 19 migraciones locales mientras haya migraciones antiguas sin correspondencia verificada. No usar `migration repair`, insertar entradas manuales ni editar migraciones históricas para cuadrar el historial.
5. Si no existe forma soportada de desplegar solo las tres migraciones nuevas sin reejecutar las antiguas, detener el despliegue y acordar una estrategia formal de baselining con el responsable de la base. No improvisar el registro. Si el ACL de responsable necesita normalización, usar una nueva migración forward-only, después del preflight y de aprobación.
6. Desplegar primero mensajes; verificar tabla, RLS y ACL. Desplegar agenda; comprobar que `cita_empleados` tiene exactamente una fila por cita con `empleado_id` anterior no NULL y que las asignaciones principales se mantienen. Desplegar operación resiliente únicamente si esa verificación pasa.
7. Tras cada paso, comparar los conteos de filas relevantes, constraints, triggers, políticas y permisos con el preflight. Probar lectura/escritura con cuentas de prueba; no usar credenciales de empleado reales ni alterar datos operativos para validar.
8. Actualizar el plan solo después de aceptación explícita del usuario. La aprobación es previa a cualquier cambio remoto; este informe no la solicita ni ejecuta cambios.

## Reversión y recuperación

- Preferir un **fix-forward** para políticas, funciones o validaciones; detener escrituras de app y conservar el estado para diagnóstico.
- El rollback de operación resiliente es aditivo respecto a los datos: elimina la política de preparación y restaura el trigger y permisos previos; conserva las columnas, sus valores y `cita_empleados`. Aun así, cambia el acceso y requiere revisión/aprobación antes de usarlo.
- El rollback de agenda elimina `cita_empleados` y con ello se pierden asignaciones secundarias; no es aceptable como reversión rutinaria. Mantiene `fecha_servicio` y la posibilidad de horario NULL.
- El rollback de mensajería elimina `mensajes_equipo` y sus mensajes. No ejecutarlo si se generó cualquier dato.
- No ejecutar ningún rollback destructivo ni borrar tablas, registros, políticas o historial remoto en este trabajo. Restaurar desde backup/PITR solo si hay incidente, con aprobación y un plan separado.

## Riesgos abiertos / criterios de salida

| Riesgo | Nivel | Criterio para desbloquear |
|---|---|---|
| Historial remoto de 3 y set local de 19 sin correspondencia demostrada | Alto | Obtener las tres entradas con nombres/SQL/hashes y un mapa verificable; definir despliegue que no reproduzca historia. |
| ACL/definición remota de `mascota_asignada_a_mi` difiere del archivo local | Alto | Confirmar `SECURITY DEFINER`, `search_path`, y permisos efectivos; aplicar un fix-forward solo si es necesario. |
| Integridad real de citas y empleados no inspeccionada | Alto | Ejecutar preflight en destino aislado derivado del estado actual; conteos válidos y asignaciones explicadas. |
| `cita_empleados` no existe y los datos de pruebas son sintéticos | Alto | Validar backfill en copia aislada; preservar todas las asignaciones principales y resolver empleados inactivos. |
| Rollbacks de mensajes y agenda pierden datos/asignaciones | Alto | Operar con fix-forward; no planificar su ejecución como rollback de rutina. |

**Estado final:** secuencia preparada y validada sintéticamente; no lista para aplicar en el proyecto remoto hasta resolver los criterios de salida y obtener aprobación expresa para cualquier cambio remoto.
