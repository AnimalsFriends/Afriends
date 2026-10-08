import test from "node:test";
import assert from "node:assert/strict";
import {
  blankDueno, blankMascota, blankVacuna, blankMedicamento, blankAutorizada, formDesdeFila,
  validarDueno, validarMascota, validarVacuna, validarMedicamento, validarAutorizada,
  normalizarTelefono, esFechaISO, hoyBogota, estadoVencimiento, fechaLegible, filtrarDuenos, mascotasActivas
} from "../src/admin/models/gestionModel.js";

const dueno = (extra = {}) => ({ ...blankDueno(), nombre: "Ana Pérez", telefono: "312 304 4174", ...extra });
const mascota = (extra = {}) => ({ ...blankMascota(), nombre: "Max", ...extra });
const UUID = "123e4567-e89b-12d3-a456-426614174000";

/* ------------------------------ teléfonos y fechas ------------------------------ */
test("teléfonos: solo dígitos y el 57 delante en celulares colombianos", () => {
  assert.equal(normalizarTelefono("312 304 4174"), "573123044174");
  assert.equal(normalizarTelefono("+57 (312) 304-4174"), "573123044174");
  assert.equal(normalizarTelefono(""), "");
  assert.equal(normalizarTelefono(null), "");
});

test("fechas: acepta las reales y rechaza las imposibles", () => {
  assert.equal(esFechaISO("2026-10-08"), true);
  assert.equal(esFechaISO("2028-02-29"), true);
  assert.equal(esFechaISO("2027-02-29"), false);
  assert.equal(esFechaISO("2026-13-01"), false);
  assert.equal(esFechaISO("08/10/2026"), false);
  assert.equal(esFechaISO(""), false);
});

/* ------------------------------ dueño ------------------------------ */
test("dueño válido: limpia espacios y deja null lo vacío", () => {
  const { errors, clean } = validarDueno(dueno({ nombre: "  Ana   Pérez ", correo: "", direccion: "  Calle 1 # 2-3 " }));
  assert.deepEqual(errors, []);
  assert.equal(clean.nombre, "Ana Pérez");
  assert.equal(clean.telefono, "573123044174");
  assert.equal(clean.correo, null);
  assert.equal(clean.direccion, "Calle 1 # 2-3");
  assert.equal(clean.contacto_emergencia_telefono, null);
});

test("dueño: exige nombre y teléfono, y revisa correo y emergencia", () => {
  assert.equal(validarDueno(blankDueno()).errors.length, 2);
  assert.ok(validarDueno(dueno({ telefono: "123" })).errors.some((e) => /teléfono/i.test(e)));
  assert.ok(validarDueno(dueno({ correo: "ana@" })).errors.some((e) => /correo/i.test(e)));
  assert.ok(validarDueno(dueno({ contacto_emergencia_telefono: "12" })).errors.some((e) => /emergencia/i.test(e)));
  assert.deepEqual(validarDueno(dueno({ contacto_emergencia_nombre: "Luis", contacto_emergencia_telefono: "3001112233", contacto_emergencia_parentesco: "Hermano" })).errors, []);
});

/* ------------------------------ mascota ------------------------------ */
test("mascota válida: vacíos a null y comidas como número", () => {
  const { errors, clean } = validarMascota(mascota({ raza: "Criollo", genero: "macho", comidas_por_dia: "2" }));
  assert.deepEqual(errors, []);
  assert.equal(clean.raza, "Criollo");
  assert.equal(clean.tamano, null);
  assert.equal(clean.comidas_por_dia, 2);
  assert.equal(validarMascota(mascota()).clean.comidas_por_dia, null);
});

test("mascota: bravo y enfermo exigen su explicación, y se descarta si se apagan", () => {
  assert.ok(validarMascota(mascota({ es_bravo: true })).errors.some((e) => /bravo/i.test(e)));
  assert.ok(validarMascota(mascota({ esta_enfermo: true })).errors.some((e) => /enfermo/i.test(e)));
  const ok = validarMascota(mascota({ es_bravo: true, nota_comportamiento: "Muerde con extraños", esta_enfermo: true, detalle_enfermedad: "Otitis" }));
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.clean.nota_comportamiento, "Muerde con extraños");
  const apagado = validarMascota(mascota({ es_bravo: false, nota_comportamiento: "texto viejo", esta_enfermo: false, detalle_enfermedad: "viejo" }));
  assert.equal(apagado.clean.nota_comportamiento, null);
  assert.equal(apagado.clean.detalle_enfermedad, null);
});

test("mascota: límites de nombre, género y comidas", () => {
  assert.ok(validarMascota(mascota({ nombre: "" })).errors.length);
  assert.ok(validarMascota(mascota({ nombre: "x".repeat(61) })).errors.length);
  assert.ok(validarMascota(mascota({ genero: "otro" })).errors.length);
  for (const malo of ["0", "11", "2.5", "abc"]) assert.ok(validarMascota(mascota({ comidas_por_dia: malo })).errors.length, malo);
});

