/**
 * Vistas financieras solo para admin. Se escapan tanto los nombres como los
 * conceptos y las rutas antes de incluir datos de Supabase en el HTML.
 */
import { esc } from "../../utils/dom.js";
import { normalizarTelefono } from "../models/gestionModel.js";
import { whatsappUrl } from "../../utils/whatsapp.js";
import {
  CATEGORIAS_GASTO, carteraPorDueno, resumenMensual, saldosPagos
} from "../models/finanzasModel.js";

const moneda = (valor) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 2
}).format(Number(valor) || 0);
const boton = (texto, accion, clase = "adm-btn--ghost", attrs = "") =>
  `<button class="adm-btn ${clase} adm-btn--sm" type="button" data-action="${accion}"${attrs}>${texto}</button>`;
const nota = (texto, tipo = "info") => `<p class="adm-note adm-note--${tipo}">${esc(texto)}</p>`;
const selector = (titulo, formulario, campo, valor, opciones, required = true) =>
  `<label class="adm-f"><span class="adm-fl">${esc(titulo)}</span><select data-fin-form="${formulario}" data-fin-field="${campo}"${required ? " required" : ""}>
    ${required ? `<option value="" disabled${valor ? "" : " selected"}>Selecciona…</option>` : `<option value="">Sin asignar</option>`}
    ${opciones.map(([id, texto]) => `<option value="${esc(id)}"${String(valor) === String(id) ? " selected" : ""}>${esc(texto)}</option>`).join("")}
  </select></label>`;
const campo = (titulo, formulario, nombre, valor, tipo = "text", extras = "") =>
  `<label class="adm-f"><span class="adm-fl">${esc(titulo)}</span><input type="${tipo}" data-fin-form="${formulario}" data-fin-field="${nombre}" value="${esc(valor)}" ${extras}></label>`;

function pestanas(s) {
  const vistas = [["resumen", "Resumen y cartera"], ["gastos", "Gastos"], ["cobros", "Cobros y abonos"]];
  return `<div class="adm-tabs" role="tablist" aria-label="Secciones financieras">
    ${vistas.map(([id, label]) => `<button class="adm-tab" type="button" role="tab" data-action="fin-vista" data-view="${id}" aria-selected="${s.vista === id}">${label}</button>`).join("")}
  </div>
  <div class="adm-row adm-between adm-wrapx adm-fin-month">
    <label class="adm-f"><span class="adm-fl">Mes del informe</span><input type="month" data-fin-month value="${esc(s.mes)}"></label>
    ${boton("Exportar a Excel (CSV)", "fin-exportar", "adm-btn--primary")}
  </div>`;
}

function resumen(s) {
  const reporte = resumenMensual(s.mes, s.gastos, s.pagos, s.abonos, s.servicios);
  const cartera = carteraPorDueno(s.pagos, s.abonos, s.duenos);
  const filasCartera = cartera.length ? cartera.map(({ dueno, saldo, cobros }) => {
    const tel = normalizarTelefono(dueno.telefono);
    const link = tel ? whatsappUrl(tel, `Hola ${dueno.nombre}, te compartimos el saldo pendiente de tus servicios en Animal Friends: ${moneda(saldo)}. Escríbenos si ya realizaste el pago o necesitas el detalle.`) : "";
    return `<tr><td>${esc(dueno.nombre)}</td><td>${cobros.length}</td><td>${moneda(saldo)}</td><td>${link ? `<a class="adm-btn adm-btn--ghost adm-btn--sm" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Cobrar por WhatsApp</a>` : "Sin teléfono registrado"}</td></tr>`;
  }).join("") : `<tr><td colspan="4">No hay saldos pendientes.</td></tr>`;
  const porServicio = reporte.ingresosPorServicio.map((fila) => `<li>${esc(fila.nombre)} <b>${moneda(fila.valor)}</b></li>`).join("");
  const porCategoria = reporte.gastosPorCategoria.map((fila) => `<li>${esc(fila.nombre)} <b>${moneda(fila.valor)}</b></li>`).join("");
  return `<section class="adm-fin-cards">
    <article class="adm-card"><h2>Ingresos registrados</h2><p class="adm-fin-total">${moneda(reporte.totalIngresos)}</p><small>Valor total de cobros creados en el mes.</small></article>
    <article class="adm-card"><h2>Recaudado</h2><p class="adm-fin-total">${moneda(reporte.totalRecaudado)}</p><small>Abonos recibidos durante el mes.</small></article>
    <article class="adm-card"><h2>Gastos</h2><p class="adm-fin-total">${moneda(reporte.totalGastos)}</p><small>Gastos con fecha en el mes.</small></article>
    <article class="adm-card"><h2>Utilidad del mes</h2><p class="adm-fin-total">${moneda(reporte.utilidad)}</p><small>Ingresos registrados menos gastos; no equivale al efectivo recaudado.</small></article>
  </section>
  <section class="adm-card"><h2>Ingresos por servicio · ${esc(s.mes)}</h2>
    ${porServicio ? `<ul class="adm-fin-breakdown">${porServicio}</ul>` : nota("Todavía no hay cobros en este mes.")}</section>
  <section class="adm-card"><h2>Gastos por categoría · ${esc(s.mes)}</h2>
    ${porCategoria ? `<ul class="adm-fin-breakdown">${porCategoria}</ul>` : nota("Todavía no hay gastos en este mes.")}</section>
  <section class="adm-card"><h2>Cartera por dueño</h2><p class="adm-sub">Se agrupan todos los perros y cobros de cada persona para que el mensaje de cobro muestre un solo saldo.</p>
    <div class="adm-table-scroll"><table class="adm-fin-table"><thead><tr><th>Dueño</th><th>Cobros pendientes</th><th>Saldo</th><th>Acción</th></tr></thead><tbody>${filasCartera}</tbody></table></div>
  </section>`;
}

