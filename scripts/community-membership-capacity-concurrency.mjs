// Destructive fixture for a disposable, non-production PostgreSQL database.
// The caller must destroy the database/container after this succeeds or fails.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

if (process.argv[2] !== "--run-isolated") {
  throw new Error("Explicit --run-isolated is required");
}
const rawUrl = process.env.COMMUNITY_CAPACITY_TEST_DATABASE_URL;
if (!rawUrl) throw new Error("COMMUNITY_CAPACITY_TEST_DATABASE_URL is required");
const url = new URL(rawUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
  throw new Error("Only a local disposable PostgreSQL host is allowed");
}
const database = url.pathname.slice(1);
if (!/^community_capacity_isolated_[a-z0-9_]+$/.test(database)) {
  throw new Error("A dedicated community_capacity_isolated_* database is required");
}
const psql = process.env.PSQL_PATH || "psql";
const pgEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: database,
  PGSSLMODE: "disable",
};
delete pgEnv.COMMUNITY_CAPACITY_TEST_DATABASE_URL;
const args = ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate"];

function sync(sql) {
  const result = spawnSync(psql, args, { env: pgEnv, input: sql, encoding: "utf8", timeout: 60_000 });
  if (result.status !== 0) throw new Error(`isolated psql failed: ${result.stderr?.trim() || result.error?.message || "unknown"}`);
  return result.stdout.trim();
}
function asyncSql(sql) {
  return new Promise((resolve) => {
    const child = spawn(psql, args, { env: pgEnv, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(sql);
  });
}

const owner = "ca070000-0000-4000-8000-000000000001";
const staff = "ca070000-0000-4000-8000-000000000002";
const first = "ca070000-0000-4000-8000-000000000003";
const second = "ca070000-0000-4000-8000-000000000004";
const community = "cb070000-0000-4000-8000-000000000001";
const firstApplication = "ce070000-0000-4000-8000-000000000001";
const secondApplication = "ce070000-0000-4000-8000-000000000002";

const preflight = JSON.parse(sync(`select json_build_object(
  'database', current_database(),
  'fixtureUsers', (select count(*) from auth.users where id::text like 'ca070000-%'),
  'fixtureCommunities', (select count(*) from public.community_communities where id::text like 'cb070000-%')
);`));
assert.equal(preflight.database, database);
assert.equal(preflight.fixtureUsers, 0);
assert.equal(preflight.fixtureCommunities, 0);

sync(`
insert into auth.users(id,email,is_anonymous) values
  ('${owner}','concurrency-owner@example.invalid',false),
  ('${staff}','concurrency-staff@example.invalid',false),
  ('${first}','concurrency-first@example.invalid',false),
  ('${second}','concurrency-second@example.invalid',false),
  ('ca070000-0000-4000-8000-000000000010','concurrency-10@example.invalid',false),
  ('ca070000-0000-4000-8000-000000000011','concurrency-11@example.invalid',false),
  ('ca070000-0000-4000-8000-000000000012','concurrency-12@example.invalid',false),
  ('ca070000-0000-4000-8000-000000000013','concurrency-13@example.invalid',false),
  ('ca070000-0000-4000-8000-000000000014','concurrency-14@example.invalid',false),
  ('ca070000-0000-4000-8000-000000000015','concurrency-15@example.invalid',false),
  ('ca070000-0000-4000-8000-000000000016','concurrency-16@example.invalid',false);
insert into public.community_communities(id,slug,name,join_mode,owner_user_id)
values ('${community}','capacity-concurrency','Capacity concurrency','open_free','${owner}');
insert into public.community_memberships(community_id,user_id,role,status) values
  ('${community}','${owner}','owner','active'),
  ('${community}','${staff}','moderator','active'),
  ('${community}','ca070000-0000-4000-8000-000000000010','member','active'),
  ('${community}','ca070000-0000-4000-8000-000000000011','member','active'),
  ('${community}','ca070000-0000-4000-8000-000000000012','member','active'),
  ('${community}','ca070000-0000-4000-8000-000000000013','member','active'),
  ('${community}','ca070000-0000-4000-8000-000000000014','member','active'),
  ('${community}','ca070000-0000-4000-8000-000000000015','member','active'),
  ('${community}','ca070000-0000-4000-8000-000000000016','member','active');
insert into platform_billing_private.creation_entitlements(
  actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,
  status,starts_at,expires_at,resource_id,consumed_at
) values (
  '${owner}','community_platform','trial','verified_trial',
  'cc070000-0000-4000-8000-000000000001','cd070000-0000-4000-8000-000000000001',
  'consumed',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '30 days',
  '${community}',statement_timestamp()
);
insert into public.community_join_applications(
  id,community_id,user_id,display_name,legal_name,email,phone,status
) values
  ('${firstApplication}','${community}','${first}','First','First','concurrency-first@example.invalid','09000000001','pending'),
  ('${secondApplication}','${community}','${second}','Second','Second','concurrency-second@example.invalid','09000000002','pending');
`);

const call = (application) => `
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select set_config('request.jwt.claims','{"sub":"${staff}","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select public.community_review_join_application('${application}','approved',null);
commit;
`;
const results = await Promise.all([asyncSql(call(firstApplication)), asyncSql(call(secondApplication))]);
const passed = results.filter((result) => result.status === 0);
const blocked = results.filter((result) => result.status !== 0 && result.stderr.includes("COMMUNITY_MEMBER_CAPACITY_REACHED"));
assert.equal(passed.length, 1, "exactly one concurrent activation must succeed");
assert.equal(blocked.length, 1, "the second concurrent activation must hit the stable capacity error");

const outcome = JSON.parse(sync(`select json_build_object(
  'activeMembers',(select count(*) from public.community_memberships where community_id='${community}' and status='active'),
  'approved',(select count(*) from public.community_join_applications where id in ('${firstApplication}','${secondApplication}') and status='approved'),
  'pending',(select count(*) from public.community_join_applications where id in ('${firstApplication}','${secondApplication}') and status='pending')
);`));
assert.deepEqual(outcome, { activeMembers: 10, approved: 1, pending: 1 });
console.log(JSON.stringify({ result: "community_membership_capacity_concurrency_test_ok", ...outcome, liveCalls: 0 }));
