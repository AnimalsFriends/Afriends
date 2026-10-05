/**
 * Construye enlaces de WhatsApp (wa.me). Devuelve "" si no hay número válido.
 */
export const whatsappUrl = (phone, text = "") => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};
