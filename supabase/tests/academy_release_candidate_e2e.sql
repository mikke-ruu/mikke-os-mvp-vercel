-- Academy release-candidate database/RLS test.
-- Run only after the Academy migrations under test have been applied in the
-- same transaction. The caller must wrap this file in BEGIN/ROLLBACK.

create or replace function pg_temp.academy_assert(
  p_condition boolean,
  p_message text
)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'academy_e2e_assertion_failed: %', p_message;
  end if;
end;
$$;

-- All fixtures use reserved, deterministic UUIDs and are rolled back.
insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
) values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'academy-e2e-owner@example.invalid', now(), '{}'::jsonb, '{}'::jsonb,
   now(), now(), false, false),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'academy-e2e-learner@example.invalid', now(), '{}'::jsonb, '{}'::jsonb,
   now(), now(), false, false),
  ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'academy-e2e-unrelated@example.invalid', now(), '{}'::jsonb, '{}'::jsonb,
   now(), now(), false, false);

insert into public.profiles (
  id, user_id, display_name, handle, member_number
) values
  ('b1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001',
   'Academy E2E Owner', 'academy_e2e_owner', 990000001),
  ('b1000000-0000-4000-8000-000000000002',
   'a1000000-0000-4000-8000-000000000002',
   'Academy E2E Learner', 'academy_e2e_learner', 990000002),
  ('b1000000-0000-4000-8000-000000000003',
   'a1000000-0000-4000-8000-000000000003',
   'Academy E2E Unrelated', 'academy_e2e_unrelated', 990000003);

insert into public.academy_headquarters (
  id, owner_user_id, owner_profile_id, name, handle, plan,
  next_instructor_number
) values (
  'c1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'Academy E2E Headquarters', 'academy-e2e-headquarters', 'small', 7001
);

insert into public.academy_headquarters_access_states (
  headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
) values (
  'c1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'paid', 'active', now(), now()
);

insert into public.academy_courses (
  id, headquarters_id, user_id, code, name, price, is_published,
  learner_access_mode, learner_access_days
) values
  ('d1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001',
   'E2E-ACTIVE', 'Academy E2E Active Course', 33000, true,
   'days_after_payment', 365),
  ('d1000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001',
   'E2E-EXPIRED', 'Academy E2E Expired Course', 22000, true,
   'days_after_payment', 365);

insert into public.academy_learner_pages (
  id, headquarters_id, course_id, user_id, blocks, is_published
) values
  ('e1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001',
   '[{"type":"text","value":"active learner page"}]'::jsonb, true),
  ('e1000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000002',
   'a1000000-0000-4000-8000-000000000001',
   '[{"type":"text","value":"expired learner page"}]'::jsonb, true);

insert into public.academy_instructor_pages (
  id, headquarters_id, course_id, user_id, blocks
) values (
  'f1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  '[{"type":"text","value":"instructor operations"}]'::jsonb
);

insert into public.academy_materials (
  id, headquarters_id, course_id, user_id, kind, title, url,
  requires_active, is_published
) values (
  'f2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'pdf', 'Instructor Manual', 'https://example.invalid/instructor.pdf',
  true, true
);

insert into public.academy_applications (
  id, headquarters_id, course_id, user_id, intake_source,
  applicant_name, applicant_email, price, status, payment_status,
  payment_provider, certification_status, created_at
) values
  ('a2000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001', null, 'honbu',
   'Academy E2E Learner', 'academy-e2e-learner@example.invalid', 33000,
   'awaiting_payment', 'unpaid', 'stripe', 'not_yet', now()),
  ('a2000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000002', null, 'honbu',
   'Academy E2E Learner', 'academy-e2e-learner@example.invalid', 22000,
   'paid', 'paid', 'manual', 'not_yet', now() - interval '366 days');

-- Payment is recorded by the provider webhook role. No learner access is
-- created until the application is safely attached to a verified account.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select pg_temp.academy_assert(
  public.academy_record_payment_event(
    'stripe', 'academy-e2e-payment-event',
    'a2000000-0000-4000-8000-000000000001',
    'academy-e2e-payment', 33000, 'JPY', true
  ),
  'the payment event must be accepted once'
);
select pg_temp.academy_assert(
  not public.academy_record_payment_event(
    'stripe', 'academy-e2e-payment-event',
    'a2000000-0000-4000-8000-000000000001',
    'academy-e2e-payment', 33000, 'JPY', true
  ),
  'the payment event must be idempotent'
);
reset role;

select pg_temp.academy_assert(
  (select status = 'paid' and payment_status = 'paid' and paid_at is not null
   from public.academy_applications
   where id = 'a2000000-0000-4000-8000-000000000001'),
  'the service-role payment event must persist its validated payment fields'
);
select pg_temp.academy_assert(
  (select count(*) = 0
   from public.academy_course_access_grants
   where application_id = 'a2000000-0000-4000-8000-000000000001'),
  'payment without a claimed user must not create a learner grant'
);

-- A different signed-in person cannot claim or inspect the application.
set local role authenticated;
select set_config('request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  perform public.academy_claim_my_application(
    'a2000000-0000-4000-8000-000000000001'
  );
  raise exception 'academy_e2e_expected_claim_rejection';
