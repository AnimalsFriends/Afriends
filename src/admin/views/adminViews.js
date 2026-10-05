/**
 * VISTAS del panel: funciones puras que devuelven HTML escapado.
 * Sin estilos ni manejadores de eventos en línea (compatible con la CSP).
 */
import { esc } from "../../utils/dom.js";
import { formatMoney } from "../../utils/format.js";
import { DIAS, formatPhone, leadWhatsapp } from "../models/siteDraft.js";

const field = (label, path, value, o = {}) => {
  const attrs = `data-path="${path}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ""}${o.min != null ? ` min="${o.min}"` : ""}`;
  const control = o.textarea
    ? `<textarea ${attrs} rows="2">${esc(value)}</textarea>`
    : `<input type="${o.type || "text"}" ${attrs} value="${esc(value)}"${o.cls ? ` class="${o.cls}"` : ""}>`;
  return `<label class="adm-f${o.full ? " adm-full" : ""}"><span class="adm-fl">${label}</span>${control}${o.hint ? `<small>${o.hint}</small>` : ""}</label>`;
};

const toggle = (path, checked, label) =>
  `<label class="adm-sw"><input type="checkbox" data-path="${path}" data-rerender="1"${checked ? " checked" : ""} aria-label="${esc(label)}"><span></span></label>`;

