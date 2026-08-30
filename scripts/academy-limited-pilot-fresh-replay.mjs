import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const manifestPath = fileURLToPath(new URL("./academy-limited-pilot-replay-manifest.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const execute = process.argv.includes("--execute");
const baselineArg = process.argv.indexOf("--baseline");
const approvalArg = process.argv.indexOf("--approval");

const expectedSourceOrder = [
  ["academy", "supabase/migrations/20260820110909_academy_instructor_registration_ledger.sql", "512bc46e89facde00f90e9b6323057f067731e07", "migration"],
  ["academy", "supabase/migrations/20260821043626_academy_access_context_and_creation_gate.sql", "dd22806db452f85f3a1adcbe848715adb9636dc8", "migration"],
  ["academy", "supabase/migrations/20260821100151_academy_application_headquarters_visibility.sql", "17adf5c74b959c7e2aa4881f6687d54b7c3b67f9", "migration"],
  ["academy", "supabase/migrations/20260821103043_academy_class_management.sql", "e848206098b8802ff7276fbae00723e3f4d5abbe", "migration"],
  ["academy", "supabase/migrations/20260823223416_academy_learner_portal_context.sql", "1e1a6e2a0d7426dfe0ea930ddf89fb7850d51e5a", "migration"],
  ["academy", "supabase/migrations/20260823233441_academy_public_class_scheduling.sql", "9b7c490ffdd1ab536f41c46b52d6c633baf79d71", "migration"],
  ["academy", "supabase/migrations/20260825050958_academy_course_timed_learning_access.sql", "93daa91b60e594d2cec3d3b6406c0c0084d450eb", "migration"],
  ["academy", "supabase/migrations/20260825062848_academy_secure_video_asset_foundation.sql", "13bc5719c5e630bc44598de6ec219ec99d343e62", "migration"],
  ["academy", "supabase/migrations/20260825075830_academy_application_claim.sql", "d6e88a65f420d4f8e85ba77282b793c519b462ea", "migration"],
  ["academy", "supabase/migrations/20260825161200_academy_month_end_billing_snapshots.sql", "71b5f94d87ca098f65e1d1bf9cc10243bbd03bd9", "migration"],
  ["community", "supabase/migrations/20260825222427_community_academy_linked_room_entitlements.sql", "67c3b8d4456ccf1717b9089ad57c0aa246a1d253", "migration"],
  ["community", "supabase/migrations/20260826011738_community_academy_link_acceptance_ui_contract.sql", "7db24b5ff1874fe47f04a53f012e092320810108", "migration"],
  ["academy", "supabase/migrations/20260826033657_academy_seven_day_trial_foundation.sql", "ad8a35742449871a6dcf2392d12f456b7a082311", "migration"],
  ["academy", "supabase/tests/academy_release_candidate_e2e.sql", "4ca7aacde390f5a721ba26fc49ce3cc6b4e50a3a", "test"],
  ["academy", "supabase/tests/academy_billing_snapshot_e2e.sql", "0fb1fa4bf2b044d9d6aa51d651bd095da4fa7f9f", "test"],
  ["academy", "supabase/tests/academy_seven_day_trial_rls.sql", "971258890d1140a97c5d11a883368b23a211d1f5", "test"],
  ["community", "supabase/tests/community_academy_linked_room_entitlements_test.sql", "5fde332ecd11ee8822017e7e44c57d41a1d26b68", "test"],
];
const academySuccessSentinels = [
  "academy_release_candidate_e2e_ok",
  "academy_billing_snapshot_e2e_ok",
  "academy_seven_day_trial_rls_ok",
];

function git(repo, args) {
  return execFileSync("git", ["-c", `safe.directory=${repo}`, "-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function assertNoTransactionBreakingSql(sql, label) {
  const withoutComments = sql.replace(/--.*$/gm, "");
  if (/\b(?:commit|rollback)\s*;/i.test(withoutComments)) fail(`${label} contains transaction terminator`);
  if (/create\s+(?:unique\s+)?index\s+concurrently/i.test(withoutComments)) fail(`${label} contains CONCURRENTLY`);
  if (/(?:^|\n)\s*(?:\\copy|copy\s+)/i.test(withoutComments)) fail(`${label} contains COPY`);
  if (/(?:^|\n)\s*(?:begin|start\s+transaction)\s*;/i.test(withoutComments)) fail(`${label} contains nested transaction start`);
  if (/(?:^|\n)\s*(?:vacuum|cluster|create\s+database|drop\s+database|alter\s+system)\b/i.test(withoutComments)) {
    fail(`${label} contains transaction-breaking command`);
  }
}

if (JSON.stringify(manifest.sources) !== JSON.stringify(expectedSourceOrder)) {
  fail("manifest owner/path/blob/kind order does not match the frozen 17-source contract");
}

const resolved = manifest.sources.map(([owner, path, expectedBlob, kind], index) => {
  const source = manifest[owner];
  if (!source) fail(`unknown owner: ${owner}`);
  const actualBlob = git(source.repository, ["rev-parse", `${source.commit}:${path}`]);
  if (actualBlob !== expectedBlob) fail(`blob mismatch before DB connection: ${owner}:${path}`);
  const sql = git(source.repository, ["show", `${source.commit}:${path}`]);
  if (kind === "migration") assertNoTransactionBreakingSql(sql, path);
  return { index: index + 1, owner, path, expectedBlob, actualBlob, kind, sql };
});

const migrations = resolved.filter((item) => item.kind === "migration");
const tests = resolved.filter((item) => item.kind === "test");
if (migrations.length !== 13 || tests.length !== 4) fail("manifest must contain 13 migrations and 4 tests");
if (!tests[3].path.endsWith("community_academy_linked_room_entitlements_test.sql")) {
  fail("Community test must be last");
}
const communityStatements = tests[3].sql
  .replace(/--.*$/gm, "")
  .split(";")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
if (communityStatements[0] !== "begin" || communityStatements.at(-1) !== "rollback") {
  fail("Community test transaction sentinel mismatch");
}
academySuccessSentinels.forEach((sentinel, index) => {
  if (!tests[index].sql.includes(`'${sentinel}'`)) fail(`Academy test sentinel missing: ${sentinel}`);
});

const staticResult = {
  mode: execute ? "execute-requested" : "static-dry-run",
  databaseConnected: false,
  sourceCount: resolved.length,
  migrationCount: migrations.length,
  testCount: tests.length,
  sourceCommits: { academy: manifest.academy.commit, community: manifest.community.commit },
  orderVerified: true,
  blobVerified: true,
  transactionSentinelsVerified: true,
  secretsPrinted: false,
  sources: resolved.map(({ index, owner, path, expectedBlob, actualBlob, kind }) => ({
    index, owner, path, kind, expectedBlob, actualBlob,
  })),
};

if (!execute) {
  process.stdout.write(`${JSON.stringify(staticResult, null, 2)}\n`);
  process.exit(0);
}

if (process.env.ACADEMY_BASELINE_APPROVED !== "true") fail("baseline approval is required");
if (baselineArg < 0 || !process.argv[baselineArg + 1]) fail("--baseline <approved.sql> is required");
if (approvalArg < 0 || !process.argv[approvalArg + 1]) fail("--approval <approved.json> is required");
const approval = JSON.parse(readFileSync(process.argv[approvalArg + 1], "utf8"));
const previewRef = approval.projectRef || "";
if (!/^[a-z0-9]{20}$/.test(previewRef)) fail("approved Preview project ref is invalid");
if (manifest.productionProjectRefDenylist.includes(previewRef)) fail("production project is denied");
const databaseUrl = process.env.ACADEMY_PREVIEW_DATABASE_URL || "";
if (!databaseUrl || sha256(databaseUrl) !== approval.databaseUrlSha256) fail("Preview database URL SHA-256 mismatch");
let parsedDatabaseUrl;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  fail("Preview database URL is invalid");
}
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ""));
const username = decodeURIComponent(parsedDatabaseUrl.username);
if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) fail("Preview database protocol is invalid");
if (parsedDatabaseUrl.hostname !== approval.hostname || username !== approval.username || databaseName !== approval.database) {
  fail("Preview database host/user/database does not match approval");
}
if (parsedDatabaseUrl.searchParams.get("sslmode") !== "require" || approval.sslMode !== "require") {
  fail("Preview database SSL mode must be require");
}
const directRefMatch = parsedDatabaseUrl.hostname === `db.${previewRef}.supabase.co` && username === "postgres";
const poolerRefMatch = username === `postgres.${previewRef}` && /\.pooler\.supabase\.com$/.test(parsedDatabaseUrl.hostname);
if (!directRefMatch && !poolerRefMatch) fail("Preview database project ref structure mismatch");
const baseline = readFileSync(process.argv[baselineArg + 1], "utf8");
if (sha256(baseline) !== approval.baselineSha256) fail("baseline SHA-256 mismatch");
assertNoTransactionBreakingSql(baseline, "baseline");
const combined = [
  "\\set ON_ERROR_STOP on",
  "BEGIN;",
  "SET LOCAL lock_timeout = '3s';",
  "SET LOCAL statement_timeout = '10min';",
  baseline,
  ...resolved.map((item) => `\n-- ${item.owner}:${item.path}\n${item.sql}`),
].join("\n");
const run = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1"], {
  encoding: "utf8",
  input: combined,
  env: { ...process.env, PGDATABASE: databaseUrl },
  maxBuffer: 20 * 1024 * 1024,
});
const output = `${run.stdout || ""}\n${run.stderr || ""}`;
const warnings = output.split(/\r?\n/).filter((line) => /warning:/i.test(line));
const unexpected = warnings.filter((line) => !/there is already a transaction in progress/i.test(line));
if (run.status !== 0 || unexpected.length) fail("rollback-only replay failed; inspect the private runner log");
for (const sentinel of academySuccessSentinels) {
  if (!output.includes(sentinel)) fail(`replay output sentinel missing: ${sentinel}`);
}
if (!/(?:^|\n)ROLLBACK\s*(?:\n|$)/.test(output)) fail("Community rollback output sentinel missing");

