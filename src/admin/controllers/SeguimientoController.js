/**
 * Coordina alertas, asistencia diaria e historial del admin.
 * Las marcas se guardan enseguida; los borradores se limitan a la ficha SOAT.
 */
import { AuthError } from "../services/authService.js";
import { GestionApi } from "../services/gestionApi.js";
import { SeguimientoApi } from "../services/seguimientoApi.js";
import {
  DIAS_ALERTA_VENCIMIENTO, TAMANO_PAGINA_HISTORIAL,
  generarAlertas, listaAsistencia, validarSoat
} from "../models/seguimientoModel.js";
import { hoyBogota } from "../models/rutasModel.js";
import { esFechaISO } from "../models/gestionModel.js";
import { SeguimientoViews } from "../views/seguimientoViews.js";

const soatVacio = () => ({ id: null, vehiculo: "", fecha_vencimiento: "", notas: "" });
const fechaLimite = (fecha, dias) => {
  const date = new Date(`${fecha}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
};

export class SeguimientoController {
  constructor({ panel, toast, expire, ocultarPestana }) {
    this.getPanel = panel;
    this.toast = toast;
    this.expire = expire;
    this.ocultarPestana = ocultarPestana;
    this.active = false;
    this.loaded = false;
    this.dirty = false;
    this.busy = false;
    this.state = {
      loading: false, error: null, errorHistorial: false, isAdmin: null,
      vista: "alertas", fecha: hoyBogota(), mascotas: [], planes: [], reservas: [],
      ausencias: [], registros: [], vacunas: [], soat: [], empleados: [],
      historial: [], historialMas: false, historialCargando: false,
      formSoat: soatVacio()
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
    if (this.active) this.getPanel().innerHTML = SeguimientoViews.render(this.state);
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
      if (!s.isAdmin) {
        this.ocultarPestana?.();
        return false;
      }
      const datos = await SeguimientoApi.cargar(s.fecha, fechaLimite(s.fecha, DIAS_ALERTA_VENCIMIENTO));
      Object.assign(s, datos);
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

  setDirty(value) {
    this.dirty = value;
  }

  puedeSalir() {
    if (!this.dirty) return true;
    if (!confirm("Hay un registro de SOAT sin guardar. ¿Salir y descartar el borrador?")) return false;
    this.descartarBorrador();
    return true;
  }

  descartarBorrador() {
    this.state.formSoat = soatVacio();
    this.setDirty(false);
  }

  onInput(event) {
    const target = event.target;
    const field = target.dataset.segField;
    if (field && field in this.state.formSoat) {
      this.state.formSoat[field] = target.value;
      this.setDirty(true);
    }
  }

  onChange(event) {
    const target = event.target;
    if (!target.matches("[data-seg-fecha]")) return;
    if (!this.puedeSalir()) {
      this.render();
      return;
    }
    if (!esFechaISO(target.value)) return;
    this.state.fecha = target.value;
    this.cargar();
  }

  onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    switch (button.dataset.action) {
      case "seg-vista":
        if (!this.puedeSalir()) return;
        this.state.vista = button.dataset.view;
        this.render();
        if (this.state.vista === "historial" && !this.state.historial.length) this.cargarHistorial();
        break;
      case "seg-recargar": this.cargar(); break;
      case "seg-guardar-soat": this.guardarSoat(); break;
      case "seg-editar-soat": this.editarSoat(button.dataset.id); break;
      case "seg-cancelar-soat": this.cancelarSoat(); break;
      case "seg-marcar-llegada": this.marcarLlegada(button.dataset.mascota); break;
      case "seg-marcar-salida": this.marcarSalida(button.dataset.id); break;
      case "seg-marcar-falta": this.marcarFalta(button.dataset.mascota); break;
      case "seg-quitar-falta": this.quitarFalta(button.dataset.id); break;
      case "seg-historial-mas": this.cargarHistorial(); break;
      default: break;
    }
  }

  async guardarSoat() {
    if (this.busy) return;
    const form = this.state.formSoat;
    const { errors, clean } = validarSoat(form, this.state.soat);
    if (errors.length) {
      this.toast("Revisa estos puntos:", "err", errors);
      return;
    }
    this.busy = true;
    try {
      const row = form.id
        ? await SeguimientoApi.actualizarSoat(form.id, clean)
        : await SeguimientoApi.crearSoat(clean);
      if (!row) {
        this.toast("No se pudo guardar el SOAT.", "err");
        return;
      }
      this.descartarBorrador();
      if (await this.cargar()) this.toast("SOAT guardado.", "ok");
      else this.toast("El SOAT se guardó, pero no pude recargar la lista. Usa Actualizar para comprobarlo.", "err");
    } catch (error) {
      if (this.sesionVencida(error)) return;
      const mensaje = error?.code === "conflict"
        ? "Ya existe un vehículo con ese nombre o placa."
        : error?.code === "perm" ? "No tienes permiso para guardar el SOAT."
          : "No se pudo guardar el SOAT. Revisa si la migración de Fase 7 está aplicada.";
      this.toast(mensaje, "err");
    } finally {
      this.busy = false;
    }
  }

  editarSoat(id) {
    if (!this.puedeSalir()) return;
    const fila = this.state.soat.find((item) => item.id === id);
    if (!fila) return;
    this.state.formSoat = {
      id: fila.id, vehiculo: fila.vehiculo,
      fecha_vencimiento: fila.fecha_vencimiento, notas: fila.notas ?? ""
    };
    this.setDirty(false);
    this.render();
  }

  cancelarSoat() {
    if (!this.puedeSalir()) return;
    this.descartarBorrador();
    this.render();
  }

  async cambiarAsistencia(accion, exito) {
    if (this.busy) return;
    this.busy = true;
    try {
      await accion();
      if (await this.cargar()) this.toast(exito, "ok");
      else this.toast("El cambio se guardó, pero no pude recargar la lista. Usa Actualizar para comprobarlo.", "err");
    } catch (error) {
      if (this.sesionVencida(error)) return;
      this.toast(error?.code === "perm"
        ? "No tienes permiso para cambiar la asistencia."
        : "No se pudo guardar el cambio de asistencia. Inténtalo de nuevo.", "err");
    } finally {
      this.busy = false;
    }
  }

  async marcarLlegada(mascotaId) {
    const fila = listaAsistencia(this.state).find((item) => item.mascota.id === mascotaId);
    if (!fila || fila.estado !== "pendiente") return;
    await this.cambiarAsistencia(() => SeguimientoApi.marcarLlegada(mascotaId, this.state.fecha), "Llegada registrada.");
  }

  async marcarSalida(id) {
    const fila = listaAsistencia(this.state).find((item) => item.registro?.id === id);
    if (!fila || fila.estado !== "presente") return;
    await this.cambiarAsistencia(() => SeguimientoApi.marcarSalida(id), "Salida registrada.");
  }

  async marcarFalta(mascotaId) {
    const fila = listaAsistencia(this.state).find((item) => item.mascota.id === mascotaId);
    if (!fila || fila.estado !== "pendiente") return;
    const motivo = prompt(`Motivo de la falta de ${fila.mascota.nombre} (opcional):`);
    if (motivo === null) return;
    if (motivo.trim().length > 300) {
      this.toast("El motivo no puede superar 300 caracteres.", "err");
      return;
    }
    await this.cambiarAsistencia(
      () => SeguimientoApi.registrarFalta(mascotaId, this.state.fecha, motivo),
      "Falta registrada."
    );
  }

  async quitarFalta(id) {
    const fila = listaAsistencia(this.state).find((item) => item.falta?.id === id);
    if (!fila || !confirm(`¿Corregir la falta de ${fila.mascota.nombre}? El cambio quedará en el historial.`)) return;
    await this.cambiarAsistencia(() => SeguimientoApi.quitarFalta(id), "Falta corregida.");
  }

  async cargarHistorial() {
    const s = this.state;
    if (s.historialCargando || !s.historialMas && s.historial.length) return;
    s.historialCargando = true;
    s.errorHistorial = false;
    this.render();
    try {
      const offset = s.historial.length;
      const pagina = await SeguimientoApi.cargarHistorial(offset);
      s.historial.push(...pagina);
      s.historialMas = pagina.length === TAMANO_PAGINA_HISTORIAL;
    } catch (error) {
      if (this.sesionVencida(error)) return;
      s.errorHistorial = true;
    } finally {
      s.historialCargando = false;
      this.render();
    }
  }
}
