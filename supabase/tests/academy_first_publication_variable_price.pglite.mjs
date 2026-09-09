import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.ACADEMY_PGLITE_PATH??'G:/Musubiプロジェクト/.local-tools/academy-db-validation/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite(); let passed=0;
const root=new URL('../migrations/',import.meta.url);
const a='10000000-0000-4000-8000-000000000001',h='20000000-0000-4000-8000-000000000001',c='30000000-0000-4000-8000-000000000001';
const query=async sql=>(await db.query(sql)).rows[0];
const json=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
const role=async(name,sql)=>{await db.exec(`set role ${name}`);try{return await query(sql);}finally{await db.exec('reset role').catch(()=>{});}};
const svc=sql=>role('service_role',sql),actor=sql=>role('authenticated',sql);
const ok=(actual,expected)=>{assert.deepEqual(actual,expected);passed++;};
const deny=async(code,fn)=>{await assert.rejects(fn,new RegExp(code));passed++;};
try {
 // Reuse only the established synthetic schema bootstrap, never its test SQL.
 // This is an in-memory contract fixture, not a production schema clone.
 const harness=await readFile(new URL('./academy_first_publication_platform_bridge.pglite.mjs',import.meta.url),'utf8');
 const bootstrap=harness.match(/await db\.exec\(`(create role anon;[\s\S]*?)`\);/);
 assert(bootstrap && !bootstrap[1].includes('${'),'synthetic bootstrap must remain literal');
 await db.exec(bootstrap[1]);
 const base=harness.match(/const migrations=(\[[^\n]+\])\.sort\(\);/);
 assert(base,'explicit base migration list required');
 const migrations=JSON.parse(base[1].replaceAll("'",'"'));
 migrations.push('20260908101940_academy_first_publication_quote_display.sql','20260908102540_academy_first_publication_ingress_authority.sql','20260908103347_academy_first_publication_setup_quote_projection.sql','20260908235813_academy_first_publication_variable_price.sql');
 migrations.sort();
 for(const name of migrations){try {await db.exec(await readFile(new URL(name,root),'utf8'));}catch(error){throw new Error(`${name}: ${error.message}`,{cause:error});}}
 // The bridge-only schema fixture predates this existing public estimate RPC.
 // Load its actual body (not a price stub) and supply synthetic auth.jwt only.
 await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$ select '{"is_anonymous":false}'::jsonb $$`);
 const pilot=await readFile(new URL('20260830143000_academy_limited_pilot_access_controls.sql',root),'utf8');
 const estimate=pilot.match(/create or replace function public\.academy_get_my_current_billing_estimate\([\s\S]*?\$\$;/);
 assert(estimate,'existing estimate function required');await db.exec(estimate[0]);
 passed++;
 ok((await query('select count(*)::int n from academy_publication_private.quote_display_catalog')).n,0);
 ok((await query(`select count(*)::int n from academy_publication_private.policies where enabled or dispatch_enabled`)).n,0);
 await db.exec(`insert into auth.users values('${a}',false);insert into public.academy_headquarters(id,owner_user_id) values('${h}','${a}');
 insert into public.academy_courses(id,headquarters_id,user_id) values('${c}','${h}','${a}');
 insert into academy_publication_private.policies(version,approval_id,terms_revision,quote_ttl_seconds,enabled,initial_price,cancellation,eligibility,pricing_revision,consent_revision)
 values('fixture','approval','terms',1800,true,'fixed_at_publication','inclusive_deadline','no_previous_trial_or_contract','v1','consent-v1');
 select set_config('request.jwt.claim.sub','${a}',false);`);
 const count=async n=>db.exec(`delete from public.academy_instructors;insert into public.academy_instructors(profile_id,headquarters_id) select gen_random_uuid(),'${h}' from generate_series(1,${n})`);
 const quote=()=>actor(`select public.academy_first_publication_quote('${h}','fixture') as r`);
 await count(201);
 await deny('quote_display_metadata_required',quote);
 ok((await query('select count(*)::int n from academy_publication_private.quotes')).n,0);
 await db.exec(`insert into academy_publication_private.quote_display_catalog select 'fixture','v1',key,'Server '||key,'Server unchanged discount','consent-v1' from unnest(array['small','medium','large','variable']) key`);
 for(const [n,amount,key] of [[20,5000,'small'],[21,10000,'medium'],[50,10000,'medium'],[51,20000,'large'],[200,20000,'large'],[201,20100,'variable'],[250,25000,'variable']]){
  await count(n); const q=(await quote()).r;
  ok([q.instructor_count,q.amount_yen,q.plan_key,q.plan_name,q.discount_description,q.consent_revision],[n,amount,key,`Server ${key}`,'Server unchanged discount','consent-v1']);
 }
 await count(201); const q=(await quote()).r;
 const reserved=(await svc(`select public.academy_first_publication_setup_reserve('${a}','${h}','${q.id}') as r`)).r;
 ok([reserved.quote.plan_key,reserved.quote.amount_yen,reserved.quote.plan_name],['variable',20100,'Server variable']);
 const attempt=reserved.attempt_id;
 await svc(`select public.academy_first_publication_setup_attach('${attempt}','cus_fixture','cs_fixture','seti_fixture')`);
 // Synthetic provider IDs only: no Stripe request is made.
 await count(202);
 await deny('requote_required',()=>svc(`select public.academy_first_publication_setup_complete('${attempt}','cus_fixture','seti_fixture','pm_fixture')`));
 await count(201);
 const complete=(await svc(`select public.academy_first_publication_setup_complete('${attempt}','cus_fixture','seti_fixture','pm_fixture') as r`)).r;
 ok([complete.quote.planKey,complete.quote.amountYen,complete.quote.planName],['variable',20100,'Server variable']);
 const command=(action,amount=20100)=>actor(`select public.academy_first_publication_command('${h}','${action}',p_course_id=>'${c}',p_quote_id=>'${q.id}',p_confirmed=>true,p_terms_revision=>'terms',p_amount_yen=>${amount}) as r`);
 await deny('consent|amount|requote',()=>command('prepare',20000));
 const prepared=(await command('prepare')).r;
 ok([prepared.plan_key,prepared.amount_yen,prepared.phase,prepared.first_published_at],['variable',20100,'prepared',null]);
 const published=(await command('publish')).r;
 ok(Date.parse(published.trial_ends_at)-Date.parse(published.first_published_at),7*24*3600000);
 await db.exec(`update academy_publication_private.outbox set available_at=now()-interval '1 second'`);
 const job=(await svc(`select public.academy_first_publication_outbox_claim('fixture',60) as r`)).r;
 ok([job.plan_key,job.amount_yen],['variable',20100]);
 await deny('permission denied',()=>actor(`select public.academy_first_publication_outbox_claim('not-worker',60)`));
 await deny('permission denied',()=>actor(`select * from academy_publication_private.quote_display_catalog`));
 await deny('history_immutable',()=>db.exec(`update academy_publication_private.quote_display_catalog set plan_name='changed' where plan_key='variable'`));

 // Isolate paid-bridge arithmetic from the intentionally unverified ingress gate.
 // First prove the complete replay still blocks start_paid; only then substitute
 // its dispatch check inside a ROLLBACK-only transaction for bridge/renewal tests.
 await db.exec(`update academy_publication_private.enrollments set phase='trialing',first_published_at=now()-interval '8 days',trial_ends_at=now()-interval '1 day';
 update academy_publication_private.outbox set delivered_at=now();
 update academy_publication_private.policies set dispatch_enabled=true;
 insert into academy_publication_private.outbox(event_key,headquarters_id,kind,payload,lease_token,lease_until) values('fixture-paid','${h}','start_paid','{}','${job.lease_token}',now()+interval '1 hour');
 insert into academy_publication_private.provider_steps(event_key,step,operation_key,provider_id) values('fixture-paid','invoice_create','fixture-invoice','in_fixture'),('fixture-paid','subscription_create','fixture-sub','sub_fixture'),('fixture-paid','subscription_hold','fixture-hold','sub_fixture');`);
 ok((await svc(`select public.academy_first_publication_outbox_dispatch_check('fixture-paid','${job.lease_token}') as r`)).r,{allowed:false,reason:'ingress_concurrency_verification_pending'});
 const t=await query(`select now()-interval '1 hour' paid,platform_billing_private.next_month_at(now()-interval '1 hour') ends`);
 const result={outcome:'paid',provider_invoice_id:'in_fixture',provider_subscription_id:'sub_fixture',provider_customer_id:'cus_fixture',amount_yen:20100,plan_key:'variable',paid_at:new Date(t.paid).toISOString(),period_end:new Date(t.ends).toISOString(),provider_result_hash:'a'.repeat(64)};
 const bridge=value=>svc(`select public.academy_first_publication_paid_bridge('fixture-paid','${job.lease_token}',${json(value)}) as r`);
 await deny('dispatch_blocked',()=>bridge(result));
 await db.exec('begin');
 try {
  await db.exec(`create or replace function public.academy_first_publication_outbox_dispatch_check(p_event_key text,p_lease_token uuid) returns jsonb language sql security definer set search_path='' as $$ select jsonb_build_object('allowed',true) $$`);
  await deny('invalid_proof',()=>bridge({...result,plan_key:'large'}));
  // PostgreSQL errors abort the transaction: each negative test needs a savepoint.
 } finally {await db.exec('rollback');}
 await db.exec('begin');
 try {
  await db.exec(`create or replace function public.academy_first_publication_outbox_dispatch_check(p_event_key text,p_lease_token uuid) returns jsonb language sql security definer set search_path='' as $$ select jsonb_build_object('allowed',true) $$`);
  ok((await bridge(result)).r.status,'finished');
  ok((await query(`select plan_key,initial_amount_yen from platform_billing_private.subscriptions where provider_subscription_id='sub_fixture'`)),{plan_key:'variable',initial_amount_yen:20100});
  // Each snapshot is fresh; the announced charge (not present instructor count)
  // determines renewal. Exercise variable and the unchanged grace/downshift.
  for(const [amount,key,catalog] of [[20100,'variable',25000],[20000,'large',20100],[5000,'small',10000]]){
   await db.exec('savepoint renewal_case');
   await db.exec(`insert into public.academy_monthly_billing_snapshots(headquarters_id,snapshot_month,cutoff_at,captured_at,registered_instructor_count,billable_profile_ids,catalog_price_yen,charge_month,charge_price_yen,price_notice_required) values('${h}',date_trunc('month','${result.period_end}'::timestamptz at time zone 'Asia/Tokyo')::date-interval '1 month',now(),now(),201,array(select profile_id from public.academy_instructors),${catalog},date_trunc('month','${result.period_end}'::timestamptz at time zone 'Asia/Tokyo')::date,${amount},true)`);
   const price=(await svc(`select public.academy_first_publication_renewal_quote('sub_fixture','${result.period_end}') as r`)).r;
   ok([price.amount_yen,price.plan_key],[amount,key]);
   await db.exec('rollback to savepoint renewal_case');
  }
 } finally {await db.exec('rollback');}
 ok((await query(`select count(*)::int n from platform_billing_private.subscriptions`)).n,0);
 ok((await svc(`select public.academy_first_publication_outbox_dispatch_check('fixture-paid','${job.lease_token}') as r`)).r.allowed,false);
 console.log(`PASS variable pricing: ${passed} checks; ordered synthetic PGlite replay only; production ingress gate retained.`);
} finally {await db.close();}
