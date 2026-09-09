-- Caller owns BEGIN/ROLLBACK. Synthetic SQL roles, not hosted Auth E2E.
create function pg_temp.check_trial(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'trial assertion failed: %', label; end if; end $$;
create function pg_temp.deny_trial(sql text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute sql; exception when others then get stacked diagnostics actual = returned_sqlstate; end;
  if actual is distinct from expected then raise exception 'expected %, got %: %',expected,actual,sql; end if;
end $$;
insert into auth.users(id,is_anonymous) values
 ('a9090000-0000-4000-8000-000000000001',false),
 ('a9090000-0000-4000-8000-000000000002',false),
 ('a9090000-0000-4000-8000-000000000003',false),
 ('a9090000-0000-4000-8000-000000000004',true),
 ('a9090000-0000-4000-8000-000000000005',false);

select pg_temp.check_trial(not exists(select 1 from pg_indexes where indexname='platform_billing_creation_one_lifetime_trial_idx'), 'lifetime limit removed');
select pg_temp.check_trial(exists(select 1 from pg_indexes where indexname='platform_billing_creation_one_available_idx'), 'one available entitlement invariant retained');
select pg_temp.check_trial((select relrowsecurity from pg_class where oid='platform_billing_private.community_trial_requests'::regclass), 'request ledger RLS');
select pg_temp.check_trial(not has_table_privilege('service_role','platform_billing_private.community_trial_requests','INSERT'), 'service role has no direct ledger writes');
select pg_temp.check_trial(not has_function_privilege('authenticated','public.platform_billing_community_trial_start(uuid,uuid)','EXECUTE'), 'browser role cannot forge actor');
select pg_temp.check_trial(not has_function_privilege('service_role','public.platform_billing_status_before_community_per_resource(uuid,text,uuid)','EXECUTE'), 'previous projection is not a second endpoint');

set local role service_role;
select pg_temp.check_trial(public.platform_billing_status_get('a9090000-0000-4000-8000-000000000001','community_platform',null)->'allowedActions' ? 'start_trial', 'first trial offered');
select pg_temp.deny_trial($q$select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000004','b9090000-0000-4000-8000-000000000001')$q$,'42501');
select pg_temp.deny_trial($q$select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000099','b9090000-0000-4000-8000-000000000001')$q$,'42501');
select pg_temp.deny_trial($q$select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000001',null)$q$,'22023');
reset role;
create temp table trial_results(label text primary key, payload jsonb);
grant all on trial_results to service_role;
set local role service_role;
insert into trial_results values ('first',public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000001','b9090000-0000-4000-8000-000000000001'));
insert into trial_results values ('retry',public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000001','b9090000-0000-4000-8000-000000000001'));
insert into trial_results values ('alias',public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000001','b9090000-0000-4000-8000-000000000002'));
select pg_temp.check_trial((select count(distinct payload)=1 from trial_results), 'same and different requests reuse exact pending period');
select pg_temp.check_trial((select (payload->>'endsAt')::timestamptz-(payload->>'startsAt')::timestamptz=interval '30 days' from trial_results where label='first'), 'exact 30 days');
select pg_temp.check_trial((select payload @> '{"automaticBilling":false,"creation":{"state":"available"}}' and (select count(*) from jsonb_object_keys(payload))=5 from trial_results where label='first'), 'safe DTO without ledger ids');
select pg_temp.check_trial(public.platform_billing_status_get('a9090000-0000-4000-8000-000000000001','community_platform',null)->'allowedActions' ?& array['create_resource','start_trial'], 'lost-response HTTP retry remains allowed');
reset role;
select pg_temp.check_trial((select count(*)=1 from platform_billing_private.creation_entitlements where actor_user_id='a9090000-0000-4000-8000-000000000001'), 'one pending grant');
select pg_temp.check_trial((select count(*)=2 from platform_billing_private.community_trial_requests), 'alias receipt retained');

-- Use the actual guarded create RPC; only surrounding Community tables are fixtures.
set local role authenticated;
select set_config('request.jwt.claim.sub','a9090000-0000-4000-8000-000000000001',true);
select public.community_create_with_platform_entitlement('Group One','trial-group-one',null,null);
reset role;
create temp table old_grant as select to_jsonb(e) snapshot from platform_billing_private.creation_entitlements e where actor_user_id='a9090000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.deny_trial($q$select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000001','b9090000-0000-4000-8000-000000000001')$q$,'23505');
select pg_temp.deny_trial($q$select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000001','b9090000-0000-4000-8000-000000000002')$q$,'23505');
select pg_temp.check_trial(public.platform_billing_status_get('a9090000-0000-4000-8000-000000000001','community_platform',null)->'allowedActions' ? 'start_trial', 'owner may start a different group');
insert into trial_results values ('second',public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000001','b9090000-0000-4000-8000-000000000003'));
set local role authenticated;
select public.community_create_with_platform_entitlement('Group Two','trial-group-two',null,null);
select pg_temp.deny_trial($q$select public.community_create_with_platform_entitlement('Group Three','trial-group-three',null,null)$q$,'40001');
reset role;
select pg_temp.check_trial((select count(*)=2 from public.community_communities where owner_user_id='a9090000-0000-4000-8000-000000000001'), 'two actual guarded-create groups');
select pg_temp.check_trial((select count(*)=2 and count(distinct resource_id)=2 and bool_and(expires_at-starts_at=interval '30 days') from platform_billing_private.creation_entitlements where actor_user_id='a9090000-0000-4000-8000-000000000001'), 'independent thirty-day grants');
select pg_temp.check_trial((select snapshot=(select to_jsonb(e) from platform_billing_private.creation_entitlements e where e.id=(snapshot->>'id')::uuid) from old_grant), 'first grant unchanged byte-for-byte');
select pg_temp.check_trial((select count(*)=6 from public.community_rooms), 'each group has its own rooms');
select pg_temp.check_trial((select count(*)=2 from public.community_memberships), 'each group has its own membership');
select pg_temp.check_trial(not exists(select 1 from platform_billing_private.subscriptions), 'no billing created');
do $$
declare row record; status jsonb;
begin
  for row in select * from platform_billing_private.creation_entitlements where actor_user_id='a9090000-0000-4000-8000-000000000001' loop
    set local role service_role;
    status := public.platform_billing_status_get(row.actor_user_id,'community_platform',row.resource_id);
    reset role;
    perform pg_temp.check_trial((status#>>'{subscription,currentPeriodEndsAt}')::timestamptz=date_trunc('milliseconds',row.expires_at)
      and status#>>'{creation,state}'='consumed'
      and not(status->'allowedActions' ? 'start_trial'), 'per-group status retains its own expiry');
  end loop;
end $$;

-- Paid pending grant must not be replaced or presented as a trial.
-- Synthetic provider evidence through real quote/attempt RPCs and validated
-- event/entitlement tables. No provider network calls are made.
create temp table paid_attempt(id uuid);
grant all on paid_attempt to service_role;
set local role service_role;
do $$
declare actor uuid := 'a9090000-0000-4000-8000-000000000002'; q jsonb; attempt uuid;
begin
  q := jsonb_build_object('quoteId','community-paid-fixture','revision',1,'purchaseIntent','explicit_paid_start',
    'scope',jsonb_build_object('ownerUserId',actor,'productKey','community_platform','resourceId',null,'planKey','starter','requestId','b9090000-0000-4000-8000-000000000010'),
    'currency','JPY','taxIncluded',true,
    'dueNow',jsonb_build_object('totalYen',2980,'dueOn',current_date::text),
    'nextPayment',jsonb_build_object('totalYen',2980,'dueOn',(current_date+30)::text),
    'merchant',jsonb_build_object('merchantId','fixture','legalName','Fixture','address','Fixture','contactUrl','https://example.invalid/contact'),
    'policies',jsonb_build_object('approved',true,'approvalId','fixture','revision',1)
      || (select jsonb_object_agg(k,jsonb_build_object('version','fixture-v1','url','https://example.invalid/policy'))
          from unnest(array['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure']) k),
    'issuedAt',to_char((clock_timestamp()-interval '1 minute') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt',to_char((clock_timestamp()+interval '1 hour') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  perform public.platform_billing_quote_save(actor,q);
  attempt := (public.platform_billing_attempt_reserve(actor,'community-paid-fixture','{"quoteId":"community-paid-fixture","revision":1,"termsVersion":"fixture-v1","accepted":true}') ->> 'attempt_id')::uuid;
  perform public.platform_billing_attempt_mark_ready(actor,attempt,'cs_test_CommunityPerResource',repeat('a',64));
  insert into paid_attempt values(attempt);
end $$;
reset role;
with event as (
  insert into platform_billing_private.verified_provider_events(provider_event_id,provider_event_hash,provider_session_id,attempt_id,actor_user_id,product_key,plan_key,quote_id,quote_revision,paid_at,entitlement_expires_at)
  select 'evt_CommunityPerResource',repeat('b',64),'cs_test_CommunityPerResource',id,'a9090000-0000-4000-8000-000000000002','community_platform','starter','community-paid-fixture',1,transaction_timestamp(),transaction_timestamp()+interval '30 days' from paid_attempt
  returning *
)
insert into platform_billing_private.creation_entitlements(actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,starts_at,expires_at)
select actor_user_id,product_key,plan_key,'verified_paid',attempt_id,'b9090000-0000-4000-8000-000000000010',paid_at,entitlement_expires_at from event;
create temp table paid_grant as select to_jsonb(e) snapshot from platform_billing_private.creation_entitlements e where actor_user_id='a9090000-0000-4000-8000-000000000002';
-- Never-consumed expired trial: explicit new request, not a same-request reset.
insert into platform_billing_private.creation_entitlements(actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,starts_at,expires_at)
values ('a9090000-0000-4000-8000-000000000003','community_platform','trial','verified_trial','b9090000-0000-4000-8000-000000000020','b9090000-0000-4000-8000-000000000020',clock_timestamp()-interval '31 days',clock_timestamp()-interval '1 day');
set local role service_role;
select pg_temp.deny_trial($q$select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000002','b9090000-0000-4000-8000-000000000011')$q$,'23505');
select pg_temp.check_trial(not (public.platform_billing_status_get('a9090000-0000-4000-8000-000000000002','community_platform',null)->'allowedActions' ? 'start_trial'), 'paid pending cannot start trial');
select pg_temp.deny_trial($q$select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000003','b9090000-0000-4000-8000-000000000020')$q$,'23505');
select pg_temp.check_trial(public.platform_billing_status_get('a9090000-0000-4000-8000-000000000003','community_platform',null)->'allowedActions' ? 'start_trial', 'expired uncreated trial permits new explicit operation');
select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000003','b9090000-0000-4000-8000-000000000021');
reset role;
select pg_temp.check_trial((select count(*)=2 and count(*) filter(where status='expired')=1 and count(*) filter(where status='available')=1 from platform_billing_private.creation_entitlements where actor_user_id='a9090000-0000-4000-8000-000000000003'), 'expired history retained, fresh grant separate');
select pg_temp.check_trial((select snapshot=(select to_jsonb(e) from platform_billing_private.creation_entitlements e where e.id=(snapshot->>'id')::uuid) from paid_grant), 'paid grant unchanged');
-- Bind the paid grant and retain the existing subscription byte-for-byte while
-- starting an independent new Community trial as the same owner.
insert into platform_billing_private.subscriptions(actor_user_id,product_key,plan_key,source_attempt_id,provider_customer_id,provider_subscription_id,initial_amount_yen,currency,status,original_paid_at,current_period_start,current_period_end)
select actor_user_id,product_key,plan_key,source_attempt_id,'cus_CommunityPerResource','sub_CommunityPerResource',2980,'jpy','active',starts_at,starts_at,expires_at
from platform_billing_private.creation_entitlements where actor_user_id='a9090000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','a9090000-0000-4000-8000-000000000002',true);
select public.community_create_with_platform_entitlement('Paid Group','paid-group',null,null);
reset role;
create temp table paid_bound_snapshot as
select to_jsonb(s) snapshot,e.resource_id from platform_billing_private.subscriptions s
join platform_billing_private.creation_entitlements e on e.source_attempt_id=s.source_attempt_id;
grant select on paid_bound_snapshot to service_role;
set local role service_role;
insert into trial_results select 'paid-status',public.platform_billing_status_get('a9090000-0000-4000-8000-000000000002','community_platform',resource_id) from paid_bound_snapshot;
select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000002','b9090000-0000-4000-8000-000000000012');
select pg_temp.check_trial((select payload=public.platform_billing_status_get('a9090000-0000-4000-8000-000000000002','community_platform',resource_id) from trial_results cross join paid_bound_snapshot where label='paid-status'), 'bound paid status unchanged');
reset role;
select pg_temp.check_trial((select snapshot=(select to_jsonb(s) from platform_billing_private.subscriptions s where s.id=(snapshot->>'id')::uuid) from paid_bound_snapshot), 'bound subscription unchanged byte-for-byte');
-- Administrative revoked state is not cleared by another request.
insert into platform_billing_private.creation_entitlements(actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,status,starts_at,expires_at)
values ('a9090000-0000-4000-8000-000000000005','community_platform','trial','verified_trial','b9090000-0000-4000-8000-000000000030','b9090000-0000-4000-8000-000000000030','revoked',clock_timestamp()-interval '1 day',clock_timestamp()+interval '29 days');
set local role service_role;
select pg_temp.deny_trial($q$select public.platform_billing_community_trial_start('a9090000-0000-4000-8000-000000000005','b9090000-0000-4000-8000-000000000031')$q$,'23505');
select pg_temp.check_trial(not(public.platform_billing_status_get('a9090000-0000-4000-8000-000000000005','community_platform',null)->'allowedActions' ? 'start_trial'), 'revocation not bypassed');
reset role;
select pg_temp.deny_trial('update platform_billing_private.community_trial_requests set created_at=clock_timestamp()', '42501');
select pg_temp.deny_trial('truncate platform_billing_private.community_trial_requests', '42501');
set local role service_role;
select pg_temp.check_trial(not (public.platform_billing_status_get('a9090000-0000-4000-8000-000000000001','community_platform','00000000-0000-4000-8000-000000000099')->'allowedActions' ? 'start_trial'), 'resource-scoped calls cannot restart trial');
reset role;
-- The unchanged prior function is executed under service role by both wrappers.
set local role service_role;
insert into trial_results values ('academy',public.platform_billing_status_get('a9090000-0000-4000-8000-000000000001','academy_platform',null));
reset role;
grant execute on function public.platform_billing_status_before_community_per_resource(uuid,text,uuid) to service_role;
set local role service_role;
select pg_temp.check_trial((select payload=public.platform_billing_status_before_community_per_resource('a9090000-0000-4000-8000-000000000001','academy_platform',null) from trial_results where label='academy'), 'Academy status unchanged');
reset role;
revoke execute on function public.platform_billing_status_before_community_per_resource(uuid,text,uuid) from service_role;
select 'community_per_resource_trial_sql_ok';
