/**
 * CONTROLADOR del panel: sesión, pestañas, edición del borrador, publicación y mensajes.
 * Edita un borrador en memoria; nada se publica hasta pulsar "Guardar y publicar".
 */
import { SITE_DEFAULTS } from "../../config/site.defaults.js";
import { esc } from "../../utils/dom.js";
import { Auth, AuthError } from "../services/authService.js";
import { SiteConfigApi, LeadsApi, ApiError } from "../services/adminApi.js";
import { MensajesApi } from "../services/mensajesApi.js";
import { GestionApi } from "../services/gestionApi.js";
import { AdminViews } from "../views/adminViews.js";
import { puedeEjecutarAccion, puedeVerModulo } from "../models/permissions.js";
import { GestionController } from "./GestionController.js";
import { RutasController } from "./RutasController.js";
import { AgendaController } from "./AgendaController.js";
import { FinanzasController } from "./FinanzasController.js";
import { SeguimientoController } from "./SeguimientoController.js";
import {
  DIAS, clone, normalizeDraft, validateDraft, cleanPayload, buildDefaultsFile,
  setPath, move, blankService, blankCategory
} from "../models/siteDraft.js";

const $ = (id) => document.getElementById(id);
export const identidadCambio = (anterior, actual) => anterior !== null && anterior !== actual;
export const rolCambio = (anterior, actual) => anterior !== null && anterior !== actual;
export const rolPanelAutorizado = (rol) => rol === "admin" || rol === "empleado";

export class AdminController {
  constructor() {
    this.data = null;
    this.original = normalizeDraft(clone(SITE_DEFAULTS));
    this.dirty = false;
    this.openCat = null;
    this.tab = "negocio";
    this.leads = [];
    this.leadFilter = "nuevo";
    this.leadsError = null;
    this.empleados = []; this.conversacionEmpleadoId = null; this.mensajes = []; this.mensajesError = null;
    this.remote = Auth.isConfigured();
    this.role = null;
    this.lastRole = null;
    this.sessionIdentity = null;
    this.sessionGeneration = 0;
    this.toastTimer = null;
    // Dueños y mascotas (Fase 2): cada ficha se guarda sola, por eso va en su propio controlador.
    this.gestion = new GestionController({
      panel: () => $("adm-panel"),
      toast: (...args) => this.toast(...args),
      expire: () => this.expireSession()
    });
    this.rutas = new RutasController({
      panel: () => $("adm-panel"),
      toast: (...args) => this.toast(...args),
      expire: () => this.expireSession()
    });
    this.agenda = new AgendaController({
      panel: () => $("adm-panel"),
      toast: (...args) => this.toast(...args),
      expire: () => this.expireSession()
    });
    this.finanzas = new FinanzasController({
      panel: () => $("adm-panel"),
      toast: (...args) => this.toast(...args),
      expire: () => this.expireSession(),
      ocultarPestana: () => {
        $("adm-finanzas-tab").hidden = true;
        if (this.tab === "finanzas") this.setTab("negocio");
      }
    });
    this.seguimiento = new SeguimientoController({
      panel: () => $("adm-panel"),
      toast: (...args) => this.toast(...args),
      expire: () => this.expireSession(),
      ocultarPestana: () => {
        $("adm-seguimiento-tab").hidden = true;
        if (this.tab === "seguimiento") this.setTab("negocio");
      }
    });
  }

  /* ------------------------------ arranque ------------------------------ */
  init() {
    this.bindGlobal();
    if (!this.remote) this.showEditor();
    else if (Auth.hasSession()) this.showEditor().catch(() => this.showLogin());
    else this.showLogin();
  }

  /* ------------------------------ vistas ------------------------------ */
  showLogin(message) {
    this.role = null;
    for (const id of ["adm-main", "adm-bar", "adm-userbox"]) $(id).hidden = true;
    $("adm-login").hidden = false;
    const error = $("adm-login-error");
    error.hidden = !message;
    error.textContent = message || "";
    $("adm-email").focus();
  }

