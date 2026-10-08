# Panel de administración (`src/admin`)

Todo el código del panel privado de `/admin/`. Sigue la misma idea MVC que el resto del
proyecto: cada archivo hace una sola cosa y las pantallas no hablan directo con la base de datos.

## Cómo está organizado

| Carpeta | Qué hay | Para qué sirve |
|---|---|---|
| `models/` | Reglas puras del sitio, gestión y operación | Validan, limpian y calculan datos sin pantalla ni red; se prueban con `node --test`. |
| `services/` | Acceso a autenticación y Supabase | Hacen las peticiones y exponen acciones de dueños, mascotas, rutas y hotel. |
| `views/` | Vistas del sitio, gestión y operación | Devuelven HTML escapado; sin `style=` ni `onclick=` en línea (la CSP los bloquea). |
| `controllers/` | Coordinadores del panel | Manejan estado y clics, delegando secciones a controladores especializados. |

## Dos maneras de guardar (importante para no confundirse)

- **Negocio y Servicios y precios** editan un borrador grande que se publica con un solo
  botón (**Guardar y publicar**). Lo maneja `AdminController`.
- **Dueños y mascotas** (Fase 2) funciona distinto: cada ficha (dueño, perro, vacuna,
  medicamento, persona autorizada) es un registro propio y se guarda al momento con su
  propio botón. Lo maneja `GestionController`. Por eso la barra de "Guardar y publicar"
  se oculta en esa pestaña.

## Pestaña "Dueños y mascotas" (Fase 2)

Solo aparece cuando el panel está conectado a Supabase y requiere haber aplicado la Fase 1
(`supabase/README.md`) y tener tu fila de administrador en la tabla `empleados`.

- **Lista:** buscador por dueño, perro o teléfono (sin importar tildes), y opción de ver
  los desactivados.
- **Dueño:** datos, contacto de emergencia y personas autorizadas a recoger (para todos sus
  perros o solo para uno).
- **Perro:** nombre, raza, género, tamaño, comida (tipo y veces al día), si es bravo (con
  nota de comportamiento), si está enfermo (con detalle), si toma medicamentos, foto,
  medicamentos (cuál, dosis, horario) y vacunas o desparasitación con fecha de vencimiento.
- **Nada se borra de verdad:** dueños y perros se *desactivan* y se pueden reactivar.
  Además de ocultar el botón de borrado, la migración de Fase 2 quita el permiso `DELETE`
  a sesiones autenticadas para esas dos tablas; así tampoco se borran con una llamada directa.
  Vacunas, medicamentos y personas autorizadas sí se pueden quitar con confirmación,
  solo para corregir un registro erróneo.
- **Fotos:** se reducen a 800 px en el navegador, se guardan en el bucket privado
  `fotos-mascotas` y se muestran descargándolas con la sesión del administrador (así la
  política de seguridad del sitio no tiene que abrirse a imágenes externas).

## Pestaña "Rutas y hotel" (Fase 3)

Requiere la Fase 1 y la migración `20261009120000_fase3_rutas_hotel_operacion.sql`. La pestaña, visible para admin,
incluye operación del día, rutas/planes y calendario/reservas del hotel.

- Recogida y entrega tienen órdenes separados. Las paradas se agrupan por localidad y se reordenan manualmente,
  dentro de una localidad o entre localidades. La sugerencia por distancia queda pendiente de elegir proveedor.
- El servicio diario sale de los planes, ausencias y reservas. Una reserva marcada **Hotel + colegio** solo entra
  a la ruta si el perro tiene plan ese día. Las reservas cruzadas se muestran como conflicto y no se agregan al recorrido.
- Las noches del hotel son `[entrada, salida)`: el día de salida no ocupa cupo. La base valida el cupo y evita
  reservas cruzadas del mismo perro; la capacidad inicial confirmada es 50.
- El estado de cada parada se guarda por fecha en `paradas_dia`; el trigger de base registra quién y cuándo marcó.

Pruebas focalizadas: `node --test tests/rutasModel.test.mjs tests/rutasApi.test.mjs tests/rutasViews.test.mjs`.
Usan datos simulados: no prueban el login, RLS en una instancia real ni el uso en celular.

## Cómo probarlo

```bash
npm run check          # build + auditoría + todas las pruebas
node --test tests/gestionModel.test.mjs tests/gestionViews.test.mjs tests/gestionApi.test.mjs tests/gestionController.test.mjs tests/rutasModel.test.mjs tests/rutasApi.test.mjs tests/rutasViews.test.mjs
```

Las pruebas cubren las reglas de validación, que las vistas escapen el texto y no usen
código en línea, y que el servicio arme bien las peticiones (con un `fetch` falso, sin
tocar ninguna base de datos). **No cubren el funcionamiento real en el navegador ni contra
Supabase**: eso hay que verlo a mano (lista de comprobación abajo).

### Comprobación a mano (después de aplicar la Fase 1)

1. Entra a `/admin/` y abre **Dueños y mascotas**: debe cargar la lista (vacía al inicio).
2. Crea un dueño, agrégale un perro, una vacuna con vencimiento y una persona autorizada.
3. Sube una foto desde el celular y comprueba que se ve en la ficha.
4. Desactiva y reactiva un dueño. Recarga la página y revisa que todo siga ahí.

## Pendiente

- Probado solo con pruebas automáticas: falta la prueba real en navegador y celular.
- Los avisos de vacunas por vencer (cuántos días antes) se definen en la Fase 7; hoy solo se
  marca "Vencida".
- Los cambios no quedan en un historial de quién los hizo (Fase 7).
- Aún no se puede eliminar un dueño o perro (a propósito) ni mover un perro a otro dueño.
- El tamaño del perro es texto libre hasta que se definan las categorías.
