/**
 * Vistas de rutas, día operativo y hotel. Todo lo dinámico se escapa; la pantalla
 * solo emite atributos data-r-* para que el controlador atienda eventos por delegación.
 */
import { esc } from "../../utils/dom.js";
import {
  DIAS_COLEGIO, hoyBogota, SENTIDOS, contarOcupacionDia,
  servicioMascotaEnFecha, resumenHotel
} from "../models/rutasModel.js";

const label = (title, field, value, options = {}) => {
  const attr = `data-r-field="${field}"`;
  const control = options.textarea
    ? `<textarea ${attr} rows="2" maxlength="${options.max ?? 1000}">${esc(value)}</textarea>`
    : `<input type="${options.type ?? "text"}" ${attr} value="${esc(value)}"${options.max ? ` maxlength="${options.max}"` : ""}${options.min ? ` min="${options.min}"` : ""}${options.maxValue ? ` max="${options.maxValue}"` : ""}>`;
  return `<label class="adm-f${options.full ? " adm-full" : ""}"><span class="adm-fl">${esc(title)}</span>${control}</label>`;
};

const select = (title, field, value, options, full = false) =>
  `<label class="adm-f${full ? " adm-full" : ""}"><span class="adm-fl">${esc(title)}</span><select data-r-field="${field}">
    ${options.map(([v, text]) => `<option value="${esc(v)}"${String(value) === String(v) ? " selected" : ""}>${esc(text)}</option>`).join("")}
  </select></label>`;

const button = (text, action, attrs = "", cls = "adm-btn--ghost") =>
  `<button class="adm-btn ${cls} adm-btn--sm" type="button" data-action="${action}"${attrs}>${text}</button>`;
const note = (text, type = "info") => `<p class="adm-note adm-note--${type}">${text}</p>`;
const tag = (text, type = "") => `<span class="adm-tag${type ? ` adm-tag--${type}` : ""}">${esc(text)}</span>`;
const ownerDog = (s, id) => s.mascotas.find((m) => m.id === id);
const ownerFor = (s, dog) => s.duenos.find((d) => d.id === dog?.dueno_id);
const dogName = (s, id) => ownerDog(s, id)?.nombre ?? "Perro no disponible";
const dateText = (value) => {
  if (!value) return "Sin fecha";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { dateStyle: "medium" });
};
const nameOptions = (mascotas) => mascotas.filter((m) => m.activa).map((m) => [m.id, m.nombre]);

function tabs(s) {
  return `<div class="adm-tabs" role="tablist" aria-label="Operación de rutas y hotel">
    ${[["hoy", "Hoy"], ["rutas", "Rutas y planes"], ["hotel", "Hotel"]].map(([id, text]) =>
      `<button class="adm-tab" type="button" role="tab" data-action="r-vista" data-view="${id}" aria-selected="${s.vista === id}">${text}</button>`
    ).join("")}
  </div>`;
}

function resumenDelHotel(s, fecha) {
  const resumen = resumenHotel(fecha, s.reservas, s.cuposHotel);
  return `<div class="adm-grid adm-grid--3 adm-r-summary">
    <article class="adm-r-stat"><span>En el hotel</span><b>${resumen.enHotel}</b></article>
    <article class="adm-r-stat"><span>Entradas</span><b>${resumen.entradas}</b></article>
    <article class="adm-r-stat"><span>Salidas</span><b>${resumen.salidas}</b></article>
    <article class="adm-r-stat"><span>Cupos disponibles</span><b>${resumen.disponibles ?? "Sin configurar"}</b></article>
  </div>${resumen.excedido ? note(`Hay ${resumen.enHotel} perros y el cupo está en ${resumen.cupos}. Revisa las reservas antes de aceptar otra.`, "err") : ""}`;
}

function avisoReservasCruzadas(s) {
  const conflictos = s.mascotas
    .filter((mascota) => servicioMascotaEnFecha(mascota, s.fecha, s.planes, s.reservas, s.ausencias).codigo === "conflicto")
    .map((mascota) => mascota.nombre);
  return conflictos.length
    ? note(`Hay reservas superpuestas para ${conflictos.map(esc).join(", ")}. No se incluyen en la ruta diaria hasta corregir las fechas.`, "err")
    : "";
}

