import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const pglitePath=process.env.ACADEMY_PGLITE_PATH ?? 'G:/Musubiプロジェクト/.local-tools/academy-db-validation/node_modules/@electric-sql/pglite/dist/index.js';
const { PGlite }=await import(pathToFileURL(pglitePath).href);

// Synthetic contract fixture, NOT a production-schema clone. No network DB.
const db = new PGlite();
try {
let passed=0;
const a='10000000-0000-4000-8000-000000000001', b='10000000-0000-4000-8000-000000000002';
const h='20000000-0000-4000-8000-000000000001', hb='20000000-0000-4000-8000-000000000002';
const c='30000000-0000-4000-8000-000000000001', c2='30000000-0000-4000-8000-000000000002';
const sql=await readFile(new URL('../migrations/20260908070613_academy_first_publication_atomic.sql',import.meta.url),'utf8');
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema private; create schema platform_billing_private;
create table auth.users(id uuid primary key,is_anonymous boolean default false);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.academy_headquarters(id uuid primary key,owner_user_id uuid references auth.users);
create table public.academy_courses(id uuid primary key,headquarters_id uuid references public.academy_headquarters,user_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),is_published boolean default false,title text default 'fixture');
create table public.academy_trial_usage_ledger(owner_user_id uuid primary key);
create table public.academy_headquarters_access_states(owner_user_id uuid,headquarters_id uuid,access_kind text,status text,trial_ends_at timestamptz);
create table platform_billing_private.subscriptions(actor_user_id uuid,product_key text);
create table platform_billing_private.creation_entitlements(actor_user_id uuid,product_key text);
create table public.academy_instructors(profile_id uuid,headquarters_id uuid,created_at timestamptz default now(),withdrawn_at timestamptz);
create table public.academy_instructor_billing_exclusions(profile_id uuid,headquarters_id uuid,effective_from timestamptz,effective_until timestamptz);
create function private.academy_has_headquarters_creation_entitlement(uuid) returns boolean language sql as $$ select false $$;
create function private.academy_headquarters_access_mode(uuid) returns text language sql as $$ select case when access_kind='paid' then 'paid' when trial_ends_at>now() then 'trial_active' else 'trial_expired' end from public.academy_headquarters_access_states where headquarters_id=$1 $$;
create function private.academy_catalog_monthly_price_yen(integer) returns integer language sql as $$ select case when $1<=20 then 5000 when $1<=50 then 10000 else 20000 end $$;
create function public.academy_get_my_current_billing_estimate(uuid) returns table(registered_instructor_count integer,catalog_price_yen integer,observed_at timestamptz) language sql as $$ select count(*)::integer,private.academy_catalog_monthly_price_yen(count(*)::integer),now() from public.academy_instructors where headquarters_id=$1 $$;
grant usage on schema public,auth to authenticated;
grant select,update on public.academy_courses to authenticated;
`);
await db.exec(sql);
await db.exec(`create trigger academy_trial_guard_courses before insert or update or delete on public.academy_courses for each row execute function private.academy_guard_trial_course_draft();`);
// Seed courses before enrollment using legacy paid fixture; then remove fixture access.
await db.exec(`insert into auth.users values('${a}',false),('${b}',false);
insert into public.academy_headquarters values('${h}','${a}'),('${hb}','${b}');
insert into public.academy_headquarters_access_states values('${a}','${h}','paid','active',null);
insert into public.academy_courses(id,headquarters_id,user_id) values('${c}','${h}','${a}'),('${c2}','${h}','${a}');
delete from public.academy_headquarters_access_states;
insert into academy_publication_private.policies values('fixture-v1','fixture-approval','fixture-terms',1800,false,'fixed_at_publication','inclusive_deadline','no_previous_trial_or_contract');`);
await db.exec(await readFile(new URL('./academy_first_publication_contract.sql',import.meta.url),'utf8')); passed++;
const query=async(s)=> (await db.query(s)).rows[0];
async function actor(id,fn){await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);try{return await fn();}finally{await db.exec('reset role');}}
const cmd=(action,extra='')=>`select public.academy_first_publication_command('${h}','${action}'${extra}) as result`;
async function rejects(code,fn){await assert.rejects(fn,new RegExp(code));passed++;}
await rejects('policy_not_approved',()=>actor(a,()=>query(`select public.academy_first_publication_quote('${h}','fixture-v1')`)));
await db.exec(`update academy_publication_private.policies set enabled=true`);
const q=(await actor(a,()=>query(`select public.academy_first_publication_quote('${h}','fixture-v1') as result`))).result;
assert.equal(q.amount_yen,5000);passed++;
await rejects('forbidden',()=>actor(b,()=>query(cmd('status'))));
await rejects('payment_preparation_unverified',()=>actor(a,()=>query(cmd('prepare',`,p_quote_id=>'${q.id}',p_confirmed=>true,p_terms_revision=>'fixture-terms',p_amount_yen=>5000`))));
// Explicit stub of verified provider proof; real provider is NOT exercised.
await db.exec(`update academy_publication_private.quotes set payment_preparation_id='fixture-proof',payment_verified=true where id='${q.id}'`);
await actor(a,()=>query(cmd('prepare',`,p_quote_id=>'${q.id}',p_confirmed=>true,p_terms_revision=>'fixture-terms',p_amount_yen=>5000`)));passed++;
await rejects('publication_blocked',()=>actor(a,()=>db.exec(`update public.academy_courses set is_published=true where id='${c}'`)));
await db.exec(`create function private.fixture_fail() returns trigger language plpgsql as $$ begin if new.is_published then raise exception 'fixture_publish_failure'; end if; return new; end $$; create trigger zz_fixture_fail before update on public.academy_courses for each row execute function private.fixture_fail();`);
await rejects('fixture_publish_failure',()=>actor(a,()=>query(cmd('publish',`,p_course_id=>'${c}',p_quote_id=>'${q.id}',p_confirmed=>true`))));
assert.equal((await query('select count(*)::integer as n from academy_publication_private.owner_history')).n,0);
assert.equal((await query('select count(*)::integer as n from academy_publication_private.outbox')).n,0);passed++;
await db.exec('drop trigger zz_fixture_fail on public.academy_courses');
const first=(await actor(a,()=>query(cmd('publish',`,p_course_id=>'${c}',p_quote_id=>'${q.id}',p_confirmed=>true`)))).result;
assert.equal(Date.parse(first.trial_ends_at)-Date.parse(first.first_published_at),168*3600000);passed++;
await rejects('publication_rpc_required',()=>actor(a,()=>db.exec(`update public.academy_courses set is_published=true where id='${c2}'`)));
const second=(await actor(a,()=>query(cmd('publish',`,p_course_id=>'${c2}',p_confirmed=>true`)))).result;
assert.equal(second.first_published_at,first.first_published_at);passed++;
await actor(a,()=>query(cmd('cancel_conversion')));
await rejects('academy_first_publication_writes_blocked',()=>actor(a,()=>db.exec(`update public.academy_courses set title='changed' where id='${c}'`)));
await actor(a,()=>query(cmd('unpublish',`,p_course_id=>'${c}'`)));passed++;
await rejects('academy_first_publication_writes_blocked',()=>actor(a,()=>db.exec(`update public.academy_courses set title='changed' where id='${c}'`)));
await db.exec(`insert into public.academy_trial_usage_ledger values('${b}')`);
const qb=(await actor(b,()=>query(`select public.academy_first_publication_quote('${hb}','fixture-v1') as result`))).result;
await db.exec(`update academy_publication_private.quotes set payment_preparation_id='fixture-proof-b',payment_verified=true where id='${qb.id}'`);
await rejects('not_eligible_for_new_scheme',()=>actor(b,()=>query(`select public.academy_first_publication_command('${hb}','prepare',p_quote_id=>'${qb.id}',p_confirmed=>true,p_terms_revision=>'fixture-terms',p_amount_yen=>5000)`)));
console.log(JSON.stringify({passed,engine:'PGlite synthetic contract fixture',notValidated:['production schema/RLS','multi-connection contention','real Auth/provider','charge dispatch/cancellation race']}));
if(process.env.ACADEMY_RUNTIME_TEST==='1') {
 await db.exec(`
 create table public.profiles(id uuid primary key,user_id uuid,handle text);
 alter table public.academy_headquarters add column owner_profile_id uuid;
 alter table public.academy_headquarters add column name text;
 alter table public.academy_headquarters add column handle text;
 alter table public.academy_headquarters add column plan text;
 alter table public.academy_headquarters add column is_active boolean default false;
 create function private.academy_owner_read_allowed(uuid,timestamptz) returns boolean language sql as $$ select true $$;
 create function private.academy_headquarters_role(uuid,uuid) returns text language sql as $$ select 'owner'::text from public.academy_headquarters where id=$1 and owner_user_id=$2 $$;
 create function public.academy_get_my_headquarters_access(uuid) returns table(headquarters_id uuid,access_kind text,status text,starts_at timestamptz,ends_at timestamptz,days_remaining integer,can_manage_drafts boolean,can_use_live_features boolean) language sql as $$ select $1,'trial'::text,'expired'::text,null::timestamptz,null::timestamptz,0,false,false $$;
 `);
 await db.exec(await readFile(new URL('../migrations/20260908084409_academy_first_publication_runtime.sql',import.meta.url),'utf8'));
 const na='10000000-0000-4000-8000-000000000003', np='40000000-0000-4000-8000-000000000003',nc='30000000-0000-4000-8000-000000000003';
 await db.exec(`insert into auth.users values('${na}',false);insert into public.profiles values('${np}','${na}','fixture');update academy_publication_private.policies set pricing_revision='catalog-v1';`);
 const nh=(await actor(na,()=>query(`select public.academy_first_publication_create_preparation('Fixture academy','fixture-v1') as result`))).result.headquarters_id;
 assert.equal((await query(`select count(*)::integer as n from public.academy_trial_usage_ledger where owner_user_id='${na}'`)).n,0);passed++;
 await db.exec(`insert into public.academy_courses(id,headquarters_id,user_id) values('${nc}','${nh}','${na}')`);
 const nq=(await actor(na,()=>query(`select public.academy_first_publication_quote('${nh}','fixture-v1') as result`))).result;
 async function svc(s){await db.exec('set role service_role');try{return await query(s);}finally{await db.exec('reset role');}}
 const attempt=(await svc(`select public.academy_first_publication_setup_reserve('${na}','${nh}','${nq.id}') as result`)).result;
 await rejects('permission denied',()=>actor(na,()=>query(`select public.academy_first_publication_setup_complete('${attempt.attempt_id}','cus_fixture','seti_fixture','pm_fixture')`)));
 await svc(`select public.academy_first_publication_setup_attach('${attempt.attempt_id}','cus_fixture',null)`);
 await svc(`select public.academy_first_publication_setup_attach('${attempt.attempt_id}','cus_fixture','cs_fixture','seti_fixture')`);
 const complete=(await svc(`select public.academy_first_publication_setup_complete('${attempt.attempt_id}','cus_fixture','seti_fixture','pm_fixture') as result`)).result;
 assert.equal(complete.quote.id,nq.id);passed++;
 await actor(na,()=>query(`select public.academy_first_publication_command('${nh}','prepare',p_quote_id=>'${nq.id}',p_confirmed=>true,p_terms_revision=>'fixture-terms',p_amount_yen=>5000)`));
 await db.exec(`insert into public.academy_instructors values(gen_random_uuid(),'${nh}',now(),null)`);
 await actor(na,()=>query(`select public.academy_first_publication_command('${nh}','publish',p_course_id=>'${nc}',p_quote_id=>'${nq.id}',p_confirmed=>true)`));passed++;
 // Existing synthetic outbox has no real setup proof; leave it outside claim fixture.
 await db.exec(`update academy_publication_private.outbox set blocked=true where headquarters_id<>'${nh}'`);
 const job=(await svc(`select public.academy_first_publication_outbox_claim('fixture-worker',60) as result`)).result;
 assert.equal(job.proof.checkout_session_id,'cs_fixture');passed++;
 await rejects('stale_lease',()=>svc(`select public.academy_first_publication_outbox_finish('${job.event_key}',gen_random_uuid(),'{"outcome":"trial_ready"}')`));
 await svc(`select public.academy_first_publication_outbox_finish('${job.event_key}','${job.lease_token}','{"outcome":"trial_ready"}')`);passed++;
 await actor(na,()=>query(`select public.academy_first_publication_record_cancel('${nh}')`));
 let ac=(await actor(na,()=>query(`select public.academy_first_publication_access('${nh}') as result`))).result;
 assert.equal(ac.active,true);assert.equal(ac.inviteAllowed,false);passed++;
 assert.equal(ac.policyVersion,'fixture-v1');passed++;
 await actor(na,()=>query(`select public.academy_first_publication_command('${nh}','cancel_conversion')`));
 await actor(na,()=>db.exec(`update public.academy_courses set title='allowed until end' where id='${nc}'`));passed++;
 assert.equal((await svc(`select public.academy_first_publication_outbox_claim('fixture-worker',60) as result`)).result.kind,'cancel_conversion');passed++;
 // Privileged fixture clock/state changes below are not production write paths.
 await db.exec(`update academy_publication_private.enrollments set first_published_at=now()-interval '169 hours',trial_ends_at=now()-interval '1 hour' where headquarters_id='${nh}';
 update academy_publication_private.outbox set available_at=now()-interval '1 minute' where headquarters_id='${nh}' and kind='start_paid';`);
 ac=(await actor(na,()=>query(`select public.academy_first_publication_access('${nh}') as result`))).result;
 assert.equal(ac.active,false);assert.equal(ac.phase,'expired');passed++;
 await rejects('academy_first_publication_writes_blocked',()=>actor(na,()=>db.exec(`update public.academy_courses set title='expired' where id='${nc}'`)));
 assert.equal((await svc(`select public.academy_first_publication_outbox_claim('fixture-worker',60) as result`)).result,null);passed++;
 await db.exec(`update academy_publication_private.policies set dispatch_enabled=true`);
 const paidJob=(await svc(`select public.academy_first_publication_outbox_claim('fixture-worker',60) as result`)).result;
 assert.equal((await svc(`select public.academy_first_publication_outbox_dispatch_check('${paidJob.event_key}','${paidJob.lease_token}') as result`)).result.reason,'conversion_cancelled');passed++;
 await db.exec(`delete from academy_publication_private.cancel_intents where headquarters_id='${nh}';update academy_publication_private.enrollments set phase='trialing',cancellation_accepted_at=null where headquarters_id='${nh}'`);
 const checkpoint=(await svc(`select public.academy_first_publication_outbox_checkpoint('${paidJob.event_key}','${paidJob.lease_token}','invoice_create') as result`)).result;
 assert.equal(checkpoint.provider_id,null);passed++;
 await svc(`select public.academy_first_publication_outbox_checkpoint('${paidJob.event_key}','${paidJob.lease_token}','invoice_create','in_fixture')`);
 await rejects('provider_binding_immutable',()=>svc(`select public.academy_first_publication_outbox_checkpoint('${paidJob.event_key}','${paidJob.lease_token}','invoice_create','in_other')`));
 await svc(`select public.academy_first_publication_outbox_finish('${paidJob.event_key}','${paidJob.lease_token}',jsonb_build_object('outcome','paid','provider_invoice_id','in_fixture','provider_subscription_id','sub_fixture','amount_yen',5000,'paid_at',now(),'period_end',now()+interval '1 month'))`);passed++;
 ac=(await actor(na,()=>query(`select public.academy_first_publication_access('${nh}') as result`))).result;
 assert.equal(ac.active,true);assert.equal(ac.phase,'paid');passed++;
 await actor(na,()=>query(`select public.academy_first_publication_command('${nh}','unpublish',p_course_id=>'${nc}')`));
 await actor(na,()=>query(`select public.academy_first_publication_command('${nh}','publish',p_course_id=>'${nc}',p_confirmed=>true)`));passed++;
 assert.equal((await actor(na,()=>query(`select * from public.academy_get_my_headquarters_access('${nh}')`))).access_kind,'paid');passed++;
 await db.exec(`update academy_publication_private.policies set dispatch_enabled=false`);
 console.log(JSON.stringify({runtimePassed:passed-16,totalPassed:passed,dispatchActivated:false}));
}
} catch(error) {
  console.error(JSON.stringify({error:error.message,code:error.code,where:error.where,position:error.position}));
  process.exitCode=1;
} finally {
  await db.close();
}
