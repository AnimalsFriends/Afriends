# Lista de verificación de publicación

## Estado general

**Destino oficial:** Cloudflare Worker `afriends`. **Código fuente:** GitHub, repositorio `AnimalsFriends/Afriends`. **Base de datos objetivo:** Supabase `BD-AnimalsFriends`.

La configuración del repositorio define un workflow para construir, auditar, probar y desplegar el Worker. Esta lista no afirma que el último despliegue haya terminado correctamente. Confirma el resultado en GitHub Actions y Cloudflare antes de anunciar la web como verificada.

## 1. GitHub Actions y despliegue

- [ ] Revisar la ejecución más reciente del workflow **CI/CD** en GitHub Actions.
- [ ] Confirmar que `npm run check` terminó correctamente.
- [ ] Confirmar si el job de despliegue se ejecutó o se omitió; el workflow solo despliega desde `main` en push o ejecución manual.
- [ ] Si el despliegue se omitió, revisar la presencia de los secretos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y la variable `SITE_URL`, sin copiar sus valores a chats ni al repositorio.
- [ ] Confirmar en Cloudflare que el Worker se llama `afriends` y que la versión desplegada corresponde al commit esperado.
- [ ] Abrir la URL pública confirmada y comprobar home, recursos, páginas legales, `/admin/` y `/api/contact`.

## 2. Datos del negocio y requisitos legales

- [ ] Completar razón social o titular, NIT/cédula, dirección y correo para consultas de datos personales.
- [ ] Confirmar teléfono/WhatsApp, ubicación, horarios, servicios y precios.
- [ ] Confirmar si el negocio atiende gatos además de perros y si ofrece atención en local, a domicilio o ambas.
- [ ] Añadir enlaces reales de redes sociales y Perfil de Negocio de Google, cuando existan.
- [ ] Incorporar fotos reales con permiso de las familias.
- [ ] Pedir revisión profesional del aviso legal y de las políticas de privacidad y cookies.
- [ ] Consultar las obligaciones aplicables al tratamiento y registro de bases de datos personales en Colombia.

Ver detalles en `DATOS_PENDIENTES_CLIENTE.md`.

## 3. Supabase y seguridad

- [ ] Confirmar que el proyecto objetivo es `BD-AnimalsFriends`.
- [ ] En modo de solo lectura, comparar historial de migraciones, tablas, columnas, funciones, triggers, políticas RLS y buckets con los archivos versionados.
- [ ] Revisar el acceso de visitantes anónimos, admin y empleado con cuentas de prueba.
- [ ] Confirmar que las claves privadas solo estén en secretos del servidor/Worker; nunca en frontend, documentación o GitHub.
- [ ] Crear o confirmar la cuenta admin y comprobar MFA si está disponible.
- [ ] No ejecutar SQL, migraciones ni rollbacks hasta revisar el plan, el impacto y contar con aprobación explícita.

La existencia de archivos SQL o pruebas estáticas no demuestra que las políticas funcionen en la base real. Consulta `supabase/README.md`.

## 4. Formulario de contacto y Turnstile

- [ ] Confirmar que el Worker enruta `/api/contact` al manejador `functions/api/contact.js`.
- [ ] Confirmar que el Worker tenga `SUPABASE_URL`, una clave de servidor compatible (`SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_KEY`, según la implementación), `TURNSTILE_SECRET` e `IP_SALT`.
- [ ] Verificar que `TURNSTILE_SITE_KEY` en `src/config/env.js` sea la clave pública real asociada al hostname.
- [ ] Hacer un envío de prueba controlado y comprobar que se guarda una sola solicitud.
- [ ] Comprobar que una solicitud antispam no genere una fila.
- [ ] Revisar respuesta y logs del Worker sin exponer datos personales ni secretos.

Los nombres exactos y el flujo de configuración están en `GUIA_FASE4_CONFIGURACION.md`.

## 5. Panel de administración

- [ ] Abrir `/admin/` desde la web servida por HTTP/HTTPS; no usar `file://`.
- [ ] Probar inicio de sesión, cierre de sesión y comportamiento ante sesión expirada.
- [ ] Verificar con cuentas de prueba que admin y empleado tengan únicamente los permisos esperados.
- [ ] Probar cambios de negocio y servicios, recepción de mensajes y funciones operativas solo después de verificar el esquema.
- [ ] Probar en móvil y escritorio.

## 6. SEO y analítica

- [ ] Confirmar que `SITE_URL` coincida con la URL canónica pública elegida, sin barra final en la variable de entorno.
- [ ] Revisar `robots.txt`, `sitemap.xml`, canonical, Open Graph y datos estructurados en la URL publicada.
- [ ] Verificar la propiedad correcta en Search Console y enviar el sitemap de esa misma URL.
- [ ] Activar GA4 solo si el negocio lo solicita y se dispone del ID real; comprobar que el consentimiento funcione como se espera.
- [ ] Revisar cabeceras y rendimiento después de publicar.

Ver `GOOGLE_BUSINESS_PROFILE.md` para la ficha de Google.

## 7. Evidencias que deben quedar registradas

- [ ] Enlace de la ejecución de Actions y resultado del job de pruebas.
- [ ] Commit desplegado y versión/fecha del Worker.
- [ ] Resultado de pruebas de home, formulario y panel.
- [ ] Estado de validación de Supabase y permisos, sin incluir credenciales.
- [ ] Pendientes, responsables y riesgos aceptados.

No marcar una tarea como completada solo porque exista código para ella: marca como completada cuando se haya comprobado en el entorno correspondiente.
