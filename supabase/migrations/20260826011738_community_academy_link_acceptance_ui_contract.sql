-- Read contract for the Academy -> Community acceptance screen. The invitee
-- receives only the Community identity, required consent documents and the
-- Rooms covered by this exact entitlement. No Academy application data or
-- Community-wide member data is exposed.
create or replace function public.community_get_my_academy_access_invitation(
  p_invitation_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', invitation.id,
    'status', invitation.status,
    'academyRole', invitation.academy_role,
    'startsAt', invitation.starts_at,
    'endsAt', invitation.ends_at,
    'expiresAt', invitation.expires_at,
    'community', jsonb_build_object(
      'id', community.id,
      'slug', community.slug,
      'name', community.name,
      'description', community.description,
      'logoUrl', community.logo_url
    ),
    'access', jsonb_build_object(
      'entitlementKey', invitation.entitlement_key,
      'name', definition.name,
      'description', definition.description,
      'rooms', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', room.id, 'title', room.title, 'description', room.description)
          order by room.sort_order, room.created_at
        )
        from public.community_room_entitlement_rules rule
        join public.community_rooms room on room.id = rule.room_id
        where rule.community_id = invitation.community_id
          and rule.entitlement_key = invitation.entitlement_key
          and room.is_archived = false
      ), '[]'::jsonb)
    ),
    'consent', jsonb_build_object(
      'requireLegalName', settings.require_legal_name,
      'requirePhone', settings.require_phone,
      'requireJoinReason', settings.require_join_reason,
      'termsVersion', settings.terms_version,
      'termsText', settings.terms_text,
      'rulesVersion', settings.rules_version,
      'rulesText', settings.rules_text,
      'privacyVersion', settings.privacy_version,
      'privacyText', settings.privacy_text
    ),
    'hasNormalCommunityAccess', exists (
      select 1
      from public.community_memberships membership
      where membership.community_id = invitation.community_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.access_scope = 'community'
    )
  )
  from public.community_academy_access_invitations invitation
  join public.community_communities community
    on community.id = invitation.community_id
   and community.status = 'active'
  join public.community_entitlement_definitions definition
    on definition.community_id = invitation.community_id
   and definition.key = invitation.entitlement_key
   and definition.status = 'active'
  join public.community_safety_settings settings
    on settings.community_id = invitation.community_id
  join public.community_access_source_mappings mapping
    on mapping.id = invitation.mapping_id
   and mapping.community_id = invitation.community_id
   and mapping.entitlement_key = invitation.entitlement_key
   and mapping.provider_type = 'academy_subscription'
   and mapping.status = 'active'
  where invitation.id = p_invitation_id
    and invitation.user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and (invitation.expires_at is null or invitation.expires_at > pg_catalog.now())
    and (invitation.ends_at is null or invitation.ends_at > pg_catalog.now());
$$;

revoke all on function public.community_get_my_academy_access_invitation(uuid)
  from public, anon;
grant execute on function public.community_get_my_academy_access_invitation(uuid)
  to authenticated;

comment on function public.community_get_my_academy_access_invitation(uuid) is
  'Returns the minimum invite, Room scope and versioned Community consent data for the authenticated invitee.';

-- Community staff may continue to manage manual/API mappings, but an Academy
-- mapping also needs current Academy headquarters authority. Route those rows
-- through the dual-authority RPC below.
drop policy if exists "staff can insert access mappings" on public.community_access_source_mappings;
create policy "staff can insert non Academy access mappings"
on public.community_access_source_mappings for insert
to authenticated
with check (
  community_private.is_staff(community_id)
  and created_by_user_id = (select auth.uid())
  and provider_type <> 'academy_subscription'
);

drop policy if exists "staff can update access mappings" on public.community_access_source_mappings;
create policy "staff can update non Academy access mappings"
on public.community_access_source_mappings for update
to authenticated
using (
  community_private.is_staff(community_id)
  and provider_type <> 'academy_subscription'
)
with check (
  community_private.is_staff(community_id)
  and provider_type <> 'academy_subscription'
);

create or replace function public.academy_list_my_community_link_options(
  p_headquarters_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;
  if not private.academy_can_manage_headquarters(p_headquarters_id) then
    raise exception using errcode = '42501', message = 'Academy headquarters management is required';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'communityId', community.id,
      'communitySlug', community.slug,
      'communityName', community.name,
      'definitions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', definition.key,
          'name', definition.name,
          'description', definition.description
        ) order by definition.name)
        from public.community_entitlement_definitions definition
        where definition.community_id = community.id
          and definition.status = 'active'
      ), '[]'::jsonb),
      'mappings', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', mapping.id,
          'sourceProductKey', mapping.source_product_key,
          'entitlementKey', mapping.entitlement_key,
          'status', mapping.status
        ) order by mapping.created_at)
        from public.community_access_source_mappings mapping
        where mapping.community_id = community.id
          and mapping.provider_type = 'academy_subscription'
          and mapping.provider_owner_key = p_headquarters_id::text
      ), '[]'::jsonb)
    ) order by community.name)
    from public.community_communities community
    where community.status = 'active'
      and community_private.is_staff(community.id)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.academy_list_my_community_link_options(uuid)
  from public, anon;
grant execute on function public.academy_list_my_community_link_options(uuid)
  to authenticated;

create or replace function public.academy_upsert_community_room_link(
  p_headquarters_id uuid,
  p_community_id uuid,
  p_source_product_key text,
  p_entitlement_key text,
  p_status text default 'draft'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_mapping_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;
  if not private.academy_can_manage_headquarters(p_headquarters_id) then
    raise exception using errcode = '42501', message = 'Academy headquarters management is required';
  end if;
  if not community_private.is_staff(p_community_id) then
    raise exception using errcode = '42501', message = 'Community staff authority is required';
  end if;
  if char_length(trim(coalesce(p_source_product_key, ''))) not between 1 and 120 then
    raise exception 'A source product key is required';
  end if;
  if p_status not in ('draft', 'active', 'archived') then raise exception 'Unsupported mapping status'; end if;
  if not exists (
    select 1 from public.community_entitlement_definitions definition
    where definition.community_id = p_community_id
      and definition.key = trim(p_entitlement_key)
      and definition.status = 'active'
  ) then raise exception 'Active Community entitlement was not found'; end if;

  insert into public.community_access_source_mappings (
    community_id, provider_type, provider_owner_key, source_product_key,
    entitlement_key, status, created_by_user_id
  ) values (
    p_community_id, 'academy_subscription', p_headquarters_id::text,
    trim(p_source_product_key), trim(p_entitlement_key), p_status, v_user_id
  )
  on conflict (community_id, provider_type, provider_owner_key, source_product_key)
  do update set
    entitlement_key = excluded.entitlement_key,
    status = excluded.status,
    updated_at = now()
  returning id into v_mapping_id;
  return v_mapping_id;
end;
$$;

revoke all on function public.academy_upsert_community_room_link(uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.academy_upsert_community_room_link(uuid, uuid, text, text, text)
  to authenticated;
