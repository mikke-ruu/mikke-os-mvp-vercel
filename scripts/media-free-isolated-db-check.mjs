import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const docker = "C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe";
const container = "mikke-media-free-replay-20260902";
const image = "postgres:17.6";
const baselinePath = "G:/Musubiプロジェクト/mikke-os-mvp-db-baseline-20260829/supabase/baseline/20260829000000_mikkeos_schema_baseline.sql";
const bootstrapPath = "G:/Musubiプロジェクト/mikke-os-mvp-hq-access-management-20260831/supabase/tests/hq_local_auth_bootstrap.sql";
const migrationPath = new URL("../supabase/migrations/20260902054001_media_free_foundation.sql", import.meta.url);
const testPath = new URL("../supabase/tests/media_free_foundation_rls.sql", import.meta.url);
const expectedBaselineSha = "521BF5A61EB8FE572011526FAA469A679328F581E3BC291191AEF18379C97299";

function dockerCommand(args, input, allowFailure = false) {
  const result = spawnSync(docker, args, {
    input,
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 24 * 1024 * 1024
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || `docker exit ${result.status}`);
  }
  return result;
}

function psql(sql) {
  return dockerCommand([
    "exec", "-i", container, "/usr/bin/psql", "-X", "-q", "-A", "-t",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"
  ], sql).stdout;
}

function psqlConnection(sql, onMarker) {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, [
      "exec", "-i", container, "/usr/bin/psql", "-X", "-q", "-A", "-t",
      "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"
    ]);
    let stdout = "";
    let stderr = "";
    let marked = false;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Concurrent publish timed out"));
    }, 30_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (!marked && onMarker && stdout.includes("media_first_publish_locked")) {
        marked = true;
        onMarker();
      }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(stdout) : reject(new Error(stderr || `Concurrent psql exit ${code}`));
    });
    child.stdin.end(sql);
  });
}

function snapshot() {
  const sql = `select json_build_object(
    'schemas',(select md5(coalesce(string_agg(nspname,'|' order by nspname),'')) from pg_namespace where nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private')),
    'relations',(select md5(coalesce(string_agg((n.nspname||'.'||c.relname||':'||c.relkind::text),'|' order by n.nspname,c.relname,c.relkind::text),'')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private')),
    'columns',(select md5(coalesce(string_agg((n.nspname||'.'||c.relname||'.'||a.attname||':'||a.atttypid::text||':'||a.attnotnull::text),'|' order by n.nspname,c.relname,a.attnum),'')) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private') and a.attnum>0 and not a.attisdropped),
    'functions',(select md5(coalesce(string_agg((n.nspname||'.'||p.proname||':'||pg_get_function_identity_arguments(p.oid)),'|' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private')),
    'constraints',(select md5(coalesce(string_agg((n.nspname||'.'||c.conname||':'||c.contype::text),'|' order by n.nspname,c.conname,c.contype::text),'')) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private')),
    'indexes',(select md5(coalesce(string_agg((n.nspname||'.'||c.relname),'|' order by n.nspname,c.relname),'')) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private')),
    'policies',(select md5(coalesce(string_agg((n.nspname||'.'||c.relname||'.'||p.polname),'|' order by n.nspname,c.relname,p.polname),'')) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace),
    'triggers',(select md5(coalesce(string_agg((n.nspname||'.'||c.relname||'.'||t.tgname),'|' order by n.nspname,c.relname,t.tgname),'')) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal),
    'auth_users',(select count(*) from auth.users),
    'history',(select count(*) from supabase_migrations.schema_migrations)
  );`;
  return JSON.parse(psql(sql).trim());
}

if (process.argv[2] !== "--run") throw new Error("Explicit --run is required");

