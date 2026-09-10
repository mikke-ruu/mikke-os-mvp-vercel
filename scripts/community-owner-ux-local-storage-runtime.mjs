import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const project = "mikke-community-owner-ux-20260910";
const network = `${project}-loopback`;
const container = `supabase_db_${project}`;
const apiOrigin = "http://127.0.0.1:56321";
const docker = "C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe";
assert.equal(process.argv[2], "--run-local-storage");
assert.equal(process.env.COMMUNITY_OWNER_UX_LOCAL_STORAGE_CONFIRM, project);

const run = (args, input) => execFileSync(docker, args, {
  input, encoding: "utf8", windowsHide: true, timeout: 180_000,
  maxBuffer: 16 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"],
});
const query = (sql) => run(["exec", "-i", container, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql).trim();

for (const [service, port] of [["db", "56322"], ["kong", "56321"]]) {
  const inspected = JSON.parse(run(["inspect", `supabase_${service}_${project}`]))[0];
  assert.equal(inspected.Config.Labels["com.supabase.cli.project"], project);
  assert.equal(inspected.State.Running, true);
  assert.equal(inspected.HostConfig.NetworkMode, network);
  const bindings = Object.values(inspected.NetworkSettings.Ports ?? {}).filter(Boolean).flat();
  assert.ok(bindings.length > 0 && bindings.every((binding) => binding.HostIp === "127.0.0.1" && binding.HostPort === port));
}
for (const service of ["auth", "storage"]) {
  const inspected = JSON.parse(run(["inspect", `supabase_${service}_${project}`]))[0];
  assert.equal(inspected.Config.Labels["com.supabase.cli.project"], project);
  assert.equal(inspected.State.Running, true);
  assert.equal(inspected.HostConfig.NetworkMode, network);
  assert.equal(Object.values(inspected.NetworkSettings.Ports ?? {}).filter(Boolean).flat().length, 0);
}

const authInspect = JSON.parse(run(["inspect", `supabase_auth_${project}`]))[0];
const authEnv = Object.fromEntries(authInspect.Config.Env.map((entry) => {
  const separator = entry.indexOf("=");
  return [entry.slice(0, separator), entry.slice(separator + 1)];
}));
const secret = authEnv.GOTRUE_JWT_SECRET;
assert.ok(secret);
function roleToken(role) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ role, iss: "supabase-demo", iat: now, exp: now + 3600 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}
const anon = roleToken("anon");
const service = roleToken("service_role");

async function createUser(label) {
  const email = `community-owner-ux-${label}-${randomUUID()}@example.invalid`;
  const password = `Local-${randomUUID()}-aA9!`;
  const created = await fetch(`${apiOrigin}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: `LOCAL COMMUNITY ${label}` } }),
    redirect: "error",
  });
  assert.equal(created.status, 200, `Local Auth user creation failed for ${label}`);
  const body = await created.json();
  assert.ok(body.id);
  const signedIn = await fetch(`${apiOrigin}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "error",
  });
  assert.equal(signedIn.status, 200, `Local Auth sign-in failed for ${label}`);
  const session = await signedIn.json();
  assert.ok(session.access_token);
  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString());
  assert.equal(claims.sub, body.id);
  assert.equal(claims.role, "authenticated");
  return { id: body.id, jwt: session.access_token };
}