function formularioGasto(s) {
  const f = s.forms.gasto;
  const opciones = CATEGORIAS_GASTO.map(([id, nombre]) => [id, nombre]);
  return `<section class="adm-card"><div class="adm-row adm-between adm-wrapx"><div><h2>${f.id ? "Editar gasto" : "Registrar gasto"}</h2><p class="adm-sub">El recibo queda privado y solo lo puede consultar una cuenta admin.</p></div>
    ${f.id ? boton("Nuevo gasto", "fin-nuevo-gasto") : ""}</div>
    <div class="adm-grid">
      ${campo("Fecha", "gasto", "fecha", f.fecha, "date", "required")}
      ${selector("Categoría", "gasto", "categoria", f.categoria, opciones)}
      ${campo("Valor (COP)", "gasto", "valor", f.valor, "number", 'min="0.01" step="0.01" inputmode="decimal" required')}
      <label class="adm-f"><span class="adm-fl">Descripción (opcional)</span><textarea data-fin-form="gasto" data-fin-field="descripcion" maxlength="300">${esc(f.descripcion)}</textarea></label>
      <label class="adm-f adm-full"><span class="adm-fl">Foto o PDF del recibo (máximo 8 MB)</span><input type="file" data-fin-receipt accept="image/jpeg,image/png,image/webp,application/pdf">
        <small>${esc(s.reciboPendiente?.name ?? "Formatos permitidos: JPG, PNG, WebP o PDF.")}</small></label>
    </div>
    ${boton(f.id ? "Guardar cambios" : "Guardar gasto", "fin-guardar-gasto", "adm-btn--primary")}
    ${f.id ? boton("Cancelar edición", "fin-cancelar-gasto") : ""}
  </section>`;
}

function listaGastos(s) {
  const lista = s.gastos.filter((gasto) => String(gasto.fecha).startsWith(`${s.mes}-`));
  if (!lista.length) return nota(`No hay gastos registrados en ${s.mes}.`);
  return `<div class="adm-table-scroll"><table class="adm-fin-table"><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Valor</th><th>Recibo</th><th></th></tr></thead><tbody>
    ${lista.map((gasto) => {
      const categoria = CATEGORIAS_GASTO.find(([id]) => id === gasto.categoria)?.[1] ?? gasto.categoria;
      return `<tr><td>${esc(gasto.fecha)}</td><td>${esc(categoria)}</td><td>${esc(gasto.descripcion ?? "—")}</td><td>${moneda(gasto.valor)}</td>
        <td>${gasto.recibo_path ? boton("Descargar", "fin-descargar-recibo", "adm-btn--ghost", ` data-path="${esc(gasto.recibo_path)}"`) : "Sin recibo"}</td>
        <td>${boton("Editar", "fin-editar-gasto", "adm-btn--ghost", ` data-id="${esc(gasto.id)}"`)}</td></tr>`;
    }).join("")}
  </tbody></table></div>`;
}

function gastos(s) {
  return `${formularioGasto(s)}<section class="adm-card"><h2>Gastos de ${esc(s.mes)}</h2>${listaGastos(s)}</section>`;
}

