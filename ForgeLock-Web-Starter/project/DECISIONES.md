# Decisiones y acuerdos — Animals Friends

Separar **configuración encontrada en el repositorio** de **decisión aprobada por responsables** y de **estado comprobado fuera del código**.

| ID | Tema | Estado en el repositorio | Acuerdo operativo | Responsable / pendiente |
|---|---|---|---|---|
| AF-D01 | Aplicación existente | HTML/CSS/JS modular en la raíz; el starter no es la app | Continuar sobre la aplicación existente y conservar sus módulos | ForgeLock; decidido para esta adaptación |
| AF-D02 | Arquitectura y hosting | Worker `afriends` configurado; build produce `dist/` | No migrar hosting ni crear otro destino sin decisión explícita | Verificar último despliegue y URL en GitHub Actions/Cloudflare |
| AF-D03 | Datos dinámicos | Integración de navegador con Supabase en el código | No ejecutar SQL ni asumir que migraciones/documentación reflejan la BD real | Verificar proyecto y esquema en solo lectura antes de cambios |
| AF-D04 | Conversión | CTA principal documentado: cotizar por WhatsApp; hay formulario | Mantener rutas de contacto existentes al hacer cambios | Confirmar número, formulario y destino de datos antes de producción |
| AF-D05 | Privacidad y analítica | El código contiene un `GA_MEASUREMENT_ID`; el README raíz dice que no hay ID real | No modificar ni asumir estado activo hasta reconciliar la discrepancia y probar consentimiento | Confirmar titularidad/vigencia del ID y comportamiento en el sitio |
| AF-D06 | Publicación | Workflow permite despliegue desde `main` | Sin autorización explícita no publicar, fusionar ni alterar secretos | Aprobación de Diego y del responsable del negocio, según el cambio |
| AF-D07 | Identidad | Acento documentado `#D15638`; logo e icono de referencia disponibles | Preservar activos originales y verificar CSS/recursos reales antes de modificarlos | Manual de marca y permisos fotográficos por confirmar |
| AF-D08 | Indexación y sitemap | Diego reporta páginas indexadas y sitemap rastreado con 4 páginas (11 nov 2026) | Registrar como estado reportado, no como auditoría en vivo | Confirmar propiedad, conteos y cobertura actuales en Search Console |
| AF-D09 | Google Analytics y etiqueta | Diego reporta Analytics verificada; indica que falta Tag. El código también contiene un ID GA4, mientras el README lo describe como pendiente | No instalar ni cambiar etiquetas hasta identificar si falta Google tag, GTM o ambas, y confirmar ID/consentimiento | Verificar con Diego y en las cuentas/configuración correspondientes |
| AF-D10 | Panel administrativo | Existe un panel con módulos operativos documentados; el 11 nov 2026 se aplicó una primera tanda local de correcciones de navegación, borradores financieros, sincronización de rutas y mensajes | Continuar con revisión UX y tareas reales; los cambios locales no demuestran operación en producción | Levantar tareas prioritarias con administrador y empleados; validar la experiencia móvil con datos de prueba |
| AF-D11 | Visibilidad GEO | Añadido rol de especialista en GEO/buscadores con IA al comité ForgeLock | Evaluar rastreabilidad, contenido, entidades, datos estructurados y citabilidad; no prometer inclusión | Medir estado inicial y registrar evidencias por buscador |
