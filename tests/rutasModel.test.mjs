import test from "node:test";
import assert from "node:assert/strict";
import {
  contarOcupacionDia, diaSemanaISO, hoyBogota, moverItem, resumenHotel,
  servicioMascotaEnFecha, validarCupos, validarParada, validarPlan, validarReserva, validarRuta
} from "../src/admin/models/rutasModel.js";

const DOG = "123e4567-e89b-12d3-a456-426614174000";
const ROUTE = "223e4567-e89b-12d3-a456-426614174001";
const MONDAY = "2026-10-12";
const dog = { id: DOG, activa: true };

test("la fecha operativa se calcula en Bogotá y los días usan ISO (lunes=1)", () => {
  assert.equal(hoyBogota(new Date("2026-10-12T02:00:00Z")), "2026-10-11");
  assert.equal(diaSemanaISO(MONDAY), 1);
});

test("el estado del día prioriza ausencia, luego hotel y después el plan de colegio", () => {
  const plan = { mascota_id: DOG, dias_semana: [1], desde: "2026-10-01", hasta: null, activo: true };
  assert.equal(servicioMascotaEnFecha(dog, MONDAY, [plan], [], []).codigo, "colegio");
  const reserva = { mascota_id: DOG, entrada: MONDAY, salida: "2026-10-14", estado: "reservada", tambien_colegio: false };
  assert.equal(servicioMascotaEnFecha(dog, MONDAY, [plan], [reserva], []).codigo, "hotel");
  assert.equal(servicioMascotaEnFecha(dog, MONDAY, [plan], [{ ...reserva, tambien_colegio: true }], []).codigo, "hotel_colegio");
  assert.equal(servicioMascotaEnFecha(dog, MONDAY, [plan], [reserva], [{ mascota_id: DOG, fecha: MONDAY }]).codigo, "ausente");
  assert.equal(servicioMascotaEnFecha(dog, "2026-10-13", [plan], [], []).codigo, "sin_servicio");
});

test("un solapamiento legado de reservas se muestra como conflicto y no se manda a ruta", () => {
  const reservas = [
    { mascota_id: DOG, entrada: "2026-10-10", salida: "2026-10-13", estado: "reservada" },
    { mascota_id: DOG, entrada: "2026-10-11", salida: "2026-10-14", estado: "en_curso" }
  ];
  assert.equal(servicioMascotaEnFecha(dog, MONDAY, [], reservas, []).codigo, "conflicto");
});

test("las noches incluyen entrada y excluyen salida; entradas y salidas se cuentan aparte", () => {
  const reservas = [
    { mascota_id: DOG, entrada: "2026-10-11", salida: "2026-10-13", estado: "reservada" },
    { mascota_id: "323e4567-e89b-12d3-a456-426614174002", entrada: MONDAY, salida: "2026-10-15", estado: "reservada" },
    { mascota_id: "423e4567-e89b-12d3-a456-426614174003", entrada: MONDAY, salida: "2026-10-15", estado: "cancelada" }
  ];
  assert.equal(contarOcupacionDia(MONDAY, reservas), 2);
  assert.deepEqual(resumenHotel(MONDAY, reservas, 2), { enHotel: 2, entradas: 1, salidas: 0, cupos: 2, disponibles: 0, excedido: false });
  assert.equal(contarOcupacionDia("2026-10-13", reservas), 1);
});

test("las validaciones limpian rutas, paradas, planes, reservas y cupos", () => {
  assert.deepEqual(validarRuta({ nombre: "  Ruta Norte ", empleado_id: "", capacidad_perros: "35" }).clean, {
    nombre: "Ruta Norte", empleado_id: null, capacidad_perros: 35
  });
  assert.equal(validarRuta({ nombre: "Ruta Norte", capacidad_perros: "0" }).errors.length, 1);
  assert.deepEqual(validarParada({
    ruta_id: ROUTE, mascota_id: DOG, sentido: "recogida", localidad: "  Usaquén ",
    direccion: " Calle 1 # 2 ", hora_estimada: ""
  }).clean, {
    ruta_id: ROUTE, mascota_id: DOG, sentido: "recogida", localidad: "Usaquén",
    direccion: "Calle 1 # 2", hora_estimada: null
  });
  assert.deepEqual(validarPlan({ mascota_id: DOG, dias_semana: [3, 1, 3], desde: MONDAY, hasta: "" }).clean.dias_semana, [1, 3]);
  assert.equal(validarReserva({ mascota_id: DOG, entrada: MONDAY, salida: MONDAY }).errors.length, 1);
  assert.equal(validarCupos("50").clean, 50);
  assert.equal(validarCupos("0").errors.length, 1);
});

test("el reordenamiento manual mueve una sola parada sin mutar la lista original", () => {
  const original = ["a", "b", "c"];
  assert.deepEqual(moverItem(original, 0, 1), ["b", "a", "c"]);
  assert.deepEqual(original, ["a", "b", "c"]);
});
