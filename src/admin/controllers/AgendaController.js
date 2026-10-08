/**
 * Controlador de agenda y planeación. Las citas se guardan al momento; los
 * choques se advierten, pero el admin decide si continúa.
 */
import { AuthError } from "../services/authService.js";
import { GestionApi } from "../services/gestionApi.js";
import { AgendaApi } from "../services/agendaApi.js";
import {
  conflictosCita, fechaBogotaDeISO, fechaHoraBogotaDeISO, rangoAgenda, validarCita
} from "../models/agendaModel.js";
import { hoyBogota } from "../models/rutasModel.js";
import { AgendaViews } from "../views/agendaViews.js";

const fechaMas = (fecha, dias) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};

const moverMes = (fecha, delta) => {
  const [year, month, day] = fecha.split("-").map(Number);
  const objetivo = new Date(Date.UTC(year, month - 1 + delta, 1));
  const ultimoDia = new Date(Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)).getUTCDate();
  objetivo.setUTCDate(Math.min(day, ultimoDia));
  return objetivo.toISOString().slice(0, 10);
};

const nuevaCita = () => ({
  id: null, mascota_id: "", empleado_id: "", servicio_codigo: "",
  inicio: "", fin: "", estado: "pendiente", notas: ""
});

export class AgendaController {
  constructor({ panel, toast, expire }) {
    this.getPanel = panel;
    this.toast = toast;
    this.expire = expire;
    this.active = false;
    this.loaded = false;
    this.dirty = false;
    const fecha = hoyBogota();
    this.state = {
      loading: false, error: null, isAdmin: null, vista: "dia", fecha,
      citas: [], reservas: [], mascotas: [], duenos: [], empleados: [],
      rutas: [], paradas: [], planes: [], ausencias: [], servicios: [],
      formularios: { cita: nuevaCita() }
    };
  }

  bind(panel) {
    panel.addEventListener("input", (event) => this.active && this.onInput(event));
    panel.addEventListener("change", (event) => this.active && this.onChange(event));
    panel.addEventListener("click", (event) => this.active && this.onClick(event));
  }

  setActive(active) {
    this.active = active;
    if (!active) return;
    if (!this.loaded) this.cargar();
    else this.render();
  }

  render() {
    if (this.active) this.getPanel().innerHTML = AgendaViews.render(this.state);
  }

  sesionVencida(error) {
    if (error?.code === "expired" || error instanceof AuthError) {
      this.expire();
      return true;
    }
    return false;
  }

  async cargar() {
    const s = this.state;
    s.loading = true;
    s.error = null;
    this.render();
    try {
      s.isAdmin = await GestionApi.esAdmin();
      if (!s.isAdmin) return false;
      const rango = rangoAgenda(s.fecha, s.vista);
      if (!rango) throw new Error("El rango de la agenda no es válido.");
      Object.assign(s, await AgendaApi.cargar({ fecha: s.fecha, rango }));
      this.loaded = true;
      return true;
    } catch (error) {
      if (this.sesionVencida(error)) return false;
      s.error = error?.code === "perm" ? "perm" : error?.code === "missing" ? "missing" : "fail";
      return false;
    } finally {
      s.loading = false;
      this.render();
    }
  }

  setDirty(dirty) {
    this.dirty = dirty;
  }

  puedeSalir() {
    if (!this.dirty) return true;
    if (!confirm("Hay una cita sin guardar. ¿Salir y descartar el borrador?")) return false;
    this.descartarBorrador();
    return true;
  }

  descartarBorrador() {
    this.dirty = false;
    this.state.formularios.cita = nuevaCita();
  }

  setField(target) {
    const field = target.dataset.agendaField;
    if (!field || !(field in this.state.formularios.cita)) return;
    this.state.formularios.cita[field] = target.value;
    this.setDirty(true);
  }

  actualizarFormulario(target) {
    this.setField(target);
    this.render();
  }

  onInput(event) {
    if (event.target.matches("[data-agenda-field]")) this.setField(event.target);
  }

