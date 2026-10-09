# Controladores del panel

Aquí vive la coordinación del panel entre los formularios, las vistas y los servicios de Supabase.
`GestionController.js` maneja la ficha de dueños y mascotas: valida antes de guardar, mantiene el estado
del formulario y muestra los errores de escritura, actualización de listas y carga de fotos.
`RutasController.js` coordina la operación diaria: calcula el servicio desde planes, reservas y ausencias,
y gestiona orden, marcación de paradas, reservas y capacidad del hotel.
`AgendaController.js` navega día/semana/mes, valida y guarda citas y avisa de choques de horario antes de confirmar.
`FinanzasController.js` registra gastos, adjunta recibos privados, crea cobros y abonos y refresca el resumen mensual.
Comprueba el rol admin antes de pedir cualquier dato financiero.
`SeguimientoController.js` coordina vencimientos, marcas de entrada/salida, faltas y paginación del historial;
comprueba el rol antes de cargar información y protege los cambios SOAT que estén sin guardar.

Para cambiar una regla de validación, revisa también `../models/gestionModel.js`; para cambiar el HTML,
revisa `../views/gestionViews.js`. Las pruebas relacionadas están en `../../../tests/gestionController.test.mjs`.
Puedes ejecutar las pruebas focalizadas con:

```sh
node --test tests/gestionController.test.mjs tests/gestionModel.test.mjs tests/gestionViews.test.mjs tests/gestionApi.test.mjs tests/rutasModel.test.mjs tests/rutasApi.test.mjs tests/rutasViews.test.mjs tests/agendaModel.test.mjs tests/agendaApi.test.mjs tests/agendaViews.test.mjs tests/finanzasModel.test.mjs tests/finanzasApi.test.mjs tests/finanzasViews.test.mjs tests/seguimientoModel.test.mjs tests/seguimientoApi.test.mjs tests/seguimientoViews.test.mjs
```
