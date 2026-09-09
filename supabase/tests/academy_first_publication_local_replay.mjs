// Explicitly local and disposable. No connection URL or arbitrary container is accepted.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const project = 'academy-release-auth-20260909';
const container = `supabase_db_${project}`;
assert.equal(process.env.ACADEMY_LOCAL_REPLAY_CONFIRM, project, 'Explicit isolated replay confirmation required');
const docker = process.platform === 'win32' ? 'C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe' : 'docker';
const root = fileURLToPath(new URL('../..', import.meta.url));
const run = (args, input) => execFileSync(docker, args, { input, encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const labels = JSON.parse(run(['inspect', '--format', '{{json .Config.Labels}}', container]));
assert.equal(labels['com.supabase.cli.project'], project, 'Never replay against another container');
const query = sql => run(['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], sql).trim();
const manifest = JSON.parse(execFileSync(process.execPath, [resolve(root, 'supabase/tests/academy_first_publication_replay_manifest.mjs')], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const items = [{ ...manifest.baseline, name: 'reviewed-baseline' }, ...manifest.entries.map(entry => ({ ...entry, path: resolve(root, entry.path), name: entry.path }))];
const literal = text => `'${String(text).replaceAll("'", "''")}'`;
const ledgerExists = query("select to_regclass('academy_local_replay_test.applied_inputs') is not null;") === 't';
if (!ledgerExists) {
  const empty = query("select to_regclass('public.academy_headquarters') is null and to_regclass('public.profiles') is null;") === 't';
  const imported = [];
  if (!empty) {
    assert.equal(process.env.ACADEMY_LOCAL_REPLAY_RESUME, 'observed-exec-1736', 'Nonempty DB requires the exact previously observed execution evidence');
    // Main observed exec session 1736: baseline + these 31 deltas PASS, then the
    // next migration failed and its --single-transaction invocation rolled back.
    // This is a one-time provenance import, not inference from a table existing.
    assert.equal(items[1].name, 'supabase/migrations/20260820110909_academy_instructor_registration_ledger.sql');
    assert.equal(items[31].name, 'supabase/migrations/20260903204500_platform_billing_customer_recontract_activation.sql');
    assert.equal(items[32].name, 'supabase/migrations/20260903210000_platform_billing_internal_resource_grants.sql');
    assert.equal(query("select (select count(*) from auth.users)=0 and (select count(*) from public.community_communities)=0 and to_regclass('platform_billing_private.internal_resource_grants') is null;"), 't', 'Observed failed checkpoint changed; do not import evidence');
    imported.push(...items.slice(0, 32));
  }
  query(`begin; create schema academy_local_replay_test; revoke all on schema academy_local_replay_test from public,anon,authenticated,service_role;
    create table academy_local_replay_test.applied_inputs(name text primary key,sha256 text not null,source_commit text not null,evidence text not null,applied_at timestamptz not null default clock_timestamp());
    create table academy_local_replay_test.fixtures(name text primary key,detail jsonb not null,created_at timestamptz not null default clock_timestamp());
    ${imported.map(item => `insert into academy_local_replay_test.applied_inputs(name,sha256,source_commit,evidence) values(${literal(item.name)},${literal(item.sha256)},${literal(manifest.commit)},'Main observed PASS in exec session 1736; baseline plus first 31 manifest deltas; next single-transaction migration rolled back');`).join('\n')}
    commit;`);
  console.log(`CHECKPOINT ${imported.length} inputs imported from ${empty ? 'fresh database' : 'explicit exec-1736 evidence'}`);
}
const ledger = JSON.parse(query("select coalesce(jsonb_agg(jsonb_build_object('name',name,'sha256',sha256)),'[]'::jsonb) from academy_local_replay_test.applied_inputs;"));
const applied = new Map(ledger.map(row => [row.name,row.sha256]));
for (const row of ledger) assert.ok(items.some(item => item.name===row.name && item.sha256===row.sha256), `Recorded replay input changed: ${row.name}`);
let encounteredPending = false;
for (const item of items) {
  const bytes = readFileSync(item.path);
  assert.equal(hash(bytes), item.sha256, 'Replay input changed since manifest');
  if (applied.has(item.name)) {
    assert.equal(encounteredPending, false, 'Replay ledger must form an exact manifest prefix');
    assert.equal(applied.get(item.name), item.sha256);
    console.log(`VERIFIED CHECKPOINT ${item.name}`);
    continue;
  }
  encounteredPending = true;
  if (item.name === 'supabase/migrations/20260903210000_platform_billing_internal_resource_grants.sql') {
    // The unmodified migration explicitly requires 3 production-named slugs.
    // Supply clearly labeled synthetic local rows; never remove its preflight.
    const fixtureName = 'synthetic-community-internal-grant-preflight-v1';
    if (query(`select exists(select 1 from academy_local_replay_test.fixtures where name=${literal(fixtureName)});`) !== 't') {
      assert.equal(query("select (select count(*) from auth.users)=0 and (select count(*) from public.community_communities)=0;"), 't', 'Fixture insertion is limited to this empty local app dataset');
      query(`begin;
        insert into auth.users(id,email,is_anonymous,raw_user_meta_data,raw_app_meta_data) values('acad0909-0000-4000-8000-000000000001','academy-local-replay@example.invalid',false,'{"full_name":"LOCAL REPLAY FIXTURE"}','{}');
        insert into public.community_communities(id,slug,name,owner_user_id) values
          ('acad0909-0000-4000-8000-000000000011','official-academy-community','LOCAL REPLAY FIXTURE - official academy','acad0909-0000-4000-8000-000000000001'),
          ('acad0909-0000-4000-8000-000000000012','mikkeos','LOCAL REPLAY FIXTURE - mikkeos','acad0909-0000-4000-8000-000000000001'),
          ('acad0909-0000-4000-8000-000000000013','ayumitest','LOCAL REPLAY FIXTURE - test','acad0909-0000-4000-8000-000000000001');
        insert into academy_local_replay_test.fixtures(name,detail) values(${literal(fixtureName)},'{"synthetic":true,"reason":"Unmodified migration requires three named Community slugs","real_auth_tested":false,"production_data_copied":false}');
        commit;`);
      console.log(`FIXTURE ${fixtureName}: 1 synthetic owner, 3 synthetic Community rows; no real user data`);
    }
  }
  if (item.name === 'supabase/migrations/20260904013000_academy_internal_resource_access_recovery.sql') {
    const fixtureName = 'synthetic-academy-internal-recovery-preflight-v1';
    if (query(`select exists(select 1 from academy_local_replay_test.fixtures where name=${literal(fixtureName)});`) !== 't') {
      assert.equal(query("select (select count(*) from public.academy_headquarters)=0 and exists(select 1 from auth.users where id='acad0909-0000-4000-8000-000000000001' and email='academy-local-replay@example.invalid');"), 't', 'Only the known synthetic owner and empty Academy dataset may be seeded');
      query(`begin;
        insert into public.academy_headquarters(id,owner_user_id,name,handle,tagline,is_active) values
          ('acad0909-0000-4000-8000-000000000021','acad0909-0000-4000-8000-000000000001','MUSUBI','ayumi-academy','LOCAL REPLAY SYNTHETIC FIXTURE',true),
          ('acad0909-0000-4000-8000-000000000022','acad0909-0000-4000-8000-000000000001','mikkeOS Official Academy','admin_78e6-academy','LOCAL REPLAY SYNTHETIC FIXTURE',true);
        insert into public.academy_headquarters_access_states(headquarters_id,owner_user_id,access_kind,status,paid_started_at) values
          ('acad0909-0000-4000-8000-000000000021','acad0909-0000-4000-8000-000000000001','paid','active',clock_timestamp()),
          ('acad0909-0000-4000-8000-000000000022','acad0909-0000-4000-8000-000000000001','paid','active',clock_timestamp());
        insert into academy_local_replay_test.fixtures(name,detail) values(${literal(fixtureName)},'{"synthetic":true,"reason":"Unmodified recovery migration requires two named active Academy rows","real_contracts":false,"production_data_copied":false}');
        commit;`);
      console.log(`FIXTURE ${fixtureName}: 2 synthetic paid-state HQ rows, not real contracts`);
    }
  }
  if (item.name === 'supabase/migrations/20260904083849_academy_legacy_paid_access_continuity.sql') {
    const fixtureName = 'synthetic-academy-legacy-continuity-preflight-v1';
    if (query(`select exists(select 1 from academy_local_replay_test.fixtures where name=${literal(fixtureName)});`) !== 't') {
      assert.equal(query("select (select count(*) from public.academy_headquarters)=2 and not exists(select 1 from public.academy_headquarters where owner_user_id<>'acad0909-0000-4000-8000-000000000001' or tagline is distinct from 'LOCAL REPLAY SYNTHETIC FIXTURE');"), 't', 'Only the previously recorded synthetic HQ rows may exist');
      query(`begin;
        insert into public.academy_headquarters(id,owner_user_id,name,handle,tagline,is_active,created_at) values
          ('acad0909-0000-4000-8000-000000000031','acad0909-0000-4000-8000-000000000001','LOCAL REPLAY Legacy A','local-replay-legacy-a','LOCAL REPLAY SYNTHETIC FIXTURE',true,'2026-09-01T00:00:00Z'),
          ('acad0909-0000-4000-8000-000000000032','acad0909-0000-4000-8000-000000000001','LOCAL REPLAY Legacy B','local-replay-legacy-b','LOCAL REPLAY SYNTHETIC FIXTURE',true,'2026-09-01T00:00:00Z');
        insert into public.academy_headquarters_access_states(headquarters_id,owner_user_id,access_kind,status,starts_at,paid_started_at) values
          ('acad0909-0000-4000-8000-000000000031','acad0909-0000-4000-8000-000000000001','paid','active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z'),
          ('acad0909-0000-4000-8000-000000000032','acad0909-0000-4000-8000-000000000001','paid','active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z');
        insert into academy_local_replay_test.fixtures(name,detail) values(${literal(fixtureName)},'{"synthetic":true,"reason":"Unmodified continuity migration requires exactly two pre-cutover paid Academy rows without prior grants","real_contracts":false,"production_data_copied":false}');
        commit;`);
      console.log(`FIXTURE ${fixtureName}: 2 additional synthetic legacy HQ rows, not real contracts`);
    }
  }
  try {
    const checkpoint = `\ninsert into academy_local_replay_test.applied_inputs(name,sha256,source_commit,evidence) values(${literal(item.name)},${literal(item.sha256)},${literal(manifest.commit)},'Migration and this checkpoint committed in one local transaction');\n`;
    run(['exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-U', 'postgres', '-d', 'postgres', '-f', '-'], Buffer.concat([bytes,Buffer.from(checkpoint)]));
  } catch (error) {
    const detail = String(error.stderr ?? '').split(/\r?\n/).filter(line => /ERROR:|DETAIL:|HINT:/.test(line)).slice(-6).join('\n');
    throw new Error(`Isolated replay failed at ${item.name}\n${detail}`);
  }
  console.log(`PASS ${item.name}`);
}
console.log(JSON.stringify({ result: 'PASS', kind: 'local_full_schema_replay', project, commit: manifest.commit, deltaCount: manifest.deltaCount, syntheticFixtureCount: JSON.parse(query('select count(*)::int from academy_local_replay_test.fixtures;')), productionChanged: false, authenticationTested: false, concurrencyTested: false }));
