import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

if (process.argv[2] !== "--run-isolated") throw new Error("Explicit --run-isolated is required");
const docker = "C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe";
const container = "mikke-community-owner-ux-db-20260910";
const database = "community_owner_ux_isolated_20260910";
const image = "postgres:17.6";
const baselinePath = "G:/Musubiプロジェクト/mikke-os-mvp-db-baseline-20260829/supabase/baseline/20260829000000_mikkeos_schema_baseline.sql";
const bootstrapPath = "G:/Musubiプロジェクト/mikke-os-mvp-hq-access-management-20260831/supabase/tests/hq_local_auth_bootstrap.sql";
const storageBootstrapPath = "supabase/tests/media_private_gate_local_storage_bootstrap.sql";
const tests = [
  { path: "supabase/tests/community_owner_membership_resources_ux_test.sql", sentinel: "community_owner_membership_resources_ux_test_ok" },
  { path: "supabase/tests/community_membership_billing_guidance_test.sql", sentinel: "community_membership_billing_guidance_test_ok" },
];
const expectedBaselineSha = "521BF5A61EB8FE572011526FAA469A679328F581E3BC291191AEF18379C97299";
const migrationNames = [
  "20260820110909_academy_instructor_registration_ledger.sql",
  "20260821043626_academy_access_context_and_creation_gate.sql",
  "20260821100151_academy_application_headquarters_visibility.sql",
  "20260821103043_academy_class_management.sql",
  "20260823223416_academy_learner_portal_context.sql",
  "20260823233441_academy_public_class_scheduling.sql",
  "20260825050958_academy_course_timed_learning_access.sql",
  "20260825062848_academy_secure_video_asset_foundation.sql",
  "20260825075830_academy_application_claim.sql",
  "20260825161200_academy_month_end_billing_snapshots.sql",
  "20260825222427_community_academy_linked_room_entitlements.sql",
  "20260826011738_community_academy_link_acceptance_ui_contract.sql",
  "20260826033657_academy_seven_day_trial_foundation.sql",
  "20260830143000_academy_limited_pilot_access_controls.sql",
  "20260831180143_platform_billing_checkout_ledger.sql",
  "20260901124412_platform_billing_creation_entitlements.sql",
  "20260901130000_community_guarded_platform_creation.sql",
  "20260902041651_academy_optional_step_program_classes.sql",
  "20260902042322_community_join_rpc_security_hardening.sql",
  "20260902054001_media_free_foundation.sql",
  "20260902084655_community_content_validation_record_fix.sql",
  "20260902171944_platform_billing_verified_provider_events.sql",
  "20260902223651_platform_billing_subscription_runtime.sql",
  "20260902231854_academy_guarded_platform_creation.sql",
  "20260903011816_community_capacity_for_resource.sql",
  "20260903014133_community_membership_capacity_enforcement.sql",
  "20260903161500_platform_billing_resource_access_window.sql",
  "20260903164500_community_platform_retention_controls.sql",
  "20260903193000_academy_platform_access_lifecycle.sql",
  "20260903201500_platform_billing_subscription_recontract_selection.sql",
  "20260903203000_platform_retention_recontract_workers.sql",
  "20260903204500_platform_billing_customer_recontract_activation.sql",
  "20260903210000_platform_billing_internal_resource_grants.sql",
  "20260904004922_platform_billing_community_trial_start.sql",
  "20260904013000_academy_internal_resource_access_recovery.sql",
  "20260904051550_mikkeos_academy_billing_exclusion_admin.sql",
  "20260904083849_academy_legacy_paid_access_continuity.sql",
  "20260904083914_academy_open_seven_day_trial.sql",
  "20260908070053_community_academy_release_access_contract.sql",
  "20260908070613_academy_first_publication_atomic.sql",
  "20260908084409_academy_first_publication_runtime.sql",
  "20260908085138_community_academy_first_publication_access.sql",
  "20260908090249_academy_first_publication_platform_bridge.sql",
  "20260908091030_academy_first_publication_course_delegation.sql",
  "20260908101940_academy_first_publication_quote_display.sql",
  "20260908102540_academy_first_publication_ingress_authority.sql",
  "20260908103347_academy_first_publication_setup_quote_projection.sql",
  "20260908235813_academy_first_publication_variable_price.sql",
  "20260909003954_academy_receipt_proof_dispatch_fence.sql",
  "20260909091836_academy_cancellation_clock_fault_hold.sql",
  "20260909092651_media_free_private_publication_gate.sql",
  "20260909141538_community_per_resource_trial.sql",
  "20260909141552_community_creation_bind_before_children.sql",
  "20260909163047_community_owner_membership_resources_ux.sql",
  "20260909235910_community_membership_billing_guidance.sql",
];

