import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20261111120000_operacion_empleado_resiliente.sql", "utf8");
const down = readFileSync("supabase/rollbacks/20261111120000_operacion_empleado_resiliente_down.sql", "utf8");
const base = readFileSync("supabase/migrations/20261007100200_fase1_rutas_hotel_y_agenda.sql", "utf8");

test("la preparación diaria del empleado queda limitada por RLS y es idempotente", () => {
  assert.match(sql, /grant insert \(parada_id, fecha\) on public\.paradas_dia to authenticated/i);
  assert.match(sql, /for insert to authenticated\s+with check \(public\.parada_es_mia\(parada_id\)\)/i);
  assert.match(base, /constraint paradas_dia_unica unique \(parada_id, fecha\)/i,
    "la tabla base debe conservar el candado de idempotencia");
  assert.match(sql, /on_conflict del cliente hacen la operación idempotente/i);
  const trigger = sql.match(/create or replace function public\.tg_paradas_dia_marcar\(\)[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.ok(trigger, "falta el trigger autoritativo de marcas de tiempo");
  assert.doesNotMatch(trigger, /security definer/i, "el trigger no debe elevar permisos");
});

test("la ficha asignada contempla empleados secundarios de una cita", () => {
  assert.match(sql, /from public\.cita_empleados ce/i);
  assert.match(sql, /ce\.empleado_id = public\.empleado_actual_id\(\)/i);
  assert.match(sql, /revoke all on function public\.mascota_asignada_a_mi\(uuid\) from public, anon/i);
});

test("las horas del dispositivo y del servidor quedan separadas", () => {
  assert.match(sql, /add column if not exists ocurrido_cliente_en timestamptz/i);
  assert.match(sql, /add column if not exists sincronizado_en timestamptz/i);
  assert.match(sql, /new\.sincronizado_en := statement_timestamp\(\)/i);
  assert.match(sql, /grant update \(estado, motivo, ocurrido_cliente_en\)/i);
});

test("el rollback conserva los datos operativos", () => {
  assert.doesNotMatch(down, /drop column|drop table|truncate|delete from/i);
  assert.match(down, /drop policy if exists "empleado_prepara_sus_paradas"/i);
});
