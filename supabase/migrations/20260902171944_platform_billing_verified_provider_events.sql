-- Verified provider-event binding for the existing creation-entitlement ledger.
-- This is server-only state. It stores no raw provider payload, secret, email,
-- customer name, or other PII, and it does not contact a payment provider.

create table platform_billing_private.verified_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique
    check (provider_event_id ~ '^evt_test_[A-Za-z0-9]+$'),
  provider_event_hash text not null unique
    check (provider_event_hash ~ '^[0-9a-f]{64}$'),
  provider_session_id text not null unique
    check (provider_session_id ~ '^cs_test_[A-Za-z0-9]+$'),
  attempt_id uuid not null unique
    references platform_billing_private.attempts(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  product_key text not null
    check (product_key in ('academy_platform', 'community_platform')),
  plan_key text not null check (platform_billing_private.token(plan_key)),
  quote_id text not null check (platform_billing_private.token(quote_id)),
  quote_revision bigint not null check (quote_revision > 0),
  paid_at timestamptz not null check (isfinite(paid_at)),
  entitlement_expires_at timestamptz not null
    check (isfinite(entitlement_expires_at) and entitlement_expires_at > paid_at),
  verified_at timestamptz not null default clock_timestamp(),
  check (isfinite(verified_at))
);

create index platform_billing_verified_event_actor_product_idx
  on platform_billing_private.verified_provider_events (actor_user_id, product_key);

create function platform_billing_private.verified_provider_event_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'PLATFORM_BILLING_VERIFIED_EVENT_IMMUTABLE';
end;
$$;

create trigger platform_billing_verified_provider_event_immutable
before update or delete on platform_billing_private.verified_provider_events
for each row execute function platform_billing_private.verified_provider_event_guard();

create trigger platform_billing_verified_provider_event_no_truncate
before truncate on platform_billing_private.verified_provider_events
for each statement execute function platform_billing_private.verified_provider_event_guard();

alter table platform_billing_private.verified_provider_events enable row level security;
revoke all on table platform_billing_private.verified_provider_events
  from public, anon, authenticated, service_role;