const zeroResidueSql = String.raw`\set ON_ERROR_STOP on
do $zero_residue$
declare
  v_count bigint;
begin
  if to_regclass('public.academy_headquarters') is not null
    or to_regclass('public.community_access_source_mappings') is not null
  then
    raise exception 'academy_pilot_object_residue';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select count(*) from supabase_migrations.schema_migrations where version between ''20260820110909'' and ''20260826033657'''
      into v_count;
    if v_count <> 0 then raise exception 'academy_pilot_history_residue'; end if;
  end if;
  select count(*) into v_count from auth.users
  where id::text like 'a7%0000-0000-4000-8000-%';
  if v_count <> 0 then raise exception 'academy_pilot_fixture_residue'; end if;
end;
$zero_residue$;
select 'academy_pilot_zero_residue_ok' as result;
`;
const probe = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1"], {
  encoding: "utf8",
  input: zeroResidueSql,
  env: { ...process.env, PGDATABASE: databaseUrl },
});
const probeOutput = `${probe.stdout || ""}\n${probe.stderr || ""}`;
if (probe.status !== 0 || !probeOutput.includes("academy_pilot_zero_residue_ok")) {
  fail("rollback zero-residue probe failed; inspect the private runner log");
}
process.stdout.write(`${JSON.stringify({
  ...staticResult,
  mode: "rollback-only",
  databaseConnected: true,
  rollbackVerified: true,
  zeroResidueVerified: true,
  outputSentinelsVerified: 4,
}, null, 2)}\n`);
