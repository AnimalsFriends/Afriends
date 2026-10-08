/**
 * Acceso REST de la agenda. Reutiliza la sesión del panel y los datos de rutas,
 * mascotas y reservas ya consultados por RutasApi.
 */
import { inicioDiaBogotaUTC } from "../models/agendaModel.js";
import { esUuid } from "../models/gestionModel.js";
import { llamar } from "./gestionApi.js";
import { RutasApi } from "./rutasApi.js";
import { ApiError } from "./adminApi.js";

const JSON_HEADERS = { "Content-Type": "application/json" };
const REPRESENTACION = { ...JSON_HEADERS, Prefer: "return=representation" };

const uuid = (value) => {
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

export const AgendaApi = {
  async cargar({ fecha, rango }) {
    const mes = fecha.slice(0, 7);
    const [year, month] = mes.split("-").map(Number);
    const inicioMes = `${mes}-01`;
    const finMes = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const desde = inicioDiaBogotaUTC(rango.inicio);
    const hasta = inicioDiaBogotaUTC(rango.fin);
    if (!desde || !hasta) throw new ApiError("fail");
    const [operacion, citas, reservas, servicios] = await Promise.all([
      RutasApi.cargar({ fecha, inicioMes, finMes }),
      listaCompleta(`citas?select=*&inicio=lt.${hasta}&fin=gt.${desde}&order=inicio.asc,id.asc`),
      RutasApi.reservasEntre(rango.inicio, rango.fin),
      listaCompleta("servicios?select=codigo,nombre,activo,orden&activo=eq.true&order=orden.asc,codigo.asc")
    ]);
    return { ...operacion, citas, reservas, servicios };
  },

  citasSolapadas(inicio, fin) {
    const inicioMs = Date.parse(inicio);
    const finMs = Date.parse(fin);
    if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs) || finMs <= inicioMs) {
      throw new ApiError("fail");
    }
    return listaCompleta(
      `citas?select=*&inicio=lt.${encodeURIComponent(fin)}&fin=gt.${encodeURIComponent(inicio)}&order=inicio.asc,id.asc`
    );
  },

  crearCita: (datos) => primeraFila(escribir("POST", "citas", {
    ...datos, mascota_id: uuid(datos.mascota_id), empleado_id: uuid(datos.empleado_id)
  })),
  actualizarCita: (id, datos) => primeraFila(escribir("PATCH", `citas?id=eq.${uuid(id)}`, {
    ...datos, mascota_id: uuid(datos.mascota_id), empleado_id: uuid(datos.empleado_id)
  })),
  actualizarEstado: (id, estado) => primeraFila(escribir("PATCH", `citas?id=eq.${uuid(id)}`, { estado }))
};
