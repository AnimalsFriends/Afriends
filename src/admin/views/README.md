# Vistas del panel

Las vistas reciben el estado del controlador y producen HTML. `rutasViews.js` dibuja las rutas,
el resumen del día, el calendario y las reservas del hotel. `agendaViews.js` presenta citas y
reservas en calendario de día, semana y mes, además de la planeación por recorrido. Ambas escapan
el texto externo con el helper compartido y emiten atributos `data-action` en vez de manejadores en línea.

Para validar HTML seguro y los distintos estados de operación, ejecuta
`node --test tests/rutasViews.test.mjs tests/agendaViews.test.mjs`.
