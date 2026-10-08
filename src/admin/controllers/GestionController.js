/**
 * CONTROLADOR de la gestión de dueños y mascotas (Fase 2).
 *
 * Diferencia importante con el resto del panel: "Negocio" y "Servicios" editan UN
 * borrador grande que se publica con un botón. Aquí cada ficha (dueño, perro, vacuna...)
 * es un registro propio que se guarda al momento con su propio botón "Guardar". Por eso
 * este controlador vive aparte y AdminController solo le delega la pestaña.
 *
 * El estado es un objeto simple (this.state) y las vistas (gestionViews.js) lo pintan
 * entero cada vez que algo cambia. Los campos de formulario escriben directo en
 * this.state, así que volver a pintar nunca pierde lo que la persona ya había escrito.
 * Solo se evita repintar mientras se escribe (buscador y carga de la foto) para no
 * quitarle el cursor al usuario.
 */
import { AuthError } from "../services/authService.js";
import { GestionApi } from "../services/gestionApi.js";
import { reducirImagen } from "../services/imagen.js";
import { GestionViews } from "../views/gestionViews.js";
import {
  blankDueno, blankMascota, blankVacuna, blankMedicamento, blankAutorizada,
  formDesdeFila, validarDueno, validarMascota, validarVacuna, validarMedicamento, validarAutorizada
} from "../models/gestionModel.js";

const nuevaMascotaVacia = () => ({ id: null, form: blankMascota(), activa: true, foto_path: null, vacunas: [], medicamentos: [] });
const subformsVacios = () => ({ autorizada: blankAutorizada(), vacuna: blankVacuna(), medicamento: blankMedicamento() });
const porFecha = (a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));

export class GestionController {
  /**
   * @param {{ panel: () => HTMLElement, toast: Function, expire: Function }} deps
   *   panel  devuelve el contenedor donde se pinta la pestaña
   *   toast  muestra un aviso (el mismo del resto del panel)
   *   expire cierra la sesión cuando venció
   */
  constructor({ panel, toast, expire }) {
    this.getPanel = panel;
    this.toast = toast;
    this.expire = expire;
    this.active = false;      // ¿está abierta esta pestaña?
    this.loaded = false;      // ¿ya se cargó la lista con éxito?
    this.dirty = false;       // ¿hay cambios sin guardar en la ficha abierta?
    this.state = {
      loading: false, error: null, isAdmin: null,
      duenos: [], q: "", verInactivos: false,
      vista: "lista",         // "lista" | "dueno" | "mascota"
      dueno: { id: null, form: blankDueno(), autorizadas: [] },
      mascota: nuevaMascotaVacia(),
      fotoUrl: null,
      sub: subformsVacios()
    };
  }

  /* ------------------------------ ciclo de vida ------------------------------ */
  /** Conecta los eventos una sola vez. Solo reaccionan cuando la pestaña está abierta. */
  bind(panel) {
    panel.addEventListener("input", (e) => this.active && this.onInput(e));
    panel.addEventListener("change", (e) => this.active && this.onChange(e));
    panel.addEventListener("click", (e) => this.active && this.onClick(e));
  }

  setActive(activa) {
    this.active = activa;
    if (!activa) return;
    if (!this.loaded) this.cargar();
    else this.render();
  }

  render() {
    if (!this.active) return;
    this.getPanel().innerHTML = GestionViews.render(this.state);
  }

  /* ------------------------------ carga de datos ------------------------------ */
  async cargar() {
    const s = this.state;
    s.loading = true; s.error = null;
    this.render();
    try {
      s.isAdmin = await GestionApi.esAdmin();
      if (s.isAdmin) {
        s.duenos = await GestionApi.listDuenos();
        this.loaded = true;
      }
    } catch (error) {
      if (this.sesionVencida(error)) return;
      s.error = ["perm", "missing"].includes(error?.code) ? error.code : "fail";
    } finally {
      s.loading = false;
    }
    this.render();
  }

