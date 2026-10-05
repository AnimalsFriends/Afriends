# Guía: Perfil de Negocio de Google (Google Maps) para Animal Friends

Un Perfil de Negocio bien hecho te hace aparecer en Google Maps y en búsquedas como
"guardería canina cerca de mí". Es gratis. No se puede automatizar desde el código:
se crea desde https://business.google.com con el correo de Gmail del negocio.

## 1. Crear o reclamar el perfil
1. Entra a https://business.google.com con el Gmail del negocio.
2. Busca "Animal Friends". Si ya existe, pulsa **Reclamar**; si no, **Agregar tu negocio**.
3. Elige si tienes **local al que llegan clientes** o si **vas a domicilio / ruta** (negocio con área de servicio).
4. Verifica el perfil (Google ofrece llamada, mensaje, correo o video según el caso).

## 2. Regla de oro: datos idénticos en todas partes (NAP)
Nombre, dirección y teléfono deben ser **exactamente iguales** en el perfil, en la página
(`src/config/site.defaults.js`), en redes y en el JSON-LD. Las diferencias le restan confianza a Google.

| Campo | Qué poner |
|---|---|
| Nombre | Animal Friends (sin añadir palabras clave) |
| Teléfono | El mismo de WhatsApp: ver `negocio.telefonoVisible` |
| Dirección | La misma de `negocio.direccion` |
| Horario | El mismo que el pie de página (incluye horarios especiales si hay) |
| Sitio web | Tu dominio, con `?utm_source=google&utm_medium=organic&utm_campaign=perfil` para medirlo en Analytics |

## 3. Categorías
Elige una **categoría principal** y hasta 9 secundarias entre las que Google ofrezca para tu país
(los nombres exactos pueden variar). Busca equivalentes a:
guardería de mascotas / pensión para mascotas, peluquería canina, centro de adiestramiento o colegio canino.

## 4. Servicios y productos
Carga cada servicio con su descripción y precio de referencia (los mismos de la página):
Baños, Colegio con ruta, Hotel y Peluquería. Mantén los precios al día.

## 5. Fotos (lo que más influye)
- Logo (usa el isotipo circular) y foto de portada.
- Mínimo 10 fotos reales: instalaciones, zonas verdes, equipo, peluditos felices (con permiso).
- Agrega fotos nuevas cada mes.

## 6. Reseñas
- Pulsa **Obtener más reseñas** y copia el enlace corto.
- Envíalo por WhatsApp a las familias satisfechas, unos días después del servicio.
- Responde **todas** las reseñas con el tono de marca (cercano, "peludito").
- Nunca compres reseñas ni pidas solo reseñas positivas: Google lo sanciona.

## 7. Publicaciones
Una vez por semana: promociones, tips de cuidado, fotos de la guardería, con botón de WhatsApp.

## 8. Conectar con la página
1. Cuando el perfil esté publicado, copia el enlace de Google Maps y pégalo en `negocio.perfilGoogle`
   (`src/config/site.defaults.js`). Se agrega automáticamente a los datos estructurados (`hasMap` / `sameAs`).
2. Agrega el enlace del perfil en las redes sociales.

## 9. Google Search Console (para que Google indexe la página)
1. https://search.google.com/search-console → **Agregar propiedad** → tipo **Dominio**.
2. Copia el registro **TXT** que te muestra y pégalo en el DNS (si el dominio está en Cloudflare: DNS → Add record → TXT).
3. Cuando esté verificado, entra a **Sitemaps** y envía `sitemap.xml`.
4. Revisa **Inspección de URL** → *Solicitar indexación* para la página principal.