  sessionIsCurrent(generation, identity) {
    return this.sessionGeneration === generation && Auth.generation === generation && this.sessionIdentity === identity;
  }

  invalidateSessionData() {
    this.sessionGeneration = Auth.generation;
    this.data = null;
    this.dirty = false;
    this.openCat = null;
    this.leads = [];
    this.leadsError = null;
    this.empleados = []; this.conversacionEmpleadoId = null; this.mensajes = []; this.mensajesError = null;
    this.leadFilter = "nuevo";
    this.role = null;
    for (const controller of [this.gestion, this.rutas, this.agenda, this.finanzas, this.seguimiento]) {
      controller.invalidateSession();
    }
    this.refreshLeadsBadge();
    $("adm-panel").replaceChildren();
    $("adm-main").hidden = true;
  }

  async showEditor() {
    const previousKnownRole = this.lastRole;
    const identity = this.remote ? Auth.userId : "offline";
    const generation = Auth.generation;
    if (!identity) {
      this.invalidateSessionData();
      Auth.logout();
      this.showLogin("No pudimos verificar la identidad de la sesión. Inicia sesión de nuevo.");
      return;
    }
    const changedIdentity = identidadCambio(this.sessionIdentity, identity);
    if (changedIdentity) this.invalidateSessionData();
    this.sessionIdentity = identity;
    this.sessionGeneration = generation;
    $("adm-main").hidden = true;
    $("adm-bar").hidden = true;
    let context = null;
    if (this.remote) {
      try { context = await GestionApi.contextoActual(); }
      catch {
        if (!this.sessionIsCurrent(generation, identity)) return;
        this.invalidateSessionData();
        Auth.logout();
        this.sessionIdentity = null;
        this.showLogin("No pudimos verificar el acceso. Revisa tu conexión e inténtalo de nuevo.");
        return;
      }
      if (!this.sessionIsCurrent(generation, identity)) return;
      if (!context) {
        this.invalidateSessionData();
        Auth.logout();
        this.showLogin("Esta cuenta no tiene acceso activo al panel.");
        return;
      }
      if (!rolPanelAutorizado(context.rol)) {
        this.invalidateSessionData();
        Auth.logout();
        this.showLogin("El rol de esta cuenta no está autorizado para el panel.");
        return;
      }
      this.role = context.rol;
    } else {
      // Modo de descarga local: no consulta ni publica datos remotos.
      this.role = "offline";
    }
    if (!this.sessionIsCurrent(generation, identity)) return;
    if (rolCambio(this.lastRole, this.role)) {
      for (const controller of [this.gestion, this.rutas, this.agenda, this.finanzas, this.seguimiento]) controller.invalidateSession();
      this.data = null;
      this.leads = [];
      this.leadsError = null;
    }
    this.lastRole = this.role;
    $("adm-login").hidden = true;
    $("adm-main").hidden = false;
    let note = "";
    const keepDraft = Boolean(this.dirty && this.data);     // volvió a entrar tras vencer la sesión: se conservan sus cambios

    if (this.remote) {
      $("adm-userbox").hidden = false;
      $("adm-user").textContent = Auth.email;
      if (this.role === "admin") {
        const result = await SiteConfigApi.fetch();
        if (!this.sessionIsCurrent(generation, identity)) return;
        if (keepDraft && previousKnownRole === "admin" && !changedIdentity) {
          note = '<p class="adm-note adm-note--info">Recuperamos los cambios que tenías sin guardar. Pulsa <b>Guardar y publicar</b> para publicarlos.</p>';
        } else if (result.data) {
          this.data = normalizeDraft(result.data);
          if (result.updatedAt) note = `<p class="adm-note adm-note--info">Última publicación: <b>${esc(new Date(result.updatedAt).toLocaleString("es-CO"))}</b></p>`;
        } else {
          this.data = normalizeDraft(this.original);
          note = result.error
            ? '<p class="adm-note adm-note--err">No se pudieron leer los datos publicados. Se muestran los valores iniciales; revisa tu conexión antes de guardar.</p>'
            : '<p class="adm-note adm-note--info">Aún no has publicado cambios. Estás viendo los valores iniciales de la página.</p>';
        }
        $("adm-save").hidden = false;
        $("adm-download").textContent = "Descargar respaldo";
        $("adm-download").className = "adm-btn adm-btn--ghost";
        this.refreshLeads();                                  // sin esperar: solo para mostrar el número de nuevos
      } else {
        const result = await SiteConfigApi.fetch();
        if (!this.sessionIsCurrent(generation, identity)) return;
        this.data = result.data ? normalizeDraft(result.data) : null;
        note = '<p class="adm-note adm-note--info">Acceso de empleado: aquí verás el catálogo publicado, los dueños y mascotas asignados y tus tareas operativas.</p>';
        $("adm-save").hidden = true;
        $("adm-download").hidden = true;
      }
    } else {
      this.data = normalizeDraft(this.original);
      note = '<p class="adm-note adm-note--info"><b>Modo descarga.</b> El panel aún no está conectado a Supabase, así que los cambios no se publican solos. Edita lo que necesites, pulsa <b>Descargar archivo</b> y reemplaza <code>src/config/site.defaults.js</code> con ese archivo.</p>';
      $("adm-save").hidden = true;
      $("adm-download").hidden = false;
      $("adm-download").textContent = "Descargar archivo";
      $("adm-download").className = "adm-btn adm-btn--primary";
    }
    for (const [modulo, id] of Object.entries({
      negocio: "adm-business-tab", servicios: "adm-services-tab", leads: "adm-leads-tab",
      gestion: "adm-gestion-tab", rutas: "adm-rutas-tab", agenda: "adm-agenda-tab",
      finanzas: "adm-finanzas-tab", seguimiento: "adm-seguimiento-tab", conversaciones: "adm-conversations-tab"
    })) {
      const button = $(id);
      button.hidden = !puedeVerModulo(this.role, modulo);
    }
    $("adm-rutas-tab").textContent = this.role === "empleado" ? "Mis rutas" : "Rutas y hotel";
    this.setDirty(this.dirty);
    $("adm-reset").hidden = this.role === "empleado";
    $("adm-save").hidden = this.role !== "admin";
    $("adm-download").hidden = this.role === "empleado";
    $("adm-note").innerHTML = note;
    if (!keepDraft) { this.openCat = null; this.setDirty(false); }
    this.setTab(puedeVerModulo(this.role, this.tab) ? this.tab : this.role === "empleado" ? "rutas" : "negocio");
  }

