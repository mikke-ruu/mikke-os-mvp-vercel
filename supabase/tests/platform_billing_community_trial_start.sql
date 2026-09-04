-- Synthetic isolated PostgreSQL only. Caller owns the outer transaction and rollback.

create function pg_temp.trial_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Community trial assertion failed: %', label; end if;
end;
$$;

create function pg_temp.trial_denied(statement text, expected_state text, expected_message text default null)
returns void language plpgsql as $$
declare actual_state text; actual_message text;
begin
  begin execute statement; exception when others then
    get stacked diagnostics actual_state = returned_sqlstate, actual_message = message_text;
  end;
  if actual_state is distinct from expected_state
    or (expected_message is not null and actual_message is distinct from expected_message) then
    raise exception 'expected % / %, got % / %', expected_state, expected_message, actual_state, actual_message;
  end if;
end;
$$;

create function pg_temp.trial_quote(actor uuid, request_id uuid)
returns jsonb language sql as $$
select jsonb_build_object(
  'quoteId', 'trial-paid-fixture', 'revision', 1, 'purchaseIntent', 'explicit_paid_start',
  'scope', jsonb_build_object('ownerUserId', actor::text, 'productKey', 'community_platform',
    'resourceId', null, 'planKey', 'starter', 'requestId', request_id::text),
  'currency', 'JPY', 'taxIncluded', true,
  'dueNow', jsonb_build_object('totalYen', 2980, 'dueOn', to_char(current_date, 'YYYY-MM-DD')),
  'nextPayment', jsonb_build_object('totalYen', 2980, 'dueOn', to_char(current_date + 30, 'YYYY-MM-DD')),
  'merchant', jsonb_build_object('merchantId', 'fixture', 'legalName', 'Fixture', 'address', 'Fixture', 'contactUrl', 'https://example.invalid/contact'),
  'policies', jsonb_build_object('approved', true, 'approvalId', 'fixture', 'revision', 1)
    || (select jsonb_object_agg(key, jsonb_build_object('version', 'fixture-v1', 'url', 'https://example.invalid/policy'))
        from unnest(array['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure']) key),
  'issuedAt', to_char(date_trunc('milliseconds', transaction_timestamp() - interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'expiresAt', to_char(date_trunc('milliseconds', transaction_timestamp() + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)
$$;

insert into auth.users(id, email, is_anonymous) values
  ('af040000-0000-4000-8000-000000000001', 'trial-owner@example.invalid', false),
  ('af040000-0000-4000-8000-000000000002', 'trial-other@example.invalid', false),
  ('af040000-0000-4000-8000-000000000003', 'trial-anonymous@example.invalid', true),
  ('af040000-0000-4000-8000-000000000004', 'trial-paid@example.invalid', false),
  ('af040000-0000-4000-8000-000000000005', 'trial-community@example.invalid', false),
  ('af040000-0000-4000-8000-000000000006', 'trial-expired@example.invalid', false);

select pg_temp.trial_assert(
  (select indisunique from pg_index where indexrelid = 'platform_billing_private.platform_billing_creation_one_lifetime_trial_idx'::regclass)
  and not has_function_privilege('anon', 'public.platform_billing_community_trial_start(uuid,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.platform_billing_community_trial_start(uuid,uuid)', 'execute')
  and has_function_privilege('service_role', 'public.platform_billing_community_trial_start(uuid,uuid)', 'execute'),
  'lifetime uniqueness and service-only ACL'
);

set local role anon;
select pg_temp.trial_denied(
  $q$select public.platform_billing_community_trial_start('af040000-0000-4000-8000-000000000001','bf040000-0000-4000-8000-000000000001')$q$,
  '42501'
);
reset role;

set local role authenticated;
select pg_temp.trial_denied(
  $q$select public.platform_billing_community_trial_start('af040000-0000-4000-8000-000000000001','bf040000-0000-4000-8000-000000000001')$q$,
  '42501'
);
reset role;

set local role service_role;
select pg_temp.trial_denied(
  $q$select public.platform_billing_community_trial_start('af040000-0000-4000-8000-000000000003','bf040000-0000-4000-8000-000000000003')$q$,
  '42501', 'PLATFORM_BILLING_FORBIDDEN'
);

select set_config('test.trial.first', public.platform_billing_community_trial_start(
  'af040000-0000-4000-8000-000000000001', 'bf040000-0000-4000-8000-000000000001'
)::text, true);
select pg_temp.trial_assert(
  (select array_agg(key order by key) = array['automaticBilling','creation','endsAt','startsAt','state']
   from jsonb_object_keys(current_setting('test.trial.first')::jsonb) key)
  and current_setting('test.trial.first')::jsonb @> '{"state":"trialing","automaticBilling":false,"creation":{"state":"available"}}'::jsonb
  and (current_setting('test.trial.first')::jsonb->>'endsAt')::timestamptz
    = (current_setting('test.trial.first')::jsonb->>'startsAt')::timestamptz + interval '30 days'
  and not (current_setting('test.trial.first')::jsonb ? 'id'),
  'trial exact safe DTO and 30 day boundary'
);
select set_config('test.trial.retry', public.platform_billing_community_trial_start(
    'af040000-0000-4000-8000-000000000001', 'bf040000-0000-4000-8000-000000000001'
  )::text, true);
reset role;
select pg_temp.trial_assert(
  current_setting('test.trial.retry')::jsonb = current_setting('test.trial.first')::jsonb
  and (select count(*) = 1 from platform_billing_private.creation_entitlements
       where actor_user_id = 'af040000-0000-4000-8000-000000000001' and source_kind = 'verified_trial'),
  'same request is idempotent'
);
set local role service_role;
select pg_temp.trial_denied(
  $q$select public.platform_billing_community_trial_start('af040000-0000-4000-8000-000000000001','bf040000-0000-4000-8000-000000000002')$q$,
  '23505', 'PLATFORM_BILLING_STATE_CONFLICT'
);
select pg_temp.trial_assert(
  public.platform_billing_status_get('af040000-0000-4000-8000-000000000001','community_platform',null)
    @> '{"subscription":{"state":"trialing","planKey":"trial","automaticBilling":false},"creation":{"state":"available"},"allowedActions":["create_resource"]}'::jsonb,
  'active trial status is authoritative and never billing'
);

-- Existing Community ownership blocks a new trial.
reset role;
insert into public.community_communities(id, slug, name, join_mode, status, owner_user_id)
values ('cf040000-0000-4000-8000-000000000005','trial-existing-community','Existing Community','invite_only','active','af040000-0000-4000-8000-000000000005');
set local role service_role;
select pg_temp.trial_denied(
  $q$select public.platform_billing_community_trial_start('af040000-0000-4000-8000-000000000005','bf040000-0000-4000-8000-000000000005')$q$,
  '23505', 'PLATFORM_BILLING_STATE_CONFLICT'
);

-- A real paid subscription projection blocks a later free trial.
reset role;
insert into platform_billing_private.scopes(id, owner_user_id, product_key, resource_id)
values ('df040000-0000-4000-8000-000000000001','af040000-0000-4000-8000-000000000004','community_platform',null);
insert into platform_billing_private.quotes(
  quote_id,scope_id,owner_user_id,product_key,resource_id,plan_key,request_id,revision,payload,issued_at,expires_at
) values (
  'trial-paid-fixture','df040000-0000-4000-8000-000000000001','af040000-0000-4000-8000-000000000004',
  'community_platform',null,'starter','df040000-0000-4000-8000-000000000002',1,
  pg_temp.trial_quote('af040000-0000-4000-8000-000000000004','df040000-0000-4000-8000-000000000002'),
  date_trunc('milliseconds', transaction_timestamp()-interval '1 minute'),
  date_trunc('milliseconds', transaction_timestamp()+interval '1 hour')
);
insert into platform_billing_private.attempts(
  id,scope_id,owner_user_id,product_key,resource_id,plan_key,request_id,quote_id,quote_revision,consent,
  status,provider_idempotency_key,provider_session_id,provider_result_hash
) values (
  'df040000-0000-4000-8000-000000000003','df040000-0000-4000-8000-000000000001',
  'af040000-0000-4000-8000-000000000004','community_platform',null,'starter',
  'df040000-0000-4000-8000-000000000002','trial-paid-fixture',1,'{}'::jsonb,'provider_ready',
  'platform-checkout-df040000-0000-4000-8000-000000000003','cs_test_TrialPaid',repeat('d',64)
);
insert into platform_billing_private.subscriptions(
  actor_user_id,product_key,plan_key,source_attempt_id,provider_customer_id,provider_subscription_id,
  initial_amount_yen,currency,status,original_paid_at,current_period_start,current_period_end
) values (
  'af040000-0000-4000-8000-000000000004','community_platform','starter',
  'df040000-0000-4000-8000-000000000003','cus_TrialPaid','sub_TrialPaid',2980,'jpy','active',
  transaction_timestamp()-interval '1 day',transaction_timestamp()-interval '1 day',transaction_timestamp()+interval '29 days'
);
set local role service_role;
select pg_temp.trial_denied(
  $q$select public.platform_billing_community_trial_start('af040000-0000-4000-8000-000000000004','bf040000-0000-4000-8000-000000000004')$q$,
  '23505', 'PLATFORM_BILLING_STATE_CONFLICT'
);

-- An expired trial remains non-billing and can only proceed through explicit checkout.
reset role;
insert into platform_billing_private.creation_entitlements(
  actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,status,starts_at,expires_at
) values (
  'af040000-0000-4000-8000-000000000006','community_platform','trial','verified_trial',
  'bf040000-0000-4000-8000-000000000006','bf040000-0000-4000-8000-000000000006','available',
  transaction_timestamp()-interval '30 days 1 second',transaction_timestamp()-interval '1 second'
);
set local role service_role;
select pg_temp.trial_assert(
  public.platform_billing_status_get('af040000-0000-4000-8000-000000000006','community_platform',null)
    @> '{"subscription":{"state":"ended","planKey":"trial","automaticBilling":false},"creation":{"state":"none"},"allowedActions":["checkout"]}'::jsonb,
  'expired trial never becomes paid automatically'
);

reset role;
select pg_temp.trial_assert(
  not exists (
    select 1 from platform_billing_private.subscriptions
    where actor_user_id = 'af040000-0000-4000-8000-000000000006'
  ),
  'expired trial creates no subscription'
);
select pg_temp.trial_assert(
  (select count(*) = 2 from platform_billing_private.creation_entitlements where source_kind = 'verified_trial'),
  'only requested trial ledger rows exist'
);
select 'platform_billing_community_trial_start_test_ok' as result;
