-- Academy -> Community release contract.
--
-- This migration is a local proposal. It does not enable an invitation policy.
-- A policy must be reviewed and changed from draft to active in a separately
-- approved migration before production invitation issuance can succeed.
-- The existing trial_active mode does not identify the new first-publication
-- trial. Trial issue and acceptance therefore remain fail closed. A later
-- integration must bind an explicit trial record, policy version, effective
-- period and cancellation intent before either paid-only check can change.

create table community_private.academy_community_invitation_policies (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  inviter_authority text not null check (inviter_authority in ('community_owner', 'community_staff')),
  invitation_ttl interval not null check (invitation_ttl > interval '0 seconds'),
  allow_during_academy_trial boolean,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table community_private.academy_community_invitation_policies enable row level security;
revoke all on table community_private.academy_community_invitation_policies
  from public, anon, authenticated, service_role;

alter table public.community_academy_access_invitations
  add column headquarters_id uuid references public.academy_headquarters(id) on delete restrict,
  add column instructor_id uuid references public.academy_instructors(id) on delete restrict,
  add column issued_by_user_id uuid references auth.users(id) on delete restrict,
  add column policy_key text references community_private.academy_community_invitation_policies(key) on delete restrict,
  add column authority_mode text check (authority_mode in ('community_owner', 'community_staff')),
  add column room_ids uuid[],
  add column cancelled_at timestamptz,
  add column cancelled_by_user_id uuid references auth.users(id) on delete set null,
  add column declined_at timestamptz,
  add column revoked_at timestamptz;

alter table public.community_academy_access_invitations
  drop constraint community_academy_access_invitations_status_check,
  add constraint community_academy_access_invitations_status_check
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'revoked', 'expired')),
  add constraint community_academy_access_invitations_release_identity_check
    check (
      (headquarters_id is null and instructor_id is null and issued_by_user_id is null
        and policy_key is null and authority_mode is null and room_ids is null)
      or
      (headquarters_id is not null and instructor_id is not null and issued_by_user_id is not null
        and policy_key is not null and authority_mode is not null and room_ids is not null
        and pg_catalog.cardinality(room_ids) between 1 and 100
        and pg_catalog.array_position(room_ids, null) is null)
    ),
  add constraint community_academy_access_invitations_terminal_timestamp_check
    check (
      headquarters_id is null
      or (
        (status <> 'cancelled' or cancelled_at is not null)
        and (status <> 'declined' or declined_at is not null)
        and (status <> 'revoked' or revoked_at is not null)
      )
    );

create unique index community_academy_release_pending_instructor_uidx
  on public.community_academy_access_invitations(mapping_id, instructor_id)
  where instructor_id is not null and status = 'pending';

create index community_academy_release_overview_idx
  on public.community_academy_access_invitations(headquarters_id, community_id, created_at desc)
  where headquarters_id is not null;

