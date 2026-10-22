import test from "node:test";
import assert from "node:assert/strict";
import { modulosPorRol, puedeEjecutarAccion, puedeVerModulo } from "../src/admin/models/permissions.js";

test("admin conserva sus módulos y empleado recibe módulos operativos y catálogo de solo lectura", () => {
  assert.deepEqual(modulosPorRol("admin"), ["negocio", "servicios", "leads", "conversaciones", "gestion", "rutas", "agenda", "finanzas", "seguimiento"]);
  assert.deepEqual(modulosPorRol("empleado"), ["servicios", "gestion", "rutas", "conversaciones"]);
  for (const modulo of ["negocio", "leads", "agenda", "finanzas", "seguimiento"]) {
    assert.equal(puedeVerModulo("empleado", modulo), false, `${modulo} no debe abrirse por navegación directa`);
  }
  assert.equal(puedeVerModulo("empleado", "servicios"), true);
  assert.equal(puedeVerModulo("empleado", "conversaciones"), true);
});

test("las acciones de empleado se limitan a consultar y actualizar estados operativos de ruta", () => {
  assert.equal(puedeEjecutarAccion("empleado", "rutas", "marcar_parada"), true);
  assert.equal(puedeEjecutarAccion("empleado", "rutas", "cambiar_fecha"), true);
  assert.equal(puedeEjecutarAccion("empleado", "rutas", "crear_ruta"), false);
  assert.equal(puedeEjecutarAccion("empleado", "rutas", "crear_reserva"), false);
  assert.equal(puedeEjecutarAccion("empleado", "gestion", "crear_dueno"), false);
  assert.equal(puedeEjecutarAccion("empleado", "finanzas", "registrar_gasto"), false);
  assert.equal(puedeEjecutarAccion("empleado", "servicios", "consultar"), true);
  assert.equal(puedeEjecutarAccion("empleado", "servicios", "editar"), false);
  assert.equal(puedeEjecutarAccion("offline", "rutas", "marcar_parada"), false);
});
