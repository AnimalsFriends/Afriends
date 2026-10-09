/**
 * Vistas de alertas, asistencia e historial. Los valores que llegan desde
 * Supabase se escapan antes de pintar para que nombres y snapshots sean texto.
 */
import { esc } from "../../utils/dom.js";
import { generarAlertas, listaAsistencia } from "../models/seguimientoModel.js";

const boton = (texto, accion, attrs = "", clase = "adm-btn--ghost") =>
  `<button class="adm-btn ${clase} adm-btn--sm" type="button" data-action="${accion}"${attrs}>${texto}</button>`;
const nota = (texto, tipo = "info") => `<p class="adm-note adm-note--${tipo}">${esc(texto)}</p>`;
const fechaLegible = (valor) => {
  const [anio, mes, dia] = String(valor).split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(Date.UTC(anio, mes - 1, dia)));
};
const horaLegible = (valor) => valor
  ? new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })
    .format(new Date(valor))
  : "—";
const etiquetaEstado = (estado) => ({
  vencido: ["Vencido", "warn"], por_vencer: ["Vence pronto", "off"],
  pendiente: ["Pendiente", "off"], presente: ["En el colegio", "ok"],
  salio: ["Ya salió", "ok"], ausente: ["Faltó", "warn"]
}[estado] ?? [estado, "off"]);
const tag = (estado) => {
  const [texto, clase] = etiquetaEstado(estado);
  return `<span class="adm-tag${clase ? ` adm-tag--${clase}` : ""}">${esc(texto)}</span>`;
};
const campo = (titulo, nombre, valor, tipo = "text", extras = "") =>
  `<label class="adm-f"><span class="adm-fl">${esc(titulo)}</span><input type="${tipo}" data-seg-field="${nombre}" value="${esc(valor)}" ${extras}></label>`;

function pestanas(s) {
  return `<div class="adm-tabs" role="tablist" aria-label="Seguimiento diario">
    ${[["alertas", "Alertas y SOAT"], ["asistencia", "Asistencia"], ["historial", "Historial de cambios"]]
      .map(([id, texto]) => `<button class="adm-tab" type="button" role="tab" data-action="seg-vista" data-view="${id}" aria-selected="${s.vista === id}">${texto}</button>`)
      .join("")}
  </div>`;
}

function filtroFecha(s) {
  return `<div class="adm-row adm-between adm-wrapx">
    <label class="adm-f"><span class="adm-fl">Día de consulta</span><input type="date" data-seg-fecha value="${esc(s.fecha)}"></label>
    ${boton("Actualizar", "seg-recargar")}
  </div>`;
}

