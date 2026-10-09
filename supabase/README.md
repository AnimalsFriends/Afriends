# Base de datos (Supabase)

Aquí vive todo lo que toca la base de datos de Animal's Friends. Si llegas nuevo al
proyecto, lee esto primero.

## Qué hay en esta carpeta

| Ruta | Qué es |
|---|---|
| `01_site_config.sql`, `02_contact_requests.sql` | Scripts originales para crear las tablas del sitio público. Se usaron en el SQL Editor; las definiciones también están en la migración versionada `20261005143000`. |
| `migrations/` | Migraciones versionadas. Se aplican en orden de nombre (la fecha va primero). Aquí está la Fase 1 del panel. |
| `rollbacks/` | Para cada migración de la Fase 1, un archivo `_down.sql` que la deshace. **No se ejecutan solos**, los corres tú si hace falta. |
| `manual/` | Scripts que NO son migraciones y que decides cuándo correr (hoy: retirar las políticas viejas por correo). |
| `config.toml` | Configuración de la CLI de Supabase para correr todo en local. |

> `migrations/20261005121608_crear_tablas_iniciales.sql` está vacía. La dejé como
> estaba (no se borra nada); simplemente no hace nada.

## Fase 1: el modelo de datos en una mirada

**Quién entra:** la tabla `empleados` guarda a cada persona con su rol (`admin` o
`empleado`) y se enlaza con su usuario de Supabase Auth. Ya no hay un correo escrito
a mano en las políticas: se pregunta con `es_admin()`.

**Personas y perros:** `duenos` (con su contacto de emergencia) → `mascotas` (un dueño
puede tener varias) → `medicamentos_mascota`, `vacunas_mascota` (también
desparasitación), `personas_autorizadas` y `planes_colegio` (qué días de la semana
le toca colegio).

La migración `20261008190000_fase2_evitar_borrado_duenos_mascotas.sql` revoca el permiso
`DELETE` para `duenos` y `mascotas` a sesiones autenticadas. La app desactiva esos registros
para preservar su historial; el rollback reabre el borrado y por eso trae una advertencia.

**Colegio:** `rutas_colegio` → `paradas_ruta` (lista ordenada y permanente; cada
parada es de `recogida` o de `entrega`, y cada sentido tiene su propio orden) →
`paradas_dia` (el estado de cada parada en un día: pendiente, recogido, entregado o
no se pudo, con quién y a qué hora). `ausencias_colegio` registra los días que un
perro falta.

**Hotel y agenda:** `reservas_hotel` (entrada, salida, notas de comida y
medicación, y la marca `tambien_colegio`) y `citas`.

**Dinero (solo admin):** `gastos`, `pagos` (cada cobro a un dueño) y `abonos` (cada
pago parcial o total de un cobro).

**Apoyo:** `servicios` (colegio, hotel, baño, peluquería; editable),
`parametros_operativos` (cupos del hotel y perros por empleado) y los buckets
privados `fotos-mascotas` y `recibos`.

### Decisiones que conviene recordar

- **El servicio de un perro no se guarda.** "Hoy está en hotel / en colegio / sin
  servicio" se calcula con las reservas y el plan de colegio. La pantalla de
  operación y ese cálculo se implementan en la Fase 3.
- **Nada se borra de verdad.** Dueños, mascotas, rutas y paradas se desactivan
  (`activo` / `activa`). Las llaves foráneas con `ON DELETE RESTRICT` impiden borrar
  algo que ya tenga historial.
- **El orden de las paradas se puede cambiar a mano.** La regla de "no repetir
  número de orden" se comprueba al final de la operación, para poder intercambiar
  dos paradas sin que falle a la mitad.
- **Quién marcó una parada y a qué hora lo escribe la base de datos**, no el
  celular del empleado.
- **Las cifras no se inventan.** `cupos_hotel` y `perros_por_empleado` están en `NULL`
  hasta que el admin las defina. Desde Fase 4 la planeación usa `rutas_colegio.capacidad_perros`,
  configurable por recorrido y sin valor común por defecto; `perros_por_empleado` queda sin uso
  para este cálculo. El tamaño del perro es texto libre porque las
  categorías las decide el negocio.