function formularioCobro(s) {
  const f = s.forms.cobro;
  const duenos = s.duenos.map((item) => [item.id, item.nombre]);
  const mascotas = s.mascotas.filter((item) => !f.dueno_id || item.dueno_id === f.dueno_id).map((item) => [item.id, item.nombre]);
  const servicios = s.servicios.filter((item) => item.activo).map((item) => [item.codigo, item.nombre]);
  return `<section class="adm-card"><h2>Registrar cobro</h2><p class="adm-sub">Puedes asociarlo a un perro o dejarlo general. La cartera suma los cobros de todos los perros del dueño.</p>
    <div class="adm-grid">
      ${selector("Dueño", "cobro", "dueno_id", f.dueno_id, duenos)}
      ${selector("Perro (opcional)", "cobro", "mascota_id", f.mascota_id, mascotas, false)}
      ${selector("Servicio (opcional)", "cobro", "servicio_codigo", f.servicio_codigo, servicios, false)}
      ${campo("Fecha del cobro", "cobro", "fecha", f.fecha, "date", "required")}
      ${campo("Concepto", "cobro", "concepto", f.concepto, "text", 'maxlength="200" required')}
      ${campo("Valor total (COP)", "cobro", "valor_total", f.valor_total, "number", 'min="0.01" step="0.01" inputmode="decimal" required')}
    </div>${boton("Guardar cobro", "fin-guardar-cobro", "adm-btn--primary")}
  </section>`;
}

function formularioAbono(s) {
  const balances = saldosPagos(s.pagos, s.abonos);
  const pendientes = s.pagos.filter((pago) => (balances.get(pago.id)?.saldo ?? 0) > 0);
  const options = pendientes.map((pago) => {
    const owner = s.duenos.find((dueno) => dueno.id === pago.dueno_id);
    return [pago.id, `${owner?.nombre ?? "Dueño"} · ${pago.concepto} · saldo ${moneda(balances.get(pago.id).saldo)}`];
  });
  const f = s.forms.abono;
  return `<section class="adm-card"><h2>Registrar recaudo / abono</h2>
    <div class="adm-grid">
      ${selector("Cobro pendiente", "abono", "pago_id", f.pago_id, options)}
      ${campo("Fecha de recepción", "abono", "fecha", f.fecha, "date", "required")}
      ${campo("Valor recibido (COP)", "abono", "valor", f.valor, "number", 'min="0.01" step="0.01" inputmode="decimal" required')}
      ${campo("Método (opcional)", "abono", "metodo", f.metodo, "text", 'maxlength="40"')}
      <label class="adm-f"><span class="adm-fl">Notas (opcional)</span><textarea data-fin-form="abono" data-fin-field="notas" maxlength="1000">${esc(f.notas)}</textarea></label>
    </div>
    ${options.length ? boton("Guardar abono", "fin-guardar-abono", "adm-btn--primary") : nota("No hay cobros con saldo pendiente.")}
  </section>`;
}

function listaCobros(s) {
  if (!s.pagos.length) return nota("Todavía no hay cobros registrados.");
  const saldos = saldosPagos(s.pagos, s.abonos);
  return `<div class="adm-table-scroll"><table class="adm-fin-table"><thead><tr><th>Fecha</th><th>Dueño</th><th>Perro</th><th>Concepto</th><th>Servicio</th><th>Cobrado</th><th>Abonado</th><th>Saldo</th></tr></thead><tbody>
    ${s.pagos.map((pago) => {
      const balance = saldos.get(pago.id);
      const dueno = s.duenos.find((item) => item.id === pago.dueno_id);
      const mascota = s.mascotas.find((item) => item.id === pago.mascota_id);
      const servicio = s.servicios.find((item) => item.codigo === pago.servicio_codigo);
      return `<tr><td>${esc(pago.fecha)}</td><td>${esc(dueno?.nombre ?? "Dueño no disponible")}</td><td>${esc(mascota?.nombre ?? "—")}</td>
        <td>${esc(pago.concepto)}</td><td>${esc(servicio?.nombre ?? "—")}</td><td>${moneda(balance.total)}</td><td>${moneda(balance.pagado)}</td><td>${moneda(balance.saldo)}</td></tr>`;
    }).join("")}
  </tbody></table></div>`;
}

function cobros(s) {
  return `${formularioCobro(s)}${formularioAbono(s)}<section class="adm-card"><h2>Cobros registrados</h2>${listaCobros(s)}</section>`;
}

export const FinanzasViews = {
  render(s) {
    if (s.loading) return '<section class="adm-card"><p class="adm-sub">Cargando información financiera…</p></section>';
    if (s.error) return `${nota(s.error === "missing" ? "Faltan las tablas financieras de la Fase 1 en Supabase." : s.error === "perm" ? "Tu usuario no tiene permiso para ver esta información." : "No se pudieron cargar las finanzas. Revisa conexión y permisos.", "err")}${boton("Reintentar", "fin-recargar")}`;
    if (s.isAdmin === false) return nota("La información financiera solo está disponible para una cuenta admin.", "err");
    const contenido = s.vista === "gastos" ? gastos(s) : s.vista === "cobros" ? cobros(s) : resumen(s);
    return `<h1>Finanzas y cartera</h1>${pestanas(s)}${contenido}`;
  }
};
