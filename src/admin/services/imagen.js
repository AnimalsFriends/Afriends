/**
 * Reduce una foto en el navegador antes de subirla.
 *
 * Por qué: las fotos del celular pesan varios MB. El bucket acepta máximo 5 MB, y
 * además cada foto se descarga con la sesión del admin para mostrarla; si fueran
 * enormes el panel iría lento. Con 800 px de lado largo la foto se ve bien en la
 * ficha y queda en unas decenas de KB.
 */
const LADO_MAXIMO = 800;
const CALIDAD = 0.82;

export async function reducirImagen(archivo, ladoMaximo = LADO_MAXIMO) {
  if (!archivo || !String(archivo.type).startsWith("image/")) throw new Error("no-imagen");
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.max(1, Math.round(bitmap.width * escala));
  const alto = Math.max(1, Math.round(bitmap.height * escala));

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext("2d").drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close?.();

  // WebP si el navegador lo permite; si no, devuelve PNG (el bucket acepta jpeg, png y webp).
  const blob = await new Promise((resolve) => lienzo.toBlob(resolve, "image/webp", CALIDAD));
  if (!blob) throw new Error("no-se-pudo-reducir");
  return blob;
}
