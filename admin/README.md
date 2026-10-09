# Entrada del panel

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

Pendiente: validar los flujos con un admin de prueba en navegador y en celular después de aplicar
las migraciones a un entorno de pruebas. La sugerencia de rutas por distancia sigue pendiente de proveedor.