  setTab(tab) {
    if (!puedeVerModulo(this.role, tab)) return;
    if (this.tab === "rutas" && tab !== "rutas" && !this.rutas.puedeSalir()) return;
    if (this.tab === "agenda" && tab !== "agenda" && !this.agenda.puedeSalir()) return;
    if (this.tab === "finanzas" && tab !== "finanzas" && !this.finanzas.puedeSalir()) return;
    if (this.tab === "seguimiento" && tab !== "seguimiento" && !this.seguimiento.puedeSalir()) return;
    this.tab = tab;
    document.querySelectorAll("[data-tab]").forEach((b) => {
      const active = b.dataset.tab === tab;
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
    });
    this.setDirty(this.dirty);
    this.gestion.setActive(tab === "gestion");
    this.rutas.setActive(tab === "rutas");
    this.agenda.setActive(tab === "agenda");
    this.finanzas.setActive(tab === "finanzas");
    this.seguimiento.setActive(tab === "seguimiento");
    if (!["gestion", "rutas", "agenda", "finanzas", "seguimiento"].includes(tab)) this.render();
    if (tab === "leads") this.refreshLeads();
    if (tab === "conversaciones") this.refreshConversacion();
  }

  render() {
    if (!puedeVerModulo(this.role, this.tab)) return;
    if (this.tab === "gestion") { this.gestion.render(); return; }
    if (this.tab === "rutas") { this.rutas.render(); return; }
    if (this.tab === "agenda") { this.agenda.render(); return; }
    if (this.tab === "finanzas") { this.finanzas.render(); return; }
    if (this.tab === "seguimiento") { this.seguimiento.render(); return; }
    const panel = $("adm-panel");
    if (this.tab === "negocio") panel.innerHTML = AdminViews.business(this.data);
    else if (this.tab === "servicios" && this.role === "empleado") panel.innerHTML = AdminViews.employeeServices(this.data);
    else if (this.tab === "servicios") panel.innerHTML = AdminViews.services(this.data, this.openCat);
    else if (this.tab === "conversaciones") panel.innerHTML = AdminViews.conversaciones({ admin: this.role === "admin", empleados: this.empleados, empleadoId: this.conversacionEmpleadoId, mensajes: this.mensajes, error: this.mensajesError, userId: Auth.userId });
    else panel.innerHTML = AdminViews.leads({ leads: this.leads, filter: this.leadFilter, titles: this.serviceTitles(), error: this.leadsError });
  }