function command(args, input, allowFailure = false) {
  const result = spawnSync(docker, args, { input, encoding: "utf8", timeout: 600_000, maxBuffer: 64 * 1024 * 1024, shell: false });
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || result.stdout || result.error?.message || `docker exit ${result.status}`);
  return result;
}
function psql(sql) {
  return command(["exec", "-i", container, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], sql).stdout;
}
function snapshot() {
  return JSON.parse(psql(`select json_build_object(
    'schemas',(select md5(coalesce(string_agg(nspname,'|' order by nspname),'')) from pg_namespace where nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private','platform_billing_private')),
    'relations',(select md5(coalesce(string_agg(n.nspname||'.'||c.relname||':'||c.relkind::text,'|' order by n.nspname,c.relname),'')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private','platform_billing_private')),
    'functions',(select md5(coalesce(string_agg(n.nspname||'.'||p.proname||':'||pg_get_function_identity_arguments(p.oid),'|' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private','platform_billing_private')),
    'constraints',(select md5(coalesce(string_agg(n.nspname||'.'||c.conname,'|' order by n.nspname,c.conname),'')) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private','platform_billing_private')),
    'indexes',(select md5(coalesce(string_agg(n.nspname||'.'||c.relname,'|' order by n.nspname,c.relname),'')) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage','extensions','supabase_migrations','public','private','community_private','platform_billing_private')),
    'policies',(select md5(coalesce(string_agg(n.nspname||'.'||c.relname||'.'||p.polname,'|' order by n.nspname,c.relname,p.polname),'')) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace),
    'triggers',(select md5(coalesce(string_agg(n.nspname||'.'||c.relname||'.'||t.tgname,'|' order by n.nspname,c.relname,t.tgname),'')) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal),
    'authUsers',(select count(*) from auth.users),
    'storageObjects',(select count(*) from storage.objects),
    'history',(select count(*) from supabase_migrations.schema_migrations)
  );`).trim());
}

const baseline = readFileSync(baselinePath, "utf8");
assert.equal(createHash("sha256").update(baseline).digest("hex").toUpperCase(), expectedBaselineSha);
const bootstrap = readFileSync(bootstrapPath, "utf8");
const storageBootstrap = `${readFileSync(storageBootstrapPath, "utf8")}\n` +
  "grant select, insert, delete on storage.objects to authenticated;\n";
