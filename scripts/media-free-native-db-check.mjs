import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, rmSync, realpathSync, statSync } from "node:fs";
import { resolve, join, sep, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createMediaPublicReader } from "../lib/media-app/public-contract.ts";
import { createMediaPublicRpcTransport } from "../lib/media-app/public-rpc.ts";

// Synthetic SQL only. This does not start Supabase Auth, PostgREST, or Storage.
assert.ok(process.argv.includes("--run"), "Explicit --run required");
const binIndex = process.argv.indexOf("--bin");
assert.ok(binIndex >= 0 && process.argv[binIndex + 1], "Explicit --bin required");
const bin = resolve(process.argv[binIndex + 1]);
const approvedRoot = resolve("G:/Musubiプロジェクト/.tools/media-pg-20260907");
assert.ok(bin.toLowerCase().startsWith((approvedRoot + sep).toLowerCase()), "Only the dedicated test runtime may be used");
// Native Windows PostgreSQL requires an ASCII path on this host. Verify the
// short-path alias resolves to the same dedicated writable runtime directory.
const asciiRoot = resolve("G:/MUSUBI~1/TOOLS~1/MEDIA-~1");
assert.equal(statSync(asciiRoot, { bigint: true }).ino, statSync(approvedRoot, { bigint: true }).ino);
assert.equal(statSync(asciiRoot, { bigint: true }).dev, statSync(approvedRoot, { bigint: true }).dev);
const executableBin = join(asciiRoot, relative(approvedRoot, bin));
const tempRoot = resolve(asciiRoot, "runs");
const runRoot = resolve(tempRoot, `media-native-${randomUUID()}`);
const dataDir = join(runRoot, "data");
assert.ok(runRoot.startsWith(tempRoot + sep), "Test directory must remain inside this worktree");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const baseline = readFileSync("G:/Musubiプロジェクト/mikke-os-mvp-db-baseline-20260829/supabase/baseline/20260829000000_mikkeos_schema_baseline.sql", "utf8");
assert.equal(hash(baseline).toUpperCase(), "521BF5A61EB8FE572011526FAA469A679328F581E3BC291191AEF18379C97299");
const bootstrap = readFileSync("G:/Musubiプロジェクト/mikke-os-mvp-hq-access-management-20260831/supabase/tests/hq_local_auth_bootstrap.sql", "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260902054001_media_free_foundation.sql", import.meta.url), "utf8");
const tests = readFileSync(new URL("../supabase/tests/media_free_foundation_rls.sql", import.meta.url), "utf8");
assert.match(tests, /^rollback;/m);

