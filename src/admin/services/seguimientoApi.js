/**
 * Datos de vencimientos, asistencia escolar e historial. El permiso de admin se
 * comprueba en el controlador y vuelve a imponerse en Supabase mediante RLS.
 */
import { llamar } from "./gestionApi.js";
import { ApiError } from "./adminApi.js";
import { esFechaISO, esUuid } from "../models/gestionModel.js";
import { TAMANO_PAGINA_HISTORIAL, validarRegistroAsistencia } from "../models/seguimientoModel.js";

const JSON_HEADERS = { "Content-Type": "application/json" };
const REPRESENTACION = { ...JSON_HEADERS, Prefer: "return=representation" };
const uuid = (value) => {
  if (!esUuid(value)) throw new ApiError("fail");
  return value;
};
const primeraFila = async (promise) => (await promise)?.[0] ?? null;
const escribir = (method, path, body, headers = REPRESENTACION) =>
  llamar(path, { method, headers, body: JSON.stringify(body) });

async function listaCompleta(path) {
  const filas = [];
  const tamanoPagina = 1000;
  for (let offset = 0; ; offset += tamanoPagina) {
    const pagina = await llamar(`${path}${path.includes("?") ? "&" : "?"}limit=${tamanoPagina}&offset=${offset}`);
    filas.push(...pagina);
    if (pagina.length < tamanoPagina) return filas;
  }
}

export const SeguimientoApi = {
  async cargar(fecha, fechaLimite) {
    if (!esFechaISO(fecha) || !esFechaISO(fechaLimite) || fechaLimite < fecha) throw new ApiError("fail");
    const [mascotas, planes, reservas, ausencias, registros, vacunas, soat, empleados] = await Promise.all([
      listaCompleta("mascotas?select=id,nombre,activa,dueno_id&order=nombre.asc,id.asc"),
      listaCompleta("planes_colegio?select=*&order=desde.desc,id.asc"),
      listaCompleta(`reservas_hotel?select=*&entrada=lte.${fecha}&salida=gt.${fecha}&order=entrada.asc,id.asc`),
      listaCompleta(`ausencias_colegio?select=*&fecha=eq.${fecha}&order=created_at.asc,id.asc`),
      listaCompleta(`asistencia_colegio?select=*&fecha=eq.${fecha}&order=mascota_id.asc,id.asc`),
      listaCompleta(`vacunas_mascota?select=id,mascota_id,tipo,nombre,fecha_vencimiento&fecha_vencimiento=lte.${fechaLimite}&order=fecha_vencimiento.asc,id.asc`),
      listaCompleta("soat_vehiculos?select=id,vehiculo,fecha_vencimiento,notas&order=fecha_vencimiento.asc,id.asc"),
      listaCompleta("empleados?select=id,nombre&order=nombre.asc,id.asc")
    ]);
    return { mascotas, planes, reservas, ausencias, registros, vacunas, soat, empleados };
  },

  cargarHistorial(offset = 0) {
    if (!Number.isInteger(offset) || offset < 0) throw new ApiError("fail");
    return llamar(`historial_cambios?select=id,tabla,registro_id,operacion,actor_id,actor_nombre,actor_correo,ocurrido_en,valores_anteriores,valores_nuevos&order=ocurrido_en.desc,id.desc&limit=${TAMANO_PAGINA_HISTORIAL}&offset=${offset}`);
  },

  crearSoat: (datos) => primeraFila(escribir("POST", "soat_vehiculos", datos)),
  actualizarSoat: (id, datos) => primeraFila(escribir("PATCH", `soat_vehiculos?id=eq.${uuid(id)}`, datos)),

  async marcarLlegada(mascotaId, fecha) {
    if (!validarRegistroAsistencia(mascotaId, fecha)) throw new ApiError("fail");
    const path = "asistencia_colegio?on_conflict=mascota_id,fecha";
    const rows = await escribir("POST", path, {
      mascota_id: uuid(mascotaId), fecha, entrada_en: new Date().toISOString()
    }, { ...JSON_HEADERS, Prefer: "resolution=ignore-duplicates,return=representation" });
    if (rows?.[0]) return rows[0];
    return primeraFila(llamar(`asistencia_colegio?select=*&mascota_id=eq.${uuid(mascotaId)}&fecha=eq.${fecha}`));
  },

  marcarSalida(id) {
    return primeraFila(escribir("PATCH", `asistencia_colegio?id=eq.${uuid(id)}`, {
      salida_en: new Date().toISOString()
    }));
  },

  registrarFalta(mascotaId, fecha, motivo) {
    if (!validarRegistroAsistencia(mascotaId, fecha) || String(motivo ?? "").trim().length > 300) {
      throw new ApiError("fail");
    }
    return primeraFila(escribir("POST", "ausencias_colegio", {
      mascota_id: uuid(mascotaId), fecha, motivo: String(motivo ?? "").trim() || null
    }));
  },

  quitarFalta(id) {
    return llamar(`ausencias_colegio?id=eq.${uuid(id)}`, { method: "DELETE" });
  }
};
