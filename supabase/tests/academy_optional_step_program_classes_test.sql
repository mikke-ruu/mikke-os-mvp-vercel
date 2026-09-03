-- Run only after 20260902041651_academy_optional_step_program_classes in an
-- isolated database. The caller owns BEGIN/ROLLBACK; never run on production.

create or replace function pg_temp.academy_optional_class_assert_raises(p_sql text, p_expected text)
returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise exception 'academy_optional_class_expected_error_not_raised: %', p_expected;
exception
  when others then
    if sqlerrm = 'academy_optional_class_expected_error_not_raised: ' || p_expected
      or position(p_expected in sqlerrm) = 0
    then
      raise;
    end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values
  ('a9200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'optional-class-owner@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('a9200000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'optional-class-other@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.profiles (id, user_id, display_name, handle, member_number) values
  ('b9200000-0000-4000-8000-000000000001', 'a9200000-0000-4000-8000-000000000001', 'Optional Class Owner', 'optional_class_owner', 999200001),
  ('b9200000-0000-4000-8000-000000000002', 'a9200000-0000-4000-8000-000000000002', 'Optional Class Other', 'optional_class_other', 999200002);

insert into public.academy_headquarters (
  id, owner_user_id, owner_profile_id, name, handle, plan, is_active
) values (
  'c9200000-0000-4000-8000-000000000001',
  'a9200000-0000-4000-8000-000000000001',
  'b9200000-0000-4000-8000-000000000001',
  'Optional Class Academy', 'optional-class-academy', 'small', true
);

insert into public.academy_headquarters_access_states (
  headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
) values (
  'c9200000-0000-4000-8000-000000000001',
  'a9200000-0000-4000-8000-000000000001',
  'paid', 'active', now() - interval '1 day', now() - interval '1 day'
);

insert into public.academy_courses (
  id, headquarters_id, user_id, code, name, formats, feature_settings
) values
  (
    'd9200000-0000-4000-8000-000000000001',
    'c9200000-0000-4000-8000-000000000001',
    'a9200000-0000-4000-8000-000000000001',
    'NO-STEP', 'ステップ教材なし講座', array['in_person'],
    '{"stepLearning":false,"classes":true}'::jsonb
  ),
  (
    'd9200000-0000-4000-8000-000000000002',
    'c9200000-0000-4000-8000-000000000001',
    'a9200000-0000-4000-8000-000000000001',
    'WITH-STEP', 'ステップ教材あり講座', array['online'],
    '{"stepLearning":true,"classes":true}'::jsonb
  );

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9200000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);

-- A normal workshop/text course can create fixed and arranged classes without
-- manufacturing an online program.
insert into public.academy_classes (
  id, headquarters_id, course_id, program_id, program_version_id,
  title, starts_at, ends_at, schedule_mode, format, registration_status,
  status, created_by_user_id
) values (
  'e9200000-0000-4000-8000-000000000001',
  'c9200000-0000-4000-8000-000000000001',
  'd9200000-0000-4000-8000-000000000001',
  null, null, '対面開催', now() + interval '7 days', null,
  'fixed', 'in_person', 'draft', 'planned',
  'a9200000-0000-4000-8000-000000000001'
), (
  'e9200000-0000-4000-8000-000000000002',
  'c9200000-0000-4000-8000-000000000001',
  'd9200000-0000-4000-8000-000000000001',
  null, null, '申込後に相談', null, null,
  'arranged_after_application', 'in_person', 'open', 'planned',
  'a9200000-0000-4000-8000-000000000001'
);

select pg_temp.academy_optional_class_assert_raises(
  $$insert into public.academy_classes (
    headquarters_id, course_id, program_id, title, starts_at, schedule_mode,
    format, registration_status, status, created_by_user_id
  ) values (
    'c9200000-0000-4000-8000-000000000001',
    'd9200000-0000-4000-8000-000000000001', null,
    '日時なし固定開催', null, 'fixed', 'in_person', 'draft', 'planned',
    'a9200000-0000-4000-8000-000000000001'
  )$$,
  'academy_classes_schedule_start_check'
);

-- A course that explicitly uses step learning still requires a published
-- program/version.
select pg_temp.academy_optional_class_assert_raises(
  $$insert into public.academy_classes (
    headquarters_id, course_id, program_id, title, starts_at, schedule_mode,
    format, registration_status, status, created_by_user_id
  ) values (
    'c9200000-0000-4000-8000-000000000001',
    'd9200000-0000-4000-8000-000000000002', null,
    '教材必須開催', now() + interval '8 days', 'fixed', 'online', 'draft', 'planned',
    'a9200000-0000-4000-8000-000000000001'
  )$$,
  'academy_class_program_required'
);

-- A different authenticated user cannot create a class inside this HQ.
select set_config('request.jwt.claims', '{"sub":"a9200000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
select pg_temp.academy_optional_class_assert_raises(
  $$insert into public.academy_classes (
    headquarters_id, course_id, program_id, title, starts_at, schedule_mode,
    format, registration_status, status, created_by_user_id
  ) values (
    'c9200000-0000-4000-8000-000000000001',
    'd9200000-0000-4000-8000-000000000001', null,
    '他人の開催', now() + interval '9 days', 'fixed', 'in_person', 'draft', 'planned',
    'a9200000-0000-4000-8000-000000000002'
  )$$,
  'row-level security policy'
);
reset role;

select 'academy_optional_step_program_classes_ok' as result;
