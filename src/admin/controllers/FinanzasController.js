/**
 * Controlador de gastos, cobros y cartera. Solo pide registros después de confirmar
 * el rol admin; RLS protege además las tablas y el bucket privado en Supabase.
 */
import { AuthError } from "../services/authService.js";
import { GestionApi } from "../services/gestionApi.js";
import { FinanzasApi } from "../services/finanzasApi.js";
import {
  exportarMesCSV, saldosPagos, validarAbono, validarCobro, validarGasto
} from "../models/finanzasModel.js";
import { hoyBogota } from "../models/rutasModel.js";
import { FinanzasViews } from "../views/finanzasViews.js";

const MAX_RECIBO_BYTES = 8 * 1024 * 1024;
const TIPOS_RECIBO = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const gastoVacio = (fecha) => ({ id: null, fecha, categoria: "", descripcion: "", valor: "" });
const cobroVacio = (fecha) => ({ dueno_id: "", mascota_id: "", servicio_codigo: "", fecha, concepto: "", valor_total: "" });
const abonoVacio = (fecha) => ({ pago_id: "", fecha, valor: "", metodo: "", notas: "" });
const mesValido = (valor) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(valor ?? ""));

export class FinanzasController {
  constructor({ panel, toast, expire, ocultarPestana }) {
    this.getPanel = panel;
    this.toast = toast;
    this.expire = expire;
    this.ocultarPestana = ocultarPestana;
    this.active = false;
    this.loaded = false;
    this.dirty = false;
    this.saving = false;
    const fecha = hoyBogota();
    this.state = {
      loading: false, error: null, isAdmin: null, vista: "resumen", mes: fecha.slice(0, 7),
      gastos: [], pagos: [], abonos: [], duenos: [], mascotas: [], servicios: [],
      reciboPendiente: null,
      forms: { gasto: gastoVacio(fecha), cobro: cobroVacio(fecha), abono: abonoVacio(fecha) }
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
    if (this.active) this.getPanel().innerHTML = FinanzasViews.render(this.state);
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
      Object.assign(s, await FinanzasApi.cargar());
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
    if (!confirm("Hay un registro financiero sin guardar. ¿Salir y descartar el borrador?")) return false;
    this.descartarBorradores();
    return true;
  }

  descartarBorradores() {
    const fecha = hoyBogota();
    this.state.forms = { gasto: gastoVacio(fecha), cobro: cobroVacio(fecha), abono: abonoVacio(fecha) };
    this.state.reciboPendiente = null;
    this.setDirty(false);
  }

  onInput(event) {
    const target = event.target;
    const form = target.dataset.finForm;
    const field = target.dataset.finField;
    if (form && field && this.state.forms[form] && field in this.state.forms[form]) {
      this.state.forms[form][field] = target.value;
      this.setDirty(true);
    }
  }

  onChange(event) {
    const target = event.target;
    if (target.matches("[data-fin-month]")) {
      if (mesValido(target.value)) {
        this.state.mes = target.value;
        this.render();
      }
      return;
    }
    if (target.matches("[data-fin-form][data-fin-field]")) {
      this.onInput(event);
      this.render();
      return;
    }
    if (target.matches("[data-fin-receipt]")) {
      const archivo = target.files?.[0] ?? null;
      if (!archivo) return;
      if (!TIPOS_RECIBO.has(archivo.type) || archivo.size > MAX_RECIBO_BYTES) {
        target.value = "";
        this.state.reciboPendiente = null;
        this.toast("El recibo debe ser JPG, PNG, WebP o PDF y pesar máximo 8 MB.", "err");
        return;
      }
      this.state.reciboPendiente = archivo;
      this.setDirty(true);
      this.render();
    }
  }

  onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    switch (button.dataset.action) {
      case "fin-vista":
        this.state.vista = button.dataset.view;
        this.render();
        break;
      case "fin-recargar": this.cargar(); break;
      case "fin-guardar-gasto": this.guardarGasto(); break;
      case "fin-editar-gasto": this.editarGasto(button.dataset.id); break;
      case "fin-cancelar-gasto": this.cancelarGasto(); break;
      case "fin-nuevo-gasto": this.cancelarGasto(); break;
      case "fin-guardar-cobro": this.guardarCobro(); break;
      case "fin-guardar-abono": this.guardarAbono(); break;
      case "fin-descargar-recibo": this.descargarRecibo(button.dataset.path); break;
      case "fin-exportar": this.exportarCSV(); break;
      default: break;
    }
  }

