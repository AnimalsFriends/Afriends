/** Permisos de presentación del panel. RLS sigue siendo la autoridad de datos. */
const MODULES = Object.freeze({
  admin: Object.freeze(["negocio", "servicios", "leads", "conversaciones", "gestion", "rutas", "agenda", "finanzas", "seguimiento"]),
  empleado: Object.freeze(["agenda", "servicios", "gestion", "rutas", "conversaciones"]),
  offline: Object.freeze(["negocio", "servicios"])
});

export function puedeVerModulo(rol, modulo) {
  return Boolean(MODULES[rol]?.includes(modulo));
}

export function puedeEjecutarAccion(rol, modulo, accion) {
  if (!puedeVerModulo(rol, modulo)) return false;
  if (rol === "admin") return true;
  if (rol === "offline") return modulo === "negocio" || modulo === "servicios";
  if (rol === "empleado" && modulo === "servicios") return accion === "consultar";
  if (rol === "empleado" && modulo === "agenda") return ["recargar", "cambiar_fecha", "navegar"].includes(accion);
  return modulo === "rutas" && ["recargar", "cambiar_fecha", "marcar_parada"].includes(accion)
    || modulo === "gestion" && ["buscar", "recargar"].includes(accion);
}

export function modulosPorRol(rol) {
  return [...(MODULES[rol] ?? [])];
}