const migrations = migrationNames.map((name) => ({ name, sql: readFileSync(path.join("supabase/migrations", name), "utf8") }));
const sqlTests = tests.map((test) => ({ ...test, sql: readFileSync(test.path, "utf8") }));
const manifestSha256 = createHash("sha256").update(JSON.stringify(migrations.map(({ name, sql }) => [name, createHash("sha256").update(sql).digest("hex")]))).digest("hex");
const internalGrantPreflightFixtures = `
insert into auth.users(id,email,is_anonymous) values
  ('cf000000-0000-4000-8000-000000000001','official-academy-community@example.invalid',false),
  ('cf000000-0000-4000-8000-000000000002','mikkeos-community@example.invalid',false),
  ('cf000000-0000-4000-8000-000000000003','ayumitest-community@example.invalid',false),
  ('cf000000-0000-4000-8000-000000000004','legacy-academy-one@example.invalid',false),
  ('cf000000-0000-4000-8000-000000000005','legacy-academy-two@example.invalid',false);
insert into public.community_communities(id,slug,name,join_mode,owner_user_id) values
  ('cf100000-0000-4000-8000-000000000001','official-academy-community','Official Academy Community','open_free','cf000000-0000-4000-8000-000000000001'),
  ('cf100000-0000-4000-8000-000000000002','mikkeos','mikkeOS','open_free','cf000000-0000-4000-8000-000000000002'),
  ('cf100000-0000-4000-8000-000000000003','ayumitest','Ayumi Test','open_free','cf000000-0000-4000-8000-000000000003');
`;
const academyRecoveryPreflightFixtures = `
insert into public.academy_headquarters(id,owner_user_id,name,handle,plan,is_active) values
  ('cf200000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001','MUSUBI','ayumi-academy','small',true),
  ('cf200000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000002','mikkeOS Official Academy','admin_78e6-academy','small',true);
insert into public.academy_headquarters_access_states(headquarters_id,owner_user_id,access_kind,status,starts_at,paid_started_at) values
  ('cf200000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001','paid','active',clock_timestamp(),clock_timestamp()),
  ('cf200000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000002','paid','active',clock_timestamp(),clock_timestamp());
`;
const academyLegacyPreflightFixtures = `
insert into public.academy_headquarters(id,owner_user_id,name,handle,plan,is_active,created_at) values
  ('cf300000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000004','Legacy Academy One','legacy-academy-one','small',true,'2026-09-01 00:00:00+00'),
  ('cf300000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000005','Legacy Academy Two','legacy-academy-two','small',true,'2026-09-01 00:00:00+00');
insert into public.academy_headquarters_access_states(headquarters_id,owner_user_id,access_kind,status,starts_at,paid_started_at) values
  ('cf300000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000004','paid','active','2026-09-01 00:00:00+00','2026-09-01 00:00:00+00'),
  ('cf300000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000005','paid','active','2026-09-01 00:00:00+00','2026-09-01 00:00:00+00');
`;
const migrationSql = migrations.flatMap(({ name, sql }) => {
  if (name === "20260903210000_platform_billing_internal_resource_grants.sql") return [internalGrantPreflightFixtures, sql];
  if (name === "20260904013000_academy_internal_resource_access_recovery.sql") return [academyRecoveryPreflightFixtures, sql];
  if (name === "20260904083849_academy_legacy_paid_access_continuity.sql") return [academyLegacyPreflightFixtures, sql];
  return [sql];
});
let created = false;
try {
  if (command(["inspect", container], undefined, true).status === 0) throw new Error("Refusing to reuse a previous Community test container");
  command(["image", "inspect", image]);
  command(["run", "--detach", "--name", container, "--network", "none", "--tmpfs", "/var/lib/postgresql/data:rw", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", `POSTGRES_DB=${database}`, image]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (command(["exec", container, "pg_isready", "-U", "postgres", "-d", database], undefined, true).status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not become ready");
  const inspected = JSON.parse(command(["inspect", container]).stdout)[0];
  assert.equal(inspected.HostConfig.NetworkMode, "none");
  assert.deepEqual(inspected.HostConfig.PortBindings ?? {}, {});
  assert.equal(inspected.HostConfig.Tmpfs?.["/var/lib/postgresql/data"], "rw");

  psql(`${bootstrap}\n${storageBootstrap}`);
  const before = snapshot();
  for (const test of sqlTests) {
    const rollbackOutput = psql(["begin;", "set local lock_timeout='5s';", "set local statement_timeout='180s';", "set local idle_in_transaction_session_timeout='240s';", baseline, ...migrationSql, test.sql].join("\n"));
    assert.ok(rollbackOutput.split(/\r?\n/).includes(test.sentinel), `SQL regression sentinel missing: ${test.sentinel}`);
    assert.deepEqual(snapshot(), before, `SQL regression must rollback every schema and fixture change: ${test.path}`);
  }

  psql([baseline, ...migrationSql].join("\n"));
  const concurrency = spawnSync(process.execPath, ["scripts/community-owner-ux-concurrency.mjs", "--run-isolated"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 180_000, shell: false,
    env: { ...process.env, COMMUNITY_OWNER_UX_TEST_DATABASE_URL: `postgresql://postgres@127.0.0.1/${database}`, PSQL_PATH: docker, COMMUNITY_OWNER_UX_PSQL_DOCKER_CONTAINER: container }
  });
  if (concurrency.status !== 0) throw new Error(concurrency.stderr || concurrency.stdout || "Concurrency test failed");
  assert.match(concurrency.stdout, /community_owner_ux_concurrency_test_ok/);
  assert.match(concurrency.stdout, /"users":0/);
  console.log(JSON.stringify({ result: "community_owner_ux_isolated_db_ok", postgres: psql("show server_version;").trim(), baselineSha256: expectedBaselineSha, migrationCount: migrations.length, sqlTestCount: sqlTests.length, manifestSha256, sqlRollbackResidue: 0, concurrencyFixtureResidue: 0, network: "none", publishedPorts: 0 }));
} finally {
  if (created) command(["rm", "-f", "-v", container], undefined, true);
  if (command(["inspect", container], undefined, true).status === 0) throw new Error("Disposable Community DB container remains after cleanup");
}