  async refreshConversacion() {
    if (this.role !== "admin" && this.role !== "empleado") return;
    try {
      const contexto = await MensajesApi.contexto();
      if (contexto.admin) {
        this.empleados = await MensajesApi.empleados();
        if (!this.conversacionEmpleadoId || !this.empleados.some((e) => e.id === this.conversacionEmpleadoId)) this.conversacionEmpleadoId = this.empleados[0]?.id ?? null;
      } else this.conversacionEmpleadoId = contexto.empleadoId;
      this.mensajes = this.conversacionEmpleadoId ? await MensajesApi.listar(this.conversacionEmpleadoId) : [];
      this.mensajesError = null;
      const unread = this.mensajes.filter((m) => m.remitente_user_id !== Auth.userId && !m.leido_en);
      for (const m of unread) await MensajesApi.leer(m.id);
      if (unread.length) this.mensajes = this.mensajes.map((m) => unread.some((u) => u.id === m.id) ? { ...m, leido_en: new Date().toISOString() } : m);
    } catch (error) { this.mensajes = []; this.mensajesError = error.code || "fail"; }
    if (this.tab === "conversaciones") this.render();
  }

  serviceTitles() {
    return Object.fromEntries((this.data?.categorias ?? []).map((c) => [c.id, c.tarjeta.titulo]));
  }

  setDirty(value) {
    this.dirty = Boolean(value);
    const bar = $("adm-bar");
    const barTab = this.tab === "negocio" || this.tab === "servicios";
    bar.hidden = this.role === "empleado" || !this.dirty || !barTab;
    const state = $("adm-state");
    state.textContent = value ? "Tienes cambios sin guardar" : "Sin cambios";
    state.className = `adm-state ${value ? "is-dirty" : "is-clean"}`;
  }