function tarjetaParada(s, parada, indice, sentido) {
  const mascota = ownerDog(s, parada.mascota_id);
  const dueno = ownerFor(s, mascota);
  const servicio = servicioMascotaEnFecha(mascota, s.fecha, s.planes, s.reservas, s.ausencias);
  const diario = s.paradasDia.find((fila) => fila.parada_id === parada.id);
  const etiquetaEstado = {
    pendiente: "Pendiente", recogido: "Recogido", entregado: "Entregado", no_se_pudo: "No se pudo"
  }[diario?.estado ?? "pendiente"];
  const estadoRuta = sentido === "recogida" ? "recogido" : "entregado";
  return `<article class="adm-r-stop">
    <span class="adm-r-stop__number">${indice + 1}</span>
    <div class="adm-r-stop__main">
      <b>${esc(mascota?.nombre ?? "Perro no disponible")}</b>
      ${dueno ? `<small>${esc(dueno.nombre)}${dueno.telefono ? ` · ${esc(dueno.telefono)}` : ""}</small>` : ""}
      <small>${esc(parada.direccion)}</small>
      <div class="adm-tags">${parada.hora_estimada ? tag(parada.hora_estimada.slice(0, 5)) : tag("Hora sin definir", "off")}
        ${tag(servicio.codigo === "hotel_colegio" ? "Hotel + colegio" : "Colegio")}
        ${tag(etiquetaEstado, diario?.estado === "no_se_pudo" ? "warn" : diario?.estado && diario.estado !== "pendiente" ? "ok" : "off")}
      </div>
      ${diario?.motivo ? `<small class="adm-r-reason">${esc(diario.motivo)}</small>` : ""}
    </div>
    <div class="adm-r-actions">
      ${button(sentido === "recogida" ? "Recogido" : "Entregado", "r-marcar-parada", ` data-id="${esc(diario?.id ?? "")}" data-estado="${estadoRuta}"`, "adm-btn--primary")}
      ${button("No se pudo", "r-marcar-parada", ` data-id="${esc(diario?.id ?? "")}" data-estado="no_se_pudo"`, "adm-btn--danger")}
      ${diario?.estado !== "pendiente" ? button("Reiniciar", "r-marcar-parada", ` data-id="${esc(diario.id)}" data-estado="pendiente"`) : ""}
      ${button("Falta hoy", "r-registrar-ausencia", ` data-mascota-id="${esc(parada.mascota_id)}"`, "adm-btn--danger")}
    </div>
  </article>`;
}

