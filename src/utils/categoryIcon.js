const ICONS = Object.freeze({
  banos: "bathroom.png", colegio: "School.png", hotel: "hotel.png",
  peluqueria: "hairdressers shop.png", veterinaria: "medical_consultations.png",
  accesorios: "accessories.png", entrenamiento: "training.png", comida: "food.png"
});

export const categoryIcon = (id) => `img/icon/${ICONS[id] || "medical_consultations.png"}`;
export const withoutEmoji = (value = "") => String(value).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\s+/g, " ").trim();
