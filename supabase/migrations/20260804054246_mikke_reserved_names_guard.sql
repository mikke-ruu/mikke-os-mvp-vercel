create or replace function public.community_create(
  p_name text,
  p_slug text,
  p_description text default null,
  p_display_name text default null
)
returns public.community_communities
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_slug text := lower(trim(p_slug));
  v_name text := lower(trim(p_name));
  v_compact_name text := regexp_replace(lower(trim(p_name)), '[[:space:]_-]+', '', 'g');
  v_community public.community_communities;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if length(trim(p_name)) < 2 then
    raise exception 'Community name must be at least 2 characters';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,59}$' then
    raise exception 'Slug must be 3-60 lowercase letters, numbers, or hyphens';
  end if;
  if v_slug = any(array[
    'admin',
    'administrator',
    'api',
    'app',
    'apps',
    'auth',
    'billing',
    'community',
    'communities',
    'dashboard',
    'help',
    'home',
    'login',
    'logout',
    'manager',
    'member',
    'members',
    'mikke',
    'mikke-community',
    'mikke-id',
    'mikke-os',
    'mikkeos',
    'mikkeruu',
    'official',
    'official-academy',
    'official-academy-community',
    'official-partner',
    'official-trainer',
    'officialacademy',
    'officialpartner',
    'officialtrainer',
    'owner',
    'profile',
    'root',
    'settings',
    'staff',
    'support',
    'system'
  ]) or v_slug like 'admin-%'
    or v_slug like 'api-%'
    or v_slug like 'mikke-%'
    or v_slug like 'mikkeos-%'
    or v_slug like 'mikkeruu-%'
    or v_slug like 'official-%'
    or v_slug like 'system-%' then
    raise exception 'This slug is reserved for mikke official or system use';
  end if;
  if v_compact_name like '%mikke%'
    or v_compact_name like '%mikkeos%'
    or v_compact_name like '%official%'
    or v_compact_name like '%officialacademy%'
    or v_compact_name like '%admin%'
    or v_compact_name like '%system%' then
    raise exception 'This Community name is reserved for mikke official or system use';
  end if;

  insert into public.community_communities (slug, name, description, join_mode, status, owner_user_id)
  values (v_slug, trim(p_name), nullif(trim(p_description), ''), 'open_free', 'active', v_user_id)
  returning * into v_community;

  insert into public.community_memberships (community_id, user_id, role, status)
  values (v_community.id, v_user_id, 'owner', 'active');

  insert into public.community_member_profiles (community_id, user_id, display_name)
  values (v_community.id, v_user_id, coalesce(nullif(trim(p_display_name), ''), 'Community owner'));

  insert into public.community_entitlement_definitions (community_id, key, name, description)
  values (v_community.id, 'paid:member', 'Paid member', 'Basic entitlement for limited rooms');

  insert into public.community_rooms (community_id, title, description, kind, access_type, sort_order, member_can_post, member_can_comment)
  values
    (v_community.id, 'Announcements', 'Post official community announcements.', 'announcement', 'free', 10, false, true),
    (v_community.id, 'Free talk', 'Members can post and talk freely.', 'normal', 'free', 20, true, true),
    (v_community.id, 'Questions', 'Members can post questions and consultations.', 'question', 'free', 30, true, true);

  return v_community;
end;
$$;

revoke all on function public.community_create(text, text, text, text) from public;
grant execute on function public.community_create(text, text, text, text) to authenticated;