function panelDia(s) {
  const hotel = resumenDelHotel(s, s.fecha);
  const routes = s.rutas.filter((r) => r.activa);
  const avisoConflictos = avisoReservasCruzadas(s);
  const contenido = routes.length ? routes.map((route) => {
    const porSentido = SENTIDOS.map(([sentido, texto]) => {
      const base = s.paradas.filter((p) => p.ruta_id === route.id && p.sentido === sentido && p.activa)
        .sort((a, b) => a.orden - b.orden);
      const elegibles = base.filter((p) => {
        const perro = ownerDog(s, p.mascota_id);
        const servicio = servicioMascotaEnFecha(perro, s.fecha, s.planes, s.reservas, s.ausencias);
        return servicio.codigo === "colegio" || servicio.codigo === "hotel_colegio";
      });
      const grupos = new Map();
      elegibles.forEach((p) => {
        const localidad = p.localidad || "Localidad sin registrar";
        if (!grupos.has(localidad)) grupos.set(localidad, []);
        grupos.get(localidad).push(p);
      });
      let ordenVisible = 0;
      const filas = [...grupos.entries()].map(([localidad, paradas]) =>
        `<section class="adm-r-locality"><h4>${esc(localidad)}</h4>${paradas.map((p) => tarjetaParada(s, p, ordenVisible++, sentido)).join("")}</section>`
      ).join("");
      const omitidas = base.length - elegibles.length;
      return `<section class="adm-r-direction"><h3>${esc(texto)} <span>${elegibles.length} ${elegibles.length === 1 ? "parada" : "paradas"}</span></h3>
        ${omitidas ? `<small class="adm-sub">${omitidas} parada${omitidas === 1 ? "" : "s"} fuera del recorrido por hotel, ausencia o servicio no programado.</small>` : ""}
        ${filas || '<p class="adm-sub">No hay perros programados en este recorrido para esta fecha.</p>'}
      </section>`;
    }).join("");
    return `<article class="adm-card"><div class="adm-row adm-between"><h2>${esc(route.nombre)}</h2>${route.empleado_id ? tag(s.empleados.find((e) => e.id === route.empleado_id)?.nombre ?? "Empleado asignado") : tag("Sin empleado", "off")}</div>${porSentido}</article>`;
  }).join("") : '<section class="adm-card"><p class="adm-sub">Todavía no hay rutas activas. Crea la primera en “Rutas y planes”.</p></section>';
  const ausencias = s.ausencias.length
    ? `<section class="adm-card"><h2>Ausencias de hoy</h2>${s.ausencias.map((a) => `<div class="adm-item"><div class="adm-grow"><b>${esc(dogName(s, a.mascota_id))}</b>${a.motivo ? `<small>${esc(a.motivo)}</small>` : ""}</div>${button("Quitar ausencia", "r-quitar-ausencia", ` data-id="${esc(a.id)}"`)}</div>`).join("")}</section>`
    : "";
  return `<section class="adm-card">
    <div class="adm-row adm-between adm-wrapx"><div><h2>Ruta del día</h2><p class="adm-sub">La lista conserva el orden manual y agrupa las paradas por localidad.</p></div>
      <label class="adm-f"><span class="adm-fl">Fecha</span><input type="date" data-r-date="fecha" value="${esc(s.fecha)}"></label>
    </div>
    ${hotel}
  </section>${avisoConflictos}${contenido}${ausencias}`;
}

function formularioRuta(s) {
  const f = s.formularios.ruta;
  return `<section class="adm-card"><h2>${f.id ? "Editar ruta" : "Crear ruta"}</h2>
    <div class="adm-grid">
      ${label("Nombre de la ruta", "ruta.nombre", f.nombre, { max: 80 })}
      ${select("Empleado asignado (opcional)", "ruta.empleado_id", f.empleado_id, [["", "Sin asignar"], ...s.empleados.map((e) => [e.id, e.nombre])])}
    </div>
    <div class="adm-row adm-wrapx adm-mt">${button(f.id ? "Guardar ruta" : "Crear ruta", "r-guardar-ruta", "", "adm-btn--primary")}${f.id ? button("Cancelar edición", "r-cancelar-ruta") : ""}</div>
  </section>`;
}

function formularioParada(s) {
  const f = s.formularios.parada;
  const perros = nameOptions(s.mascotas);
  return `<section class="adm-card"><h2>${f.id ? "Editar parada" : "Agregar parada"}</h2>
    ${s.rutas.some((r) => r.activa) && perros.length ? `<div class="adm-grid">
      ${select("Ruta", "parada.ruta_id", f.ruta_id, s.rutas.filter((r) => r.activa).map((r) => [r.id, r.nombre]))}
      ${select("Recorrido", "parada.sentido", f.sentido, SENTIDOS)}
      ${select("Perro", "parada.mascota_id", f.mascota_id, perros)}
      ${label("Localidad", "parada.localidad", f.localidad, { max: 80, ph: "Ej. Usaquén" })}
      ${label("Dirección de la parada", "parada.direccion", f.direccion, { max: 200, ph: "Calle, carrera, número..." })}
      ${label("Hora estimada (opcional)", "parada.hora_estimada", f.hora_estimada, { type: "time" })}
    </div><p class="adm-sub adm-mt">La localidad sirve para agrupar. El orden se organiza a mano; la sugerencia automática queda pendiente de elegir un proveedor de distancias.</p>
    <div class="adm-row adm-wrapx">${button(f.id ? "Guardar parada" : "Agregar parada", "r-guardar-parada", "", "adm-btn--primary")}${f.id ? button("Cancelar edición", "r-cancelar-parada") : ""}</div>`
    : note("Crea una ruta activa y registra al menos un perro antes de agregar paradas.")}</section>`;
}

