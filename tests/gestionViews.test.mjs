import test from "node:test";
import assert from "node:assert/strict";
import { GestionViews } from "../src/admin/views/gestionViews.js";
import { blankDueno, blankMascota, blankVacuna, blankMedicamento, blankAutorizada } from "../src/admin/models/gestionModel.js";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const MID = "223e4567-e89b-12d3-a456-426614174001";
const base = () => ({
  loading: false, error: null, isAdmin: true, q: "", verInactivos: false, vista: "lista",
  duenos: [{ id: ID, nombre: "Ana <b>Pérez</b>", telefono: "573123044174", activo: true,
    mascotas: [{ id: MID, nombre: "Max", raza: "Criollo", activa: true, es_bravo: true, esta_enfermo: false, toma_medicamentos: true }] }],
  dueno: { id: ID, form: { ...blankDueno(), nombre: "Ana", telefono: "573123044174" }, autorizadas: [] },
  mascota: { id: MID, form: { ...blankMascota(), nombre: "Max", toma_medicamentos: true }, activa: true, foto_path: null, vacunas: [], medicamentos: [] },
  fotoUrl: null,
  sub: { autorizada: blankAutorizada(), vacuna: blankVacuna(), medicamento: blankMedicamento() }
});
const todas = (s) => ["lista", "dueno", "mascota"].map((vista) => GestionViews.render({ ...s, vista })).join("\n");

test("las tres vistas se pintan sin errores", () => {
  for (const vista of ["lista", "dueno", "mascota"]) assert.ok(GestionViews.render({ ...base(), vista }).length > 200, vista);
});

test("CSP: ninguna vista usa style= ni manejadores onclick= en línea", () => {
  const html = todas(base());
  assert.doesNotMatch(html, /\sstyle=/i);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
});

test("el texto que viene de la base de datos se escapa (no se puede inyectar HTML)", () => {
  const s = base();
  s.duenos[0].mascotas[0].nombre = '<img src=x onerror="alert(1)">';
  s.mascota.form.nombre = '"><script>alert(1)</script>';
  const html = todas(s);
  assert.doesNotMatch(html, /<script>/i);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.doesNotMatch(html, /<b>Pérez<\/b>/);
  assert.match(html, /&lt;b&gt;P/);
});

test("lista: muestra el dueño, su teléfono con enlace a WhatsApp y sus perros", () => {
  const html = GestionViews.render(base());
  assert.match(html, /https:\/\/wa\.me\/573123044174/);
  assert.match(html, /1 perro</);
  assert.match(html, /🐾 Max/);
  assert.match(html, /data-action="g-abrir-dueno" data-id="123e4567/);
});

test("lista vacía y búsqueda sin resultados dan mensajes distintos", () => {
  assert.match(GestionViews.render({ ...base(), duenos: [] }), /Aún no hay dueños/);
  assert.match(GestionViews.render({ ...base(), q: "zzzz" }), /Nadie coincide/);
});

test("un dueño nuevo no ofrece perros ni autorizados hasta guardarse", () => {
  const s = { ...base(), vista: "dueno", dueno: { id: null, form: blankDueno(), autorizadas: [] } };
  const html = GestionViews.render(s);
  assert.match(html, /Nuevo dueño/);
  assert.doesNotMatch(html, /g-nueva-mascota/);
  assert.doesNotMatch(html, /g-add-autorizada/);
  assert.match(html, /Guarda primero/);
});

test("dueño guardado ofrece perros y personas autorizadas", () => {
  const html = GestionViews.render({ ...base(), vista: "dueno" });
  assert.match(html, /g-nueva-mascota/);
  assert.match(html, /g-add-autorizada/);
  assert.match(html, /Bravo/);
});

test("mascota: bravo y enfermo muestran su campo solo cuando están activados", () => {
  const s = { ...base(), vista: "mascota" };
  assert.doesNotMatch(GestionViews.render(s), /data-g="nota_comportamiento"/);
  s.mascota.form.es_bravo = true;
  assert.match(GestionViews.render(s), /data-g="nota_comportamiento"/);
  assert.doesNotMatch(GestionViews.render(s), /data-g="detalle_enfermedad"/);
  s.mascota.form.esta_enfermo = true;
  assert.match(GestionViews.render(s), /data-g="detalle_enfermedad"/);
});

test("mascota nueva: sin foto, vacunas ni medicamentos hasta guardarse", () => {
  const s = { ...base(), vista: "mascota", mascota: { id: null, form: blankMascota(), activa: true, foto_path: null, vacunas: [], medicamentos: [] } };
  const html = GestionViews.render(s);
  assert.doesNotMatch(html, /data-g-foto/);
  assert.doesNotMatch(html, /g-add-vacuna/);
  assert.match(html, /Guarda primero/);
});

test("vacunas: marca las vencidas y avisa si falta anotar medicamentos", () => {
  const s = { ...base(), vista: "mascota" };
  s.mascota.vacunas = [
    { id: "a", tipo: "vacuna", nombre: "Rabia", fecha_aplicacion: null, fecha_vencimiento: "2020-01-01" },
    { id: "b", tipo: "desparasitacion", nombre: "Antiparasitario", fecha_aplicacion: null, fecha_vencimiento: "2999-01-01" }
  ];
  const html = GestionViews.render(s);
  assert.equal((html.match(/>Vencida</g) || []).length, 1);
  assert.match(html, /aún no hay ninguno anotado/);
});

test("la foto lleva texto alternativo con el nombre del perro", () => {
  const s = { ...base(), vista: "mascota", fotoUrl: "data:image/webp;base64,AAAA" };
  assert.match(GestionViews.render(s), /alt="Foto de Max"/);
});

test("estados de error y de usuario sin rol de admin", () => {
  assert.match(GestionViews.render({ ...base(), error: "missing" }), /migraciones de la Fase 1/);
  assert.match(GestionViews.render({ ...base(), error: "perm" }), /no tiene permiso/);
  assert.match(GestionViews.render({ ...base(), isAdmin: false }), /Crear tu usuario admin/);
  assert.match(GestionViews.render({ ...base(), loading: true }), /Cargando/);
});
