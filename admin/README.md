# Entrada del panel

El panel está pensado para abrirse desde el sitio servido por HTTP/HTTPS, en `/admin/`. No abras `admin/index.html` mediante `file://`: los módulos JavaScript y las peticiones al backend pueden fallar en ese contexto. Para una prueba local, ejecuta `npm run dev` desde la raíz y visita `http://localhost:3000/admin/` (si el servidor informa otro puerto, usa el que muestre la terminal).

La documentación de las pestañas describe las funciones implementadas en el código, no confirma que las migraciones estén aplicadas ni que los permisos hayan sido validados en un proyecto Supabase real. No introduzcas claves privadas en el navegador ni en este repositorio.

`index.html` es la página privada que sirve `/admin/`. Carga los estilos compartidos y
`src/admin/main.js`, que monta el login y las pestañas disponibles. La sección **Rutas y hotel**
solo se muestra a cuentas admin cuando están aplicadas y disponibles las tablas de operación.
La pestaña **Agenda y planeación** usa las citas y reservas existentes, y muestra el cálculo de personal
según la capacidad configurable de cada ruta.
**Finanzas y cartera** está limitada a admin: registra gastos con recibo privado, cobros y abonos; consolida la
deuda por dueño y permite exportar el reporte mensual a CSV compatible con Excel.
**Alertas, asistencia e historial** también es solo para admin: avisa de vencimientos en 30 días, registra SOAT,
marca entrada/salida del colegio y muestra quién cambió cada registro.
Requiere la migración de Fase 7; sus instrucciones y el rollback que conserva los datos están en `supabase/README.md`.

Para probarla localmente, ejecuta `npm run dev` desde la raíz y abre `/admin/`; los cambios de
operación requieren una sesión conectada a Supabase. No publiques credenciales en este archivo.

Pendiente: validar los flujos con cuentas admin y empleado en un entorno de pruebas, comprobar RLS y probar el panel en navegador y celular. No asumir que la base objetivo está lista hasta completar esas comprobaciones. La sugerencia de rutas por distancia sigue pendiente de proveedor.
