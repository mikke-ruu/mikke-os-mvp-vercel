-- Internal billing access window shared by Academy and Community guards.
-- This function grants no browser capability and performs no mutation.

create function platform_billing_private.resource_access_window(
  p_product_key text,
  p_resource_id uuid,
  p_at timestamptz
)
returns table (
  actor_user_id uuid,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  write_allowed boolean,
  owner_read_until timestamptz,
  anonymize_after timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_subscription platform_billing_private.subscriptions%rowtype;
  v_trial platform_billing_private.creation_entitlements%rowtype;
  v_ended_at timestamptz;
  v_match_count integer;
begin
  if p_product_key not in ('academy_platform', 'community_platform')
     or p_resource_id is null
     or p_at is null
     or not isfinite(p_at) then
    return;
  end if;

  select count(*)::integer
  into v_match_count
  from platform_billing_private.creation_entitlements entitlement
  join platform_billing_private.subscriptions subscription
    on subscription.source_attempt_id = entitlement.source_attempt_id
  where entitlement.product_key = p_product_key
    and entitlement.source_kind = 'verified_paid'
    and entitlement.status = 'consumed'
    and entitlement.resource_id = p_resource_id
    and subscription.actor_user_id = entitlement.actor_user_id
    and subscription.product_key = entitlement.product_key
    and subscription.plan_key = entitlement.plan_key;

  if v_match_count = 0 then
    if p_product_key <> 'community_platform' then
      return;
    end if;

    select count(*)::integer
    into v_match_count
    from platform_billing_private.creation_entitlements entitlement
    where entitlement.product_key = 'community_platform'
      and entitlement.source_kind = 'verified_trial'
      and entitlement.plan_key = 'trial'
      and entitlement.status = 'consumed'
      and entitlement.resource_id = p_resource_id;

    if v_match_count <> 1 then
      return;
    end if;

    select entitlement.*
    into strict v_trial
    from platform_billing_private.creation_entitlements entitlement
    where entitlement.product_key = 'community_platform'
      and entitlement.source_kind = 'verified_trial'
      and entitlement.plan_key = 'trial'
      and entitlement.status = 'consumed'
      and entitlement.resource_id = p_resource_id;

    if v_trial.expires_at is null then
      return;
    end if;

    return query select
      v_trial.actor_user_id,
      case when v_trial.starts_at <= p_at and v_trial.expires_at > p_at
        then 'trialing'::text else 'ended'::text end,
      v_trial.starts_at,
      v_trial.expires_at,
      v_trial.starts_at <= p_at and v_trial.expires_at > p_at,
      case when v_trial.expires_at <= p_at then v_trial.expires_at + interval '90 days' end,
      case when v_trial.expires_at <= p_at then v_trial.expires_at + interval '90 days' end;
    return;
  elsif v_match_count <> 1 then
    return;
  end if;

  select subscription.*
  into strict v_subscription
  from platform_billing_private.creation_entitlements entitlement
  join platform_billing_private.subscriptions subscription
    on subscription.source_attempt_id = entitlement.source_attempt_id
  where entitlement.product_key = p_product_key
    and entitlement.source_kind = 'verified_paid'
    and entitlement.status = 'consumed'
    and entitlement.resource_id = p_resource_id
    and subscription.actor_user_id = entitlement.actor_user_id
    and subscription.product_key = entitlement.product_key
    and subscription.plan_key = entitlement.plan_key;

  if v_subscription.status = 'ended' then
    select greatest(
      v_subscription.current_period_end,
      max(event.occurred_at) filter (where event.applied and event.projected_status = 'ended')
    )
    into v_ended_at
    from platform_billing_private.subscription_events event
    where event.subscription_id = v_subscription.id;

    if v_ended_at is null then
      return;
    end if;
  end if;

  return query select
    v_subscription.actor_user_id,
    v_subscription.status,
    v_subscription.current_period_start,
    v_subscription.current_period_end,
    v_subscription.status = 'active'
      and v_subscription.current_period_start <= p_at
      and v_subscription.current_period_end > p_at,
    case when v_subscription.status = 'ended' then v_ended_at + interval '90 days' end,
    case when v_subscription.status = 'ended' then v_ended_at + interval '90 days' end;
end;
$$;

revoke all on function platform_billing_private.resource_access_window(text, uuid, timestamptz)
  from public, anon, authenticated, service_role;

comment on function platform_billing_private.resource_access_window(text, uuid, timestamptz)
  is 'Internal fail-closed paid or Community verified-trial access and approved 90-day post-contract read window projection.';
