import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDraft, validateDraft, cleanPayload, buildDefaultsFile, uniqueId, move, setPath,
  blankCategory, blankService, leadWhatsapp, formatPhone, clone
} from "../src/admin/models/siteDraft.js";
import { SITE_DEFAULTS } from "../src/config/site.defaults.js";

const draft = () => normalizeDraft(clone(SITE_DEFAULTS));

test("normaliza los valores por defecto sin perder datos", () => {
  const d = draft();
  assert.equal(d.categorias.length, SITE_DEFAULTS.categorias.length);
  assert.ok(d.categorias.every((c) => c.tarjeta.puntos.every((p) => typeof p === "object")));
  assert.equal(d.negocio.razonSocial, "");
  assert.deepEqual(d.categorias.find((c) => c.tipo === "porDias").dias.length, 6);
});

test("los valores por defecto son válidos", () => {
  const { errors } = validateDraft(draft());
  assert.deepEqual(errors, []);
});

test("validación: WhatsApp, correo y enlaces", () => {
  const d = draft();
  d.negocio.whatsapp = "123"; d.negocio.correo = "mal"; d.negocio.redes.instagram = "instagram.com/x"; d.negocio.perfilGoogle = "maps";
  const { errors } = validateDraft(d);
  assert.equal(errors.length, 4);
});

test("el WhatsApp se limpia a dígitos al validar", () => {
  const d = draft(); d.negocio.whatsapp = "+57 (312) 304-4174";
  validateDraft(d);
  assert.equal(d.negocio.whatsapp, "573123044174");
});

test("validación: servicios sin nombre, precios inválidos y categorías sin título", () => {
  const d = draft();
  d.categorias[0].servicios[0].nombre = "  ";
  d.categorias[0].servicios[1].precio = -5;
  d.categorias[1].tarjeta.titulo = "";
  assert.equal(validateDraft(d).errors.length, 3);
});

test("categoría visible sin servicios activos: aviso, no error", () => {
  const d = draft();
  d.categorias[0].servicios.forEach((s) => { s.activo = false; });
  const { errors, warnings } = validateDraft(d);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
});

test("identificadores duplicados de categoría bloquean y cleanPayload los corrige", () => {
  const d = draft(); d.categorias[1].id = d.categorias[0].id;
  assert.equal(validateDraft(d).errors.length, 1);
  const p = cleanPayload(d);
  assert.equal(new Set(p.categorias.map((c) => c.id)).size, p.categorias.length);
});

test("cleanPayload: precios numéricos, sin vacíos y sin campos de otro tipo", () => {
  const d = draft();
  d.categorias[0].servicios[0].precio = "42000";
  d.categorias[0].servicios[0].descripcion = "";
  d.negocio.horarios.push("   ");
  d.categorias[0].tarjeta.puntos.push({ texto: "  ", destacado: false });
  d.categorias[0].tipo = "normal"; d.categorias[0].unidadPrecio = "por día";
  const p = cleanPayload(d);
  assert.equal(p.categorias[0].servicios[0].precio, 42000);
  assert.equal("descripcion" in p.categorias[0].servicios[0], false);
  assert.equal(p.negocio.horarios.length, 2);
  assert.equal(p.categorias[0].tarjeta.puntos.length, SITE_DEFAULTS.categorias[0].tarjeta.puntos.length);
  assert.equal("unidadPrecio" in p.categorias[0], false);
  assert.equal("dias" in p.categorias[0], false);
});

test("los datos limpios sobreviven a un ciclo completo (publicar → volver a cargar)", () => {
  const once = cleanPayload(draft());
  const twice = cleanPayload(normalizeDraft(once));
  assert.deepEqual(twice, once);
});

test("archivo de respaldo: módulo ES válido con los mismos datos", async () => {
  const payload = cleanPayload(draft());
  const source = buildDefaultsFile(payload, new Date("2026-10-03T12:00:00Z"));
  assert.match(source, /^\/\*\*[\s\S]*export const SITE_DEFAULTS = \{/);
  const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  assert.deepEqual(mod.SITE_DEFAULTS, payload);
});

test("uniqueId, move, setPath", () => {
  assert.equal(uniqueId("Baño Normal", []), "bano-normal");
  assert.equal(uniqueId("Baño Normal", ["bano-normal", "bano-normal-2"]), "bano-normal-3");
  assert.equal(uniqueId("", []), "item");
  const l = [1, 2, 3]; move(l, 0, -1); move(l, 0, 1); move(l, 2, 1);
  assert.deepEqual(l, [2, 1, 3]);
  const o = { a: { b: [{ c: 1 }] } }; setPath(o, "a.b.0.c", 9);
  assert.equal(o.a.b[0].c, 9);
});

test("categoría y servicio nuevos son válidos y con ids únicos", () => {
  const d = draft();
  const cat = blankCategory(d.categorias.map((c) => c.id));
  d.categorias.push(cat);
  d.categorias[0].servicios.push(blankService(d.categorias[0]));
  assert.deepEqual(validateDraft(d).errors, []);
});

test("teléfonos de los mensajes: agrega 57 a celulares de 10 dígitos", () => {
  assert.equal(leadWhatsapp("3001234567"), "573001234567");
  assert.equal(leadWhatsapp("573001234567"), "573001234567");
  assert.equal(leadWhatsapp("6011234567"), "6011234567");
  assert.equal(formatPhone("3001234567"), "300 123 4567");
});
