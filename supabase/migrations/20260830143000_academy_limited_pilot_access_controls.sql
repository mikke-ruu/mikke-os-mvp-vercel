-- Invite-only Academy pilot controls. Apply only after the frozen 13-migration
-- Academy/Community replay package has passed in an isolated database.

create table public.academy_trial_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'consumed', 'revoked')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  consumed_at timestamptz,
  headquarters_id uuid references public.academy_headquarters(id) on delete restrict,
  invitation_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_trial_invitation_period_check check (valid_until is null or valid_until > valid_from),
  constraint academy_trial_invitation_consumption_check check (
    (status = 'consumed' and consumed_at is not null and headquarters_id is not null)
    or (status <> 'consumed' and consumed_at is null and headquarters_id is null)
  ),
  constraint academy_trial_invitation_headquarters_unique unique (headquarters_id),
  constraint academy_trial_invitation_consumed_period_check check (
    consumed_at is null
    or (consumed_at >= valid_from and (valid_until is null or consumed_at < valid_until))
  )
);

create unique index academy_trial_invitation_active_owner_idx
  on public.academy_trial_invitations(owner_user_id)
  where status = 'active';
create index academy_trial_invitation_owner_idx
  on public.academy_trial_invitations(owner_user_id);

alter table public.academy_trial_invitations enable row level security;
revoke all on table public.academy_trial_invitations from public, anon, authenticated;
revoke all on table public.academy_trial_invitations from service_role;
grant select, insert, update on table public.academy_trial_invitations to service_role;

create table public.academy_trial_consent_ledger (
  owner_user_id uuid primary key references auth.users(id) on delete restrict,
  headquarters_id uuid not null unique references public.academy_headquarters(id) on delete restrict,
  terms_version text not null,
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.academy_trial_consent_ledger enable row level security;
revoke all on table public.academy_trial_consent_ledger from public, anon, authenticated;
revoke all on table public.academy_trial_consent_ledger from service_role;
grant select on table public.academy_trial_consent_ledger to service_role;

create table public.academy_paid_access_transition_ledger (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  contract_reference text not null,
  previous_access_kind text not null,
  previous_status text not null,
  activated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (headquarters_id),
  unique (contract_reference)
);

create index academy_paid_access_transition_owner_idx
  on public.academy_paid_access_transition_ledger(owner_user_id);

alter table public.academy_paid_access_transition_ledger enable row level security;
revoke all on table public.academy_paid_access_transition_ledger from public, anon, authenticated;
revoke all on table public.academy_paid_access_transition_ledger from service_role;
grant select on table public.academy_paid_access_transition_ledger to service_role;

create or replace function private.academy_guard_trial_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'academy_trial_invitation_cannot_be_deleted';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'active'
      or new.consumed_at is not null
      or new.headquarters_id is not null
    then
      raise exception 'academy_trial_invitation_must_start_active';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.invitation_reference is distinct from old.invitation_reference
    or new.created_at is distinct from old.created_at
    or new.valid_from is distinct from old.valid_from
    or new.valid_until is distinct from old.valid_until
  then
    raise exception 'academy_trial_invitation_identity_is_immutable';
  end if;
  if old.status in ('consumed', 'revoked') then
    raise exception 'academy_trial_invitation_is_terminal';
  end if;
  if new.status not in ('consumed', 'revoked') then
    raise exception 'academy_trial_invitation_invalid_transition';
  end if;
  if new.status = 'consumed' and not exists (
    select 1
    from public.academy_headquarters headquarters
    where headquarters.id = new.headquarters_id
      and headquarters.owner_user_id = new.owner_user_id
  ) then
    raise exception 'academy_trial_invitation_headquarters_owner_mismatch';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.academy_guard_paid_access_transition_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'academy_paid_access_transition_ledger_is_immutable';
end;
$$;

create or replace function private.academy_guard_trial_consent_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'academy_trial_consent_ledger_is_immutable';
end;
$$;

revoke all on function private.academy_guard_paid_access_transition_ledger()
  from public, anon, authenticated;
revoke all on function private.academy_guard_trial_consent_ledger()
  from public, anon, authenticated;
revoke all on function private.academy_guard_trial_invitation()
  from public, anon, authenticated;

create trigger academy_guard_trial_invitation
before insert or update or delete on public.academy_trial_invitations
for each row execute function private.academy_guard_trial_invitation();

create trigger academy_guard_paid_access_transition_ledger
before update or delete on public.academy_paid_access_transition_ledger
for each row execute function private.academy_guard_paid_access_transition_ledger();

create trigger academy_guard_trial_consent_ledger
before update or delete on public.academy_trial_consent_ledger
for each row execute function private.academy_guard_trial_consent_ledger();

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
      exists (
        select 1 from public.academy_trial_invitations invitation
        where invitation.owner_user_id = v_actor
          and invitation.status = 'active'
          and invitation.valid_from <= now()
          and (invitation.valid_until is null or invitation.valid_until > now())
      ) as has_trial_invitation,
      coalesce(private.academy_has_headquarters_creation_entitlement(v_actor), false) as has_paid_entitlement
  )
  select
    not owns_headquarters and not used_trial and has_trial_invitation,
    not owns_headquarters and has_paid_entitlement,
    case
      when owns_headquarters then 'headquarters_already_owned'
      when used_trial then 'trial_already_used'
      when not has_trial_invitation then 'trial_invitation_required'
      else null
    end
  from facts;