function formPlan(s) {
  const f = s.formularios.plan;
  return `<section class="adm-card"><h2>Plan de colegio</h2>
    <p class="adm-sub">Los días y el período definen qué perros entran en el cálculo de cada fecha.</p>
    <div class="adm-grid">
      ${select("Perro", "plan.mascota_id", f.mascota_id, nameOptions(s.mascotas))}
      ${label("Desde", "plan.desde", f.desde, { type: "date" })}
      ${label("Hasta (opcional)", "plan.hasta", f.hasta, { type: "date" })}
    </div>
    <fieldset class="adm-fieldset"><legend>Días de colegio</legend><div class="adm-days">
      ${DIAS_COLEGIO.map(([day, name]) => `<label class="adm-chip"><input type="checkbox" data-r-day="${day}"${f.dias_semana.includes(day) ? " checked" : ""}>${name}</label>`).join("")}
    </div></fieldset>
    <div class="adm-mt">${button("Guardar plan", "r-guardar-plan", "", "adm-btn--primary")}</div>
  </section>`;
}

function listaPlanes(s) {
  const planes = [...s.planes].sort((a, b) => b.desde.localeCompare(a.desde));
  if (!planes.length) return '<p class="adm-sub">Todavía no hay planes de colegio.</p>';
  return planes.map((p) => {
    const dias = DIAS_COLEGIO.filter(([day]) => p.dias_semana?.includes(day)).map(([, name]) => name).join(", ");
    return `<div class="adm-item${p.activo ? "" : " is-off"}"><div class="adm-grow"><b>${esc(dogName(s, p.mascota_id))}</b><small>${esc(dias)} · ${dateText(p.desde)}${p.hasta ? ` a ${dateText(p.hasta)}` : " en adelante"}</small></div>${button(p.activo ? "Desactivar" : "Reactivar", "r-toggle-plan", ` data-id="${esc(p.id)}"`)}</div>`;
  }).join("");
}

function agruparParadas(s, route, sentido) {
  const grupos = new Map();
  s.paradas.filter((p) => p.ruta_id === route.id && p.sentido === sentido)
    .sort((a, b) => a.orden - b.orden)
    .forEach((p) => {
      const localidad = p.localidad || "Localidad sin registrar";
      if (!grupos.has(localidad)) grupos.set(localidad, []);
      grupos.get(localidad).push(p);
    });
  return [...grupos.entries()];
}

function listaRutas(s) {
  if (!s.rutas.length) return '<p class="adm-sub">Crea la ruta que hará el recorrido.</p>';
  return s.rutas.map((route) => `<article class="adm-card${route.activa ? "" : " is-off"}">
    <div class="adm-row adm-between adm-wrapx"><div><h2>${esc(route.nombre)} ${route.activa ? "" : tag("Desactivada", "off")}</h2><p class="adm-sub">${esc(s.empleados.find((e) => e.id === route.empleado_id)?.nombre ?? "Sin empleado asignado")}</p></div>
      ${button("Editar", "r-editar-ruta", ` data-id="${esc(route.id)}"`)}${button(route.activa ? "Desactivar" : "Reactivar", "r-toggle-ruta", ` data-id="${esc(route.id)}"`, route.activa ? "adm-btn--danger" : "adm-btn--ghost")}
    </div>
    ${SENTIDOS.map(([sentido, text]) => {
      const grupos = agruparParadas(s, route, sentido);
      const items = grupos.map(([localidad, paradas], groupIndex) => `<section class="adm-r-locality">
        <div class="adm-row adm-between"><h4>${esc(localidad)}</h4><div>${button("↑ localidad", "r-mover-grupo", ` data-route-id="${esc(route.id)}" data-sentido="${sentido}" data-indice="${groupIndex}" data-delta="-1"`)}${button("↓ localidad", "r-mover-grupo", ` data-route-id="${esc(route.id)}" data-sentido="${sentido}" data-indice="${groupIndex}" data-delta="1"`)}</div></div>
        ${paradas.map((p, stopIndex) => `<div class="adm-item${p.activa ? "" : " is-off"}">
          <b class="adm-r-order">${p.orden}</b><div class="adm-grow"><b>${esc(dogName(s, p.mascota_id))}</b><small>${esc(p.direccion)}${p.hora_estimada ? ` · ${esc(p.hora_estimada.slice(0, 5))}` : ""}</small>${p.activa ? "" : tag("Inactiva", "off")}</div>
          ${button("Editar", "r-editar-parada", ` data-id="${esc(p.id)}"`)}${button("↑", "r-mover-parada", ` data-id="${esc(p.id)}" data-route-id="${esc(route.id)}" data-sentido="${sentido}" data-indice="${stopIndex}" data-delta="-1"`)}${button("↓", "r-mover-parada", ` data-id="${esc(p.id)}" data-route-id="${esc(route.id)}" data-sentido="${sentido}" data-indice="${stopIndex}" data-delta="1"`)}
          ${button(p.activa ? "Desactivar" : "Reactivar", "r-toggle-parada", ` data-id="${esc(p.id)}"`, p.activa ? "adm-btn--danger" : "adm-btn--ghost")}
        </div>`).join("")}
      </section>`).join("");
      return `<section class="adm-r-direction"><h3>${esc(text)}</h3>${items || '<p class="adm-sub">Sin paradas.</p>'}</section>`;
    }).join("")}
  </article>`).join("");
}

