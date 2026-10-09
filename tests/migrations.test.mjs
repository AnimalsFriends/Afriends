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
const rollbacksPosterioresALasTablasPublicas = sinComentarios(leer(ROLLBACKS)
  .filter(({ f }) => f !== "20261005143000_crear_site_config_contact_requests_down.sql")
  .map((m) => m.sql).join("\n"));

const tablas = [...todo.matchAll(/create table if not exists public\.(\w+)/gi)].map((m) => m[1]);
const tablasHistoricas = new Set(["site_config", "contact_requests"]);
const tablasConRollbackNoDestructivo = new Set(["soat_vehiculos", "asistencia_colegio", "historial_cambios"]);
const rollbackFase7 = leer(ROLLBACKS).find(({ f }) => f === "20261012120000_fase7_alertas_asistencia_historial_down.sql");

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

    if (tablasHistoricas.has(t) || tablasConRollbackNoDestructivo.has(t)) {
      const comprobacion = tablasHistoricas.has(t) ? rollbacksPosterioresALasTablasPublicas : rollbacks;
      assert.doesNotMatch(comprobacion, new RegExp(`drop table if exists public\\.${t};`, "i"),
        "un rollback posterior no debe borrar tablas que pueden contener datos reales");
      if (tablasConRollbackNoDestructivo.has(t)) {
        assert.ok(rollbackFase7, "falta el rollback seguro de Fase 7");
        assert.doesNotMatch(rollbackFase7.sql, /drop table|truncate|delete from/i, "Fase 7 conserva los datos operativos");
      }
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

test("dueños y mascotas no se pueden borrar desde sesiones autenticadas", () => {
  const migracion = migraciones.find(({ f }) => f === "20261008190000_fase2_evitar_borrado_duenos_mascotas.sql");
  const rollback = leer(ROLLBACKS).find(({ f }) => f === "20261008190000_fase2_evitar_borrado_duenos_mascotas_down.sql");
  assert.ok(migracion, "falta la migración que protege el historial");
  assert.match(migracion.sql, /revoke delete on table public\.duenos,\s*public\.mascotas from authenticated/i);
  assert.ok(rollback, "falta el rollback de permisos");
  assert.match(rollback.sql, /grant delete on table public\.duenos,\s*public\.mascotas to authenticated/i);
});

test("Fase 3 protege el cupo concurrente, el rango de noches y el orden de ruta", () => {
  const migracion = migraciones.find(({ f }) => f === "20261009120000_fase3_rutas_hotel_operacion.sql");
  const rollback = leer(ROLLBACKS).find(({ f }) => f === "20261009120000_fase3_rutas_hotel_operacion_down.sql");
  assert.ok(migracion, "falta la migración de operación de Fase 3");
  assert.match(migracion.sql, /add column if not exists localidad/i);
  assert.match(migracion.sql, /set cupos_hotel = 50\s+where id = 1 and cupos_hotel is null/i);
  assert.match(migracion.sql, /pg_advisory_xact_lock/i, "las reservas concurrentes deben serializarse");
  assert.match(migracion.sql, /dia < new\.salida/i, "la noche de salida no debe ocupar cupo");
  assert.match(migracion.sql, /create or replace function public\.reordenar_paradas/i);
  assert.match(migracion.sql, /public\.es_admin\(\)/i);
  assert.ok(rollback, "falta el rollback seguro de Fase 3");
  assert.doesNotMatch(rollback.sql, /drop column|drop table|truncate/i, "el rollback no debe borrar datos de localidad o cupos");
});

test("Fase 4 guarda capacidad por ruta sin inventar un valor y conserva el dato en rollback", () => {
  const migracion = migraciones.find(({ f }) => f === "20261010120000_fase4_agenda_planeacion.sql");
  const rollback = leer(ROLLBACKS).find(({ f }) => f === "20261010120000_fase4_agenda_planeacion_down.sql");
  assert.ok(migracion, "falta la migración de agenda y capacidad por ruta");
  assert.match(migracion.sql, /add column if not exists capacidad_perros smallint/i);
  assert.match(migracion.sql, /capacidad_perros is null or capacidad_perros > 0/i);
  assert.doesNotMatch(migracion.sql, /set capacidad_perros\s*=/i, "no se debe asumir una capacidad común");
  assert.ok(rollback, "falta la nota de rollback de Fase 4");
  assert.doesNotMatch(rollback.sql, /drop column|drop table|truncate/i, "el rollback no debe borrar capacidades configuradas");
});

test("Fase 5 protege el saldo de abonos y su rollback conserva la contabilidad", () => {
  const migracion = migraciones.find(({ f }) => f === "20261011120000_fase5_finanzas_integridad.sql");
  const rollback = leer(ROLLBACKS).find(({ f }) => f === "20261011120000_fase5_finanzas_integridad_down.sql");
  assert.ok(migracion, "falta la protección de integridad financiera");
  assert.match(migracion.sql, /before insert or update on public\.abonos/i);
  assert.match(migracion.sql, /for update/i, "los abonos concurrentes deben bloquear el cobro padre");
  assert.match(migracion.sql, /v_abonado \+ new\.valor > v_total/i);
  assert.match(migracion.sql, /before update of valor_total on public\.pagos/i);
  assert.ok(rollback, "falta el rollback de las protecciones financieras");
  assert.match(rollback.sql, /drop trigger if exists tg_abonos_no_sobrepagar/i);
  assert.match(rollback.sql, /drop function if exists public\.tg_validar_abono_en_saldo/i);
  assert.doesNotMatch(rollback.sql, /drop table|delete from|truncate/i, "el rollback no debe borrar movimientos financieros");
});

test("Fase 7 registra cambios con RLS admin, asistencia fechada y SOAT sin rollback destructivo", () => {
  const migracion = migraciones.find(({ f }) => f === "20261012120000_fase7_alertas_asistencia_historial.sql");
  assert.ok(migracion, "falta la migración de alertas, asistencia e historial");
  for (const table of ["soat_vehiculos", "asistencia_colegio", "historial_cambios"]) {
    assert.match(migracion.sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migracion.sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migracion.sql, new RegExp(`on public\\.${table}[\\s\\S]*?public\\.es_admin\\(\\)`));
  }
  assert.match(migracion.sql, /unique \(mascota_id, fecha\)/i);
  assert.match(migracion.sql, /statement_timestamp\(\)/i, "la hora de llegada y salida debe venir del servidor");
  assert.match(migracion.sql, /after insert or update or delete/i);
  assert.match(migracion.sql, /revoke all on public\.soat_vehiculos,\s*public\.asistencia_colegio,\s*public\.historial_cambios\s+from public, anon, authenticated/i);
  assert.match(migracion.sql, /grant select on public\.historial_cambios to authenticated/i);
  for (const table of ["duenos", "mascotas", "gastos", "pagos", "abonos", "rutas_colegio", "paradas_dia", "citas"]) {
    assert.match(migracion.sql, new RegExp(`'public\\.${table}'`), `falta auditar ${table}`);
  }
  assert.ok(rollbackFase7, "falta el rollback de Fase 7");
  assert.doesNotMatch(rollbackFase7.sql, /drop table|drop column|truncate|delete from/i);
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

test("la migración inicial vacía se conserva como registro histórico", () => {
  const inicial = migraciones.find(({ f }) => f === "20261005121608_crear_tablas_iniciales.sql");
  const definicionReal = migraciones.find(({ f }) => f === "20261005143000_crear_site_config_contact_requests.sql");
  assert.ok(inicial, "debe conservarse el archivo de migración inicial");
  assert.equal(inicial.sql.trim(), "", "la migración histórica debe seguir vacía");
  assert.ok(definicionReal, "la definición real de las tablas públicas debe estar versionada aparte");
  assert.match(definicionReal.sql, /create table if not exists public\.site_config/i);
  assert.match(definicionReal.sql, /create table if not exists public\.contact_requests/i);
});

test("la documentación refleja el historial de migraciones revisado", () => {
  const readme = readFileSync("supabase/README.md", "utf8");
  assert.match(readme, /20261005121608_crear_tablas_iniciales\.sql/);
  assert.match(readme, /20261005143000_crear_site_config_contact_requests\.sql/);
  assert.doesNotMatch(readme, /La migración aún no se ha ejecutado contra Supabase real/i);
  assert.doesNotMatch(readme, /La migración y el rollback no se han ejecutado contra Supabase real/i);
  assert.doesNotMatch(readme, /Pasar `01_site_config\.sql` y `02_contact_requests\.sql` a `migrations\//i);
});