end;
$$;

create or replace function public.academy_start_seven_day_trial(p_name text, p_terms_version text)
returns public.academy_headquarters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_invitation public.academy_trial_invitations%rowtype;
  v_headquarters public.academy_headquarters%rowtype;
  v_headquarters_id uuid := gen_random_uuid();
  v_handle_base text;
  v_starts_at timestamptz := now();
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

  select invitation.* into v_invitation
  from public.academy_trial_invitations invitation
  where invitation.owner_user_id = v_actor
    and invitation.status = 'active'
    and invitation.valid_from <= v_starts_at
    and (invitation.valid_until is null or invitation.valid_until > v_starts_at)
  for update;
  if v_invitation.id is null then raise exception 'academy_trial_invitation_required'; end if;

  v_handle_base := left(trim(both '-' from regexp_replace(lower(v_profile.handle), '[^a-z0-9_-]+', '-', 'g')), 17);
  if v_handle_base = '' then v_handle_base := 'academy'; end if;
  insert into public.academy_headquarters (
    id, owner_user_id, owner_profile_id, name, handle, plan, is_active
  ) values (
    v_headquarters_id, v_actor, v_profile.id, trim(p_name),
    left(v_handle_base || '-academy-' || left(replace(v_headquarters_id::text, '-', ''), 6), 30),
    'small', false
  ) returning * into v_headquarters;
  insert into public.academy_headquarters_access_states (
    headquarters_id, owner_user_id, access_kind, status, starts_at, trial_ends_at
  ) values (v_headquarters.id, v_actor, 'trial', 'trialing', v_starts_at, v_starts_at + interval '7 days');
  insert into public.academy_trial_usage_ledger (owner_user_id, headquarters_id, first_trial_started_at)
    values (v_actor, v_headquarters.id, v_starts_at);
  insert into public.academy_trial_consent_ledger (owner_user_id, headquarters_id, terms_version, consented_at)
    values (v_actor, v_headquarters.id, trim(p_terms_version), v_starts_at);
  update public.academy_trial_invitations
  set status = 'consumed', consumed_at = v_starts_at, headquarters_id = v_headquarters.id, updated_at = v_starts_at
  where id = v_invitation.id;
  return v_headquarters;
end;
$$;

