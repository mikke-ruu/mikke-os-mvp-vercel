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
const expectedDeltaOrder = [
  ["delta", "supabase/migrations/20260830143000_academy_limited_pilot_access_controls.sql", "3a14bf692e4fd722cc8673fd7412f997c802d3e9", "migration"],
  ["delta", "supabase/tests/academy_limited_pilot_access_controls_test.sql", "5edc54e67114f360dd14d02ff6bbc393e2a22972", "test"],
];
const academySuccessSentinels = [
  "academy_release_candidate_e2e_ok",
  "academy_billing_snapshot_e2e_ok",
  "academy_seven_day_trial_rls_ok",
];
const deltaSuccessSentinel = "academy_limited_pilot_access_controls_ok";
const canonicalCatalogSchemas = ["community_private", "private", "public"];
const timeoutSql = [
  "SET LOCAL lock_timeout = '5s';",
  "SET LOCAL statement_timeout = '180s';",
  "SET LOCAL idle_in_transaction_session_timeout = '240s';",
];
const catalogKinds = ["relation", "column", "function", "index", "policy", "trigger", "constraint"];

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

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
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

function assertBaselineMetaCommands(sql) {
  const commands = sql.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("\\"));
  if (commands.length === 0) return;
  if (commands.length !== 2) fail("baseline psql meta-command count is not allowlisted");
  const restrict = commands[0].match(/^\\restrict\s+([A-Za-z0-9_]+)$/);
  const unrestrict = commands[1].match(/^\\unrestrict\s+([A-Za-z0-9_]+)$/);
  if (!restrict || !unrestrict || restrict[1] !== unrestrict[1]) {
    fail("baseline permits only one matching restrict/unrestrict pair");
  }
}

function resolveSources(sourceEntries) {
  return sourceEntries.map(([owner, path, expectedBlob, kind], index) => {
    const source = manifest[owner];
    if (!source) fail(`unknown owner: ${owner}`);
    const actualBlob = git(source.repository, ["rev-parse", `${source.commit}:${path}`]);
    if (actualBlob !== expectedBlob) fail(`blob mismatch before DB connection: ${owner}:${path}`);
    const sql = git(source.repository, ["show", `${source.commit}:${path}`]);
    if (kind === "migration") assertNoTransactionBreakingSql(sql, path);
    return { index: index + 1, owner, path, expectedBlob, actualBlob, kind, sql };
  });
}

if (JSON.stringify(manifest.sources) !== JSON.stringify(expectedSourceOrder)) {
  fail("manifest owner/path/blob/kind order does not match the frozen 17-source contract");
}
if (JSON.stringify(manifest.deltaSources) !== JSON.stringify(expectedDeltaOrder)) {
  fail("manifest delta owner/path/blob/kind order does not match the frozen 2-source contract");
}
if (!Array.isArray(manifest.fixtureIds) || manifest.fixtureIds.length < 30) fail("fixture identity manifest is incomplete");

const resolved = resolveSources(manifest.sources);
const resolvedDelta = resolveSources(manifest.deltaSources);
const migrations = resolved.filter((item) => item.kind === "migration");
const tests = resolved.filter((item) => item.kind === "test");
if (migrations.length !== 13 || tests.length !== 4) fail("manifest must contain 13 migrations and 4 tests");
if (resolvedDelta.length !== 2 || resolvedDelta[0].kind !== "migration" || resolvedDelta[1].kind !== "test") {
  fail("delta contract must contain migration then test");
}
if (!tests[3].path.endsWith("community_academy_linked_room_entitlements_test.sql")) fail("Community test must be last");
const communityStatements = tests[3].sql.replace(/--.*$/gm, "").split(";").map((value) => value.trim().toLowerCase()).filter(Boolean);
if (communityStatements[0] !== "begin" || communityStatements.at(-1) !== "rollback") {
  fail("Community test transaction sentinel mismatch");
}
academySuccessSentinels.forEach((sentinel, index) => {
  if (!tests[index].sql.includes(`'${sentinel}'`)) fail(`Academy test sentinel missing: ${sentinel}`);
});
if (!resolvedDelta[1].sql.includes(`'${deltaSuccessSentinel}'`)) fail("delta test sentinel missing");
const discoveredFixtureIds = [...new Set(
  [...tests, resolvedDelta[1]]
    .flatMap((item) => item.sql.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi) || [])
    .map((value) => value.toLowerCase())
)].sort();
if (JSON.stringify(discoveredFixtureIds) !== JSON.stringify([...manifest.fixtureIds].sort())) {
  fail("fixture identity manifest does not match frozen test sources");
}

