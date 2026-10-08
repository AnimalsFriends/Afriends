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
  servicio" se calcula con las reservas y el plan de colegio. Esa lógica se
  construye en la Fase 3.
- **Nada se borra de verdad.** Dueños, mascotas, rutas y paradas se desactivan
  (`activo` / `activa`). Las llaves foráneas con `ON DELETE RESTRICT` impiden borrar
  algo que ya tenga historial.
- **El orden de las paradas se puede cambiar a mano.** La regla de "no repetir
  número de orden" se comprueba al final de la operación, para poder intercambiar
  dos paradas sin que falle a la mitad.
- **Quién marcó una parada y a qué hora lo escribe la base de datos**, no el
  celular del empleado.
- **Las cifras no se inventan.** `cupos_hotel` y `perros_por_empleado` están en `NULL`
  hasta que el admin las defina. El tamaño del perro es texto libre porque las
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

## Cómo deshacer

Corre los archivos de `rollbacks/` en **orden inverso** (del `...100600_down` al
`...100000_down`). Ojo: los de los pasos 1 a 4 **borran tablas con sus datos**; son
para antes de tener datos reales, o después de sacar una copia.

## Pruebas

`node --test tests/migrations.test.mjs` revisa que cada tabla tenga RLS activo,
acceso anónimo limitado a la lectura intencional de `site_config`, política de admin
y rollback seguro, y que
el empleado no tenga ninguna política sobre tablas de dinero. Es una revisión
**estática** del texto de los `.sql`: no ejecuta nada ni comprueba que las políticas
hagan lo correcto; eso se verifica con la lista de arriba.

## Pendiente

- Función que calcule el estado de hoy de cada perro, reajuste de las rutas y
  sugerencia por cercanía (Fase 3).
- Choques de horario en la agenda (Fase 4).
- Vistas de cartera, ingresos y utilidad (Fase 5).
- Historial de cambios: quién editó o borró cada dato (Fase 7).
- Pasar `01_site_config.sql` y `02_contact_requests.sql` a `migrations/` cuando
  confirmemos qué hay realmente creado en tu Supabase.