  /** Vuelve a pedir la lista sin pantalla de carga (después de guardar algo). */
  async refrescarLista() {
    try { this.state.duenos = await GestionApi.listDuenos(); } catch { /* si falla, queda la lista anterior */ }
  }

  /* ------------------------------ errores y utilidades ------------------------------ */
  sesionVencida(error) {
    if (error?.code === "expired" || error instanceof AuthError) { this.expire(); return true; }
    return false;
  }

  fallo(error, mensaje) {
    if (this.sesionVencida(error)) return;
    const textos = {
      perm: "Este usuario no tiene permiso para hacer eso.",
      conflict: "Ese dato choca con otro que ya existe.",
      missing: "Faltan las tablas del panel en Supabase (Fase 1)."
    };
    this.toast(textos[error?.code] ?? mensaje, "err");
  }

  /** Bloquea el botón mientras se guarda, para evitar dobles clics. */
  async conBoton(boton, textoOcupado, tarea) {
    const original = boton.textContent;
    boton.disabled = true;
    boton.textContent = textoOcupado;
    try { await tarea(); }
    finally { boton.disabled = false; boton.textContent = original; }
  }

  /** Si hay cambios sin guardar, pregunta antes de abandonar la ficha. */
  puedeSalir() {
    if (!this.dirty) return true;
    if (!confirm("Tienes cambios sin guardar en esta ficha. ¿Salir sin guardar?")) return false;
    this.dirty = false;
    return true;
  }

  formActual() {
    return this.state.vista === "mascota" ? this.state.mascota.form : this.state.dueno.form;
  }

  /* ------------------------------ navegación ------------------------------ */
  verLista() {
    if (!this.puedeSalir()) return;
    this.state.vista = "lista";
    this.render();
  }

  nuevoDueno() {
    if (!this.puedeSalir()) return;
    const s = this.state;
    s.dueno = { id: null, form: blankDueno(), autorizadas: [] };
    s.sub = subformsVacios();
    s.vista = "dueno";
    this.render();
  }

  async abrirDueno(id) {
    if (!this.puedeSalir()) return;
    const s = this.state;
    const fila = s.duenos.find((d) => d.id === id);
    if (!fila) return;
    s.dueno = { id, form: formDesdeFila(fila, blankDueno), autorizadas: [] };
    s.sub = subformsVacios();
    s.vista = "dueno";
    this.render();
    try {
      const autorizadas = await GestionApi.listAutorizadas(id);
      if (s.dueno.id === id && s.vista === "dueno") { s.dueno.autorizadas = autorizadas; this.render(); }
    } catch (error) { this.fallo(error, "No se pudieron cargar las personas autorizadas."); }
  }

  nuevaMascota() {
    if (!this.puedeSalir()) return;
    const s = this.state;
    s.mascota = nuevaMascotaVacia();
    s.fotoUrl = null;
    s.sub = subformsVacios();
    s.vista = "mascota";
    this.render();
  }

  async abrirMascota(id) {
    if (!this.puedeSalir()) return;
    const s = this.state;
    try {
      const fila = await GestionApi.getMascota(id);
      if (!fila) { this.toast("No se encontró ese perro.", "err"); return; }
      s.mascota = {
        id, form: formDesdeFila(fila, blankMascota), activa: fila.activa, foto_path: fila.foto_path,
        vacunas: fila.vacunas_mascota ?? [],
        medicamentos: [...(fila.medicamentos_mascota ?? [])].sort(porFecha)
      };
      s.fotoUrl = null;
      s.sub = subformsVacios();
      s.vista = "mascota";
      this.render();
      this.cargarFoto();
    } catch (error) { this.fallo(error, "No se pudo abrir la ficha del perro."); }
  }

  volverADueno() {
    if (!this.puedeSalir()) return;
    this.state.vista = "dueno";
    this.render();
  }

