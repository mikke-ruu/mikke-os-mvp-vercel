// Destructive fixture for a disposable, non-production PostgreSQL database.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

if (process.argv[2] !== "--run-isolated") throw new Error("Explicit --run-isolated is required");
const rawUrl = process.env.COMMUNITY_OWNER_UX_TEST_DATABASE_URL;
if (!rawUrl) throw new Error("COMMUNITY_OWNER_UX_TEST_DATABASE_URL is required");
const url = new URL(rawUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) throw new Error("Only a local disposable PostgreSQL host is allowed");
const database = url.pathname.slice(1);
if (!/^community_owner_ux_isolated_[a-z0-9_]+$/.test(database)) throw new Error("A dedicated community_owner_ux_isolated_* database is required");
const psql = process.env.PSQL_PATH || "psql";
const dockerContainer = process.env.COMMUNITY_OWNER_UX_PSQL_DOCKER_CONTAINER || "";
if (dockerContainer && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(dockerContainer)) throw new Error("Invalid disposable Docker container name");
if (dockerContainer && !/(^|[\\/])docker(?:\.exe)?$/i.test(psql)) throw new Error("PSQL_PATH must be Docker when its adapter is enabled");
if (!dockerContainer && process.platform === "win32" && /\.(?:cmd|bat)$/i.test(psql)) throw new Error("Use psql.exe or the Docker adapter on Windows");

const pgEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: database,
  PGSSLMODE: "disable",
};
delete pgEnv.COMMUNITY_OWNER_UX_TEST_DATABASE_URL;
const args = ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"];
const dockerPrefix = dockerContainer ? ["exec", "-i", "--env", "PGHOST", "--env", "PGPORT", "--env", "PGUSER", "--env", "PGPASSWORD", "--env", "PGDATABASE", "--env", "PGSSLMODE", dockerContainer, "psql"] : [];

if (dockerContainer) {
  const inspected = spawnSync(psql, ["inspect", dockerContainer], { env: pgEnv, encoding: "utf8", timeout: 10_000, shell: false });
  if (inspected.status !== 0) throw new Error("Disposable Docker container inspection failed");
  const info = JSON.parse(inspected.stdout)[0];
  if (info?.HostConfig?.NetworkMode !== "none" || Object.keys(info?.HostConfig?.PortBindings ?? {}).length !== 0) throw new Error("Docker adapter requires network=none and no published ports");
}

