import test from "node:test";
import assert from "node:assert/strict";
import { AgendaViews } from "../src/admin/views/agendaViews.js";

const DOG = "123e4567-e89b-12d3-a456-426614174000";
const ROUTE = "223e4567-e89b-12d3-a456-426614174001";
const EMPLOYEE = "323e4567-e89b-12d3-a456-426614174002";
const MONDAY = "2026-10-12";
const CITATION = "423e4567-e89b-12d3-a456-426614174003";

const base = () => ({
  loading: false, error: null, isAdmin: true, vista: "dia", fecha: MONDAY,
  mascotas: [{ id: DOG, nombre: "Max", activa: true, dueno_id: "523e4567-e89b-12d3-a456-426614174005" }],
  duenos: [{ id: "523e4567-e89b-12d3-a456-426614174005", nombre: "Ana", telefono: "3123044174" }],
  empleados: [{ id: EMPLOYEE, nombre: "Luis" }],
  servicios: [{ codigo: "bano", nombre: "Baño e higiene" }],
  citas: [{
    id: CITATION, mascota_id: DOG, empleado_id: EMPLOYEE, servicio_codigo: "bano",
    inicio: "2026-10-12T13:30:00+00:00", fin: "2026-10-12T14:15:00+00:00",
    estado: "pendiente", notas: "Traer cepillo"
  }],
  reservas: [{ mascota_id: DOG, entrada: MONDAY, salida: "2026-10-14", estado: "reservada", tambien_colegio: true }],
  rutas: [{ id: ROUTE, nombre: "Ruta norte", activa: true, empleado_id: EMPLOYEE, capacidad_perros: 1 }],
  paradas: [{ ruta_id: ROUTE, mascota_id: DOG, sentido: "recogida", activa: true }],
  planes: [{ mascota_id: DOG, dias_semana: [1], desde: "2026-10-01", hasta: null, activo: true }],
  ausencias: [],
  formularios: {
    cita: { id: null, mascota_id: DOG, empleado_id: EMPLOYEE, servicio_codigo: "bano", inicio: "", fin: "", estado: "pendiente", notas: "" }
  }
});

test("día muestra citas, ocupación de hotel y enlace para confirmar por WhatsApp", () => {
  const html = AgendaViews.render(base());
  assert.match(html, /Agenda y planeación/);
  assert.match(html, /Hotel · Max/);
  assert.match(html, /Baño e higiene/);
  assert.match(html, /https:\/\/wa\.me\/573123044174/);
  assert.match(html, /Confirmar \/ recordar por WhatsApp/);
  assert.match(html, /Hoy hay <b>1<\/b> perro por recoger/);
  assert.match(html, /Se requieren 1 empleado/);
});

test("exige escoger explícitamente perro, servicio y empleado al crear una cita", () => {
  const s = base();
  s.formularios.cita = {
    id: null, mascota_id: "", empleado_id: "", servicio_codigo: "",
    inicio: "", fin: "", estado: "pendiente", notas: ""
  };
  const html = AgendaViews.render(s);
  assert.equal((html.match(/<option value="" disabled selected>Selecciona…<\/option>/g) ?? []).length, 3);
});

test("advierte choques de empleado/perro y muestra el resumen de agenda semanal y mensual", () => {
  const s = base();
  s.citas.push({
    id: "623e4567-e89b-12d3-a456-426614174006", mascota_id: DOG, empleado_id: EMPLOYEE,
    servicio_codigo: "bano", inicio: "2026-10-12T13:45:00+00:00", fin: "2026-10-12T14:30:00+00:00", estado: "pendiente"
  });
  assert.match(AgendaViews.render(s), /el empleado ya tiene otra cita y el perro ya tiene otra cita/);
  const semana = AgendaViews.render({ ...s, vista: "semana" });
  assert.match(semana, /Hotel · Max/);
  assert.match(semana, /Choque/);
  const mes = AgendaViews.render({ ...s, vista: "mes" });
  assert.match(mes, /1 en hotel/);
  assert.match(mes, /Hotel · Max/);
});

test("las vistas no inyectan texto externo ni manejadores en línea", () => {
  const s = base();
  s.mascotas[0].nombre = "<Max>";
  const html = ["dia", "semana", "mes"].map((vista) => AgendaViews.render({ ...s, vista })).join("\n");
  assert.match(html, /&lt;Max&gt;/);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
  assert.doesNotMatch(html, /\sstyle=/i);
});
