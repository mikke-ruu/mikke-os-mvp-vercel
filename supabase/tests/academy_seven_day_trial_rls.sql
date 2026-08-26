-- Academy seven-day trial database/RLS test.
-- Run only on a disposable database after all Academy migrations through
-- 20260826033657 have been applied. The caller must wrap this file in
-- BEGIN/ROLLBACK. No production database is an acceptable target.

create or replace function pg_temp.academy_trial_assert(
  p_condition boolean,
  p_message text
)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'academy_trial_assertion_failed: %', p_message;
  end if;
end;
$$;

create or replace function pg_temp.academy_trial_assert_raises(
  p_sql text,
  p_expected_message text
)
returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise exception 'academy_trial_expected_error_not_raised: %', p_expected_message;
exception
  when others then
    if sqlerrm = 'academy_trial_expected_error_not_raised: ' || p_expected_message
      or position(p_expected_message in sqlerrm) = 0 then
      raise;
    end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
) values
  ('a7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'academy-trial-owner@example.invalid', now(), '{}'::jsonb, '{}'::jsonb,
   now(), now(), false, false),
  ('a7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'academy-trial-expired@example.invalid', now(), '{}'::jsonb, '{}'::jsonb,
   now(), now(), false, false),
  ('a7000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'academy-trial-other@example.invalid', now(), '{}'::jsonb, '{}'::jsonb,
   now(), now(), false, false);

insert into public.profiles (
  id, user_id, display_name, handle, member_number
) values
  ('b7000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001',
   'Trial Owner', 'academy_trial_owner', 997000001),
  ('b7000000-0000-4000-8000-000000000002',
   'a7000000-0000-4000-8000-000000000002',
   'Expired Trial Owner', 'academy_trial_expired', 997000002),
  ('b7000000-0000-4000-8000-000000000003',
   'a7000000-0000-4000-8000-000000000003',
   'Other User', 'academy_trial_other', 997000003);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub',
  'a7000000-0000-4000-8000-000000000001', true);

select public.academy_start_seven_day_trial('Trial Academy');

select pg_temp.academy_trial_assert_raises(
  'select * from public.academy_headquarters_access_states',
  'permission denied'
);
select pg_temp.academy_trial_assert_raises(
  'select * from public.academy_trial_usage_ledger',
  'permission denied'
);
select pg_temp.academy_trial_assert_raises(
  $$select public.academy_start_seven_day_trial('Second Trial')$$,
  'academy_trial_headquarters_already_owned'
);
select pg_temp.academy_trial_assert_raises(
  $$update public.academy_headquarters
    set is_active = true
    where owner_user_id = 'a7000000-0000-4000-8000-000000000001'$$,
  'academy_trial_headquarters_protected_fields'
);

insert into public.academy_courses (
  id, headquarters_id, user_id, code, name, price, is_published
) select
  'd7000000-0000-4000-8000-000000000001', headquarters.id,
  'a7000000-0000-4000-8000-000000000001',
  'TRIAL-DRAFT', 'Trial Draft Course', 0, false
from public.academy_headquarters headquarters
where headquarters.owner_user_id = 'a7000000-0000-4000-8000-000000000001';

select pg_temp.academy_trial_assert_raises(
  $$update public.academy_courses
    set is_published = true
    where id = 'd7000000-0000-4000-8000-000000000001'$$,
  'academy_trial_publishing_unavailable'
);

insert into public.academy_programs (
  id, headquarters_id, course_id, title, status
) select
  'e7000000-0000-4000-8000-000000000001', headquarters.id,
  'd7000000-0000-4000-8000-000000000001',
  'Trial Draft Program', 'draft'
from public.academy_headquarters headquarters
where headquarters.owner_user_id = 'a7000000-0000-4000-8000-000000000001';

insert into public.academy_program_sections (id, program_id, title, sort_order)
values (
  'e7100000-0000-4000-8000-000000000001',
  'e7000000-0000-4000-8000-000000000001',
  'Trial Section', 1
);

select pg_temp.academy_trial_assert_raises(
  $$update public.academy_programs
    set status = 'published'
    where id = 'e7000000-0000-4000-8000-000000000001'$$,
  'academy_trial_program_publish_unavailable'
);
select pg_temp.academy_trial_assert_raises(
  $$insert into public.academy_program_steps (
      id, section_id, step_type, title, video_asset_id
    ) values (
      'e7200000-0000-4000-8000-000000000001',
      'e7100000-0000-4000-8000-000000000001',
      'video', 'Blocked hosted video',
      'e7300000-0000-4000-8000-000000000001'
    )$$,
  'academy_trial_hosted_video_unavailable'
);