  /* ------------------------------ dueños ------------------------------ */
  async guardarDueno(boton) {
    const s = this.state;
    const { errors, clean } = validarDueno(s.dueno.form);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    await this.conBoton(boton, "Guardando…", async () => {
      try {
        const fila = s.dueno.id ? await GestionApi.updateDueno(s.dueno.id, clean) : await GestionApi.createDueno(clean);
        if (!fila) { this.toast("No se pudo guardar: sin permiso o el dueño ya no existe.", "err"); return; }
        s.dueno.id = fila.id;
        s.dueno.form = formDesdeFila(fila, blankDueno);
        this.dirty = false;
        await this.refrescarLista();
        this.toast("Dueño guardado.", "ok");
        this.render();
      } catch (error) { this.fallo(error, "No se pudo guardar al dueño. Revisa tu conexión e inténtalo de nuevo."); }
    });
  }

  async cambiarActivoDueno(boton, activo) {
    const s = this.state;
    const nombre = s.dueno.form.nombre || "este dueño";
    if (!activo && !confirm(`¿Desactivar a ${nombre}? Dejará de aparecer en la lista, pero su historial se conserva y puedes reactivarlo.`)) return;
    await this.conBoton(boton, "Un momento…", async () => {
      try {
        const fila = await GestionApi.setDuenoActivo(s.dueno.id, activo);
        if (!fila) { this.toast("No se pudo cambiar el estado: sin permiso o el dueño ya no existe.", "err"); return; }
        await this.refrescarLista();
        this.toast(activo ? "Dueño reactivado." : "Dueño desactivado.", "ok");
        this.render();
      } catch (error) { this.fallo(error, "No se pudo cambiar el estado del dueño."); }
    });
  }

  async agregarAutorizada(boton) {
    const s = this.state;
    const { errors, clean } = validarAutorizada(s.sub.autorizada);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    await this.conBoton(boton, "Agregando…", async () => {
      try {
        const fila = await GestionApi.addAutorizada(s.dueno.id, clean);
        if (!fila) { this.toast("No se pudo agregar a la persona.", "err"); return; }
        s.dueno.autorizadas.push(fila);
        s.sub.autorizada = blankAutorizada();
        this.render();
      } catch (error) { this.fallo(error, "No se pudo agregar a la persona autorizada."); }
    });
  }

  async quitarAutorizada(id) {
    const persona = this.state.dueno.autorizadas.find((a) => a.id === id);
    if (!persona || !confirm(`¿Quitar a ${persona.nombre} de las personas autorizadas?`)) return;
    try {
      await GestionApi.deleteAutorizada(id);
      this.state.dueno.autorizadas = this.state.dueno.autorizadas.filter((a) => a.id !== id);
      this.render();
    } catch (error) { this.fallo(error, "No se pudo quitar a la persona."); }
  }

  /* ------------------------------ mascotas ------------------------------ */
  async guardarMascota(boton) {
    const s = this.state;
    const { errors, clean } = validarMascota(s.mascota.form);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    await this.conBoton(boton, "Guardando…", async () => {
      try {
        const fila = s.mascota.id
          ? await GestionApi.updateMascota(s.mascota.id, clean)
          : await GestionApi.createMascota(s.dueno.id, clean);
        if (!fila) { this.toast("No se pudo guardar: sin permiso o el perro ya no existe.", "err"); return; }
        s.mascota.id = fila.id;
        s.mascota.activa = fila.activa;
        s.mascota.form = formDesdeFila(fila, blankMascota);
        this.dirty = false;
        await this.refrescarLista();
        this.toast("Perro guardado.", "ok");
        this.render();
      } catch (error) { this.fallo(error, "No se pudo guardar al perro. Revisa tu conexión e inténtalo de nuevo."); }
    });
  }

