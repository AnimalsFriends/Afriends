/**
 * Vistas de agenda y planeación. Las fichas pueden mostrar datos personales;
 * por eso todos los valores que vienen de Supabase pasan por esc() antes del HTML.
 */
import { esc } from "../../utils/dom.js";
import { whatsappUrl } from "../../utils/whatsapp.js";
import { normalizarTelefono } from "../models/gestionModel.js";
import {
  ESTADOS_CITA, VISTAS_AGENDA, conflictosCita, diasEntre, fechaBogotaDeISO,
  fechaHoraBogotaAUTC, fechaHoraBogotaDeISO, fechaMas, planificarRutas, rangoAgenda, validarCita
} from "../models/agendaModel.js";

const button = (text, action, attrs = "", cls = "adm-btn--ghost") =>
  `<button class="adm-btn ${cls} adm-btn--sm" type="button" data-action="${action}"${attrs}>${text}</button>`;
const note = (text, type = "info") => `<p class="adm-note adm-note--${type}">${text}</p>`;
const tag = (text, type = "") => `<span class="adm-tag${type ? ` adm-tag--${type}` : ""}">${esc(text)}</span>`;
const persona = (s, id) => s.mascotas.find((row) => row.id === id);
const fechaTexto = (fecha, options = { weekday: "long", day: "numeric", month: "long" }) =>
  new Date(`${fecha}T12:00:00-05:00`).toLocaleDateString("es-CO", { ...options, timeZone: "America/Bogota" });
const horaTexto = (valor) => new Date(valor).toLocaleTimeString("es-CO", {
  timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});
const inRange = (cita, inicio, fin) =>
  Date.parse(cita.inicio) < Date.parse(fin) && Date.parse(cita.fin) > Date.parse(inicio);

function selectorVista(s) {
  return `<div class="adm-tabs" role="tablist" aria-label="Vistas de la agenda">
    ${VISTAS_AGENDA.map(([id, texto]) => `<button class="adm-tab" type="button" role="tab"
      data-action="agenda-vista" data-view="${id}" aria-selected="${s.vista === id}">${texto}</button>`).join("")}
  </div>`;
}

function navegacion(s) {
  const anterior = s.vista === "dia" ? "Día anterior" : s.vista === "semana" ? "Semana anterior" : "Mes anterior";
  const siguiente = s.vista === "dia" ? "Día siguiente" : s.vista === "semana" ? "Semana siguiente" : "Mes siguiente";
  return `<div class="adm-row adm-between adm-wrapx adm-agenda-nav">
    <div class="adm-row">${button("←", "agenda-mover", ` data-delta="-1" aria-label="${anterior}"`, "adm-btn--ghost")}
      ${button("Hoy", "agenda-hoy", "", "adm-btn--primary")}${button("→", "agenda-mover", ` data-delta="1" aria-label="${siguiente}"`, "adm-btn--ghost")}
    </div>
    <label class="adm-f"><span class="adm-fl">Fecha de referencia</span><input type="date" data-agenda-date value="${esc(s.fecha)}"></label>
  </div>`;
}

function citaEnlaceWhatsapp(s, cita) {
  const mascota = persona(s, cita.mascota_id);
  const dueno = s.duenos.find((row) => row.id === mascota?.dueno_id);
  const servicio = s.servicios.find((row) => row.codigo === cita.servicio_codigo);
  const telefono = normalizarTelefono(dueno?.telefono);
  if (!telefono) return "";
  const mensaje = `Hola ${dueno.nombre}, te escribimos para confirmar o recordar la cita de ${mascota?.nombre ?? "tu perro"} (${servicio?.nombre ?? "servicio"}) para el ${fechaTexto(fechaBogotaDeISO(cita.inicio))} a las ${horaTexto(cita.inicio)}. ¿Nos confirmas, por favor?`;
  const url = whatsappUrl(telefono, mensaje);
  return url ? `<a class="adm-btn adm-btn--ghost adm-btn--sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Confirmar / recordar por WhatsApp</a>` : "";
}

