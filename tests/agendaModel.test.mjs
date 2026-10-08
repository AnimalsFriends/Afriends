import test from "node:test";
import assert from "node:assert/strict";
import {
  conflictosCita, fechaHoraBogotaAUTC, fechaHoraBogotaDeISO, fechaBogotaDeISO,
  inicioDiaBogotaUTC, planificarRutas, rangoAgenda, validarCita
} from "../src/admin/models/agendaModel.js";

const DOG = "123e4567-e89b-12d3-a456-426614174000";
const ROUTE = "223e4567-e89b-12d3-a456-426614174001";
const EMPLOYEE = "323e4567-e89b-12d3-a456-426614174002";
const SERVICE = "423e4567-e89b-12d3-a456-426614174003";
const MONDAY = "2026-10-12";

test("los rangos de agenda usan semanas ISO y límites mensuales exclusivos", () => {
  assert.deepEqual(rangoAgenda("2026-10-14", "dia"), { inicio: "2026-10-14", fin: "2026-10-15" });
  assert.deepEqual(rangoAgenda("2026-10-14", "semana"), { inicio: MONDAY, fin: "2026-10-19" });
  assert.deepEqual(rangoAgenda(MONDAY, "mes"), { inicio: "2026-10-01", fin: "2026-11-01" });
  assert.equal(rangoAgenda("2026-02-30", "dia"), null);
});

test("la agenda convierte fecha y hora con zona Bogotá sin depender del navegador", () => {
  assert.equal(inicioDiaBogotaUTC(MONDAY), "2026-10-12T05:00:00.000Z");
  assert.equal(fechaHoraBogotaAUTC("2026-10-12T08:30"), "2026-10-12T13:30:00.000Z");
  assert.equal(fechaBogotaDeISO("2026-10-12T13:30:00.000Z"), MONDAY);
  assert.equal(fechaHoraBogotaDeISO("2026-10-12T13:30:00.000Z"), "2026-10-12T08:30");
  assert.equal(fechaHoraBogotaAUTC("2026-02-30T08:30"), null);
});

test("la cita exige mascota, empleado, servicio y un rango horario real", () => {
  const result = validarCita({
    mascota_id: DOG, empleado_id: EMPLOYEE, servicio_codigo: "bano",
    inicio: "2026-10-12T08:30", fin: "2026-10-12T09:15", estado: "pendiente", notas: ""
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.clean.inicio, "2026-10-12T13:30:00.000Z");
  assert.equal(validarCita({ ...result.clean, inicio: "2026-10-12T10:00", fin: "2026-10-12T09:00" }).errors.length, 1);
});

test("las citas avisan choques del empleado o perro, pero ignoran canceladas y bordes contiguos", () => {
  const cita = { mascota_id: DOG, empleado_id: EMPLOYEE, inicio: "2026-10-12T13:00:00Z", fin: "2026-10-12T14:00:00Z" };
  const citas = [
    { id: "a", mascota_id: DOG, empleado_id: EMPLOYEE, inicio: "2026-10-12T13:30:00Z", fin: "2026-10-12T14:30:00Z", estado: "pendiente" },
    { id: "b", mascota_id: "other", empleado_id: EMPLOYEE, inicio: "2026-10-12T14:00:00Z", fin: "2026-10-12T15:00:00Z", estado: "pendiente" },
    { id: "c", mascota_id: DOG, empleado_id: EMPLOYEE, inicio: "2026-10-12T13:30:00Z", fin: "2026-10-12T14:30:00Z", estado: "cancelado" }
  ];
  assert.deepEqual(conflictosCita(cita, citas).map(({ tipos }) => tipos), [["empleado", "mascota"]]);
  assert.deepEqual(conflictosCita({ ...cita, estado: "cancelado" }, citas), []);
});

test("la planeación cuenta perros programados por ruta y no inventa capacidades", () => {
  const mascotas = [{ id: DOG, activa: true }, { id: "other-dog", activa: true }];
  const rutas = [
    { id: ROUTE, activa: true, empleado_id: EMPLOYEE, capacidad_perros: 2 },
    { id: "otra-ruta", activa: true, empleado_id: null, capacidad_perros: null }
  ];
  const paradas = [
    { ruta_id: ROUTE, mascota_id: DOG, sentido: "recogida", activa: true },
    { ruta_id: ROUTE, mascota_id: "other-dog", sentido: "recogida", activa: true },
    { ruta_id: "otra-ruta", mascota_id: DOG, sentido: "recogida", activa: true }
  ];
  const planes = [{ mascota_id: DOG, dias_semana: [1], desde: "2026-10-01", hasta: null, activo: true }];
  const resultado = planificarRutas(MONDAY, rutas, paradas, mascotas, planes, [], []);
  assert.equal(resultado.totalPerros, 1);
  assert.equal(resultado.totalEmpleados, null);
  assert.deepEqual(resultado.perrosEnVariasRutas, [DOG]);
  assert.deepEqual(resultado.rutas.map(({ perros, necesarios }) => [perros, necesarios]), [[1, 1], [1, null]]);

  const sinParada = planificarRutas(MONDAY, [], [], mascotas, planes, [], []);
  assert.equal(sinParada.totalPerros, 1);
  assert.deepEqual(sinParada.perrosSinRuta, [DOG]);
  assert.equal(sinParada.totalEmpleados, null);
});