function command(name, args, input = "", timeout = 180000) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(join(executableBin, `${name}.exe`), args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${name} timeout`)); }, timeout);
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); code === 0 ? resolveCommand(stdout) : reject(new Error(`${name}: ${stderr || stdout}`)); });
    // pg_ctl's detached server can inherit pipe handles on Windows. Its exit,
    // rather than pipe close, is the completed start/stop command boundary.
    if (name === "pg_ctl") child.on("exit", (code) => {
      clearTimeout(timer);
      child.stdout.destroy(); child.stderr.destroy();
      code === 0 ? resolveCommand(stdout) : reject(new Error(`${name}: ${stderr || stdout}`));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

const probe = createServer();
await new Promise((res, rej) => { probe.once("error", rej); probe.listen(0, "127.0.0.1", res); });
const port = probe.address().port;
await new Promise((res) => probe.close(res));
const { default: pg } = await import(pathToFileURL(join(approvedRoot, "node_modules/pg/lib/index.js")));
async function psql(sql) {
  const client = new pg.Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres", connectionTimeoutMillis: 10000, query_timeout: 180000 });
  await client.connect();
  try {
    const result = await client.query(sql);
    return (Array.isArray(result) ? result : [result]).flatMap((part) => part.rows.map((row) => {
      const value = Object.values(row)[0];
      return typeof value === "string" ? value : JSON.stringify(value);
    })).join("\n");
  } finally { await client.end(); }
}
async function snapshot() {
  const state = await psql(`select json_build_object(
    'schemas',(select json_agg(row(nspname,nspacl) order by nspname) from pg_namespace where nspname not like 'pg_temp_%' and nspname not like 'pg_toast_temp_%'),
    'relations',(select json_agg(row(n.nspname,c.relname,c.relkind,c.relacl,c.relrowsecurity) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','storage','extensions','supabase_migrations','community_private')),
    'columns',(select json_agg(row(n.nspname,c.relname,a.attname,a.atttypid,a.attnotnull,a.attacl,pg_get_expr(d.adbin,d.adrelid)) order by n.nspname,c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped and n.nspname in ('public','private','auth','storage','extensions','supabase_migrations','community_private')),
    'functions',(select json_agg(row(n.nspname,p.proname,p.proacl,pg_get_functiondef(p.oid)) order by n.nspname,p.proname,p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind<>'a' and n.nspname in ('public','private','auth','storage','extensions','supabase_migrations','community_private')),
    'constraints',(select json_agg(row(n.nspname,c.conname,pg_get_constraintdef(c.oid)) order by n.nspname,c.conname,c.oid) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private','auth','storage','extensions','supabase_migrations','community_private')),
    'indexes',(select json_agg(row(n.nspname,c.relname,pg_get_indexdef(i.indexrelid)) order by n.nspname,c.relname) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','storage','extensions','supabase_migrations','community_private')),
    'policies',(select json_agg(row(p.polname,p.polrelid,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polrelid,p.polname) from pg_policy p),
    'triggers',(select json_agg(pg_get_triggerdef(oid) order by oid) from pg_trigger where not tgisinternal),
    'users',(select count(*) from auth.users),'history',(select count(*) from supabase_migrations.schema_migrations),
    'roles',(select json_agg(rolname order by rolname) from pg_roles));`);
  return JSON.parse(state.trim());
}

let started = false;
let result;
mkdirSync(runRoot, { recursive: true });
try {
  const version = (await command("postgres", ["--version"])).trim();
  assert.match(version, /17\.6\b/);
  await command("initdb", ["-D", dataDir, "-U", "postgres", "-A", "trust", "--encoding=UTF8", "--no-locale"]);
  console.log("Media native replay: initialized isolated PG17.6");
  await command("pg_ctl", ["-D", dataDir, "-l", join(runRoot, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
  started = true;
  assert.equal((await psql("show listen_addresses;")).trim(), "127.0.0.1");
  await psql(bootstrap);
  console.log("Media native replay: bootstrap ready; running migration and negative tests");
  const before = await snapshot();
  const output = await psql(["begin; set local lock_timeout='5s'; set local statement_timeout='120s';", baseline, migration, tests].join("\n"));
  assert.ok(output.split(/\r?\n/).includes("media_free_foundation_rls_test_ok"));
  const projected = output.split(/\r?\n/).find((line) => line.startsWith("MEDIA_PUBLIC_DTO:"));
  assert.ok(projected, "Public SQL fixture output missing");
  const row = JSON.parse(projected.slice("MEDIA_PUBLIC_DTO:".length));
  const reader = createMediaPublicReader(createMediaPublicRpcTransport(async () => ({ data: [row], error: null })));
  const article = await reader.article("projection-test", row.slug, "ja-JP");
  assert.ok(article, "SQL result must pass DTO validation");
  assert.equal(article.blocks.length, 7);
  assert.equal(article.blocks[6].type, "image");
  assert.equal(JSON.stringify(article).includes("imageAssetId"), false);
  assert.deepEqual(await snapshot(), before, "Rollback must leave no schema/ACL/auth/history residue");
  result = { runtime: version, bind: "127.0.0.1", migrationSha256: hash(migration), testsSha256: hash(tests), sqlRegression: "PASS", sqlToPublicDto: "PASS", rollbackResidue: 0, authPostgrestE2E: "not performed" };
} finally {
  if (started) await command("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"]);
  assert.ok(runRoot.startsWith(tempRoot + sep) && runRoot !== tempRoot, "Cleanup path escaped workspace");
  const cleanupPath = realpathSync(join(approvedRoot, relative(asciiRoot, runRoot)));
  assert.ok(cleanupPath.toLowerCase().startsWith((realpathSync(approvedRoot) + sep).toLowerCase()), "Resolved cleanup path escaped dedicated runtime");
  assert.equal(statSync(cleanupPath, { bigint: true }).ino, statSync(runRoot, { bigint: true }).ino);
  rmSync(cleanupPath, { recursive: true, force: true });
}
console.log(JSON.stringify({ ...result, cleanup: "test server stopped and data removed" }));
