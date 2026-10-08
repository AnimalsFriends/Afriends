# Controladores del sitio

Estos módulos coordinan modelos y vistas sin concentrar el HTML ni las reglas de
datos en un único archivo. `LayoutController` monta el encabezado, el pie y los
datos legales; `SeoController` actualiza el JSON-LD si llegan datos publicados
desde Supabase. `AnalyticsController` solo carga GA4 después del consentimiento.

La base de URL de JSON-LD se toma de la carpeta de la página actual para que el
sitio funcione en GitHub Pages bajo `/Afriends/`. El ID real de GA4 aún está pendiente.