create function platform_billing_private.next_month_at(p_paid_at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select ((p_paid_at at time zone 'Asia/Tokyo') + interval '1 month')
    at time zone 'Asia/Tokyo'
$$;

create function platform_billing_private.require_verified_paid_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_kind = 'verified_paid' and not exists (
    select 1
    from platform_billing_private.verified_provider_events event
    where event.attempt_id = new.source_attempt_id
      and event.actor_user_id = new.actor_user_id
      and event.product_key = new.product_key
      and event.plan_key = new.plan_key
      and event.paid_at = new.starts_at
      and event.entitlement_expires_at = new.expires_at
  ) then
    raise exception using errcode = '42501', message = 'PLATFORM_BILLING_VERIFIED_EVENT_REQUIRED';
  end if;
  return new;
end;
$$;

create trigger platform_billing_creation_verified_paid_source
before insert on platform_billing_private.creation_entitlements
for each row execute function platform_billing_private.require_verified_paid_source();

create function public.platform_billing_verified_payment_grant(
  p_actor_user_id uuid,
  p_attempt_id uuid,
  p_provider_event_id text,
  p_provider_event_hash text,
  p_provider_session_id text,
  p_paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope_id uuid;
  v_attempt platform_billing_private.attempts%rowtype;
  v_quote platform_billing_private.quotes%rowtype;
  v_event platform_billing_private.verified_provider_events%rowtype;
  v_entitlement jsonb;
  v_expires_at timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  perform platform_billing_private.require_actor(p_actor_user_id);

  if p_attempt_id is null
    or p_provider_event_id is null
    or p_provider_event_id !~ '^evt_test_[A-Za-z0-9]+$'
    or char_length(p_provider_event_id) > 160
    or p_provider_event_hash is null
    or p_provider_event_hash !~ '^[0-9a-f]{64}$'
    or p_provider_session_id is null
    or p_provider_session_id !~ '^cs_test_[A-Za-z0-9]+$'
    or char_length(p_provider_session_id) > 160
    or p_paid_at is null
    or not isfinite(p_paid_at) then
    raise exception using errcode = '22023', message = 'PLATFORM_BILLING_INVALID_VERIFIED_EVENT';
  end if;

  select attempt.scope_id
  into v_scope_id
  from platform_billing_private.attempts attempt
  where attempt.id = p_attempt_id
    and attempt.owner_user_id = p_actor_user_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'PLATFORM_BILLING_NOT_FOUND';
  end if;

  perform 1
  from platform_billing_private.scopes scope
  where scope.id = v_scope_id
    and scope.owner_user_id = p_actor_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PLATFORM_BILLING_NOT_FOUND';
  end if;

  select quote.*
  into v_quote
  from platform_billing_private.quotes quote
  join platform_billing_private.attempts attempt
    on attempt.quote_id = quote.quote_id
   and attempt.scope_id = quote.scope_id
   and attempt.owner_user_id = quote.owner_user_id
   and attempt.product_key = quote.product_key
   and attempt.request_id = quote.request_id
   and attempt.quote_revision = quote.revision
  where attempt.id = p_attempt_id
    and attempt.scope_id = v_scope_id
    and attempt.owner_user_id = p_actor_user_id
  for update of quote;
  if not found then
    raise exception using errcode = 'P0002', message = 'PLATFORM_BILLING_NOT_FOUND';
  end if;

  select attempt.*
  into v_attempt
  from platform_billing_private.attempts attempt
  where attempt.id = p_attempt_id
    and attempt.scope_id = v_scope_id
    and attempt.owner_user_id = p_actor_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PLATFORM_BILLING_NOT_FOUND';
  end if;

  if v_attempt.product_key not in ('academy_platform', 'community_platform')
    or v_attempt.resource_id is not null
    or v_attempt.status <> 'provider_ready'
    or v_attempt.provider_session_id is distinct from p_provider_session_id
    or v_attempt.provider_result_hash is null
    or v_attempt.plan_key is distinct from v_quote.plan_key
    or v_attempt.product_key is distinct from v_quote.product_key
    or v_attempt.resource_id is distinct from v_quote.resource_id
    or v_attempt.request_id is distinct from v_quote.request_id
    or v_attempt.quote_id is distinct from v_quote.quote_id
    or v_attempt.quote_revision is distinct from v_quote.revision
    or v_quote.owner_user_id is distinct from p_actor_user_id
    or v_quote.payload->>'purchaseIntent' is distinct from 'explicit_paid_start'
    or v_quote.payload#>'{policies,approved}' is distinct from 'true'::jsonb then
    raise exception using errcode = '42501', message = 'PLATFORM_BILLING_VERIFIED_EVENT_SCOPE_MISMATCH';
  end if;

  if p_paid_at < v_attempt.created_at - interval '5 minutes'
    or p_paid_at > v_now + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'PLATFORM_BILLING_INVALID_PAID_AT';
  end if;

  v_expires_at := platform_billing_private.next_month_at(p_paid_at);
  if v_expires_at <= p_paid_at then
    raise exception using errcode = '22023', message = 'PLATFORM_BILLING_INVALID_PAID_AT';
  end if;

  select event.*
  into v_event
  from platform_billing_private.verified_provider_events event
  where event.provider_event_id = p_provider_event_id
     or event.provider_event_hash = p_provider_event_hash
     or event.provider_session_id = p_provider_session_id
     or event.attempt_id = p_attempt_id
  order by event.verified_at, event.id
  limit 1;

  if found then
    if v_event.provider_event_id is distinct from p_provider_event_id
      or v_event.provider_event_hash is distinct from p_provider_event_hash
      or v_event.provider_session_id is distinct from p_provider_session_id
      or v_event.attempt_id is distinct from p_attempt_id
      or v_event.actor_user_id is distinct from p_actor_user_id
      or v_event.product_key is distinct from v_attempt.product_key
      or v_event.plan_key is distinct from v_attempt.plan_key
      or v_event.quote_id is distinct from v_attempt.quote_id
      or v_event.quote_revision is distinct from v_attempt.quote_revision
      or v_event.paid_at is distinct from p_paid_at
      or v_event.entitlement_expires_at is distinct from v_expires_at then
      raise exception using errcode = '23505', message = 'PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT';
    end if;

    v_entitlement := public.platform_billing_creation_entitlement_grant(
      p_actor_user_id,
      v_attempt.product_key,
      v_attempt.plan_key,
      'verified_paid',
      p_attempt_id,
      p_paid_at,
      v_expires_at,
      v_event.id
    );
    return v_entitlement || jsonb_build_object('eventStatus', 'verified');
  end if;

  begin
    insert into platform_billing_private.verified_provider_events (
      provider_event_id,
      provider_event_hash,
      provider_session_id,
      attempt_id,
      actor_user_id,
      product_key,
      plan_key,
      quote_id,
      quote_revision,
      paid_at,
      entitlement_expires_at
    ) values (
      p_provider_event_id,
      p_provider_event_hash,
      p_provider_session_id,
      p_attempt_id,
      p_actor_user_id,
      v_attempt.product_key,
      v_attempt.plan_key,
      v_attempt.quote_id,
      v_attempt.quote_revision,
      p_paid_at,
      v_expires_at
    ) returning * into v_event;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT';
  end;

  v_entitlement := public.platform_billing_creation_entitlement_grant(
    p_actor_user_id,
    v_attempt.product_key,
    v_attempt.plan_key,
    'verified_paid',
    p_attempt_id,
    p_paid_at,
    v_expires_at,
    v_event.id
  );

  return v_entitlement || jsonb_build_object('eventStatus', 'verified');
end;
$$;

revoke all on function platform_billing_private.verified_provider_event_guard()
  from public, anon, authenticated, service_role;
revoke all on function platform_billing_private.next_month_at(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function platform_billing_private.require_verified_paid_source()
  from public, anon, authenticated, service_role;
revoke all on function public.platform_billing_verified_payment_grant(
  uuid, uuid, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.platform_billing_verified_payment_grant(
  uuid, uuid, text, text, text, timestamptz
) to service_role;

comment on table platform_billing_private.verified_provider_events is
  'Immutable server-only proof binding. No raw provider payload, secret, or PII.';
comment on function public.platform_billing_verified_payment_grant(
  uuid, uuid, text, text, text, timestamptz
) is
  'Binds an already signature-verified test provider event to one provider-ready checkout attempt and atomically grants one month of app creation access. Does not contact a provider or create paid app resources.';
