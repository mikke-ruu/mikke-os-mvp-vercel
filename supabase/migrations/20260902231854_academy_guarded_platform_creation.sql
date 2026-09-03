-- Academy-owned atomic consumer for the common platform creation ledger.
-- Prerequisites:
--   * the Academy access/trial migrations through 20260830143000
--   * platform_billing_private.creation_entitlements
--   * platform_billing_private.verified_provider_events
--   * public.platform_billing_academy_new_paid_consume(uuid, uuid)
--   * public.platform_billing_academy_existing_paid_consume(uuid, uuid)
--
-- A construction-course purchase, a legacy Academy invitation, or expiry of a
-- free trial is not enough to call this RPC. Only an unbound, current,
-- verified-paid Academy platform entitlement can be consumed.

create or replace function public.academy_create_headquarters_with_platform_entitlement(
  p_actor_user_id uuid,
  p_name text
)
returns public.academy_headquarters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := p_actor_user_id;
  v_profile public.profiles%rowtype;
  v_proof jsonb;
  v_source_attempt_id uuid;
  v_paid_at timestamptz;
  v_current_period_ends_at timestamptz;
  v_plan_key text;
  v_headquarters public.academy_headquarters%rowtype;
  v_headquarters_id uuid := gen_random_uuid();
  v_handle_base text;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'ACADEMY_CREATE_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if v_actor is null then
    raise exception 'ACADEMY_CREATE_INVALID_SCOPE' using errcode = '22023';
  end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 100 then
    raise exception 'ACADEMY_CREATE_INVALID_NAME' using errcode = '22023';
  end if;

  -- Read the immutable actor/profile binding before the common lock chain.
  -- If the profile disappears concurrently, the later HQ insert fails and the
  -- entitlement consumption rolls back with this transaction.
  select profile.* into v_profile
  from public.profiles profile
  where profile.user_id = v_actor;
  if v_profile.id is null then
    raise exception 'ACADEMY_CREATE_PROFILE_REQUIRED' using errcode = '42501';
  end if;

  -- The common verifier owns the stable auth -> scope -> quote -> attempt ->
  -- event -> subscription -> entitlement lock order. Binding the generated HQ
  -- id before inserting Academy rows keeps consumption and creation atomic;
  -- any later failure rolls the binding back with this transaction.
  v_proof := public.platform_billing_academy_new_paid_consume(
    v_actor,
    v_headquarters_id
  );
  begin
    v_source_attempt_id := nullif(v_proof ->> 'sourceAttemptId', '')::uuid;
    v_paid_at := nullif(v_proof ->> 'paidAt', '')::timestamptz;
    v_current_period_ends_at := nullif(v_proof ->> 'currentPeriodEndsAt', '')::timestamptz;
    v_plan_key := nullif(v_proof ->> 'planKey', '');
  exception when others then
    raise exception 'ACADEMY_CREATE_INVALID_SUBSCRIPTION_PROOF' using errcode = '22023';
  end;
  if v_proof ->> 'verified' is distinct from 'true'
     or v_proof ->> 'actorUserId' is distinct from v_actor::text
     or v_proof ->> 'headquartersId' is distinct from v_headquarters_id::text
     or v_proof ->> 'productKey' is distinct from 'academy_platform'
     or v_plan_key is null
     or v_source_attempt_id is null
     or v_paid_at is null
     or v_current_period_ends_at is null
     or v_current_period_ends_at <= statement_timestamp() then
    raise exception 'ACADEMY_CREATE_INVALID_SUBSCRIPTION_PROOF' using errcode = '22023';
  end if;

  v_handle_base := left(
    trim(both '-' from regexp_replace(lower(v_profile.handle), '[^a-z0-9_-]+', '-', 'g')),
    17
  );
  if v_handle_base = '' then
    v_handle_base := 'academy';
  end if;

  insert into public.academy_headquarters (
    id, owner_user_id, owner_profile_id, name, handle, plan
  ) values (
    v_headquarters_id,
    v_actor,
    v_profile.id,
    trim(p_name),
    left(v_handle_base || '-academy-' || left(replace(v_headquarters_id::text, '-', ''), 6), 30),
    v_plan_key
  ) returning * into v_headquarters;

  insert into public.academy_headquarters_access_states (
    headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
  ) values (
    v_headquarters.id, v_actor, 'paid', 'active', v_paid_at, v_paid_at
  );

  return v_headquarters;
end;
$$;

revoke all on function public.academy_create_headquarters_with_platform_entitlement(uuid, text)
  from public, anon, authenticated;
grant execute on function public.academy_create_headquarters_with_platform_entitlement(uuid, text)
  to service_role;