function avisoChoques(cita, s) {
  const conflictos = conflictosCita(cita, s.citas);
  if (!conflictos.length) return "";
  const causas = new Set(conflictos.flatMap(({ tipos }) => tipos));
  const texto = [];
  if (causas.has("empleado")) texto.push("el empleado ya tiene otra cita");
  if (causas.has("mascota")) texto.push("el perro ya tiene otra cita");
  return note(`Atención: ${texto.join(" y ")} en este horario. Puedes revisar la agenda antes de guardar.`, "err");
}

function tarjetaCita(s, cita, compacta = false) {
  const mascota = persona(s, cita.mascota_id);
  const dueno = s.duenos.find((row) => row.id === mascota?.dueno_id);
  const empleado = s.empleados.find((row) => row.id === cita.empleado_id);
  const servicio = s.servicios.find((row) => row.codigo === cita.servicio_codigo);
  const estado = ESTADOS_CITA.find(([value]) => value === cita.estado)?.[1] ?? cita.estado;
  const choqueCorto = compacta && conflictosCita(cita, s.citas).length ? tag("Choque", "warn") : "";
  return `<article class="adm-agenda-event${compacta ? " adm-agenda-event--compact" : ""}${cita.estado === "cancelado" ? " is-off" : ""}">
    <div class="adm-row adm-between adm-wrapx"><b>${esc(mascota?.nombre ?? "Perro no disponible")}</b>${tag(estado, cita.estado === "listo" ? "ok" : cita.estado === "cancelado" ? "off" : "warn")}${choqueCorto}</div>
    <small>${esc(servicio?.nombre ?? "Servicio no disponible")} · ${esc(horaTexto(cita.inicio))}–${esc(horaTexto(cita.fin))}</small>
    ${!compacta ? `<small>${esc(dueno?.nombre ?? "Dueño no disponible")}${empleado ? ` · ${esc(empleado.nombre)}` : " · Sin empleado"}</small>
      ${cita.notas ? `<small>${esc(cita.notas)}</small>` : ""}
      ${avisoChoques(cita, s)}
      <div class="adm-row adm-wrapx">
        <label class="adm-f adm-agenda-status"><span class="visually-hidden">Estado de la cita de ${esc(mascota?.nombre ?? "perro")}</span>
          <select data-agenda-status data-id="${esc(cita.id)}">${ESTADOS_CITA.map(([value, label]) => `<option value="${value}"${cita.estado === value ? " selected" : ""}>${label}</option>`).join("")}</select>
        </label>
        ${citaEnlaceWhatsapp(s, cita)}
        ${button("Editar", "agenda-editar-cita", ` data-id="${esc(cita.id)}"`)}
      </div>` : ""}
  </article>`;
}

function reservaEnDia(s, reserva, fecha) {
  if (reserva.estado === "cancelada" || !(reserva.entrada <= fecha && fecha < reserva.salida)) return "";
  const mascota = persona(s, reserva.mascota_id);
  return `<div class="adm-agenda-hotel"><b>Hotel · ${esc(mascota?.nombre ?? "Perro no disponible")}</b>
    <small>${esc(fechaTexto(reserva.entrada, { day: "numeric", month: "short" }))} → ${esc(fechaTexto(reserva.salida, { day: "numeric", month: "short" }))}</small></div>`;
}

function planDiario(s) {
  const plan = planificarRutas(s.fecha, s.rutas, s.paradas, s.mascotas, s.planes, s.reservas, s.ausencias);
  const resumenPersonal = plan.totalEmpleados === null
    ? "Falta asignar todos los perros a una ruta activa y configurar su capacidad; no calculo una cantidad estimada de empleados."
    : `Se requieren ${plan.totalEmpleados} ${plan.totalEmpleados === 1 ? "empleado" : "empleados"}; faltan ${plan.empleadosFaltantes} por asignar.`;
  const detalles = plan.rutas.map((item) => `<li><b>${esc(item.ruta.nombre)}</b>: ${item.perros} por recoger ·
    capacidad ${item.capacidad ?? "sin configurar"} por empleado ·
    ${item.necesarios == null ? "falta capacidad" : `${item.necesarios} requeridos, ${item.asignados} asignado${item.asignados === 1 ? "" : "s"}`}</li>`).join("");
  const repetidos = plan.perrosEnVariasRutas.map((id) => persona(s, id)?.nombre ?? "Perro no disponible");
  const sinRuta = plan.perrosSinRuta.map((id) => persona(s, id)?.nombre ?? "Perro no disponible");
  return `<section class="adm-card adm-agenda-plan"><h2>Planeación de recogidas · ${esc(fechaTexto(s.fecha))}</h2>
    <p>Hoy hay <b>${plan.totalPerros}</b> ${plan.totalPerros === 1 ? "perro" : "perros"} por recoger. ${esc(resumenPersonal)}</p>
    ${sinRuta.length ? note(`No tienen recogida asignada en una ruta activa: ${sinRuta.map(esc).join(", ")}.`, "err") : ""}
    ${repetidos.length ? note(`Revisa estas paradas duplicadas en más de una ruta: ${repetidos.map(esc).join(", ")}.`, "err") : ""}
    ${detalles ? `<ul>${detalles}</ul>` : note("No hay rutas activas con paradas para recoger.")}</section>`;
}