select pg_temp.academy_trial_assert_raises(
  $$insert into public.academy_course_access_grants (
      headquarters_id, course_id, learner_user_id, source,
      status, starts_at, created_by_user_id
    ) select headquarters.id,
      'd7000000-0000-4000-8000-000000000001',
      'a7000000-0000-4000-8000-000000000003',
      'manual', 'active', now(),
      'a7000000-0000-4000-8000-000000000001'
    from public.academy_headquarters headquarters
    where headquarters.owner_user_id = 'a7000000-0000-4000-8000-000000000001'$$,
  'academy_trial_live_feature_unavailable'
);

reset role;

select pg_temp.academy_trial_assert(
  (select count(*) = 1
   from public.academy_trial_usage_ledger
   where owner_user_id = 'a7000000-0000-4000-8000-000000000001'),
  'one immutable trial usage row must exist'
);
select pg_temp.academy_trial_assert(
  (select trial_ends_at = starts_at + interval '7 days'
   from public.academy_headquarters_access_states
   where owner_user_id = 'a7000000-0000-4000-8000-000000000001'),
  'the trial must last exactly seven days'
);
select pg_temp.academy_trial_assert(
  private.academy_headquarters_access_mode(
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ) is null,
  'an unknown headquarters must not receive legacy paid access'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select pg_temp.academy_trial_assert_raises(
  $$insert into public.community_access_source_mappings (
      community_id, provider_type, provider_owner_key,
      source_product_key, entitlement_key, status, created_by_user_id
    ) values (
      'f7000000-0000-4000-8000-000000000001',
      'academy_subscription',
      (select id::text from public.academy_headquarters
       where owner_user_id = 'a7000000-0000-4000-8000-000000000001'),
      'trial-product', 'trial-room', 'draft',
      'a7000000-0000-4000-8000-000000000001'
    )$$,
  'academy_trial_community_unavailable'
);

update public.academy_headquarters_access_states
set access_kind = 'paid',
    status = 'active',
    trial_ends_at = null,
    paid_started_at = now()
where owner_user_id = 'a7000000-0000-4000-8000-000000000001';

select pg_temp.academy_trial_assert_raises(
  $$update public.academy_trial_usage_ledger
    set first_trial_started_at = now()
    where owner_user_id = 'a7000000-0000-4000-8000-000000000001'$$,
  'academy_trial_usage_ledger_is_immutable'
);
select pg_temp.academy_trial_assert_raises(
  $$update public.academy_headquarters_access_states
    set access_kind = 'trial', status = 'trialing',
        trial_ends_at = starts_at + interval '7 days', paid_started_at = null
    where owner_user_id = 'a7000000-0000-4000-8000-000000000001'$$,
  'academy_paid_access_cannot_return_to_trial'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub',
  'a7000000-0000-4000-8000-000000000001', true);
select pg_temp.academy_trial_assert_raises(
  $$select public.academy_start_seven_day_trial('Trial after upgrade')$$,
  'academy_trial_headquarters_already_owned'
);

select set_config('request.jwt.claim.sub',
  'a7000000-0000-4000-8000-000000000003', true);
select pg_temp.academy_trial_assert(
  (select count(*) = 0
   from public.academy_get_my_headquarters_access(
     (select id from public.academy_headquarters
      where owner_user_id = 'a7000000-0000-4000-8000-000000000001')
   )),
  'another user must not read the trial access RPC'
);

reset role;

insert into public.academy_headquarters (
  id, owner_user_id, owner_profile_id, name, handle, plan, is_active
) values (
  'c7000000-0000-4000-8000-000000000002',
  'a7000000-0000-4000-8000-000000000002',
  'b7000000-0000-4000-8000-000000000002',
  'Expired Trial Academy', 'expired-trial-academy', 'small', false
);
insert into public.academy_headquarters_access_states (
  headquarters_id, owner_user_id, access_kind, status,
  starts_at, trial_ends_at
) values (
  'c7000000-0000-4000-8000-000000000002',
  'a7000000-0000-4000-8000-000000000002',
  'trial', 'trialing', now() - interval '8 days', now() - interval '1 day'
);
insert into public.academy_trial_usage_ledger (
  owner_user_id, headquarters_id, first_trial_started_at
) values (
  'a7000000-0000-4000-8000-000000000002',
  'c7000000-0000-4000-8000-000000000002', now() - interval '8 days'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub',
  'a7000000-0000-4000-8000-000000000002', true);
select pg_temp.academy_trial_assert(
  (select status = 'expired' and not can_manage_drafts
   from public.academy_get_my_headquarters_access(
     (select id from public.academy_headquarters
      where owner_user_id = 'a7000000-0000-4000-8000-000000000002')
   )),
  'the exact boundary must become expired and read-only'
);
select pg_temp.academy_trial_assert_raises(
  $$update public.academy_headquarters
    set name = 'Expired write must fail'
    where owner_user_id = 'a7000000-0000-4000-8000-000000000002'$$,
  'academy_access_inactive'
);
reset role;

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select pg_temp.academy_trial_assert_raises(
  $$select public.academy_start_seven_day_trial('Anonymous Trial')$$,
  'permission denied'
);
reset role;

select 'academy_seven_day_trial_rls_ok' as result;