const users = {};
const ids = {
  community: randomUUID(),
  otherCommunity: randomUUID(),
  pdf: randomUUID(),
  mime: randomUUID(),
  limit: randomUUID(),
  other: randomUUID(),
  ownerAttempt: randomUUID(),
  ownerIdempotency: randomUUID(),
  otherAttempt: randomUUID(),
  otherIdempotency: randomUUID(),
};
try {
  for (const label of ["owner", "member", "outsider", "suspended", "otherOwner"]) users[label] = await createUser(label);
  query(`
    insert into public.community_communities(id,slug,name,join_mode,owner_user_id) values
      ('${ids.community}','owner-ux-storage','LOCAL Owner UX Storage','open_free','${users.owner.id}'),
      ('${ids.otherCommunity}','owner-ux-storage-other','LOCAL Owner UX Storage Other','open_free','${users.otherOwner.id}');
    insert into public.community_memberships(community_id,user_id,role,status) values
      ('${ids.community}','${users.owner.id}','owner','active'),
      ('${ids.community}','${users.member.id}','member','active'),
      ('${ids.community}','${users.suspended.id}','member','suspended'),
      ('${ids.otherCommunity}','${users.otherOwner.id}','owner','active');
    insert into platform_billing_private.creation_entitlements(
      actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,status,starts_at,expires_at,resource_id,consumed_at
    ) values
      ('${users.owner.id}','community_platform','trial','verified_trial','${ids.ownerAttempt}','${ids.ownerIdempotency}','consumed',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '30 days','${ids.community}',statement_timestamp()),
      ('${users.otherOwner.id}','community_platform','trial','verified_trial','${ids.otherAttempt}','${ids.otherIdempotency}','consumed',statement_timestamp()-interval '1 hour',statement_timestamp()+interval '30 days','${ids.otherCommunity}',statement_timestamp());
    insert into public.community_resources(id,community_id,title,kind,external_url,storage_path,file_name,mime_type,file_size_bytes,is_published,published_at) values
      ('${ids.pdf}','${ids.community}','LOCAL PDF','pdf','','${ids.community}/${ids.pdf}/${users.owner.id}/proof.pdf','proof.pdf','application/pdf',36,true,statement_timestamp()),
      ('${ids.mime}','${ids.community}','LOCAL unpublished PDF','pdf','','${ids.community}/${ids.mime}/${users.owner.id}/unpublished.pdf','unpublished.pdf','application/pdf',36,false,null),
      ('${ids.limit}','${ids.community}','LOCAL size limit PDF','pdf','','${ids.community}/${ids.limit}/${users.owner.id}/large.pdf','large.pdf','application/pdf',52428800,true,statement_timestamp()),
      ('${ids.other}','${ids.otherCommunity}','LOCAL other PDF','pdf','','${ids.otherCommunity}/${ids.other}/${users.otherOwner.id}/other.pdf','other.pdf','application/pdf',36,true,statement_timestamp());
  `);
  const storage = spawnSync(process.execPath, ["scripts/community-owner-ux-storage-e2e.mjs", "--run-isolated"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 180_000, shell: false,
    env: {
      ...process.env,
      COMMUNITY_OWNER_UX_STORAGE_URL: apiOrigin,
      COMMUNITY_OWNER_UX_STORAGE_ANON_KEY: anon,
      COMMUNITY_OWNER_UX_STORAGE_OWNER_JWT: users.owner.jwt,
      COMMUNITY_OWNER_UX_STORAGE_MEMBER_JWT: users.member.jwt,
      COMMUNITY_OWNER_UX_STORAGE_OUTSIDER_JWT: users.outsider.jwt,
      COMMUNITY_OWNER_UX_STORAGE_SUSPENDED_JWT: users.suspended.jwt,
      COMMUNITY_OWNER_UX_STORAGE_OTHER_OWNER_JWT: users.otherOwner.jwt,
      COMMUNITY_OWNER_UX_STORAGE_COMMUNITY_ID: ids.community,
      COMMUNITY_OWNER_UX_STORAGE_USER_ID: users.owner.id,
      COMMUNITY_OWNER_UX_STORAGE_OTHER_COMMUNITY_ID: ids.otherCommunity,
      COMMUNITY_OWNER_UX_STORAGE_OTHER_USER_ID: users.otherOwner.id,
      COMMUNITY_OWNER_UX_STORAGE_PDF_RESOURCE_ID: ids.pdf,
      COMMUNITY_OWNER_UX_STORAGE_MIME_RESOURCE_ID: ids.mime,
      COMMUNITY_OWNER_UX_STORAGE_LIMIT_RESOURCE_ID: ids.limit,
      COMMUNITY_OWNER_UX_STORAGE_OTHER_RESOURCE_ID: ids.other,
    },
  });
  if (storage.status !== 0) throw new Error(storage.stderr || storage.stdout || "Storage E2E failed");
  assert.match(storage.stdout, /community_owner_ux_storage_e2e_ok/);
  assert.equal(query(`select count(*) from storage.objects where bucket_id='community-resources' and name like '${ids.community}/%';`), "0");
  console.log(JSON.stringify({ result: "community_owner_ux_local_auth_storage_ok", users: 5, signedIn: 5, fixtureObjectsRemaining: 0, productionChanged: false, secretsPrinted: false }));
} finally {
  const userIds = Object.values(users).map((user) => `'${user.id}'`).join(",") || "null";
  query(`set session_replication_role=replica;
    delete from storage.objects where bucket_id='community-resources' and (name like '${ids.community}/%' or name like '${ids.otherCommunity}/%');
    delete from public.community_resources where id in ('${ids.pdf}','${ids.mime}','${ids.limit}','${ids.other}');
    delete from public.community_memberships where community_id in ('${ids.community}','${ids.otherCommunity}');
    delete from platform_billing_private.creation_entitlements where resource_id in ('${ids.community}','${ids.otherCommunity}');
    delete from public.community_communities where id in ('${ids.community}','${ids.otherCommunity}');
    delete from public.profiles where user_id in (${userIds});
    delete from auth.users where id in (${userIds});
    set session_replication_role=origin;`);
  assert.equal(query(`select
    (select count(*) from storage.objects where bucket_id='community-resources' and (name like '${ids.community}/%' or name like '${ids.otherCommunity}/%'))+
    (select count(*) from public.community_resources where id in ('${ids.pdf}','${ids.mime}','${ids.limit}','${ids.other}'))+
    (select count(*) from platform_billing_private.creation_entitlements where resource_id in ('${ids.community}','${ids.otherCommunity}'))+
    (select count(*) from public.community_communities where id in ('${ids.community}','${ids.otherCommunity}'))+
    (select count(*) from auth.users where id in (${userIds}));`), "0");
}