  async cambiarActivaMascota(boton, activa) {
    const s = this.state;
    if (!activa && !confirm(`¿Desactivar a ${s.mascota.form.nombre || "este perro"}? Su historial se conserva y puedes reactivarlo.`)) return;
    await this.conBoton(boton, "Un momento…", async () => {
      try {
        const fila = await GestionApi.setMascotaActiva(s.mascota.id, activa);
        if (!fila) { this.toast("No se pudo cambiar el estado del perro.", "err"); return; }
        s.mascota.activa = fila.activa;
        await this.refrescarLista();
        this.toast(activa ? "Perro reactivado." : "Perro desactivado.", "ok");
        this.render();
      } catch (error) { this.fallo(error, "No se pudo cambiar el estado del perro."); }
    });
  }

  /* ------------------------------ vacunas y medicamentos ------------------------------ */
  async agregarVacuna(boton) {
    const s = this.state;
    const { errors, clean } = validarVacuna(s.sub.vacuna);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    await this.conBoton(boton, "Agregando…", async () => {
      try {
        const fila = await GestionApi.addVacuna(s.mascota.id, clean);
        if (!fila) { this.toast("No se pudo agregar.", "err"); return; }
        s.mascota.vacunas.push(fila);
        s.sub.vacuna = blankVacuna();
        this.render();
      } catch (error) { this.fallo(error, "No se pudo agregar la vacuna."); }
    });
  }

  async quitarVacuna(id) {
    if (!confirm("¿Quitar este registro? Úsalo solo si lo anotaste por error.")) return;
    try {
      await GestionApi.deleteVacuna(id);
      this.state.mascota.vacunas = this.state.mascota.vacunas.filter((v) => v.id !== id);
      this.render();
    } catch (error) { this.fallo(error, "No se pudo quitar el registro."); }
  }

  async agregarMedicamento(boton) {
    const s = this.state;
    const { errors, clean } = validarMedicamento(s.sub.medicamento);
    if (errors.length) { this.toast("Revisa estos puntos:", "err", errors); return; }
    await this.conBoton(boton, "Agregando…", async () => {
      try {
        const fila = await GestionApi.addMedicamento(s.mascota.id, clean);
        if (!fila) { this.toast("No se pudo agregar.", "err"); return; }
        s.mascota.medicamentos.push(fila);
        s.sub.medicamento = blankMedicamento();
        this.render();
      } catch (error) { this.fallo(error, "No se pudo agregar el medicamento."); }
    });
  }

  async alternarMedicamento(id) {
    const med = this.state.mascota.medicamentos.find((x) => x.id === id);
    if (!med) return;
    try {
      const fila = await GestionApi.setMedicamentoActivo(id, !med.activo);
      if (fila) med.activo = fila.activo;
      this.render();
    } catch (error) { this.fallo(error, "No se pudo cambiar el medicamento."); }
  }

  async quitarMedicamento(id) {
    if (!confirm("¿Quitar este medicamento? Si solo terminó el tratamiento, mejor usa Suspender para conservar el registro.")) return;
    try {
      await GestionApi.deleteMedicamento(id);
      this.state.mascota.medicamentos = this.state.mascota.medicamentos.filter((x) => x.id !== id);
      this.render();
    } catch (error) { this.fallo(error, "No se pudo quitar el medicamento."); }
  }

  /* ------------------------------ foto ------------------------------ */
  /** Descarga y muestra la foto sin repintar toda la ficha (para no quitar el cursor). */
  async cargarFoto() {
    const s = this.state;
    const id = s.mascota.id;
    s.fotoUrl = null;
    if (s.mascota.foto_path) {
      try {
        const url = await GestionApi.bajarFoto(s.mascota.foto_path);
        if (s.mascota.id === id) s.fotoUrl = url;
      } catch (error) {
        if (this.sesionVencida(error)) return;      // si no carga la foto, se queda el dibujo por defecto
      }
    }
    const caja = document.getElementById("g-foto");
    if (caja && this.active && s.vista === "mascota" && s.mascota.id === id) caja.innerHTML = GestionViews.fotoHtml(s);
  }

