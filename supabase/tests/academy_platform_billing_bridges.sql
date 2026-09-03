-- Synthetic isolated Postgres only. Caller owns BEGIN/ROLLBACK.
-- Apply the common checkout/creation/verified/subscription migrations and all
-- Academy migrations through 20260902231854 before this test.

create function pg_temp.academy_bridge_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'academy bridge assertion failed: %', label; end if;
end $$;

create function pg_temp.academy_bridge_denied(statement text, code text, message text default null)
returns void language plpgsql as $$
declare actual_code text; actual_message text;
begin
  begin execute statement; exception when others then
    get stacked diagnostics actual_code=returned_sqlstate,actual_message=message_text;
  end;
  if actual_code is distinct from code or (message is not null and actual_message is distinct from message) then
    raise exception 'expected % / %, got % / %',code,message,actual_code,actual_message;
  end if;
end $$;

create function pg_temp.academy_bridge_quote(actor uuid,qid text,request_id uuid)
returns jsonb language sql as $$select jsonb_build_object(
  'quoteId',qid,'revision',1,'purchaseIntent','explicit_paid_start',
  'scope',jsonb_build_object('ownerUserId',actor::text,'productKey','academy_platform','resourceId',null,'planKey','small','requestId',request_id::text),
  'currency','JPY','taxIncluded',true,
  'dueNow',jsonb_build_object('totalYen',5000,'dueOn',to_char(clock_timestamp()at time zone'Asia/Tokyo','YYYY-MM-DD')),
  'nextPayment',jsonb_build_object('totalYen',5000,'dueOn',to_char((clock_timestamp()at time zone'Asia/Tokyo')+interval'1 month','YYYY-MM-DD')),
  'merchant',jsonb_build_object('merchantId','fixture','legalName','Fixture','address','Fixture','contactUrl','https://example.invalid/contact'),
  'policies',jsonb_build_object('approved',true,'approvalId','fixture-approval','revision',1)||(select jsonb_object_agg(key,jsonb_build_object('version','fixture-v1','url','https://example.invalid/policy'))from unnest(array['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure'])key),
  'issuedAt',to_char((clock_timestamp()-interval'1 minute')at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'expiresAt',to_char((clock_timestamp()+interval'1 hour')at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)$$;

create function pg_temp.academy_bridge_prepare_subscription(actor uuid,qid text,request_id uuid,session_id text,event_id text,customer_id text,subscription_id text)
returns void language plpgsql as $$
declare attempt_id uuid; paid_at timestamptz:=statement_timestamp();
begin
  perform public.platform_billing_quote_save(actor,pg_temp.academy_bridge_quote(actor,qid,request_id));
  attempt_id:=(public.platform_billing_attempt_reserve(actor,qid,jsonb_build_object('quoteId',qid,'revision',1,'termsVersion','fixture-v1','accepted',true))->>'attempt_id')::uuid;
  perform public.platform_billing_attempt_mark_ready(actor,attempt_id,session_id,repeat('a',64));
  perform public.platform_billing_verified_subscription_activate(
    attempt_id,
    event_id,
    md5(event_id) || md5('academy:' || event_id),
    session_id,
    customer_id,
    subscription_id,
    5000,
    'jpy',
    paid_at
  );
end $$;

insert into auth.users(id,is_anonymous) values
 ('ab040000-0000-4000-8000-000000000001',false),
 ('ab040000-0000-4000-8000-000000000002',false),
 ('ab040000-0000-4000-8000-000000000003',true),
 ('ab040000-0000-4000-8000-000000000004',false);
insert into public.profiles(id,user_id,display_name,handle,member_number) values
 ('bb040000-0000-4000-8000-000000000001','ab040000-0000-4000-8000-000000000001','Paid Owner','paid_owner',998040001),
 ('bb040000-0000-4000-8000-000000000002','ab040000-0000-4000-8000-000000000002','Trial Owner','trial_owner',998040002),
 ('bb040000-0000-4000-8000-000000000003','ab040000-0000-4000-8000-000000000003','Anonymous Owner','anonymous_owner',998040003),
 ('bb040000-0000-4000-8000-000000000004','ab040000-0000-4000-8000-000000000004','Legacy Owner','legacy_owner',998040004);

select pg_temp.academy_bridge_assert(
  not has_function_privilege('authenticated','public.academy_create_headquarters(text)','execute'),
  'legacy browser create revoked');
select pg_temp.academy_bridge_assert(
  not has_function_privilege('authenticated','public.academy_create_headquarters_with_platform_entitlement(uuid,text)','execute')
  and has_function_privilege('service_role','public.academy_create_headquarters_with_platform_entitlement(uuid,text)','execute'),
  'guarded create is service only');
select pg_temp.academy_bridge_assert(
  not has_function_privilege('authenticated','public.academy_activate_paid_access_from_platform_subscription(uuid)','execute')
  and has_function_privilege('service_role','public.academy_activate_paid_access_from_platform_subscription(uuid)','execute'),
  'paid bridge is service only');
select pg_temp.academy_bridge_assert(
  not has_function_privilege('authenticated','public.platform_billing_academy_new_paid_consume(uuid,uuid)','execute')
  and has_function_privilege('service_role','public.platform_billing_academy_new_paid_consume(uuid,uuid)','execute')
  and not has_function_privilege('authenticated','public.platform_billing_academy_existing_paid_consume(uuid,uuid)','execute')
  and has_function_privilege('service_role','public.platform_billing_academy_existing_paid_consume(uuid,uuid)','execute'),
  'split platform verifiers are service only');
select pg_temp.academy_bridge_assert(
  to_regprocedure('public.platform_billing_academy_paid_activation_verify_and_consume(uuid,uuid)') is null
  and to_regprocedure('public.platform_billing_academy_new_paid_activation_verify_and_consume(uuid,uuid)') is null
  and to_regprocedure('public.platform_billing_academy_existing_paid_activation_verify_and_consume(uuid,uuid)') is null,
  'obsolete verifier signatures are absent');

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"ab040000-0000-4000-8000-000000000004"}',true);
select pg_temp.academy_bridge_denied($q$select public.academy_create_headquarters('Legacy Bypass')$q$,'42501');
select pg_temp.academy_bridge_denied($q$select public.academy_create_headquarters_with_platform_entitlement('ab040000-0000-4000-8000-000000000004','Browser Bypass')$q$,'42501');
reset role;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.academy_bridge_prepare_subscription('ab040000-0000-4000-8000-000000000001','academy-create','cb040000-0000-4000-8000-000000000001','cs_live_AcademyCreate','evt_AcademyCreate','cus_AcademyCreate','sub_AcademyCreate');
select public.academy_create_headquarters_with_platform_entitlement('ab040000-0000-4000-8000-000000000001','Paid Academy');
select pg_temp.academy_bridge_assert((select count(*)=1 from public.academy_headquarters where owner_user_id='ab040000-0000-4000-8000-000000000001'),'one paid HQ');
select pg_temp.academy_bridge_assert((select access_kind='paid' and status='active' from public.academy_headquarters_access_states where owner_user_id='ab040000-0000-4000-8000-000000000001'),'paid access created');
reset role;
select pg_temp.academy_bridge_assert((select status='consumed' and resource_id=(select id from public.academy_headquarters where owner_user_id='ab040000-0000-4000-8000-000000000001') from platform_billing_private.creation_entitlements where actor_user_id='ab040000-0000-4000-8000-000000000001'),'common entitlement consumed once');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.academy_bridge_denied($q$select public.academy_create_headquarters_with_platform_entitlement('ab040000-0000-4000-8000-000000000001','Second Academy')$q$,'P0002','PLATFORM_BILLING_NOT_FOUND');

insert into public.academy_trial_invitations(owner_user_id,invitation_reference,valid_until)
values('ab040000-0000-4000-8000-000000000002','academy-bridge-trial',now()+interval'1 day');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"ab040000-0000-4000-8000-000000000002"}',true);
select public.academy_start_seven_day_trial('Trial Academy','academy-pilot-2026-08-30');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.academy_bridge_prepare_subscription('ab040000-0000-4000-8000-000000000002','academy-upgrade','cb040000-0000-4000-8000-000000000002','cs_live_AcademyUpgrade','evt_AcademyUpgrade','cus_AcademyUpgrade','sub_AcademyUpgrade');
select public.academy_activate_paid_access_from_platform_subscription((select id from public.academy_headquarters where owner_user_id='ab040000-0000-4000-8000-000000000002'));
select public.academy_activate_paid_access_from_platform_subscription((select id from public.academy_headquarters where owner_user_id='ab040000-0000-4000-8000-000000000002'));
reset role;

select pg_temp.academy_bridge_assert((select access_kind='paid' and status='active' from public.academy_headquarters_access_states where owner_user_id='ab040000-0000-4000-8000-000000000002'),'trial upgraded');
select pg_temp.academy_bridge_assert((select count(*)=1 from public.academy_paid_access_transition_ledger where owner_user_id='ab040000-0000-4000-8000-000000000002'),'upgrade transition exactly once');

select 'academy_platform_billing_bridges_test_ok' as result;
