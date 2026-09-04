begin;

create or replace function pg_temp.academy_open_trial_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'academy_open_trial_assertion_failed: %', p_message;
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values
  ('a9600000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'open-trial@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('a9600000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'anonymous-trial@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, true);

insert into public.profiles (id, user_id, display_name, handle, member_number) values
  ('b9600000-0000-4000-8000-000000000001', 'a9600000-0000-4000-8000-000000000001', 'Open Trial', 'open_trial', 999600001),
  ('b9600000-0000-4000-8000-000000000002', 'a9600000-0000-4000-8000-000000000002', 'Anonymous Trial', 'anonymous_trial', 999600002);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a9600000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);

select pg_temp.academy_open_trial_assert(
  (select trial_available and trial_block_reason is null
   from public.academy_get_my_onboarding_eligibility()),
  'first-time account can see seven-day trial'
);

select public.academy_start_seven_day_trial(
  'Open Trial Academy',
  'academy-pilot-2026-08-30'
);

reset role;
select pg_temp.academy_open_trial_assert(
  (select trial_ends_at - starts_at = interval '7 days'
   from public.academy_headquarters_access_states
   where owner_user_id = 'a9600000-0000-4000-8000-000000000001'),
  'trial lasts exactly seven days'
);
select pg_temp.academy_open_trial_assert(
  (select not is_active from public.academy_headquarters
   where owner_user_id = 'a9600000-0000-4000-8000-000000000001'),
  'trial does not activate public headquarters'
);
select pg_temp.academy_open_trial_assert(
  (select count(*) = 1 from public.academy_trial_usage_ledger
   where owner_user_id = 'a9600000-0000-4000-8000-000000000001')
  and
  (select count(*) = 1 from public.academy_trial_consent_ledger
   where owner_user_id = 'a9600000-0000-4000-8000-000000000001'),
  'trial usage and consent are recorded once'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a9600000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
select pg_temp.academy_open_trial_assert(
  (select not trial_available and trial_block_reason = 'headquarters_already_owned'
   from public.academy_get_my_onboarding_eligibility()),
  'second trial is rejected'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a9600000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',
  true
);
do $$
begin
  perform * from public.academy_get_my_onboarding_eligibility();
  raise exception 'anonymous unexpectedly allowed';
exception when others then
  if sqlerrm not like '%academy_anonymous_auth_forbidden%' then raise; end if;
end;
$$;
select pg_temp.academy_open_trial_assert(true, 'anonymous auth is rejected');

reset role;
update public.academy_headquarters_access_states
set starts_at = now() - interval '8 days',
    trial_ends_at = now() - interval '1 day',
    updated_at = now()
where owner_user_id = 'a9600000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a9600000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
select pg_temp.academy_open_trial_assert(
  public.academy_get_my_headquarters_role(
    (select id from public.academy_headquarters
     where owner_user_id = 'a9600000-0000-4000-8000-000000000001')
  ) = 'owner'
  and
  (select status = 'expired' and not can_manage_drafts and not can_use_live_features
   from public.academy_get_my_headquarters_access(
     (select id from public.academy_headquarters
      where owner_user_id = 'a9600000-0000-4000-8000-000000000001')
   )),
  'expired trial remains readable but not writable'
);

reset role;
select 'academy_open_seven_day_trial_ok' as sentinel;
rollback;