  async guardarGasto() {
    if (this.saving) return;
    const form = this.state.forms.gasto;
    const { errors, clean } = validarGasto(form);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    this.saving = true;
    try {
      const row = form.id
        ? await FinanzasApi.actualizarGasto(form.id, clean)
        : await FinanzasApi.crearGasto(clean);
      if (!row) { this.toast("No se pudo guardar el gasto.", "err"); return; }
      if (this.state.reciboPendiente) {
        try {
          const path = await FinanzasApi.subirRecibo(row.id, this.state.reciboPendiente);
          const actualizado = await FinanzasApi.actualizarGasto(row.id, { recibo_path: path });
          if (!actualizado) throw new Error("receipt-link");
        } catch (error) {
          if (this.sesionVencida(error)) return;
          this.state.forms.gasto = { ...clean, id: row.id, categoria: clean.categoria, valor: String(clean.valor) };
          this.setDirty(true);
          await this.recargarFinanzas();
          this.toast("El gasto se guardó, pero no quedó asociado el recibo. Puedes intentarlo de nuevo desde Editar.", "err");
          return;
        }
      }
      this.state.forms.gasto = gastoVacio(hoyBogota());
      this.state.reciboPendiente = null;
      this.setDirty(false);
      if (await this.recargarFinanzas()) this.toast("Gasto guardado.", "ok");
    } catch (error) {
      if (this.sesionVencida(error)) return;
      this.toast(error?.code === "perm" ? "No tienes permiso para guardar gastos." : "No se pudo guardar el gasto.", "err");
    } finally {
      this.saving = false;
    }
  }

  editarGasto(id) {
    const gasto = this.state.gastos.find((item) => item.id === id);
    if (!gasto) return;
    if (!this.puedeSalir()) return;
    this.state.forms.gasto = {
      id: gasto.id, fecha: gasto.fecha, categoria: gasto.categoria,
      descripcion: gasto.descripcion ?? "", valor: String(gasto.valor)
    };
    this.state.reciboPendiente = null;
    this.state.vista = "gastos";
    this.setDirty(false);
    this.render();
  }

  cancelarGasto() {
    if (!this.puedeSalir()) return;
    this.state.forms.gasto = gastoVacio(hoyBogota());
    this.state.reciboPendiente = null;
    this.setDirty(false);
    this.render();
  }

  async guardarCobro() {
    if (this.saving) return;
    const { errors, clean } = validarCobro(this.state.forms.cobro, this.state);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    this.saving = true;
    try {
      const row = await FinanzasApi.crearCobro(clean);
      if (!row) { this.toast("No se pudo registrar el cobro.", "err"); return; }
      this.state.forms.cobro = cobroVacio(hoyBogota());
      this.setDirty(false);
      if (await this.recargarFinanzas()) this.toast("Cobro registrado.", "ok");
    } catch (error) {
      if (this.sesionVencida(error)) return;
      this.toast(error?.code === "perm" ? "No tienes permiso para registrar cobros." : "No se pudo registrar el cobro.", "err");
    } finally {
      this.saving = false;
    }
  }

  async guardarAbono() {
    if (this.saving) return;
    const pago = this.state.pagos.find((item) => item.id === this.state.forms.abono.pago_id);
    const saldo = saldosPagos(this.state.pagos, this.state.abonos).get(pago?.id)?.saldo ?? 0;
    const { errors, clean } = validarAbono(this.state.forms.abono, saldo);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    this.saving = true;
    try {
      const row = await FinanzasApi.crearAbono(clean);
      if (!row) { this.toast("No se pudo guardar el abono.", "err"); return; }
      this.state.forms.abono = abonoVacio(hoyBogota());
      this.setDirty(false);
      if (await this.recargarFinanzas()) this.toast("Abono registrado.", "ok");
    } catch (error) {
      if (this.sesionVencida(error)) return;
      this.toast(error?.code === "conflict"
        ? "Ese cobro ya cambió y el abono supera su saldo actual; actualicé los datos."
        : error?.code === "perm" ? "No tienes permiso para registrar abonos." : "No se pudo registrar el abono.", "err");
      if (error?.code === "conflict") await this.recargarFinanzas();
    } finally {
      this.saving = false;
    }
  }

  async recargarFinanzas() {
    try {
      Object.assign(this.state, await FinanzasApi.cargar());
      this.render();
    } catch (error) {
      if (this.sesionVencida(error)) return false;
      this.toast("El cambio se guardó, pero no pude actualizar los datos. Recarga la pestaña.", "err");
      return false;
    }
    return true;
  }

  async descargarRecibo(path) {
    try {
      const blob = await FinanzasApi.descargarRecibo(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = blob.type === "application/pdf" ? "pdf"
        : blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      link.download = `recibo-gasto.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (this.sesionVencida(error)) return;
      this.toast(error?.code === "perm" ? "No tienes permiso para ver este recibo." : "No se pudo descargar el recibo.", "err");
    }
  }

  exportarCSV() {
    const s = this.state;
    const csv = exportarMesCSV(s.mes, s.gastos, s.pagos, s.abonos, s.duenos, s.mascotas, s.servicios);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `animal-friends-finanzas-${s.mes}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