- **Se agregó la tabla `abonos`** (no estaba en la lista acordada) para poder
  guardar los pagos parciales de un mismo cobro.

### Qué ve cada rol

| | Admin | Empleado |
|---|---|---|
| Dueños, mascotas y su información | Todo | Solo los de sus rutas o citas |
| Rutas y paradas | Todo | Solo las suyas; puede marcar el estado de sus paradas del día |
| Hotel y agenda | Todo | Solo lo asignado a él |
| Gastos, pagos, abonos, parámetros | Todo | **Nada** (no hay política que lo permita) |
| Otros empleados | Todo | Solo su propia fila, sin poder editarla |
| Público anónimo | Nada de lo nuevo | |

## Cómo aplicar la Fase 1

Hazlo primero en un proyecto de pruebas o saca una copia antes. **No lo he podido
correr contra una base real**, así que la primera vez conviene revisarlo con calma.

**Opción A, con la CLI** (recomendada):

```bash
supabase link --project-ref TU_REFERENCIA
supabase db push
```

**Opción B, a mano:** en Supabase → SQL Editor, pega y ejecuta los archivos de
`migrations/` en orden (de `20261007100000` a `20261007100600`).

Las migraciones de Fase 1 son aditivas respecto a las tablas históricas: no borran
ni recrean `site_config` o `contact_requests`. `site_config` permite al público
leer la configuración que necesita la página; no permite escribirla. `contact_requests`
no concede acceso anónimo: la Function de Cloudflare usa una clave de servidor.

Los `_down.sql` de las tablas nuevas de gestión pueden borrar los datos guardados
en esas tablas. No los ejecutes como una operación rutinaria ni sobre una base con
datos que quieras conservar; saca una copia y revisa el impacto antes. Las políticas
añadidas a las dos tablas históricas sí tienen rollback propio y no borran sus filas.

### Crear tu usuario admin (paso obligatorio)

Después de aplicar las migraciones nadie es admin todavía. En Authentication → Users
crea o usa tu usuario, y luego en el SQL Editor corre esto cambiando el correo:

```sql
insert into public.empleados (user_id, nombre, rol)
select id, 'Administrador', 'admin'
from auth.users
where lower(email) = lower('TU_CORREO_AQUI')
on conflict (user_id) do nothing;
```

### Cómo comprobar que quedó bien

1. En el SQL Editor: `select public.es_admin();` devuelve `true` con tu usuario
   (en el editor puede devolver `false` porque no hay sesión; la prueba real es el
   punto 2).
2. Entra a `/admin/` con ese usuario: debes poder guardar cambios del sitio y ver los
   mensajes.
3. En Table Editor, revisa que todas las tablas nuevas muestren **RLS enabled**.
4. Con un usuario empleado de prueba (rol `empleado`, sin rutas asignadas) consulta
   `gastos` y `mascotas`: debe devolver cero filas.
5. Solo cuando todo eso funcione, corre `manual/retirar_politicas_por_correo.sql`
   para quitar las políticas viejas.

## Fase 3: operación de rutas y hotel

Después de aplicar la Fase 1, ejecuta `migrations/20261009120000_fase3_rutas_hotel_operacion.sql`.
La migración agrega localidad a las paradas, inicializa la capacidad del hotel en 50 solo si aún está vacía,
permite reordenar una ruta completa en una transacción y valida en base los cupos y las reservas cruzadas.
La fecha de salida queda fuera de las noches ocupadas. La sugerencia automática por distancia no está incluida:
por ahora el orden se organiza manualmente y agrupado por localidad.

Para deshacerla, ejecuta `rollbacks/20261009120000_fase3_rutas_hotel_operacion_down.sql`. Ese rollback quita
el trigger y las funciones nuevas, pero **conserva la localidad y el cupo configurado** para no perder datos.
La migración aún no se ha ejecutado contra Supabase real; pruébala primero en un proyecto de prueba y revisa
el diff del esquema antes de producción. No hay datos reales de clientes cargados según la revisión del proyecto.

## Fase 4: agenda y planeación

Después de Fase 3, ejecuta `migrations/20261010120000_fase4_agenda_planeacion.sql`. Las citas ya existen en
`citas` y conservan sus políticas RLS; no se crea una tabla duplicada. La migración añade
`rutas_colegio.capacidad_perros`, nullable y positiva cuando se configura. No se asigna 35 ni otro valor
automático: cada recorrido puede tener un límite distinto. La app consulta los choques en Supabase para el
horario exacto de cada cita y permite al admin decidir si guarda de todas formas.