const baseline = readFileSync(baselinePath, "utf8");
const bootstrap = readFileSync(bootstrapPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const test = readFileSync(testPath, "utf8");
const baselineSha = createHash("sha256").update(baseline).digest("hex").toUpperCase();
if (baselineSha !== expectedBaselineSha) throw new Error(`Baseline SHA mismatch: ${baselineSha}`);
if (!/^\s*begin\s*;/im.test(test) || !/^\s*rollback\s*;/im.test(test)) {
  throw new Error("Media test must own the rollback transaction");
}

let created = false;
try {
  if (dockerCommand(["inspect", container], undefined, true).status === 0) {
    throw new Error(`Refusing to reuse existing container: ${container}`);
  }
  dockerCommand(["image", "inspect", image]);
  dockerCommand(["run", "--detach", "--name", container, "--network", "none",
    "--tmpfs", "/var/lib/postgresql/data:rw", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", image]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const probe = dockerCommand(["exec", container, "pg_isready", "-U", "postgres"], undefined, true);
    if (probe.status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not become ready");
  const inspected = JSON.parse(dockerCommand(["inspect", container]).stdout)[0];
  if (inspected.Config.Image !== image
    || inspected.HostConfig.NetworkMode !== "none"
    || Object.keys(inspected.HostConfig.PortBindings ?? {}).length !== 0
    || inspected.HostConfig.Tmpfs?.["/var/lib/postgresql/data"] !== "rw") {
    throw new Error("Disposable isolation contract mismatch");
  }

  psql(bootstrap);
  const before = snapshot();
  const output = psql([
    "begin;",
    "set local lock_timeout='5s';",
    "set local statement_timeout='180s';",
    "set local idle_in_transaction_session_timeout='240s';",
    baseline,
    migration,
    test
  ].join("\n"));
  if (!output.split(/\r?\n/).includes("media_free_foundation_rls_test_ok")) {
    throw new Error("Media SQL test sentinel missing");
  }
  const after = snapshot();
  const residualChanges = Object.fromEntries(Object.keys(before).map((key) => [key, before[key] === after[key] ? 0 : 1]));
  if (Object.values(residualChanges).some(Boolean)) {
    throw new Error(`Rollback residue: ${JSON.stringify(residualChanges)}`);
  }

  const raceOwner = "a9060000-0000-4000-8000-000000000001";
  const raceSite = "a9060000-0000-4000-8000-000000000002";
  const raceArticle = "a9060000-0000-4000-8000-000000000003";
  psql([
    "begin;",
    baseline,
    migration,
    `insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values ('${raceOwner}','media-race@example.invalid','{}','{}',now(),now());`,
    `insert into public.media_sites(id,owner_id,name,slug,author_name)
      values ('${raceSite}','${raceOwner}','Race Media','media-race','Race Owner');`,
    `insert into public.media_articles(id,site_id,title,slug,draft_blocks)
      values ('${raceArticle}','${raceSite}','Race article','race-article',
        '[{"id":"p1","type":"paragraph","text":"race"}]'::jsonb);`,
    "commit;"
  ].join("\n"));
  const claims = JSON.stringify({ sub: raceOwner, role: "authenticated", is_anonymous: false }).replaceAll("'", "''");
  const publish = `set local request.jwt.claim.sub='${raceOwner}';
    set local request.jwt.claim.role='authenticated';
    set local request.jwt.claims='${claims}';
    set local role authenticated;
    select public.media_publish_article('${raceArticle}','test-terms-v1',true,true,true);`;
  let releaseMarker;
  const marker = new Promise((resolve) => { releaseMarker = resolve; });
  const first = psqlConnection(`begin;set local lock_timeout='10s';set local statement_timeout='20s';
    ${publish}
    select 'media_first_publish_locked';
    select pg_sleep(3);
    commit;`, releaseMarker);
  await Promise.race([
    marker,
    first.then(() => { throw new Error("First publish completed without marker"); }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("First publish marker timeout")), 10_000))
  ]);
  const secondStarted = Date.now();
  const second = psqlConnection(`begin;set local lock_timeout='10s';set local statement_timeout='20s';${publish}commit;`);
  await Promise.all([first, second]);
  const secondElapsedMs = Date.now() - secondStarted;
  const raceResult = JSON.parse(psql(`select json_build_object(
    'versions',(select count(*) from public.media_article_versions where article_id='${raceArticle}'),
    'version_numbers',(select json_agg(version_number order by version_number) from public.media_article_versions where article_id='${raceArticle}'),
    'published_receipts',(select count(*) from public.media_publication_outbox where article_id='${raceArticle}' and event_type='published'),
    'current_version',(select current_published_version_id is not null from public.media_articles where id='${raceArticle}')
  );`).trim());
  if (raceResult.versions !== 2
    || JSON.stringify(raceResult.version_numbers) !== "[1,2]"
    || raceResult.published_receipts !== 2
    || raceResult.current_version !== true
    || secondElapsedMs < 2_000) {
    throw new Error(`Concurrent publish invariant failed: ${JSON.stringify({ raceResult, secondElapsedMs })}`);
  }
  console.log(JSON.stringify({
    scope: "disposable-local-postgres-17.6",
    baselineSha256: baselineSha,
    migrationSha256: createHash("sha256").update(migration).digest("hex"),
    testSha256: createHash("sha256").update(test).digest("hex"),
    sentinel: "media_free_foundation_rls_test_ok",
    rollback: true,
    residualChanges,
    concurrentPublish: { connections: 2, secondElapsedMs, ...raceResult },
    cleanup: "named container and anonymous volume removed"
  }));
} finally {
  if (created) {
    const removed = dockerCommand(["rm", "--force", "--volumes", container], undefined, true);
    if (removed.status !== 0) throw new Error(`Container cleanup failed: ${removed.stderr || removed.stdout}`);
  }
}
