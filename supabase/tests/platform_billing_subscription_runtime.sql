-- Synthetic isolated Postgres only. Caller owns BEGIN/ROLLBACK.
-- Apply checkout, creation, verified-event, then subscription-runtime migrations.
create function pg_temp.sub_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'subscription assertion failed: %',label;end if;end$$;
create function pg_temp.sub_denied(statement text,code text,message text default null)returns void language plpgsql as $$
declare actual_code text;actual_message text;begin begin execute statement;exception when others then get stacked diagnostics actual_code=returned_sqlstate,actual_message=message_text;end;
if actual_code is distinct from code or(message is not null and actual_message is distinct from message)then raise exception 'expected % / %, got % / %',code,message,actual_code,actual_message;end if;end$$;
create function pg_temp.sub_quote(actor uuid,qid text,request_id uuid,amount bigint default 5000)returns jsonb language sql as $$select jsonb_build_object(
'quoteId',qid,'revision',1,'purchaseIntent','explicit_paid_start','scope',jsonb_build_object('ownerUserId',actor::text,'productKey','academy_platform','resourceId',null,'planKey','small','requestId',request_id::text),'currency','JPY','taxIncluded',true,
'dueNow',jsonb_build_object('totalYen',amount,'dueOn',to_char(clock_timestamp()at time zone'Asia/Tokyo','YYYY-MM-DD')),'nextPayment',jsonb_build_object('totalYen',amount,'dueOn',to_char((clock_timestamp()at time zone'Asia/Tokyo')+interval'1 month','YYYY-MM-DD')),
'merchant',jsonb_build_object('merchantId','fixture','legalName','Fixture','address','Fixture','contactUrl','https://example.invalid/contact'),
'policies',jsonb_build_object('approved',true,'approvalId','fixture-approval','revision',1)||(select jsonb_object_agg(key,jsonb_build_object('version','fixture-v1','url','https://example.invalid/policy'))from unnest(array['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure'])key),
'issuedAt',to_char((clock_timestamp()-interval'1 minute')at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'expiresAt',to_char((clock_timestamp()+interval'1 hour')at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))$$;

insert into auth.users(id,is_anonymous)values
('a9040000-0000-4000-8000-000000000001',false),('a9040000-0000-4000-8000-000000000002',false),('a9040000-0000-4000-8000-000000000003',true);
do $test$ declare n text;r text;f regprocedure;begin
foreach n in array array['subscriptions','subscription_events']loop
 perform pg_temp.sub_assert((select relrowsecurity from pg_class where oid=('platform_billing_private.'||n)::regclass),'RLS '||n);
 foreach r in array array['anon','authenticated','service_role']loop perform pg_temp.sub_assert(not has_table_privilege(r,'platform_billing_private.'||n,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'private '||r||n);end loop;
end loop;
foreach f in array array['public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz)'::regprocedure,'public.platform_billing_subscription_event_apply(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)'::regprocedure,'public.platform_billing_status_get(uuid,text,uuid)'::regprocedure,'public.platform_billing_portal_context(uuid,text,uuid)'::regprocedure,'public.platform_billing_academy_paid_activation_verify_and_consume(uuid,uuid)'::regprocedure]loop
 perform pg_temp.sub_assert(not has_function_privilege('anon',f,'execute')and not has_function_privilege('authenticated',f,'execute')and has_function_privilege('service_role',f,'execute'),'service RPC');
end loop;end $test$;
select pg_temp.sub_assert(pg_get_functiondef('public.platform_billing_attempt_mark_ready(uuid,uuid,text,text)'::regprocedure) like '%^cs_(test|live)_[A-Za-z0-9]+$%','live checkout session accepted by function');
set local role anon;
select pg_temp.sub_denied($q$select public.platform_billing_status_get('a9040000-0000-4000-8000-000000000001','academy_platform',null)$q$,'42501');
reset role;set local role authenticated;
select pg_temp.sub_denied($q$select public.platform_billing_portal_context('a9040000-0000-4000-8000-000000000001','academy_platform',gen_random_uuid())$q$,'42501');
reset role;set local role service_role;
select pg_temp.sub_denied($q$select*from platform_billing_private.subscriptions$q$,'42501');
select pg_temp.sub_denied($q$truncate platform_billing_private.subscription_events$q$,'42501');
select pg_temp.sub_denied($q$select public.platform_billing_status_get('a9040000-0000-4000-8000-000000000003','academy_platform',null)$q$,'42501','PLATFORM_BILLING_FORBIDDEN');
select public.platform_billing_quote_save('a9040000-0000-4000-8000-000000000001',pg_temp.sub_quote('a9040000-0000-4000-8000-000000000001','sub-main','b9040000-0000-4000-8000-000000000001'));
select set_config('test.sub_attempt',public.platform_billing_attempt_reserve('a9040000-0000-4000-8000-000000000001','sub-main','{"quoteId":"sub-main","revision":1,"termsVersion":"fixture-v1","accepted":true}')::text,true);
select public.platform_billing_attempt_mark_ready('a9040000-0000-4000-8000-000000000001',(current_setting('test.sub_attempt')::jsonb->>'attempt_id')::uuid,'cs_live_Fixture',repeat('a',64));
select set_config('test.sub_paid_at',statement_timestamp()::text,true);
select pg_temp.sub_denied(format($q$select public.platform_billing_verified_subscription_activate(%L::uuid,'evt_LiveFixture',repeat('b',64),'cs_live_Fixture','cus_Fixture','sub_Fixture',4999,'jpy',%L::timestamptz)$q$,(current_setting('test.sub_attempt')::jsonb->>'attempt_id'),current_setting('test.sub_paid_at')),'42501','PLATFORM_BILLING_VERIFIED_EVENT_SCOPE_MISMATCH');
select set_config('test.sub_result',public.platform_billing_verified_subscription_activate((current_setting('test.sub_attempt')::jsonb->>'attempt_id')::uuid,'evt_LiveFixture',repeat('b',64),'cs_live_Fixture','cus_Fixture','sub_Fixture',5000,'jpy',current_setting('test.sub_paid_at')::timestamptz)::text,true);
select pg_temp.sub_assert(current_setting('test.sub_result')::jsonb@>'{"eventStatus":"verified","subscriptionStatus":"active","productKey":"academy_platform","planKey":"small"}','activation result');
select pg_temp.sub_assert(not(current_setting('test.sub_result')::jsonb?|array['providerCustomerId','providerSubscriptionId','providerEventId','providerEventHash']),'provider ids not returned');
select pg_temp.sub_assert(public.platform_billing_verified_subscription_activate((current_setting('test.sub_attempt')::jsonb->>'attempt_id')::uuid,'evt_LiveFixture',repeat('b',64),'cs_live_Fixture','cus_Fixture','sub_Fixture',5000,'jpy',current_setting('test.sub_paid_at')::timestamptz)->>'subscriptionStatus'='active','activation replay');
select pg_temp.sub_denied(format($q$select public.platform_billing_verified_subscription_activate(%L::uuid,'evt_LiveFixture',repeat('c',64),'cs_live_Fixture','cus_Fixture','sub_Fixture',5000,'jpy',%L::timestamptz)$q$,(current_setting('test.sub_attempt')::jsonb->>'attempt_id'),current_setting('test.sub_paid_at')),'23505','PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT');
select pg_temp.sub_assert(public.platform_billing_status_get('a9040000-0000-4000-8000-000000000001','academy_platform',null)#>>'{subscription,state}'='active','active status');
select pg_temp.sub_assert(public.platform_billing_academy_paid_activation_verify_and_consume('a9040000-0000-4000-8000-000000000001','a9040000-0000-4000-8000-000000000099')->>'verified'='true','Academy paid verifier');
select pg_temp.sub_assert(public.platform_billing_status_get('a9040000-0000-4000-8000-000000000001','academy_platform','a9040000-0000-4000-8000-000000000099')#>>'{subscription,state}'='active','resource-bound status');
select pg_temp.sub_assert(public.platform_billing_portal_context('a9040000-0000-4000-8000-000000000001','academy_platform','a9040000-0000-4000-8000-000000000099')->>'providerCustomerId'='cus_Fixture','service-only portal context');
reset role;
select set_config('test.period_start',(select current_period_end::text from platform_billing_private.subscriptions),true);
select set_config('test.period_end',(select platform_billing_private.next_anchored_month(original_paid_at,current_period_end)::text from platform_billing_private.subscriptions),true);
select set_config('test.event_occurred',statement_timestamp()::text,true);
set local role service_role;
select pg_temp.sub_assert(public.platform_billing_subscription_event_apply('sub_Fixture','evt_Renewal',repeat('d',64),'invoice_paid','active',current_setting('test.period_start')::timestamptz,current_setting('test.period_end')::timestamptz,null,current_setting('test.event_occurred')::timestamptz)->>'eventStatus'='applied','renewal applied');
select pg_temp.sub_assert(public.platform_billing_subscription_event_apply('sub_Fixture','evt_Renewal',repeat('d',64),'invoice_paid','active',current_setting('test.period_start')::timestamptz,current_setting('test.period_end')::timestamptz,null,current_setting('test.event_occurred')::timestamptz)->>'eventStatus'='already_applied','renewal replay');
select pg_temp.sub_denied(format($q$select public.platform_billing_subscription_event_apply('sub_Fixture','evt_Renewal',repeat('e',64),'invoice_paid','active',%L::timestamptz,%L::timestamptz,null,%L::timestamptz)$q$,current_setting('test.period_start'),current_setting('test.period_end'),current_setting('test.event_occurred')),'23505','PLATFORM_BILLING_SUBSCRIPTION_EVENT_CONFLICT');
select pg_temp.sub_assert(public.platform_billing_subscription_event_apply('sub_Fixture','evt_Failed',repeat('f',64),'invoice_failed','past_due',current_setting('test.period_start')::timestamptz,current_setting('test.period_end')::timestamptz,null,(current_setting('test.event_occurred')::timestamptz+interval'2 seconds'))->>'eventStatus'='applied','failure applied');
select pg_temp.sub_assert(public.platform_billing_subscription_event_apply('sub_Fixture','evt_Stale',repeat('1',64),'subscription_state','active',current_setting('test.period_start')::timestamptz,current_setting('test.period_end')::timestamptz,false,(current_setting('test.event_occurred')::timestamptz+interval'1 second'))->>'eventStatus'='stale_ignored','out of order event ignored');
reset role;
select pg_temp.sub_assert((select status='past_due' from platform_billing_private.subscriptions),'stale event cannot reactivate');
select pg_temp.sub_assert((select count(*)=1 from platform_billing_private.subscriptions),'one subscription');
select pg_temp.sub_assert((select count(*)=3 from platform_billing_private.subscription_events),'renewal failure and stale events recorded');
select pg_temp.sub_denied($q$update platform_billing_private.subscriptions set actor_user_id='a9040000-0000-4000-8000-000000000002'$q$,'42501','PLATFORM_BILLING_SUBSCRIPTION_IMMUTABLE');
select pg_temp.sub_denied($q$delete from platform_billing_private.subscription_events$q$,'42501','PLATFORM_BILLING_SUBSCRIPTION_IMMUTABLE');
select 'platform_billing_subscription_runtime_test_ok' as result;