create or replace function community_private.academy_community_actor_allowed(
  p_community_id uuid,
  p_user_id uuid,
  p_authority_mode text,
  p_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and community_private.community_owner_write_allowed(p_community_id, p_at)
    and (
      exists (
        select 1
        from public.community_communities community
        where community.id = p_community_id
          and community.status = 'active'
          and community.owner_user_id = p_user_id
      )
      or (
        p_authority_mode = 'community_staff'
        and exists (
          select 1
          from public.community_memberships membership
          where membership.community_id = p_community_id
            and membership.user_id = p_user_id
            and membership.status = 'active'
            and membership.role in ('owner', 'moderator')
        )
      )
    );
$$;

revoke all on function community_private.academy_community_actor_allowed(uuid,uuid,text,timestamptz)
  from public, anon, authenticated, service_role;

create or replace function community_private.guard_academy_invitation_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.mapping_id is distinct from old.mapping_id
    or new.community_id is distinct from old.community_id
    or new.user_id is distinct from old.user_id
    or new.entitlement_key is distinct from old.entitlement_key
    or new.source_reference is distinct from old.source_reference
    or new.headquarters_id is distinct from old.headquarters_id
    or new.instructor_id is distinct from old.instructor_id
    or new.issued_by_user_id is distinct from old.issued_by_user_id
    or new.policy_key is distinct from old.policy_key
    or new.authority_mode is distinct from old.authority_mode
    or new.room_ids is distinct from old.room_ids then
    raise exception using errcode = '23514',
      message = 'Academy invitation source identity is immutable';
  end if;
  return new;
end;
$$;

revoke all on function community_private.guard_academy_invitation_identity()
  from public, anon, authenticated, service_role;

create or replace function public.academy_get_community_release_overview(
  p_headquarters_id uuid,
  p_community_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_community public.community_communities;
  v_contract record;
  v_contract_json jsonb;
  v_invitation_count bigint;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;
  if not private.academy_can_manage_headquarters(p_headquarters_id) then
    raise exception using errcode = '42501', message = 'Academy headquarters management is required';
  end if;

  select community.* into v_community
  from public.community_communities community
  where community.id = p_community_id
    and community.status = 'active'
    and community.owner_user_id = v_actor
    and community_private.community_owner_read_allowed(
      community.id, v_actor, pg_catalog.statement_timestamp()
    );
  if v_community.id is null then
    raise exception using errcode = '42501', message = 'Community owner authority is required';
  end if;

  select access.* into v_contract
  from community_private.community_platform_access_window(p_community_id, pg_catalog.statement_timestamp()) access;

  if found then
    v_contract_json := jsonb_build_object(
      'kind', 'available',
      'status', v_contract.status,
      'currentPeriodStartsAt', v_contract.current_period_start,
      'currentPeriodEndsAt', v_contract.current_period_end,
      'writeAllowed', v_contract.write_allowed
    );
  else
    v_contract_json := jsonb_build_object('kind', 'unavailable');
  end if;

  select count(*) into v_invitation_count
  from public.community_academy_access_invitations invitation
  where invitation.headquarters_id = p_headquarters_id
    and invitation.community_id = p_community_id;

  return jsonb_build_object(
    'community', jsonb_build_object(
      'id', v_community.id,
      'slug', v_community.slug,
      'name', v_community.name,
      'status', v_community.status
    ),
    'contract', v_contract_json,
    'activeMemberCount', (
      select count(*)
      from public.community_memberships membership
      where membership.community_id = p_community_id
        and membership.status = 'active'
    ),
    'invitationCount', v_invitation_count,
    'invitationsTruncated', v_invitation_count > 200,
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', listed.id,
        'instructorId', listed.instructor_id,
        'status', case
          when listed.status = 'pending'
            and listed.expires_at is not null
            and listed.expires_at <= pg_catalog.statement_timestamp() then 'expired'
          else listed.status
        end,
        'roomIds', listed.room_ids,
        'createdAt', listed.created_at,
        'expiresAt', listed.expires_at,
        'acceptedAt', listed.accepted_at,
        'cancelledAt', listed.cancelled_at,
        'declinedAt', listed.declined_at,
        'revokedAt', listed.revoked_at
      ) order by listed.created_at desc)
      from (
        select invitation.*
        from public.community_academy_access_invitations invitation
        where invitation.headquarters_id = p_headquarters_id
          and invitation.community_id = p_community_id
        order by invitation.created_at desc
        limit 200
      ) listed
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.academy_get_community_release_overview(uuid,uuid)
  from public, anon;
grant execute on function public.academy_get_community_release_overview(uuid,uuid)
  to authenticated;

create or replace function public.academy_issue_community_instructor_invitation(
  p_headquarters_id uuid,
  p_community_id uuid,
  p_mapping_id uuid,
  p_instructor_id uuid,
  p_room_ids uuid[],
  p_policy_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_policy community_private.academy_community_invitation_policies;
  v_mapping public.community_access_source_mappings;
  v_instructor public.academy_instructors;
  v_invitation_id uuid;
  v_existing_id uuid;
  v_access_mode text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;
  if not private.academy_can_manage_headquarters(p_headquarters_id) then
    raise exception using errcode = '42501', message = 'Academy headquarters management is required';
  end if;

  select policy.* into v_policy
  from community_private.academy_community_invitation_policies policy
  where policy.key = p_policy_key
    and policy.status = 'active'
    and policy.allow_during_academy_trial is not null;
  if v_policy.key is null then
    raise exception using errcode = '55000', message = 'Approved Academy Community invitation policy is not available';
  end if;
  if not community_private.academy_community_actor_allowed(
    p_community_id, v_actor, v_policy.inviter_authority, v_now
  ) then
    raise exception using errcode = '42501', message = 'Community invitation authority is required';
  end if;

  v_access_mode := private.academy_headquarters_access_mode(p_headquarters_id);
  if coalesce(v_access_mode, '') <> 'paid' then
    raise exception using errcode = '42501', message = 'Current paid Academy access is required for Community invitations';
  end if;

  select mapping.* into v_mapping
  from public.community_access_source_mappings mapping
  where mapping.id = p_mapping_id
    and mapping.community_id = p_community_id
    and mapping.provider_type = 'academy_subscription'
    and mapping.provider_owner_key = p_headquarters_id::text
    and mapping.status = 'active';
  if v_mapping.id is null then
    raise exception using errcode = '42501', message = 'Active Academy-to-Community mapping was not found';
  end if;

  select instructor.* into v_instructor
  from public.academy_instructors instructor
  where instructor.id = p_instructor_id
    and instructor.headquarters_id = p_headquarters_id
    and instructor.user_id is not null
    and instructor.is_active = true
    and instructor.registration_status = 'registered';
  if v_instructor.id is null then
    raise exception using errcode = '42501', message = 'Registered Academy instructor was not found';
  end if;

  if p_room_ids is null
    or pg_catalog.cardinality(p_room_ids) not between 1 and 100
    or pg_catalog.cardinality(p_room_ids) <> (
      select count(distinct requested.room_id)
      from pg_catalog.unnest(p_room_ids) requested(room_id)
    )
    or exists (
      select 1
      from pg_catalog.unnest(p_room_ids) requested(room_id)
      where not exists (
        select 1
        from public.community_rooms room
        join public.community_room_entitlement_rules rule
          on rule.room_id = room.id
         and rule.community_id = room.community_id
        where room.id = requested.room_id
          and room.community_id = p_community_id
          and room.is_archived = false
          and rule.entitlement_key = v_mapping.entitlement_key
      )
    ) then
    raise exception using errcode = '42501', message = 'Requested Room scope is not allowed by this mapping';
  end if;

  update public.community_academy_access_invitations invitation
  set status = 'expired', updated_at = v_now
  where invitation.mapping_id = p_mapping_id
    and invitation.instructor_id = p_instructor_id
    and invitation.status = 'pending'
    and invitation.expires_at is not null
    and invitation.expires_at <= v_now;

  select invitation.id into v_existing_id
  from public.community_academy_access_invitations invitation
  where invitation.mapping_id = p_mapping_id
    and invitation.instructor_id = p_instructor_id
    and invitation.status = 'pending'
  for update;
  if v_existing_id is not null then
    return jsonb_build_object('id', v_existing_id, 'status', 'pending', 'reused', true);
  end if;

  if exists (
    select 1
    from public.community_academy_entitlement_claims claim
    where claim.mapping_id = p_mapping_id
      and claim.user_id = v_instructor.user_id
      and claim.status = 'active'
      and claim.starts_at <= v_now
      and (claim.ends_at is null or claim.ends_at > v_now)
  ) then
    raise exception using errcode = '55000', message = 'Instructor already has active Academy Community access';
  end if;

  insert into public.community_academy_access_invitations (
    mapping_id, community_id, user_id, entitlement_key, source_reference,
    academy_role, status, starts_at, expires_at, headquarters_id, instructor_id,
    issued_by_user_id, policy_key, authority_mode, room_ids
  ) values (
    v_mapping.id, v_mapping.community_id, v_instructor.user_id, v_mapping.entitlement_key,
    'academy-instructor:' || p_instructor_id::text || ':' || extensions.gen_random_uuid()::text,
    'instructor', 'pending', v_now, v_now + v_policy.invitation_ttl,
    p_headquarters_id, p_instructor_id, v_actor, v_policy.key,
    v_policy.inviter_authority, p_room_ids
  )
  on conflict (mapping_id, instructor_id)
    where instructor_id is not null and status = 'pending'
  do nothing
  returning id into v_invitation_id;

  if v_invitation_id is null then
    select invitation.id into v_invitation_id
    from public.community_academy_access_invitations invitation
    where invitation.mapping_id = p_mapping_id
      and invitation.instructor_id = p_instructor_id
      and invitation.status = 'pending';
    return jsonb_build_object('id', v_invitation_id, 'status', 'pending', 'reused', true);
  end if;

  return jsonb_build_object('id', v_invitation_id, 'status', 'pending', 'reused', false);
end;
$$;

revoke all on function public.academy_issue_community_instructor_invitation(uuid,uuid,uuid,uuid,uuid[],text)
  from public, anon;
grant execute on function public.academy_issue_community_instructor_invitation(uuid,uuid,uuid,uuid,uuid[],text)
  to authenticated;

create or replace function public.academy_cancel_community_instructor_invitation(
  p_headquarters_id uuid,
  p_community_id uuid,
  p_invitation_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_invitation public.community_academy_access_invitations;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;
  if not private.academy_can_manage_headquarters(p_headquarters_id) then
    raise exception using errcode = '42501', message = 'Academy headquarters management is required';
  end if;

  select invitation.* into v_invitation
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.headquarters_id = p_headquarters_id
    and invitation.community_id = p_community_id;
  if v_invitation.id is null then
    raise exception using errcode = '42501', message = 'Academy Community invitation was not found';
  end if;
  if not community_private.academy_community_actor_allowed(
    p_community_id, v_actor, v_invitation.authority_mode, v_now
  ) then
    raise exception using errcode = '42501', message = 'Community invitation authority is required';
  end if;

  perform 1
  from public.community_entitlement_definitions definition
  where definition.community_id = v_invitation.community_id
    and definition.key = v_invitation.entitlement_key
  for update;

  select invitation.* into v_invitation
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.headquarters_id = p_headquarters_id
    and invitation.community_id = p_community_id
  for update;

  if v_invitation.status = 'pending' and v_invitation.expires_at <= v_now then
    update public.community_academy_access_invitations
    set status = 'expired', updated_at = v_now
    where id = v_invitation.id;
    return 'expired';
  end if;
  if v_invitation.status = 'pending' then
    update public.community_academy_access_invitations
    set status = 'cancelled', cancelled_at = v_now, cancelled_by_user_id = v_actor, updated_at = v_now
    where id = v_invitation.id;
    return 'cancelled';
  end if;
  if v_invitation.status = 'accepted' then
    update public.community_academy_entitlement_claims
    set status = 'revoked', updated_at = v_now
    where invitation_id = v_invitation.id
      and status = 'active';
    update public.community_academy_access_invitations
    set status = 'revoked', revoked_at = v_now, cancelled_by_user_id = v_actor, updated_at = v_now
    where id = v_invitation.id;
    perform community_private.refresh_academy_subscription_entitlement(
      v_invitation.community_id, v_invitation.user_id, v_invitation.entitlement_key
    );
    return 'revoked';
  end if;

  return v_invitation.status;
end;
$$;

revoke all on function public.academy_cancel_community_instructor_invitation(uuid,uuid,uuid)
  from public, anon;
grant execute on function public.academy_cancel_community_instructor_invitation(uuid,uuid,uuid)
  to authenticated;

create or replace function public.community_decline_my_academy_access_invitation(
  p_invitation_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_invitation public.community_academy_access_invitations;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;

  select invitation.* into v_invitation
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.user_id = v_actor;
  if v_invitation.id is null then
    raise exception using errcode = '42501', message = 'Academy Community invitation was not found';
  end if;

  perform 1
  from public.community_entitlement_definitions definition
  where definition.community_id = v_invitation.community_id
    and definition.key = v_invitation.entitlement_key
  for update;

  select invitation.* into v_invitation
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.user_id = v_actor
  for update;

  if v_invitation.status = 'pending' and v_invitation.expires_at <= v_now then
    update public.community_academy_access_invitations
    set status = 'expired', updated_at = v_now
    where id = v_invitation.id;
    return 'expired';
  end if;
  if v_invitation.status <> 'pending' then
    return v_invitation.status;
  end if;

  update public.community_academy_access_invitations
  set status = 'declined', declined_at = v_now, updated_at = v_now
  where id = v_invitation.id;
  return 'declined';
end;
$$;

revoke all on function public.community_decline_my_academy_access_invitation(uuid)
  from public, anon;
grant execute on function public.community_decline_my_academy_access_invitation(uuid)
  to authenticated;

create or replace function public.community_expire_academy_access_invitations(
  p_at timestamptz default pg_catalog.statement_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Academy invitation expiry requires the service role';
  end if;
  if p_at is null then
    raise exception using errcode = '22023', message = 'Expiry time is required';
  end if;

  update public.community_academy_access_invitations
  set status = 'expired', updated_at = p_at
  where status = 'pending'
    and expires_at is not null
    and expires_at <= p_at;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.community_expire_academy_access_invitations(timestamptz)
  from public, anon, authenticated;
grant execute on function public.community_expire_academy_access_invitations(timestamptz)
  to service_role;

-- Add current source and authority validation to the existing acceptance flow.
create or replace function public.community_accept_academy_access_invitation(
  p_invitation_id uuid,
  p_display_name text,
  p_legal_name text,
  p_phone text,
  p_join_reason text,
  p_accept_terms boolean,
  p_accept_rules boolean,
  p_accept_privacy boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invitation public.community_academy_access_invitations;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;
  if not (p_accept_terms and p_accept_rules and p_accept_privacy) then
    raise exception using errcode = '22023', message = 'All required Community documents must be accepted';
  end if;

  select invitation.* into v_invitation
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.user_id = v_user_id
    and invitation.status = 'pending'
    and (invitation.expires_at is null or invitation.expires_at > v_now)
    and (invitation.ends_at is null or invitation.ends_at > v_now);
  if v_invitation.id is null then
    raise exception 'Pending Academy access invitation was not found';
  end if;

  if v_invitation.headquarters_id is not null then
    if coalesce(private.academy_headquarters_access_mode(v_invitation.headquarters_id), '') <> 'paid' then
      raise exception using errcode = '42501', message = 'Current paid Academy access is required';
    end if;
    if not exists (
      select 1
      from community_private.academy_community_invitation_policies policy
      where policy.key = v_invitation.policy_key
        and policy.status = 'active'
        and policy.allow_during_academy_trial is not null
    ) then
      raise exception using errcode = '42501', message = 'Current Academy Community invitation policy is required';
    end if;
    if not exists (
      select 1
      from public.academy_instructors instructor
      where instructor.id = v_invitation.instructor_id
        and instructor.headquarters_id = v_invitation.headquarters_id
        and instructor.user_id = v_user_id
        and instructor.is_active = true
        and instructor.registration_status = 'registered'
    ) then
      raise exception using errcode = '42501', message = 'Current Academy instructor registration is required';
    end if;
    if coalesce(private.academy_headquarters_role(
      v_invitation.headquarters_id, v_invitation.issued_by_user_id
    ), '') not in ('owner', 'administrator') then
      raise exception using errcode = '42501', message = 'Current Academy issuer authority is required';
    end if;
    if not community_private.academy_community_actor_allowed(
      v_invitation.community_id, v_invitation.issued_by_user_id,
      v_invitation.authority_mode, v_now
    ) then
      raise exception using errcode = '42501', message = 'Current Community issuer authority is required';
    end if;
    if not exists (
      select 1
      from public.community_access_source_mappings mapping
      where mapping.id = v_invitation.mapping_id
        and mapping.community_id = v_invitation.community_id
        and mapping.provider_type = 'academy_subscription'
        and mapping.provider_owner_key = v_invitation.headquarters_id::text
        and mapping.entitlement_key = v_invitation.entitlement_key
        and mapping.status = 'active'
    ) then
      raise exception using errcode = '42501', message = 'Current Academy Community mapping is required';
    end if;
  end if;

  perform community_private.community_assert_new_membership_capacity(
    v_invitation.community_id, v_user_id, v_now
  );
  perform pg_catalog.set_config(
    'mikke.community_capacity_checked',
    v_invitation.community_id::text || ':' || v_user_id::text,
    true
  );

  return public.community_accept_academy_invitation_pre_capacity(
    p_invitation_id, p_display_name, p_legal_name, p_phone, p_join_reason,
    p_accept_terms, p_accept_rules, p_accept_privacy
  );
end;
$$;

revoke all on function public.community_accept_academy_access_invitation(uuid,text,text,text,text,boolean,boolean,boolean)
  from public, anon;
grant execute on function public.community_accept_academy_access_invitation(uuid,text,text,text,text,boolean,boolean,boolean)
  to authenticated;

-- A fixed invitation Room snapshot limits Academy claims even if the mapping's
-- entitlement rules are expanded later. Legacy invitations keep prior behavior.
create or replace function community_private.can_access_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt()->>'is_anonymous'), 'false') <> 'true'
    and exists (
      select 1
      from public.community_rooms room
      join public.community_memberships membership
        on membership.community_id = room.community_id
       and membership.user_id = (select auth.uid())
       and membership.status = 'active'
      join public.community_communities community on community.id = room.community_id
      where room.id = p_room_id
        and room.is_archived = false
        and (
          community_private.is_staff(room.community_id)
          or (
            community.owner_user_id = (select auth.uid())
            and community_private.community_owner_read_allowed(
              room.community_id, (select auth.uid()), pg_catalog.clock_timestamp()
            )
          )
          or (
            community.owner_user_id <> (select auth.uid())
            and membership.access_scope = 'community'
            and room.access_type = 'free'
          )
          or (
            room.access_type = 'entitlement'
            and (
              exists (
                select 1
                from public.community_room_entitlement_rules rule
                join public.community_member_entitlements entitlement
                  on entitlement.community_id = rule.community_id
                 and entitlement.entitlement_key = rule.entitlement_key
                where rule.room_id = room.id
                  and entitlement.user_id = (select auth.uid())
                  and entitlement.source <> 'academy_subscription'
                  and entitlement.status = 'active'
                  and entitlement.starts_at <= pg_catalog.now()
                  and (entitlement.ends_at is null or entitlement.ends_at > pg_catalog.now())
              )
              or exists (
                select 1
                from public.community_room_entitlement_rules rule
                join public.community_academy_entitlement_claims claim
                  on claim.community_id = rule.community_id
                 and claim.entitlement_key = rule.entitlement_key
                join public.community_access_source_mappings mapping
                  on mapping.id = claim.mapping_id
                 and mapping.community_id = claim.community_id
                 and mapping.entitlement_key = claim.entitlement_key
                 and mapping.provider_type = 'academy_subscription'
                 and mapping.status = 'active'
                join public.community_academy_access_invitations invitation
                  on invitation.id = claim.invitation_id
                 and invitation.community_id = claim.community_id
                where rule.room_id = room.id
                  and claim.user_id = (select auth.uid())
                  and claim.status = 'active'
                  and claim.starts_at <= pg_catalog.now()
                  and (claim.ends_at is null or claim.ends_at > pg_catalog.now())
                  and (invitation.room_ids is null or room.id = any(invitation.room_ids))
              )
            )
          )
        )
    );
$$;

revoke all on function community_private.can_access_room(uuid) from public, anon;
grant execute on function community_private.can_access_room(uuid) to authenticated;

comment on table community_private.academy_community_invitation_policies is
  'Unapproved Academy to Community invitation rules. Production issuance remains blocked while the selected row is draft or trial eligibility is null.';
comment on column community_private.academy_community_invitation_policies.allow_during_academy_trial is
  'Reserved for a later versioned first-publication trial integration. This flag alone never authorizes the legacy trial_active mode.';
comment on function public.academy_get_community_release_overview(uuid,uuid) is
  'Owner-only minimum read contract for one Academy headquarters and Community. Errors are raised and never represented as zero counts.';
comment on function public.academy_issue_community_instructor_invitation(uuid,uuid,uuid,uuid,uuid[],text) is
  'Issues or returns one pending instructor invitation after current Academy, Community, mapping, instructor and fixed Room-scope checks.';
comment on function public.academy_cancel_community_instructor_invitation(uuid,uuid,uuid) is
  'Explicit per-invitation administrator action. Accepted access is revoked immediately. A paid-transition cancellation that preserves access until its original end is a separate future legal and integration event.';