function eventosDia(s, fecha, compacta = false) {
  const inicio = `${fecha}T05:00:00.000Z`;
  const fin = `${fechaMas(fecha, 1)}T05:00:00.000Z`;
  const citas = s.citas.filter((cita) => inRange(cita, inicio, fin)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const reservas = s.reservas.map((reserva) => reservaEnDia(s, reserva, fecha)).filter(Boolean);
  return `${reservas.join("")}${citas.map((cita) => tarjetaCita(s, cita, compacta)).join("")}`;
}

function vistaDia(s) {
  const resultado = s.formularios.cita.id
    ? { errors: [], clean: { ...s.formularios.cita, inicio: fechaHoraBogotaAUTC(s.formularios.cita.inicio), fin: fechaHoraBogotaAUTC(s.formularios.cita.fin) } }
    : validarCita(s.formularios.cita);
  const alerta = resultado.clean.inicio && resultado.clean.fin
    ? avisoChoques({ ...resultado.clean, id: s.formularios.cita.id }, s)
    : "";
  return `<section class="adm-card"><h2>${esc(fechaTexto(s.fecha))}</h2>
    ${eventosDia(s, s.fecha) || note("No hay citas ni reservas de hotel para esta fecha.")}</section>
    ${formularioCita(s, alerta)}
    ${planDiario(s)}`;
}

function vistaSemana(s) {
  const rango = rangoAgenda(s.fecha, "semana");
  const dias = diasEntre(rango.inicio, rango.fin);
  return `<section class="adm-card"><h2>Semana del ${esc(fechaTexto(rango.inicio))} al ${esc(fechaTexto(dias.at(-1)))}</h2>
    <div class="adm-agenda-week">${dias.map((fecha) => `<section class="adm-agenda-day">
      <h3><button type="button" data-action="agenda-seleccionar-dia" data-fecha="${fecha}">${esc(fechaTexto(fecha))}</button></h3>
      ${eventosDia(s, fecha, true) || '<small class="adm-sub">Sin eventos</small>'}
    </section>`).join("")}</div></section>${planDiario(s)}`;
}

function vistaMes(s) {
  const rango = rangoAgenda(s.fecha, "mes");
  const mes = s.fecha.slice(0, 7);
  const firstWeek = new Date(`${rango.inicio}T00:00:00Z`).getUTCDay();
  const blancos = (firstWeek + 6) % 7;
  const dias = diasEntre(rango.inicio, rango.fin);
  const cells = [...Array(blancos).fill(""), ...dias];
  while (cells.length % 7) cells.push("");
  return `<section class="adm-card"><h2>${esc(fechaTexto(`${mes}-01`, { month: "long", year: "numeric" }))}</h2>
    <div class="adm-agenda-month">${["L", "M", "M", "J", "V", "S", "D"].map((dia) => `<b>${dia}</b>`).join("")}
    ${cells.map((fecha) => {
      if (!fecha) return '<span class="adm-agenda-empty"></span>';
      const inicio = `${fecha}T05:00:00.000Z`;
      const fin = `${fechaMas(fecha, 1)}T05:00:00.000Z`;
      const citas = s.citas.filter((cita) => inRange(cita, inicio, fin));
      const hoteles = s.reservas.filter((r) => r.estado !== "cancelada" && r.entrada <= fecha && fecha < r.salida);
      return `<button class="adm-agenda-cell" type="button" data-action="agenda-seleccionar-dia" data-fecha="${fecha}">
        <b>${Number(fecha.slice(-2))}</b><small>${citas.length} ${citas.length === 1 ? "cita" : "citas"}${hoteles.length ? ` · ${hoteles.length} en hotel` : ""}</small>
        ${hoteles.slice(0, 1).map((reserva) => `<span>Hotel · ${esc(persona(s, reserva.mascota_id)?.nombre ?? "Perro")}</span>`).join("")}
        ${citas.slice(0, 2).map((cita) => `<span>${esc(persona(s, cita.mascota_id)?.nombre ?? "Cita")} · ${esc(horaTexto(cita.inicio))}${conflictosCita(cita, s.citas).length ? " · Choque" : ""}</span>`).join("")}
      </button>`;
    }).join("")}</div></section>`;
}

function formularioCita(s, alerta) {
  const f = s.formularios.cita;
  const input = (title, field, value, type = "text") => `<label class="adm-f"><span class="adm-fl">${title}</span>
    <input type="${type}" data-agenda-field="${field}" value="${esc(value)}" ${type === "datetime-local" ? "required" : ""}></label>`;
  const select = (title, field, value, options) => `<label class="adm-f"><span class="adm-fl">${title}</span>
    <select data-agenda-field="${field}" required><option value="" disabled${value ? "" : " selected"}>Selecciona…</option>
      ${options.map(([id, label]) => `<option value="${esc(id)}"${String(value) === String(id) ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`;
  const mascotas = s.mascotas.filter((m) => m.activa).map((m) => [m.id, m.nombre]);
  const empleados = s.empleados.map((e) => [e.id, e.nombre]);
  const servicios = s.servicios.map((svc) => [svc.codigo, svc.nombre]);
  const opciones = mascotas.length && empleados.length && servicios.length;
  return `<section class="adm-card"><h2>${f.id ? "Editar cita" : "Nueva cita"}</h2>
    <p class="adm-sub">Cada cita necesita perro, servicio, empleado y hora de inicio y fin. Si hay un choque, se muestra antes de guardar.</p>
    ${opciones ? `<div class="adm-grid">
      ${select("Perro", "mascota_id", f.mascota_id, mascotas)}
      ${select("Servicio", "servicio_codigo", f.servicio_codigo, servicios)}
      ${select("Empleado", "empleado_id", f.empleado_id, empleados)}
      ${input("Inicio", "inicio", f.inicio, "datetime-local")}
      ${input("Fin", "fin", f.fin, "datetime-local")}
      ${select("Estado", "estado", f.estado, ESTADOS_CITA)}
      <label class="adm-f adm-full"><span class="adm-fl">Notas (opcional)</span><textarea data-agenda-field="notas" maxlength="1000">${esc(f.notas)}</textarea></label>
    </div>${alerta}${button(f.id ? "Guardar cambios" : "Crear cita", "agenda-guardar-cita", "", "adm-btn--primary")}
      ${f.id ? button("Cancelar edición", "agenda-cancelar-edicion") : ""}`
      : note("Para crear una cita necesitas registrar al menos un perro activo, un empleado y un servicio.", "err")}
  </section>`;
}

export const AgendaViews = {
  render(s) {
    if (s.loading) return '<section class="adm-card"><p class="adm-sub">Cargando agenda…</p></section>';
    if (s.error) return `${note(s.error === "missing" ? "Faltan tablas de la Fase 1 en Supabase." : "No se pudo cargar la agenda. Revisa conexión y permisos.", "err")}${button("Reintentar", "agenda-recargar")}`;
    if (s.isAdmin === false) return note("La agenda solo está disponible para una cuenta admin.", "err");
    const contenido = s.vista === "semana" ? vistaSemana(s) : s.vista === "mes" ? vistaMes(s) : vistaDia(s);
    return `<h1>Agenda y planeación</h1>${selectorVista(s)}${navegacion(s)}${contenido}`;
  }
};
