# Vistas del sitio

Cada módulo de esta carpeta convierte datos en HTML para una parte de la página:
encabezado, pie, servicios, cotizador, formulario y consentimiento. Los controladores
montan estas vistas y conectan sus eventos. El texto dinámico debe escaparse con
las utilidades existentes y las páginas deben seguir funcionando con la CSP.

El cotizador conserva la única acción principal “Cotizar por WhatsApp”; el enlace
del encabezado lleva al cotizador con estilo secundario. El formulario y los accesos
alternativos también se presentan como secundarios. Revisa el resultado en móvil
antes de publicar.
