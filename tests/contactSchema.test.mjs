import test from "node:test";
import assert from "node:assert/strict";
import { validateContact, LIMITS } from "../src/shared/contactSchema.js";

const valid = { nombre: "  Ana   María ", telefono: "+57 (300) 123-4567", correo: "ANA@Correo.CO ", mascota: "Max", servicio: "banos", mensaje: "Hola\n\n\n\nquiero info", aceptaDatos: true };

test("acepta datos válidos y los normaliza", () => {
  const r = validateContact(valid);
  assert.equal(r.ok, true);
  assert.deepEqual(r.clean, { nombre: "Ana María", telefono: "573001234567", correo: "ana@correo.co", mascota: "Max", servicio: "banos", mensaje: "Hola\n\nquiero info" });
});

test("solo nombre, teléfono y autorización son obligatorios", () => {
  assert.equal(validateContact({ nombre: "Ana", telefono: "3001234567", aceptaDatos: true }).ok, true);
});

test("rechaza la falta de autorización de datos (Habeas Data)", () => {
  assert.equal(validateContact({ ...valid, aceptaDatos: false }).errors.aceptaDatos, "requerido");
  assert.equal(validateContact({ ...valid, aceptaDatos: "true" }).errors.aceptaDatos, "requerido");   // solo true booleano
});

test("valida nombre", () => {
  assert.equal(validateContact({ ...valid, nombre: "" }).errors.nombre, "requerido");
  assert.equal(validateContact({ ...valid, nombre: "A" }).errors.nombre, "corto");
  assert.equal(validateContact({ ...valid, nombre: "x".repeat(LIMITS.nombre.max + 1) }).errors.nombre, "largo");
});

test("valida teléfono (7 a 15 dígitos)", () => {
  assert.equal(validateContact({ ...valid, telefono: "" }).errors.telefono, "requerido");
  assert.equal(validateContact({ ...valid, telefono: "12345" }).errors.telefono, "invalido");
  assert.equal(validateContact({ ...valid, telefono: "1".repeat(16) }).errors.telefono, "invalido");
});

test("valida correo opcional", () => {
  assert.equal(validateContact({ ...valid, correo: "no-es-correo" }).errors.correo, "invalido");
  assert.equal(validateContact({ ...valid, correo: "" }).ok, true);
});

test("servicio solo admite ids seguros", () => {
  assert.equal(validateContact({ ...valid, servicio: "<script>" }).errors.servicio, "invalido");
  assert.equal(validateContact({ ...valid, servicio: "otro" }).ok, true);
});

test("mensaje: límite de largo y de enlaces (antispam)", () => {
  assert.equal(validateContact({ ...valid, mensaje: "x".repeat(LIMITS.mensaje.max + 1) }).errors.mensaje, "largo");
  assert.equal(validateContact({ ...valid, mensaje: "http://a.co http://b.co https://c.co" }).errors.mensaje, "enlaces");
  assert.equal(validateContact({ ...valid, mensaje: "mira http://a.co" }).ok, true);
});

test("elimina caracteres de control y no falla con entradas raras", () => {
  const r = validateContact({ nombre: "An\u0000a\u0007", telefono: "3001234567", aceptaDatos: true, mensaje: null, correo: undefined });
  assert.equal(r.clean.nombre, "Ana");
  assert.equal(validateContact().ok, false);
  assert.equal(validateContact(null ?? undefined).ok, false);
});
