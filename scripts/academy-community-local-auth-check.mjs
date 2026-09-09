// Local Auth + PostgREST integration check. Never accepts an external endpoint.
// SQL seeds synthetic prepared enrollment only; this is NOT a Stripe/publish E2E.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const project = 'academy-release-auth-20260909';
const api = 'http://127.0.0.1:54441';
const container = `supabase_db_${project}`;
const docker = 'C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
if (process.env.ACADEMY_COMMUNITY_LOCAL_AUTH_CONFIRM !== project) {
  throw new Error(`Explicit local-only confirmation required: ACADEMY_COMMUNITY_LOCAL_AUTH_CONFIRM=${project}`);
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
const fixtureId = () => `f9092000${randomUUID().slice(8)}`;
const hq = fixtureId(), quote = fixtureId(), community = fixtureId(), membership = fixtureId();
const key = randomUUID(), policy = 'academy-first-publication-trial-2026-09-08-v1';
const course=fixtureId(), mapping=fixtureId(), room=fixtureId(), teacher=fixtureId(), pendingTeacher=fixtureId();
const consent='academy-first-publication-community-invitation-consent-2026-09-08-v1';
const invitePolicy='academy_first_publication_community_invitation_v1';
let seeded = false;
try {
  for (const kind of ['owner', 'other', 'pending']) {
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
  const [owner, other, pending] = users;
  sql(`begin;
    insert into public.academy_headquarters(id,owner_user_id,name,handle,is_active) values(${lit(hq)},${lit(owner.id)},'LOCAL AUTH FIXTURE',${lit(tag)},false);
    insert into academy_publication_private.policies(version,approval_id,terms_revision,quote_ttl_seconds,enabled,initial_price,cancellation,eligibility,pricing_revision,consent_revision)
    values(${lit(policy)},'LOCAL TEST ONLY','local-terms',1800,true,'fixed_at_publication','inclusive_deadline','no_previous_trial_or_contract','local-price','local-consent') on conflict(version) do nothing;
    insert into academy_publication_private.quote_display_catalog(policy_version,pricing_revision,plan_key,plan_name,discount_description,consent_revision)
    values(${lit(policy)},'local-price','small','Local fixture','No discount','local-consent') on conflict do nothing;
    insert into academy_publication_private.quotes(id,headquarters_id,owner_user_id,policy_version,terms_revision,amount_yen,instructor_count,issued_at,expires_at,payment_preparation_id,payment_verified,current_price_verified,pricing_revision,plan_key,plan_name,discount_description,consent_revision)
    values(${lit(quote)},${lit(hq)},${lit(owner.id)},${lit(policy)},'local-terms',5000,0,now(),now()+interval '30 minutes','local-no-provider',true,true,'local-price','small','Local fixture','No discount','local-consent');
    insert into academy_publication_private.enrollments(headquarters_id,owner_user_id,policy_version,approval_id,terms_revision,quote_id,amount_yen,instructor_count,consent_at,payment_preparation_id,phase,plan_key,plan_name,discount_description,consent_revision)
    values(${lit(hq)},${lit(owner.id)},${lit(policy)},'LOCAL TEST ONLY','local-terms',${lit(quote)},5000,0,now(),'local-no-provider','prepared','small','Local fixture','No discount','local-consent');
    insert into public.community_communities(id,slug,name,owner_user_id) values(${lit(community)},${lit(tag)},'LOCAL AUTH COMMUNITY',${lit(owner.id)});
    insert into public.community_memberships(id,community_id,user_id,role,status) values(${lit(membership)},${lit(community)},${lit(other.id)},'member','active');

    insert into public.profiles(user_id,display_name,handle) select ${lit(other.id)},'Local teacher',${lit(tag+'-a')} where not exists(select 1 from public.profiles where user_id=${lit(other.id)});
    insert into public.profiles(user_id,display_name,handle) select ${lit(pending.id)},'Local pending',${lit(tag+'-b')} where not exists(select 1 from public.profiles where user_id=${lit(pending.id)});
    update academy_publication_private.enrollments set phase='trialing',first_published_at=statement_timestamp(),trial_ends_at=statement_timestamp()+interval '168 hours' where headquarters_id=${lit(hq)} and phase='prepared' and first_published_at is null;
    insert into public.academy_courses(id,headquarters_id,user_id,code,name) values(${lit(course)},${lit(hq)},${lit(owner.id)},'local','Local course');
    insert into public.academy_instructors(id,headquarters_id,course_id,profile_id,user_id,is_active,registration_status)
      select ${lit(teacher)},${lit(hq)},${lit(course)},id,user_id,true,'registered' from public.profiles where user_id=${lit(other.id)};
    insert into public.academy_instructors(id,headquarters_id,course_id,profile_id,user_id,is_active,registration_status)
      select ${lit(pendingTeacher)},${lit(hq)},${lit(course)},id,user_id,true,'registered' from public.profiles where user_id=${lit(pending.id)};
    insert into platform_billing_private.creation_entitlements(actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,status,starts_at,expires_at,resource_id,consumed_at)
      values(${lit(owner.id)},'community_platform','trial','verified_trial',${lit(fixtureId())},${lit(fixtureId())},'consumed',now(),now()+interval '7 days',${lit(community)},now());
    insert into public.community_memberships(community_id,user_id,role,status) values(${lit(community)},${lit(owner.id)},'owner','active');
    insert into public.community_safety_settings(community_id,terms_version,terms_text,rules_version,rules_text,privacy_version,privacy_text)
      values(${lit(community)},3,'Local terms',4,'Local rules',5,'Local privacy')
      on conflict(community_id) do update set terms_version=3,terms_text='Local terms',rules_version=4,rules_text='Local rules',privacy_version=5,privacy_text='Local privacy';
    insert into public.community_entitlement_definitions(community_id,key,name,status) values(${lit(community)},'academy-room','Local Academy room','active'),(${lit(community)},'manual-local','Unrelated manual','active');
    insert into public.community_access_source_mappings(id,community_id,provider_type,provider_owner_key,source_product_key,entitlement_key,status,created_by_user_id)
      values(${lit(mapping)},${lit(community)},'academy_subscription',${lit(hq)},'course:local','academy-room','active',${lit(owner.id)});
    insert into public.community_rooms(id,community_id,title,access_type) values(${lit(room)},${lit(community)},'Local invited room','entitlement');
    insert into public.community_room_entitlement_rules(community_id,room_id,entitlement_key) values(${lit(community)},${lit(room)},'academy-room');
    insert into public.community_member_entitlements(community_id,user_id,entitlement_key,source,source_reference,status,starts_at)
      values(${lit(community)},${lit(other.id)},'manual-local','manual','local-manual','active',now());
    insert into community_private.academy_community_invitation_policies(key,status,inviter_authority,invitation_ttl,allow_during_academy_trial,academy_access_scheme,academy_policy_version,community_consent_revision,community_consent_mode,source_cancellation_mode)
      values(${lit(invitePolicy)},'active','community_owner',interval '2 days',true,'first_publication_168h_v1',${lit(policy)},${lit(consent)},'snapshot_current_versions_at_issue','preserve_accepted_until_source_end') on conflict(key) do nothing;
    commit;`);
  seeded = true;

  const args={p_headquarters_id:hq};
  const issueArgs=id=>({...args,p_community_id:community,p_mapping_id:mapping,p_instructor_id:id,p_room_ids:[room],p_policy_key:invitePolicy});
  const acceptArgs=id=>({p_invitation_id:id,p_community_consent_revision:consent,p_display_name:'Local teacher',p_legal_name:'Local synthetic teacher',p_phone:'09000000000',p_join_reason:'Local integration test',p_accept_terms:true,p_terms_version:3,p_accept_rules:true,p_rules_version:4,p_accept_privacy:true,p_privacy_version:5});
  const accept='community_accept_academy_access_invitation_versioned', issue='academy_issue_community_instructor_invitation';
  check(sql(`select phase='trialing' and trial_ends_at=first_published_at+interval '168 hours' from academy_publication_private.enrollments where headquarters_id=${lit(hq)}`)==='t','synthetic Academy trial initialized once before live instructor registration');
  const unchanged=()=>sql(`select row_to_json(e)::text from public.community_member_entitlements e where community_id=${lit(community)} and user_id=${lit(other.id)} and entitlement_key='manual-local'`);
  const before=unchanged();
  denied(await rpc(other,issue,issueArgs(teacher)),'teacher cannot issue owner invitation');
  denied(await rpc(null,issue,issueArgs(teacher)),'anonymous cannot issue invitation');
  const issued=must(await rpc(owner,issue,issueArgs(teacher)),'dual owner issues invitation');
  const waiting=must(await rpc(owner,issue,issueArgs(pendingTeacher)),'dual owner issues pending invitation');
  assert(issued.id && waiting.id,'Invitation IDs required');
  const preview=must(await rpc(other,'community_get_my_academy_access_invitation',{p_invitation_id:issued.id}),'recipient reads invitation');
  check(preview.consentMode==='versioned' && preview.communityConsentRevision===consent,'recipient sees versioned consent');
  denied(await rpc(owner,accept,acceptArgs(issued.id)),'owner cannot accept for teacher');
  denied(await rpc(pending,accept,acceptArgs(issued.id)),'different teacher cannot accept');
  denied(await rpc(other,accept,{...acceptArgs(issued.id),p_terms_version:2}),'stale document version rejected');
  denied(await rpc(other,accept,{...acceptArgs(issued.id),p_accept_privacy:false}),'missing privacy consent rejected');
  must(await rpc(other,accept,acceptArgs(issued.id)),'recipient accepts all three versioned documents');
  check(sql(`select exists(select 1 from public.community_academy_entitlement_claims where invitation_id=${lit(issued.id)} and user_id=${lit(other.id)} and status='active')`)==='t','Academy room claim created');
  check(sql(`select count(distinct document_type)=3 from public.community_consent_records where community_id=${lit(community)} and user_id=${lit(other.id)} and (document_type,document_version) in (('terms',3),('rules',4),('privacy',5))`)==='t','three displayed versions recorded');
  const memberRead=must(await request(`/rest/v1/community_memberships?community_id=eq.${community}&user_id=eq.${other.id}&select=status,access_scope`,local.ANON_KEY,other.token,undefined,'GET'),'recipient reads own membership');
  check(memberRead.some(row=>row.status==='active'),'recipient has active membership via RLS');
  const claimBefore=sql(`select row_to_json(c)::text from public.community_academy_entitlement_claims c where invitation_id=${lit(issued.id)}`);
  must(await rpc(owner,'academy_first_publication_cancel_append',{...args,p_idempotency_key:key}),'real cancellation receipt append');
  denied(await rpc(owner,issue,issueArgs(pendingTeacher)),'receipt immediately blocks new or resend invitation before ack');
  denied(await rpc(pending,accept,acceptArgs(waiting.id)),'receipt immediately blocks pending acceptance before ack');
  check(unchanged()===before,'unrelated manual Community entitlement unchanged');
  check(sql(`select row_to_json(c)::text from public.community_academy_entitlement_claims c where invitation_id=${lit(issued.id)}`)===claimBefore,'accepted Academy claim retained with original expiry');
  const overview=must(await rpc(owner,'academy_get_community_release_overview',{...args,p_community_id:community}),'owner reads real contract and invitations');
  check(overview.invitationOptions.reason==='academy_invitation_stopped','overview explains invitation stop');
  console.log(JSON.stringify({passed,coverage:'real local Auth + PostgREST versioned Community invitation and receipt-stop integration',excluded:['Stripe','production','paid Community subscription checkout','actual first publication'],fixtureTag:tag}));
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
