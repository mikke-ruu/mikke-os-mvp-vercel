// Local Auth + PostgREST integration check. Never accepts an external endpoint.
// SQL seeds synthetic prepared enrollment only; this is NOT a Stripe/publish E2E.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const project = 'academy-release-auth-20260909';
const api = 'http://127.0.0.1:54441';
const container = `supabase_db_${project}`;
const docker = 'C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
if (process.env.ACADEMY_LOCAL_AUTH_CONFIRM !== project) {
  throw new Error(`Explicit local-only confirmation required: ACADEMY_LOCAL_AUTH_CONFIRM=${project}`);
}
function run(executable, args, input) {
  const result = spawnSync(executable, args, { input, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  // Never include child stdout/stderr: status contains keys, SQL can contain IDs.
  if (result.error || result.status !== 0) {
    const sqlError = args.includes('psql') ? result.stderr?.split(/\r?\n/).find(line => /ERROR:/.test(line)) : null;
    throw new Error(`Local subprocess failed (${result.error?.code ?? result.status})${sqlError ? `: ${sqlError}` : ''}`);
  }
  return result.stdout.trim();
}
const meta = JSON.parse(run(docker, ['inspect', container]))[0];
assert.equal(meta.Config.Labels['com.supabase.cli.project'], project);
assert.equal(meta.State.Running, true);
const ports = meta.NetworkSettings.Ports['5432/tcp'];
assert(ports.some(port => port.HostPort === '54442'), 'Expected isolated DB port');
const local = JSON.parse(run('powershell.exe', ['-NoProfile', '-Command', `supabase status --workdir 'G:/Musubiプロジェクト/.local-tools/${project}' --output json`]));
assert.equal(local.API_URL, api, 'Unexpected local API');
assert(local.ANON_KEY && local.SERVICE_ROLE_KEY, 'Local API keys unavailable');
const sql = statement => run(docker, ['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-f', '-'], statement);
assert.equal(sql("select to_regprocedure('public.academy_first_publication_cancel_append(uuid,uuid)') is not null"), 't', 'Full schema replay required');
const lit = text => `'${String(text).replaceAll("'", "''")}'`;
let passed = 0;
function check(condition, label) { assert(condition, label); passed++; console.log(`PASS ${label}`); }
async function request(path, key, token, body, method = 'POST', extra = {}) {
  const response = await fetch(`${api}${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, 'Content-Type': 'application/json', ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}
const rpc = (actor, name, body) => request(`/rest/v1/rpc/${name}`, local.ANON_KEY, actor?.token, body);
const must = (response, label) => { check(response.ok, `${label} (HTTP ${response.status})`); return response.data; };
const denied = (response, label) => check(!response.ok && [400, 401, 403, 404].includes(response.status), label);
const users = [];
const tag = `auth-${randomBytes(5).toString('hex')}`;
const fixtureId = () => `f9091000${randomUUID().slice(8)}`;
const hq = fixtureId(), quote = fixtureId(), community = fixtureId(), membership = fixtureId();
const key = randomUUID(), policy = `local-${tag}`;
let seeded = false;
try {
  for (const kind of ['owner', 'other']) {
    const email = `${tag}-${kind}@example.invalid`, password = randomBytes(32).toString('base64url');
    // Admin creation with confirmed synthetic email never sends invitation mail.
    const created = must(await request('/auth/v1/admin/users', local.SERVICE_ROLE_KEY, null, { email, password, email_confirm: true }), `local ${kind} account creation`);
    const signIn = must(await request('/auth/v1/token?grant_type=password', local.ANON_KEY, null, { email, password }), `real ${kind} password sign-in`);
    assert(signIn.access_token && signIn.user.id === created.id);
    const actor = { id: created.id, token: signIn.access_token };
    users.push(actor);
    const user = must(await request('/auth/v1/user', local.ANON_KEY, actor.token, undefined, 'GET'), `real ${kind} token verification`);
    check(user.id === actor.id, `${kind} verified user identity`);
  }
  // Raw HTTP auth has no persisted SDK session or INITIAL_SESSION race.
  const [owner, other] = users;
  sql(`begin;
    insert into public.academy_headquarters(id,owner_user_id,name,handle,is_active) values(${lit(hq)},${lit(owner.id)},'LOCAL AUTH FIXTURE',${lit(tag)},false);
    insert into academy_publication_private.policies(version,approval_id,terms_revision,quote_ttl_seconds,enabled,initial_price,cancellation,eligibility,pricing_revision,consent_revision)
    values(${lit(policy)},'LOCAL TEST ONLY','local-terms',1800,true,'fixed_at_publication','inclusive_deadline','no_previous_trial_or_contract','local-price','local-consent');
    insert into academy_publication_private.quote_display_catalog(policy_version,pricing_revision,plan_key,plan_name,discount_description,consent_revision)
    values(${lit(policy)},'local-price','small','Local fixture','No discount','local-consent');
    insert into academy_publication_private.quotes(id,headquarters_id,owner_user_id,policy_version,terms_revision,amount_yen,instructor_count,issued_at,expires_at,payment_preparation_id,payment_verified,current_price_verified,pricing_revision,plan_key,plan_name,discount_description,consent_revision)
    values(${lit(quote)},${lit(hq)},${lit(owner.id)},${lit(policy)},'local-terms',5000,0,now(),now()+interval '30 minutes','local-no-provider',true,true,'local-price','small','Local fixture','No discount','local-consent');
    insert into academy_publication_private.enrollments(headquarters_id,owner_user_id,policy_version,approval_id,terms_revision,quote_id,amount_yen,instructor_count,consent_at,payment_preparation_id,phase,plan_key,plan_name,discount_description,consent_revision)
    values(${lit(hq)},${lit(owner.id)},${lit(policy)},'LOCAL TEST ONLY','local-terms',${lit(quote)},5000,0,now(),'local-no-provider','prepared','small','Local fixture','No discount','local-consent');
    insert into public.community_communities(id,slug,name,owner_user_id) values(${lit(community)},${lit(tag)},'LOCAL AUTH COMMUNITY',${lit(owner.id)});
    insert into public.community_memberships(id,community_id,user_id,role,status) values(${lit(membership)},${lit(community)},${lit(other.id)},'member','active');
    commit;`);
  seeded = true;
  const args = { p_headquarters_id: hq }, receiptArgs = { ...args, p_idempotency_key: key };
  check(must(await rpc(owner, 'academy_first_publication_cancel_status', args), 'owner cancellation read') === null, 'no preexisting cancellation');
  const prepared = await rpc(owner, 'academy_first_publication_cancel_append', receiptArgs);
  denied(prepared, 'prepared enrollment cannot cancel unstarted trial');
  check(prepared.data?.message === 'trial_not_started', 'prepared rejection is business guard');
  for (const actor of [other, null]) {
    const label = actor ? 'cross-owner' : 'anonymous';
    for (const method of ['status', 'append', 'acknowledge']) {
      denied(await rpc(actor, `academy_first_publication_cancel_${method}`, method === 'status' ? args : receiptArgs), `${label} ${method} denied`);
    }
    denied(await rpc(actor, 'academy_get_community_release_overview', { ...args, p_community_id: community }), `${label} Community overview denied`);
  }
  for (const actor of [owner, other, null]) {
    const privateRead = await request('/rest/v1/receipt_inbox?select=*', local.ANON_KEY, actor?.token, undefined, 'GET', { 'Accept-Profile': 'academy_publication_private' });
    check(!privateRead.ok && [401,403,404,406].includes(privateRead.status), `private receipt table unavailable through API (HTTP ${privateRead.status})`);
  }
  const communityBefore = sql(`select row_to_json(m)::text from public.community_memberships m where id=${lit(membership)}`);
  const overviewArgs = { ...args, p_community_id: community };
  must(await rpc(owner, 'academy_get_community_release_overview', overviewArgs), 'dual owner Community overview');
  // Initialize the previously unpublished synthetic fixture exactly once.
  const initialized = sql(`update academy_publication_private.enrollments set phase='trialing',first_published_at=statement_timestamp(),trial_ends_at=statement_timestamp()+interval '168 hours' where headquarters_id=${lit(hq)} and phase='prepared' and first_published_at is null and trial_ends_at is null returning headquarters_id;`);
  check(initialized === hq, 'synthetic fixture initialized once; no timestamp rewrite');
  const publicationBefore = sql(`select jsonb_build_array(first_published_at,trial_ends_at)::text from academy_publication_private.enrollments where headquarters_id=${lit(hq)}`);
  const appended = must(await rpc(owner, 'academy_first_publication_cancel_append', receiptArgs), 'real PostgREST fresh transaction append');
  check(appended.status === 'awaiting_durable_acknowledgment' && !appended.receipt_id, 'append does not prematurely acknowledge');
  const waiting = must(await rpc(owner, 'academy_first_publication_cancel_status', args), 'committed unacknowledged status');
  check(waiting.status === 'awaiting_durable_acknowledgment' && waiting.idempotency_key === key, 'status preserves recovery key');
  const ack = must(await rpc(owner, 'academy_first_publication_cancel_acknowledge', receiptArgs), 'separate HTTP transaction durable acknowledgment');
  check(ack.status === 'accepted' && ack.headquarters_id === hq && ack.sequence === 1, 'first receipt acknowledged');
  check(Date.parse(ack.request_received_at) <= Date.parse(ack.trial_ends_at), 'DB receipt within deadline');
  must(await rpc(owner, 'academy_first_publication_cancel_append', receiptArgs), 'same-key append replay');
  const replay = must(await rpc(owner, 'academy_first_publication_cancel_acknowledge', receiptArgs), 'same-key ack replay');
  check(JSON.stringify(replay) === JSON.stringify(ack), 'replay does not change receipt or timestamps');
  const applied = must(await rpc(owner, 'academy_first_publication_command', { ...args, p_action: 'cancel_conversion' }), 'cancellation business projection');
  check(applied.phase === 'cancelled', 'business state cancelled');
  const final = must(await rpc(owner, 'academy_first_publication_cancel_status', args), 'final cancellation status');
  check(final.applied === true && final.receipt_id === ack.receipt_id, 'status exposes applied original receipt');
  must(await rpc(owner, 'academy_get_community_release_overview', overviewArgs), 'Community overview remains readable after cancellation');
  check(sql(`select row_to_json(m)::text from public.community_memberships m where id=${lit(membership)}`) === communityBefore, 'unrelated Community membership unchanged');
  check(sql(`select jsonb_build_array(first_published_at,trial_ends_at)::text from academy_publication_private.enrollments where headquarters_id=${lit(hq)}`) === publicationBefore, 'original publication and 168-hour deadline unchanged');
  check(sql(`select count(*)=1 and max(sequence)=1 from academy_publication_private.receipt_inbox where headquarters_id=${lit(hq)}`) === 't', 'one durable gap-free receipt');
  console.log(JSON.stringify({ passed, coverage: 'real local Auth password JWT + PostgREST cancellation and owner boundaries', excluded: ['real first publication', 'Stripe', 'Community invitation acceptance', 'production'], fixtureTag: tag }));
} catch (error) {
  // Assertions contain labels only. Do not dump HTTP responses, keys or tokens.
  console.error(`Local Auth check failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const actor of users) {
    try {
      const response = await fetch(`${api}/auth/v1/logout?scope=global`, { method: 'POST', headers: { apikey: local.ANON_KEY, Authorization: `Bearer ${actor.token}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
      if (!response.ok) throw new Error('logout rejected');
    } catch { console.error('LOCAL CLEANUP INCOMPLETE: synthetic session sign-out failed'); process.exitCode = 1; }
  }
  // Immutable receipt evidence deliberately retained inside this local project.
  // The main operator owns destruction of the entire verified local project.
  console.log(`Synthetic accounts ${users.length}; fixture retained: ${seeded}; no production requests performed.`);
}
