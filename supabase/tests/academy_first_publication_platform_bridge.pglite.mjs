import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.ACADEMY_PGLITE_PATH??'G:/Musubiプロジェクト/.local-tools/academy-db-validation/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite(); let passed=0;
const root=new URL('../migrations/',import.meta.url);
const a='10000000-0000-4000-8000-000000000001',h='20000000-0000-4000-8000-000000000001',q='30000000-0000-4000-8000-000000000001',lease='40000000-0000-4000-8000-000000000001';
const json=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
const query=async sql=>(await db.query(sql)).rows[0];
const svc=async sql=>{await db.exec('set role service_role');try{return await query(sql);}finally{await db.exec('reset role');}};
const ok=(value,expected)=>{assert.deepEqual(value,expected);passed++;};
const deny=async(code,fn)=>{await assert.rejects(fn,new RegExp(code));passed++;};
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
 create table auth.users(id uuid primary key,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select current_setting('role',true)$$;
 create table public.profiles(id uuid primary key,user_id uuid,handle text);
 create table public.academy_headquarters(id uuid primary key,owner_user_id uuid references auth.users,owner_profile_id uuid,name text,handle text,plan text,is_active boolean default false);
 create table public.academy_courses(id uuid primary key,headquarters_id uuid references public.academy_headquarters,user_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),is_published boolean default false,title text);
 create table public.academy_trial_usage_ledger(owner_user_id uuid primary key);
 create table public.academy_headquarters_access_states(owner_user_id uuid,headquarters_id uuid,access_kind text,status text,trial_ends_at timestamptz);
 create table public.academy_instructors(profile_id uuid,headquarters_id uuid,created_at timestamptz default now(),withdrawn_at timestamptz);
 create function private.academy_has_headquarters_creation_entitlement(uuid) returns boolean language sql as $$select false$$;
 create function private.academy_headquarters_access_mode(uuid) returns text language sql as $$select 'blocked'::text$$;
 create function private.academy_owner_read_allowed(uuid,timestamptz) returns boolean language sql as $$select true$$;
 create function private.academy_headquarters_role(uuid,uuid) returns text language sql as $$select 'owner'::text from public.academy_headquarters where id=$1 and owner_user_id=$2$$;
 create function public.academy_get_my_headquarters_access(uuid) returns table(headquarters_id uuid,access_kind text,status text,starts_at timestamptz,ends_at timestamptz,days_remaining integer,can_manage_drafts boolean,can_use_live_features boolean) language sql as $$select $1,'trial'::text,'expired'::text,null::timestamptz,null::timestamptz,0,false,false$$;
 `);
 // Fresh database replay follows migration timestamps, never cherry-pick order.
 const migrations=['20260825161200_academy_month_end_billing_snapshots.sql','20260831180143_platform_billing_checkout_ledger.sql','20260901124412_platform_billing_creation_entitlements.sql','20260902171944_platform_billing_verified_provider_events.sql','20260902223651_platform_billing_subscription_runtime.sql','20260903161500_platform_billing_resource_access_window.sql','20260903201500_platform_billing_subscription_recontract_selection.sql','20260903203000_platform_retention_recontract_workers.sql','20260903204500_platform_billing_customer_recontract_activation.sql','20260908070613_academy_first_publication_atomic.sql','20260908084409_academy_first_publication_runtime.sql','20260908090249_academy_first_publication_platform_bridge.sql','20260908091030_academy_first_publication_course_delegation.sql'].sort();
 assert(migrations.indexOf('20260908090249_academy_first_publication_platform_bridge.sql')<migrations.indexOf('20260908091030_academy_first_publication_course_delegation.sql'));
 for(const name of migrations) {
  try {await db.exec(await readFile(new URL(name,root),'utf8'));} catch(error) {throw Object.assign(error,{message:`${name}: ${error.message}`});}
 }
 passed++;
 await db.exec('begin');
 try {await db.exec(await readFile(new URL('./platform_billing_subscription_runtime.sql',import.meta.url),'utf8'));passed++;} finally {await db.exec('rollback');}
 await db.exec(`insert into auth.users values('${a}',false);insert into public.academy_headquarters(id,owner_user_id) values('${h}','${a}');
 insert into academy_publication_private.policies(version,approval_id,terms_revision,quote_ttl_seconds,enabled,initial_price,cancellation,eligibility,pricing_revision) values('fixture','approval','terms',1800,true,'fixed_at_publication','inclusive_deadline','no_previous_trial_or_contract','v1');
 insert into academy_publication_private.quotes(id,headquarters_id,owner_user_id,policy_version,terms_revision,amount_yen,instructor_count,issued_at,expires_at,payment_preparation_id,payment_verified) values('${q}','${h}','${a}','fixture','terms',5000,0,now()-interval '9 days',now()-interval '8 days','fixture',true);
 insert into academy_publication_private.enrollments(headquarters_id,owner_user_id,policy_version,approval_id,terms_revision,quote_id,amount_yen,instructor_count,consent_at,payment_preparation_id,phase,first_published_at,trial_ends_at) values('${h}','${a}','fixture','approval','terms','${q}',5000,0,now()-interval '9 days','fixture','trialing',now()-interval '8 days',now()-interval '1 day');
 insert into academy_publication_private.setup_attempts(owner_user_id,headquarters_id,quote_id,provider_customer_id,status) values('${a}','${h}','${q}','cus_fixture','verified');
 insert into academy_publication_private.outbox(event_key,headquarters_id,kind,payload,lease_token,lease_until) values('fixture-paid','${h}','start_paid','{}','${lease}',now()+interval '1 hour');
 insert into academy_publication_private.provider_steps(event_key,step,operation_key,provider_id) values('fixture-paid','invoice_create','fixture-invoice','in_fixture'),('fixture-paid','subscription_create','fixture-sub','sub_fixture'),('fixture-paid','subscription_hold','fixture-hold','sub_fixture');`);
 const times=await query(`select now()-interval '1 hour' as paid,platform_billing_private.next_month_at(now()-interval '1 hour') as ends`);
 times.paid=new Date(times.paid).toISOString(); times.ends=new Date(times.ends).toISOString();
 const result={outcome:'paid',provider_invoice_id:'in_fixture',provider_subscription_id:'sub_fixture',provider_customer_id:'cus_fixture',amount_yen:5000,plan_key:'small',paid_at:times.paid,period_end:times.ends,provider_result_hash:'a'.repeat(64)};
 const bridge=v=>`select public.academy_first_publication_paid_bridge('fixture-paid','${lease}',${json(v)}) as result`;
 await deny('dispatch_blocked',()=>svc(bridge(result)));
 ok((await query('select count(*)::int n from platform_billing_private.subscriptions')).n,0);
 await db.exec('update academy_publication_private.policies set dispatch_enabled=true'); // fixture only
 await deny('dispatch_blocked',()=>svc(bridge(result))); // verified ingress watermark remains mandatory
 await db.exec(`insert into academy_publication_private.verified_receipt_watermarks select headquarters_id,trial_ends_at,'fixture-only',1,1,1,now() from academy_publication_private.enrollments`);
 await deny('invalid_proof',()=>svc(bridge({...result,provider_customer_id:null})));
 await deny('invalid_proof',()=>svc(bridge({...result,amount_yen:10000})));
 await deny('provider_binding_mismatch',()=>svc(bridge({...result,provider_invoice_id:'in_other'})));
 await db.exec(`insert into academy_publication_private.cancel_intents(headquarters_id,owner_user_id,received_at) select '${h}','${a}',trial_ends_at from academy_publication_private.enrollments`);
 await deny('dispatch_blocked',()=>svc(bridge(result)));
 await db.exec('delete from academy_publication_private.cancel_intents');
 // Verify failure in existing finish rolls back both new ledgers.
 await db.exec(`create function private.fixture_finish_fail() returns trigger language plpgsql as $$begin raise exception 'fixture_finish_fail';end$$;create trigger fixture_finish_fail before insert on academy_publication_private.paid_windows for each row execute function private.fixture_finish_fail()`);
 await deny('fixture_finish_fail',()=>svc(bridge(result)));
 ok((await query('select count(*)::int n from academy_publication_private.first_invoice_proofs')).n,0);
 await db.exec('drop trigger fixture_finish_fail on academy_publication_private.paid_windows');
 ok((await svc(bridge(result))).result.status,'finished');
 ok((await svc(bridge(result))).result.status,'already_finished');
 await deny('proof_conflict',()=>svc(bridge({...result,provider_result_hash:'b'.repeat(64)})));
 ok((await query('select count(*)::int n from platform_billing_private.attempts')).n,0);
 ok((await query('select count(*)::int n from platform_billing_private.verified_provider_events')).n,0);
 ok((await query('select count(*)::int n from platform_billing_private.creation_entitlements')).n,0);
 ok((await svc(`select public.academy_first_publication_subscription_context('sub_unknown') as r`)).r.kind,'unknown');
 ok((await svc(`select public.academy_first_publication_invoice_context('in_fixture') as r`)).r.invoice_kind,'first_payment');
 ok((await query(`select private.academy_first_publication_access('${h}') as r`)).r.phase,'paid');
 ok((await svc(`select public.platform_billing_portal_context('${a}','academy_platform','${h}') as r`)).r.providerSubscriptionId,'sub_fixture');
 ok((await svc(`select public.platform_billing_status_get('${a}','academy_platform','${h}') as r`)).r.subscription.state,'active');
 await db.exec('set role authenticated');
 await deny('permission denied',()=>query(`select public.academy_first_publication_subscription_context('sub_fixture')`));
 await deny('permission denied',()=>query('select * from academy_publication_private.first_invoice_proofs'));
 await db.exec('reset role');
 await deny('IMMUTABLE',()=>db.exec('delete from academy_publication_private.first_invoice_proofs'));
 await deny('origin_exclusive',()=>db.exec(`insert into platform_billing_private.subscriptions(actor_user_id,product_key,plan_key,provider_customer_id,provider_subscription_id,initial_amount_yen,currency,status,original_paid_at,current_period_start,current_period_end) values('${a}','academy_platform','small','cus_bad','sub_bad',5000,'jpy','active',now(),now(),now()+interval '1 month')`));
 await deny('snapshot_missing',()=>svc(`select public.academy_first_publication_renewal_quote('sub_fixture','${times.ends}')`));
 await db.exec(`insert into public.academy_monthly_billing_snapshots(headquarters_id,snapshot_month,cutoff_at,captured_at,registered_instructor_count,billable_profile_ids,catalog_price_yen,charge_month,charge_price_yen,price_notice_required) values('${h}',date_trunc('month','${times.ends}'::timestamptz at time zone 'Asia/Tokyo')::date-interval '1 month',now(),now(),0,'{}',10000,date_trunc('month','${times.ends}'::timestamptz at time zone 'Asia/Tokyo')::date,5000,true)`);
 const price=(await svc(`select public.academy_first_publication_renewal_quote('sub_fixture','${times.ends}') as r`)).r;
 ok(price.amount_yen,5000); // announced charge, not current catalog 10000
 ok((await svc(`select public.academy_first_publication_renewal_quote('sub_fixture','${times.ends}') as r`)).r.price_id,price.price_id);
 await db.exec('update academy_publication_private.policies set dispatch_enabled=false');
 ok((await svc(`select public.academy_first_publication_renewal_claim('fixture',60) as r`)).r,null);
 await db.exec('update academy_publication_private.policies set dispatch_enabled=true');
 const job=(await svc(`select public.academy_first_publication_renewal_claim('fixture',60) as r`)).r;
 ok(job.kind,'renew_price');
 const cp=async(step,id=null)=>svc(`select public.academy_first_publication_renewal_checkpoint('${job.event_key}','${job.lease_token}','${step}',${id===null?'null':`'${id}'`}) as r`);
 await deny('invalid_step',()=>cp('pay'));
 ok((await cp('price_update')).r.provider_id,null);
 await deny('invalid_provider_id',()=>cp('price_update','sub_other'));
 ok((await cp('price_update','sub_fixture')).r.provider_id,'sub_fixture');
 const pf={outcome:'price_ready',price_id:price.price_id};
 ok((await svc(`select public.academy_first_publication_renewal_finish('${job.event_key}','${job.lease_token}',${json(pf)}) as r`)).r.status,'finished');
 ok((await svc(`select public.academy_first_publication_renewal_finish('${job.event_key}','${job.lease_token}',${json(pf)}) as r`)).r.status,'already_finished');
 ok((await svc(`select public.academy_first_publication_renewal_claim('fixture',60) as r`)).r,null); // payment not due
 const event={provider_event_id:'evt_renewal',provider_result_hash:'b'.repeat(64),provider_customer_id:'cus_fixture',event_kind:'invoice_paid',projected_status:'active',period_start:price.period_start,period_end:price.period_end,cancel_at_period_end:null,occurred_at:new Date().toISOString(),provider_invoice_id:'in_renewal',amount_yen:5000,currency:'jpy'};
 const apply=v=>svc(`select public.academy_first_publication_subscription_event('sub_fixture',${json(v)}) as r`);
 await deny('not_renewal_invoice',()=>apply({...event,provider_invoice_id:'in_fixture'}));
 await deny('renewal_price_mismatch',()=>apply({...event,amount_yen:0}));
 ok((await apply(event)).r.eventStatus,'applied');
 ok((await apply(event)).r.eventStatus,'already_applied');
 ok((await query(`select private.academy_first_publication_access('${h}') as r`)).r.endsAt,price.period_end);
 const payJob=job.event_key.replace('academy-renew-price:','academy-renew-pay:');
 ok((await svc(`select public.academy_first_publication_renewal_finish('${payJob}','${lease}',${json({outcome:'paid',provider_invoice_id:'in_renewal',amount_yen:5000,period_start:price.period_start,period_end:price.period_end,paid_at:new Date().toISOString()})}) as r`)).r.status,'already_finished');
 const state={...event,event_kind:'subscription_state',provider_invoice_id:null,amount_yen:null,currency:null,cancel_at_period_end:true,period_start:price.period_start,period_end:price.period_end};
 const later=new Date(Date.parse(event.occurred_at)+1000).toISOString();
 ok((await apply({...state,provider_event_id:'evt_cancel',provider_result_hash:'c'.repeat(64),occurred_at:later})).r.eventStatus,'applied');
 ok((await svc(`select public.platform_billing_status_get('${a}','academy_platform','${h}') as r`)).r.subscription.cancelAtPeriodEnd,true);
 ok((await apply({...state,provider_event_id:'evt_stale',provider_result_hash:'d'.repeat(64),cancel_at_period_end:false,occurred_at:event.occurred_at})).r.eventStatus,'stale_ignored');
 ok((await apply({...state,provider_event_id:'evt_ended',provider_result_hash:'e'.repeat(64),projected_status:'ended',occurred_at:new Date(Date.parse(later)+1000).toISOString()})).r.subscriptionStatus,'ended');
 ok((await query(`select private.academy_owner_read_allowed('${h}','${price.period_end}'::timestamptz+interval '89 days') as r`)).r,true);
 ok((await query(`select private.academy_owner_read_allowed('${h}','${price.period_end}'::timestamptz+interval '90 days') as r`)).r,false);
 ok((await query(`select private.academy_first_publication_access('${h}') as r`)).r.active,false);
 const cutoff=await query(`select (date_trunc('month',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo') as at`);
 await db.exec(`update academy_publication_private.enrollments set first_published_at='${new Date(cutoff.at).toISOString()}'::timestamptz-interval '1 day',trial_ends_at='${new Date(cutoff.at).toISOString()}'::timestamptz+interval '6 days'`);
 const capture=(await svc('select public.academy_first_publication_capture_due_snapshots(50) as r')).r;
 ok(capture.captured,1);
 ok((await svc('select public.academy_first_publication_capture_due_snapshots(50) as r')).r.captured,0);
 ok((await query(`select charge_price_yen as n from public.academy_monthly_billing_snapshots where snapshot_month='${capture.snapshot_month}' and headquarters_id='${h}'`)).n,5000);
 await deny('invalid_limit',()=>svc('select public.academy_first_publication_capture_due_snapshots(101)'));
 console.log(JSON.stringify({passed,migrationOrder:migrations,engine:'PGlite real billing migrations + synthetic Academy dependencies',activation:false,notValidated:['real Auth/provider','full production schema','multi-connection cancellation race','production retention mutations']}));
} catch(error) {console.error(JSON.stringify({error:error.message,code:error.code,where:error.where,position:error.position}));process.exitCode=1;} finally {await db.close();}