function panelRutas(s) {
  return `${formularioRuta(s)}${formularioParada(s)}${listaRutas(s)}
    ${formPlan(s)}
    <section class="adm-card"><h2>Planes registrados</h2>${listaPlanes(s)}</section>`;
}

function formularioReserva(s) {
  const f = s.formularios.reserva;
  const perros = nameOptions(s.mascotas);
  return `<section class="adm-card"><h2>${f.id ? "Editar reserva" : "Nueva reserva"}</h2>
    ${perros.length ? `<div class="adm-grid">
      ${select("Perro", "reserva.mascota_id", f.mascota_id, perros)}
      ${label("Entrada", "reserva.entrada", f.entrada, { type: "date" })}
      ${label("Salida", "reserva.salida", f.salida, { type: "date" })}
      ${label("Notas de comida", "reserva.notas_comida", f.notas_comida, { textarea: true })}
      ${label("Notas de medicación", "reserva.notas_medicacion", f.notas_medicacion, { textarea: true })}
      ${label("Otras notas", "reserva.notas", f.notas, { textarea: true })}
    </div><label class="adm-inline adm-mt"><input type="checkbox" data-r-field="reserva.tambien_colegio"${f.tambien_colegio ? " checked" : ""}> Hotel + colegio (si también tiene plan de colegio ese día)</label>
    <p class="adm-sub adm-mt">La noche de entrada cuenta; la fecha de salida no ocupa cupo. La capacidad se valida por noche al guardar.</p>
    <div class="adm-row adm-wrapx">${button(f.id ? "Guardar cambios" : "Crear reserva", "r-guardar-reserva", "", "adm-btn--primary")}${f.id ? button("Cancelar edición", "r-cancelar-reserva") : ""}</div>`
    : note("Registra primero una mascota activa para poder reservar.")}</section>`;
}

function calendario(s) {
  const [year, month] = s.mes.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const dayNames = ["L", "M", "M", "J", "V", "S", "D"];
  return `<div class="adm-r-calendar">${dayNames.map((day) => `<b>${day}</b>`).join("")}${cells.map((day) => {
    if (!day) return '<span class="adm-r-calendar__empty"></span>';
    const date = `${s.mes}-${String(day).padStart(2, "0")}`;
    const count = contarOcupacionDia(date, s.reservas);
    return `<button type="button" data-action="r-seleccionar-dia" data-fecha="${date}" class="${count >= (s.cuposHotel ?? Infinity) ? "is-full" : ""}" aria-label="${date}: ${count} perros">
      <span>${day}</span><small>${count}</small>
    </button>`;
  }).join("")}</div>`;
}

