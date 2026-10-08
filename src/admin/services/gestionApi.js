/**
 * SERVICIO de la gestión de dueños y mascotas (Fase 2): habla con Supabase por REST.
 *
 * Reutiliza el manejo de sesión de adminApi.js (token del administrador, renovación
 * automática y reintento). La seguridad real NO está aquí sino en las políticas RLS
 * de la base de datos (Fase 1): aunque alguien manipulara este archivo, un usuario
 * que no sea admin recibiría listas vacías o errores de permiso.
 *
 * Errores (ApiError.code): perm (sin permiso) · missing (falta la tabla: no se aplicó
 * la Fase 1) · conflict (choca con otro dato) · fail (cualquier otro) · expired (sesión vencida).
 */
import { ENV } from "../../config/env.js";
import { ApiError, authed, rest } from "./adminApi.js";
import { esUuid } from "../models/gestionModel.js";

const API = String(ENV.SUPABASE_URL || "").replace(/\/$/, "");
const BUCKET_FOTOS = "fotos-mascotas";
const JSON_HEADERS = { "Content-Type": "application/json" };
const DEVOLVER = { ...JSON_HEADERS, Prefer: "return=representation" };

/** Los ids van directo en la dirección de la petición: se exige formato uuid para que nada raro se cuele. */
const uuid = (v) => {
  if (!esUuid(v)) throw new ApiError("fail");
  return v;
};

async function llamar(path, init = {}) {
  const response = await authed(rest(path), init);
  if (response.status === 401 || response.status === 403) throw new ApiError("perm");
  if (response.status === 404) throw new ApiError("missing");
  if (response.status === 409) throw new ApiError("conflict");
  if (!response.ok) throw new ApiError("fail");
  return response.status === 204 ? null : response.json();
}

const escribir = (method, path, body) => llamar(path, { method, headers: DEVOLVER, body: JSON.stringify(body) });
const primero = async (promesa) => (await promesa)?.[0] ?? null;

export const GestionApi = {
  /** ¿Este usuario es administrador? (función es_admin() de la base de datos) */
  async esAdmin() {
    const response = await authed(rest("rpc/es_admin"), { method: "POST", headers: JSON_HEADERS, body: "{}" });
    if (response.status === 404) throw new ApiError("missing");
    if (!response.ok) throw new ApiError("fail");
    return (await response.json()) === true;
  },

  /* ------------------------------ dueños ------------------------------ */
  /** Todos los dueños con el nombre de sus perros (basta para listar y buscar). */
  listDuenos: () => llamar("duenos?select=*,mascotas(id,nombre,raza,activa,es_bravo,esta_enfermo,toma_medicamentos)&order=nombre.asc&limit=1000"),
  createDueno: (datos) => primero(escribir("POST", "duenos", datos)),
  updateDueno: (id, datos) => primero(escribir("PATCH", `duenos?id=eq.${uuid(id)}`, datos)),
  setDuenoActivo: (id, activo) => primero(escribir("PATCH", `duenos?id=eq.${uuid(id)}`, { activo })),

  /* ------------------------------ personas autorizadas ------------------------------ */
  listAutorizadas: (duenoId) => llamar(`personas_autorizadas?dueno_id=eq.${uuid(duenoId)}&select=*&order=created_at.asc`),
  addAutorizada: (duenoId, datos) => primero(escribir("POST", "personas_autorizadas", { ...datos, dueno_id: uuid(duenoId) })),
  deleteAutorizada: (id) => llamar(`personas_autorizadas?id=eq.${uuid(id)}`, { method: "DELETE" }),

  /* ------------------------------ mascotas ------------------------------ */
  /** Una mascota con sus vacunas y medicamentos. */
  getMascota: (id) => primero(llamar(`mascotas?id=eq.${uuid(id)}&select=*,vacunas_mascota(*),medicamentos_mascota(*)`)),
  createMascota: (duenoId, datos) => primero(escribir("POST", "mascotas", { ...datos, dueno_id: uuid(duenoId) })),
  updateMascota: (id, datos) => primero(escribir("PATCH", `mascotas?id=eq.${uuid(id)}`, datos)),
  setMascotaActiva: (id, activa) => primero(escribir("PATCH", `mascotas?id=eq.${uuid(id)}`, { activa })),

  addVacuna: (mascotaId, datos) => primero(escribir("POST", "vacunas_mascota", { ...datos, mascota_id: uuid(mascotaId) })),
  deleteVacuna: (id) => llamar(`vacunas_mascota?id=eq.${uuid(id)}`, { method: "DELETE" }),

  addMedicamento: (mascotaId, datos) => primero(escribir("POST", "medicamentos_mascota", { ...datos, mascota_id: uuid(mascotaId) })),
  setMedicamentoActivo: (id, activo) => primero(escribir("PATCH", `medicamentos_mascota?id=eq.${uuid(id)}`, { activo })),
  deleteMedicamento: (id) => llamar(`medicamentos_mascota?id=eq.${uuid(id)}`, { method: "DELETE" }),

  /* ------------------------------ foto (Storage privado) ------------------------------ */
  /**
   * Sube la foto a fotos-mascotas/<id>/foto (siempre el mismo nombre: subir otra
   * reemplaza la anterior y no quedan archivos huérfanos). Devuelve la ruta guardada.
   */
  async subirFoto(mascotaId, blob) {
    const ruta = `${uuid(mascotaId)}/foto`;
    const response = await authed(`${API}/storage/v1/object/${BUCKET_FOTOS}/${ruta}`, {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/webp", "x-upsert": "true" },
      body: blob
    });
    if (response.status === 401 || response.status === 403) throw new ApiError("perm");
    if (!response.ok) throw new ApiError("fail");
    return ruta;
  },

  /**
   * Descarga la foto con la sesión del admin y la entrega como data: URL.
   * Se hace así (y no con un enlace firmado) porque la CSP del sitio solo permite
   * imágenes propias o data:, y no queremos abrirla a todo Supabase.
   */
  async bajarFoto(ruta) {
    const partes = String(ruta || "").split("/");
    if (partes.length !== 2 || !esUuid(partes[0]) || !/^[\w.-]+$/.test(partes[1])) throw new ApiError("fail");
    const response = await authed(`${API}/storage/v1/object/authenticated/${BUCKET_FOTOS}/${ruta}`);
    if (response.status === 401 || response.status === 403) throw new ApiError("perm");
    if (!response.ok) throw new ApiError("fail");
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(new ApiError("fail"));
      lector.readAsDataURL(blob);
    });
  }
};
