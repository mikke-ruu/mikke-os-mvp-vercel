-- Synthetic isolated Postgres only. Caller owns BEGIN/ROLLBACK and applies the
-- four common billing migrations plus community-capacity migration first.
create function pg_temp.capacity_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'community capacity assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.community_quote(actor uuid, quote_id text, request_id uuid, plan_key text, resource_id uuid)
returns jsonb language sql as $$
select jsonb_build_object(
  'quoteId', quote_id, 'revision', 1, 'purchaseIntent', 'explicit_paid_start',
  'scope', jsonb_build_object('ownerUserId', actor::text, 'productKey', 'community_platform',
    'resourceId', resource_id::text, 'planKey', plan_key, 'requestId', request_id::text),
  'currency', 'JPY', 'taxIncluded', true,
  'dueNow', jsonb_build_object('totalYen', 2980, 'dueOn', to_char(clock_timestamp() at time zone 'Asia/Tokyo', 'YYYY-MM-DD')),
  'nextPayment', jsonb_build_object('totalYen', 2980, 'dueOn', to_char((clock_timestamp() at time zone 'Asia/Tokyo') + interval '1 month', 'YYYY-MM-DD')),
  'merchant', jsonb_build_object('merchantId', 'fixture', 'legalName', 'Fixture', 'address', 'Fixture', 'contactUrl', 'https://example.invalid/contact'),
  'policies', jsonb_build_object('approved', true, 'approvalId', 'fixture-approval', 'revision', 1)
    || (select jsonb_object_agg(key, jsonb_build_object('version', 'fixture-v1', 'url', 'https://example.invalid/policy'))
        from unnest(array['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure']) key),
  'issuedAt', to_char((clock_timestamp() - interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'expiresAt', to_char((clock_timestamp() + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)
$$;

insert into auth.users(id, is_anonymous) values
  ('ac050000-0000-4000-8000-000000000001', false),
  ('ac050000-0000-4000-8000-000000000002', false);

select pg_temp.capacity_assert(
  not has_function_privilege('anon', 'platform_billing_private.community_capacity_for_resource(uuid,uuid,timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'platform_billing_private.community_capacity_for_resource(uuid,uuid,timestamptz)', 'execute')
  and not has_function_privilege('service_role', 'platform_billing_private.community_capacity_for_resource(uuid,uuid,timestamptz)', 'execute'),
  'helper has no browser or service API execute grant'
);

set local role service_role;
select public.platform_billing_quote_save(
  'ac050000-0000-4000-8000-000000000001',
  pg_temp.community_quote('ac050000-0000-4000-8000-000000000001', 'community-capacity',
    'bc050000-0000-4000-8000-000000000001', 'starter', 'cc050000-0000-4000-8000-000000000001')
);
select set_config('test.capacity_attempt', public.platform_billing_attempt_reserve(
  'ac050000-0000-4000-8000-000000000001', 'community-capacity',
  '{"quoteId":"community-capacity","revision":1,"termsVersion":"fixture-v1","accepted":true}'
)::text, true);
select public.platform_billing_attempt_mark_ready(
  'ac050000-0000-4000-8000-000000000001',
  (current_setting('test.capacity_attempt')::jsonb ->> 'attempt_id')::uuid,
  'cs_test_CommunityCapacity', repeat('a', 64)
);
select public.platform_billing_verified_subscription_activate(
  (current_setting('test.capacity_attempt')::jsonb ->> 'attempt_id')::uuid,
  'evt_CommunityCapacity', repeat('b', 64), 'cs_test_CommunityCapacity',
  'cus_CommunityCapacity', 'sub_CommunityCapacity', 2980, 'jpy', statement_timestamp()
);
reset role;
select pg_temp.capacity_assert(
  (select count(*) = 1 from platform_billing_private.creation_entitlements
    where actor_user_id='ac050000-0000-4000-8000-000000000001'
      and product_key='community_platform' and status='consumed'
      and resource_id='cc050000-0000-4000-8000-000000000001')
  and not exists(select 1 from platform_billing_private.creation_entitlements
    where actor_user_id='ac050000-0000-4000-8000-000000000001'
      and product_key='community_platform' and status='available'),
  'existing resource payment binds entitlement and leaves no create grant'
);

select pg_temp.capacity_assert(
  platform_billing_private.community_capacity_for_resource(
    'ac050000-0000-4000-8000-000000000001', 'cc050000-0000-4000-8000-000000000001', statement_timestamp()
  ) = 50,
  'active starter returns 50'
);
select pg_temp.capacity_assert(
  platform_billing_private.community_capacity_for_resource(
    'ac050000-0000-4000-8000-000000000002', 'cc050000-0000-4000-8000-000000000001', statement_timestamp()
  ) is null,
  'different owner fails closed'
);
select pg_temp.capacity_assert(
  platform_billing_private.community_capacity_for_resource(
    'ac050000-0000-4000-8000-000000000001', 'cc050000-0000-4000-8000-000000000001',
    (select current_period_end from platform_billing_private.subscriptions)
  ) is null,
  'period end is exclusive'
);

select set_config('test.capacity_period_start', (select current_period_start::text from platform_billing_private.subscriptions), true);
select set_config('test.capacity_period_end', (select current_period_end::text from platform_billing_private.subscriptions), true);
set local role service_role;
select public.platform_billing_subscription_event_apply(
  'sub_CommunityCapacity', 'evt_CommunityCapacityFailed', repeat('c', 64),
  'invoice_failed', 'past_due',
  current_setting('test.capacity_period_start')::timestamptz,
  current_setting('test.capacity_period_end')::timestamptz,
  null, statement_timestamp() + interval '1 second'
);
reset role;
select pg_temp.capacity_assert(
  platform_billing_private.community_capacity_for_resource(
    'ac050000-0000-4000-8000-000000000001', 'cc050000-0000-4000-8000-000000000001', statement_timestamp()
  ) is null,
  'past_due fails closed'
);

insert into platform_billing_private.creation_entitlements(
  actor_user_id, product_key, plan_key, source_kind, source_attempt_id,
  idempotency_key, status, starts_at, expires_at, resource_id, consumed_at
) values (
  'ac050000-0000-4000-8000-000000000002', 'community_platform', 'trial', 'verified_trial',
  'dc050000-0000-4000-8000-000000000001', 'ec050000-0000-4000-8000-000000000001',
  'consumed', statement_timestamp() - interval '1 hour', statement_timestamp() + interval '30 days',
  'cc050000-0000-4000-8000-000000000002', statement_timestamp()
);
select pg_temp.capacity_assert(
  platform_billing_private.community_capacity_for_resource(
    'ac050000-0000-4000-8000-000000000002', 'cc050000-0000-4000-8000-000000000002', statement_timestamp()
  ) = 10,
  'active trial returns 10'
);
select pg_temp.capacity_assert(
  platform_billing_private.community_capacity_for_resource(
    'ac050000-0000-4000-8000-000000000002', 'cc050000-0000-4000-8000-000000000002', statement_timestamp() + interval '30 days'
  ) is null,
  'expired trial fails closed'
);

insert into platform_billing_private.creation_entitlements(
  actor_user_id, product_key, plan_key, source_kind, source_attempt_id,
  idempotency_key, status, starts_at, expires_at, resource_id, consumed_at
) values (
  'ac050000-0000-4000-8000-000000000002', 'community_platform', 'trial', 'verified_trial',
  'dc050000-0000-4000-8000-000000000002', 'ec050000-0000-4000-8000-000000000002',
  'consumed', statement_timestamp() - interval '1 hour', statement_timestamp() + interval '30 days',
  'cc050000-0000-4000-8000-000000000002', statement_timestamp()
);
select pg_temp.capacity_assert(
  platform_billing_private.community_capacity_for_resource(
    'ac050000-0000-4000-8000-000000000002', 'cc050000-0000-4000-8000-000000000002', statement_timestamp()
  ) is null,
  'multiple trial sources fail closed'
);

select 'platform_billing_community_capacity_test_ok' as result;
