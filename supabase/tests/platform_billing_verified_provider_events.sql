-- Synthetic isolated Postgres only. Caller owns BEGIN/ROLLBACK.
-- Prerequisites: checkout ledger, creation entitlement, verified event migration.

create function pg_temp.verified_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'verified provider event assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.verified_denied(statement text, code text, message text default null)
returns void language plpgsql as $$
declare actual_code text; actual_message text;
begin
  begin execute statement;
  exception when others then
    get stacked diagnostics actual_code = returned_sqlstate, actual_message = message_text;
  end;
  if actual_code is distinct from code
    or (message is not null and actual_message is distinct from message) then
    raise exception 'expected % / %, got % / %', code, message, actual_code, actual_message;
  end if;
end;
$$;

create function pg_temp.verified_quote(
  actor uuid, qid text, request_id uuid, product_key text,
  plan_key text default 'fixture_plan'
) returns jsonb language sql as $$
  select jsonb_build_object(
    'quoteId', qid, 'revision', 1, 'purchaseIntent', 'explicit_paid_start',
    'scope', jsonb_build_object(
      'ownerUserId', actor::text, 'productKey', product_key, 'resourceId', null,
      'planKey', plan_key, 'requestId', request_id::text
    ),
    'currency', 'JPY', 'taxIncluded', true,
    'dueNow', jsonb_build_object(
      'totalYen', 1000,
      'dueOn', to_char(clock_timestamp() at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
    ),
    'nextPayment', jsonb_build_object(
      'totalYen', 1000,
      'dueOn', to_char((clock_timestamp() at time zone 'Asia/Tokyo') + interval '1 month', 'YYYY-MM-DD')
    ),
    'merchant', jsonb_build_object(
      'merchantId', 'fixture-merchant', 'legalName', 'Fixture merchant',
      'address', 'Fixture address', 'contactUrl', 'https://example.invalid/contact'
    ),
    'policies', jsonb_build_object(
      'approved', true, 'approvalId', 'fixture-approval', 'revision', 1
    ) || (
      select jsonb_object_agg(
        key,
        jsonb_build_object('version', 'fixture-v1', 'url', 'https://example.invalid/policy')
      )
      from unnest(array[
        'terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure'
      ]) key
    ),
    'issuedAt', to_char(
      (clock_timestamp() - interval '1 minute') at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'expiresAt', to_char(
      (clock_timestamp() + interval '1 hour') at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  )
$$;

create function pg_temp.verified_consent(qid text) returns jsonb
language sql as $$
  select jsonb_build_object(
    'quoteId', qid, 'revision', 1, 'termsVersion', 'fixture-v1', 'accepted', true
  )
$$;

insert into auth.users (id, is_anonymous) values
  ('aa030000-0000-4000-8000-000000000001', false),
  ('aa030000-0000-4000-8000-000000000002', false),
  ('aa030000-0000-4000-8000-000000000003', true),
  ('aa030000-0000-4000-8000-000000000004', false);

do $$
declare role_name text; function_row record;
begin
  perform pg_temp.verified_assert(
    (select relrowsecurity
     from pg_class
     where oid = 'platform_billing_private.verified_provider_events'::regclass),
    'verified event RLS'
  );
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    perform pg_temp.verified_assert(
      not has_table_privilege(
        role_name,
        'platform_billing_private.verified_provider_events',
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
      ),
      'verified event table private ' || role_name
    );
  end loop;
  select p.oid, p.proconfig, p.prosecdef into function_row
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'platform_billing_verified_payment_grant';
  perform pg_temp.verified_assert(
    function_row.prosecdef and function_row.proconfig @> array['search_path=""'],
    'verified RPC definer and empty path'
  );
  perform pg_temp.verified_assert(
    not has_function_privilege('anon', function_row.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
      and has_function_privilege('service_role', function_row.oid, 'EXECUTE'),
    'verified RPC service only'
  );
end;
$$;

set local role anon;
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001', gen_random_uuid(),
    'evt_testAnon', repeat('a',64), 'cs_test_Anon', statement_timestamp()
  )$q$, '42501'
);
select pg_temp.verified_denied(
  $q$select * from platform_billing_private.verified_provider_events$q$, '42501'
);
reset role;

set local role authenticated;
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001', gen_random_uuid(),
    'evt_testAuthenticated', repeat('a',64), 'cs_test_Authenticated', statement_timestamp()
  )$q$, '42501'
);
reset role;

