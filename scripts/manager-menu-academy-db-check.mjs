import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const docker = 'C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const label = 'manager-menu-academy-local';
const name = `${label}-${randomUUID()}`;
function run(args, input) {
  const r = spawnSync(docker, args, { input, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (r.status !== 0) throw new Error(`Local Docker command failed: ${r.error?.code ?? r.status}: ${r.stderr}`);
  return r.stdout.trim();
}
const sql = text => run(['exec', '-i', name, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-f', '-'], text);
let started = false;
try {
  run(['run', '--detach', '--pull', 'never', '--name', name, '--label', `mikke.test.scope=${label}`, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.6']);
  started = true;
  let ready = false;
  for (let i = 0; i < 30; i++) {
    if (spawnSync(docker, ['exec', name, 'pg_isready', '-U', 'postgres'], { windowsHide: true, timeout: 10000, stdio: 'ignore' }).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(ready, 'isolated database readiness');
  const base = readFileSync('supabase/migrations/20260825042454_manager_app_menu_preferences.sql', 'utf8');
  const delta = readFileSync('supabase/migrations/20260909084607_manager_menu_academy_key.sql', 'utf8');
  sql(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
    ${base}
    insert into public.mikke_app_menu_preferences(user_id,app_key,sort_order,is_hidden) values
      ('11111111-1111-4111-8111-111111111111','story',0,false),('22222222-2222-4222-8222-222222222222','community',0,true);`);
  const before = sql('select jsonb_agg(to_jsonb(p) order by user_id)::text from public.mikke_app_menu_preferences p;');
  const acl = sql("select proacl::text from pg_proc where oid='public.mikke_app_menu_preferences_replace_mine(jsonb)'::regprocedure;");
  sql(`begin; ${delta} commit;`);
  assert.equal(sql('select jsonb_agg(to_jsonb(p) order by user_id)::text from public.mikke_app_menu_preferences p;'), before, 'migration preserves existing rows');
  assert.equal(sql("select proacl::text from pg_proc where oid='public.mikke_app_menu_preferences_replace_mine(jsonb)'::regprocedure;"), acl, 'RPC ACL preserved');
  const a = "set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; set local role authenticated;";
  const b = "set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'; set local role authenticated;";
  assert.equal(sql(`begin; ${a} select app_key||':'||is_hidden from public.mikke_app_menu_preferences_replace_mine('[{"app_key":"academy","sort_order":0,"is_hidden":true}]'); commit;`), 'academy:true');
  assert.equal(sql(`begin; ${b} select app_key||':'||is_hidden from public.mikke_app_menu_preferences_get_mine(); rollback;`), 'community:true', 'other actor preserved');
  const reject = (statement, code = '22023') => sql(`begin; ${a} do $$ begin ${statement}; raise exception 'expected rejection'; exception when sqlstate '${code}' then null; end $$; rollback;`);
  for (const payload of [
    '[{"app_key":"manager","sort_order":0,"is_hidden":false}]',
    '[{"app_key":"academy","sort_order":0,"is_hidden":false,"user_id":"22222222-2222-4222-8222-222222222222"}]',
    '[{"app_key":"academy","sort_order":0,"is_hidden":false},{"app_key":"academy","sort_order":1,"is_hidden":false}]',
    '[{"app_key":"academy","sort_order":0,"is_hidden":false},{"app_key":"story","sort_order":0,"is_hidden":false}]',
    '[{"app_key":"academy","sort_order":32,"is_hidden":false}]',
    '[{"app_key":"academy","sort_order":0,"is_hidden":"false"}]'
  ]) reject(`perform public.mikke_app_menu_preferences_replace_mine('${payload}')`);
  reject('perform * from public.mikke_app_menu_preferences', '42501');
  reject("insert into public.mikke_app_menu_preferences values ('22222222-2222-4222-8222-222222222222','academy',1,false,now())", '42501');
  sql("begin; set local role anon; do $$ begin perform public.mikke_app_menu_preferences_get_mine(); raise exception 'expected rejection'; exception when insufficient_privilege then null; end $$; rollback;");
  assert.equal(sql(`begin; ${a} select app_key from public.mikke_app_menu_preferences_get_mine(); rollback;`), 'academy', 'invalid writes preserve A');
  sql(`begin; ${a} select public.mikke_app_menu_preferences_reset_mine(); commit;`);
  assert.equal(sql(`begin; ${a} select count(*) from public.mikke_app_menu_preferences_get_mine(); rollback;`), '0');
  assert.equal(sql(`begin; ${b} select app_key from public.mikke_app_menu_preferences_get_mine(); rollback;`), 'community');
  assert.equal(sql('select count(*) from auth.users'), '2');
  console.log('PASS actual PG17.6: migration row/ACL preservation, Academy save, actor isolation, invalid payloads, direct-table/anon denial and reset. Minimal Auth fixture only; no real Auth/provider.');
} finally {
  if (started) {
    assert.equal(run(['inspect', '--format', '{{index .Config.Labels "mikke.test.scope"}}', name]), label);
    let removalError;
    try { run(['rm', '--force', '--volumes', name]); } catch (error) { removalError = error; }
    const remaining = run(['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.Names}}']);
    if (remaining && removalError) throw removalError;
    assert.equal(remaining, '');
    console.log('PASS exact labeled temporary container removed; no other project changed.');
  }
}
