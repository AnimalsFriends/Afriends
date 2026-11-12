# Estándares técnicos

## HTML
- HTML5 semántico; un `h1` principal por página; jerarquía lógica de títulos.
- Idioma `lang` correcto, enlaces descriptivos, botones para acciones.
- Formularios con `label`, tipos correctos, mensajes de error y política de tratamiento de datos cuando aplique.

## CSS
- Mobile-first, tokens para color/tipografía/espaciado; evitar valores dispersos.
- No deshabilitar indicadores de foco. Respetar `prefers-reduced-motion`.
- Mantener legibilidad en 320 px sin desplazamiento horizontal no intencional.

## JavaScript
- Módulos ES, funciones pequeñas, nombres descriptivos, manejo explícito de errores.
- No usar `innerHTML` con datos externos sin sanitización.
- No almacenar secretos ni enviar datos personales a endpoints no aprobados.

## Dependencias y seguridad
- Preferir la plataforma web; justificar dependencias y fijar versiones cuando se incorporen.
- Nunca registrar tokens ni claves en el repositorio.
- Validar datos en servidor si se implementa backend; la validación cliente no sustituye la del servidor.

## Calidad
- Ejecutar pruebas antes de solicitar aprobación.
- Registrar qué se verificó manualmente y qué no.
- No presentar puntuaciones Lighthouse o cumplimiento WCAG sin medición real.
