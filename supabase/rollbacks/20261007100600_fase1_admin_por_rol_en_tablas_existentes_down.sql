-- Deshace el paso 7: quita solo las políticas "por rol"; las viejas siguen intactas.
drop policy if exists "admin_rol_inserta"            on public.site_config;
drop policy if exists "admin_rol_actualiza"          on public.site_config;
drop policy if exists "admin_rol_lee_mensajes"       on public.contact_requests;
drop policy if exists "admin_rol_actualiza_mensajes" on public.contact_requests;