function tablaAlertas(s) {
  const alertas = generarAlertas({
    vacunas: s.vacunas, mascotas: s.mascotas, soat: s.soat, hoy: s.fecha
  });
  if (!alertas.length) return nota("No hay vacunas, desparasitaciones ni SOAT vencidos o por vencer en esta ventana.");
  return `<div class="adm-table-scroll"><table class="adm-fin-table"><thead><tr><th>Vence</th><th>Estado</th><th>Tipo y registro</th><th>Perro o vehículo</th></tr></thead><tbody>
    ${alertas.map((item) => `<tr><td>${fechaLegible(item.vencimiento)}</td><td>${tag(item.estado)}</td>
      <td>${esc(item.tipo === "vacuna" ? "Vacuna" : item.tipo === "desparasitacion" ? "Desparasitación" : "SOAT")} · ${esc(item.nombre)}</td>
      <td>${esc(item.mascota || item.nombre)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

function formularioSoat(s) {
  const f = s.formSoat;
  return `<section class="adm-card">
    <div class="adm-row adm-between adm-wrapx"><div><h2>${f.id ? "Actualizar SOAT" : "Registrar vehículo y SOAT"}</h2>
      <p class="adm-sub">Guarda una fila por vehículo. Al renovar, actualízala: el historial conserva la fecha anterior.</p></div>
      ${f.id ? boton("Cancelar edición", "seg-cancelar-soat") : ""}</div>
    <div class="adm-grid">
      ${campo("Vehículo o placa", "vehiculo", f.vehiculo, "text", 'maxlength="80" required')}
      ${campo("Vencimiento del SOAT", "fecha_vencimiento", f.fecha_vencimiento, "date", "required")}
      <label class="adm-f adm-full"><span class="adm-fl">Notas (opcional)</span><textarea data-seg-field="notas" maxlength="500">${esc(f.notas)}</textarea></label>
    </div>
    ${boton(f.id ? "Guardar renovación" : "Guardar SOAT", "seg-guardar-soat", "", "adm-btn--primary")}
  </section>`;
}

function vistaAlertas(s) {
  return `${filtroFecha(s)}
    <section class="adm-card"><h2>Vencimientos · próximos 30 días</h2>
      <p class="adm-sub">También se muestran los registros vencidos. Las fechas se comparan con el día elegido.</p>
      ${tablaAlertas(s)}</section>
    ${formularioSoat(s)}
    <section class="adm-card"><h2>Vehículos registrados</h2>${s.soat.length ? `<div class="adm-table-scroll"><table class="adm-fin-table">
      <thead><tr><th>Vehículo</th><th>Vencimiento</th><th>Notas</th><th></th></tr></thead><tbody>
      ${s.soat.map((item) => `<tr><td>${esc(item.vehiculo)}</td><td>${fechaLegible(item.fecha_vencimiento)}</td>
        <td>${esc(item.notas || "—")}</td><td>${boton("Editar", "seg-editar-soat", ` data-id="${esc(item.id)}"`)}</td></tr>`).join("")}
      </tbody></table></div>` : nota("Todavía no hay vehículos registrados.")}</section>`;
}

function botonAsistencia(item) {
  if (item.estado === "ausente") {
    return boton("Corregir falta", "seg-quitar-falta", ` data-id="${esc(item.falta.id)}"`, "adm-btn--danger");
  }
  if (item.estado === "pendiente") {
    return `${boton("Marcar llegada", "seg-marcar-llegada", ` data-mascota="${esc(item.mascota.id)}"`, "adm-btn--primary")}
      ${boton("Marcar falta", "seg-marcar-falta", ` data-mascota="${esc(item.mascota.id)}"`, "adm-btn--danger")}`;
  }
  if (item.estado === "presente") {
    return boton("Marcar salida", "seg-marcar-salida", ` data-id="${esc(item.registro.id)}"`, "adm-btn--primary");
  }
  return `<span>Jornada cerrada</span>`;
}

function vistaAsistencia(s) {
  const lista = listaAsistencia({
    fecha: s.fecha, mascotas: s.mascotas, planes: s.planes,
    reservas: s.reservas, ausencias: s.ausencias, registros: s.registros
  });
  const conteo = (estado) => lista.filter((item) => item.estado === estado).length;
  const nombreEmpleado = (id) => s.empleados.find((item) => item.id === id)?.nombre;
  const marca = (cuando, empleadoId) => {
    const hora = horaLegible(cuando);
    const quien = nombreEmpleado(empleadoId);
    return quien ? `${hora}<small> · ${esc(quien)}</small>` : hora;
  };
  return `${filtroFecha(s)}
    <section class="adm-card"><h2>Asistencia del colegio</h2>
      <p class="adm-sub">Solo aparecen perros cuyo plan incluya este día, también los que tienen hotel + colegio.</p>
      <div class="adm-grid adm-grid--3">
        <article class="adm-card"><h3>Por llegar</h3><b>${conteo("pendiente")}</b></article>
        <article class="adm-card"><h3>En el colegio</h3><b>${conteo("presente")}</b></article>
        <article class="adm-card"><h3>Salieron / faltaron</h3><b>${conteo("salio") + conteo("ausente")}</b></article>
      </div>
      ${lista.length ? `<div class="adm-table-scroll"><table class="adm-fin-table"><thead><tr>
        <th>Perro</th><th>Servicio</th><th>Estado</th><th>Llegada</th><th>Salida</th><th>Acción</th>
      </tr></thead><tbody>${lista.map((item) => `<tr>
        <td>${esc(item.mascota.nombre)}</td>
        <td>${item.servicio === "hotel_colegio" ? "Hotel + colegio" : "Colegio"}</td>
        <td>${item.estado === "ausente" ? `${tag(item.estado)}${item.falta.motivo ? `<small>${esc(item.falta.motivo)}</small>` : ""}` : tag(item.estado)}</td>
        <td>${marca(item.registro?.entrada_en, item.registro?.entrada_por)}</td><td>${marca(item.registro?.salida_en, item.registro?.salida_por)}</td>
        <td>${botonAsistencia(item)}</td></tr>`).join("")}</tbody></table></div>`
        : nota("No hay perros con colegio programado para este día.")}
    </section>`;
}

const fechaHora = (valor) => new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota"
}).format(new Date(valor));