const staticResult = {
  mode: execute ? "execute-requested" : "static-dry-run",
  databaseConnected: false,
  sourceCount: resolved.length,
  migrationCount: migrations.length,
  testCount: tests.length,
  deltaSourceCount: resolvedDelta.length,
  sourceCommits: {
    academy: manifest.academy.commit,
    community: manifest.community.commit,
    delta: manifest.delta.commit,
  },
  orderVerified: true,
  blobVerified: true,
  transactionSentinelsVerified: true,
  fixtureIdentityCount: manifest.fixtureIds.length,
  secretsPrinted: false,
  sources: [...resolved, ...resolvedDelta].map(({ index, owner, path, expectedBlob, actualBlob, kind }) => ({
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
if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) fail("Preview database protocol is invalid");
if (parsedDatabaseUrl.hostname !== approval.hostname || username !== approval.username || databaseName !== approval.database) {
  fail("Preview database host/user/database does not match approval");
}
if (parsedDatabaseUrl.searchParams.get("sslmode") !== "require" || approval.sslMode !== "require") {
  fail("Preview database SSL mode must be require");
}
const directRefMatch = parsedDatabaseUrl.hostname === `db.${previewRef}.supabase.co` && username === "postgres";
const poolerRefMatch = username === `postgres.${previewRef}` && /\.pooler\.supabase\.com$/.test(parsedDatabaseUrl.hostname);
if (!directRefMatch && !poolerRefMatch) fail("Preview database project ref structure mismatch");
if (!Array.isArray(approval.catalogSchemas)) fail("approved catalog schema list is required");
for (const schema of approval.catalogSchemas) {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema) || ["auth", "storage", "vault"].includes(schema)) {
    fail("approved catalog schema is invalid");
  }
}
if (JSON.stringify([...approval.catalogSchemas].sort()) !== JSON.stringify(canonicalCatalogSchemas)) {
  fail("approved catalog schemas must exactly match the canonical schema set");
}
if (!/^[a-f0-9]{64}$/.test(approval.preflightSnapshotSha256 || "")) fail("approved preflight snapshot SHA-256 is required");
const baseline = readFileSync(process.argv[baselineArg + 1], "utf8");
if (sha256(baseline) !== approval.baselineSha256) fail("baseline SHA-256 mismatch");
assertNoTransactionBreakingSql(baseline, "baseline");
assertBaselineMetaCommands(baseline);

function runPsql(sql, quiet = false) {
  const args = quiet
    ? ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"]
    : ["-X", "-v", "ON_ERROR_STOP=1"];
  return spawnSync("psql", args, {
    encoding: "utf8",
    input: sql,
    env: { ...process.env, PGDATABASE: databaseUrl },
    maxBuffer: 24 * 1024 * 1024,
  });
}

const schemaSql = approval.catalogSchemas.map(sqlLiteral).join(", ");
const catalogSql = `
SET lock_timeout = '5s';
SET statement_timeout = '180s';
SET idle_in_transaction_session_timeout = '240s';
with target_namespace as (
  select oid, nspname from pg_namespace where nspname in (${schemaSql})
)
select line from (
  select 'relation|' || n.nspname || '|' || c.relname || '|' || c.relkind || '|' ||
    md5(jsonb_build_array(c.relpersistence, c.relrowsecurity, c.relforcerowsecurity, c.relacl)::text) as line
  from pg_class c join target_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r','p','v','m','S','f')
  union all
  select 'column|' || n.nspname || '|' || c.relname || '|' || a.attname || '|' ||
    pg_catalog.format_type(a.atttypid, a.atttypmod) || '|' ||
    md5(jsonb_build_array(a.attnotnull, a.attidentity, a.attgenerated,
      pg_get_expr(d.adbin, d.adrelid), a.attacl)::text)
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join target_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m','f')
  union all
  select 'function|' || n.nspname || '|' || p.proname || '|' ||
    pg_get_function_identity_arguments(p.oid) || '|' ||
    md5(jsonb_build_array(p.prokind, p.prosecdef, p.provolatile, p.proconfig, p.proacl,
      pg_get_functiondef(p.oid))::text)
  from pg_proc p join target_namespace n on n.oid = p.pronamespace
  where p.prokind in ('f','p')
  union all
  select 'index|' || n.nspname || '|' || idx.relname || '|' ||
    md5(pg_get_indexdef(i.indexrelid))
  from pg_index i
  join pg_class idx on idx.oid = i.indexrelid
  join pg_class tbl on tbl.oid = i.indrelid
  join target_namespace n on n.oid = tbl.relnamespace
  union all
  select 'policy|' || n.nspname || '|' || c.relname || '|' || pol.polname || '|' ||
    md5(jsonb_build_array(pol.polcmd, pol.polpermissive, pol.polroles,
      pg_get_expr(pol.polqual, pol.polrelid), pg_get_expr(pol.polwithcheck, pol.polrelid))::text)
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join target_namespace n on n.oid = c.relnamespace
  union all
  select 'trigger|' || n.nspname || '|' || c.relname || '|' || t.tgname || '|' ||
    md5(pg_get_triggerdef(t.oid))
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join target_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
  union all
  select 'constraint|' || n.nspname || '|' || c.relname || '|' || con.conname || '|' ||
    md5(pg_get_constraintdef(con.oid, true))
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join target_namespace n on n.oid = c.relnamespace
) catalog
order by line;
`;

function psqlOutputOrFail(run, label) {
  if (run.status !== 0) fail(`${label} failed; inspect the private runner log`);
  return String(run.stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function quotedTable(schema, table) {
  return `${sqlIdentifier(schema)}.${sqlIdentifier(table)}`;
}

function collectSnapshot() {
  const catalogLines = psqlOutputOrFail(runPsql(catalogSql, true), "catalog snapshot");
  const relationLines = catalogLines.filter((line) => line.startsWith("relation|"));
  const tableKeys = new Set(
    relationLines
      .map((line) => line.split("|"))
      .filter((parts) => ["r", "p"].includes(parts[3]))
      .map((parts) => `${parts[1]}|${parts[2]}`)
  );
  const rowQueries = [...tableKeys].sort().map((key) => {
    const [schema, table] = key.split("|");
    return `select 'rows|${schema}|${table}|' || count(*) from ${quotedTable(schema, table)}`;
  });
  const uuidColumns = catalogLines
    .filter((line) => line.startsWith("column|"))
    .map((line) => line.split("|"))
    .filter((parts) => parts[4] === "uuid" && tableKeys.has(`${parts[1]}|${parts[2]}`));
  const fixtureArray = manifest.fixtureIds.map((value) => `${sqlLiteral(value)}::uuid`).join(", ");
  const fixtureQueries = uuidColumns.map((parts) =>
    `select 'fixture|${parts[1]}|${parts[2]}|${parts[3]}|' || count(*) from ${quotedTable(parts[1], parts[2])} where ${sqlIdentifier(parts[3])} = any(array[${fixtureArray}])`
  );
  const sessionTimeouts = "SET lock_timeout = '5s'; SET statement_timeout = '180s'; SET idle_in_transaction_session_timeout = '240s';";
  const rowLines = rowQueries.length
    ? psqlOutputOrFail(runPsql(`${sessionTimeouts}\n${rowQueries.join("\nunion all\n")}\norder by 1;`, true), "row-count snapshot")
    : [];
  const fixtureLines = fixtureQueries.length
    ? psqlOutputOrFail(runPsql(`${sessionTimeouts}\n${fixtureQueries.join("\nunion all\n")}\norder by 1;`, true), "fixture snapshot")
    : [];
  const authFixtureLines = psqlOutputOrFail(runPsql(`${sessionTimeouts}
    select 'auth_fixture|users|id|' || count(*) || '|' ||
      md5(coalesce(string_agg(id::text, '' order by id::text), ''))
    from auth.users
    where id = any(array[${fixtureArray}]);`, true), "auth fixture snapshot");
  const historyExists = psqlOutputOrFail(
    runPsql(`${sessionTimeouts} select to_regclass('supabase_migrations.schema_migrations') is not null;`, true),
    "migration-history existence probe"
  )[0] === "t";
  const historyLines = historyExists
    ? psqlOutputOrFail(runPsql(`${sessionTimeouts}
        select 'history|schema_migrations|' || count(*) || '|' ||
          md5(coalesce(string_agg(to_jsonb(h)::text, '' order by to_jsonb(h)::text), ''))
        from supabase_migrations.schema_migrations h;`, true), "migration-history snapshot")
    : ["history|schema_migrations|absent"];
  const lines = [...catalogLines, ...rowLines, ...fixtureLines, ...authFixtureLines, ...historyLines].sort();
  return { lines, sha256: sha256(lines.join("\n")) };
}

function numericTail(line) {
  const value = Number(line.split("|").at(-1));
  return Number.isFinite(value) ? value : 0;
}

function fixtureRowCount(line) {
  if (line.startsWith("auth_fixture|")) {
    const value = Number(line.split("|").at(-2));
    return Number.isFinite(value) ? value : 0;
  }
  return numericTail(line);
}

function compareSnapshots(before, after, stage) {
  const beforeSet = new Set(before.lines);
  const afterSet = new Set(after.lines);
  const differences = [...beforeSet].filter((line) => !afterSet.has(line))
    .concat([...afterSet].filter((line) => !beforeSet.has(line)));
  const classificationActual = Object.fromEntries(
    catalogKinds.map((kind) => [kind, {
      expected: 0,
      actual: differences.filter((line) => line.startsWith(`${kind}|`)).length,
    }])
  );
  const historyActual = differences.filter((line) => line.startsWith("history|")).length;
  const rowCountActual = differences.filter((line) => line.startsWith("rows|")).length;
  const fixtureFingerprintActual = differences.filter((line) => line.startsWith("fixture|")).length;
  const authFixtureFingerprintActual = differences.filter((line) => line.startsWith("auth_fixture|")).length;
  const fixtureRowsActual = after.lines
    .filter((line) => line.startsWith("fixture|") || line.startsWith("auth_fixture|"))
    .reduce((sum, line) => sum + fixtureRowCount(line), 0);
  const evidence = {
    catalog: classificationActual,
    history: { expected: 0, actual: historyActual },
    rowCounts: { expected: 0, actual: rowCountActual },
    fixtureFingerprints: { expected: 0, actual: fixtureFingerprintActual },
    authFixtureFingerprints: { expected: 0, actual: authFixtureFingerprintActual },
    fixtureRows: { expected: 0, actual: fixtureRowsActual },
  };
  const actualTotal = Object.values(classificationActual).reduce((sum, item) => sum + item.actual, 0)
    + historyActual + rowCountActual + fixtureFingerprintActual + authFixtureFingerprintActual + fixtureRowsActual;
  if (before.sha256 !== after.sha256 || differences.length || actualTotal !== 0) {
    fail(`${stage} rollback residue detected`);
  }
  return evidence;
}

const preflight = collectSnapshot();
if (preflight.sha256 !== approval.preflightSnapshotSha256) fail("approved preflight catalog/data snapshot SHA-256 mismatch");
if (preflight.lines
  .filter((line) => line.startsWith("fixture|") || line.startsWith("auth_fixture|"))
  .reduce((sum, line) => sum + fixtureRowCount(line), 0) !== 0) {
  fail("fixture identities already exist before replay");
}

const frozenSql = [
  "\\set ON_ERROR_STOP on",
  "BEGIN;",
  ...timeoutSql,
  baseline,
  ...resolved.map((item) => `\n-- ${item.owner}:${item.path}\n${item.sql}`),
].join("\n");
const frozenRun = runPsql(frozenSql);
const frozenOutput = `${frozenRun.stdout || ""}\n${frozenRun.stderr || ""}`;
const frozenWarnings = frozenOutput.split(/\r?\n/).filter((line) => /warning:/i.test(line));
const unexpectedFrozenWarnings = frozenWarnings.filter((line) => !/there is already a transaction in progress/i.test(line));
if (frozenRun.status !== 0 || unexpectedFrozenWarnings.length) fail("frozen rollback-only replay failed; inspect the private runner log");
for (const sentinel of academySuccessSentinels) {
  if (!frozenOutput.includes(sentinel)) fail(`frozen replay output sentinel missing: ${sentinel}`);
}
if (!/(?:^|\n)ROLLBACK\s*(?:\n|$)/.test(frozenOutput)) fail("Community rollback output sentinel missing");
const frozenResidue = compareSnapshots(preflight, collectSnapshot(), "frozen package");

const deltaSql = [
  "\\set ON_ERROR_STOP on",
  "BEGIN;",
  ...timeoutSql,
  baseline,
  ...migrations.map((item) => `\n-- ${item.owner}:${item.path}\n${item.sql}`),
  `\n-- ${resolvedDelta[0].owner}:${resolvedDelta[0].path}\n${resolvedDelta[0].sql}`,
  `\n-- ${resolvedDelta[1].owner}:${resolvedDelta[1].path}\n${resolvedDelta[1].sql}`,
  "ROLLBACK;",
].join("\n");
const deltaRun = runPsql(deltaSql);
const deltaOutput = `${deltaRun.stdout || ""}\n${deltaRun.stderr || ""}`;
if (deltaRun.status !== 0) fail("delta rollback-only replay failed; inspect the private runner log");
if (!deltaOutput.includes(deltaSuccessSentinel) || !/(?:^|\n)ROLLBACK\s*(?:\n|$)/.test(deltaOutput)) {
  fail("delta replay output sentinel missing");
}
const deltaResidue = compareSnapshots(preflight, collectSnapshot(), "delta package");

process.stdout.write(`${JSON.stringify({
  ...staticResult,
  mode: "rollback-only",
  databaseConnected: true,
  stages: {
    frozen: { sentinelsVerified: 4, residue: frozenResidue },
    delta: { sentinelsVerified: 1, residue: deltaResidue },
  },
  rollbackVerified: true,
  zeroResidueVerified: true,
}, null, 2)}\n`);