exception
  when others then
    if sqlerrm = 'academy_e2e_expected_claim_rejection'
      or sqlerrm <> 'academy_application_claim_not_available' then
      raise;
    end if;
end;
$$;

select pg_temp.academy_assert(
  (select count(*) = 0
   from public.academy_applications
   where id = 'a2000000-0000-4000-8000-000000000001'),
  'an unrelated account must not read the application'
);
select pg_temp.academy_assert(
  (select count(*) = 0 from public.academy_learner_pages),
  'an unrelated account must not read learner content'
);

-- The matching verified account claims both applications. The paid event and
-- historic paid application create fixed access-window snapshots.
select set_config('request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002', true);
select pg_temp.academy_assert(
  public.academy_claim_my_application(
    'a2000000-0000-4000-8000-000000000001'
  ),
  'the verified learner must claim the active application'
);
select pg_temp.academy_assert(
  public.academy_claim_my_application(
    'a2000000-0000-4000-8000-000000000002'
  ),
  'the verified learner must claim the historic application'
);

select pg_temp.academy_assert(
  (select count(*) = 2
   from public.academy_applications
   where user_id = 'a1000000-0000-4000-8000-000000000002'),
  'the learner must retain both application history rows'
);
select pg_temp.academy_assert(
  (select count(*) = 1
   from public.academy_learner_pages
   where course_id = 'd1000000-0000-4000-8000-000000000001'),
  'the active paid course learner page must be readable'
);
select pg_temp.academy_assert(
  (select count(*) = 0
   from public.academy_learner_pages
   where course_id = 'd1000000-0000-4000-8000-000000000002'),
  'expired course content must be hidden while history remains'
);
select pg_temp.academy_assert(
  (select count(*) = 0 from public.academy_materials),
  'a learner who is not an instructor must not read instructor materials'
);
select pg_temp.academy_assert(
  (select count(*) = 0 from public.academy_instructor_pages),
  'a learner who is not an instructor must not read instructor pages'
);

select pg_temp.academy_assert(
  exists (
    select 1 from public.academy_list_my_contexts() context
    where context.academy_id = 'c1000000-0000-4000-8000-000000000001'
      and 'learner' = any(context.roles)
      and not ('instructor' = any(context.roles))
  ),
  'the personal portal context must initially be learner-only'
);

-- Only HQ management certifies and promotes the willing learner. Promotion
-- preserves learner access while adding the instructor capabilities.
select set_config('request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001', true);
update public.academy_applications
set certification_status = 'certified', status = 'certified'
where id = 'a2000000-0000-4000-8000-000000000001';

select public.academy_promote_certified_application(
  'a2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002'
);

select pg_temp.academy_assert(
  (select count(*) = 1
   from public.academy_instructors
   where headquarters_id = 'c1000000-0000-4000-8000-000000000001'
     and profile_id = 'b1000000-0000-4000-8000-000000000002'
     and registration_status = 'registered'
     and instructor_number = '7001'),
  'promotion must create one numbered registered instructor ledger row'
);

select set_config('request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002', true);
select pg_temp.academy_assert(
  (select count(*) = 1 from public.academy_materials),
  'the promoted active instructor must read instructor materials'
);
select pg_temp.academy_assert(
  (select count(*) = 1 from public.academy_instructor_pages),
  'the promoted active instructor must read instructor operations pages'
);
select pg_temp.academy_assert(
  exists (
    select 1 from public.academy_list_my_contexts() context
    where context.academy_id = 'c1000000-0000-4000-8000-000000000001'
      and 'learner' = any(context.roles)
      and 'instructor' = any(context.roles)
  ),
  'one My Portal context must combine learner and instructor roles'
);

-- Registration withdrawal excludes the person from the billable registered
-- count and instructor-only access, but keeps the private certification ledger.
select set_config('request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001', true);
select public.academy_withdraw_instructor(
  (select id from public.academy_instructors
   where profile_id = 'b1000000-0000-4000-8000-000000000002'
     and course_id = 'd1000000-0000-4000-8000-000000000001')
);

select pg_temp.academy_assert(
  (select count(*) = 0
   from public.academy_instructors
   where headquarters_id = 'c1000000-0000-4000-8000-000000000001'
     and registration_status = 'registered'),
  'withdrawal must remove the instructor from the registered billing count'
);
select pg_temp.academy_assert(
  (select count(*) = 1
   from public.academy_instructors
   where headquarters_id = 'c1000000-0000-4000-8000-000000000001'
     and registration_status = 'withdrawn'
     and instructor_number = '7001'
     and certified_at is not null),
  'withdrawal must preserve the private certification ledger'
);

select set_config('request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002', true);
select pg_temp.academy_assert(
  (select count(*) = 0 from public.academy_materials),
  'a withdrawn instructor must lose instructor material access'
);
select pg_temp.academy_assert(
  (select count(*) = 1
   from public.academy_learner_pages
   where course_id = 'd1000000-0000-4000-8000-000000000001'),
  'instructor withdrawal must not remove learner access'
);

reset role;
select 'academy_release_candidate_e2e_ok' as result;
