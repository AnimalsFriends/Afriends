# Modelos del panel

Aquí viven las reglas puras de negocio: validación y limpieza de fichas, reglas del sitio y
cálculos operativos. `rutasModel.js` calcula el servicio de cada fecha desde el plan de colegio,
las ausencias y las reservas, y aplica la regla de noches `[entrada, salida)`. `agendaModel.js`
valida citas, convierte horas de Bogotá, detecta choques y calcula empleados por ruta sin suponer
una capacidad si falta el dato.

No agregues aquí llamadas de red ni manipulación del DOM. Prueba los modelos con Node:
`node --test tests/rutasModel.test.mjs tests/agendaModel.test.mjs`.
