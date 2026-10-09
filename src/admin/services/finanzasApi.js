/**
 * Operaciones financieras del admin. RLS sigue siendo la frontera de seguridad;
 * los recibos viajan por el bucket privado ya creado para gastos.
 */
import { ENV } from "../../config/env.js";
import { ApiError, authed, rest } from "./adminApi.js";
import { llamar } from "./gestionApi.js";
import { esUuid } from "../models/gestionModel.js";

const API = String(ENV.SUPABASE_URL || "").replace(/\/$/, "");
const BUCKET_RECIBOS = "recibos";
const JSON_HEADERS = { "Content-Type": "application/json" };
const REPRESENTACION = { ...JSON_HEADERS, Prefer: "return=representation" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validarUuid = (value) => {
  if (!esUuid(value)) throw new ApiError("fail");
  return value;
};

async function listaCompleta(path) {
  const filas = [];
  const tamanoPagina = 1000;
  for (let offset = 0; ; offset += tamanoPagina) {
    const pagina = await llamar(`${path}${path.includes("?") ? "&" : "?"}limit=${tamanoPagina}&offset=${offset}`);
    filas.push(...pagina);
    if (pagina.length < tamanoPagina) return filas;
  }
}

const primeraFila = async (promise) => (await promise)?.[0] ?? null;
const escribir = (method, path, body) =>
  llamar(path, { method, headers: REPRESENTACION, body: JSON.stringify(body) });

async function llamadaStorage(url, init) {
  const response = await authed(url, init);
  if (response.status === 401 || response.status === 403) throw new ApiError("perm");
  if (response.status === 404) throw new ApiError("missing");
  if (!response.ok) throw new ApiError("fail");
  return response;
}

function rutaRecibo(value) {
  const path = String(value ?? "");
  if (!new RegExp(`^gastos/${UUID.source.slice(1, -1)}/recibo$`, "i").test(path)) throw new ApiError("fail");
  return path;
}

export const FinanzasApi = {
  async cargar() {
    const [gastos, pagos, abonos, duenos, mascotas, servicios] = await Promise.all([
      listaCompleta("gastos?select=*&order=fecha.desc,id.asc"),
      listaCompleta("pagos?select=*&order=fecha.desc,id.asc"),
      listaCompleta("abonos?select=*&order=fecha.desc,id.asc"),
      listaCompleta("duenos?select=id,nombre,telefono&order=nombre.asc,id.asc"),
      listaCompleta("mascotas?select=id,nombre,dueno_id&order=nombre.asc,id.asc"),
      listaCompleta("servicios?select=codigo,nombre,activo&order=orden.asc,codigo.asc")
    ]);
    return { gastos, pagos, abonos, duenos, mascotas, servicios };
  },

  crearGasto: (datos) => primeraFila(escribir("POST", "gastos", datos)),
  actualizarGasto: (id, datos) => primeraFila(escribir("PATCH", `gastos?id=eq.${validarUuid(id)}`, datos)),
  crearCobro: (datos) => primeraFila(escribir("POST", "pagos", datos)),
  async crearAbono(datos) {
    const response = await authed(rest("abonos"), {
      method: "POST", headers: REPRESENTACION, body: JSON.stringify(datos)
    });
    if (response.status === 401 || response.status === 403) throw new ApiError("perm");
    if (response.status === 404) throw new ApiError("missing");
    if (response.status === 409) throw new ApiError("conflict");
    if (!response.ok) {
      const detalle = await response.json();
      if (detalle?.code === "23514" && String(detalle?.message ?? "").includes("supera el saldo")) {
        throw new ApiError("conflict");
      }
      throw new ApiError("fail");
    }
    return response.status === 204 ? null : primeraFila(Promise.resolve(await response.json()));
  },

  async subirRecibo(gastoId, archivo) {
    const ruta = `gastos/${validarUuid(gastoId)}/recibo`;
    await llamadaStorage(`${API}/storage/v1/object/${BUCKET_RECIBOS}/${ruta}`, {
      method: "POST",
      headers: { "Content-Type": archivo.type, "x-upsert": "true" },
      body: archivo
    });
    return ruta;
  },

  async descargarRecibo(path) {
    const ruta = rutaRecibo(path);
    const response = await llamadaStorage(`${API}/storage/v1/object/authenticated/${BUCKET_RECIBOS}/${ruta}`);
    return response.blob();
  }
};
