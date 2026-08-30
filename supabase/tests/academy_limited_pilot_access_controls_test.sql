-- Academy limited-pilot access-control negative tests.
-- Run only after the frozen replay package and migration 20260830143000 in a
-- disposable database. The caller owns BEGIN/ROLLBACK; never run on production.

create or replace function pg_temp.academy_pilot_assert_raises(p_sql text, p_expected text)
returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise exception 'academy_pilot_expected_error_not_raised: %', p_expected;
exception
  when others then
    if sqlerrm = 'academy_pilot_expected_error_not_raised: ' || p_expected
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
  ('a7300000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pilot-owner@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('a7300000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pilot-other@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('a7300000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pilot-paid@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.profiles (id, user_id, display_name, handle, member_number) values
  ('b7300000-0000-4000-8000-000000000001', 'a7300000-0000-4000-8000-000000000001', 'Pilot Owner', 'pilot_owner', 997300001),
  ('b7300000-0000-4000-8000-000000000002', 'a7300000-0000-4000-8000-000000000002', 'Pilot Other', 'pilot_other', 997300002),
  ('b7300000-0000-4000-8000-000000000003', 'a7300000-0000-4000-8000-000000000003', 'Pilot Paid', 'pilot_paid', 997300003);

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.academy_trial_invitations (owner_user_id, invitation_reference, valid_until)
values ('a7300000-0000-4000-8000-000000000001', 'pilot-invite-1', now() + interval '1 day');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7300000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
select * from public.academy_get_my_onboarding_eligibility();
select public.academy_start_seven_day_trial('Pilot Academy', 'academy-pilot-2026-08-30');
select * from public.academy_get_my_current_billing_estimate(
  (select id from public.academy_headquarters where owner_user_id = 'a7300000-0000-4000-8000-000000000001')
);
reset role;

-- ANONYMOUS_AUTH_NEGATIVE_CALLS: authenticated-role anonymous JWTs must fail all three RPCs.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7300000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}', true);
select pg_temp.academy_pilot_assert_raises(
  'select * from public.academy_get_my_onboarding_eligibility()',
  'academy_anonymous_auth_forbidden'
);
select pg_temp.academy_pilot_assert_raises(
  $$select public.academy_start_seven_day_trial('Anonymous Academy', 'academy-pilot-2026-08-30')$$,
  'academy_anonymous_auth_forbidden'
);
select pg_temp.academy_pilot_assert_raises(
  $$select * from public.academy_get_my_current_billing_estimate('c7300000-0000-4000-8000-000000000001')$$,
  'academy_anonymous_auth_forbidden'
);
reset role;

-- NULL_ROLE_AND_OTHER_HEADQUARTERS_NEGATIVE_CALLS: no auth and NULL HQ role fail closed.
set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select pg_temp.academy_pilot_assert_raises(
  'select * from public.academy_get_my_onboarding_eligibility()',
  'academy_onboarding_authentication_required'
);
select pg_temp.academy_pilot_assert_raises(
  $$select * from public.academy_get_my_current_billing_estimate('c7300000-0000-4000-8000-000000000001')$$,
  'academy_billing_authentication_required'
);
select set_config('request.jwt.claims', '{"sub":"a7300000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
select pg_temp.academy_pilot_assert_raises(
  $$select * from public.academy_get_my_current_billing_estimate(
    (select id from public.academy_headquarters where owner_user_id = 'a7300000-0000-4000-8000-000000000001')
  )$$,
  'academy_billing_snapshot_forbidden'
);
reset role;

insert into public.academy_headquarters (
  id, owner_user_id, owner_profile_id, name, handle, plan, is_active
) values (
  'c7300000-0000-4000-8000-000000000003',
  'a7300000-0000-4000-8000-000000000003',
  'b7300000-0000-4000-8000-000000000003',
  'Already Paid Academy', 'already-paid-academy', 'small', true
);
insert into public.academy_headquarters_access_states (
  headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
) values (
  'c7300000-0000-4000-8000-000000000003',
  'a7300000-0000-4000-8000-000000000003',
  'paid', 'active', now() - interval '1 day', now() - interval '1 day'
);

-- PAID_ACTIVATION_TIME_AND_STATE_NEGATIVE_CALLS.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select pg_temp.academy_pilot_assert_raises(
  $$select * from public.academy_activate_paid_access(
    (select id from public.academy_headquarters where owner_user_id = 'a7300000-0000-4000-8000-000000000001'),
    'a7300000-0000-4000-8000-000000000001', 'pilot-null-time', null
  )$$,
  'academy_paid_access_activation_time_invalid'
);
select pg_temp.academy_pilot_assert_raises(
  $$select * from public.academy_activate_paid_access(
    (select id from public.academy_headquarters where owner_user_id = 'a7300000-0000-4000-8000-000000000001'),
    'a7300000-0000-4000-8000-000000000001', 'pilot-past-time', now() - interval '1 day'
  )$$,
  'academy_paid_access_activation_time_invalid'
);
select pg_temp.academy_pilot_assert_raises(
  $$select * from public.academy_activate_paid_access(
    (select id from public.academy_headquarters where owner_user_id = 'a7300000-0000-4000-8000-000000000001'),
    'a7300000-0000-4000-8000-000000000001', 'pilot-future-time', now() + interval '6 minutes'
  )$$,
  'academy_paid_access_activation_time_invalid'
);
select pg_temp.academy_pilot_assert_raises(
  $$select * from public.academy_activate_paid_access(
    'c7300000-0000-4000-8000-000000000003',
    'a7300000-0000-4000-8000-000000000003', 'pilot-nontrial', now()
  )$$,
  'academy_paid_access_trial_state_required'
);
select * from public.academy_activate_paid_access(
  (select id from public.academy_headquarters where owner_user_id = 'a7300000-0000-4000-8000-000000000001'),
  'a7300000-0000-4000-8000-000000000001', 'pilot-contract-1', now()
);
select pg_temp.academy_pilot_assert_raises(
  $$select * from public.academy_activate_paid_access(
    (select id from public.academy_headquarters where owner_user_id = 'a7300000-0000-4000-8000-000000000001'),
    'a7300000-0000-4000-8000-000000000001', 'pilot-contract-2', now()
  )$$,
  'academy_paid_access_trial_state_required'
);

-- LEDGER_DIRECT_MUTATION_NEGATIVE_CALLS: even service_role cannot forge or erase evidence.
select pg_temp.academy_pilot_assert_raises(
  $$insert into public.academy_paid_access_transition_ledger (
    headquarters_id, owner_user_id, contract_reference, previous_access_kind, previous_status, activated_at
  ) values (
    'c7300000-0000-4000-8000-000000000003', 'a7300000-0000-4000-8000-000000000003',
    'forged-contract', 'trial', 'trialing', now()
  )$$,
  'permission denied'
);
select pg_temp.academy_pilot_assert_raises(
  $$update public.academy_paid_access_transition_ledger set contract_reference = 'retargeted'$$,
  'permission denied'
);
select pg_temp.academy_pilot_assert_raises(
  'delete from public.academy_paid_access_transition_ledger',
  'permission denied'
);
select pg_temp.academy_pilot_assert_raises(
  'truncate table public.academy_paid_access_transition_ledger',
  'permission denied'
);
select pg_temp.academy_pilot_assert_raises(
  $$insert into public.academy_trial_consent_ledger (
    owner_user_id, headquarters_id, terms_version, consented_at
  ) values (
    'a7300000-0000-4000-8000-000000000003', 'c7300000-0000-4000-8000-000000000003', 'forged', now()
  )$$,
  'permission denied'
);
select pg_temp.academy_pilot_assert_raises(
  $$update public.academy_trial_consent_ledger set terms_version = 'retargeted'$$,
  'permission denied'
);
select pg_temp.academy_pilot_assert_raises(
  'delete from public.academy_trial_consent_ledger',
  'permission denied'
);
select pg_temp.academy_pilot_assert_raises(
  'truncate table public.academy_trial_consent_ledger',
  'permission denied'
);

-- INVITATION_LIFECYCLE_NEGATIVE_CALLS: identity, deletion and terminal state stay immutable.
select pg_temp.academy_pilot_assert_raises(
  $$update public.academy_trial_invitations
    set owner_user_id = 'a7300000-0000-4000-8000-000000000002'
    where invitation_reference = 'pilot-invite-1'$$,
  'academy_trial_invitation_identity_is_immutable'
);
select pg_temp.academy_pilot_assert_raises(
  $$update public.academy_trial_invitations
    set status = 'active', consumed_at = null, headquarters_id = null
    where invitation_reference = 'pilot-invite-1'$$,
  'academy_trial_invitation_is_terminal'
);
select pg_temp.academy_pilot_assert_raises(
  $$delete from public.academy_trial_invitations where invitation_reference = 'pilot-invite-1'$$,
  'permission denied'
);
select pg_temp.academy_pilot_assert_raises(
  'truncate table public.academy_trial_invitations',
  'permission denied'
);
insert into public.academy_trial_invitations (owner_user_id, invitation_reference, valid_until)
values ('a7300000-0000-4000-8000-000000000001', 'pilot-invite-duplicate-hq', now() + interval '1 day');
select pg_temp.academy_pilot_assert_raises(
  $$update public.academy_trial_invitations
    set status = 'consumed', consumed_at = now(),
        headquarters_id = (select id from public.academy_headquarters where owner_user_id = 'a7300000-0000-4000-8000-000000000001')
    where invitation_reference = 'pilot-invite-duplicate-hq'$$,
  'duplicate key value'
);
reset role;

-- TWO_CONNECTION_ACTIVATION_RACE_REQUIRED: the isolated runtime matrix must run
-- two simultaneous academy_activate_paid_access calls. HQ then access row locks,
-- the unique headquarters ledger, and the post-lock state check must allow one only.

select 'academy_limited_pilot_access_controls_ok' as result;
