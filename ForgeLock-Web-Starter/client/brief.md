# Brief — Animals Friends

- **Nombre del proyecto:** Animals Friends.
- **Tipo:** sitio web público y plataforma de gestión operativa para guardería y servicios para mascotas.
- **Objetivo principal:** presentar servicios y facilitar cotizaciones/contacto por WhatsApp; apoyar la operación interna mediante un panel privado.
- **Público:** familias con mascotas que consultan los servicios; propietario y empleados que usan el panel. Confirmar segmentos adicionales con el negocio.
- **Acción principal pública:** cotizar por WhatsApp.
- **Servicios documentados en la configuración del sitio:** baños, colegio canino con ruta, hotel para mascotas y peluquería canina. Confirmar vigencia de información y precios antes de anunciarla.
- **Funciones existentes descritas en el repositorio:** cotizador, formulario de contacto, páginas legales, consentimiento/analítica configurable y panel administrativo con módulos operativos. El detalle y el estado de verificación constan en `project/MAPA-ADAPTACION.md`.
- **Dominio y alojamiento configurados en el repositorio:** Cloudflare Worker `afriends`, con URL objetivo `https://afriends.petcommunity-133.workers.dev/`; confirmar despliegue más reciente y URL activa en GitHub Actions y Cloudflare.
- **Datos y servicios externos:** Supabase está integrado en el código; el estado real del esquema, migraciones, políticas y almacenamiento debe verificarse en el proyecto correcto antes de operar.
- **Idioma y mercado:** español; Colombia, con ubicación comercial registrada como Chía, Cundinamarca (confirmar).
- **Responsable de aprobación:** Diego Alexander Gaviria Jimenez / ForgeLock para cambios del proyecto; aprobación del negocio para contenido comercial y publicación.
- **Fecha objetivo:** no confirmada.
- **Restricciones:** conservar el avance existente; no inventar datos; no migrar ni publicar sin autorización; no dar por validada una función por la sola presencia de código.
- **Pendientes críticos:** datos legales y comerciales por confirmar, revisión legal de políticas, validación de servicios externos y evidencia del despliegue vigente. El estado real del ID de GA4 es contradictorio entre código y README, así que debe confirmarse.

## Estado adicional reportado por Diego (11 nov 2026)

- Search Console: páginas indexadas y sitemap rastreado con 4 páginas; verificar conteos actuales en la propiedad.
- Google Analytics: cuenta/propiedad verificada, según Diego. Falta identificar la etiqueta Google pendiente (Google tag, GTM o ambas).
- Próxima prioridad de producto: revisar y mejorar la experiencia del panel administrativo según las tareas de administrador y empleados.

