begin;

create function pg_temp.community_billing_guidance_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'Community billing guidance assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.community_billing_guidance_denied(statement text, expected_state text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return sqlstate = expected_state;
end;
$$;

select pg_temp.community_billing_guidance_assert(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'community_membership_plans'
      and column_name = 'external_customer_portal_url'
      and is_nullable = 'NO'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'community_membership_plans'
      and column_name = 'payment_setup_checklist'
      and data_type = 'jsonb'
  ),
  'separate portal URL and checklist columns exist'
);

insert into auth.users(id, email, is_anonymous) values
  ('df100000-0000-4000-8000-000000000001', 'owner-community-billing-guide@example.invalid', false),
  ('df100000-0000-4000-8000-000000000002', 'member-community-billing-guide@example.invalid', false),
  ('df100000-0000-4000-8000-000000000003', 'manual-member-community-billing-guide@example.invalid', false);

insert into public.profiles(user_id, handle, display_name) values
  ('df100000-0000-4000-8000-000000000001', 'owner-community-billing-guide', 'Owner billing guide'),
  ('df100000-0000-4000-8000-000000000002', 'member-community-billing-guide', 'Member billing guide'),
  ('df100000-0000-4000-8000-000000000003', 'manual-member-billing-guide', 'Manual member billing guide');

insert into public.community_communities(id, slug, name, join_mode, owner_user_id)
values ('df110000-0000-4000-8000-000000000001', 'community-billing-guide', 'Community billing guide', 'paid', 'df100000-0000-4000-8000-000000000001');

