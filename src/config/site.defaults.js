/**
 * VALORES POR DEFECTO DEL SITIO - generado desde el panel de control el 5/10/2026, 2:56:43 p. m..
 * Reemplaza el archivo src/config/site.defaults.js con este.
 */
export const SITE_DEFAULTS = {
  "negocio": {
    "nombre": "AnimalsFriends",
    "razonSocial": "Martin Gerardo Jiménez Davila",
    "nit": "1 0 2 2 3 5 9 5 6 3",
    "whatsapp": "573123044174",
    "telefonoVisible": "+57 312 3044174",
    "correo": "petcommunity.133@gmail.com",
    "direccion": "",
    "ciudad": "BOGOTÁ. D.C.",
    "ubicacionVisible": "",
    "perfilGoogle": "",
    "descripcionFooter": "Acompañamos a las familias cuidando con amor, respeto y alegría a sus compañeros de vida.",
    "moneda": "COP",
    "horarios": [
      "Lunes a Sábado: 7:00 AM – 6:00 PM",
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
  "categorias": [
    {
      "activa": true,
      "tipo": "normal",
      "id": "banos",
      "tarjeta": {
        "icono": "🛁",
        "titulo": "Baños para Perros",
        "descripcion": "Higiene profunda con productos adaptados a su tipo de pelaje y piel.",
        "puntos": [
          {
            "texto": "Baño medicado",
            "destacado": false
          },
          {
            "texto": "Baño normal",
            "destacado": false
          },
          {
            "texto": "Limpieza de oídos",
            "destacado": false
          },
          {
            "texto": "Deslanados",
            "destacado": false
          },
          {
            "texto": "Corte de uñas",
            "destacado": false
          }
        ],
        "textoBoton": "Seleccionar Baños"
      },
      "pestana": "🛁 Baños Perros",
      "tituloPanel": "Baños para Perros y Cuidados Básicos",
      "descripcionPanel": "Selecciona los servicios de higiene que necesites para tu peludito.",
      "servicios": [
        {
          "activo": true,
          "nombre": "Baño normal",
          "precio": 35000,
          "id": "bano-normal"
        },
        {
          "activo": true,
          "nombre": "Baño medicado",
          "precio": 50000,
          "id": "bano-medicado"
        },
        {
          "activo": true,
          "nombre": "Limpieza de oídos",
          "precio": 15000,
          "id": "limpieza-oidos"
        },
        {
          "activo": true,
          "nombre": "Deslanados",
          "precio": 30000,
          "id": "deslanados"
        },
        {
          "activo": true,
          "nombre": "Corte de uñas",
          "precio": 15000,
          "id": "corte-unas"
        }
      ]
    },
    {
      "activa": true,
      "tipo": "porDias",
      "id": "colegio",
      "tarjeta": {
        "icono": "🎓",
        "titulo": "Colegio Canino",
        "descripcion": "Espacios seguros de socialización y aprendizaje con transporte incluido.",
        "puntos": [
          {
            "texto": "Ruta Canina segura",
            "destacado": true
          },
          {
            "texto": "Socialización guiada",
            "destacado": false
          },
          {
            "texto": "Actividades cognitivas",
            "destacado": false
          }
        ],
        "textoBoton": "Seleccionar Colegio"
      },
      "pestana": "🎓 Colegio & Ruta",
      "tituloPanel": "Colegio Canino y Ruta",
      "descripcionPanel": "Selecciona el servicio de ruta canina y marca los días que asistirá tu peludito.",
      "unidadPrecio": "por día",
      "dias": [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado"
      ],
      "preguntaDias": "¿Qué días de la semana requiere ruta?",
      "servicios": [
        {
          "activo": true,
          "nombre": "Ruta Canina & Colegio Diario",
          "precio": 40000,
          "id": "colegio-ruta",
          "nombreMensaje": "Colegio con Ruta Canina"
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
          "activo": true,
          "nombre": "Alojamiento Hotel 24/7",
          "precio": 60000,
          "id": "hotel-noche",
          "nombreMensaje": "Hotel con Alojamiento"
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
          "activo": true,
          "nombre": "Corte y Peluquería Estética por Raza",
          "precio": 45000,
          "id": "corte-raza",
          "nombreMensaje": "Corte y Peluquería por raza"
        },
        {
          "activo": true,
          "nombre": "Desenredado profundo y spa capilar",
          "precio": 35000,
          "id": "desenredado-spa",
          "nombreMensaje": "Desenredado profundo y spa"
        }
      ]
    }
  ]
};
