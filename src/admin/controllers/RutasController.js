/**
 * Controlador de la operación diaria de rutas y hotel (Fase 3).
 * Las fichas se guardan al momento; el estado del servicio se calcula desde planes,
 * reservas y ausencias, no se copia a la mascota.
 */
import { AuthError } from "../services/authService.js";
import { GestionApi } from "../services/gestionApi.js";
import { RutasApi } from "../services/rutasApi.js";
import {
  DIAS_COLEGIO, hoyBogota, moverItem, servicioMascotaEnFecha,
  validarCupos, validarParada, validarPlan, validarReserva, validarRuta,
  contarOcupacionDia
} from "../models/rutasModel.js";
import { RutasViews } from "../views/rutasViews.js";

const fechaMas = (fecha, dias) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};
const rangoMes = (mes) => {
  const [y, m] = mes.split("-").map(Number);
  return { inicioMes: `${mes}-01`, finMes: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) };
};
const formulariosNuevos = (fecha) => ({
  ruta: { id: null, nombre: "", empleado_id: "" },
  parada: { id: null, ruta_id: "", mascota_id: "", sentido: "recogida", localidad: "", direccion: "", hora_estimada: "" },
  plan: { mascota_id: "", dias_semana: [], desde: fecha, hasta: "" },
  reserva: { id: null, mascota_id: "", entrada: fecha, salida: fechaMas(fecha, 1), estado: "reservada", tambien_colegio: false, notas_comida: "", notas_medicacion: "", notas: "" },
  cupos: ""
});

export class RutasController {
  constructor({ panel, toast, expire }) {
    this.getPanel = panel;
    this.toast = toast;
    this.expire = expire;
    this.active = false;
    this.loaded = false;
    this.dirtyForms = new Set();
    const fecha = hoyBogota();
    this.state = {
      loading: false, error: null, isAdmin: null, vista: "hoy",
      fecha, mes: fecha.slice(0, 7),
      rutas: [], paradas: [], mascotas: [], duenos: [], planes: [], reservas: [],
      ausencias: [], paradasDia: [], empleados: [], cuposHotel: null,
      formularios: formulariosNuevos(fecha)
    };
  }

  bind(panel) {
    panel.addEventListener("input", (event) => this.active && this.onInput(event));
    panel.addEventListener("change", (event) => this.active && this.onChange(event));
    panel.addEventListener("click", (event) => this.active && this.onClick(event));
  }

  setActive(activo) {
    this.active = activo;
    if (!activo) return;
    if (!this.loaded) this.cargar();
    else this.render();
  }

  render() {
    if (this.active) this.getPanel().innerHTML = RutasViews.render(this.state);
  }

  sesionVencida(error) {
    if (error?.code === "expired" || error instanceof AuthError) {
      this.expire();
      return true;
    }
    return false;
  }

  fallo(error, mensaje) {
    if (this.sesionVencida(error)) return;
    const textos = {
      perm: "Tu usuario no tiene permiso para gestionar rutas o reservas.",
      missing: "Faltan las tablas de la Fase 1 en Supabase. Revisa las migraciones.",
      conflict: "Ese dato se cruza con otro registro. Revisa fechas y paradas."
    };
    this.toast(textos[error?.code] ?? mensaje, "err");
  }