  onChange(event) {
    const target = event.target;
    if (target.matches("[data-agenda-field]")) this.actualizarFormulario(target);
    if (target.matches("[data-agenda-date]")) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(target.value)) { target.value = this.state.fecha; return; }
      this.state.fecha = target.value;
      this.cargar();
      return;
    }
    if (target.matches("[data-agenda-status]")) this.cambiarEstado(target.dataset.id, target.value);
  }

  onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    switch (button.dataset.action) {
      case "agenda-recargar": this.cargar(); break;
      case "agenda-vista":
        this.state.vista = button.dataset.view;
        this.cargar();
        break;
      case "agenda-mover": {
        const delta = Number(button.dataset.delta);
        this.state.fecha = this.state.vista === "dia"
          ? fechaMas(this.state.fecha, delta)
          : this.state.vista === "semana"
            ? fechaMas(this.state.fecha, delta * 7)
            : moverMes(this.state.fecha, delta);
        this.cargar();
        break;
      }
      case "agenda-hoy":
        this.state.fecha = hoyBogota();
        this.cargar();
        break;
      case "agenda-seleccionar-dia":
        this.state.fecha = button.dataset.fecha;
        this.state.vista = "dia";
        this.cargar();
        break;
      case "agenda-editar-cita": this.editarCita(button.dataset.id); break;
      case "agenda-cancelar-edicion": this.cancelarEdicion(); break;
      case "agenda-guardar-cita": this.guardarCita(); break;
      default: break;
    }
  }

  editarCita(id) {
    const cita = this.state.citas.find((row) => row.id === id);
    if (!cita) return;
    this.state.formularios.cita = {
      id, mascota_id: cita.mascota_id, empleado_id: cita.empleado_id ?? "",
      servicio_codigo: cita.servicio_codigo, inicio: fechaHoraBogotaDeISO(cita.inicio),
      fin: fechaHoraBogotaDeISO(cita.fin), estado: cita.estado, notas: cita.notas ?? ""
    };
    this.setDirty(false);
    this.state.vista = "dia";
    const fechaAnterior = this.state.fecha;
    this.state.fecha = fechaBogotaDeISO(cita.inicio) || hoyBogota();
    this.render();
    if (this.state.fecha !== fechaAnterior) this.cargar();
  }

  cancelarEdicion() {
    this.state.formularios.cita = nuevaCita();
    this.setDirty(false);
    this.render();
  }

  async guardarCita() {
    const formulario = this.state.formularios.cita;
    const { errors, clean } = validarCita(formulario);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    let conflictos;
    try {
      const citasSolapadas = await AgendaApi.citasSolapadas(clean.inicio, clean.fin);
      conflictos = conflictosCita({ ...clean, id: formulario.id }, citasSolapadas);
    } catch (error) {
      if (this.sesionVencida(error)) return;
      this.toast(error?.code === "perm" ? "No tienes permiso para revisar los choques de horario." : "No se pudo comprobar si hay choques. No guardé la cita.", "err");
      return;
    }
    if (conflictos.length) {
      const empleado = conflictos.some((item) => item.tipos.includes("empleado"));
      const mascota = conflictos.some((item) => item.tipos.includes("mascota"));
      const causa = [empleado && "el empleado", mascota && "el perro"].filter(Boolean).join(" y ");
      if (!confirm(`Hay otra cita de ${causa} en ese horario. ¿Guardar de todos modos?`)) return;
    }
    try {
      const row = formulario.id
        ? await AgendaApi.actualizarCita(formulario.id, clean)
        : await AgendaApi.crearCita(clean);
      if (!row) { this.toast("No se pudo guardar la cita.", "err"); return; }
      this.state.formularios.cita = nuevaCita();
      this.setDirty(false);
      await this.cargar();
      this.toast("Cita guardada.", "ok");
    } catch (error) {
      if (this.sesionVencida(error)) return;
      this.toast(error?.code === "perm" ? "No tienes permiso para guardar esta cita." : "No se pudo guardar la cita.", "err");
    }
  }

  async cambiarEstado(id, estado) {
    try {
      const row = await AgendaApi.actualizarEstado(id, estado);
      if (!row) { this.toast("No se pudo actualizar el estado de la cita.", "err"); return; }
      await this.cargar();
      this.toast("Estado de la cita actualizado.", "ok");
    } catch (error) {
      if (this.sesionVencida(error)) return;
      this.toast(error?.code === "perm" ? "No tienes permiso para actualizar esta cita." : "No se pudo actualizar el estado de la cita.", "err");
    }
  }
}