function detalleCambio(fila) {
  const datos = { anterior: fila.valores_anteriores, nuevo: fila.valores_nuevos };
  return `<details><summary>Ver detalle</summary><pre>${esc(JSON.stringify(datos, null, 2))}</pre></details>`;
}

function vistaHistorial(s) {
  const filas = s.historial.length ? `<div class="adm-table-scroll"><table class="adm-fin-table"><thead><tr>
    <th>Cuándo</th><th>Quién</th><th>Acción</th><th>Registro</th><th>Detalle</th>
  </tr></thead><tbody>${s.historial.map((fila) => `<tr>
    <td>${fechaHora(fila.ocurrido_en)}</td>
    <td>${esc(fila.actor_nombre || fila.actor_correo || fila.actor_id || "Proceso del sistema")}</td>
    <td>${esc(({ INSERT: "Creó", UPDATE: "Editó", DELETE: "Eliminó" })[fila.operacion] ?? fila.operacion)}</td>
    <td>${esc(fila.tabla)} · ${esc(fila.registro_id)}</td>
    <td>${detalleCambio(fila)}</td></tr>`).join("")}</tbody></table></div>`
    : nota("Todavía no hay cambios registrados.");
  return `<section class="adm-card"><h2>Historial de cambios</h2>
    <p class="adm-sub">Muestra quién creó, editó o eliminó registros y guarda sus valores anterior y nuevo. Solo admin puede consultarlo.</p>
    ${filas}${s.historialMas ? boton(s.historialCargando ? "Cargando…" : "Cargar anteriores", "seg-historial-mas") : ""}
  </section>`;
}

export const SeguimientoViews = {
  render(s) {
    if (s.loading) return `<section class="adm-card"><p role="status">Cargando alertas y asistencia…</p></section>`;
    if (s.error) {
      const mensaje = s.error === "missing"
        ? "Falta aplicar la migración de la Fase 7 en Supabase."
        : s.error === "perm" ? "Tu cuenta no tiene permiso para ver esta sección."
          : "No se pudieron cargar los datos. Revisa la conexión e inténtalo de nuevo.";
      return `<section class="adm-card">${nota(mensaje, "err")}${boton("Reintentar", "seg-recargar")}</section>`;
    }
    if (s.isAdmin === false) return `<section class="adm-card">${nota("Esta sección solo está disponible para una cuenta admin.", "err")}</section>`;
    const contenido = s.vista === "asistencia" ? vistaAsistencia(s)
      : s.vista === "historial" ? vistaHistorial(s) : vistaAlertas(s);
    return `<header class="adm-section-head"><h1>Alertas, asistencia e historial</h1></header>
      ${pestanas(s)}${s.errorHistorial ? nota("No se pudo cargar el historial. Inténtalo de nuevo.", "err") : ""}${contenido}`;
  }
};