create or replace function public.academy_activate_paid_access(
  p_headquarters_id uuid,
  p_owner_user_id uuid,
  p_contract_reference text,
  p_activated_at timestamptz default now()
)
returns table (headquarters_id uuid, access_kind text, status text, paid_started_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headquarters public.academy_headquarters%rowtype;
  v_access public.academy_headquarters_access_states%rowtype;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'academy_paid_access_service_role_required';
  end if;
  if nullif(trim(p_contract_reference), '') is null or char_length(trim(p_contract_reference)) > 120 then
    raise exception 'academy_paid_access_contract_reference_invalid';
  end if;
  if p_activated_at is null or p_activated_at > now() + interval '5 minutes' then
    raise exception 'academy_paid_access_activation_time_invalid';
  end if;

  select * into v_headquarters from public.academy_headquarters
  where id = p_headquarters_id for update;
  if v_headquarters.id is null or v_headquarters.owner_user_id is distinct from p_owner_user_id then
    raise exception 'academy_paid_access_owner_mismatch';
  end if;
  select * into v_access from public.academy_headquarters_access_states
  where headquarters_id = p_headquarters_id for update;
  if v_access.headquarters_id is null or v_access.owner_user_id is distinct from p_owner_user_id then
    raise exception 'academy_paid_access_state_not_found';
  end if;
  if v_access.access_kind is distinct from 'trial'
    or v_access.status not in ('trialing', 'expired')
  then
    raise exception 'academy_paid_access_trial_state_required';
  end if;
  if p_activated_at < v_access.starts_at then
    raise exception 'academy_paid_access_activation_time_invalid';
  end if;
  if not exists (
    select 1 from public.academy_trial_usage_ledger u
    where u.headquarters_id = p_headquarters_id and u.owner_user_id = p_owner_user_id
  ) then raise exception 'academy_paid_access_trial_history_missing'; end if;

  insert into public.academy_paid_access_transition_ledger (
    headquarters_id, owner_user_id, contract_reference, previous_access_kind, previous_status, activated_at
  ) values (
    p_headquarters_id, p_owner_user_id, trim(p_contract_reference), v_access.access_kind, v_access.status, p_activated_at
  );
  update public.academy_headquarters_access_states
  set access_kind = 'paid', status = 'active', trial_ends_at = null,
      paid_started_at = p_activated_at, updated_at = p_activated_at
  where headquarters_id = p_headquarters_id;
  update public.academy_headquarters
  set is_active = true, plan_started_at = coalesce(plan_started_at, p_activated_at::date), updated_at = p_activated_at
  where id = p_headquarters_id;
  return query select p_headquarters_id, 'paid'::text, 'active'::text, p_activated_at;
end;
$$;

create or replace function public.academy_get_my_current_billing_estimate(p_headquarters_id uuid)
returns table (registered_instructor_count integer, catalog_price_yen integer, observed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_observed_at timestamptz := now();
begin
  if (select auth.uid()) is null then raise exception 'academy_billing_authentication_required'; end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'academy_anonymous_auth_forbidden';
  end if;
  if private.academy_headquarters_role(p_headquarters_id, (select auth.uid())) is distinct from 'owner' then
    raise exception 'academy_billing_snapshot_forbidden';
  end if;
  select count(distinct instructor.profile_id)::integer into v_count
  from public.academy_instructors instructor
  where instructor.headquarters_id = p_headquarters_id
    and instructor.created_at <= v_observed_at
    and (instructor.withdrawn_at is null or instructor.withdrawn_at > v_observed_at)
    and not exists (
      select 1 from public.academy_instructor_billing_exclusions exclusion
      where exclusion.headquarters_id = instructor.headquarters_id
        and exclusion.profile_id = instructor.profile_id
        and exclusion.effective_from <= v_observed_at
        and (exclusion.effective_until is null or exclusion.effective_until > v_observed_at)
    );
  return query select v_count, private.academy_catalog_monthly_price_yen(v_count), v_observed_at;
end;
$$;

revoke all on function public.academy_get_my_onboarding_eligibility() from public, anon;
revoke all on function public.academy_start_seven_day_trial(text) from public, anon, authenticated;
revoke all on function public.academy_start_seven_day_trial(text, text) from public, anon;
revoke all on function public.academy_activate_paid_access(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.academy_get_my_current_billing_estimate(uuid) from public, anon;
grant execute on function public.academy_get_my_onboarding_eligibility() to authenticated;
grant execute on function public.academy_start_seven_day_trial(text, text) to authenticated;
grant execute on function public.academy_activate_paid_access(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.academy_get_my_current_billing_estimate(uuid) to authenticated;
