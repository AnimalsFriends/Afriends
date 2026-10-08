/**
 * Revisión estática de las migraciones de Supabase.
 *
 * Por qué existe: en CI no hay una base Postgres para ejecutar las migraciones, y
 * lo peor que puede pasar con una tabla nueva es olvidar activar RLS o dejarla
 * abierta al público. Esta prueba lee los .sql y falla si alguna tabla creada en
 * supabase/migrations:
 *   - no activa Row Level Security,
 *   - no limita el acceso anónimo permitido expresamente para site_config,
 *   - no tiene una política de admin (es_admin()),
 *   - o, si es una tabla nueva de Fase 1, no tiene rollback.
 * Las tablas históricas site_config/contact_requests se conservan: la primera
 * necesita lectura pública y ninguna debe borrarse al deshacer la Fase 1.
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
const tablasHistoricas = new Set(["site_config", "contact_requests"]);

test("hay tablas nuevas que revisar", () => {
  assert.ok(tablas.length >= 18, `se esperaban al menos 18 tablas, hay ${tablas.length}`);
});

for (const t of tablas) {
  test(`tabla ${t}: RLS activo, acceso público limitado, política de admin y rollback versionado`, () => {
    assert.match(todo, new RegExp(`alter table public\\.${t}\\s+enable row level security`, "i"), "falta enable row level security");

    if (t === "site_config") {
      const grants = [...todo.matchAll(/grant\s+([^;]+?)\s+on\s+public\.site_config\s+to\s+([^;]+);/gi)];
      const anonPrivileges = grants
        .filter(([, , roles]) => roles.split(",").some((role) => role.trim().toLowerCase() === "anon"))
        .flatMap(([, privileges]) => privileges.split(",").map((privilege) => privilege.trim().toLowerCase()));
      assert.deepEqual(anonPrivileges, ["select"], "site_config solo puede conceder lectura al público");
      assert.match(todo, /create policy "lectura publica"\s+on public\.site_config for select\s+using\s*\(true\)/i,
        "falta la política pública de solo lectura");
    } else {
      const anonRevokes = [...todo.matchAll(/revoke all on([\s\S]*?)from ([^;]+);/gi)]
        .some(([, objects, roles]) =>
          new RegExp(`public\\.${t}\\b`, "i").test(objects)
          && roles.split(",").some((role) => role.trim().toLowerCase() === "anon"));
      assert.ok(anonRevokes, "falta revoke all para anon");
    }

    const hayAdmin = [...todo.matchAll(/create policy "[^"]+" on public\.(\w+)[\s\S]*?;/gi)]
      .some((m) => m[1] === t && /es_admin\(\)/.test(m[0]));
    assert.ok(hayAdmin, "falta una política que use es_admin()");

    if (tablasHistoricas.has(t)) {
      assert.doesNotMatch(rollbacks, new RegExp(`drop table if exists public\\.${t};`, "i"),
        "el rollback de Fase 1 no debe borrar una tabla histórica");
    } else {
      assert.match(rollbacks, new RegExp(`drop table if exists public\\.${t};`, "i"), "falta el drop en los rollbacks");
    }
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
