/**
 * VISTAS de la gestión de dueños y mascotas (Fase 2): funciones puras que reciben el
 * estado del controlador y devuelven HTML ya escapado.
 *
 * Reglas del proyecto que se respetan aquí:
 *  - Sin style="..." ni onclick="..." en línea: la CSP del sitio los bloquea. Los
 *    estilos van en assets/css/admin.css y los eventos se capturan en el controlador
 *    con los atributos data-action / data-g / data-gs.
 *  - Todo texto que viene de la base de datos pasa por esc().
 *
 * Convenciones de atributos:
 *   data-g="campo"        campo del formulario principal (dueño o mascota)
 *   data-gs="tipo.campo"  campo de los mini-formularios para agregar (vacuna.nombre...)
 *   data-g-rerender       al cambiar, volver a pintar (interruptores que muestran más campos)
 *   data-action="g-..."   botones
 */
import { esc } from "../../utils/dom.js";
import { formatPhone, leadWhatsapp } from "../models/siteDraft.js";
import {
  GENEROS, TIPOS_VACUNA, estadoVencimiento, fechaLegible, filtrarDuenos, mascotasActivas
} from "../models/gestionModel.js";

/* ------------------------------ piezas pequeñas ------------------------------ */
const campo = (label, name, value, o = {}) => {
  const attr = o.attr || "data-g";
  const attrs = `${attr}="${name}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ""}${o.max ? ` maxlength="${o.max}"` : ""}`;
  const control = o.textarea
    ? `<textarea ${attrs} rows="3">${esc(value)}</textarea>`
    : `<input type="${o.type || "text"}" ${attrs} value="${esc(value)}"${o.min != null ? ` min="${o.min}"` : ""}${o.maxn != null ? ` max="${o.maxn}"` : ""}${o.inputmode ? ` inputmode="${o.inputmode}"` : ""}>`;
  return `<label class="adm-f${o.full ? " adm-full" : ""}"><span class="adm-fl">${esc(label)}</span>${control}${o.hint ? `<small>${esc(o.hint)}</small>` : ""}</label>`;
};

