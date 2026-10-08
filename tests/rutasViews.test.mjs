import test from "node:test";
import assert from "node:assert/strict";
import { RutasViews } from "../src/admin/views/rutasViews.js";

const DOG = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_DOG = "223e4567-e89b-12d3-a456-426614174001";
const ROUTE = "323e4567-e89b-12d3-a456-426614174002";
const MONDAY = "2026-10-12";
const base = () => ({
  loading: false, error: null, isAdmin: true, vista: "hoy", fecha: MONDAY, mes: "2026-10",
  rutas: [{ id: ROUTE, nombre: "Ruta <Norte>", activa: true, empleado_id: null }],
  paradas: [
    { id: "423e4567-e89b-12d3-a456-426614174003", ruta_id: ROUTE, mascota_id: DOG, sentido: "recogida", orden: 1, localidad: "Usaquén", direccion: "Calle 1", hora_estimada: "08:00", activa: true },
    { id: "523e4567-e89b-12d3-a456-426614174004", ruta_id: ROUTE, mascota_id: OTHER_DOG, sentido: "recogida", orden: 2, localidad: "Usaquén", direccion: "Calle 2", hora_estimada: null, activa: true }
  ],
  mascotas: [{ id: DOG, nombre: "Max", dueno_id: "623e4567-e89b-12d3-a456-426614174005", activa: true },
    { id: OTHER_DOG, nombre: "Luna", dueno_id: "723e4567-e89b-12d3-a456-426614174006", activa: true }],
  duenos: [{ id: "623e4567-e89b-12d3-a456-426614174005", nombre: "Ana", telefono: "573001234567" }],
  planes: [{ id: "823e4567-e89b-12d3-a456-426614174007", mascota_id: DOG, dias_semana: [1], desde: "2026-10-01", hasta: null, activo: true }],
  reservas: [{ id: "923e4567-e89b-12d3-a456-426614174008", mascota_id: OTHER_DOG, entrada: "2026-10-11", salida: "2026-10-14", estado: "reservada", tambien_colegio: false }],
  ausencias: [], paradasDia: [{ id: "a23e4567-e89b-12d3-a456-426614174009", parada_id: "423e4567-e89b-12d3-a456-426614174003", estado: "pendiente" }],
  empleados: [], cuposHotel: 50,
  formularios: {
    ruta: { id: null, nombre: "", empleado_id: "" },
    parada: { id: null, ruta_id: ROUTE, mascota_id: DOG, sentido: "recogida", localidad: "", direccion: "", hora_estimada: "" },
    plan: { mascota_id: DOG, dias_semana: [], desde: MONDAY, hasta: "" },
    reserva: { id: null, mascota_id: DOG, entrada: MONDAY, salida: "2026-10-13", estado: "reservada", tambien_colegio: false, notas_comida: "", notas_medicacion: "", notas: "" },
    cupos: "50"
  }
});

test("la ruta del día incluye colegio y hotel+colegio, pero saca hotel y ausentes", () => {
  const s = base();
  s.reservas = [
    ...s.reservas,
    { id: "b23e4567-e89b-12d3-a456-426614174010", mascota_id: DOG, entrada: MONDAY, salida: "2026-10-14", estado: "reservada", tambien_colegio: true }
  ];
  s.ausencias = [{ id: "c23e4567-e89b-12d3-a456-426614174011", mascota_id: DOG, fecha: MONDAY }];
  const sinAusencia = { ...s, ausencias: [] };
  const hotelMasColegio = RutasViews.render(sinAusencia);
  assert.match(hotelMasColegio, /Hotel \+ colegio/);
  assert.doesNotMatch(hotelMasColegio, />Luna</);
  assert.doesNotMatch(RutasViews.render(s), /data-action="r-marcar-parada"/);
});

test("las vistas de rutas, hotel y hoy no insertan HTML dinámico ni código en línea", () => {
  const s = base();
  const html = ["hoy", "rutas", "hotel"].map((vista) => RutasViews.render({ ...s, vista })).join("\n");
  assert.match(html, /Ruta &lt;Norte&gt;/);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.doesNotMatch(html, /\sstyle=/i);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
});

test("el calendario y el hotel muestran noches, entradas, salidas y capacidad", () => {
  const s = base();
  s.vista = "hotel";
  s.reservas = [{ mascota_id: DOG, entrada: "2026-10-12", salida: "2026-10-14", estado: "reservada", tambien_colegio: false }];
  const html = RutasViews.render(s);
  assert.match(html, /Ocupación del hotel/);
  assert.match(html, /Capacidad configurada: <b>50<\/b>/);
  assert.match(html, /data-fecha="2026-10-12"/);
  assert.match(html, /Reservas de 2026-10/);
});

test("la selección del día deja visible el resumen del hotel y avisa reservas cruzadas", () => {
  const s = base();
  s.vista = "hotel";
  s.reservas = [
    { id: "923e4567-e89b-12d3-a456-426614174008", mascota_id: OTHER_DOG, entrada: "2026-10-11", salida: "2026-10-14", estado: "reservada" },
    { id: "a23e4567-e89b-12d3-a456-426614174009", mascota_id: OTHER_DOG, entrada: "2026-10-12", salida: "2026-10-15", estado: "en_curso" }
  ];
  const html = RutasViews.render(s);
  assert.match(html, /Resumen para /);
  assert.match(html, /Hay reservas superpuestas para Luna/);
  const dia = RutasViews.render({ ...s, vista: "hoy" });
  assert.match(dia, /No se incluyen en la ruta diaria hasta corregir las fechas/);
  assert.doesNotMatch(dia, /data-id="523e4567-e89b-12d3-a456-426614174004" data-estado=/);
});
