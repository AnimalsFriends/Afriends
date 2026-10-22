import { ApiError, authed, rest } from "./adminApi.js";

const uuid = (id) => /^[0-9a-f-]{36}$/i.test(String(id ?? ""));
async function request(path, init) {
  const response = await authed(rest(path), init);
  if ([401, 403].includes(response.status)) throw new ApiError("perm");
  if (!response.ok) throw new ApiError(response.status === 404 ? "missing" : "fail");
  return response.status === 204 ? null : response.json();
}
export const MensajesApi = {
  async contexto() {
    const admin = await request("rpc/es_admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (admin) return { admin: true, empleadoId: null };
    const id = await request("rpc/empleado_actual_id", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    return { admin: false, empleadoId: id };
  },
  empleados: () => request("empleados?select=id,nombre&rol=eq.empleado&activo=eq.true&order=nombre.asc", {}),
  listar: (empleadoId) => {
    if (!uuid(empleadoId)) throw new ApiError("fail");
    return request(`mensajes_equipo?empleado_id=eq.${empleadoId}&select=*&order=creado_en.asc&limit=500`, {});
  },
  async enviar(empleadoId, cuerpo) {
    if (!uuid(empleadoId)) throw new ApiError("fail");
    return request("rpc/mensaje_equipo_enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_empleado: empleadoId, p_cuerpo: cuerpo }) });
  },
  leer: (id) => request("rpc/mensaje_equipo_marcar_leido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_mensaje: id }) })
};
