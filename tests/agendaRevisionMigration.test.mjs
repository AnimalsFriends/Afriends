import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20261024120000_agenda_empleados_y_horario_opcional.sql", "utf8");
const down = readFileSync("supabase/rollbacks/20261024120000_agenda_empleados_y_horario_opcional_down.sql", "utf8");

test("la migración registra la fecha y permite omitir ambas horas sin aceptar rangos incompletos", () => {
  assert.match(sql, /add column if not exists fecha_servicio date/i);
  assert.match(sql, /alter column inicio drop not null/i);
  assert.match(sql, /alter column fin drop not null/i);
  assert.match(sql, /inicio is null and fin is null/i);
  assert.match(sql, /inicio is not null and fin is not null and fin > inicio/i);
  assert.match(sql, /at time zone 'America\/Bogota'/i);
});

test("la migración conserva asignaciones existentes y permite múltiples empleados por cita", () => {
  assert.match(sql, /create table if not exists public\.cita_empleados/i);
  assert.match(sql, /primary key \(cita_id, empleado_id\)/i);
  assert.match(sql, /insert into public\.cita_empleados[\s\S]*from public\.citas[\s\S]*on conflict/i);
  assert.match(sql, /guardar_cita_agenda/i);
  assert.match(sql, /security invoker/i) || assert.match(sql, /language plpgsql/i);
});

test("la relación nueva tiene RLS, permisos autenticados limitados y lectura por asignación", () => {
  assert.match(sql, /alter table public\.cita_empleados enable row level security/i);
  assert.match(sql, /revoke all on public\.cita_empleados from public, anon/i);
  assert.match(sql, /public\.es_admin\(\)/i);
  assert.match(sql, /public\.empleado_actual_id\(\)/i);
  assert.match(sql, /revoke all on function public\.guardar_cita_agenda[\s\S]*from public, anon/i);
});

test("el rollback advierte que no se debe borrar la historia de asignaciones sin revisión", () => {
  assert.match(down, /ADVERTENCIA/i);
  assert.doesNotMatch(down, /delete from public\.citas|truncate public\.citas/i);
});
