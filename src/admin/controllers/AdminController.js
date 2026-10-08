/**
 * CONTROLADOR del panel: sesión, pestañas, edición del borrador, publicación y mensajes.
 * Edita un borrador en memoria; nada se publica hasta pulsar "Guardar y publicar".
 */
import { SITE_DEFAULTS } from "../../config/site.defaults.js";
import { esc } from "../../utils/dom.js";
import { Auth, AuthError } from "../services/authService.js";
import { SiteConfigApi, LeadsApi, ApiError } from "../services/adminApi.js";
import { AdminViews } from "../views/adminViews.js";
import { GestionController } from "./GestionController.js";
import { RutasController } from "./RutasController.js";
import { AgendaController } from "./AgendaController.js";
import {
  DIAS, clone, normalizeDraft, validateDraft, cleanPayload, buildDefaultsFile,
  setPath, move, blankService, blankCategory
} from "../models/siteDraft.js";

const $ = (id) => document.getElementById(id);

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
    this.remote = Auth.isConfigured();
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
    for (const id of ["adm-main", "adm-bar", "adm-userbox"]) $(id).hidden = true;
    $("adm-login").hidden = false;
    const error = $("adm-login-error");
    error.hidden = !message;
    error.textContent = message || "";
    $("adm-email").focus();
  }

  async showEditor() {
    $("adm-login").hidden = true;
    $("adm-main").hidden = false;
    $("adm-bar").hidden = false;
    let note = "";
    const keepDraft = Boolean(this.dirty && this.data);     // volvió a entrar tras vencer la sesión: se conservan sus cambios

    if (this.remote) {
      $("adm-userbox").hidden = false;
      $("adm-user").textContent = Auth.email;
      const result = await SiteConfigApi.fetch();
      if (keepDraft) {
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
      this.data = normalizeDraft(this.original);
      note = '<p class="adm-note adm-note--info"><b>Modo descarga.</b> El panel aún no está conectado a Supabase, así que los cambios no se publican solos. Edita lo que necesites, pulsa <b>Descargar archivo</b> y reemplaza <code>src/config/site.defaults.js</code> con ese archivo.</p>';
      $("adm-save").hidden = true;
      $("adm-download").textContent = "Descargar archivo";
      $("adm-download").className = "adm-btn adm-btn--primary";
    }
    $("adm-leads-tab").hidden = !this.remote;
    $("adm-gestion-tab").hidden = !this.remote;
    $("adm-rutas-tab").hidden = !this.remote;
    $("adm-agenda-tab").hidden = !this.remote;
    $("adm-note").innerHTML = note;
    if (!keepDraft) { this.openCat = null; this.setDirty(false); }
    this.setTab(["leads", "gestion", "rutas", "agenda"].includes(this.tab) && this.remote ? this.tab : "negocio");
  }

  setTab(tab) {
    if (this.tab === "rutas" && tab !== "rutas" && !this.rutas.puedeSalir()) return;
    if (this.tab === "agenda" && tab !== "agenda" && !this.agenda.puedeSalir()) return;
    this.tab = tab;
    document.querySelectorAll("[data-tab]").forEach((b) => {
      const active = b.dataset.tab === tab;
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
    });
    $("adm-bar").hidden = tab === "leads" || tab === "gestion" || tab === "rutas" || tab === "agenda";
    this.gestion.setActive(tab === "gestion");
    this.rutas.setActive(tab === "rutas");
    this.agenda.setActive(tab === "agenda");
    if (!["gestion", "rutas", "agenda"].includes(tab)) this.render();
    if (tab === "leads") this.refreshLeads();
  }

  render() {
    if (this.tab === "gestion") { this.gestion.render(); return; }
    if (this.tab === "rutas") { this.rutas.render(); return; }
    if (this.tab === "agenda") { this.agenda.render(); return; }
    const panel = $("adm-panel");
    if (this.tab === "negocio") panel.innerHTML = AdminViews.business(this.data);
    else if (this.tab === "servicios") panel.innerHTML = AdminViews.services(this.data, this.openCat);
    else panel.innerHTML = AdminViews.leads({ leads: this.leads, filter: this.leadFilter, titles: this.serviceTitles(), error: this.leadsError });
  }

  serviceTitles() {
    return Object.fromEntries((this.data?.categorias ?? []).map((c) => [c.id, c.tarjeta.titulo]));
  }

  setDirty(value) {
    this.dirty = value;
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
    try {
      this.leads = await LeadsApi.list();
      this.leadsError = null;
    } catch (error) {
      this.leads = [];
      if (error.code === "expired") { this.expireSession(); return; }
      this.leadsError = error.code || "fail";
    }
    const nuevos = this.leads.filter((l) => l.estado === "nuevo").length;
    $("adm-leads-count").textContent = nuevos ? ` (${nuevos} nuevo${nuevos > 1 ? "s" : ""})` : "";
    if (this.tab === "leads") this.render();
  }

  async changeLeadStatus(id, estado) {
    const lead = this.leads.find((l) => l.id === id);
    const previous = lead?.estado;
    if (lead) lead.estado = estado;
    try {
      await LeadsApi.setStatus(id, estado);
      this.toast("Estado actualizado.", "ok");
    } catch (error) {
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
    this.gestion.loaded = false;                          // al volver a entrar se recarga la lista
    this.rutas.loaded = false;
    this.agenda.loaded = false;
    Auth.logout();
    const conservaBorrador = this.dirty || this.gestion.dirty || this.rutas.dirty || this.agenda.dirty;
    this.showLogin(conservaBorrador ? "Tu sesión venció. Entra de nuevo; tus cambios sin guardar siguen aquí." : "Tu sesión venció. Entra de nuevo.");
  }

  /* ------------------------------ eventos ------------------------------ */
  bindGlobal() {
    window.addEventListener("beforeunload", (event) => { if (this.dirty || this.gestion.dirty || this.rutas.dirty || this.agenda.dirty) { event.preventDefault(); event.returnValue = ""; } });

    $("adm-login-btn").addEventListener("click", () => this.onLogin());
    $("adm-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") this.onLogin(); });
    $("adm-logout").addEventListener("click", () => {
      if ((this.dirty || this.gestion.dirty || this.rutas.dirty || this.agenda.dirty) && !confirm("Tienes cambios sin guardar. ¿Cerrar sesión de todos modos?")) return;
      this.setDirty(false); this.rutas.descartarBorradores(); this.rutas.loaded = false;
      this.agenda.descartarBorrador(); this.agenda.loaded = false; Auth.logout(); this.showLogin();
    });

    $("adm-save").addEventListener("click", () => this.save());
    $("adm-download").addEventListener("click", () => this.download());
    $("adm-reset").addEventListener("click", () => {
      if (!confirm("Esto descarta tus cambios en pantalla y vuelve a los valores originales del archivo. No se publica nada hasta que pulses Guardar. ¿Continuar?")) return;
      this.data = normalizeDraft(this.original); this.openCat = null; this.setDirty(true); this.render();
    });

    $("adm-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) this.setTab(b.dataset.tab); });
    $("adm-tabs").addEventListener("keydown", (e) => this.onTabKeys(e));

    const panel = $("adm-panel");
    panel.addEventListener("input", (e) => this.onInput(e));
    panel.addEventListener("change", (e) => this.onChange(e));
    panel.addEventListener("click", (e) => this.onClick(e));
    this.gestion.bind(panel);
    this.rutas.bind(panel);
    this.agenda.bind(panel);
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
    try { await Auth.login(email, password); $("adm-pass").value = ""; await this.showEditor(); }
    catch (error) { this.showLogin(error.message); }
    finally { button.disabled = false; button.textContent = "Entrar"; }
  }

  onInput(event) {
    if (this.tab === "gestion") return;                  // esa pestaña la maneja GestionController
    if (this.tab === "rutas") return;                    // rutas y hotel tienen guardado propio
    if (this.tab === "agenda") return;                   // agenda guarda cada cita al momento
    const t = event.target;
    if (!t.dataset.path) return;
    const value = t.type === "checkbox" ? t.checked : t.type === "number" ? (t.value === "" ? 0 : Number(t.value)) : t.value;
    setPath(this.data, t.dataset.path, value);
    if (t.classList.contains("adm-price")) {
      const label = t.parentNode.querySelector(".adm-pf");
      if (label) label.textContent = `$${Number(value).toLocaleString("es-CO")} COP${label.textContent.replace(/^\$[\d.,]+ COP/, "")}`;
    }
    this.setDirty(true);
  }

  onChange(event) {
    if (this.tab === "gestion") return;
    if (this.tab === "rutas") return;
    if (this.tab === "agenda") return;
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
    if (t.dataset.path === "negocio.whatsapp") {            // solo dígitos
      t.value = t.value.replace(/\D/g, "");
      setPath(this.data, "negocio.whatsapp", t.value);
    }
    if (t.dataset.rerender) { this.setDirty(true); this.render(); }
  }

  onClick(event) {
    if (this.tab === "gestion" || this.tab === "rutas" || this.tab === "agenda") return;
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
    const { errors, warnings } = validateDraft(this.data);
    if (errors.length) { this.toast("Corrige esto antes de guardar:", "err", errors); return; }
    const button = $("adm-save");
    button.disabled = true; button.textContent = "Guardando…";
    try {
      const payload = cleanPayload(this.data);
      await SiteConfigApi.publish(payload);
      this.data = normalizeDraft(payload);
      this.setDirty(false);
      this.render();
      this.toast("¡Listo! Los cambios ya están publicados en tu página.", "ok", warnings);
    } catch (error) {
      if (error.code === "expired" || error instanceof AuthError) this.expireSession();
      else if (error.code === "perm") this.toast("Este usuario no tiene permiso para guardar. Pide ayuda a quien configuró el panel.", "err");
      else this.toast("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.", "err");
    } finally {
      button.disabled = false; button.textContent = "Guardar y publicar";
    }
  }
}
