import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const project = "mikke-community-owner-ux-20260910";
const network = `${project}-loopback`;
const container = `supabase_db_${project}`;
const root = process.cwd();
const docker = "C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe";
const manifestScript = "G:/Musubiプロジェクト/mikke-os-mvp-academy-release-20260908/supabase/tests/academy_first_publication_replay_manifest.mjs";
assert.equal(process.argv[2], "--replay-local");
assert.equal(process.env.COMMUNITY_OWNER_UX_LOCAL_REPLAY_CONFIRM, project);

const run = (args, input) => execFileSync(docker, args, {
  input, encoding: "utf8", windowsHide: true, timeout: 600_000,
  maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"],
});
const query = (sql) => run(["exec", "-i", container, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql).trim();
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

for (const [service, port] of [["db", "56322"], ["kong", "56321"]]) {
  const inspected = JSON.parse(run(["inspect", `supabase_${service}_${project}`]))[0];
  assert.equal(inspected.Config.Labels["com.supabase.cli.project"], project);
  assert.equal(inspected.State.Running, true);
  assert.equal(inspected.HostConfig.NetworkMode, network);
  const bindings = Object.values(inspected.NetworkSettings.Ports ?? {}).filter(Boolean).flat();
  assert.ok(bindings.length > 0 && bindings.every((binding) => binding.HostIp === "127.0.0.1" && binding.HostPort === port));
}

const manifest = JSON.parse(execFileSync(process.execPath, [manifestScript], {
  cwd: root,
  env: { ...process.env, ACADEMY_DB_REPLAY_ROOT: root },
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
}));
assert.equal(manifest.deltaCount, 54);
assert.equal(manifest.entries.at(-1)?.path, "supabase/migrations/20260909163047_community_owner_membership_resources_ux.sql");
const items = [
  { ...manifest.baseline, name: "reviewed-baseline" },
  ...manifest.entries.map((entry) => ({ ...entry, path: path.resolve(root, entry.path), name: entry.path })),
];
for (const item of items) {
  const bytes = readFileSync(item.path);
  assert.equal(hash(bytes), item.sha256);
  const sql = bytes.toString();
  assert.ok(!/^\s*(COMMIT|ROLLBACK|BEGIN)\s*;/im.test(sql));
  assert.ok(!/^\s*\\(?!restrict\b|unrestrict\b)\S+/im.test(sql));
}
assert.equal(query("select to_regclass('public.profiles') is null and (select count(*) from auth.users)=0;"), "t");
query(`create schema community_owner_ux_local_replay;
  revoke all on schema community_owner_ux_local_replay from public,anon,authenticated,service_role;
  create table community_owner_ux_local_replay.inputs(name text primary key,sha256 text not null);
  create table community_owner_ux_local_replay.fixtures(name text primary key);`);

const fixtures = new Set();
function seed(name, sql) {
  if (fixtures.has(name)) return;
  query(`begin; ${sql}; insert into community_owner_ux_local_replay.fixtures(name) values(${literal(name)}); commit;`);
  fixtures.add(name);
}

for (const item of items) {
  if (item.name === "supabase/migrations/20260903210000_platform_billing_internal_resource_grants.sql") {
    seed("community-internal-grant-preflight", `
      insert into auth.users(id,email,is_anonymous) values
        ('cf000000-0000-4000-8000-000000000001','official-academy-community@example.invalid',false),
        ('cf000000-0000-4000-8000-000000000002','mikkeos-community@example.invalid',false),
        ('cf000000-0000-4000-8000-000000000003','ayumitest-community@example.invalid',false),
        ('cf000000-0000-4000-8000-000000000004','legacy-academy-one@example.invalid',false),
        ('cf000000-0000-4000-8000-000000000005','legacy-academy-two@example.invalid',false);
      insert into public.community_communities(id,slug,name,join_mode,owner_user_id) values
        ('cf100000-0000-4000-8000-000000000001','official-academy-community','LOCAL FIXTURE Official Academy','open_free','cf000000-0000-4000-8000-000000000001'),
        ('cf100000-0000-4000-8000-000000000002','mikkeos','LOCAL FIXTURE mikkeOS','open_free','cf000000-0000-4000-8000-000000000002'),
        ('cf100000-0000-4000-8000-000000000003','ayumitest','LOCAL FIXTURE Ayumi Test','open_free','cf000000-0000-4000-8000-000000000003')`);
  }
  if (item.name === "supabase/migrations/20260904013000_academy_internal_resource_access_recovery.sql") {
    seed("academy-internal-recovery-preflight", `
      insert into public.academy_headquarters(id,owner_user_id,name,handle,plan,is_active) values
        ('cf200000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001','MUSUBI','ayumi-academy','small',true),
        ('cf200000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000002','mikkeOS Official Academy','admin_78e6-academy','small',true);
      insert into public.academy_headquarters_access_states(headquarters_id,owner_user_id,access_kind,status,starts_at,paid_started_at) values
        ('cf200000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001','paid','active',clock_timestamp(),clock_timestamp()),
        ('cf200000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000002','paid','active',clock_timestamp(),clock_timestamp())`);
  }
  if (item.name === "supabase/migrations/20260904083849_academy_legacy_paid_access_continuity.sql") {
    seed("academy-legacy-preflight", `
      insert into public.academy_headquarters(id,owner_user_id,name,handle,plan,is_active,created_at) values
        ('cf300000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000004','LOCAL Legacy One','legacy-academy-one','small',true,'2026-09-01 00:00:00+00'),
        ('cf300000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000005','LOCAL Legacy Two','legacy-academy-two','small',true,'2026-09-01 00:00:00+00');
      insert into public.academy_headquarters_access_states(headquarters_id,owner_user_id,access_kind,status,starts_at,paid_started_at) values
        ('cf300000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000004','paid','active','2026-09-01 00:00:00+00','2026-09-01 00:00:00+00'),
        ('cf300000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000005','paid','active','2026-09-01 00:00:00+00','2026-09-01 00:00:00+00')`);
  }
  const bytes = readFileSync(item.path);
  const checkpoint = `\ninsert into community_owner_ux_local_replay.inputs(name,sha256) values(${literal(item.name)},${literal(item.sha256)});\n`;
  run(["exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-U", "postgres", "-d", "postgres", "-f", "-"], Buffer.concat([bytes, Buffer.from(checkpoint)]));
}

assert.equal(query("select count(*) from community_owner_ux_local_replay.inputs;"), String(items.length));
assert.equal(query("select public is false and file_size_limit=52428800 from storage.buckets where id='community-resources';"), "t");
console.log(JSON.stringify({ result: "community_owner_ux_local_replay_ok", project, inputCount: items.length, migrationCount: manifest.deltaCount, fixtureGroups: fixtures.size, productionChanged: false }));
