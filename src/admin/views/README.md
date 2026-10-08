# Vistas del panel

Las vistas reciben el estado del controlador y producen HTML. `rutasViews.js` dibuja las rutas,
el resumen del día, el calendario y las reservas del hotel; escapa el texto externo con el helper
compartido y emite atributos `data-action` en vez de manejadores en línea.

Para validar HTML seguro y los distintos estados de operación, ejecuta
`node --test tests/rutasViews.test.mjs`.
