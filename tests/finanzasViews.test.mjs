import test from "node:test";
import assert from "node:assert/strict";
import { FinanzasViews } from "../src/admin/views/finanzasViews.js";

const OWNER = "123e4567-e89b-12d3-a456-426614174000";
const DOG = "223e4567-e89b-12d3-a456-426614174001";
const EXPENSE = "323e4567-e89b-12d3-a456-426614174002";
const INVOICE = "423e4567-e89b-12d3-a456-426614174003";
const SERVICE = "523e4567-e89b-12d3-a456-426614174004";
const MONTH = "2026-10";
const base = () => ({
  loading: false, error: null, isAdmin: true, vista: "resumen", mes: MONTH,
  gastos: [{ id: EXPENSE, fecha: "2026-10-02", categoria: "gasolina", descripcion: "Ruta", valor: 50000, recibo_path: `gastos/${EXPENSE}/recibo` }],
  pagos: [{ id: INVOICE, dueno_id: OWNER, mascota_id: DOG, servicio_codigo: SERVICE, fecha: "2026-10-01", concepto: "Mensualidad", valor_total: 300000 }],
  abonos: [{ id: "623e4567-e89b-12d3-a456-426614174006", pago_id: INVOICE, fecha: "2026-10-03", valor: 120000, metodo: "Efectivo" }],
  duenos: [{ id: OWNER, nombre: "Ana", telefono: "3123044174" }],
  mascotas: [{ id: DOG, nombre: "Max", dueno_id: OWNER }],
  servicios: [{ codigo: SERVICE, nombre: "Colegio", activo: true }],
  reciboPendiente: null,
  forms: {
    gasto: { id: null, fecha: "2026-10-09", categoria: "", descripcion: "", valor: "" },
    cobro: { dueno_id: "", mascota_id: "", servicio_codigo: "", fecha: "2026-10-09", concepto: "", valor_total: "" },
    abono: { pago_id: "", fecha: "2026-10-09", valor: "", metodo: "", notas: "" }
  }
});

test("muestra ingresos registrados, recaudo, gastos, utilidad y cartera consolidada", () => {
  const html = FinanzasViews.render(base());
  assert.match(html, /Finanzas y cartera/);
  assert.match(html, /Ingresos registrados/);
  assert.match(html, /Recaudado/);
  assert.match(html, /Utilidad del mes/);
  assert.match(html, /Ana/);
  assert.match(html, /Cobrar por WhatsApp/);
  assert.match(html, /exportar/);
});

test("muestra captura segura de gastos, cobros, abonos y recibos por sección", () => {
  const state = base();
  const gastos = FinanzasViews.render({ ...state, vista: "gastos" });
  assert.match(gastos, /Foto o PDF del recibo/);
  assert.match(gastos, /Descargar/);
  const cobros = FinanzasViews.render({ ...state, vista: "cobros" });
  assert.match(cobros, /Registrar cobro/);
  assert.match(cobros, /Registrar recaudo \/ abono/);
  assert.match(cobros, /Saldo/);
});

test("no presenta importes a quien no es admin ni inserta texto sin escapar", () => {
  const noAdmin = FinanzasViews.render({ ...base(), isAdmin: false });
  assert.match(noAdmin, /solo está disponible para una cuenta admin/);
  assert.doesNotMatch(noAdmin, /300\.000/);
  const state = base();
  state.gastos[0].descripcion = "<img src=x onerror=alert(1)>";
  const gastos = FinanzasViews.render({ ...state, vista: "gastos" });
  assert.match(gastos, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(gastos, /<img src=x/i);
  assert.doesNotMatch(gastos, /<[^>]+\son[a-z]+=/i);
  assert.doesNotMatch(gastos, /<[^>]+\sstyle=/i);
});
