-- Allow a first-time, non-anonymous mikkeOS account to begin the already
-- approved seven-day Academy trial from the Academy URL. The legacy
-- invitation-only pilot gate is removed; the immutable usage ledger continues
-- to guarantee one trial per account. Starting a trial never creates a paid
-- subscription or an automatic charge.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.academy_get_my_onboarding_eligibility()
returns table (trial_available boolean, paid_creation_available boolean, trial_block_reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'academy_onboarding_authentication_required'; end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'academy_anonymous_auth_forbidden';
  end if;

  return query
  with facts as (
    select
      exists (select 1 from public.academy_headquarters h where h.owner_user_id = v_actor) as owns_headquarters,
      exists (select 1 from public.academy_trial_usage_ledger u where u.owner_user_id = v_actor) as used_trial,
      coalesce(private.academy_has_headquarters_creation_entitlement(v_actor), false) as has_paid_entitlement
  )
  select
    not owns_headquarters and not used_trial,
    not owns_headquarters and has_paid_entitlement,
    case
      when owns_headquarters then 'headquarters_already_owned'
      when used_trial then 'trial_already_used'
      else null
    end
  from facts;
end;
$$;

create or replace function public.academy_start_seven_day_trial(
  p_name text,
  p_terms_version text
)
returns public.academy_headquarters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_headquarters public.academy_headquarters%rowtype;
  v_headquarters_id uuid := gen_random_uuid();
  v_handle_base text;
  v_starts_at timestamptz := statement_timestamp();
begin
  if v_actor is null then raise exception 'academy_trial_authentication_required'; end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'academy_anonymous_auth_forbidden';
  end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 100 then
    raise exception 'academy_headquarters_invalid_name';
  end if;
  if nullif(trim(p_terms_version), '') is null or char_length(trim(p_terms_version)) > 80 then
    raise exception 'academy_trial_terms_version_invalid';
  end if;

  -- The profile row serializes two concurrent starts for the same account.
  select profile.* into v_profile
  from public.profiles profile
  where profile.user_id = v_actor
  for update;
  if v_profile.id is null then raise exception 'academy_profile_not_available'; end if;
  if exists (select 1 from public.academy_headquarters h where h.owner_user_id = v_actor) then
    raise exception 'academy_trial_headquarters_already_owned';
  end if;
  if exists (select 1 from public.academy_trial_usage_ledger u where u.owner_user_id = v_actor) then
    raise exception 'academy_trial_already_used';
  end if;

  v_handle_base := left(
    trim(both '-' from regexp_replace(lower(v_profile.handle), '[^a-z0-9_-]+', '-', 'g')),
    17
  );
  if v_handle_base = '' then v_handle_base := 'academy'; end if;

  insert into public.academy_headquarters (
    id, owner_user_id, owner_profile_id, name, handle, plan, is_active
  ) values (
    v_headquarters_id,
    v_actor,
    v_profile.id,
    trim(p_name),
    left(v_handle_base || '-academy-' || left(replace(v_headquarters_id::text, '-', ''), 6), 30),
    'small',
    false
  ) returning * into v_headquarters;

  insert into public.academy_headquarters_access_states (
    headquarters_id, owner_user_id, access_kind, status, starts_at, trial_ends_at
  ) values (
    v_headquarters.id,
    v_actor,
    'trial',
    'trialing',
    v_starts_at,
    v_starts_at + interval '7 days'
  );

  insert into public.academy_trial_usage_ledger (
    owner_user_id, headquarters_id, first_trial_started_at
  ) values (
    v_actor, v_headquarters.id, v_starts_at
  );

  insert into public.academy_trial_consent_ledger (
    owner_user_id, headquarters_id, terms_version, consented_at
  ) values (
    v_actor, v_headquarters.id, trim(p_terms_version), v_starts_at
  );

  return v_headquarters;
end;
$$;

revoke all on function public.academy_get_my_onboarding_eligibility()
  from public, anon;
revoke all on function public.academy_start_seven_day_trial(text, text)
  from public, anon;
grant execute on function public.academy_get_my_onboarding_eligibility()
  to authenticated;
grant execute on function public.academy_start_seven_day_trial(text, text)
  to authenticated;