  toast(message, type = "", list = []) {
    const el = $("adm-toast");
    el.className = `adm-toast ${type}`;
    el.hidden = false;
    el.innerHTML = esc(message) + (list.length ? `<ul>${list.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.hidden = true; }, list.length ? 9000 : 4000);
  }

  /* ------------------------------ mensajes recibidos ------------------------------ */
  async refreshLeads() {
    if (this.role !== "admin") return;
    const generation = this.sessionGeneration;
    const identity = this.sessionIdentity;
    try {
      const leads = await LeadsApi.list();
      if (!this.sessionIsCurrent(generation, identity) || this.role !== "admin") return;
      this.leads = leads;
      this.leadsError = null;
    } catch (error) {
      if (!this.sessionIsCurrent(generation, identity) || this.role !== "admin") return;
      this.leads = [];
      if (error.code === "expired") { this.expireSession(); return; }
      this.leadsError = error.code || "fail";
    }
    const nuevos = this.leads.filter((l) => l.estado === "nuevo").length;
    $("adm-leads-count").textContent = nuevos ? ` (${nuevos} nuevo${nuevos > 1 ? "s" : ""})` : "";
    if (this.tab === "leads") this.render();
  }

  async changeLeadStatus(id, estado) {
    if (this.role !== "admin") return;
    const generation = this.sessionGeneration;
    const identity = this.sessionIdentity;
    const lead = this.leads.find((l) => l.id === id);
    const previous = lead?.estado;
    if (lead) lead.estado = estado;
    try {
      await LeadsApi.setStatus(id, estado);
      if (!this.sessionIsCurrent(generation, identity)) return;
      this.toast("Estado actualizado.", "ok");
    } catch (error) {
      if (!this.sessionIsCurrent(generation, identity)) return;
      if (lead) lead.estado = previous;
      if (error.code === "expired") { this.expireSession(); return; }
      this.toast("No se pudo cambiar el estado. Inténtalo de nuevo.", "err");
    }
    this.refreshLeadsBadge();
    this.render();
  }

  refreshLeadsBadge() {
    const nuevos = this.leads.filter((l) => l.estado === "nuevo").length;
    $("adm-leads-count").textContent = nuevos ? ` (${nuevos} nuevo${nuevos > 1 ? "s" : ""})` : "";
  }

  expireSession() {
    this.invalidateSessionData();
    Auth.logout();
    this.sessionIdentity = null;
    this.showLogin("Tu sesión venció. Inicia sesión de nuevo.");
  }

  /* ------------------------------ eventos ------------------------------ */
  bindGlobal() {
    window.addEventListener("beforeunload", (event) => { if (this.dirty || this.gestion.dirty || this.rutas.dirty || this.agenda.dirty || this.finanzas.dirty || this.seguimiento.dirty) { event.preventDefault(); event.returnValue = ""; } });

    $("adm-login-btn").addEventListener("click", () => this.onLogin());
    $("adm-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") this.onLogin(); });
    $("adm-logout").addEventListener("click", () => {
      if ((this.dirty || this.gestion.dirty || this.rutas.dirty || this.agenda.dirty || this.finanzas.dirty || this.seguimiento.dirty) && !confirm("Tienes cambios sin guardar. ¿Cerrar sesión de todos modos?")) return;
      this.invalidateSessionData();
      Auth.logout();
      this.sessionIdentity = null;
      this.showLogin();
    });

    $("adm-save").addEventListener("click", () => this.save());
    $("adm-download").addEventListener("click", () => this.download());
    $("adm-reset").addEventListener("click", () => {
      if (!puedeEjecutarAccion(this.role, "negocio", "reset")) return;
      if (!confirm("Esto descarta tus cambios en pantalla y vuelve a los valores originales del archivo. No se publica nada hasta que pulses Guardar. ¿Continuar?")) return;
      this.data = normalizeDraft(this.original); this.openCat = null; this.setDirty(true); this.render();
    });

    $("adm-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) this.setTab(b.dataset.tab); });
    $("adm-tabs").addEventListener("keydown", (e) => this.onTabKeys(e));

    const panel = $("adm-panel");
    panel.addEventListener("change", (e) => {
      if (e.target.matches("[data-conv-empleado]")) { this.conversacionEmpleadoId = e.target.value || null; this.refreshConversacion(); }
    });
    panel.addEventListener("submit", async (e) => {
      if (!e.target.matches("[data-conv-form]")) return;
      e.preventDefault();
      const cuerpo = new FormData(e.target).get("mensaje");
      try { await MensajesApi.enviar(this.conversacionEmpleadoId, String(cuerpo ?? "").trim()); e.target.reset(); await this.refreshConversacion(); }
      catch (error) { this.toast(error.code === "perm" ? "No tienes permiso para enviar en esta conversación." : "No se pudo enviar el mensaje.", "err"); }
    });
    panel.addEventListener("input", (e) => this.onInput(e));
    panel.addEventListener("change", (e) => this.onChange(e));
    panel.addEventListener("click", (e) => this.onClick(e));
    this.gestion.bind(panel);
    this.rutas.bind(panel);
    this.agenda.bind(panel);
    this.finanzas.bind(panel);
    this.seguimiento.bind(panel);
  }

  onTabKeys(event) {
    const tabs = [...document.querySelectorAll("[data-tab]:not([hidden])")];
    const index = tabs.indexOf(event.target.closest("[data-tab]"));
    if (index < 0 || !["ArrowRight", "ArrowLeft"].includes(event.key)) return;
    event.preventDefault();
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    this.setTab(next.dataset.tab);
    next.focus();
  }

  async onLogin() {
    const email = $("adm-email").value.trim();
    const password = $("adm-pass").value;
    if (!email || !password) { this.showLogin("Escribe tu correo y contraseña."); return; }
    const button = $("adm-login-btn");
    button.disabled = true; button.textContent = "Entrando…";
    try {
      await Auth.login(email, password);
      if (this.sessionIdentity && Auth.userId !== this.sessionIdentity) this.invalidateSessionData();
      $("adm-pass").value = "";
      await this.showEditor();
    }
    catch (error) { this.showLogin(error.message); }
    finally { button.disabled = false; button.textContent = "Entrar"; }
  }

  onInput(event) {
    if (this.role !== "admin") return;
    if (this.tab === "gestion") return;                  // esa pestaña la maneja GestionController
    if (this.tab === "rutas") return;                    // rutas y hotel tienen guardado propio
    if (this.tab === "agenda") return;                   // agenda guarda cada cita al momento
    if (this.tab === "finanzas") return;                 // finanzas guarda cada registro al momento
    if (this.tab === "seguimiento") return;              // seguimiento tiene formulario propio
    if (this.tab === "conversaciones") return;
    const t = event.target;
    if (!t.dataset.path) return;
    const value = t.type === "checkbox" ? t.checked : t.type === "number" ? (t.value === "" ? 0 : Number(t.value)) : t.value;
    setPath(this.data, t.dataset.path, value);
    if (t.classList.contains("adm-price")) {
      const label = t.parentNode.querySelector(".adm-pf");
      if (label) {
        const unit = label.textContent.replace(/^\$[\d.,]+ COP/, "");
        label.textContent = Number(value) > 0
          ? `$${Number(value).toLocaleString("es-CO")} COP${unit}`
          : "Ingresa un valor mayor a cero.";
      }
    }
    this.setDirty(true);
  }

  onChange(event) {
    if (this.role !== "admin") return;
    if (this.tab === "gestion") return;
    if (this.tab === "rutas") return;
    if (this.tab === "agenda") return;
    if (this.tab === "finanzas") return;
    if (this.tab === "seguimiento") return;
    if (this.tab === "conversaciones") return;
    const t = event.target;
    if (t.matches("[data-lead-status]")) { this.changeLeadStatus(t.dataset.id, t.value); return; }
    if (t.dataset.dia) {
      const c = this.data.categorias[Number(t.dataset.c)];
      const set = new Set(c.dias || []);
      t.checked ? set.add(t.dataset.dia) : set.delete(t.dataset.dia);
      c.dias = DIAS.filter((d) => set.has(d));
      this.setDirty(true);
      return;
    }
    if (t.tagName === "SELECT" && t.dataset.path) {
      setPath(this.data, t.dataset.path, t.value);
      this.setDirty(true);
      if (t.dataset.rerender) this.render();
      return;
    }
    if (t.dataset.path === "negocio.whatsapp") {            // solo dígitos
      t.value = t.value.replace(/\D/g, "");
      setPath(this.data, "negocio.whatsapp", t.value);
    }
    if (t.dataset.rerender) { this.setDirty(true); this.render(); }
  }

  onClick(event) {
    if (this.role !== "admin") return;
    if (this.tab === "gestion" || this.tab === "rutas" || this.tab === "agenda" || this.tab === "finanzas" || this.tab === "seguimiento") return;
    const b = event.target.closest("[data-action]");
    if (!b) return;
    const action = b.dataset.action;
    const ci = Number(b.dataset.c);
    const i = Number(b.dataset.i);
    const d = this.data;
    let changed = true;

    switch (action) {
      case "toggle-open": this.openCat = this.openCat === b.dataset.id ? null : b.dataset.id; changed = false; break;
      case "add-horario": d.negocio.horarios.push(""); break;
      case "del-horario": d.negocio.horarios.splice(i, 1); break;
      case "add-punto": d.categorias[ci].tarjeta.puntos.push({ texto: "", destacado: false }); break;
      case "del-punto": d.categorias[ci].tarjeta.puntos.splice(i, 1); break;
      case "add-svc": d.categorias[ci].servicios.push(blankService(d.categorias[ci])); break;
      case "del-svc":
        if (!confirm("¿Eliminar este servicio? Si solo quieres ocultarlo, usa el interruptor verde.")) return;
        d.categorias[ci].servicios.splice(i, 1); break;
      case "up-svc": move(d.categorias[ci].servicios, i, -1); break;
      case "down-svc": move(d.categorias[ci].servicios, i, 1); break;
      case "up-cat": move(d.categorias, ci, -1); break;
      case "down-cat": move(d.categorias, ci, 1); break;
      case "add-cat": { const cat = blankCategory(d.categorias.map((c) => c.id)); d.categorias.push(cat); this.openCat = cat.id; break; }
      case "del-cat":
        if (!confirm("¿Eliminar TODA esta categoría y sus servicios? Si solo quieres ocultarla, usa el interruptor verde.")) return;
        d.categorias.splice(ci, 1); this.openCat = null; break;
      case "lead-filter": this.leadFilter = b.dataset.filter; changed = false; break;
      case "leads-refresh": changed = false; this.refreshLeads(); return;
      default: changed = false;
    }
    if (changed) this.setDirty(true);
    this.render();
  }

  /* ------------------------------ publicar / descargar ------------------------------ */
  download() {
    if (!puedeEjecutarAccion(this.role, "negocio", "descargar")) return;
    const { errors } = validateDraft(this.data);
    if (errors.length) this.toast("Revisa estos puntos antes de usar el archivo:", "err", errors);
    const blob = new Blob([buildDefaultsFile(cleanPayload(this.data))], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "site.defaults.js";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    if (!this.remote) this.setDirty(false);
  }

  async save() {
    if (this.role !== "admin") return;
    const generation = this.sessionGeneration;
    const identity = this.sessionIdentity;
    const { errors, warnings } = validateDraft(this.data);
    if (errors.length) { this.toast("Corrige esto antes de guardar:", "err", errors); return; }
    const button = $("adm-save");
    button.disabled = true; button.textContent = "Guardando…";
    try {
      const payload = cleanPayload(this.data);
      await SiteConfigApi.publish(payload);
      if (!this.sessionIsCurrent(generation, identity)) return;
      this.data = normalizeDraft(payload);
      this.setDirty(false);
      this.render();
      this.toast("¡Listo! Los cambios ya están publicados en tu página.", "ok", warnings);
    } catch (error) {
      if (!this.sessionIsCurrent(generation, identity)) return;
      if (error.code === "expired" || error instanceof AuthError) this.expireSession();
      else if (error.code === "perm") this.toast("Este usuario no tiene permiso para guardar. Pide ayuda a quien configuró el panel.", "err");
      else this.toast("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.", "err");
    } finally {
      if (!this.sessionIsCurrent(generation, identity)) return;
      button.disabled = false; button.textContent = "Guardar y publicar";
    }
  }
}
