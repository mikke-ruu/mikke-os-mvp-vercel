-- Community-owned atomic consumer for the common platform creation ledger.
-- Prerequisite (common billing migration):
-- platform_billing_private.creation_entitlements with the columns referenced
-- below. Grant issuance and status projection remain common-layer ownership.

create or replace function public.community_create_with_platform_entitlement(
  p_name text,
  p_slug text,
  p_description text default null,
  p_display_name text default null
)
returns public.community_communities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
  v_slug text := lower(trim(p_slug));
  v_compact_name text := regexp_replace(lower(trim(p_name)), '[[:space:]_-]+', '', 'g');
  v_entitlement record;
  v_community public.community_communities;
begin
  if v_actor is null then
    raise exception 'COMMUNITY_CREATE_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'COMMUNITY_CREATE_ANONYMOUS_DENIED' using errcode = '42501';
  end if;

  -- Stable order: the shared entitlement row is always locked before any
  -- Community row is inserted. The common ledger guarantees at most one
  -- usable unbound grant per owner/product.
  select e.id, e.actor_user_id, e.product_key, e.plan_key, e.status,
         e.starts_at, e.expires_at, e.resource_id
    into v_entitlement
  from platform_billing_private.creation_entitlements e
  where e.actor_user_id = v_actor
    and e.product_key = 'community_platform'
    and e.resource_id is null
    and e.status = 'available'
  order by e.created_at, e.id
  limit 1
  for update;

  if not found
     or v_entitlement.actor_user_id is distinct from v_actor
     or v_entitlement.product_key is distinct from 'community_platform'
     or v_entitlement.status is distinct from 'available'
     or v_entitlement.resource_id is not null
     or v_entitlement.starts_at > v_now
     or (v_entitlement.expires_at is not null and v_entitlement.expires_at <= v_now) then
    raise exception 'COMMUNITY_CREATE_ENTITLEMENT_CONFLICT' using errcode = '40001';
  end if;

  if length(trim(p_name)) < 2 then
    raise exception 'Community name must be at least 2 characters' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,59}$' then
    raise exception 'Slug must be 3-60 lowercase letters, numbers, or hyphens' using errcode = '22023';
  end if;
  if public.mikke_reserved_slug(v_slug)
     or v_compact_name like '%mikke%'
     or v_compact_name like '%official%'
     or v_compact_name like '%admin%'
     or v_compact_name like '%system%' then
    raise exception 'This Community name or slug is reserved' using errcode = '22023';
  end if;

  insert into public.community_communities (slug, name, description, join_mode, status, owner_user_id)
  values (v_slug, trim(p_name), nullif(trim(p_description), ''), 'open_free', 'active', v_actor)
  returning * into v_community;

  insert into public.community_memberships (community_id, user_id, role, status)
  values (v_community.id, v_actor, 'owner', 'active');
  insert into public.community_member_profiles (community_id, user_id, display_name)
  values (v_community.id, v_actor, coalesce(nullif(trim(p_display_name), ''), 'Community owner'));
  insert into public.community_entitlement_definitions (community_id, key, name, description)
  values (v_community.id, 'paid:member', 'Paid member', 'Basic entitlement for limited rooms');
  insert into public.community_rooms
    (community_id, title, description, kind, access_type, sort_order, member_can_post, member_can_comment)
  values
    (v_community.id, 'Announcements', 'Post official community announcements.', 'announcement', 'free', 10, false, true),
    (v_community.id, 'Free talk', 'Members can post and talk freely.', 'normal', 'free', 20, true, true),
    (v_community.id, 'Questions', 'Members can post questions and consultations.', 'question', 'free', 30, true, true);

  update platform_billing_private.creation_entitlements e
  set status = 'consumed', resource_id = v_community.id,
      consumed_at = v_now, updated_at = v_now
  where e.id = v_entitlement.id
    and e.actor_user_id = v_actor
    and e.product_key = 'community_platform'
    and e.status = 'available'
    and e.resource_id is null;
  if not found then
    raise exception 'COMMUNITY_CREATE_ENTITLEMENT_CONFLICT' using errcode = '40001';
  end if;
  return v_community;
end;
$$;

revoke all on function public.community_create_with_platform_entitlement(text,text,text,text)
  from public, anon;
grant execute on function public.community_create_with_platform_entitlement(text,text,text,text)
  to authenticated;

-- The legacy function cannot consume the common entitlement and must not be a
-- browser bypass. Existing Communities and their rights are not modified.
revoke all on function public.community_create(text,text,text,text)
  from authenticated;

comment on function public.community_create_with_platform_entitlement(text,text,text,text) is
  'Atomically consumes one authoritative Community platform creation entitlement while creating its Community.';

notify pgrst, 'reload schema';