set local role service_role;
select pg_temp.verified_denied(
  $q$insert into platform_billing_private.verified_provider_events (
    provider_event_id, provider_event_hash, provider_session_id, attempt_id,
    actor_user_id, product_key, plan_key, quote_id, quote_revision, paid_at,
    entitlement_expires_at
  ) values (
    'evt_testDirect', repeat('d',64), 'cs_test_Direct', gen_random_uuid(),
    'aa030000-0000-4000-8000-000000000001', 'academy_platform', 'fixture_plan',
    'direct', 1, statement_timestamp(), statement_timestamp() + interval '1 month'
  )$q$, '42501'
);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000003', gen_random_uuid(),
    'evt_testAnonymousUser', repeat('a',64), 'cs_test_AnonymousUser', statement_timestamp()
  )$q$, '42501', 'PLATFORM_BILLING_FORBIDDEN'
);

-- Prepared attempt cannot create paid access.
select public.platform_billing_quote_save(
  'aa030000-0000-4000-8000-000000000001',
  pg_temp.verified_quote(
    'aa030000-0000-4000-8000-000000000001', 'verified-main',
    'ba030000-0000-4000-8000-000000000001', 'academy_platform'
  )
);
select set_config(
  'test.verified_attempt',
  public.platform_billing_attempt_reserve(
    'aa030000-0000-4000-8000-000000000001',
    'verified-main', pg_temp.verified_consent('verified-main')
  )->>'attempt_id', true
);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001',
    current_setting('test.verified_attempt')::uuid,
    'evt_testUnready', repeat('1',64), 'cs_test_Main', statement_timestamp()
  )$q$, '42501', 'PLATFORM_BILLING_VERIFIED_EVENT_SCOPE_MISMATCH'
);

-- The old broad grant cannot fabricate verified_paid access without an event row.
select pg_temp.verified_denied(
  $q$select public.platform_billing_creation_entitlement_grant(
    'aa030000-0000-4000-8000-000000000001', 'academy_platform', 'fixture_plan',
    'verified_paid', current_setting('test.verified_attempt')::uuid,
    statement_timestamp(), statement_timestamp() + interval '1 month',
    'ca030000-0000-4000-8000-000000000001'
  )$q$, '42501', 'PLATFORM_BILLING_VERIFIED_EVENT_REQUIRED'
);

select public.platform_billing_attempt_mark_ready(
  'aa030000-0000-4000-8000-000000000001',
  current_setting('test.verified_attempt')::uuid,
  'cs_test_Main', repeat('a',64)
);
select set_config('test.verified_paid_at', statement_timestamp()::text, true);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000002',
    current_setting('test.verified_attempt')::uuid,
    'evt_testMain', repeat('1',64), 'cs_test_Main',
    current_setting('test.verified_paid_at')::timestamptz
  )$q$, 'P0002', 'PLATFORM_BILLING_NOT_FOUND'
);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001',
    current_setting('test.verified_attempt')::uuid,
    'evt_testMain', repeat('1',64), 'cs_test_Wrong', statement_timestamp()
  )$q$, '42501', 'PLATFORM_BILLING_VERIFIED_EVENT_SCOPE_MISMATCH'
);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001',
    current_setting('test.verified_attempt')::uuid,
    'evt_testMain', repeat('1',64), 'cs_test_Main', statement_timestamp() + interval '6 minutes'
  )$q$, '22023', 'PLATFORM_BILLING_INVALID_PAID_AT'
);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001',
    current_setting('test.verified_attempt')::uuid,
    'evt_testMain', repeat('1',64), 'cs_test_Main',
    statement_timestamp() - interval '6 minutes'
  )$q$, '22023', 'PLATFORM_BILLING_INVALID_PAID_AT'
);

select set_config(
  'test.verified_result',
  public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001',
    current_setting('test.verified_attempt')::uuid,
    'evt_testMain', repeat('1',64), 'cs_test_Main',
    current_setting('test.verified_paid_at')::timestamptz
  )::text, true
);
select pg_temp.verified_assert(
  current_setting('test.verified_result')::jsonb
    @> '{"created":true,"state":"available","productKey":"academy_platform","planKey":"fixture_plan","eventStatus":"verified"}'::jsonb,
  'verified payment creates app-owned grant'
);
select pg_temp.verified_assert(
  not (current_setting('test.verified_result')::jsonb ?| array[
    'providerEventId','providerEventHash','providerSessionId','attemptId'
  ]),
  'provider proof fields never returned'
);
select pg_temp.verified_assert(
  public.platform_billing_creation_status(
    'aa030000-0000-4000-8000-000000000001', 'academy_platform', null
  ) @> '{"state":"available","planKey":"fixture_plan"}'::jsonb,
  'status projection reports app-owned grant'
);
select pg_temp.verified_assert(
  public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001',
    current_setting('test.verified_attempt')::uuid,
    'evt_testMain', repeat('1',64), 'cs_test_Main',
    current_setting('test.verified_paid_at')::timestamptz
  )->'created' = 'false'::jsonb,
  'same event and hash is idempotent'
);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001',
    current_setting('test.verified_attempt')::uuid,
    'evt_testMain', repeat('2',64), 'cs_test_Main',
    current_setting('test.verified_paid_at')::timestamptz
  )$q$, '23505', 'PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT'
);

