/**
 * VALORES POR DEFECTO DEL SITIO - generado desde el panel de control el 5/10/2026, 2:56:43 p. m..
 * Reemplaza el archivo src/config/site.defaults.js con este.
 */
export const SITE_DEFAULTS = {



  /* ------------------------------------------------------------------
     1. DATOS DEL NEGOCIO
     ------------------------------------------------------------------ */
  negocio: {
    nombre: "Animal Friends",

    // Datos legales (los usan Aviso Legal y Política de Privacidad). Complétalos antes de publicar.
    razonSocial: "",       // Ej: "Animal Friends S.A.S." o nombre completo del titular
    nit: "",               // Ej: "901.234.567-8" o cédula si es persona natural


    // Número para recibir los pedidos. Solo dígitos, con código de país, sin + ni espacios.
    // Colombia = 57  ->  57 + 3123044174
    whatsapp: "573123044174",

    // Cómo se ve el número en la página
    telefonoVisible: "+57 312 3044174",

    correo: "petcommunity.133@gmail.com",            // Ej: "hola@animalfriends.com.co"  (vacío = no se muestra)
    direccion: "",         // Ej: "Calle 123 # 45-67, Barrio X" (vacío = no se muestra)
    ciudad: "Chía",      // Se usa para el SEO (Google)
    ubicacionVisible: "Chía, Cundinamarca, Colombia",   // Lo que se ve en el pie de página

    // Cada línea es un renglón en el pie de página
    horarios: [
      "Lunes a Sábado: 8:00 AM – 6:00 PM",
      "Hotel Canino: Abierto 24/7"
    ],
    "horarioSEO": {
      "dias": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ],
      "abre": "08:00",
      "cierra": "18:00"
    },
    "redes": {
      "instagram": "",
      "facebook": "",
      "tiktok": ""
    },
    "sitioWeb": "",
    "mensajeWhatsApp": {
      "saludo": "¡Hola! Qué alegría saludarte 🐾.",
      "cierre": "¿Me confirman disponibilidad por favor?"
    }
  },


  /* ------------------------------------------------------------------
     2. CATEGORÍAS (TARJETAS) Y SERVICIOS
     ------------------------------------------------------------------
     Cada categoría = 1 tarjeta en "Nuestros Servicios" + 1 pestaña en el cotizador.

     activa: true / false   -> muestra u oculta TODA la categoría (tarjeta, pestaña y servicios)

     tipo (cómo se calcula el precio):
       "normal"     -> cada servicio tiene un precio fijo.
       "porDias"    -> el cliente marca los días; precio x cantidad de días (ej. colegio).
       "porNoches"  -> el cliente escribe las noches; precio x noches (ej. hotel).

     servicios: lista de servicios dentro de la categoría.
       activo: true / false   -> muestra u oculta ESE servicio
       precio: número sin puntos
       nombreMensaje (opcional): cómo aparece en el mensaje de WhatsApp
       descripcion  (opcional): texto pequeño debajo del nombre

     Para AGREGAR un servicio: copia un bloque { ... }, pégalo dentro de "servicios"
     y cambia el id (único, sin espacios ni tildes), el nombre y el precio.

     Para AGREGAR una categoría completa: copia un bloque grande desde
     "{ id: ..." hasta su "}," final, pégalo al final de la lista y edítalo.
     ------------------------------------------------------------------ */
  categorias: [

    /* ---------------------------- BAÑOS ---------------------------- */
    {
      id: "banos",                 // único, sin espacios ni tildes
      activa: true,
      tipo: "normal",

      // Tarjeta en "Nuestros Servicios"
      tarjeta: {
        icono: "🛁",
        titulo: "Baños para Perros",
        descripcion: "Higiene profunda con productos adaptados a su tipo de pelaje y piel.",
        puntos: [
          "Baño medicado",
          "Baño normal",
          "Limpieza de oídos",
          "Deslanados",
          "Corte de uñas"
        ],
        textoBoton: "Seleccionar Baños"
      },

      // Pestaña y panel del cotizador
      pestana: "🛁 Baños Perros",
      tituloPanel: "Baños para Perros y Cuidados Básicos",
      descripcionPanel: "Selecciona los servicios de higiene que necesites para tu peludito.",

      servicios: [
        { id: "bano-normal",    activo: true, nombre: "Baño normal",       precio: 35000 },
        { id: "bano-medicado",  activo: true, nombre: "Baño medicado",     precio: 50000 },
        { id: "limpieza-oidos", activo: true, nombre: "Limpieza de oídos", precio: 15000 },
        { id: "deslanados",     activo: true, nombre: "Deslanados",        precio: 30000 },
        { id: "corte-unas",     activo: true, nombre: "Corte de uñas",     precio: 15000 }
      ]
    },

    /* ---------------------------- COLEGIO ---------------------------- */
    {
      id: "colegio",
      activa: true,
      tipo: "porDias",

      tarjeta: {
        icono: "🎓",
        titulo: "Colegio Canino",
        descripcion: "Espacios seguros de socialización y aprendizaje con transporte incluido.",
        puntos: [
          { texto: "Ruta Canina segura", destacado: true },
          "Socialización guiada",
          "Actividades cognitivas"
        ],
        "textoBoton": "Seleccionar Colegio"
      },

      pestana: "🎓 Colegio & Ruta",
      tituloPanel: "Colegio Canino y Ruta",
      descripcionPanel: "Selecciona el servicio de ruta canina y marca los días que asistirá tu peludito.",

      unidadPrecio: "por día",                       // texto junto al precio
      dias: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
      preguntaDias: "¿Qué días de la semana requiere ruta?",

      servicios: [
        {
          id: "colegio-ruta", activo: true,
          nombre: "Ruta Canina & Colegio Diario",
          nombreMensaje: "Colegio con Ruta Canina",
          precio: 40000
        }
      ]
    },
    {
      "activa": true,
      "tipo": "porNoches",
      "id": "hotel",
      "tarjeta": {
        "icono": "🏨",
        "titulo": "Hotel para Mascotas",
        "descripcion": "El segundo hogar de tu peludito cuando sales de viaje, con atención 24/7.",
        "puntos": [
          {
            "texto": "Alojamiento cómodo",
            "destacado": true
          },
          {
            "texto": "Monitoreo y fotos diarias",
            "destacado": false
          },
          {
            "texto": "Zonas verdes amplias",
            "destacado": false
          }
        ],
        "textoBoton": "Seleccionar Hotel"
      },
      "pestana": "🏨 Hotel Mascotas",
      "tituloPanel": "Hotel para Mascotas",
      "descripcionPanel": "Selecciona el alojamiento y elige cuántas noches se quedará.",
      "unidadPrecio": "por noche",
      "maxNoches": 30,
      "textoNoches": "Número de Noches de Estadía:",
      "notaNoches": "Incluye alimentación personalizada, paseos y monitoreo fotográfico diario.",
      "servicios": [
        {
          id: "hotel-noche", activo: true,
          nombre: "Alojamiento Hotel 24/7",
          nombreMensaje: "Hotel con Alojamiento",
          precio: 60000
        }
      ]
    },
    {
      "activa": true,
      "tipo": "normal",
      "id": "peluqueria",
      "tarjeta": {
        "icono": "✂️",
        "titulo": "Peluquería Canina",
        "descripcion": "Estética especializada según la raza y estilo que prefieras para tu amigo.",
        "puntos": [
          {
            "texto": "Corte según raza",
            "destacado": true
          },
          {
            "texto": "Estética profesional",
            "destacado": false
          },
          {
            "texto": "Desenredado delicado",
            "destacado": false
          }
        ],
        "textoBoton": "Seleccionar Peluquería"
      },
      "pestana": "✂️ Peluquería",
      "tituloPanel": "Peluquería Canina Especializada",
      "descripcionPanel": "Estética y corte profesional según la raza.",
      "servicios": [
        {
          id: "corte-raza", activo: true,
          nombre: "Corte y Peluquería Estética por Raza",
          nombreMensaje: "Corte y Peluquería por raza",
          precio: 45000
        },
        {
          id: "desenredado-spa", activo: true,
          nombre: "Desenredado profundo y spa capilar",
          nombreMensaje: "Desenredado profundo y spa",
          precio: 35000
        }
      ]
    }

    /* Para agregar otra categoría, pon una coma después de la llave "}" de arriba
       y pega aquí un bloque nuevo (copia uno de los de arriba y edítalo). */
  ]
};