/* ------------------------------ vacunas, medicamentos, autorizados ------------------------------ */
test("vacuna: el vencimiento es obligatorio y no puede ser anterior a la aplicación", () => {
  const base = { ...blankVacuna(), nombre: "Rabia" };
  assert.ok(validarVacuna(base).errors.some((e) => /vencimiento/i.test(e)));
  assert.deepEqual(validarVacuna({ ...base, fecha_vencimiento: "2027-01-10" }).errors, []);
  assert.ok(validarVacuna({ ...base, fecha_aplicacion: "2026-05-01", fecha_vencimiento: "2026-04-01" }).errors.length);
  assert.ok(validarVacuna({ ...base, tipo: "otra", fecha_vencimiento: "2027-01-10" }).errors.length);
  assert.equal(validarVacuna({ ...base, fecha_vencimiento: "2027-01-10" }).clean.fecha_aplicacion, null);
});

test("medicamento: nombre obligatorio y fechas coherentes", () => {
  assert.ok(validarMedicamento(blankMedicamento()).errors.length);
  const ok = validarMedicamento({ ...blankMedicamento(), medicamento: "Amoxicilina", dosis: "5 ml", horario: "8 y 20" });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.clean.fecha_inicio, null);
  assert.ok(validarMedicamento({ ...blankMedicamento(), medicamento: "Amoxicilina", fecha_inicio: "2026-10-10", fecha_fin: "2026-10-01" }).errors.length);
});

test("persona autorizada: sin perro elegido vale para todos", () => {
  const todos = validarAutorizada({ ...blankAutorizada(), nombre: "Carlos Ruiz", telefono: "3001112233" });
  assert.deepEqual(todos.errors, []);
  assert.equal(todos.clean.mascota_id, null);
  assert.equal(validarAutorizada({ ...blankAutorizada(), nombre: "Carlos Ruiz", mascota_id: UUID }).clean.mascota_id, UUID);
  assert.ok(validarAutorizada({ ...blankAutorizada(), nombre: "Carlos Ruiz", mascota_id: "no-es-uuid" }).errors.length);
  assert.ok(validarAutorizada(blankAutorizada()).errors.length);
});

/* ------------------------------ ayudas de pantalla ------------------------------ */
test("formDesdeFila convierte null en texto vacío y respeta los booleanos", () => {
  const f = formDesdeFila({ nombre: "Max", raza: null, comidas_por_dia: 3, es_bravo: true, otra: "x" }, blankMascota);
  assert.equal(f.raza, "");
  assert.equal(f.comidas_por_dia, "3");
  assert.equal(f.es_bravo, true);
  assert.equal(f.esta_enfermo, false);
  assert.equal("otra" in f, false);
});

test("hoy se calcula en hora de Colombia, no en UTC", () => {
  assert.equal(hoyBogota(new Date("2026-10-08T03:00:00Z")), "2026-10-07");   // 10 p. m. del día 7 en Bogotá
  assert.equal(hoyBogota(new Date("2026-10-08T06:00:00Z")), "2026-10-08");
});

test("vencimiento: solo distingue vencida de vigente (el aviso previo se define en la Fase 7)", () => {
  assert.equal(estadoVencimiento("2026-10-07", "2026-10-08"), "vencida");
  assert.equal(estadoVencimiento("2026-10-08", "2026-10-08"), "vigente");
  assert.equal(estadoVencimiento("2027-01-01", "2026-10-08"), "vigente");
});

test("fecha legible no se corre un día por la zona horaria", () => {
  assert.match(fechaLegible("2026-10-12"), /12/);
  assert.equal(fechaLegible("basura"), "");
});

test("buscador: por dueño, por perro o por teléfono, sin tildes; los desactivados solo si se piden", () => {
  const duenos = [
    { id: "1", nombre: "María Gómez", telefono: "573001112233", activo: true, mascotas: [{ nombre: "Toby", activa: true }, { nombre: "Luna", activa: false }] },
    { id: "2", nombre: "Pedro Ruiz", telefono: "573104445566", activo: true, mascotas: [{ nombre: "Rocky", activa: true }] },
    { id: "3", nombre: "Antiguo Cliente", telefono: "573000000000", activo: false, mascotas: [] }
  ];
  assert.equal(filtrarDuenos(duenos).length, 2);
  assert.equal(filtrarDuenos(duenos, "", true).length, 3);
  assert.deepEqual(filtrarDuenos(duenos, "maria").map((d) => d.id), ["1"]);
  assert.deepEqual(filtrarDuenos(duenos, "ROCKY").map((d) => d.id), ["2"]);
  assert.deepEqual(filtrarDuenos(duenos, "310444").map((d) => d.id), ["2"]);
  assert.deepEqual(filtrarDuenos(duenos, "toby").map((d) => d.id), ["1"]);
  assert.deepEqual(filtrarDuenos(duenos, "antiguo", true).map((d) => d.id), ["3"]);
  assert.equal(filtrarDuenos(duenos, "antiguo").length, 0);
  assert.deepEqual(mascotasActivas(duenos[0]).map((m) => m.nombre), ["Toby"]);
});
