-- Academy monthly billing snapshot/RLS test against the current final schema.
-- The caller owns the outer BEGIN/ROLLBACK transaction.

create or replace function pg_temp.academy_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'academy_e2e_assertion_failed: %', p_message;
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values (
  'a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'academy-billing-owner@example.invalid', now(), '{}'::jsonb, '{}'::jsonb,
  now(), now(), false, false
);

insert into public.profiles (id, user_id, display_name, handle, member_number)
values (
  'b1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Academy Billing Owner', 'academy_billing_owner', 991000000
);

insert into public.academy_headquarters (
  id, owner_user_id, owner_profile_id, name, handle, plan, is_active, created_at
) values (
  'c1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'Academy Billing HQ', 'academy-billing-hq', 'small', true,
  '2025-12-01 00:00:00+09'
);

insert into public.academy_headquarters_access_states (
  headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
) values (
  'c1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'paid', 'active', '2025-12-01 00:00:00+09', '2025-12-01 00:00:00+09'
);

insert into platform_billing_private.internal_resource_grants (
  actor_user_id, product_key, resource_id, purpose, reason,
  granted_by, evidence, starts_at
) values (
  'a1000000-0000-4000-8000-000000000001', 'academy_platform',
  'c1000000-0000-4000-8000-000000000001', 'test_only',
  'rollback-only billing fixture',
  'a1000000-0000-4000-8000-000000000001',
  'isolated current-master SQL test', '2025-12-01 00:00:00+09'
);

insert into public.academy_courses (
  id, headquarters_id, user_id, code, name, formats, is_published
) values (
  'd1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'BILLING', 'Billing Fixture', array['online'], false
);

create temporary table academy_billing_test_people (
  n integer primary key,
  user_id uuid not null,
  profile_id uuid not null
) on commit drop;

insert into academy_billing_test_people(n, user_id, profile_id)
select n, gen_random_uuid(), gen_random_uuid()
from generate_series(1, 51) n;

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
)
select
  person.user_id,
  'authenticated',
  'authenticated',
  'academy-billing-' || person.n || '@example.invalid',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
from academy_billing_test_people person;

insert into public.profiles (
  id, user_id, display_name, handle, member_number
)
select
  person.profile_id,
  person.user_id,
  'Academy Billing ' || person.n,
  'academy_billing_' || person.n,
  991000000 + person.n
from academy_billing_test_people person;

-- The HQ owner is an ordinary registered instructor and therefore counts.
insert into public.academy_instructors (
  headquarters_id, course_id, profile_id, user_id, instructor_number,
  certified_at, is_certified, is_active, status, registration_status,
  withdrawn_at, created_at
) values (
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'BILL-OWNER', '2025-12-01', true, true, 'active', 'registered',
  null, '2025-12-01 00:00:00+09'
);

insert into public.academy_instructors (
  headquarters_id, course_id, profile_id, user_id, instructor_number,
  certified_at, is_certified, is_active, status, registration_status,
  withdrawn_at, created_at
)
select
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  person.profile_id,
  person.user_id,
  'BILL-' || lpad(person.n::text, 3, '0'),
  '2025-12-01'::date,
  true,
  case when person.n in (2, 3) then false else true end,
  case when person.n = 2 then 'dormant'
       when person.n = 3 then 'suspended'
       else 'active' end,
  case when person.n = 50 then 'withdrawn' else 'registered' end,
  case when person.n = 50 then '2026-05-15 12:00:00+09'::timestamptz end,
  case
    when person.n <= 19 then '2025-12-01 00:00:00+09'::timestamptz
    when person.n = 20 then '2026-02-15 00:00:00+09'::timestamptz
    else '2026-04-15 00:00:00+09'::timestamptz
  end
from academy_billing_test_people person;

-- Test accounts are excluded by an internal-only effective-dated ledger, not
-- by a field that HQ users can toggle to reduce their own bill.
insert into public.academy_instructor_billing_exclusions (
  headquarters_id, profile_id, reason, effective_from
)
select
  'c1000000-0000-4000-8000-000000000001',
  person.profile_id,
  'transaction-only automated test profile',
  '2026-04-01 00:00:00+09'
from academy_billing_test_people person
where person.n = 51;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select public.academy_capture_month_end_billing_snapshot(
  'c1000000-0000-4000-8000-000000000001',
  '2026-01-01', '2026-02-01 01:00:00+09'
);
select public.academy_capture_month_end_billing_snapshot(
  'c1000000-0000-4000-8000-000000000001',
  '2026-02-01', '2026-03-01 01:00:00+09'
);
select public.academy_capture_month_end_billing_snapshot(
  'c1000000-0000-4000-8000-000000000001',
  '2026-03-01', '2026-04-01 01:00:00+09'
);
select public.academy_capture_month_end_billing_snapshot(
  'c1000000-0000-4000-8000-000000000001',
  '2026-04-01', '2026-05-01 01:00:00+09'
);
select public.academy_capture_month_end_billing_snapshot(
  'c1000000-0000-4000-8000-000000000001',
  '2026-05-01', '2026-06-01 01:00:00+09'
);