const selector = (label, name, value, opciones, o = {}) => {
  const attr = o.attr || "data-g";
  return `<label class="adm-f${o.full ? " adm-full" : ""}"><span class="adm-fl">${esc(label)}</span>
    <select ${attr}="${name}">${opciones.map(([v, t]) => `<option value="${esc(v)}"${String(value) === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
};

const interruptor = (label, name, activo) =>
  `<div class="adm-switchrow"><label class="adm-sw"><input type="checkbox" data-g="${name}" data-g-rerender="1"${activo ? " checked" : ""} aria-label="${esc(label)}"><span></span></label><span class="adm-switchrow__t">${esc(label)}</span></div>`;

const chip = (texto, clase = "") => `<span class="adm-tag${clase ? ` adm-tag--${clase}` : ""}">${esc(texto)}</span>`;

const nota = (tipo, html) => `<p class="adm-note adm-note--${tipo}">${html}</p>`;
const boton = (texto, action, o = {}) =>
  `<button class="adm-btn ${o.cls || "adm-btn--ghost"}${o.sm ? " adm-btn--sm" : ""}" type="button" data-action="${action}"${o.id ? ` data-id="${esc(o.id)}"` : ""}>${texto}</button>`;

const telefonoLink = (telefono) =>
  telefono ? `<a href="https://wa.me/${esc(leadWhatsapp(telefono))}" target="_blank" rel="noopener noreferrer">📞 ${esc(formatPhone(telefono))}</a>` : "";

/* ------------------------------ avisos de estado ------------------------------ */
const AVISOS = {
  missing: nota("info", "Todavía no existen las tablas del panel en Supabase. Aplica las migraciones de la Fase 1 (están explicadas en <code>supabase/README.md</code>) y vuelve a intentarlo."),
  perm: nota("err", "Este usuario no tiene permiso para ver esta información. Revisa que figure como administrador en la tabla <code>empleados</code>."),
  fail: nota("err", "No se pudieron cargar los datos. Revisa tu conexión e inténtalo de nuevo."),
  noadmin: nota("info", "Tu usuario todavía no figura como administrador en la tabla <code>empleados</code>. Falta el paso <b>Crear tu usuario admin</b> de <code>supabase/README.md</code>.")
};

/* ------------------------------ LISTA ------------------------------ */
function itemsLista(duenos, q, verInactivos) {
  const lista = filtrarDuenos(duenos, q, verInactivos);
  if (!duenos.length) return '<p class="adm-sub">Aún no hay dueños registrados. Pulsa <b>+ Nuevo dueño</b> para agregar el primero.</p>';
  if (!lista.length) return '<p class="adm-sub">Nadie coincide con esa búsqueda.</p>';
  return lista.map((d) => {
    const perros = mascotasActivas(d);
    return `
    <article class="adm-dueno${d.activo ? "" : " is-off"}">
      <header class="adm-dueno__head"><b>${esc(d.nombre)}</b>${d.activo ? "" : chip("Desactivado", "off")}</header>
      <p class="adm-lead__meta">${telefonoLink(d.telefono)} · ${perros.length} ${perros.length === 1 ? "perro" : "perros"}</p>
      ${perros.length ? `<p class="adm-pets">${perros.map((m) => chip(`🐾 ${m.nombre}`)).join(" ")}</p>` : ""}
      ${boton("Abrir ficha", "g-abrir-dueno", { id: d.id, sm: true })}
    </article>`;
  }).join("");
}

function lista(s) {
  return `
  <section class="adm-card">
    <div class="adm-row adm-between">
      <div><h2>🐶 Dueños y mascotas</h2><p class="adm-sub">Cada dueño puede tener varios perros. Busca por nombre del dueño, del perro o por teléfono.</p></div>
      ${boton("+ Nuevo dueño", "g-nuevo-dueno", { cls: "adm-btn--primary" })}
    </div>
    <div class="adm-row adm-wrapx adm-searchbar">
      <label class="adm-f adm-grow"><span class="adm-fl">Buscar</span><input type="text" data-g-search value="${esc(s.q)}" placeholder="Nombre, perro o teléfono" autocomplete="off"></label>
      <label class="adm-inline"><input type="checkbox" data-g-inactivos${s.verInactivos ? " checked" : ""}> Ver desactivados</label>
    </div>
    <div id="g-lista">${itemsLista(s.duenos, s.q, s.verInactivos)}</div>
  </section>`;
}

/* ------------------------------ DUEÑO ------------------------------ */
function formDueno(f, nuevo, activo) {
  return `
  <section class="adm-card">
    <h2>${nuevo ? "Nuevo dueño" : "Datos del dueño"}</h2>
    <div class="adm-grid">
      ${campo("Nombre completo", "nombre", f.nombre, { max: 100 })}
      ${campo("Teléfono (WhatsApp)", "telefono", f.telefono, { type: "tel", ph: "3123044174", inputmode: "tel", hint: "Solo números. Es el que se usa para cobrar y confirmar citas por WhatsApp." })}
      ${campo("Correo (opcional)", "correo", f.correo, { type: "email", max: 120 })}
      ${campo("Dirección", "direccion", f.direccion, { max: 200, hint: "Sirve para precargar las paradas de la ruta." })}
      ${campo("Notas", "notas", f.notas, { textarea: true, full: true })}
    </div>
    <fieldset class="adm-fieldset">
      <legend>Contacto de emergencia</legend>
      <div class="adm-grid adm-grid--3">
        ${campo("Nombre", "contacto_emergencia_nombre", f.contacto_emergencia_nombre, { max: 100 })}
        ${campo("Teléfono", "contacto_emergencia_telefono", f.contacto_emergencia_telefono, { type: "tel", inputmode: "tel" })}
        ${campo("Parentesco", "contacto_emergencia_parentesco", f.contacto_emergencia_parentesco, { max: 60, ph: "Hermana, vecino..." })}
      </div>
    </fieldset>
    <div class="adm-row adm-wrapx adm-mt">
      ${boton("Guardar dueño", "g-guardar-dueno", { cls: "adm-btn--primary" })}
      ${nuevo ? "" : activo ? boton("Desactivar dueño", "g-desactivar-dueno", { cls: "adm-btn--danger" }) : boton("Reactivar dueño", "g-reactivar-dueno")}
    </div>
  </section>`;
}

function seccionPerros(fila) {
  const perros = fila?.mascotas ?? [];
  const filas = perros.length
    ? perros.map((m) => `
      <div class="adm-item adm-dog${m.activa ? "" : " is-off"}">
        <div class="adm-grow"><b>${esc(m.nombre)}</b>${m.raza ? ` <small>${esc(m.raza)}</small>` : ""}
          <span class="adm-tags">${m.es_bravo ? chip("Bravo", "warn") : ""}${m.esta_enfermo ? chip("Enfermo", "warn") : ""}${m.toma_medicamentos ? chip("Medicamentos") : ""}${m.activa ? "" : chip("Desactivado", "off")}</span>
        </div>
        ${boton("Abrir", "g-abrir-mascota", { id: m.id, sm: true })}
      </div>`).join("")
    : '<p class="adm-sub">Este dueño aún no tiene perros registrados.</p>';
  return `
  <section class="adm-card">
    <div class="adm-row adm-between"><h2>🐾 Perros</h2>${boton("+ Agregar perro", "g-nueva-mascota", { cls: "adm-btn--primary", sm: true })}</div>
    ${filas}
  </section>`;
}

function seccionAutorizadas(s, fila) {
  const perros = fila?.mascotas ?? [];
  const nombrePerro = (id) => perros.find((m) => m.id === id)?.nombre ?? "un perro";
  const filas = s.dueno.autorizadas.length
    ? s.dueno.autorizadas.map((a) => `
      <div class="adm-item">
        <div class="adm-grow"><b>${esc(a.nombre)}</b>${a.parentesco ? ` <small>${esc(a.parentesco)}</small>` : ""}
          <small class="adm-block">${a.telefono ? `${esc(formatPhone(a.telefono))} · ` : ""}Puede recoger a: ${a.mascota_id ? esc(nombrePerro(a.mascota_id)) : "todos los perros del dueño"}</small></div>
        ${boton("Quitar", "g-del-autorizada", { id: a.id, cls: "adm-btn--danger", sm: true })}
      </div>`).join("")
    : '<p class="adm-sub">Nadie autorizado todavía.</p>';
  const sub = s.sub.autorizada;
  return `
  <section class="adm-card">
    <h2>🔑 Personas autorizadas a recoger</h2>
    <p class="adm-sub">Además del dueño, estas personas pueden recoger al perro.</p>
    ${filas}
    <div class="adm-fieldset">
      <div class="adm-grid adm-grid--3">
        ${campo("Nombre", "autorizada.nombre", sub.nombre, { attr: "data-gs", max: 100 })}
        ${campo("Teléfono", "autorizada.telefono", sub.telefono, { attr: "data-gs", type: "tel", inputmode: "tel" })}
        ${campo("Parentesco", "autorizada.parentesco", sub.parentesco, { attr: "data-gs", max: 60 })}
        ${selector("Puede recoger a", "autorizada.mascota_id", sub.mascota_id, [["", "Todos los perros del dueño"], ...perros.map((m) => [m.id, m.nombre])], { attr: "data-gs", full: true })}
      </div>
      <div class="adm-mt">${boton("+ Agregar persona", "g-add-autorizada", { sm: true })}</div>
    </div>
  </section>`;
}

function dueno(s) {
  const d = s.dueno;
  const nuevo = !d.id;
  const fila = s.duenos.find((x) => x.id === d.id);
  const activo = nuevo || fila?.activo !== false;
  return `
  <div class="adm-row adm-wrapx adm-mb">${boton("← Volver a la lista", "g-volver-lista", { sm: true })}</div>
  ${activo ? "" : nota("info", "Este dueño está <b>desactivado</b>: no aparece en la lista normal, pero su historial se conserva.")}
  ${formDueno(d.form, nuevo, activo)}
  ${nuevo
    ? nota("info", "Guarda primero los datos del dueño para poder agregar sus perros y las personas autorizadas.")
    : seccionPerros(fila) + seccionAutorizadas(s, fila)}`;
}

/* ------------------------------ MASCOTA ------------------------------ */
const fotoHtml = (s) => {
  const nombre = s.mascota.form.nombre || "la mascota";
  return s.fotoUrl
    ? `<img class="adm-photo__img" src="${esc(s.fotoUrl)}" alt="Foto de ${esc(nombre)}" width="120" height="120">`
    : '<div class="adm-photo__empty" aria-hidden="true">🐶</div>';
};

function seccionFoto(s) {
  const m = s.mascota;
  return `
  <div class="adm-photo">
    <div id="g-foto">${fotoHtml(s)}</div>
    <div>
      ${m.id
        ? `<label class="adm-btn adm-btn--ghost adm-btn--sm adm-filebtn">Subir o cambiar foto<input type="file" class="visually-hidden" accept="image/*" data-g-foto></label>
           <small class="adm-block">Se reduce sola antes de subirla.</small>`
        : "<small>Guarda primero al perro para poder subir su foto.</small>"}
    </div>
  </div>`;
}

function formMascota(s) {
  const m = s.mascota;
  const f = m.form;
  const nuevo = !m.id;
  return `
  <section class="adm-card">
    <h2>${nuevo ? "Nuevo perro" : "Datos del perro"}</h2>
    ${seccionFoto(s)}
    <div class="adm-grid">
      ${campo("Nombre", "nombre", f.nombre, { max: 60 })}
      ${campo("Raza", "raza", f.raza, { max: 60 })}
      ${selector("Género", "genero", f.genero, GENEROS)}
      ${campo("Tamaño", "tamano", f.tamano, { max: 30, ph: "Pequeño, mediano, grande...", hint: "Texto libre: las categorías las decide el negocio." })}
      ${campo("Tipo de comida", "tipo_comida", f.tipo_comida, { max: 120, ph: "Concentrado adulto raza mediana..." })}
      ${campo("Comidas al día", "comidas_por_dia", f.comidas_por_dia, { type: "number", min: 1, maxn: 10, inputmode: "numeric" })}
    </div>
    <div class="adm-stack adm-mt">
      ${interruptor("¿Es bravo?", "es_bravo", f.es_bravo)}
      ${f.es_bravo ? campo("Cómo se comporta", "nota_comportamiento", f.nota_comportamiento, { textarea: true, full: true, ph: "Con qué se pone bravo, qué hacer o evitar..." }) : ""}
      ${interruptor("¿Está enfermo?", "esta_enfermo", f.esta_enfermo)}
      ${f.esta_enfermo ? campo("De qué está enfermo", "detalle_enfermedad", f.detalle_enfermedad, { textarea: true, full: true }) : ""}
      ${interruptor("¿Toma medicamentos?", "toma_medicamentos", f.toma_medicamentos)}
    </div>
    <div class="adm-row adm-wrapx adm-mt">
      ${boton("Guardar perro", "g-guardar-mascota", { cls: "adm-btn--primary" })}
      ${nuevo ? "" : m.activa ? boton("Desactivar perro", "g-desactivar-mascota", { cls: "adm-btn--danger" }) : boton("Reactivar perro", "g-reactivar-mascota")}
    </div>
  </section>`;
}

function seccionMedicamentos(s) {
  const m = s.mascota;
  const filas = m.medicamentos.length
    ? m.medicamentos.map((x) => `
      <div class="adm-item${x.activo ? "" : " is-off"}">
        <div class="adm-grow"><b>${esc(x.medicamento)}</b>${x.activo ? "" : ` ${chip("Suspendido", "off")}`}
          <small class="adm-block">${[x.dosis && `Dosis: ${x.dosis}`, x.horario && `Horario: ${x.horario}`, x.fecha_inicio && `Desde ${fechaLegible(x.fecha_inicio)}`, x.fecha_fin && `hasta ${fechaLegible(x.fecha_fin)}`].filter(Boolean).map(esc).join(" · ") || "Sin más detalles"}</small></div>
        ${boton(x.activo ? "Suspender" : "Reanudar", "g-toggle-medicamento", { id: x.id, sm: true })}
        ${boton("Quitar", "g-del-medicamento", { id: x.id, cls: "adm-btn--danger", sm: true })}
      </div>`).join("")
    : (m.form.toma_medicamentos ? nota("info", "Marcaste que toma medicamentos pero aún no hay ninguno anotado. Agrégalo aquí abajo con su dosis y horario.") : "");
  const sub = s.sub.medicamento;
  return `
  <section class="adm-card">
    <h2>💊 Medicamentos</h2>
    ${filas}
    <div class="adm-fieldset">
      <div class="adm-grid">
        ${campo("Medicamento", "medicamento.medicamento", sub.medicamento, { attr: "data-gs", max: 120 })}
        ${campo("Dosis", "medicamento.dosis", sub.dosis, { attr: "data-gs", max: 120, ph: "1 tableta, 5 ml..." })}
        ${campo("Horario", "medicamento.horario", sub.horario, { attr: "data-gs", max: 120, ph: "8:00 a. m. y 8:00 p. m." })}
        ${campo("Desde (opcional)", "medicamento.fecha_inicio", sub.fecha_inicio, { attr: "data-gs", type: "date" })}
        ${campo("Hasta (opcional)", "medicamento.fecha_fin", sub.fecha_fin, { attr: "data-gs", type: "date" })}
      </div>
      <div class="adm-mt">${boton("+ Agregar medicamento", "g-add-medicamento", { sm: true })}</div>
    </div>
  </section>`;
}

function seccionVacunas(s) {
  const m = s.mascota;
  const etiquetas = Object.fromEntries(TIPOS_VACUNA);
  const ordenadas = [...m.vacunas].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  const filas = ordenadas.length
    ? ordenadas.map((v) => `
      <div class="adm-item">
        <div class="adm-grow"><b>${esc(v.nombre)}</b> <small>${esc(etiquetas[v.tipo] ?? v.tipo)}</small>
          ${estadoVencimiento(v.fecha_vencimiento) === "vencida" ? chip("Vencida", "warn") : ""}
          <small class="adm-block">${v.fecha_aplicacion ? `Aplicada ${esc(fechaLegible(v.fecha_aplicacion))} · ` : ""}Vence ${esc(fechaLegible(v.fecha_vencimiento))}</small></div>
        ${boton("Quitar", "g-del-vacuna", { id: v.id, cls: "adm-btn--danger", sm: true })}
      </div>`).join("")
    : '<p class="adm-sub">Aún no hay vacunas ni desparasitaciones anotadas.</p>';
  const sub = s.sub.vacuna;
  return `
  <section class="adm-card">
    <h2>💉 Vacunas y desparasitación</h2>
    <p class="adm-sub">Anota siempre la fecha de vencimiento: con ella se generarán los avisos más adelante.</p>
    ${filas}
    <div class="adm-fieldset">
      <div class="adm-grid">
        ${selector("Tipo", "vacuna.tipo", sub.tipo, TIPOS_VACUNA, { attr: "data-gs" })}
        ${campo("Nombre", "vacuna.nombre", sub.nombre, { attr: "data-gs", max: 100, ph: "Rabia, parvovirus..." })}
        ${campo("Fecha de aplicación (opcional)", "vacuna.fecha_aplicacion", sub.fecha_aplicacion, { attr: "data-gs", type: "date" })}
        ${campo("Fecha de vencimiento", "vacuna.fecha_vencimiento", sub.fecha_vencimiento, { attr: "data-gs", type: "date" })}
      </div>
      <div class="adm-mt">${boton("+ Agregar", "g-add-vacuna", { sm: true })}</div>
    </div>
  </section>`;
}

function mascota(s) {
  const m = s.mascota;
  const fila = s.duenos.find((x) => x.id === s.dueno.id);
  const nuevo = !m.id;
  return `
  <div class="adm-row adm-wrapx adm-mb">${boton(`← Volver a ${esc(fila?.nombre ?? "la ficha")}`, "g-volver-dueno", { sm: true })}</div>
  ${m.id && !m.activa ? nota("info", "Este perro está <b>desactivado</b>: no aparece como activo, pero su historial se conserva.") : ""}
  ${formMascota(s)}
  ${nuevo ? nota("info", "Guarda primero al perro para poder anotar sus vacunas y medicamentos y subir su foto.") : (m.form.toma_medicamentos || m.medicamentos.length ? seccionMedicamentos(s) : "") + seccionVacunas(s)}`;
}

/* ------------------------------ PUNTO DE ENTRADA ------------------------------ */
export const GestionViews = {
  itemsLista,
  fotoHtml,

  render(s) {
    if (s.loading) return '<section class="adm-card"><p class="adm-sub">Cargando…</p></section>';
    if (s.error) return `${AVISOS[s.error] ?? AVISOS.fail}<div>${boton("Reintentar", "g-recargar", { sm: true })}</div>`;
    if (s.isAdmin === false) return `${AVISOS.noadmin}<div>${boton("Reintentar", "g-recargar", { sm: true })}</div>`;
    if (s.vista === "mascota") return mascota(s);
    if (s.vista === "dueno") return dueno(s);
    return lista(s);
  }
};
