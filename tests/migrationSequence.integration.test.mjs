import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = "supabase/migrations";
const ROLLBACKS = "supabase/rollbacks";

const readSql = (directory, filename) =>
  readFileSync(join(directory, filename), "utf8");

const remoteBaseFiles = [
  "20261005121608_crear_tablas_iniciales.sql",
  "20261005143000_crear_site_config_contact_requests.sql",
  "20261007100000_fase1_roles_y_catalogos.sql",
  "20261007100100_fase1_duenos_y_mascotas.sql",
  "20261007100200_fase1_rutas_hotel_y_agenda.sql",
  "20261007100300_fase1_finanzas.sql",
  "20261007100400_fase1_acceso_empleado.sql",
  "20261007100500_fase1_storage.sql",
  "20261007100600_fase1_admin_por_rol_en_tablas_existentes.sql",
  "20261008190000_fase2_evitar_borrado_duenos_mascotas.sql",
  "20261009120000_fase3_rutas_hotel_operacion.sql",
  "20261010120000_fase4_agenda_planeacion.sql",
  "20261011120000_fase5_finanzas_integridad.sql",
  "20261012120000_fase7_alertas_asistencia_historial.sql",
];

const remoteResponsableAcl = `
revoke all on function public.mascota_asignada_a_mi(uuid) from public, anon;
grant execute on function public.mascota_asignada_a_mi(uuid) to authenticated;
`;

const ids = {
  adminUser: "10000000-0000-0000-0000-000000000001",
  employeeUser: "10000000-0000-0000-0000-000000000002",
  secondaryUser: "10000000-0000-0000-0000-000000000003",
  admin: "20000000-0000-0000-0000-000000000001",
  employee: "20000000-0000-0000-0000-000000000002",
  secondary: "20000000-0000-0000-0000-000000000003",
  owner: "30000000-0000-0000-0000-000000000001",
  pet: "40000000-0000-0000-0000-000000000001",
  route: "50000000-0000-0000-0000-000000000001",
  otherRoute: "50000000-0000-0000-0000-000000000002",
  stop: "60000000-0000-0000-0000-000000000001",
  otherStop: "60000000-0000-0000-0000-000000000002",
  appointment: "70000000-0000-0000-0000-000000000001",
};

