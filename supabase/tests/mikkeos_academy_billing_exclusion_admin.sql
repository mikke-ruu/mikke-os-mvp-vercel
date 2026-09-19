-- Run in one outer BEGIN/ROLLBACK transaction against the current final schema.

create or replace function pg_temp.billing_exclusion_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'billing_exclusion_admin_assertion_failed: %', p_message;
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'billing-admin@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'billing-target@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.profiles (id, user_id, display_name, handle, member_number) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Billing Admin', 'billing_admin', 991000000),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'Billing Target', 'academy_e2e_learner', 991000001);

insert into public.academy_headquarters (
  id, owner_user_id, owner_profile_id, name, handle, plan, is_active
) values (
  'c1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'Billing Exclusion HQ', 'billing-exclusion-hq', 'small', true
);

insert into public.academy_headquarters_access_states (
  headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
) values (
  'c1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'paid', 'active', now(), now()
);

insert into platform_billing_private.internal_resource_grants (
  actor_user_id, product_key, resource_id, purpose, reason,
  granted_by, evidence, starts_at
) values (
  'a1000000-0000-4000-8000-000000000001', 'academy_platform',
  'c1000000-0000-4000-8000-000000000001', 'test_only',
  'rollback-only exclusion fixture',
  'a1000000-0000-4000-8000-000000000001',
  'isolated current-master SQL test', now()
);

-- Fresh databases have no production users. Bind the deterministic Academy
-- owner fixture as @ayumi only when the migration left the admin ledger empty.
do $fixture_admin$
begin
  if not exists (select 1 from platform_billing_private.academy_billing_exclusion_admins) then
    update public.profiles set handle = 'ayumi'
    where user_id = 'a1000000-0000-4000-8000-000000000001';

    insert into public.mikkeos_hq_staff_members(user_id, role, is_active)
    values ('a1000000-0000-4000-8000-000000000001', 'owner', true)
    on conflict (user_id) do update set role = 'owner', is_active = true;

    insert into platform_billing_private.academy_billing_exclusion_admins(
      actor_user_id, canonical_handle, approval_evidence
    ) values (
      'a1000000-0000-4000-8000-000000000001', 'ayumi',
      'rollback-only isolated fixture'
    );
  end if;
end;
$fixture_admin$;

select set_config(
  'billing_exclusion_test.admin_user_id',
  (select actor_user_id::text from platform_billing_private.academy_billing_exclusion_admins where canonical_handle = 'ayumi'),
  true
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
do $direct_write_denied$
begin
  begin
    insert into public.academy_instructor_billing_exclusions(
      headquarters_id, profile_id, reason
    ) values (
      'c1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002',
      'must be rejected'
    );
    raise exception 'expected direct service-role write denial';
  exception when insufficient_privilege then null;
  end;
end;
$direct_write_denied$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
do $wrong_actor_denied$
begin
  begin
    perform public.mikkeos_academy_billing_exclusion_list(
      current_setting('billing_exclusion_test.admin_user_id')::uuid
    );
    raise exception 'expected non-ayumi denial';
  exception when insufficient_privilege then
    if sqlerrm <> 'MIKKEOS_BILLING_EXCLUSION_FORBIDDEN' then raise; end if;
  end;
end;
$wrong_actor_denied$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', current_setting('billing_exclusion_test.admin_user_id'), true);

select set_config(
  'billing_exclusion_test.exclusion_id',
  public.mikkeos_academy_billing_exclusion_grant(
    current_setting('billing_exclusion_test.admin_user_id')::uuid,
    'c1000000-0000-4000-8000-000000000001',
    'academy_e2e_learner', 'rollback-only test account', null
  ) ->> 'id',
  true
);

select pg_temp.billing_exclusion_assert(
  (public.mikkeos_academy_billing_exclusion_grant(
    current_setting('billing_exclusion_test.admin_user_id')::uuid,
    'c1000000-0000-4000-8000-000000000001',
    '@academy_e2e_learner', 'rollback-only test account', null
  ) ->> 'created')::boolean = false,
  'same HQ and mikke ID must be idempotent'
);

select pg_temp.billing_exclusion_assert(
  jsonb_array_length(public.mikkeos_academy_billing_exclusion_list(
    current_setting('billing_exclusion_test.admin_user_id')::uuid
  ) -> 'exclusions') >= 1,
  '@ayumi must be able to list exclusions'
);

select public.mikkeos_academy_billing_exclusion_revoke(
  current_setting('billing_exclusion_test.admin_user_id')::uuid,
  current_setting('billing_exclusion_test.exclusion_id')::uuid,
  'rollback-only revoke verification'
);
reset role;

select pg_temp.billing_exclusion_assert(
  exists (
    select 1 from public.academy_instructor_billing_exclusions exclusion
    where exclusion.headquarters_id = 'c1000000-0000-4000-8000-000000000001'
      and exclusion.profile_id = 'b1000000-0000-4000-8000-000000000002'
      and exclusion.effective_until is not null
  ),
  'revoke must close the effective window'
);

select pg_temp.billing_exclusion_assert(
  (select count(*) from platform_billing_private.academy_billing_exclusion_events
   where target_profile_id = 'b1000000-0000-4000-8000-000000000002') = 2,
  'one grant and one revoke audit event must remain'
);

select 'mikkeos_academy_billing_exclusion_admin_sql_ok' as sentinel;
