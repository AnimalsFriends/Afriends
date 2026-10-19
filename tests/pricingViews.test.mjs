import test from "node:test";
import assert from "node:assert/strict";
import { ServicesView } from "../src/views/ServicesView.js";
import { AdminViews } from "../src/admin/views/adminViews.js";

const category = (tipoPrecio, precio) => ({
  id: "servicio",
  tarjeta: { titulo: "Servicio", icono: "🐾", descripcion: "", puntos: [] },
  servicios: [{ id: "opcion", nombre: "Opción", activo: true, tipoPrecio, precio }]
});

test("tarjetas públicas no presentan un precio desconocido como cero", () => {
  const unknown = ServicesView.cards([category("sin_definir", null)], "COP");
  const quote = ServicesView.cards([category("cotizar", null)], "COP");
  const free = ServicesView.cards([category("gratis", 0)], "COP");
  const mixedCategory = category("fijo", 12000);
  mixedCategory.servicios.push({ id: "quote", nombre: "Cotizar", activo: true, tipoPrecio: "cotizar", precio: null });
  const mixed = ServicesView.cards([mixedCategory], "COP");

  assert.match(unknown, /Precio por confirmar/);
  assert.doesNotMatch(unknown, /\$0 COP/);
  assert.match(quote, /Por cotizar/);
  assert.match(free, /Gratis/);
  assert.match(mixed, /Desde \$12\.000 COP/);
  assert.match(mixed, /Algunas opciones son por cotizar/);
});

test("el panel permite clasificar el precio y solo solicita monto para precio fijo", () => {
  const unknown = AdminViews.service({}, 0, { id: "x", nombre: "Servicio", activo: true, tipoPrecio: "sin_definir", precio: null }, 0);
  const fixed = AdminViews.service({}, 0, { id: "x", nombre: "Servicio", activo: true, tipoPrecio: "fijo", precio: 12000 }, 0);

  assert.match(unknown, /value="sin_definir" selected/);
  assert.match(unknown, /value="cotizar"/);
  assert.match(unknown, /value="gratis"/);
  assert.doesNotMatch(unknown, /class="adm-price"/);
  assert.match(fixed, /class="adm-price"/);
});