  async subirFoto(archivo, input) {
    const s = this.state;
    const id = s.mascota.id;
    if (!id || !archivo) return;
    try {
      this.toast("Subiendo foto…");
      const blob = await reducirImagen(archivo);
      const ruta = await GestionApi.subirFoto(id, blob);
      const fila = await GestionApi.updateMascota(id, { foto_path: ruta });
      if (!fila) throw Object.assign(new Error("sin-fila"), { code: "perm" });
      s.mascota.foto_path = ruta;
      await this.cargarFoto();
      this.toast("Foto guardada.", "ok");
    } catch (error) {
      if (error?.message === "no-imagen") this.toast("Elige un archivo de imagen (JPG, PNG o WebP).", "err");
      else this.fallo(error, "No se pudo subir la foto. Prueba con otra imagen.");
    } finally {
      input.value = "";
    }
  }

  /* ------------------------------ eventos ------------------------------ */
  onInput(event) {
    const t = event.target;
    const s = this.state;

    if (t.matches("[data-g-search]")) {                       // buscador: solo repinta la lista, no el campo
      s.q = t.value;
      const caja = document.getElementById("g-lista");
      if (caja) caja.innerHTML = GestionViews.itemsLista(s.duenos, s.q, s.verInactivos);
      return;
    }
    if (t.dataset.g) {                                        // campo de la ficha abierta
      this.formActual()[t.dataset.g] = t.type === "checkbox" ? t.checked : t.value;
      this.dirty = true;
      return;
    }
    if (t.dataset.gs) {                                       // mini-formulario para agregar: "vacuna.nombre"
      const [tipo, campo] = t.dataset.gs.split(".");
      if (s.sub[tipo]) s.sub[tipo][campo] = t.value;
    }
  }

  onChange(event) {
    const t = event.target;
    const s = this.state;
    if (t.matches("[data-g-inactivos]")) {
      s.verInactivos = t.checked;
      const caja = document.getElementById("g-lista");
      if (caja) caja.innerHTML = GestionViews.itemsLista(s.duenos, s.q, s.verInactivos);
      return;
    }
    if (t.matches("[data-g-foto]")) { this.subirFoto(t.files?.[0], t); return; }
    if (t.dataset.gRerender) this.render();                   // un interruptor que muestra u oculta campos
  }

  onClick(event) {
    const b = event.target.closest("[data-action]");
    if (!b || !b.dataset.action.startsWith("g-")) return;
    const id = b.dataset.id;
    switch (b.dataset.action) {
      case "g-recargar": this.cargar(); break;
      case "g-volver-lista": this.verLista(); break;
      case "g-nuevo-dueno": this.nuevoDueno(); break;
      case "g-abrir-dueno": this.abrirDueno(id); break;
      case "g-guardar-dueno": this.guardarDueno(b); break;
      case "g-desactivar-dueno": this.cambiarActivoDueno(b, false); break;
      case "g-reactivar-dueno": this.cambiarActivoDueno(b, true); break;
      case "g-add-autorizada": this.agregarAutorizada(b); break;
      case "g-del-autorizada": this.quitarAutorizada(id); break;
      case "g-nueva-mascota": this.nuevaMascota(); break;
      case "g-abrir-mascota": this.abrirMascota(id); break;
      case "g-volver-dueno": this.volverADueno(); break;
      case "g-guardar-mascota": this.guardarMascota(b); break;
      case "g-desactivar-mascota": this.cambiarActivaMascota(b, false); break;
      case "g-reactivar-mascota": this.cambiarActivaMascota(b, true); break;
      case "g-add-vacuna": this.agregarVacuna(b); break;
      case "g-del-vacuna": this.quitarVacuna(id); break;
      case "g-add-medicamento": this.agregarMedicamento(b); break;
      case "g-toggle-medicamento": this.alternarMedicamento(id); break;
      case "g-del-medicamento": this.quitarMedicamento(id); break;
      default: break;
    }
  }
}
