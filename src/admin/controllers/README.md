# Controladores del panel

Aquí vive la coordinación del panel entre los formularios, las vistas y los servicios de Supabase.
`GestionController.js` maneja la ficha de dueños y mascotas: valida antes de guardar, mantiene el estado
del formulario y muestra los errores de escritura, actualización de listas y carga de fotos.

Para cambiar una regla de validación, revisa también `../models/gestionModel.js`; para cambiar el HTML,
revisa `../views/gestionViews.js`. Las pruebas relacionadas están en `../../../tests/gestionController.test.mjs`.
Puedes ejecutar las pruebas focalizadas con:

```sh
node --test tests/gestionController.test.mjs tests/gestionModel.test.mjs tests/gestionViews.test.mjs tests/gestionApi.test.mjs
```