El rollback está en `rollbacks/20261010120000_fase4_agenda_planeacion_down.sql`. Conserva la columna porque
puede guardar capacidades definidas por el negocio; no elimina ese dato. La agenda usa hora de Bogotá y
representa las noches ocupadas de cada reserva de hotel.

## Fase 5: gastos, cobros y cartera

Las tablas `gastos`, `pagos` y `abonos`, el bucket privado `recibos` y las políticas RLS admin-only ya quedaron
creadas en Fase 1; esta fase las reutiliza sin duplicarlas. Después de Fase 4, aplica
`migrations/20261011120000_fase5_finanzas_integridad.sql`. Añade triggers para que los abonos no superen el total
del cobro incluso si llegan operaciones concurrentes, y para que no se reduzca una factura por debajo de lo abonado.
No borra ni migra filas existentes.

En el panel, los gastos guardan fecha, categoría, valor, descripción y recibo en el bucket privado. La cartera agrupa
los cobros por dueño, aunque tenga varios perros. Los informes usan la fecha del cobro (`pagos`) para ingresos por
servicio y la fecha del gasto para costos; los abonos se muestran por separado según su propia fecha. La utilidad
presentada es **cobros registrados menos gastos**, no una medida de caja. El informe mensual se descarga en CSV UTF-8
que Excel puede abrir.

El rollback `rollbacks/20261011120000_fase5_finanzas_integridad_down.sql` quita solo los triggers y funciones nuevos;
no elimina cobros, abonos, gastos ni recibos.

## Fase 7: alertas, asistencia e historial

Después de Fase 5, ejecuta `migrations/20261012120000_fase7_alertas_asistencia_historial.sql`. Reutiliza
`vacunas_mascota`, `planes_colegio` y `ausencias_colegio`; agrega `soat_vehiculos`, `asistencia_colegio` y
`historial_cambios`. Las alertas incluyen fechas vencidas y las que caen en los próximos 30 días, ventana que
eligió el negocio.

La asistencia guarda una fila por perro/día cuando llega al colegio. Las marcas de hora y empleado se ponen
en la base de datos y no se pueden reiniciar desde el formulario; el estado de falta sigue en
`ausencias_colegio`. Las dos tablas nuevas de operación tienen RLS admin-only. El historial también solo da
lectura a admin: sus triggers guardan acción, actor y valores anterior/nuevo para las tablas públicas operativas.
No se agregan permisos financieros a empleados.

El rollback `rollbacks/20261012120000_fase7_alertas_asistencia_historial_down.sql` desactiva triggers y políticas
de Fase 7, y revoca el acceso desde la app a esas tablas, pero **no borra sus tablas ni sus filas**. Si se vuelve
a aplicar la migración, se reactivan. La migración y el rollback no se han ejecutado contra Supabase real:
primero pruébalos en un proyecto separado, comprueba los roles admin/empleado y revisa los timestamps.

## Cómo deshacer

Corre los archivos de `rollbacks/` en **orden inverso**. Ojo: los rollbacks destructivos de los primeros pasos de Fase 1
**borran tablas con sus datos**; son
para antes de tener datos reales, o después de sacar una copia.

## Pruebas

`node --test tests/migrations.test.mjs` revisa que cada tabla tenga RLS activo,
acceso anónimo limitado a la lectura intencional de `site_config`, política de admin
y rollback seguro, y que
el empleado no tenga ninguna política sobre tablas de dinero. Es una revisión
**estática** del texto de los `.sql`: no ejecuta nada ni comprueba que las políticas
hagan lo correcto; eso se verifica con la lista de arriba.

## Pendiente

- Elegir un proveedor de distancias para sugerir recorridos; el orden manual agrupado por localidad ya está disponible (Fase 3).
- Probar las pantallas y permisos con cuentas admin/empleado en un proyecto Supabase de pruebas.
- Pasar `01_site_config.sql` y `02_contact_requests.sql` a `migrations/` cuando
  confirmemos qué hay realmente creado en tu Supabase.
