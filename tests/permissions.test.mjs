import test from "node:test";
import assert from "node:assert/strict";
import { modulosPorRol, puedeEjecutarAccion, puedeVerModulo } from "../src/admin/models/permissions.js";

test("admin conserva todos los módulos existentes y empleado solo recibe módulos operativos", () => {
  assert.deepEqual(modulosPorRol("admin"), ["negocio", "servicios", "leads", "gestion", "rutas", "agenda", "finanzas", "seguimiento"]);
  assert.deepEqual(modulosPorRol("empleado"), ["gestion", "rutas"]);
  for (const modulo of ["negocio", "servicios", "leads", "agenda", "finanzas", "seguimiento"]) {
    assert.equal(puedeVerModulo("empleado", modulo), false, `${modulo} no debe abrirse por navegación directa`);
  }
});

test("las acciones de empleado se limitan a consultar y actualizar estados operativos de ruta", () => {
  assert.equal(puedeEjecutarAccion("empleado", "rutas", "marcar_parada"), true);
  assert.equal(puedeEjecutarAccion("empleado", "rutas", "cambiar_fecha"), true);
  assert.equal(puedeEjecutarAccion("empleado", "rutas", "crear_ruta"), false);
  assert.equal(puedeEjecutarAccion("empleado", "rutas", "crear_reserva"), false);
  assert.equal(puedeEjecutarAccion("empleado", "gestion", "crear_dueno"), false);
  assert.equal(puedeEjecutarAccion("empleado", "finanzas", "registrar_gasto"), false);
  assert.equal(puedeEjecutarAccion("offline", "rutas", "marcar_parada"), false);
});