const bootstrapSupabaseSchemas = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[] language sql immutable
as $$ select string_to_array(name, '/'); $$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
`;

async function apply(db, filename) {
  const sql = readSql(MIGRATIONS, filename);
  if (sql.trim()) await db.exec(sql);
}

async function scalar(db, sql, params = []) {
  const result = await db.query(sql, params);
  return Object.values(result.rows[0] ?? {})[0];
}

async function setActor(db, userId) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, email: "prueba@example.invalid" }),
  ]);
}

test("la secuencia pendiente se aplica sobre una réplica estructural del estado remoto", async (t) => {
  const db = new PGlite();
  t.after(async () => db.close());

  await db.exec(bootstrapSupabaseSchemas);
  for (const filename of remoteBaseFiles) await apply(db, filename);

  // El remoto contiene estas dos migraciones. La de responsable incluye un
  // REVOKE/GRANT explícito que falta en el archivo local histórico.
  await apply(db, "20261022120100_responsable_mascota.sql");
  await db.exec(remoteResponsableAcl);
  await apply(db, "20261022120200_mascotas_propias_permanentes.sql");

  await setActor(db, ids.adminUser);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${ids.adminUser}', 'admin@example.invalid'),
      ('${ids.employeeUser}', 'empleado@example.invalid'),
      ('${ids.secondaryUser}', 'secundario@example.invalid');
    insert into public.empleados (id, user_id, nombre, rol) values
      ('${ids.admin}', '${ids.adminUser}', 'Admin prueba', 'admin'),
      ('${ids.employee}', '${ids.employeeUser}', 'Empleado prueba', 'empleado'),
      ('${ids.secondary}', '${ids.secondaryUser}', 'Secundario prueba', 'empleado');
    insert into public.duenos (id, nombre, telefono)
      values ('${ids.owner}', 'Dueño sintético', '573000000000');
    insert into public.mascotas (id, dueno_id, nombre, responsable_empleado_id)
      values ('${ids.pet}', '${ids.owner}', 'Mascota sintética', '${ids.employee}');
    insert into public.rutas_colegio (id, nombre, empleado_id) values
      ('${ids.route}', 'Ruta propia', '${ids.employee}'),
      ('${ids.otherRoute}', 'Ruta ajena', '${ids.secondary}');
    insert into public.paradas_ruta (id, ruta_id, mascota_id, sentido, orden, direccion) values
      ('${ids.stop}', '${ids.route}', '${ids.pet}', 'recogida', 1, 'Dirección sintética 1'),
      ('${ids.otherStop}', '${ids.otherRoute}', '${ids.pet}', 'entrega', 1, 'Dirección sintética 2');
    insert into public.citas (id, mascota_id, servicio_codigo, empleado_id, inicio, fin) values
      ('${ids.appointment}', '${ids.pet}', 'bano', '${ids.employee}', '2026-11-12 14:00:00+00', '2026-11-12 15:00:00+00'),
      ('70000000-0000-0000-0000-000000000002', '${ids.pet}', 'peluqueria', '${ids.employee}', '2026-11-13 14:00:00+00', '2026-11-13 15:00:00+00'),
      ('70000000-0000-0000-0000-000000000003', '${ids.pet}', 'colegio', '${ids.employee}', '2026-11-14 14:00:00+00', '2026-11-14 15:00:00+00');
  `);

  await t.test("mensajes_equipo conserva mínimo privilegio y aislamiento por participante", async () => {
    await apply(db, "20261022120000_mensajes_admin_empleado.sql");

    assert.equal(await scalar(db, "select relrowsecurity from pg_class where oid='public.mensajes_equipo'::regclass"), true);
    assert.equal(await scalar(db, "select has_table_privilege('authenticated','public.mensajes_equipo','SELECT')"), true);
    assert.equal(await scalar(db, "select has_table_privilege('authenticated','public.mensajes_equipo','INSERT')"), false);
    assert.equal(await scalar(db, "select has_table_privilege('authenticated','public.mensajes_equipo','UPDATE')"), false);
    assert.equal(await scalar(db, "select has_function_privilege('anon','public.mensaje_equipo_enviar(uuid,text)','EXECUTE')"), false);
    assert.equal(await scalar(db, "select has_function_privilege('authenticated','public.mensaje_equipo_enviar(uuid,text)','EXECUTE')"), true);

    await setActor(db, ids.employeeUser);
    await db.exec("set role authenticated");
    await db.query("select public.mensaje_equipo_enviar($1::uuid, $2)", [ids.employee, "Mensaje sintético"]);
    await assert.rejects(
      db.query("select public.mensaje_equipo_enviar($1::uuid, $2)", [ids.secondary, "No autorizado"]),
      /No tienes permiso/,
    );
    await db.exec("reset role");
  });

  await t.test("agenda migra citas existentes y protege horarios/asignaciones", async () => {
    await apply(db, "20261024120000_agenda_empleados_y_horario_opcional.sql");

    assert.equal(await scalar(db, "select count(*)::int from public.citas where fecha_servicio is null"), 0);
    assert.equal(await scalar(db, "select count(*)::int from public.cita_empleados"), 3);
    assert.equal(await scalar(db, "select relrowsecurity from pg_class where oid='public.cita_empleados'::regclass"), true);
    assert.equal(await scalar(db, "select has_table_privilege('anon','public.cita_empleados','SELECT')"), false);

    await setActor(db, ids.adminUser);
    await db.exec("set role authenticated");
    await db.query(
      `select public.guardar_cita_agenda(
        $1::uuid, $2::uuid, $3::uuid[], 'bano', '2026-11-12'::date,
        '2026-11-12 14:00:00+00'::timestamptz, '2026-11-12 15:00:00+00'::timestamptz,
        'pendiente', 'Asignación múltiple sintética'
      )`,
      [ids.appointment, ids.pet, [ids.employee, ids.secondary]],
    );
    await db.exec("reset role");

    assert.equal(
      await scalar(db, "select count(*)::int from public.cita_empleados where cita_id=$1", [ids.appointment]),
      2,
    );
    await db.query(
      `insert into public.citas
        (mascota_id, servicio_codigo, empleado_id, fecha_servicio, inicio, fin)
       values ($1, 'hotel', $2, '2026-11-15', null, null)`,
      [ids.pet, ids.employee],
    );
    await assert.rejects(
      db.query(
        `insert into public.citas
          (mascota_id, servicio_codigo, empleado_id, fecha_servicio, inicio, fin)
         values ($1, 'hotel', $2, '2026-11-16', now(), null)`,
        [ids.pet, ids.employee],
      ),
      /citas_horario_opcional_ok/,
    );
  });

  await t.test("operación resiliente limita columnas, usa RLS e incluye citas secundarias", async () => {
    await apply(db, "20261111120000_operacion_empleado_resiliente.sql");

    assert.equal(await scalar(db, "select has_table_privilege('authenticated','public.paradas_dia','INSERT')"), false);
    assert.equal(await scalar(db, "select has_column_privilege('authenticated','public.paradas_dia','parada_id','INSERT')"), true);
    assert.equal(await scalar(db, "select has_column_privilege('authenticated','public.paradas_dia','fecha','INSERT')"), true);
    assert.equal(await scalar(db, "select has_column_privilege('authenticated','public.paradas_dia','estado','INSERT')"), false);
    assert.equal(await scalar(db, "select has_column_privilege('authenticated','public.paradas_dia','ocurrido_cliente_en','UPDATE')"), true);
    assert.equal(await scalar(db, "select has_column_privilege('authenticated','public.paradas_dia','sincronizado_en','UPDATE')"), false);
    assert.equal(
      await scalar(db, "select count(*)::int from pg_policies where schemaname='public' and tablename='paradas_dia' and policyname='empleado_prepara_sus_paradas'"),
      1,
    );

    await setActor(db, ids.secondaryUser);
    await db.exec("set role authenticated");
    assert.equal(await scalar(db, "select public.mascota_asignada_a_mi($1)", [ids.pet]), true);
    await db.exec("reset role");

    await setActor(db, ids.employeeUser);
    await db.exec("set role authenticated");
    await db.query("insert into public.paradas_dia (parada_id, fecha) values ($1, '2026-11-12')", [ids.stop]);
    await assert.rejects(
      db.query("insert into public.paradas_dia (parada_id, fecha) values ($1, '2026-11-12')", [ids.otherStop]),
      /row-level security policy/,
    );
    await db.exec("reset role");

    await db.query(
      "update public.paradas_dia set estado='recogido', ocurrido_cliente_en='2026-11-12 13:59:00+00' where parada_id=$1",
      [ids.stop],
    );
    assert.equal(
      await scalar(db, "select sincronizado_en is not null and marcado_en is not null from public.paradas_dia where parada_id=$1", [ids.stop]),
      true,
    );
  });

  await t.test("el rollback de operación conserva columnas y asignaciones", async () => {
    await db.exec(readSql(ROLLBACKS, "20261111120000_operacion_empleado_resiliente_down.sql"));
    assert.equal(
      await scalar(db, "select count(*)::int from information_schema.columns where table_schema='public' and table_name='paradas_dia' and column_name in ('ocurrido_cliente_en','sincronizado_en')"),
      2,
    );
    assert.equal(await scalar(db, "select count(*)::int from public.cita_empleados where cita_id=$1", [ids.appointment]), 2);
    assert.equal(
      await scalar(db, "select count(*)::int from pg_policies where schemaname='public' and tablename='paradas_dia' and policyname='empleado_prepara_sus_paradas'"),
      0,
    );
  });
});
