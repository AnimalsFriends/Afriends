import test from "node:test";
import assert from "node:assert/strict";
import { SeguimientoViews } from "../src/admin/views/seguimientoViews.js";

const DOG = "123e4567-e89b-12d3-a456-426614174000";
const ENTRY = "223e4567-e89b-12d3-a456-426614174001";
const base = () => ({
  loading: false, error: null, errorHistorial: false, isAdmin: true,
  vista: "alertas", fecha: "2026-10-12", mascotas: [{ id: DOG, nombre: "Max", activa: true }],
  planes: [{ mascota_id: DOG, dias_semana: [1], desde: "2026-01-01", activo: true }],
  reservas: [], ausencias: [], registros: [], vacunas: [], soat: [], empleados: [],
  historial: [], historialMas: false, historialCargando: false,
  formSoat: { id: null, vehiculo: "", fecha_vencimiento: "", notas: "" }
});

test("muestra alertas y captura de SOAT con los datos escapados", () => {
  const state = base();
  state.vacunas = [{
    id: "v1", mascota_id: DOG, tipo: "vacuna", nombre: "<script>alert(1)</script>",
    fecha_vencimiento: "2026-10-20"
  }];
  const html = SeguimientoViews.render(state);
  assert.match(html, /Alertas, asistencia e historial/);
  assert.match(html, /Vencimientos · próximos 30 días/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /Registrar vehículo y SOAT/);
  assert.match(html, /data-seg-field="vehiculo"/);
});

test("presenta lista de asistencia con acciones seguras y fechas", () => {
  const state = base();
  state.vista = "asistencia";
  const html = SeguimientoViews.render(state);
  assert.match(html, /Asistencia del colegio/);
  assert.match(html, /Marcar llegada/);
  assert.match(html, /Marcar falta/);
  assert.match(html, /Max/);
});

test("presenta el historial escapando actor, tablas y snapshots", () => {
  const state = base();
  state.vista = "historial";
  state.historial = [{
    id: 1, tabla: "public.mascotas", registro_id: DOG, operacion: "UPDATE",
    actor_nombre: "<img src=x>", actor_correo: "admin@example.test",
    ocurrido_en: "2026-10-12T15:00:00Z",
    valores_anteriores: { nombre: "Max" }, valores_nuevos: { nombre: "<b>Max</b>" }
  }];
  const html = SeguimientoViews.render(state);
  assert.match(html, /Historial de cambios/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /&lt;b&gt;Max&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<img src=x>|<b>Max<\/b>/);
});

test("restringe la vista si no es admin y explica cuando falta la migración", () => {
  assert.match(SeguimientoViews.render({ ...base(), isAdmin: false }), /solo está disponible para una cuenta admin/);
  assert.match(SeguimientoViews.render({ ...base(), error: "missing" }), /Falta aplicar la migración de la Fase 7/);
});