-- A different owner/product/plan/attempt cannot reuse an event identity.
select public.platform_billing_quote_save(
  'aa030000-0000-4000-8000-000000000004',
  pg_temp.verified_quote(
    'aa030000-0000-4000-8000-000000000004', 'verified-other',
    'ba030000-0000-4000-8000-000000000004', 'community_platform', 'other_plan'
  )
);
select set_config(
  'test.other_attempt',
  public.platform_billing_attempt_reserve(
    'aa030000-0000-4000-8000-000000000004',
    'verified-other', pg_temp.verified_consent('verified-other')
  )->>'attempt_id', true
);
select public.platform_billing_attempt_mark_ready(
  'aa030000-0000-4000-8000-000000000004',
  current_setting('test.other_attempt')::uuid,
  'cs_live_Other', repeat('b',64)
);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000004',
    current_setting('test.other_attempt')::uuid,
    'evt_testMain', repeat('5',64), 'cs_live_Other', statement_timestamp()
  )$q$, '23505', 'PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT'
);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000001',
    current_setting('test.verified_attempt')::uuid,
    'evt_testDifferent', repeat('1',64), 'cs_test_Main',
    current_setting('test.verified_paid_at')::timestamptz
  )$q$, '23505', 'PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT'
);

-- An uncertain attempt remains blocked and never creates a paid grant.
select public.platform_billing_quote_save(
  'aa030000-0000-4000-8000-000000000002',
  pg_temp.verified_quote(
    'aa030000-0000-4000-8000-000000000002', 'verified-uncertain',
    'ba030000-0000-4000-8000-000000000002', 'community_platform'
  )
);
select set_config(
  'test.uncertain_attempt',
  public.platform_billing_attempt_reserve(
    'aa030000-0000-4000-8000-000000000002',
    'verified-uncertain', pg_temp.verified_consent('verified-uncertain')
  )->>'attempt_id', true
);
select public.platform_billing_attempt_mark_uncertain(
  'aa030000-0000-4000-8000-000000000002',
  current_setting('test.uncertain_attempt')::uuid
);
select pg_temp.verified_denied(
  $q$select public.platform_billing_verified_payment_grant(
    'aa030000-0000-4000-8000-000000000002',
    current_setting('test.uncertain_attempt')::uuid,
    'evt_testUncertain', repeat('3',64), 'cs_test_Uncertain', statement_timestamp()
  )$q$, '42501', 'PLATFORM_BILLING_VERIFIED_EVENT_SCOPE_MISMATCH'
);

-- Existing verified_trial entry remains supported and never becomes paid.
select pg_temp.verified_assert(
  public.platform_billing_creation_entitlement_grant(
    'aa030000-0000-4000-8000-000000000002',
    'academy_platform', 'trial_plan', 'verified_trial',
    'ba030000-0000-4000-8000-000000000099',
    statement_timestamp(), statement_timestamp() + interval '7 days',
    'ca030000-0000-4000-8000-000000000099'
  ) @> '{"created":true,"state":"available","productKey":"academy_platform"}'::jsonb,
  'verified trial grant remains unchanged'
);
reset role;

select pg_temp.verified_assert(
  platform_billing_private.next_month_at('2027-01-31 15:30:00+09')
    = '2027-02-28 15:30:00+09'::timestamptz,
  'same JST time and month-end fallback'
);
select pg_temp.verified_assert(
  platform_billing_private.next_month_at('2028-01-31 15:30:00+09')
    = '2028-02-29 15:30:00+09'::timestamptz,
  'leap-year month-end fallback'
);
select pg_temp.verified_assert(
  (select count(*) = 1 from platform_billing_private.verified_provider_events),
  'one immutable verified event'
);
select pg_temp.verified_assert(
  (select count(*) = 1
   from platform_billing_private.creation_entitlements
   where source_kind = 'verified_paid'),
  'one verified paid creation grant'
);
select pg_temp.verified_assert(
  (select count(*) = 1
   from platform_billing_private.creation_entitlements
   where source_kind = 'verified_trial'),
  'one unchanged verified trial grant'
);
select pg_temp.verified_denied(
  $q$update platform_billing_private.verified_provider_events set paid_at = statement_timestamp()$q$,
  '42501', 'PLATFORM_BILLING_VERIFIED_EVENT_IMMUTABLE'
);
select pg_temp.verified_denied(
  $q$delete from platform_billing_private.verified_provider_events$q$,
  '42501', 'PLATFORM_BILLING_VERIFIED_EVENT_IMMUTABLE'
);
select pg_temp.verified_denied(
  $q$truncate platform_billing_private.verified_provider_events$q$,
  '42501', 'PLATFORM_BILLING_VERIFIED_EVENT_IMMUTABLE'
);

select 'platform_billing_verified_provider_events_test_ok' as result;
