// Destructive two-connection proof for a disposable, non-production PG17 database.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';

if (process.argv[2] !== '--run-isolated') throw new Error('Explicit --run-isolated is required');
const rawUrl = process.env.COMMUNITY_TRIAL_TEST_DATABASE_URL;
if (!rawUrl) throw new Error('COMMUNITY_TRIAL_TEST_DATABASE_URL is required');
const url = new URL(rawUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) throw new Error('Only a local disposable PostgreSQL host is allowed');
const database = url.pathname.slice(1);
if (!/^community_trial_isolated_[a-z0-9_]+$/.test(database)) throw new Error('A dedicated community_trial_isolated_* database is required');

const executable = process.env.PSQL_PATH || 'psql';
const dockerContainer = process.env.COMMUNITY_TRIAL_PSQL_DOCKER_CONTAINER || '';
if (dockerContainer && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(dockerContainer)) throw new Error('Invalid disposable Docker container name');
if (dockerContainer && !/(^|[\\/])docker(?:\.exe)?$/i.test(executable)) throw new Error('PSQL_PATH must be Docker when the Docker adapter is enabled');
if (!dockerContainer && process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable)) throw new Error('Use psql.exe or the Docker adapter');

const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: database, PGSSLMODE: 'disable' };
delete env.COMMUNITY_TRIAL_TEST_DATABASE_URL;
const baseArgs = ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'];
const prefix = dockerContainer ? ['exec', '-i', '--env', 'PGHOST', '--env', 'PGPORT', '--env', 'PGUSER', '--env', 'PGPASSWORD', '--env', 'PGDATABASE', '--env', 'PGSSLMODE', dockerContainer, 'psql'] : [];

if (dockerContainer) {
  const inspected = spawnSync(executable, ['inspect', dockerContainer], { env, encoding: 'utf8', timeout: 10_000, shell: false });
  if (inspected.status !== 0) throw new Error('Disposable Docker container inspection failed');
  const info = JSON.parse(inspected.stdout)[0];
  if (info?.HostConfig?.NetworkMode !== 'none' || Object.keys(info?.HostConfig?.PortBindings ?? {}).length !== 0)
    throw new Error('Docker adapter requires network=none and no published ports');
}

function sync(sql) {
  const result = spawnSync(executable, [...prefix, ...baseArgs], { env, input: sql, encoding: 'utf8', timeout: 60_000, shell: false });
  if (result.status !== 0) throw new Error(`isolated psql failed: ${result.stderr?.trim() || result.error?.message || 'unknown'}`);
  return result.stdout.trim();
}
function asyncSql(sql) {
  return new Promise((resolve) => {
    const child = spawn(executable, [...prefix, ...baseArgs], { env, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
    child.stdin.end(sql);
  });
}

const actor = 'af140000-0000-4000-8000-000000000001';
const first = 'bf140000-0000-4000-8000-000000000001';
const second = 'bf140000-0000-4000-8000-000000000002';
const preflight = JSON.parse(sync(`select json_build_object(
  'database',current_database(),
  'users',(select count(*) from auth.users where id='${actor}'),
  'trials',(select count(*) from platform_billing_private.creation_entitlements where actor_user_id='${actor}')
);`));
assert.deepEqual(preflight, { database, users: 0, trials: 0 });
sync(`insert into auth.users(id,email,is_anonymous) values ('${actor}','trial-concurrency@example.invalid',false);`);

const call = requestId => `begin;
set local lock_timeout='5s'; set local statement_timeout='30s';
set local role service_role;
select public.platform_billing_community_trial_start('${actor}','${requestId}');
commit;`;
const results = await Promise.all([asyncSql(call(first)), asyncSql(call(second))]);
assert.equal(results.filter(result => result.status === 0 && result.stdout.includes('"state": "trialing"')).length, 1);
assert.equal(results.filter(result => result.status !== 0 && result.stderr.includes('PLATFORM_BILLING_STATE_CONFLICT')).length, 1);

const outcome = JSON.parse(sync(`select json_build_object(
  'trials',(select count(*) from platform_billing_private.creation_entitlements where actor_user_id='${actor}' and source_kind='verified_trial'),
  'subscriptions',(select count(*) from platform_billing_private.subscriptions where actor_user_id='${actor}'),
  'communities',(select count(*) from public.community_communities where owner_user_id='${actor}')
);`));
assert.deepEqual(outcome, { trials: 1, subscriptions: 0, communities: 0 });
console.log(JSON.stringify({ result: 'platform_billing_community_trial_concurrency_test_ok', ...outcome, liveCalls: 0 }));
