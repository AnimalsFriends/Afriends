/**
 * Acceso a rutas, planes de colegio, ausencias y hotel.
 * Reutiliza llamar() para conservar el token, la renovación y los errores comunes
 * del panel; los permisos reales siguen dependiendo de RLS en Supabase.
 */
import { llamar } from "./gestionApi.js";
import { ApiError } from "./adminApi.js";
import { esUuid } from "../models/gestionModel.js";

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
const escribir = (method, path, body, headers = REPRESENTACION) =>
  llamar(path, { method, headers, body: JSON.stringify(body) });

export const RutasApi = {
  async cargar({ fecha, inicioMes, finMes }) {
    const [
      rutas, paradas, mascotas, duenos, planes, reservas, ausencias,
      paradasDia, empleados, parametros
    ] = await Promise.all([
      listaCompleta("rutas_colegio?select=*&order=nombre.asc,id.asc"),
      listaCompleta("paradas_ruta?select=*&order=ruta_id.asc,sentido.asc,orden.asc,id.asc"),
      listaCompleta("mascotas?select=id,nombre,activa,dueno_id&order=nombre.asc,id.asc"),
      listaCompleta("duenos?select=id,nombre,direccion,telefono&order=nombre.asc,id.asc"),
      listaCompleta("planes_colegio?select=*&order=desde.desc,id.asc"),
      listaCompleta(`reservas_hotel?select=*&entrada=lt.${finMes}&salida=gt.${inicioMes}&order=entrada.asc,id.asc`),
      listaCompleta(`ausencias_colegio?select=*&fecha=eq.${fecha}&order=created_at.asc,id.asc`),
      listaCompleta(`paradas_dia?select=*&fecha=eq.${fecha}&order=parada_id.asc,id.asc`),
      listaCompleta("empleados?select=id,nombre&rol=eq.empleado&activo=eq.true&order=nombre.asc,id.asc"),
      listaCompleta("parametros_operativos?id=eq.1&select=cupos_hotel,perros_por_empleado")
    ]);
    return {
      rutas, paradas, mascotas, duenos, planes, reservas, ausencias, paradasDia, empleados,
      cuposHotel: parametros[0]?.cupos_hotel ?? null
    };
  },

  async cargarDia(fecha) {
    const [reservas, ausencias, paradasDia] = await Promise.all([
      listaCompleta(`reservas_hotel?select=*&entrada=lte.${fecha}&salida=gt.${fecha}&order=entrada.asc,id.asc`),
      listaCompleta(`ausencias_colegio?select=*&fecha=eq.${fecha}&order=created_at.asc,id.asc`),
      listaCompleta(`paradas_dia?select=*&fecha=eq.${fecha}&order=parada_id.asc,id.asc`)
    ]);
    return { reservas, ausencias, paradasDia };
  },

  reservasEntre: (inicio, fin) =>
    listaCompleta(`reservas_hotel?select=*&entrada=lt.${fin}&salida=gt.${inicio}&order=entrada.asc,id.asc`),

  crearRuta: (datos) => primeraFila(escribir("POST", "rutas_colegio", datos)),
  actualizarRuta: (id, datos) => primeraFila(escribir("PATCH", `rutas_colegio?id=eq.${uuid(id)}`, datos)),
  activarRuta: (id, activa) => primeraFila(escribir("PATCH", `rutas_colegio?id=eq.${uuid(id)}`, { activa })),

  crearParada: (datos) => primeraFila(escribir("POST", "paradas_ruta", datos)),
  actualizarParada: (id, datos) => primeraFila(escribir("PATCH", `paradas_ruta?id=eq.${uuid(id)}`, datos)),
  activarParada: (id, activa) => primeraFila(escribir("PATCH", `paradas_ruta?id=eq.${uuid(id)}`, { activa })),
  reordenarParadas: (rutaId, sentido, ids) =>
    llamar("rpc/reordenar_paradas", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ p_ruta_id: uuid(rutaId), p_sentido: sentido, p_ids: ids.map(uuid) })
    }),

  crearPlan: (datos) => primeraFila(escribir("POST", "planes_colegio", datos)),
  activarPlan: (id, activo) => primeraFila(escribir("PATCH", `planes_colegio?id=eq.${uuid(id)}`, { activo })),

  async asegurarParadasDia(fecha, ids) {
    if (!ids.length) return [];
    const filas = ids.map((parada_id) => ({ parada_id: uuid(parada_id), fecha }));
    return escribir("POST", "paradas_dia?on_conflict=parada_id,fecha", filas, {
      ...JSON_HEADERS,
      Prefer: "resolution=ignore-duplicates,return=representation"
    });
  },
  actualizarEstadoParada: (id, estado, motivo) =>
    primeraFila(escribir("PATCH", `paradas_dia?id=eq.${uuid(id)}`, { estado, motivo })),
  crearAusencia: (mascotaId, fecha, motivo) =>
    primeraFila(escribir("POST", "ausencias_colegio", { mascota_id: uuid(mascotaId), fecha, motivo })),
  quitarAusencia: (id) => llamar(`ausencias_colegio?id=eq.${uuid(id)}`, { method: "DELETE" }),

  crearReserva: (datos) => primeraFila(escribir("POST", "reservas_hotel", datos)),
  actualizarReserva: (id, datos) => primeraFila(escribir("PATCH", `reservas_hotel?id=eq.${uuid(id)}`, datos)),
  actualizarEstadoReserva: (id, estado) =>
    primeraFila(escribir("PATCH", `reservas_hotel?id=eq.${uuid(id)}`, { estado })),
  actualizarCupos: (cupos_hotel) =>
    primeraFila(escribir("PATCH", "parametros_operativos?id=eq.1", { cupos_hotel }))
};