-- The legacy RPC consumes an Academy-local invitation and starts paid access
-- without a verified platform subscription. It remains in the catalog for
-- migration compatibility, but is no longer callable by browsers.
revoke execute on function public.academy_create_headquarters(text)
  from authenticated;
revoke all on function public.academy_create_headquarters(text)
  from public, anon;

comment on function public.academy_create_headquarters_with_platform_entitlement(uuid, text) is
  'Atomically consumes one verified paid Academy platform creation entitlement while creating its headquarters and paid access state.';

create or replace function public.academy_activate_paid_access_from_platform_subscription(
  p_headquarters_id uuid
)
returns table (
  headquarters_id uuid,
  access_kind text,
  status text,
  paid_started_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid;
  v_proof jsonb;
  v_source_attempt_id uuid;
  v_paid_at timestamptz;
  v_current_period_ends_at timestamptz;
  v_contract_reference text;
  v_access public.academy_headquarters_access_states%rowtype;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'ACADEMY_PAID_BRIDGE_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_headquarters_id is null then
    raise exception 'ACADEMY_PAID_BRIDGE_INVALID_SCOPE' using errcode = '22023';
  end if;

  -- Read only enough to identify the actor. The common verifier acquires the
  -- stable parent locks before this function locks Academy-owned rows.
  select headquarters.owner_user_id into v_owner_user_id
  from public.academy_headquarters headquarters
  where headquarters.id = p_headquarters_id;
  if v_owner_user_id is null then
    raise exception 'ACADEMY_PAID_BRIDGE_HEADQUARTERS_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_proof := public.platform_billing_academy_existing_paid_consume(
    v_owner_user_id,
    p_headquarters_id
  );

  begin
    v_source_attempt_id := nullif(v_proof ->> 'sourceAttemptId', '')::uuid;
    v_paid_at := nullif(v_proof ->> 'paidAt', '')::timestamptz;
    v_current_period_ends_at := nullif(v_proof ->> 'currentPeriodEndsAt', '')::timestamptz;
  exception when others then
    raise exception 'ACADEMY_PAID_BRIDGE_INVALID_PROOF' using errcode = '22023';
  end;

  if v_proof ->> 'verified' is distinct from 'true'
     or v_proof ->> 'actorUserId' is distinct from v_owner_user_id::text
     or v_proof ->> 'headquartersId' is distinct from p_headquarters_id::text
     or v_proof ->> 'productKey' is distinct from 'academy_platform'
     or nullif(v_proof ->> 'planKey', '') is null
     or v_source_attempt_id is null
     or v_paid_at is null
     or v_current_period_ends_at is null
     or v_current_period_ends_at <= statement_timestamp() then
    raise exception 'ACADEMY_PAID_BRIDGE_INVALID_PROOF' using errcode = '22023';
  end if;

  v_contract_reference := 'platform-billing:' || v_source_attempt_id::text;

  select access_state.* into v_access
  from public.academy_headquarters_access_states access_state
  where access_state.headquarters_id = p_headquarters_id
  for update;
  if v_access.headquarters_id is null
     or v_access.owner_user_id is distinct from v_owner_user_id then
    raise exception 'ACADEMY_PAID_BRIDGE_ACCESS_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- A retry after the common entitlement and Academy transition committed is
  -- idempotent only for the exact immutable transition evidence.
  if v_access.access_kind = 'paid' and v_access.status = 'active' then
    if not exists (
      select 1
      from public.academy_paid_access_transition_ledger transition
      where transition.headquarters_id = p_headquarters_id
        and transition.owner_user_id = v_owner_user_id
        and transition.contract_reference = v_contract_reference
        and transition.activated_at = v_paid_at
    ) then
      raise exception 'ACADEMY_PAID_BRIDGE_ALREADY_PAID_BY_OTHER_SOURCE' using errcode = '23505';
    end if;
    return query
      select p_headquarters_id, v_access.access_kind, v_access.status, v_access.paid_started_at;
    return;
  end if;

  return query
  select activated.headquarters_id,
         activated.access_kind,
         activated.status,
         activated.paid_started_at
  from public.academy_activate_paid_access(
    p_headquarters_id,
    v_owner_user_id,
    v_contract_reference,
    v_paid_at
  ) activated;
end;
$$;

revoke all on function public.academy_activate_paid_access_from_platform_subscription(uuid)
  from public, anon, authenticated;
grant execute on function public.academy_activate_paid_access_from_platform_subscription(uuid)
  to service_role;

comment on function public.academy_activate_paid_access_from_platform_subscription(uuid) is
  'Service-only bridge that consumes a current verified Academy subscription proof before converting one matching trial headquarters to paid access.';

notify pgrst, 'reload schema';