  async cargar() {
    const s = this.state;
    s.loading = true;
    s.error = null;
    this.render();
    try {
      s.isAdmin = await GestionApi.esAdmin();
      if (!s.isAdmin) return false;
      const periodo = rangoMes(s.mes);
      const data = await RutasApi.cargar({ fecha: s.fecha, ...periodo });
      Object.assign(s, data);
      if (!this.dirtyForms.has("cupos")) s.formularios.cupos = String(s.cuposHotel ?? "");
      if (!s.formularios.parada.ruta_id) s.formularios.parada.ruta_id = s.rutas.find((r) => r.activa)?.id ?? "";
      if (!s.formularios.parada.mascota_id) s.formularios.parada.mascota_id = s.mascotas.find((m) => m.activa)?.id ?? "";
      if (!s.formularios.plan.mascota_id) s.formularios.plan.mascota_id = s.mascotas.find((m) => m.activa)?.id ?? "";
      if (!s.formularios.reserva.mascota_id) s.formularios.reserva.mascota_id = s.mascotas.find((m) => m.activa)?.id ?? "";
      await this.prepararParadasDelDia();
      this.loaded = true;
      return true;
    } catch (error) {
      if (this.sesionVencida(error)) return false;
      s.error = ["perm", "missing"].includes(error?.code) ? error.code : "fail";
      return false;
    } finally {
      s.loading = false;
      this.render();
    }
  }

  async prepararParadasDelDia() {
    const s = this.state;
    const ids = [];
    for (const route of s.rutas.filter((r) => r.activa)) {
      for (const stop of s.paradas.filter((p) => p.ruta_id === route.id && p.activa)) {
        const mascota = s.mascotas.find((m) => m.id === stop.mascota_id);
        const servicio = servicioMascotaEnFecha(mascota, s.fecha, s.planes, s.reservas, s.ausencias);
        if (servicio.codigo === "colegio" || servicio.codigo === "hotel_colegio") ids.push(stop.id);
      }
    }
    await RutasApi.asegurarParadasDia(s.fecha, ids);
    const diario = await RutasApi.cargarDia(s.fecha);
    s.paradasDia = diario.paradasDia;
    s.ausencias = diario.ausencias;
    const porId = new Map(s.reservas.map((r) => [r.id, r]));
    for (const reserva of diario.reservas) porId.set(reserva.id, reserva);
    s.reservas = [...porId.values()];
  }

  async recargarTrasCambio(mensaje) {
    const cargo = await this.cargar();
    if (cargo) this.toast(mensaje, "ok");
    else if (this.state.isAdmin !== false) this.toast(`${mensaje} El cambio quedó guardado, pero no se pudo refrescar la pantalla. Recarga el panel.`, "err");
  }

  setDirty(nombre, value) {
    value ? this.dirtyForms.add(nombre) : this.dirtyForms.delete(nombre);
  }

  get dirty() {
    return this.dirtyForms.size > 0;
  }

  puedeSalir() {
    if (!this.dirty) return true;
    if (!confirm("Hay cambios sin guardar en rutas u hotel. ¿Salir y descartarlos?")) return false;
    this.descartarBorradores();
    return true;
  }

  descartarBorradores() {
    this.dirtyForms.clear();
    this.state.formularios = formulariosNuevos(this.state.fecha);
  }

  setField(target) {
    const [formulario, campo] = target.dataset.rField.split(".");
    if (formulario === "cupos") {
      this.state.formularios.cupos = target.value;
      this.setDirty("cupos", true);
      return;
    }
    const formularioActual = this.state.formularios[formulario];
    if (!formularioActual) return;
    formularioActual[campo] = target.type === "checkbox" ? target.checked : target.value;
    this.setDirty(formulario, true);
  }

  onInput(event) {
    const target = event.target;
    if (target.matches("[data-r-field]")) this.setField(target);
  }

  onChange(event) {
    const target = event.target;
    if (target.matches("[data-r-field]")) this.setField(target);
    if (target.matches("[data-r-day]")) {
      const day = Number(target.dataset.rDay);
      const selected = new Set(this.state.formularios.plan.dias_semana);
      target.checked ? selected.add(day) : selected.delete(day);
      this.state.formularios.plan.dias_semana = DIAS_COLEGIO.map(([value]) => value).filter((value) => selected.has(value));
      this.setDirty("plan", true);
    }
    if (target.matches("[data-r-date='fecha']")) {
      if (!target.value) { target.value = this.state.fecha; return; }
      this.state.fecha = target.value;
      if (target.value) this.state.mes = target.value.slice(0, 7);
      this.cargar();
    }
    if (target.matches("[data-r-date='mes']")) {
      if (!/^\d{4}-\d{2}$/.test(target.value)) { target.value = this.state.mes; return; }
      this.state.mes = target.value;
      if (target.value && !this.state.fecha.startsWith(target.value)) this.state.fecha = `${target.value}-01`;
      this.cargar();
    }
    if (target.matches("[data-action='r-estado-reserva']")) this.cambiarEstadoReserva(target.dataset.id, target.value);
  }

  onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    switch (button.dataset.action) {
      case "r-recargar": this.cargar(); break;
      case "r-vista": this.state.vista = button.dataset.view; this.render(); break;
      case "r-seleccionar-dia":
        this.state.fecha = button.dataset.fecha;
        this.state.mes = button.dataset.fecha.slice(0, 7);
        this.state.vista = "hotel";
        this.cargar();
        break;
      case "r-guardar-ruta": this.guardarRuta(); break;
      case "r-editar-ruta": this.editarRuta(id); break;
      case "r-toggle-ruta": this.alternarRuta(id); break;
      case "r-cancelar-ruta": this.state.formularios.ruta = { id: null, nombre: "", empleado_id: "" }; this.setDirty("ruta", false); this.render(); break;
      case "r-guardar-parada": this.guardarParada(); break;
      case "r-editar-parada": this.editarParada(id); break;
      case "r-toggle-parada": this.alternarParada(id); break;
      case "r-cancelar-parada": this.cancelarEdicionParada(); break;
      case "r-mover-parada": this.moverParada(button); break;
      case "r-mover-grupo": this.moverGrupo(button); break;
      case "r-guardar-plan": this.guardarPlan(); break;
      case "r-toggle-plan": this.alternarPlan(id); break;
      case "r-marcar-parada": this.marcarParada(id, button.dataset.estado); break;
      case "r-registrar-ausencia": this.registrarAusencia(button.dataset.mascotaId); break;
      case "r-quitar-ausencia": this.quitarAusencia(id); break;
      case "r-guardar-reserva": this.guardarReserva(); break;
      case "r-editar-reserva": this.editarReserva(id); break;
      case "r-cancelar-reserva": this.cancelarEdicionReserva(); break;
      case "r-estado-reserva": this.cambiarEstadoReserva(id, button.dataset.estado); break;
      case "r-guardar-cupos": this.guardarCupos(); break;
      default: break;
    }
  }

  async guardarRuta() {
    const f = this.state.formularios.ruta;
    const { errors, clean } = validarRuta(f);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    try {
      const row = f.id ? await RutasApi.actualizarRuta(f.id, clean) : await RutasApi.crearRuta(clean);
      if (!row) { this.toast("No se pudo guardar la ruta.", "err"); return; }
      this.state.formularios.ruta = { id: null, nombre: "", empleado_id: "" };
      this.setDirty("ruta", false);
      await this.recargarTrasCambio("Ruta guardada.");
    } catch (error) { this.fallo(error, "No se pudo guardar la ruta."); }
  }

  editarRuta(id) {
    const route = this.state.rutas.find((r) => r.id === id);
    if (!route) return;
    this.state.formularios.ruta = { id, nombre: route.nombre, empleado_id: route.empleado_id ?? "" };
    this.setDirty("ruta", false);
    this.state.vista = "rutas";
    this.render();
  }

  async alternarRuta(id) {
    const route = this.state.rutas.find((r) => r.id === id);
    if (!route) return;
    if (route.activa && !confirm(`¿Desactivar la ruta ${route.nombre}? Se conserva el historial de sus paradas.`)) return;
    try {
      await RutasApi.activarRuta(id, !route.activa);
      await this.recargarTrasCambio(route.activa ? "Ruta desactivada." : "Ruta reactivada.");
    } catch (error) { this.fallo(error, "No se pudo cambiar el estado de la ruta."); }
  }

  async guardarParada() {
    const s = this.state;
    const f = s.formularios.parada;
    const { errors, clean } = validarParada(f);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    try {
      if (f.id) {
        const row = await RutasApi.actualizarParada(f.id, clean);
        if (!row) { this.toast("No se pudo actualizar la parada.", "err"); return; }
      } else {
        const orden = Math.max(0, ...s.paradas.filter((p) => p.ruta_id === clean.ruta_id && p.sentido === clean.sentido).map((p) => p.orden)) + 1;
        const row = await RutasApi.crearParada({ ...clean, orden });
        if (!row) { this.toast("No se pudo agregar la parada.", "err"); return; }
      }
      this.state.formularios.parada = { id: null, ruta_id: clean.ruta_id, mascota_id: clean.mascota_id, sentido: clean.sentido, localidad: "", direccion: "", hora_estimada: "" };
      this.setDirty("parada", false);
      await this.recargarTrasCambio("Parada guardada.");
    } catch (error) { this.fallo(error, "No se pudo guardar la parada. Comprueba que el perro no esté duplicado en esa ruta y sentido."); }
  }

  editarParada(id) {
    const stop = this.state.paradas.find((p) => p.id === id);
    if (!stop) return;
    this.state.formularios.parada = {
      id, ruta_id: stop.ruta_id, mascota_id: stop.mascota_id, sentido: stop.sentido,
      localidad: stop.localidad ?? "", direccion: stop.direccion, hora_estimada: stop.hora_estimada?.slice(0, 5) ?? ""
    };
    this.state.vista = "rutas";
    this.setDirty("parada", false);
    this.render();
  }

  cancelarEdicionParada() {
    this.state.formularios.parada = { id: null, ruta_id: this.state.rutas.find((r) => r.activa)?.id ?? "", mascota_id: this.state.mascotas.find((m) => m.activa)?.id ?? "", sentido: "recogida", localidad: "", direccion: "", hora_estimada: "" };
    this.setDirty("parada", false);
    this.render();
  }

  async alternarParada(id) {
    const stop = this.state.paradas.find((p) => p.id === id);
    if (!stop) return;
    if (stop.activa && !confirm("¿Desactivar esta parada? La ruta guardada y los días anteriores se conservan.")) return;
    try {
      await RutasApi.activarParada(id, !stop.activa);
      await this.recargarTrasCambio(stop.activa ? "Parada desactivada." : "Parada reactivada.");
    } catch (error) { this.fallo(error, "No se pudo cambiar el estado de la parada."); }
  }

  paradasDeSentido(rutaId, sentido) {
    const groups = new Map();
    this.state.paradas.filter((p) => p.ruta_id === rutaId && p.sentido === sentido)
      .sort((a, b) => a.orden - b.orden)
      .forEach((stop) => {
        const localidad = stop.localidad || "Localidad sin registrar";
        if (!groups.has(localidad)) groups.set(localidad, []);
        groups.get(localidad).push(stop);
      });
    return [...groups.entries()];
  }

  async persistirOrden(rutaId, sentido, groups) {
    const ids = groups.flatMap(([, stops]) => stops.map((stop) => stop.id));
    await RutasApi.reordenarParadas(rutaId, sentido, ids);
    await this.recargarTrasCambio("Orden actualizado.");
  }

  async moverParada(button) {
    const groups = this.paradasDeSentido(button.dataset.routeId, button.dataset.sentido);
    const group = groups.find(([, stops]) => stops.some((stop) => stop.id === button.dataset.id));
    if (!group) return;
    const next = moverItem(group[1], Number(button.dataset.indice), Number(button.dataset.delta));
    groups[groups.indexOf(group)] = [group[0], next];
    try { await this.persistirOrden(button.dataset.routeId, button.dataset.sentido, groups); }
    catch (error) { this.fallo(error, "No se pudo cambiar el orden de las paradas."); }
  }

  async moverGrupo(button) {
    const groups = this.paradasDeSentido(button.dataset.routeId, button.dataset.sentido);
    const moved = moverItem(groups, Number(button.dataset.indice), Number(button.dataset.delta));
    try { await this.persistirOrden(button.dataset.routeId, button.dataset.sentido, moved); }
    catch (error) { this.fallo(error, "No se pudo cambiar el orden de las localidades."); }
  }

  async guardarPlan() {
    const { errors, clean } = validarPlan(this.state.formularios.plan);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    try {
      const row = await RutasApi.crearPlan(clean);
      if (!row) { this.toast("No se pudo guardar el plan de colegio.", "err"); return; }
      this.state.formularios.plan = { mascota_id: clean.mascota_id, dias_semana: [], desde: this.state.fecha, hasta: "" };
      this.setDirty("plan", false);
      await this.recargarTrasCambio("Plan de colegio guardado.");
    } catch (error) { this.fallo(error, "No se pudo guardar el plan de colegio."); }
  }

  async alternarPlan(id) {
    const plan = this.state.planes.find((p) => p.id === id);
    if (!plan) return;
    try {
      await RutasApi.activarPlan(id, !plan.activo);
      await this.recargarTrasCambio(plan.activo ? "Plan desactivado." : "Plan reactivado.");
    } catch (error) { this.fallo(error, "No se pudo cambiar el estado del plan."); }
  }

  async recargarDia() {
    const data = await RutasApi.cargarDia(this.state.fecha);
    this.state.ausencias = data.ausencias;
    this.state.paradasDia = data.paradasDia;
    const porId = new Map(this.state.reservas.map((r) => [r.id, r]));
    for (const reserva of data.reservas) porId.set(reserva.id, reserva);
    this.state.reservas = [...porId.values()];
    this.render();
  }

  async marcarParada(id, estado) {
    if (!id) { this.toast("No se encontró el registro del día; recarga la pantalla.", "err"); return; }
    const motivo = estado === "no_se_pudo" ? prompt("¿Por qué no se pudo? (opcional)") : null;
    if (estado === "no_se_pudo" && motivo === null) return;
    try {
      const row = await RutasApi.actualizarEstadoParada(id, estado, motivo?.trim() || null);
      if (!row) { this.toast("No se pudo guardar el estado de la parada.", "err"); return; }
      await this.recargarDia();
      this.toast("Estado de la parada actualizado.", "ok");
    } catch (error) { this.fallo(error, "No se pudo actualizar la parada."); }
  }

  async registrarAusencia(mascotaId) {
    const motivo = prompt("Motivo de la ausencia (opcional). Déjalo en blanco si no hace falta.");
    if (motivo === null) return;
    try {
      const row = await RutasApi.crearAusencia(mascotaId, this.state.fecha, motivo.trim() || null);
      if (!row) { this.toast("No se pudo registrar la ausencia.", "err"); return; }
      await this.recargarDia();
      this.toast("Ausencia registrada; el perro sale de la ruta de hoy.", "ok");
    } catch (error) { this.fallo(error, "No se pudo registrar la ausencia. Puede que ya esté anotada."); }
  }

  async quitarAusencia(id) {
    if (!confirm("¿Quitar la ausencia? El perro volverá a aparecer en la ruta si tiene plan de colegio.")) return;
    try {
      await RutasApi.quitarAusencia(id);
      await this.recargarDia();
      this.toast("Ausencia quitada.", "ok");
    } catch (error) { this.fallo(error, "No se pudo quitar la ausencia."); }
  }

  async validarCapacidadRemota(datos, idActual = null) {
    const s = this.state;
    if (!Number.isInteger(s.cuposHotel) || s.cuposHotel < 1) {
      this.toast("Configura primero los cupos del hotel.", "err");
      return false;
    }
    const reservas = await RutasApi.reservasEntre(datos.entrada, datos.salida);
    const otras = reservas.filter((r) => r.id !== idActual && r.estado !== "cancelada");
    const perroDuplicado = otras.some((r) =>
      r.mascota_id === datos.mascota_id && r.entrada < datos.salida && r.salida > datos.entrada
    );
    if (perroDuplicado) {
      this.toast("Ese perro ya tiene una reserva que se cruza con esas fechas.", "err");
      return false;
    }
    for (let dia = datos.entrada; dia < datos.salida; dia = fechaMas(dia, 1)) {
      if (dia < hoyBogota()) continue;
      if (contarOcupacionDia(dia, otras) >= s.cuposHotel) {
        this.toast(`No hay cupo para la noche del ${diaText(dia)}.`, "err");
        return false;
      }
    }
    return true;
  }

  async guardarReserva() {
    const f = this.state.formularios.reserva;
    const { errors, clean } = validarReserva(f);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    try {
      if (!await this.validarCapacidadRemota(clean, f.id)) return;
      const row = f.id ? await RutasApi.actualizarReserva(f.id, clean) : await RutasApi.crearReserva(clean);
      if (!row) { this.toast("No se pudo guardar la reserva.", "err"); return; }
      this.state.formularios.reserva = { id: null, mascota_id: clean.mascota_id, entrada: this.state.fecha, salida: fechaMas(this.state.fecha, 1), estado: "reservada", tambien_colegio: false, notas_comida: "", notas_medicacion: "", notas: "" };
      this.setDirty("reserva", false);
      await this.recargarTrasCambio("Reserva guardada.");
    } catch (error) { this.fallo(error, "No se pudo guardar la reserva. Revisa la capacidad y las fechas."); }
  }

  editarReserva(id) {
    const r = this.state.reservas.find((row) => row.id === id);
    if (!r) return;
    this.state.formularios.reserva = {
      id, mascota_id: r.mascota_id, entrada: r.entrada, salida: r.salida, estado: r.estado,
      tambien_colegio: r.tambien_colegio, notas_comida: r.notas_comida ?? "",
      notas_medicacion: r.notas_medicacion ?? "", notas: r.notas ?? ""
    };
    this.state.vista = "hotel";
    this.setDirty("reserva", false);
    this.render();
  }

  cancelarEdicionReserva() {
    this.state.formularios.reserva = { id: null, mascota_id: this.state.mascotas.find((m) => m.activa)?.id ?? "", entrada: this.state.fecha, salida: fechaMas(this.state.fecha, 1), estado: "reservada", tambien_colegio: false, notas_comida: "", notas_medicacion: "", notas: "" };
    this.setDirty("reserva", false);
    this.render();
  }

  async cambiarEstadoReserva(id, estado) {
    const reserva = this.state.reservas.find((r) => r.id === id);
    if (!reserva) return;
    if (estado === "cancelada" && !confirm(`¿Cancelar la reserva de ${this.state.mascotas.find((m) => m.id === reserva.mascota_id)?.nombre ?? "este perro"}? El registro se conserva en el historial.`)) return;
    try {
      await RutasApi.actualizarEstadoReserva(id, estado);
      await this.recargarTrasCambio({
        en_curso: "Entrada del hotel registrada.",
        finalizada: "Salida del hotel registrada.",
        cancelada: "Reserva cancelada; el historial se conserva."
      }[estado] ?? "Estado de reserva actualizado.");
    } catch (error) { this.fallo(error, "No se pudo actualizar la reserva."); }
  }

  async guardarCupos() {
    const { errors, clean } = validarCupos(this.state.formularios.cupos);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    try {
      const row = await RutasApi.actualizarCupos(clean);
      if (!row) { this.toast("No se pudo guardar la capacidad.", "err"); return; }
      this.setDirty("cupos", false);
      await this.recargarTrasCambio(`Capacidad del hotel actualizada a ${clean} cupos.`);
    } catch (error) { this.fallo(error, "No se pudo guardar la capacidad del hotel."); }
  }
}

const diaText = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { dateStyle: "medium" });
};