insert into public.community_memberships(community_id, user_id, role, status) values
  ('df110000-0000-4000-8000-000000000001', 'df100000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('df110000-0000-4000-8000-000000000001', 'df100000-0000-4000-8000-000000000002', 'member', 'active'),
  ('df110000-0000-4000-8000-000000000001', 'df100000-0000-4000-8000-000000000003', 'member', 'active');

insert into public.community_entitlement_definitions(id, community_id, key, name, status)
values ('df120000-0000-4000-8000-000000000001', 'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Paid guide', 'active');

insert into platform_billing_private.creation_entitlements(
  actor_user_id, product_key, plan_key, source_kind, source_attempt_id,
  idempotency_key, status, starts_at, expires_at, resource_id, consumed_at
) values (
  'df100000-0000-4000-8000-000000000001', 'community_platform', 'trial', 'verified_trial',
  'df130000-0000-4000-8000-000000000001', 'df140000-0000-4000-8000-000000000001', 'consumed',
  statement_timestamp() - interval '1 day', statement_timestamp() + interval '29 days',
  'df110000-0000-4000-8000-000000000001', statement_timestamp()
);

select set_config('request.jwt.claims', '{"sub":"df100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
insert into public.community_membership_plans(
  id, community_id, entitlement_key, name, amount_yen, billing_interval,
  payment_provider_label, external_payment_url, external_customer_portal_url,
  cancellation_guidance, payment_setup_checklist, status, created_by_user_id
) values (
  'df150000-0000-4000-8000-000000000001', 'df110000-0000-4000-8000-000000000001',
  'paid:guide', 'Monthly guide', 10000, 'month', 'Stripe',
  'https://buy.stripe.com/test-payment', 'https://billing.stripe.com/p/login/test-portal',
  '契約管理画面に表示される利用終了日まで利用できます。',
  '{"productCreated":true,"recurringPriceConfirmed":true,"paymentLinkTested":true,"customerPortalEnabled":true,"customerPortalTested":true}'::jsonb,
  'active', 'df100000-0000-4000-8000-000000000001'
);
reset role;

insert into public.community_payment_claims(
  id, community_id, plan_id, user_id, payer_name, status,
  reviewed_by_user_id, reviewed_at, payment_method
) values (
  'df160000-0000-4000-8000-000000000001',
  'df110000-0000-4000-8000-000000000001',
  'df150000-0000-4000-8000-000000000001',
  'df100000-0000-4000-8000-000000000002',
  'Member billing guide', 'approved',
  'df100000-0000-4000-8000-000000000001', statement_timestamp(), 'external_link'
);

insert into public.community_payment_claims(
  id, community_id, plan_id, user_id, payer_name, status,
  reviewed_by_user_id, reviewed_at, payment_method, manual_request_id
) values (
  'df160000-0000-4000-8000-000000000002',
  'df110000-0000-4000-8000-000000000001',
  'df150000-0000-4000-8000-000000000001',
  'df100000-0000-4000-8000-000000000003',
  'Manual member billing guide', 'approved',
  'df100000-0000-4000-8000-000000000001', statement_timestamp(), 'bank_transfer',
  'df170000-0000-4000-8000-000000000001'
);

update public.community_membership_plans
set status = 'archived'
where id = 'df150000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims', '{"sub":"df100000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select pg_temp.community_billing_guidance_assert(
  exists (
    select 1
    from public.community_membership_plans
    where id = 'df150000-0000-4000-8000-000000000001'
      and external_payment_url = 'https://buy.stripe.com/test-payment'
      and external_customer_portal_url = 'https://billing.stripe.com/p/login/test-portal'
      and payment_setup_checklist->>'customerPortalTested' = 'true'
  ),
  'a member with an approved external contract retains the management projection after enrollment closes'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"df100000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select pg_temp.community_billing_guidance_assert(
  not exists (
    select 1
    from public.community_membership_plans
    where id = 'df150000-0000-4000-8000-000000000001'
  ),
  'a manual-payment claimant cannot read an archived Stripe management projection'
);
reset role;

select pg_temp.community_billing_guidance_assert(
  pg_temp.community_billing_guidance_denied(
    $q$insert into public.community_membership_plans(
      community_id, entitlement_key, name, amount_yen, billing_interval,
      payment_provider_label, external_payment_url, external_customer_portal_url,
      status, created_by_user_id
    ) values (
      'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Unsafe portal', 10000, 'month',
      'Stripe', 'https://buy.stripe.com/test-payment', 'http://billing.example.invalid',
      'draft', 'df100000-0000-4000-8000-000000000001'
    )$q$,
    '23514'
  ),
  'insecure management URL is rejected'
);

select pg_temp.community_billing_guidance_assert(
  pg_temp.community_billing_guidance_denied(
    $q$insert into public.community_membership_plans(
      community_id, entitlement_key, name, amount_yen, billing_interval,
      payment_provider_label, external_payment_url, external_customer_portal_url,
      status, created_by_user_id
    ) values (
      'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Personal portal session', 10000, 'month',
      'Stripe', 'https://buy.stripe.com/test-payment', 'https://billing.stripe.com/p/session/private-customer',
      'draft', 'df100000-0000-4000-8000-000000000001'
    )$q$,
    '23514'
  ),
  'personal portal session URL is rejected'
);

select pg_temp.community_billing_guidance_assert(
  pg_temp.community_billing_guidance_denied(
    $q$insert into public.community_membership_plans(
      community_id, entitlement_key, name, amount_yen, billing_interval,
      payment_provider_label, external_payment_url, external_customer_portal_url,
      status, created_by_user_id
    ) values (
      'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Credential portal URL', 10000, 'month',
      'Stripe', 'https://buy.stripe.com/test-payment', 'https://member:secret@billing.stripe.com/p/login/test-portal',
      'draft', 'df100000-0000-4000-8000-000000000001'
    )$q$,
    '23514'
  ),
  'userinfo credentials in a portal URL are rejected'
);

select pg_temp.community_billing_guidance_assert(
  pg_temp.community_billing_guidance_denied(
    $q$insert into public.community_membership_plans(
      community_id, entitlement_key, name, amount_yen, billing_interval,
      payment_provider_label, external_payment_url, external_customer_portal_url,
      status, created_by_user_id
    ) values (
      'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Personalized portal URL', 10000, 'month',
      'Stripe', 'https://buy.stripe.com/test-payment', 'https://billing.stripe.com/p/login/test-portal?prefilled_email=member@example.invalid',
      'draft', 'df100000-0000-4000-8000-000000000001'
    )$q$,
    '23514'
  ),
  'personalizing query strings in a portal URL are rejected'
);

select pg_temp.community_billing_guidance_assert(
  pg_temp.community_billing_guidance_denied(
    $q$insert into public.community_membership_plans(
      community_id, entitlement_key, name, amount_yen, billing_interval,
      payment_provider_label, external_payment_url, payment_setup_checklist,
      status, created_by_user_id
    ) values (
      'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Invalid checklist', 10000, 'month',
      'Stripe', 'https://buy.stripe.com/test-payment',
      '{"productCreated":true,"recurringPriceConfirmed":true,"paymentLinkTested":true,"customerPortalEnabled":true,"customerPortalTested":true,"providerVerified":true}'::jsonb,
      'draft', 'df100000-0000-4000-8000-000000000001'
    )$q$,
    '23514'
  ),
  'checklist cannot masquerade as provider verification'
);

select pg_temp.community_billing_guidance_assert(
  pg_temp.community_billing_guidance_denied(
    $q$insert into public.community_membership_plans(
      community_id, entitlement_key, name, amount_yen, billing_interval,
      payment_provider_label, external_payment_url, payment_setup_checklist,
      status, created_by_user_id
    ) values (
      'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Missing checklist key', 10000, 'month',
      'Stripe', 'https://buy.stripe.com/test-payment',
      '{"productCreated":true,"recurringPriceConfirmed":true,"paymentLinkTested":true,"customerPortalEnabled":true}'::jsonb,
      'draft', 'df100000-0000-4000-8000-000000000001'
    )$q$,
    '23514'
  ),
  'checklist cannot omit a required key'
);

select pg_temp.community_billing_guidance_assert(
  pg_temp.community_billing_guidance_denied(
    $q$insert into public.community_membership_plans(
      community_id, entitlement_key, name, amount_yen, billing_interval,
      payment_provider_label, external_payment_url, payment_setup_checklist,
      status, created_by_user_id
    ) values (
      'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Empty checklist object', 10000, 'month',
      'Stripe', 'https://buy.stripe.com/test-payment', '{}'::jsonb,
      'draft', 'df100000-0000-4000-8000-000000000001'
    )$q$,
    '23514'
  ),
  'empty checklist object is rejected'
);

select pg_temp.community_billing_guidance_assert(
  pg_temp.community_billing_guidance_denied(
    $q$insert into public.community_membership_plans(
      community_id, entitlement_key, name, amount_yen, billing_interval,
      payment_provider_label, external_payment_url, payment_setup_checklist,
      status, created_by_user_id
    ) values (
      'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Null checklist value', 10000, 'month',
      'Stripe', 'https://buy.stripe.com/test-payment',
      '{"productCreated":true,"recurringPriceConfirmed":true,"paymentLinkTested":true,"customerPortalEnabled":true,"customerPortalTested":null}'::jsonb,
      'draft', 'df100000-0000-4000-8000-000000000001'
    )$q$,
    '23514'
  ),
  'JSON null in a required checklist key is rejected'
);

select pg_temp.community_billing_guidance_assert(
  pg_temp.community_billing_guidance_denied(
    $q$insert into public.community_membership_plans(
      community_id, entitlement_key, name, amount_yen, billing_interval,
      payment_provider_label, external_payment_url, payment_setup_checklist,
      status, created_by_user_id
    ) values (
      'df110000-0000-4000-8000-000000000001', 'paid:guide', 'Wrong checklist type', 10000, 'month',
      'Stripe', 'https://buy.stripe.com/test-payment',
      '{"productCreated":true,"recurringPriceConfirmed":true,"paymentLinkTested":true,"customerPortalEnabled":true,"customerPortalTested":"yes"}'::jsonb,
      'draft', 'df100000-0000-4000-8000-000000000001'
    )$q$,
    '23514'
  ),
  'non-boolean checklist value is rejected'
);

select pg_temp.community_billing_guidance_assert(
  not exists (
    select 1
    from public.community_member_entitlements
    where community_id = 'df110000-0000-4000-8000-000000000001'
      and user_id = 'df100000-0000-4000-8000-000000000002'
  ),
  'saving links and checklist never grants an entitlement'
);

select 'community_membership_billing_guidance_test_ok' as result;
rollback;
