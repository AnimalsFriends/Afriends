# Mapa de adaptación — plantilla ForgeLock y aplicación Animals Friends

## Propósito

Relacionar las carpetas conceptuales de ForgeLock-Web-Starter con la aplicación existente. Esta guía no propone migrar el proyecto a la estructura del scaffold.

| Área de la plantilla | Ubicación en Animals Friends | Estado descrito en el repositorio | Verificación que falta |
|---|---|---|---|
| `client/` | Esta carpeta `ForgeLock-Web-Starter/client/` | Contexto de negocio y marca documentado | Confirmación reciente del negocio y permisos de activos |
| `src/config/` | `../src/config/` | Valores predeterminados, entorno e integración existentes | Confirmar vigencia de datos y configuración externa |
| `src/models/`, `src/views/`, `src/controllers/` | `../src/` y `../src/admin/` | Separación modular del sitio y panel | Verificar cada flujo afectado antes de cambios |
| `src/services/` | `../src/services/`, `../functions/` | Integración Supabase, analítica, Turnstile y formulario documentadas | Conectividad, secretos, permisos y funcionamiento real |
| `public/` | `../assets/`, `../img/`, raíz y `../dist/` generado | Recursos y build SEO documentados | Revisar artefacto generado y URL vigente |
| `scripts/` y `tests/` | `../scripts/` y `../tests/` | Build, empaquetado, auditoría y pruebas existentes | Ejecutar cuando se solicite verificación o el cambio lo requiera |
| `project/` | Esta carpeta `ForgeLock-Web-Starter/project/` | Decisiones, pendientes, plan y este mapa | Mantener sincronizado tras cambios relevantes |

## Capacidades que la documentación raíz describe en el código

- **Sitio público:** servicios, cotizador y salida a WhatsApp; formulario de contacto; páginas legales; SEO técnico y datos estructurados.
- **Panel privado:** configuración comercial, mensajes y módulos de gestión de dueños/mascotas, rutas/hotel, agenda, finanzas, alertas/asistencia e historial.
- **Servicios externos:** Supabase, Cloudflare Worker/Function, Turnstile y analítica opcional con consentimiento.
- **Calidad:** build, empaquetado, auditoría, pruebas automatizadas y flujo CI/CD documentados.

## Estado de búsqueda y medición reportado por Diego

Actualización aportada el **11 de noviembre de 2026**; no se consultó Search Console ni Analytics en esta edición documental:

- Search Console: páginas indexadas; sitemap rastreado con **4 páginas**. Confirmar propiedad, fecha y si el número es URLs descubiertas, rastreadas o indexadas.
- Google Analytics: propiedad/cuenta reportada como verificada.
- Etiqueta Google: Diego indica que falta “Tag”. Confirmar si se refiere a Google tag (`gtag.js`), Google Tag Manager (GTM) o a la instalación/conexión de ambos.
- En el repositorio hay una discrepancia: `src/config/env.js` tiene un `GA_MEASUREMENT_ID`, mientras el README raíz dice que no existe un ID real. No modificar hasta resolverla.

El comité ahora incluye un perfil GEO para visibilidad en buscadores con IA, además del SEO clásico. La revisión GEO deberá registrar rastreabilidad, estructura de contenido, entidades, datos estructurados y citabilidad sin prometer que un buscador de IA indexará o citará el sitio.

## Mejora del panel administrativo

El panel ya tiene varios módulos documentados; el próximo paso es identificar fricciones de uso con el administrador y empleados. Evaluar navegación, tareas frecuentes, permisos, mensajes y estados, uso móvil, agenda/rutas y gestión financiera. Acordar alcance y criterios de aceptación antes de tocar código o datos reales.

La lista describe funcionalidades presentes en la documentación/código; no certifica que todas estén aplicadas, conectadas o funcionando en producción.

## Riesgos de confusión que debemos evitar

1. **El scaffold de `ForgeLock-Web-Starter/src/` no contiene la aplicación Animal Friends.** No copiarlo sobre el código raíz.
2. **Las migraciones versionadas no confirman el estado de Supabase.** Comparar historial y esquema de forma de solo lectura antes de planear cambios.
3. **El destino configurado no confirma una publicación exitosa.** Revisar GitHub Actions y la versión activa del Worker.
4. **La configuración local puede contener datos antiguos.** Confirmar teléfono, correo, servicios, precios y horarios.
5. **La presencia de pruebas no demuestra que se ejecutaron en esta revisión.** Registrar fecha y resultado cuando se corran.

## Fuentes de trabajo

- `../README.md`
- `../CHECKLIST_PUBLICACION.md`
- `../DATOS_PENDIENTES_CLIENTE.md`
- `../GUIA_FASE4_CONFIGURACION.md`
- `../src/admin/README.md`
- `../supabase/README.md`