select pg_temp.academy_assert(
  exists (
    select 1 from public.academy_monthly_billing_snapshots snapshot
    where snapshot.snapshot_month = '2026-01-01'
      and snapshot.registered_instructor_count = 20
      and snapshot.catalog_price_yen = 5000
      and snapshot.charge_price_yen = 5000
      and snapshot.price_notice_required = false
  ),
  'the owner must count and active/dormant/suspended registered people must count once'
);
select pg_temp.academy_assert(
  exists (
    select 1 from public.academy_monthly_billing_snapshots snapshot
    where snapshot.snapshot_month = '2026-02-01'
      and snapshot.registered_instructor_count = 21
      and snapshot.catalog_price_yen = 10000
      and snapshot.charge_price_yen = 5000
      and snapshot.price_notice_required = true
  ),
  '21 people must keep the coming month at 5000 yen and raise a notice'
);
select pg_temp.academy_assert(
  exists (
    select 1 from public.academy_monthly_billing_snapshots snapshot
    where snapshot.snapshot_month = '2026-03-01'
      and snapshot.registered_instructor_count = 21
      and snapshot.charge_price_yen = 10000
      and snapshot.price_notice_required = false
  ),
  'a sustained count of 21 must apply 10000 yen at the following renewal'
);
select pg_temp.academy_assert(
  exists (
    select 1 from public.academy_monthly_billing_snapshots snapshot
    where snapshot.snapshot_month = '2026-04-01'
      and snapshot.registered_instructor_count = 51
      and snapshot.catalog_price_yen = 20000
      and snapshot.charge_price_yen = 10000
      and snapshot.price_notice_required = true
  ),
  '51 people must keep the coming month at 10000 yen and exclude test profiles'
);
select pg_temp.academy_assert(
  exists (
    select 1 from public.academy_monthly_billing_snapshots snapshot
    where snapshot.snapshot_month = '2026-05-01'
      and snapshot.registered_instructor_count = 50
      and snapshot.catalog_price_yen = 10000
      and snapshot.charge_price_yen = 10000
      and snapshot.price_notice_required = false
  ),
  'a mid-month withdrawal must be excluded from the following month charge'
);

select pg_temp.academy_assert(
  (select count(*) = 5
   from public.academy_monthly_billing_snapshots
   where headquarters_id = 'c1000000-0000-4000-8000-000000000001'),
  'one immutable snapshot must exist per headquarters and month'
);

-- Capturing the same month again is idempotent.
select public.academy_capture_month_end_billing_snapshot(
  'c1000000-0000-4000-8000-000000000001',
  '2026-05-01', '2026-06-02 01:00:00+09'
);
select pg_temp.academy_assert(
  (select count(*) = 5
   from public.academy_monthly_billing_snapshots
   where headquarters_id = 'c1000000-0000-4000-8000-000000000001'),
  'retries must not create a second snapshot'
);

do $$
begin
  update public.academy_monthly_billing_snapshots
  set charge_price_yen = 0
  where headquarters_id = 'c1000000-0000-4000-8000-000000000001'
    and snapshot_month = '2026-05-01';
  raise exception 'academy_e2e_expected_snapshot_mutation_rejection';
exception
  when others then
    if sqlerrm = 'academy_e2e_expected_snapshot_mutation_rejection'
      or sqlerrm <> 'academy_billing_snapshot_is_immutable' then
      raise;
    end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select pg_temp.academy_assert(
  exists (
    select 1
    from public.academy_get_my_billing_snapshot(
      'c1000000-0000-4000-8000-000000000001', null
    ) snapshot
    where snapshot.snapshot_month = '2026-05-01'
      and snapshot.registered_instructor_count = 50
      and snapshot.charge_price_yen = 10000
  ),
  'only the owner aggregate RPC must expose the latest billing result'
);

select set_config('request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000003', true);
do $$
begin
  perform *
  from public.academy_get_my_billing_snapshot(
    'c1000000-0000-4000-8000-000000000001', null
  );
  raise exception 'academy_e2e_expected_billing_owner_rejection';
exception
  when others then
    if sqlerrm = 'academy_e2e_expected_billing_owner_rejection'
      or sqlerrm <> 'academy_billing_owner_required' then
      raise;
    end if;
end;
$$;

reset role;
select 'academy_billing_snapshot_e2e_ok' as result;
