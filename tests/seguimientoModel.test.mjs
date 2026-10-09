import test from "node:test";
import assert from "node:assert/strict";
import {
  DIAS_ALERTA_VENCIMIENTO, generarAlertas, listaAsistencia, validarSoat
} from "../src/admin/models/seguimientoModel.js";

const HOY = "2026-10-12";
const DOG1 = "123e4567-e89b-12d3-a456-426614174000";
const DOG2 = "223e4567-e89b-12d3-a456-426614174001";
const DOG3 = "323e4567-e89b-12d3-a456-426614174002";
const OWNER = "423e4567-e89b-12d3-a456-426614174003";

test("genera alertas por vencimiento en ventana inclusiva de 30 días y conserva vencidos", () => {
  const alertas = generarAlertas({
    hoy: HOY,
    vacunas: [
      { id: "v1", mascota_id: DOG1, tipo: "vacuna", nombre: "Rabia", fecha_vencimiento: "2026-10-11" },
      { id: "v2", mascota_id: DOG1, tipo: "desparasitacion", nombre: "Interna", fecha_vencimiento: HOY },
      { id: "v3", mascota_id: DOG2, tipo: "vacuna", nombre: "Triple", fecha_vencimiento: "2026-11-11" },
      { id: "v4", mascota_id: DOG2, tipo: "vacuna", nombre: "Fuera", fecha_vencimiento: "2026-11-12" }
    ],
    mascotas: [{ id: DOG1, nombre: "Max" }],
    soat: [{ id: "s1", vehiculo: "Van", fecha_vencimiento: "2026-10-15" }]
  });
  assert.equal(DIAS_ALERTA_VENCIMIENTO, 30);
  assert.deepEqual(alertas.map((alerta) => alerta.id), ["v1", "v2", "s1", "v3"]);
  assert.equal(alertas[0].estado, "vencido");
  assert.equal(alertas[1].estado, "por_vencer");
  assert.equal(alertas[2].tipo, "soat");
  assert.equal(alertas[3].mascota, "Perro no disponible");
});

test("rechaza fechas o ventanas inválidas en las alertas", () => {
  assert.throws(() => generarAlertas({ hoy: "2026-02-31" }), /fecha o la ventana/);
  assert.throws(() => generarAlertas({ hoy: HOY, dias: -1 }), /fecha o la ventana/);
});

test("valida el SOAT, evita vehículos repetidos ignorando mayúsculas y limpia notas", () => {
  const existing = [{ id: DOG1, vehiculo: "Van 01", fecha_vencimiento: "2026-10-20" }];
  const duplicate = validarSoat({
    vehiculo: "  VAN   01 ", fecha_vencimiento: HOY, notas: "  renovado  "
  }, existing);
  assert.ok(duplicate.errors.some((error) => /Ya hay un SOAT/.test(error)));
  const valid = validarSoat({
    vehiculo: " Van 02 ", fecha_vencimiento: "2026-11-11", notas: "  renovar pronto "
  }, existing);
  assert.deepEqual(valid.errors, []);
  assert.deepEqual(valid.clean, {
    vehiculo: "Van 02", fecha_vencimiento: "2026-11-11", notas: "renovar pronto"
  });
  assert.ok(validarSoat({ vehiculo: "V", fecha_vencimiento: "2026-02-31" }).errors.length >= 2);
});

test("lista asistencia solo para perros con colegio, integra hotel + colegio y faltas previas", () => {
  const mascotas = [
    { id: DOG1, nombre: "Max", activa: true, dueno_id: OWNER },
    { id: DOG2, nombre: "Luna", activa: true, dueno_id: OWNER },
    { id: DOG3, nombre: "Toby", activa: true, dueno_id: OWNER },
    { id: "523e4567-e89b-12d3-a456-426614174005", nombre: "Kira", activa: false, dueno_id: OWNER }
  ];
  const planes = mascotas.map((mascota) => ({
    mascota_id: mascota.id, dias_semana: [1], desde: "2026-01-01", hasta: null, activo: true
  }));
  const reservas = [
    { mascota_id: DOG2, entrada: HOY, salida: "2026-10-14", estado: "reservada", tambien_colegio: true },
    { mascota_id: DOG3, entrada: HOY, salida: "2026-10-14", estado: "reservada", tambien_colegio: false }
  ];
  const ausencias = [{ id: "a1", mascota_id: DOG2, fecha: HOY, motivo: "Cita" }];
  const registros = [
    { id: "r1", mascota_id: DOG1, fecha: HOY, entrada_en: "2026-10-12T13:00:00Z", salida_en: null },
    { id: "r2", mascota_id: DOG3, fecha: HOY, entrada_en: "2026-10-12T13:10:00Z", salida_en: "2026-10-12T19:00:00Z" }
  ];
  const lista = listaAsistencia({ fecha: HOY, mascotas, planes, reservas, ausencias, registros });
  assert.deepEqual(lista.map(({ mascota }) => mascota.id), [DOG2, DOG1]);
  assert.equal(lista[0].servicio, "hotel_colegio");
  assert.equal(lista[0].estado, "ausente");
  assert.equal(lista[1].estado, "presente");
  assert.throws(() => listaAsistencia({ fecha: "2026-02-31" }), /fecha de asistencia/);
});