function sync(sql) {
  const result = spawnSync(psql, [...dockerPrefix, ...args], { env: pgEnv, input: sql, encoding: "utf8", timeout: 60_000, shell: false });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || result.error?.message || "isolated psql failed");
  return result.stdout.trim();
}
function asyncSql(sql) {
  return new Promise((resolve) => {
    const child = spawn(psql, [...dockerPrefix, ...args], { env: pgEnv, stdio: ["pipe", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(sql);
  });
}

function openHeldSql(initialSql, marker) {
  const child = spawn(psql, [...dockerPrefix, ...args], { env: pgEnv, stdio: ["pipe", "pipe", "pipe"], shell: false });
  let stdout = "";
  let stderr = "";
  let markerResolve;
  let markerReject;
  let settled = false;
  const markerSeen = new Promise((resolve, reject) => { markerResolve = resolve; markerReject = reject; });
  const completion = new Promise((resolve) => {
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes(marker)) markerResolve();
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", markerReject);
    child.on("close", (status) => {
      settled = true;
      resolve({ status, stdout, stderr });
    });
  });
  child.stdin.write(initialSql);
  return {
    async waitUntilHeld() {
      await Promise.race([markerSeen, new Promise((_, reject) => setTimeout(() => reject(new Error(`${marker} was not observed`)), 10_000))]);
    },
    release(sql) { child.stdin.end(sql); },
    abort() {
      if (settled) return;
      if (!child.stdin.destroyed) child.stdin.end("rollback;\n");
      else child.kill();
    },
    completion
  };
}

const owner = "df100000-0000-4000-8000-000000000001";
const staff = "df100000-0000-4000-8000-000000000002";
const member = "df100000-0000-4000-8000-000000000003";
const community = "df110000-0000-4000-8000-000000000001";
const plan = "df120000-0000-4000-8000-000000000001";
const request = "df130000-0000-4000-8000-000000000001";
const revokedRequest = "df130000-0000-4000-8000-000000000002";

const preflight = JSON.parse(sync(`select json_build_object(
  'database',current_database(),
  'users',(select count(*) from auth.users where id::text like 'df1%'),
  'communities',(select count(*) from public.community_communities where id::text like 'df1%')
);`));
assert.deepEqual(preflight, { database, users: 0, communities: 0 });

sync(`
insert into auth.users(id,email,is_anonymous) values
  ('${owner}','owner-owner-ux-concurrency@example.invalid',false),
  ('${staff}','staff-owner-ux-concurrency@example.invalid',false),
  ('${member}','member-owner-ux-concurrency@example.invalid',false);
insert into public.community_communities(id,slug,name,join_mode,owner_user_id)
values('${community}','owner-ux-concurrency','Owner UX concurrency','open_free','${owner}');
insert into public.community_memberships(community_id,user_id,role,status) values
  ('${community}','${owner}','owner','active'),
  ('${community}','${staff}','moderator','active'),
  ('${community}','${member}','member','active');
insert into platform_billing_private.creation_entitlements(
  actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,status,starts_at,expires_at,resource_id,consumed_at
) values('${owner}','community_platform','trial','verified_trial','df140000-0000-4000-8000-000000000001','df150000-0000-4000-8000-000000000001','consumed',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '30 days','${community}',statement_timestamp());
insert into public.community_entitlement_definitions(community_id,key,name) values('${community}','paid:manual','Manual paid');
insert into public.community_membership_plans(id,community_id,entitlement_key,name,amount_yen,billing_interval,payment_provider_label,external_payment_url,status,created_by_user_id)
values('${plan}','${community}','paid:manual','Manual paid',1000,'month','Manual','','active','${owner}');
`);

const call = (requestId, applicationName = "owner_ux_manual_payment") => `begin; set local application_name='${applicationName}'; set local lock_timeout='5s'; set local statement_timeout='30s';
select set_config('request.jwt.claims','{"sub":"${staff}","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select (public.community_record_manual_payment('${community}','${plan}','${member}','bank_transfer','BANK-001','confirmed','${requestId}')).id;
commit;`;

async function waitForActivity(applicationName, requireLockWait = false) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const state = JSON.parse(sync(`select json_build_object(
      'present',exists(select 1 from pg_catalog.pg_stat_activity where datname=current_database() and application_name='${applicationName}'),
      'lockWaiting',exists(select 1 from pg_catalog.pg_stat_activity where datname=current_database() and application_name='${applicationName}' and wait_event_type='Lock')
    );`));
    if (state.present && (!requireLockWait || state.lockWaiting)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${applicationName} did not reach the required database wait state`);
}

const replay = await Promise.all([asyncSql(call(request)), asyncSql(call(request))]);
assert.equal(replay.filter((item) => item.status === 0).length, 2, "both identical retries must succeed");
const replayState = JSON.parse(sync(`select json_build_object(
  'claims',(select count(*) from public.community_payment_claims where manual_request_id='${request}'),
  'entitlements',(select count(*) from public.community_member_entitlements where community_id='${community}' and user_id='${member}' and entitlement_key='paid:manual' and source='external')
);`));
assert.deepEqual(replayState, { claims: 1, entitlements: 1 });

const revokeStaff = openHeldSql(`begin; set local application_name='owner_ux_revoke_new'; select 1 from public.community_communities where id='${community}' for update; select '__OWNER_UX_NEW_LOCK_HELD__';\n`, "__OWNER_UX_NEW_LOCK_HELD__");
try {
  await revokeStaff.waitUntilHeld();
  const blockedGrant = asyncSql(call(revokedRequest, "owner_ux_blocked_new"));
  await waitForActivity("owner_ux_blocked_new", true);
  revokeStaff.release(`update public.community_memberships set status='suspended' where community_id='${community}' and user_id='${staff}'; commit;\n`);
  const [revokeResult, blockedResult] = await Promise.all([revokeStaff.completion, blockedGrant]);
  assert.equal(revokeResult.status, 0, "staff revocation transaction must succeed");
  assert.notEqual(blockedResult.status, 0, "grant waiting behind revocation must fail");
  assert.match(blockedResult.stderr, /Community staff authority is required/);
} finally {
  revokeStaff.abort();
}

sync(`update public.community_memberships set status='active' where community_id='${community}' and user_id='${staff}';`);
const revokeReplayStaff = openHeldSql(`begin; set local application_name='owner_ux_revoke_replay'; select 1 from public.community_communities where id='${community}' for update; select '__OWNER_UX_REPLAY_LOCK_HELD__';\n`, "__OWNER_UX_REPLAY_LOCK_HELD__");
try {
  await revokeReplayStaff.waitUntilHeld();
  const blockedReplay = asyncSql(call(request, "owner_ux_blocked_replay"));
  await waitForActivity("owner_ux_blocked_replay", true);
  revokeReplayStaff.release(`update public.community_memberships set status='suspended' where community_id='${community}' and user_id='${staff}'; commit;\n`);
  const [revokeReplayResult, blockedReplayResult] = await Promise.all([revokeReplayStaff.completion, blockedReplay]);
  assert.equal(revokeReplayResult.status, 0, "staff revocation before replay must succeed");
  assert.notEqual(blockedReplayResult.status, 0, "idempotent replay waiting behind revocation must fail");
  assert.match(blockedReplayResult.stderr, /Community staff authority is required/);
} finally {
  revokeReplayStaff.abort();
}
const finalState = JSON.parse(sync(`select json_build_object(
  'revokedRequestClaims',(select count(*) from public.community_payment_claims where manual_request_id='${revokedRequest}'),
  'allClaims',(select count(*) from public.community_payment_claims where community_id='${community}')
);`));
assert.deepEqual(finalState, { revokedRequestClaims: 0, allClaims: 1 });
sync(`
set session_replication_role = replica;
delete from public.community_payment_claims where community_id='${community}';
delete from public.community_member_entitlements where community_id='${community}';
delete from public.community_membership_plans where community_id='${community}';
delete from public.community_entitlement_definitions where community_id='${community}';
delete from public.community_memberships where community_id='${community}';
delete from platform_billing_private.creation_entitlements where resource_id='${community}';
delete from public.community_communities where id='${community}';
delete from auth.users where id in ('${owner}','${staff}','${member}');
set session_replication_role = origin;
`);
const residue = JSON.parse(sync(`select json_build_object(
  'users',(select count(*) from auth.users where id::text like 'df1%'),
  'communities',(select count(*) from public.community_communities where id::text like 'df1%'),
  'claims',(select count(*) from public.community_payment_claims where manual_request_id in ('${request}','${revokedRequest}')),
  'entitlements',(select count(*) from public.community_member_entitlements where community_id='${community}')
);`));
assert.deepEqual(residue, { users: 0, communities: 0, claims: 0, entitlements: 0 });
console.log(JSON.stringify({ result: "community_owner_ux_concurrency_test_ok", ...replayState, ...finalState, residue, liveCalls: 0 }));
