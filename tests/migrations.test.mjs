/**
 * Revisión estática de las migraciones de Supabase.
 *
 * Por qué existe: en CI no hay una base Postgres para ejecutar las migraciones, y
 * lo peor que puede pasar con una tabla nueva es olvidar activar RLS o dejarla
 * abierta al público. Esta prueba lee los .sql y falla si alguna tabla creada en
 * supabase/migrations:
 *   - no activa Row Level Security,
 *   - no le quita el acceso al rol anónimo (revoke ... from anon),
 *   - no tiene una política de admin (es_admin()),
 *   - o no tiene su "rollback" que la elimine.
 * NO prueba que el SQL sea válido ni que las políticas hagan lo correcto: eso
 * hay que verificarlo contra Supabase (ver supabase/README.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const ROLLBACKS = "supabase/rollbacks";

const leer = (dir) =>
  readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => ({ f, sql: readFileSync(join(dir, f), "utf8") }));

// Quita comentarios "-- ..." para no confundirnos con texto explicativo.
const sinComentarios = (sql) => sql.replace(/--.*$/gm, "");

const migraciones = leer(DIR);
const todo = sinComentarios(migraciones.map((m) => m.sql).join("\n"));
const rollbacks = sinComentarios(leer(ROLLBACKS).map((m) => m.sql).join("\n"));

const tablas = [...todo.matchAll(/create table if not exists public\.(\w+)/gi)].map((m) => m[1]);

test("hay tablas nuevas que revisar", () => {
  assert.ok(tablas.length >= 18, `se esperaban al menos 18 tablas, hay ${tablas.length}`);
});

for (const t of tablas) {
  test(`tabla ${t}: RLS activo, sin acceso anónimo, política de admin y rollback`, () => {
    assert.match(todo, new RegExp(`alter table public\\.${t}\\s+enable row level security`, "i"), "falta enable row level security");

    const revokes = [...todo.matchAll(/revoke all on([\s\S]*?)from anon;/gi)].map((m) => m[1]).join(" ");
    assert.match(revokes, new RegExp(`public\\.${t}\\b`), "falta revoke all ... from anon");

    const hayAdmin = [...todo.matchAll(/create policy "[^"]+" on public\.(\w+)[\s\S]*?;/gi)]
      .some((m) => m[1] === t && /es_admin\(\)/.test(m[0]));
    assert.ok(hayAdmin, "falta una política que use es_admin()");

    assert.match(rollbacks, new RegExp(`drop table if exists public\\.${t};`, "i"), "falta el drop en los rollbacks");
  });
}

test("las funciones de apoyo no quedan abiertas al público", () => {
  const funciones = [...todo.matchAll(/create or replace function public\.(es_admin|empleado_actual_id|ruta_es_mia|parada_es_mia|mascota_asignada_a_mi|dueno_asignado_a_mi)\(/gi)].map((m) => m[1]);
  assert.equal(funciones.length, 6);
  for (const fn of funciones) {
    assert.match(todo, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\)\\s+from public, anon`, "i"), `falta revoke en ${fn}`);
    assert.match(todo, new RegExp(`function public\\.${fn}\\([^)]*\\)[\\s\\S]*?security definer\\s+set search_path = ''`, "i"), `${fn} debe ser security definer con search_path vacío`);
  }
});

test("el empleado no tiene ninguna política sobre tablas de dinero", () => {
  const dinero = ["gastos", "pagos", "abonos", "parametros_operativos"];
  for (const t of dinero) {
    const otras = [...todo.matchAll(/create policy "([^"]+)" on public\.(\w+)/gi)].filter((m) => m[2] === t && m[1] !== "admin_total");
    assert.equal(otras.length, 0, `${t} solo debe tener la política admin_total`);
  }
});

test("ninguna migración borra datos ni tablas (todo lo destructivo vive en rollbacks)", () => {
  assert.doesNotMatch(todo, /\bdrop\s+table\b/i);
  assert.doesNotMatch(todo, /\btruncate\b/i);
  assert.doesNotMatch(todo, /\bdelete\s+from\b/i);
});

test("los paréntesis de cada migración están balanceados", () => {
  for (const { f, sql } of migraciones) {
    const limpio = sinComentarios(sql).replace(/'[^']*'/g, "''");
    const abre = (limpio.match(/\(/g) || []).length;
    const cierra = (limpio.match(/\)/g) || []).length;
    assert.equal(abre, cierra, `${f}: paréntesis desbalanceados`);
  }
});
