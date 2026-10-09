# Estilos del sitio

Esta carpeta contiene los estilos del sitio público y del panel. `admin.css` agrupa los estilos
del panel bajo `.adm-`; los estilos de **Rutas y hotel** usan el prefijo `.adm-r-` y se adaptan
a pantallas pequeñas para que las paradas se puedan consultar desde móvil. La agenda usa
`.adm-agenda-` para distinguir el calendario y la planeación; finanzas usa `.adm-fin-` para
mantener legibles en celular las tarjetas de resumen y tablas de movimientos.

Al editar, reutiliza los tokens de `tokens.css`, conserva foco visible y evita estilos en línea
(la política CSP los bloquea). La revisión automatizada es `npm run check`; queda pendiente una
prueba visual real en celular.