function listaReservas(s) {
  if (!s.reservas.length) return '<p class="adm-sub">No hay reservas en este mes.</p>';
  return [...s.reservas].sort((a, b) => a.entrada.localeCompare(b.entrada)).map((r) => `<article class="adm-r-booking">
    <div class="adm-grow"><b>${esc(dogName(s, r.mascota_id))}</b>${tag(r.estado.replace("_", " "))}
      <small>${dateText(r.entrada)} → ${dateText(r.salida)} · ${r.tambien_colegio ? "Hotel + colegio" : "Solo hotel"}</small>
      ${r.notas_comida ? `<small>Comida: ${esc(r.notas_comida)}</small>` : ""}
      ${r.notas_medicacion ? `<small>Medicación: ${esc(r.notas_medicacion)}</small>` : ""}
      ${r.notas ? `<small>${esc(r.notas)}</small>` : ""}
    </div>
    ${r.estado !== "cancelada" ? button("Editar", "r-editar-reserva", ` data-id="${esc(r.id)}"`): ""}
    ${r.estado === "reservada" ? button("Marcar entrada", "r-estado-reserva", ` data-id="${esc(r.id)}" data-estado="en_curso"`, "adm-btn--primary") : ""}
    ${r.estado === "en_curso" && hoyBogota() >= r.salida ? button("Marcar salida", "r-estado-reserva", ` data-id="${esc(r.id)}" data-estado="finalizada"`, "adm-btn--primary") : ""}
    ${r.estado === "en_curso" && hoyBogota() < r.salida ? `<small>La salida está programada para ${dateText(r.salida)}.</small>` : ""}
    ${!["cancelada", "finalizada"].includes(r.estado) ? button("Cancelar", "r-estado-reserva", ` data-id="${esc(r.id)}" data-estado="cancelada"`, "adm-btn--danger") : ""}
  </article>`).join("");
}

function panelHotel(s) {
  return `<section class="adm-card">
    <div class="adm-row adm-between adm-wrapx"><div><h2>Ocupación del hotel</h2><p class="adm-sub">Cupos por noche; la salida no ocupa una noche adicional.</p></div>
      <label class="adm-f"><span class="adm-fl">Mes</span><input type="month" data-r-date="mes" value="${esc(s.mes)}"></label>
    </div>
    <div class="adm-r-capacity"><form data-r-form="cupos"><label class="adm-f"><span class="adm-fl">Cupos totales del hotel</span><input type="number" min="1" max="32767" data-r-field="cupos" value="${esc(s.formularios.cupos)}"></label>${button("Guardar cupo", "r-guardar-cupos", "", "adm-btn--primary")}</form>
      ${s.cuposHotel == null ? note("El cupo aún no está configurado. No se podrán guardar reservas hasta definirlo.", "err") : note(`Capacidad configurada: <b>${s.cuposHotel}</b> perros.`)}
    </div>
    <div class="adm-r-month">${calendario(s)}</div>
  </section>
  <section class="adm-card adm-r-month-summary"><h2>Resumen para ${dateText(s.fecha)}</h2>${resumenDelHotel(s, s.fecha)}</section>
  ${avisoReservasCruzadas(s)}
  ${formularioReserva(s)}
  <section class="adm-card"><h2>Reservas de ${esc(s.mes)}</h2>${listaReservas(s)}</section>`;
}

export const RutasViews = {
  render(s) {
    if (s.loading) return '<section class="adm-card"><p class="adm-sub">Cargando rutas y reservas…</p></section>';
    if (s.error) return `${note(s.error === "missing" ? "Faltan las tablas de la Fase 1 en Supabase. Revisa supabase/README.md." : "No se pudieron cargar las rutas. Revisa conexión y permisos, y vuelve a intentar.", "err")}${button("Reintentar", "r-recargar")}`;
    if (s.isAdmin === false) return note("Esta sección solo está disponible para una cuenta admin.", "err");
    const content = s.vista === "rutas" ? panelRutas(s) : s.vista === "hotel" ? panelHotel(s) : panelDia(s);
    return `${tabs(s)}${content}`;
  }
};
