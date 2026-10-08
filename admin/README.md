# Entrada del panel

`index.html` es la página privada que sirve `/admin/`. Carga los estilos compartidos y
`src/admin/main.js`, que monta el login y las pestañas disponibles. La sección **Rutas y hotel**
solo se muestra a cuentas admin cuando están aplicadas y disponibles las tablas de operación.

Para probarla localmente, ejecuta `npm run dev` desde la raíz y abre `/admin/`; los cambios de
operación requieren una sesión conectada a Supabase. No publiques credenciales en este archivo.

Pendiente: validar los flujos con un admin de prueba en navegador y en celular después de aplicar
las migraciones a un entorno de pruebas.
