-- Make the published Community application plans visible to operators and
-- enforce their active-member caps in the database. Payment lifecycle updates
-- remain server-side work for the future Stripe Billing integration.

create table community_private.platform_plan_settings (
  plan_key text primary key,
  monthly_amount_yen integer check (monthly_amount_yen is null or monthly_amount_yen >= 0),
  member_limit integer check (member_limit is null or member_limit > 0),
  trial_days integer check (trial_days is null or trial_days > 0),
  updated_at timestamptz not null default now()
);

revoke all on community_private.platform_plan_settings from public, anon, authenticated;

insert into community_private.platform_plan_settings (
  plan_key,
  monthly_amount_yen,
  member_limit,
  trial_days
) values
  ('trial', 0, 10, 30),
  ('starter', 2980, 50, null),
  ('standard', 4980, 200, null),
  ('pro', 9800, 1000, null),
  ('enterprise', null, null, null)
on conflict (plan_key) do nothing;

alter table public.community_platform_subscriptions
  add constraint community_platform_subscriptions_plan_key_fkey
  foreign key (plan_key) references community_private.platform_plan_settings(plan_key) not valid;

insert into public.community_platform_subscriptions (
  community_id,
  plan_key,
  status,
  current_period_ends_at
)
select
  community.id,
  'trial',
  'trialing',
  community.created_at + interval '30 days'
from public.community_communities community
on conflict (community_id) do nothing;

create or replace function community_private.create_trial_platform_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.community_platform_subscriptions (
    community_id,
    plan_key,
    status,
    current_period_ends_at
  ) values (
    new.id,
    'trial',
    'trialing',
    now() + interval '30 days'
  ) on conflict (community_id) do nothing;
  return new;
end;
$$;

revoke all on function community_private.create_trial_platform_subscription() from public, anon, authenticated;

drop trigger if exists community_communities_create_trial_subscription on public.community_communities;
create trigger community_communities_create_trial_subscription
after insert on public.community_communities
for each row execute function community_private.create_trial_platform_subscription();

create or replace function community_private.enforce_platform_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_key text;
  v_member_limit integer;
  v_active_members integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'active' then
      return new;
    end if;
  end if;

  insert into public.community_platform_subscriptions (
    community_id,
    plan_key,
    status,
    current_period_ends_at
  ) values (
    new.community_id,
    'trial',
    'trialing',
    now() + interval '30 days'
  ) on conflict (community_id) do nothing;

  -- Lock the one subscription row so concurrent joins cannot both pass the
  -- capacity check at the same member count.
  select subscription.plan_key, settings.member_limit
  into v_plan_key, v_member_limit
  from public.community_platform_subscriptions subscription
  join community_private.platform_plan_settings settings on settings.plan_key = subscription.plan_key
  where subscription.community_id = new.community_id
  for update of subscription;

  if not found then
    raise exception 'community_platform_plan_not_configured'
      using errcode = 'P0001';
  end if;

  if v_member_limit is null then
    return new;
  end if;

  select count(*)::integer
  into v_active_members
  from public.community_memberships membership
  where membership.community_id = new.community_id
    and membership.status = 'active'
    and membership.id <> new.id;

  if v_active_members >= v_member_limit then
    raise exception 'community_platform_member_limit_reached:%:%', v_plan_key, v_member_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function community_private.enforce_platform_member_limit() from public, anon, authenticated;

drop trigger if exists community_memberships_enforce_platform_member_limit on public.community_memberships;
create trigger community_memberships_enforce_platform_member_limit
before insert or update of status on public.community_memberships
for each row execute function community_private.enforce_platform_member_limit();
