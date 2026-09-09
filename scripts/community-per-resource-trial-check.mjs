// Isolated PG17 SQL-role/real-lock proof. Does not claim hosted Auth or full baseline E2E.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';

if (process.argv[2] !== '--run-isolated') throw new Error('Explicit --run-isolated required');
const docker = process.env.COMMUNITY_TEST_DOCKER || 'docker';
const name = `community-per-resource-trial-${randomUUID()}`;
const label = 'mikke.test.scope=community-per-resource-trial';
const run = (args, input, timeout = 60000) => {
  const r = spawnSync(docker, args, { input, encoding: 'utf8', shell: false, timeout });
  if (r.status !== 0) throw new Error(`${args[0]} failed: ${r.stderr || r.error?.message}`);
  return r.stdout.trim();
};
const args = ['exec', '-i', name, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'];
const sql = text => run(args, `set statement_timeout='30s'; set lock_timeout='10s';\n${text}`);
const json = text => JSON.parse(sql(text).split(/\r?\n/).filter(line => line.startsWith('{') || line.startsWith('[')).at(-1));
const file = name => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
const migrations = [
  '20260831180143_platform_billing_checkout_ledger.sql',
  '20260901124412_platform_billing_creation_entitlements.sql',
  '20260901130000_community_guarded_platform_creation.sql',
  '20260902171944_platform_billing_verified_provider_events.sql',
  '20260902223651_platform_billing_subscription_runtime.sql',
  '20260904004922_platform_billing_community_trial_start.sql',
  '20260909141538_community_per_resource_trial.sql',
];
const setup = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('sub',auth.uid(),'is_anonymous',false)$$;
grant usage on schema auth to authenticated;
create table public.community_communities(id uuid primary key default gen_random_uuid(),slug text unique,name text,description text,join_mode text,status text,owner_user_id uuid references auth.users(id));
create table public.community_memberships(community_id uuid references public.community_communities(id),user_id uuid references auth.users(id),role text,status text,primary key(community_id,user_id));
create table public.community_member_profiles(community_id uuid references public.community_communities(id),user_id uuid references auth.users(id),display_name text);
create table public.community_entitlement_definitions(community_id uuid references public.community_communities(id),key text,name text,description text);
create table public.community_rooms(community_id uuid references public.community_communities(id),title text,description text,kind text,access_type text,sort_order int,member_can_post boolean,member_can_comment boolean);
create function public.mikke_reserved_slug(text) returns boolean language sql immutable as $$select false$$;
create function public.community_create(text,text,text,text) returns void language sql as $$select$$;
`;
const bundle = migrations.map(n => file(`migrations/${n}`)).join('\n');
const manifest = migrations.map(n => ({ name: n, sha256: createHash('sha256').update(file(`migrations/${n}`)).digest('hex') }));
let owned = false;
let checks = 0;
const check = (value, expected, description) => { assert.deepEqual(value, expected, description); checks++; };
const call = (actor, request) => `set local role service_role; select public.platform_billing_community_trial_start('${actor}','${request}');`;
function session(text) {
  const child = spawn(docker, args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = '';
  const done = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('session timed out')); }, 30000);
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => { clearTimeout(timeout); code === 0 ? resolve(out) : reject(new Error(err)); });
  });
  // Attach early so an assertion failure does not leave an unhandled rejection.
  done.catch(() => {});
  child.stdin.write("set statement_timeout='20s'; set lock_timeout='10s';\n" + text);
  return { done, send: text => child.stdin.end(text), output: () => out };
}
async function observed(predicate, description) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Missing ${description}`);
}
try {
  run(['run', '--pull=never', '--detach', '--name', name, '--label', label, '--network', 'none',
    '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.6']);
  owned = true;
  const inspect = JSON.parse(run(['inspect', name]))[0];
  assert.equal(inspect.Config.Labels['mikke.test.scope'], 'community-per-resource-trial');
  assert.equal(inspect.HostConfig.NetworkMode, 'none');
  assert.equal(Object.keys(inspect.HostConfig.PortBindings ?? {}).length, 0);
  assert.ok(inspect.HostConfig.Tmpfs['/var/lib/postgresql/data'] !== undefined);
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    const r = spawnSync(docker, ['exec', name, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8', timeout: 5000 });
    if (r.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.ok(ready, 'disposable Postgres ready');
  const before = sql("select count(*) from pg_namespace where nspname in ('auth','platform_billing_private')");
  const publicBefore = sql("select json_build_object('relations',(select count(*) from pg_class where relnamespace='public'::regnamespace),'functions',(select count(*) from pg_proc where pronamespace='public'::regnamespace),'triggers',(select count(*) from pg_trigger),'constraints',(select count(*) from pg_constraint))");
  // Historical trial replay survives the migration. The original dates, consumed
  // resource binding and row identity must remain unchanged after backfilling.
  const previous = migrations.slice(0,-1).map(n=>file(`migrations/${n}`)).join('\n');
  const upgrade = sql(`begin; ${setup}\n${previous}
    insert into auth.users(id) values('a9290000-0000-4000-8000-000000000001');
    set local role service_role;
    select public.platform_billing_community_trial_start('a9290000-0000-4000-8000-000000000001','b9290000-0000-4000-8000-000000000001');
    set local role authenticated;
    select set_config('request.jwt.claim.sub','a9290000-0000-4000-8000-000000000001',true);
    select public.community_create_with_platform_entitlement('Legacy Group','legacy-group',null,null);
    reset role;
    create temp table legacy_snapshot as select to_jsonb(e) snapshot from platform_billing_private.creation_entitlements e;
    ${file(`migrations/${migrations.at(-1)}`)}
    set local role service_role;
    do $$begin
      begin
        perform public.platform_billing_community_trial_start('a9290000-0000-4000-8000-000000000001','b9290000-0000-4000-8000-000000000001');
        raise exception 'old request unexpectedly granted';
      exception when unique_violation then null; end;
    end $$;
    reset role;
    do $$begin
      if (select count(*) from platform_billing_private.community_trial_requests)<>1
        or not(select snapshot=(select to_jsonb(e) from platform_billing_private.creation_entitlements e) from legacy_snapshot)
      then raise exception 'historical grant changed'; end if;
    end $$;
    select 'legacy_upgrade_ok'; rollback;`);
  check(upgrade.includes('legacy_upgrade_ok'),true,'historical replay/period migration');
  const output = sql(`begin; ${setup}\n${bundle}\n${file('tests/community_per_resource_trial.sql')}\nrollback;`);
  assert.ok(output.includes('community_per_resource_trial_sql_ok'));
  checks += (file('tests/community_per_resource_trial.sql').match(/select pg_temp\.(check_trial|deny_trial)\(/g) ?? []).length;
  check(sql("select count(*) from pg_namespace where nspname in ('auth','platform_billing_private')"), before, 'rollback schema residue zero');
  check(sql("select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')"), '0', 'rollback roles zero');
  check(sql("select json_build_object('relations',(select count(*) from pg_class where relnamespace='public'::regnamespace),'functions',(select count(*) from pg_proc where pronamespace='public'::regnamespace),'triggers',(select count(*) from pg_trigger),'constraints',(select count(*) from pg_constraint))"),publicBefore,'rollback public catalog counts unchanged');
  // Dedicated disposable fixture only: commit once to exercise real transactions.
  sql(`${setup}\n${bundle}`);
  const actor = 'a9190000-0000-4000-8000-000000000001';
  const r1 = 'b9190000-0000-4000-8000-000000000001';
  const r2 = 'b9190000-0000-4000-8000-000000000002';
  sql(`insert into auth.users(id) values('${actor}')`);
  const first = session(`begin; select pg_backend_pid(); ${call(actor,r1)} select 'first_ready';\n`);
  await observed(() => first.output().includes('first_ready'), 'first grant before commit');
  const second = session(`begin; set local application_name='community_trial_second'; ${call(actor,r2)} commit;\n`);
  second.send('');
  await observed(() => json("select json_build_object('waiting',exists(select 1 from pg_stat_activity where application_name='community_trial_second' and wait_event_type='Lock'))").waiting, 'real start/start lock wait');
  first.send('commit;');
  const [a,b] = await Promise.all([first.done,second.done]);
  const dto = out => JSON.parse(out.split(/\r?\n/).find(line=>line.startsWith('{')));
  check(dto(a),dto(b),'parallel starts reuse exact period');
  check(json(`select json_build_object('grants',(select count(*) from platform_billing_private.creation_entitlements where actor_user_id='${actor}'),'requests',(select count(*) from platform_billing_private.community_trial_requests where actor_user_id='${actor}'))`),{grants:1,requests:2},'one grant, two immutable request mappings');

  // Reverse-order test: create locks entitlement first; trial start waits on it.
  // FK inserts by create then need auth.users KEY SHARE. NO KEY UPDATE allows it.
  const create = session(`begin; select id from platform_billing_private.creation_entitlements where actor_user_id='${actor}' for update; select 'entitlement_locked';\n`);
  await observed(() => create.output().includes('entitlement_locked'), 'create entitlement lock');
  const retry = session(`begin; set local application_name='community_trial_create_race'; ${call(actor,r1)} commit;\n`);
  retry.send('');
  await observed(() => json("select json_build_object('waiting',exists(select 1 from pg_stat_activity where application_name='community_trial_create_race' and wait_event_type='Lock'))").waiting, 'trial waiting behind create');
  create.send(`set local role authenticated; select set_config('request.jwt.claim.sub','${actor}',true); select public.community_create_with_platform_entitlement('Concurrent Group','concurrent-group',null,null); commit;`);
  await create.done;
  await assert.rejects(retry.done,/PLATFORM_BILLING_STATE_CONFLICT/); checks++;
  check(json(`select json_build_object('communities',(select count(*) from public.community_communities),'consumed',(select count(*) from platform_billing_private.creation_entitlements where status='consumed'),'requests',(select count(*) from platform_billing_private.community_trial_requests))`),{communities:1,consumed:1,requests:2},'start/create does not deadlock or regrant');
  // Rollback first writer: waiter becomes sole grant owner; aborted receipt absent.
  const other = 'a9190000-0000-4000-8000-000000000002';
  sql(`insert into auth.users(id) values('${other}')`);
  const aborted = session(`begin; ${call(other,'b9190000-0000-4000-8000-000000000010')} select 'abort_ready';\n`);
  await observed(() => aborted.output().includes('abort_ready'), 'rollback race first grant');
  const survivor = session(`begin; set local application_name='community_trial_rollback_race'; ${call(other,'b9190000-0000-4000-8000-000000000011')} commit;\n`);
  survivor.send('');
  await observed(() => json("select json_build_object('waiting',exists(select 1 from pg_stat_activity where application_name='community_trial_rollback_race' and wait_event_type='Lock'))").waiting, 'rollback waiter');
  aborted.send('rollback;');
  await Promise.all([aborted.done,survivor.done]);
  check(json(`select json_build_object('grants',(select count(*) from platform_billing_private.creation_entitlements where actor_user_id='${other}'),'requests',(select count(*) from platform_billing_private.community_trial_requests where actor_user_id='${other}'))`),{grants:1,requests:1},'rollback no ghost grant or receipt');
  console.log(JSON.stringify({result:'community_per_resource_trial_ok',checks,postgres:sql('show server_version'),scope:'isolated SQL roles and real multi-connection locks, not hosted Auth/full baseline',manifest}));
} finally {
  if (owned) {
    const inspect = JSON.parse(run(['inspect', name]))[0];
    assert.equal(inspect.Config.Labels['mikke.test.scope'],'community-per-resource-trial');
    assert.equal(inspect.HostConfig.NetworkMode,'none');
    run(['rm','--force','--volumes',name]);
    check(run(['ps','-a','--filter',`name=^/${name}$`,'--format','{{.Names}}']),'','exact test container removed');
    console.log('community_per_resource_trial_cleanup_ok');
  }
}