export const AdminViews = {
  /* ------------------------------ NEGOCIO ------------------------------ */
  business(data) {
    const n = data.negocio;
    return `
    <section class="adm-card">
      <h2>📞 Datos de contacto</h2>
      <p class="adm-sub">Aparecen en el pie de página. Si dejas un dato vacío, simplemente no se muestra.</p>
      <div class="adm-grid">
        ${field("Número de WhatsApp (recibe los pedidos)", "negocio.whatsapp", n.whatsapp, { type: "tel", ph: "573123044174", hint: "Solo números, con el código del país y sin el +. Colombia: 57 y luego tu número." })}
        ${field("Cómo se ve el teléfono en la página", "negocio.telefonoVisible", n.telefonoVisible, { ph: "+57 312 3044174" })}
        ${field("Correo electrónico", "negocio.correo", n.correo, { type: "email", ph: "hola@tunegocio.com" })}
        ${field("Dirección", "negocio.direccion", n.direccion, { ph: "Calle 123 # 45-67, Barrio" })}
        ${field("Ciudad", "negocio.ciudad", n.ciudad, { ph: "Bogotá", hint: "Ayuda a que Google te encuentre." })}
        ${field("Ubicación visible en el pie de página", "negocio.ubicacionVisible", n.ubicacionVisible, { ph: "Bogotá, Colombia" })}
      </div>
    </section>

    <section class="adm-card">
      <h2>⚖️ Datos legales</h2>
      <p class="adm-sub">Se usan en el Aviso legal y la Política de privacidad. Mientras falten, esas páginas muestran avisos amarillos "[Completar...]".</p>
      <div class="adm-grid">
        ${field("Nombre completo o razón social del titular", "negocio.razonSocial", n.razonSocial, { ph: "Animal Friends S.A.S." })}
        ${field("NIT o cédula", "negocio.nit", n.nit, { ph: "901.234.567-8" })}
      </div>
    </section>

    <section class="adm-card">
      <h2>🕒 Horarios de atención</h2>
      <p class="adm-sub">Cada línea aparece como un renglón en el pie de página.</p>
      ${n.horarios.map((h, i) => `
        <div class="adm-item">
          <input type="text" data-path="negocio.horarios.${i}" value="${esc(h)}" placeholder="Lunes a Sábado: 8:00 AM – 6:00 PM" aria-label="Horario ${i + 1}">
          <button class="adm-btn adm-btn--danger adm-btn--sm" type="button" data-action="del-horario" data-i="${i}" aria-label="Quitar horario ${i + 1}">✕</button>
        </div>`).join("")}
      <button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-action="add-horario">+ Agregar horario</button>
    </section>

    <section class="adm-card">
      <h2>🔗 Redes sociales y Google</h2>
      <p class="adm-sub">Pega el enlace completo (empieza por https://). Si lo dejas vacío no se muestra.</p>
      <div class="adm-grid adm-grid--3">
        ${field("Instagram", "negocio.redes.instagram", n.redes.instagram, { type: "url", ph: "https://www.instagram.com/..." })}
        ${field("Facebook", "negocio.redes.facebook", n.redes.facebook, { type: "url", ph: "https://www.facebook.com/..." })}
        ${field("TikTok", "negocio.redes.tiktok", n.redes.tiktok, { type: "url", ph: "https://www.tiktok.com/@..." })}
      </div>
      <div class="adm-grid adm-mt">
        ${field("Perfil de Google Maps (opcional)", "negocio.perfilGoogle", n.perfilGoogle, { type: "url", ph: "https://maps.app.goo.gl/...", hint: "Ayuda a aparecer en Google Maps." })}
        ${field("Texto del pie de página", "negocio.descripcionFooter", n.descripcionFooter, { textarea: true })}
      </div>
    </section>

    <section class="adm-card">
      <h2>💬 Mensaje que llega a WhatsApp</h2>
      <p class="adm-sub">El mensaje se arma solo con el nombre del cliente, su mascota, los servicios y el total. Aquí editas el saludo y el cierre.</p>
      <div class="adm-grid">
        ${field("Saludo", "negocio.mensajeWhatsApp.saludo", n.mensajeWhatsApp.saludo, { textarea: true })}
        ${field("Cierre", "negocio.mensajeWhatsApp.cierre", n.mensajeWhatsApp.cierre, { textarea: true })}
      </div>
    </section>`;
  },

  /* ------------------------------ SERVICIOS ------------------------------ */
  service(c, ci, s, si) {
    const p = `categorias.${ci}.servicios.${si}`;
    return `
    <div class="adm-svc${s.activo ? "" : " is-off"}">
      <div class="adm-svc__main">
        ${toggle(`${p}.activo`, s.activo, `Mostrar el servicio ${s.nombre}`)}
        <input type="text" data-path="${p}.nombre" value="${esc(s.nombre)}" placeholder="Nombre del servicio" aria-label="Nombre del servicio">
        <div class="adm-money"><b aria-hidden="true">$</b><input type="number" class="adm-price" data-path="${p}.precio" value="${esc(s.precio)}" min="0" step="500" inputmode="numeric" aria-label="Precio de ${esc(s.nombre)}"><span class="adm-pf">${formatMoney(s.precio, "COP")}${c.unidadPrecio ? ` ${esc(c.unidadPrecio)}` : ""}</span></div>
        <div class="adm-acts">
          <button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-action="up-svc" data-c="${ci}" data-i="${si}" aria-label="Subir servicio">↑</button>
          <button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-action="down-svc" data-c="${ci}" data-i="${si}" aria-label="Bajar servicio">↓</button>
          <button class="adm-btn adm-btn--danger adm-btn--sm" type="button" data-action="del-svc" data-c="${ci}" data-i="${si}" aria-label="Eliminar servicio">🗑</button>
        </div>
      </div>
      <details class="adm-more"><summary>Más opciones</summary>
        <div class="adm-grid">
          ${field("Descripción corta (opcional)", `${p}.descripcion`, s.descripcion || "", { ph: "Ej. Incluye secado" })}
          ${field("Cómo aparece en el mensaje de WhatsApp (opcional)", `${p}.nombreMensaje`, s.nombreMensaje || "", { ph: "Si lo dejas vacío usa el nombre" })}
        </div>
      </details>
    </div>`;
  },

  category(c, ci, open) {
    const t = c.tarjeta;
    const activos = c.servicios.filter((s) => s.activo).length;
    let extra = "";
    if (c.tipo === "porDias") {
      const sel = c.dias || [];
      extra = `
        <div class="adm-grid">
          ${field("Texto junto al precio", `categorias.${ci}.unidadPrecio`, c.unidadPrecio || "", { ph: "por día" })}
          ${field("Pregunta que ve el cliente", `categorias.${ci}.preguntaDias`, c.preguntaDias || "", { ph: "¿Qué días requiere?" })}
        </div>
        <fieldset class="adm-fieldset"><legend>Días disponibles para elegir</legend>
          <div class="adm-days">${DIAS.map((d) => `<label class="adm-chip"><input type="checkbox" data-dia="${d}" data-c="${ci}"${sel.includes(d) ? " checked" : ""}> ${d}</label>`).join("")}</div>
        </fieldset>`;
    } else if (c.tipo === "porNoches") {
      extra = `
        <div class="adm-grid">
          ${field("Texto junto al precio", `categorias.${ci}.unidadPrecio`, c.unidadPrecio || "", { ph: "por noche" })}
          ${field("Máximo de noches", `categorias.${ci}.maxNoches`, c.maxNoches || 30, { type: "number", min: 1 })}
          ${field("Pregunta que ve el cliente", `categorias.${ci}.textoNoches`, c.textoNoches || "", { ph: "Número de noches:" })}
          ${field("Nota informativa", `categorias.${ci}.notaNoches`, c.notaNoches || "", { textarea: true })}
        </div>`;
    }

    const head = `
      <div class="adm-cat__head">
        <button type="button" class="adm-cat__toggle" data-action="toggle-open" data-id="${esc(c.id)}" aria-expanded="${open}">
          <span class="adm-cat__ic" aria-hidden="true">${esc(t.icono)}</span>
          <span class="adm-cat__title"><b>${esc(t.titulo || "(sin título)")}</b><small>${c.activa ? "Visible en la página" : "Oculta"} · ${activos} de ${c.servicios.length} servicios activos</small></span>
          <span aria-hidden="true">${open ? "▲" : "▼"}</span>
        </button>
        <span class="adm-row">
          ${toggle(`categorias.${ci}.activa`, c.activa, `Mostrar la categoría ${t.titulo}`)}
          <button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-action="up-cat" data-c="${ci}" aria-label="Subir categoría">↑</button>
          <button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-action="down-cat" data-c="${ci}" aria-label="Bajar categoría">↓</button>
        </span>
      </div>`;

    const body = !open ? "" : `
      <div class="adm-cat__body">
        <h3 class="adm-sec">Servicios y precios</h3>
        ${c.servicios.map((s, si) => AdminViews.service(c, ci, s, si)).join("") || '<p class="adm-sub">Aún no hay servicios en esta categoría.</p>'}
        <button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-action="add-svc" data-c="${ci}">+ Agregar servicio</button>

        <h3 class="adm-sec">Cómo se calcula el precio</h3>
        <label class="adm-f"><span class="adm-fl">Tipo</span>
          <select data-path="categorias.${ci}.tipo" data-rerender="1">
            <option value="normal"${c.tipo === "normal" ? " selected" : ""}>Precio fijo por servicio</option>
            <option value="porDias"${c.tipo === "porDias" ? " selected" : ""}>Por días (el cliente marca los días)</option>
            <option value="porNoches"${c.tipo === "porNoches" ? " selected" : ""}>Por noches (el cliente escribe cuántas)</option>
          </select>
        </label>
        ${extra}

        <h3 class="adm-sec">Tarjeta en "Nuestros servicios"</h3>
        <div class="adm-grid">
          ${field("Ícono (un emoji)", `categorias.${ci}.tarjeta.icono`, t.icono, { ph: "🐾" })}
          ${field("Título", `categorias.${ci}.tarjeta.titulo`, t.titulo, { ph: "Baños para Perros" })}
          ${field("Descripción", `categorias.${ci}.tarjeta.descripcion`, t.descripcion, { textarea: true, full: true })}
        </div>
        <span class="adm-fl adm-mt">Lista de beneficios de la tarjeta</span>
        ${t.puntos.map((p, pi) => `
          <div class="adm-punto">
            <input type="text" data-path="categorias.${ci}.tarjeta.puntos.${pi}.texto" value="${esc(p.texto)}" placeholder="Beneficio" aria-label="Beneficio ${pi + 1}">
            <label class="adm-inline"><input type="checkbox" data-path="categorias.${ci}.tarjeta.puntos.${pi}.destacado"${p.destacado ? " checked" : ""}> Resaltar</label>
            <button class="adm-btn adm-btn--danger adm-btn--sm" type="button" data-action="del-punto" data-c="${ci}" data-i="${pi}" aria-label="Quitar beneficio ${pi + 1}">✕</button>
          </div>`).join("")}
        <button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-action="add-punto" data-c="${ci}">+ Agregar beneficio</button>

        <h3 class="adm-sec">Pestaña y panel del cotizador</h3>
        <div class="adm-grid">
          ${field("Nombre de la pestaña", `categorias.${ci}.pestana`, c.pestana || "", { ph: "🛁 Baños Perros" })}
          ${field("Título del panel", `categorias.${ci}.tituloPanel`, c.tituloPanel || "", { ph: "Baños para Perros" })}
          ${field("Texto de ayuda del panel", `categorias.${ci}.descripcionPanel`, c.descripcionPanel || "", { textarea: true, full: true })}
        </div>
        <div class="adm-right"><button class="adm-btn adm-btn--danger adm-btn--sm" type="button" data-action="del-cat" data-c="${ci}">Eliminar toda esta categoría</button></div>
      </div>`;

    return `<div class="adm-cat${c.activa ? "" : " is-off"}">${head}${body}</div>`;
  },

  services(data, openCat) {
    return `
    <section class="adm-card">
      <h2>🛁 Servicios y tarjetas</h2>
      <p class="adm-sub">Toca una categoría para editarla. El interruptor verde la muestra u oculta en la página. Con ↑ ↓ cambias el orden.</p>
      ${data.categorias.map((c, ci) => AdminViews.category(c, ci, openCat === c.id)).join("")}
      <button class="adm-btn adm-btn--primary" type="button" data-action="add-cat">+ Agregar nueva categoría</button>
    </section>`;
  },

  /* ------------------------------ MENSAJES RECIBIDOS ------------------------------ */
  leads({ leads, filter, titles, error }) {
    const count = (estado) => leads.filter((l) => l.estado === estado).length;
    const chips = [["todos", "Todos", leads.length], ["nuevo", "Nuevos", count("nuevo")], ["contactado", "Contactados", count("contactado")], ["cerrado", "Cerrados", count("cerrado")]]
      .map(([id, label, n]) => `<button type="button" class="adm-filter${filter === id ? " is-active" : ""}" data-action="lead-filter" data-filter="${id}" aria-pressed="${filter === id}">${label} (${n})</button>`).join("");

    let body;
    if (error === "perm") body = '<p class="adm-note adm-note--err">Este usuario no tiene permiso para ver los mensajes. El correo debe ser idéntico al que se puso en <code>02_contact_requests.sql</code>.</p>';
    else if (error === "missing") body = '<p class="adm-note adm-note--info">Aún no existe la tabla de mensajes. Ejecuta <code>supabase/02_contact_requests.sql</code> en Supabase.</p>';
    else if (error) body = '<p class="adm-note adm-note--err">No se pudieron cargar los mensajes. Revisa tu conexión e inténtalo de nuevo.</p>';
    else {
      const shown = leads.filter((l) => filter === "todos" || l.estado === filter);
      body = shown.length ? shown.map((l) => AdminViews.lead(l, titles)).join("") : '<p class="adm-sub">No hay mensajes en esta vista.</p>';
    }

    return `
    <section class="adm-card">
      <div class="adm-row adm-between">
        <div><h2>📬 Mensajes recibidos</h2><p class="adm-sub">Personas que llenaron el formulario de la página (últimos 200).</p></div>
        <button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-action="leads-refresh">Actualizar</button>
      </div>
      <div class="adm-filters" role="group" aria-label="Filtrar mensajes">${chips}</div>
      ${body}
    </section>`;
  },

  lead(l, titles) {
    const wa = leadWhatsapp(l.telefono);
    const date = new Date(l.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
    const service = l.servicio ? (titles[l.servicio] || (l.servicio === "otro" ? "Otro / no está seguro" : l.servicio)) : "";
    const estados = [["nuevo", "Nuevo"], ["contactado", "Contactado"], ["cerrado", "Cerrado"]];
    return `
    <article class="adm-lead adm-lead--${esc(l.estado)}">
      <header class="adm-lead__head"><b>${esc(l.nombre)}</b><time datetime="${esc(l.created_at)}">${esc(date)}</time></header>
      <p class="adm-lead__meta">
        <a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener noreferrer">📞 ${esc(formatPhone(l.telefono))} · escribir por WhatsApp</a>
        ${l.correo ? ` · <a href="mailto:${esc(l.correo)}">${esc(l.correo)}</a>` : ""}
        ${l.mascota ? ` · 🐾 ${esc(l.mascota)}` : ""}${service ? ` · ${esc(service)}` : ""}
      </p>
      ${l.mensaje ? `<p class="adm-lead__msg">${esc(l.mensaje)}</p>` : ""}
      <label class="adm-lead__state"><span>Estado</span>
        <select data-lead-status data-id="${esc(l.id)}" aria-label="Estado del mensaje de ${esc(l.nombre)}">
          ${estados.map(([v, t]) => `<option value="${v}"${l.estado === v ? " selected" : ""}>${t}</option>`).join("")}
        </select>
      </label>
    </article>`;
  }
};
