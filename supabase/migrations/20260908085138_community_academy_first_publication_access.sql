-- Community integration for Academy's explicit first-publication access.
-- Depends on private.academy_first_publication_access(uuid). This migration
-- does not activate a Community invitation policy or send an invitation.

alter table community_private.academy_community_invitation_policies
  add column academy_access_scheme text,
  add column academy_policy_version text,
  add column community_consent_revision text,
  add column community_consent_mode text,
  add column source_cancellation_mode text;

alter table community_private.academy_community_invitation_policies
  add constraint academy_community_invitation_policy_source_fields_check
  check (
    (
      academy_access_scheme is null
      and academy_policy_version is null
      and community_consent_revision is null
      and community_consent_mode is null
      and source_cancellation_mode is null
    )
    or (
      academy_access_scheme = 'first_publication_168h_v1'
      and academy_policy_version = 'academy-first-publication-trial-2026-09-08-v1'
      and community_consent_revision = 'academy-first-publication-community-invitation-consent-2026-09-08-v1'
      and community_consent_mode = 'snapshot_current_versions_at_issue'
      and source_cancellation_mode = 'preserve_accepted_until_source_end'
    )
  );

alter table public.community_academy_access_invitations
  add column academy_access_scheme text,
  add column academy_policy_version text,
  add column community_consent_revision text,
  add column source_cancellation_mode text,
  add column community_terms_version integer,
  add column community_rules_version integer,
  add column community_privacy_version integer,
  add column source_stopped_at timestamptz;

alter table public.community_academy_access_invitations
  add constraint community_academy_invitation_source_snapshot_check
  check (
    (
      academy_access_scheme is null
      and academy_policy_version is null
      and community_consent_revision is null
      and source_cancellation_mode is null
      and community_terms_version is null
      and community_rules_version is null
      and community_privacy_version is null
    )
    or (
      headquarters_id is not null
      and academy_access_scheme = 'first_publication_168h_v1'
      and pg_catalog.char_length(pg_catalog.btrim(academy_policy_version)) between 1 and 100
      and community_consent_revision = 'academy-first-publication-community-invitation-consent-2026-09-08-v1'
      and source_cancellation_mode = 'preserve_accepted_until_source_end'
      and community_terms_version > 0
      and community_rules_version > 0
      and community_privacy_version > 0
      and ends_at is not null
    )
  );

create or replace function community_private.academy_first_publication_invitation_access(
  p_headquarters_id uuid
)
returns table (
  scheme text,
  policy_version text,
  active boolean,
  invite_allowed boolean,
  ends_at timestamptz,
  phase text,
  cancellation_accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_access jsonb;
begin
  v_access := private.academy_first_publication_access(p_headquarters_id);
  if v_access is null then return; end if;

  if v_access ->> 'scheme' <> 'first_publication_168h_v1'
    or nullif(pg_catalog.btrim(v_access ->> 'policyVersion'), '') is null
    or pg_catalog.jsonb_typeof(v_access -> 'active') <> 'boolean'
    or pg_catalog.jsonb_typeof(v_access -> 'inviteAllowed') <> 'boolean'
    or v_access ->> 'phase' not in (
      'prepared', 'sync_pending', 'trialing', 'cancelled', 'attention', 'paid', 'expired'
    ) then
    raise exception using errcode = '55000', message = 'Academy first-publication access contract is invalid';
  end if;

  scheme := v_access ->> 'scheme';
  policy_version := v_access ->> 'policyVersion';
  active := (v_access ->> 'active')::boolean;
  invite_allowed := (v_access ->> 'inviteAllowed')::boolean;
  phase := v_access ->> 'phase';
  ends_at := nullif(v_access ->> 'endsAt', '')::timestamptz;
  cancellation_accepted_at := nullif(v_access ->> 'cancellationAcceptedAt', '')::timestamptz;

  if invite_allowed and (
    not active
    or cancellation_accepted_at is not null
    or phase not in ('sync_pending', 'trialing', 'paid')
  ) then
    raise exception using errcode = '55000', message = 'Academy first-publication invitation state is inconsistent';
  end if;
  if active and (ends_at is null or ends_at <= pg_catalog.statement_timestamp()) then
    raise exception using errcode = '55000', message = 'Academy first-publication access period is invalid';
  end if;
  return next;
end;
$$;

revoke all on function community_private.academy_first_publication_invitation_access(uuid)
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
    or new.room_ids is distinct from old.room_ids
    or new.academy_access_scheme is distinct from old.academy_access_scheme
    or new.academy_policy_version is distinct from old.academy_policy_version
    or new.community_consent_revision is distinct from old.community_consent_revision
    or new.source_cancellation_mode is distinct from old.source_cancellation_mode
    or new.community_terms_version is distinct from old.community_terms_version
    or new.community_rules_version is distinct from old.community_rules_version
    or new.community_privacy_version is distinct from old.community_privacy_version then
    raise exception using errcode = '23514', message = 'Academy invitation source identity is immutable';
  end if;
  return new;
end;
$$;

revoke all on function community_private.guard_academy_invitation_identity()
  from public, anon, authenticated, service_role;

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
  v_settings public.community_safety_settings;
  v_access record;
  v_has_new_access boolean := false;
  v_source_end timestamptz;
  v_invitation_expires_at timestamptz;
  v_invitation_id uuid;
  v_existing public.community_academy_access_invitations;
  v_room_ids uuid[];
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;
  if coalesce(private.academy_headquarters_role(p_headquarters_id, v_actor), '') <> 'owner' then
    raise exception using errcode = '42501', message = 'Academy headquarters owner authority is required';
  end if;

  -- Academy cancellation takes this lock before writing its intent. Keep this
  -- as the first transactional lock in the Community issue path.
  perform private.academy_first_publication_lock(p_headquarters_id);

  select policy.* into v_policy
  from community_private.academy_community_invitation_policies policy
  where policy.key = p_policy_key
    and policy.status = 'active'
    and policy.allow_during_academy_trial is not null;
  if v_policy.key is null then
    raise exception using errcode = '55000', message = 'Approved Academy Community invitation policy is not available';
  end if;
  if v_policy.inviter_authority <> 'community_owner' then
    raise exception using errcode = '55000', message = 'Academy Community invitations require Community owner authority';
  end if;
  if not community_private.academy_community_actor_allowed(
    p_community_id, v_actor, v_policy.inviter_authority, v_now
  ) then
    raise exception using errcode = '42501', message = 'Community invitation authority and current access are required';
  end if;

  select access.* into v_access
  from community_private.academy_first_publication_invitation_access(p_headquarters_id) access;
  v_has_new_access := found;

  if v_has_new_access then
    if not v_access.active or not v_access.invite_allowed then
      raise exception using errcode = '42501', message = 'Academy first-publication invitations are currently stopped';
    end if;
    if v_policy.key is distinct from 'academy_first_publication_community_invitation_v1'
      or v_policy.academy_access_scheme is distinct from v_access.scheme
      or v_policy.academy_policy_version is distinct from v_access.policy_version
      or v_policy.community_consent_revision is distinct from 'academy-first-publication-community-invitation-consent-2026-09-08-v1'
      or v_policy.allow_during_academy_trial is distinct from true
      or v_policy.community_consent_mode is distinct from 'snapshot_current_versions_at_issue'
      or v_policy.source_cancellation_mode is distinct from 'preserve_accepted_until_source_end' then
      raise exception using errcode = '55000', message = 'Academy Community policy version does not match current access';
    end if;
    v_source_end := v_access.ends_at;
  else
    if v_policy.academy_access_scheme is not null
      or coalesce(private.academy_headquarters_access_mode(p_headquarters_id), '') <> 'paid' then
      raise exception using errcode = '42501', message = 'Current eligible Academy access is required for Community invitations';
    end if;
  end if;

  select settings.* into v_settings
  from public.community_safety_settings settings
  where settings.community_id = p_community_id;
  if v_settings.community_id is null then
    raise exception using errcode = '55000', message = 'Community consent settings were not found';
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
  select pg_catalog.array_agg(requested.room_id order by requested.room_id)
    into v_room_ids
  from (select distinct room_id from pg_catalog.unnest(p_room_ids) room_id) requested;

  v_invitation_expires_at := v_now + v_policy.invitation_ttl;
  if v_source_end is not null then
    v_invitation_expires_at := least(v_invitation_expires_at, v_source_end);
  end if;

  update public.community_academy_access_invitations invitation
  set status = 'expired', source_stopped_at = coalesce(invitation.source_stopped_at, v_now), updated_at = v_now
  where invitation.mapping_id = p_mapping_id
    and invitation.instructor_id = p_instructor_id
    and invitation.status = 'pending'
    and (
      (invitation.expires_at is not null and invitation.expires_at <= v_now)
      or (invitation.ends_at is not null and invitation.ends_at <= v_now)
    );

  select invitation.* into v_existing
  from public.community_academy_access_invitations invitation
  where invitation.mapping_id = p_mapping_id
    and invitation.instructor_id = p_instructor_id
    and invitation.status = 'pending'
  for update;
  if v_existing.id is not null then
    if v_existing.policy_key is distinct from v_policy.key
      or v_existing.room_ids is distinct from v_room_ids
      or v_existing.academy_access_scheme is distinct from (case when v_has_new_access then v_access.scheme else null end)
      or v_existing.academy_policy_version is distinct from (case when v_has_new_access then v_access.policy_version else null end)
      or v_existing.community_consent_revision is distinct from (case when v_has_new_access then v_policy.community_consent_revision else null end)
      or v_existing.ends_at is distinct from v_source_end then
      raise exception using errcode = '55000', message = 'Existing pending invitation uses a different approved scope';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', 'pending', 'reused', true);
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
    academy_role, status, starts_at, ends_at, expires_at, headquarters_id,
    instructor_id, issued_by_user_id, policy_key, authority_mode, room_ids,
    academy_access_scheme, academy_policy_version, community_consent_revision, source_cancellation_mode,
    community_terms_version, community_rules_version, community_privacy_version
  ) values (
    v_mapping.id, v_mapping.community_id, v_instructor.user_id, v_mapping.entitlement_key,
    'academy-instructor:' || p_instructor_id::text || ':' || extensions.gen_random_uuid()::text,
    'instructor', 'pending', v_now, v_source_end, v_invitation_expires_at,
    p_headquarters_id, p_instructor_id, v_actor, v_policy.key,
    v_policy.inviter_authority, v_room_ids,
    case when v_has_new_access then v_access.scheme else null end,
    case when v_has_new_access then v_access.policy_version else null end,
    case when v_has_new_access then v_policy.community_consent_revision else null end,
    case when v_has_new_access then v_policy.source_cancellation_mode else null end,
    case when v_has_new_access then v_settings.terms_version else null end,
    case when v_has_new_access then v_settings.rules_version else null end,
    case when v_has_new_access then v_settings.privacy_version else null end
  )
  on conflict (mapping_id, instructor_id)
    where instructor_id is not null and status = 'pending'
  do nothing
  returning id into v_invitation_id;

  if v_invitation_id is null then
    select invitation.* into v_existing
    from public.community_academy_access_invitations invitation
    where invitation.mapping_id = p_mapping_id
      and invitation.instructor_id = p_instructor_id
      and invitation.status = 'pending';
    if v_existing.id is null
      or v_existing.policy_key is distinct from v_policy.key
      or v_existing.room_ids is distinct from v_room_ids then
      raise exception using errcode = '55000', message = 'Concurrent invitation scope changed';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', 'pending', 'reused', true);
  end if;

  return jsonb_build_object('id', v_invitation_id, 'status', 'pending', 'reused', false);
end;
$$;

revoke all on function public.academy_issue_community_instructor_invitation(uuid,uuid,uuid,uuid,uuid[],text)
  from public, anon;
grant execute on function public.academy_issue_community_instructor_invitation(uuid,uuid,uuid,uuid,uuid[],text)
  to authenticated;

alter function public.community_accept_academy_access_invitation(
  uuid,text,text,text,text,boolean,boolean,boolean
) rename to community_accept_academy_invitation_before_first_publication_20260908;

revoke all on function public.community_accept_academy_invitation_before_first_publication_20260908(
  uuid,text,text,text,text,boolean,boolean,boolean
) from public, anon, authenticated, service_role;

create function public.community_accept_academy_access_invitation(
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
  v_scheme text;
begin
  select invitation.academy_access_scheme into v_scheme
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.user_id = (select auth.uid());
  if v_scheme is not null then
    raise exception using errcode = '22023', message = 'Versioned Community consent is required';
  end if;
  return public.community_accept_academy_invitation_before_first_publication_20260908(
    p_invitation_id, p_display_name, p_legal_name, p_phone, p_join_reason,
    p_accept_terms, p_accept_rules, p_accept_privacy
  );
end;
$$;

revoke all on function public.community_accept_academy_access_invitation(
  uuid,text,text,text,text,boolean,boolean,boolean
) from public, anon;
grant execute on function public.community_accept_academy_access_invitation(
  uuid,text,text,text,text,boolean,boolean,boolean
) to authenticated;

create function public.community_accept_academy_access_invitation_versioned(
  p_invitation_id uuid,
  p_community_consent_revision text,
  p_display_name text,
  p_legal_name text,
  p_phone text,
  p_join_reason text,
  p_accept_terms boolean,
  p_terms_version integer,
  p_accept_rules boolean,
  p_rules_version integer,
  p_accept_privacy boolean,
  p_privacy_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_invitation public.community_academy_access_invitations;
  v_policy community_private.academy_community_invitation_policies;
  v_settings public.community_safety_settings;
  v_access record;
begin
  if v_actor is null then
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
    and invitation.user_id = v_actor
    and invitation.status = 'pending'
    and invitation.academy_access_scheme = 'first_publication_168h_v1'
    and invitation.expires_at > pg_catalog.statement_timestamp()
    and invitation.ends_at > pg_catalog.statement_timestamp();
  if v_invitation.id is null then
    raise exception using errcode = '42501', message = 'Pending first-publication invitation was not found';
  end if;
  if p_community_consent_revision is distinct from v_invitation.community_consent_revision
    or p_community_consent_revision is distinct from 'academy-first-publication-community-invitation-consent-2026-09-08-v1' then
    raise exception using errcode = '22023', message = 'Community invitation consent revision changed';
  end if;

  -- Shared source lock is supplied by the Academy publication migration. Its
  -- cancellation RPC takes the same lock before recording cancellation intent.
  perform private.academy_first_publication_lock(v_invitation.headquarters_id);

  select invitation.* into v_invitation
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.user_id = v_actor
    and invitation.status = 'pending'
    and invitation.academy_access_scheme = 'first_publication_168h_v1'
    and invitation.expires_at > pg_catalog.statement_timestamp()
    and invitation.ends_at > pg_catalog.statement_timestamp();
  if v_invitation.id is null then
    raise exception using errcode = '42501', message = 'Pending first-publication invitation was not found';
  end if;

  select access.* into v_access
  from community_private.academy_first_publication_invitation_access(v_invitation.headquarters_id) access;
  if not found
    or not v_access.active
    or not v_access.invite_allowed
    or v_access.scheme is distinct from v_invitation.academy_access_scheme
    or v_access.policy_version is distinct from v_invitation.academy_policy_version
    or v_access.ends_at is distinct from v_invitation.ends_at then
    raise exception using errcode = '42501', message = 'Academy first-publication invitation is no longer acceptable';
  end if;

  select policy.* into v_policy
  from community_private.academy_community_invitation_policies policy
  where policy.key = v_invitation.policy_key
    and policy.key = 'academy_first_publication_community_invitation_v1'
    and policy.status = 'active';
  if v_policy.key is null
    or v_policy.academy_access_scheme is distinct from v_access.scheme
    or v_policy.academy_policy_version is distinct from v_access.policy_version
    or v_policy.community_consent_revision is distinct from p_community_consent_revision
    or v_policy.inviter_authority is distinct from 'community_owner'
    or v_policy.allow_during_academy_trial is distinct from true
    or v_policy.community_consent_mode is distinct from 'snapshot_current_versions_at_issue'
    or v_policy.source_cancellation_mode is distinct from 'preserve_accepted_until_source_end' then
    raise exception using errcode = '42501', message = 'Current Academy Community invitation policy is required';
  end if;

  select settings.* into v_settings
  from public.community_safety_settings settings
  where settings.community_id = v_invitation.community_id;
  if v_settings.community_id is null
    or p_terms_version is distinct from v_invitation.community_terms_version
    or p_rules_version is distinct from v_invitation.community_rules_version
    or p_privacy_version is distinct from v_invitation.community_privacy_version
    or p_terms_version is distinct from v_settings.terms_version
    or p_rules_version is distinct from v_settings.rules_version
    or p_privacy_version is distinct from v_settings.privacy_version then
    raise exception using errcode = '22023', message = 'Displayed Community document versions changed';
  end if;

  return public.community_accept_academy_invitation_before_first_publication_20260908(
    p_invitation_id, p_display_name, p_legal_name, p_phone, p_join_reason,
    p_accept_terms, p_accept_rules, p_accept_privacy
  );
end;
$$;

revoke all on function public.community_accept_academy_access_invitation_versioned(
  uuid,text,text,text,text,text,boolean,integer,boolean,integer,boolean,integer
) from public, anon;
grant execute on function public.community_accept_academy_access_invitation_versioned(
  uuid,text,text,text,text,text,boolean,integer,boolean,integer,boolean,integer
) to authenticated;

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
    'consentMode', case when invitation.academy_access_scheme is null then 'legacy' else 'versioned' end,
    'communityConsentRevision', invitation.community_consent_revision,
    'canAccept', case
      when invitation.status <> 'pending' then false
      when invitation.expires_at is not null and invitation.expires_at <= pg_catalog.now() then false
      when invitation.ends_at is not null and invitation.ends_at <= pg_catalog.now() then false
      when invitation.academy_access_scheme is null then true
      when source.scheme is null
        or source.scheme is distinct from invitation.academy_access_scheme
        or source.policy_version is distinct from invitation.academy_policy_version then false
      when not source.active or not source.invite_allowed then false
      when policy.key is null
        or policy.key is distinct from 'academy_first_publication_community_invitation_v1'
        or policy.community_consent_revision is distinct from invitation.community_consent_revision then false
      when settings.terms_version is distinct from invitation.community_terms_version
        or settings.rules_version is distinct from invitation.community_rules_version
        or settings.privacy_version is distinct from invitation.community_privacy_version then false
      else true
    end,
    'acceptanceReason', case
      when invitation.status <> 'pending' then 'not_pending'
      when invitation.expires_at is not null and invitation.expires_at <= pg_catalog.now() then 'expired'
      when invitation.ends_at is not null and invitation.ends_at <= pg_catalog.now() then 'expired'
      when invitation.academy_access_scheme is null then null
      when source.scheme is null
        or source.scheme is distinct from invitation.academy_access_scheme
        or source.policy_version is distinct from invitation.academy_policy_version then 'source_unavailable'
      when not source.active then 'source_expired'
      when not source.invite_allowed then 'source_stopped'
      when policy.key is null
        or policy.key is distinct from 'academy_first_publication_community_invitation_v1'
        or policy.community_consent_revision is distinct from invitation.community_consent_revision then 'policy_changed'
      when settings.terms_version is distinct from invitation.community_terms_version
        or settings.rules_version is distinct from invitation.community_rules_version
        or settings.privacy_version is distinct from invitation.community_privacy_version then 'documents_changed'
      else null
    end,
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
        from public.community_rooms room
        where room.community_id = invitation.community_id
          and room.is_archived = false
          and (
            (invitation.room_ids is not null and room.id = any(invitation.room_ids))
            or (
              invitation.room_ids is null
              and exists (
                select 1
                from public.community_room_entitlement_rules rule
                where rule.community_id = invitation.community_id
                  and rule.room_id = room.id
                  and rule.entitlement_key = invitation.entitlement_key
              )
            )
          )
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
  left join lateral community_private.academy_first_publication_invitation_access(
    invitation.headquarters_id
  ) source on invitation.academy_access_scheme is not null
  left join community_private.academy_community_invitation_policies policy
    on policy.key = invitation.policy_key
   and policy.status = 'active'
  where invitation.id = p_invitation_id
    and invitation.user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true';
$$;

revoke all on function public.community_get_my_academy_access_invitation(uuid)
  from public, anon;
grant execute on function public.community_get_my_academy_access_invitation(uuid)
  to authenticated;

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
                  and (
                    invitation.academy_access_scheme is null
                    or exists (
                      select 1
                      from community_private.academy_first_publication_invitation_access(
                        invitation.headquarters_id
                      ) source
                      where source.scheme = invitation.academy_access_scheme
                        and source.policy_version = invitation.academy_policy_version
                        and source.active
                        and source.ends_at is not null
                        and source.ends_at > pg_catalog.now()
                        and invitation.ends_at is not null
                        and invitation.ends_at > pg_catalog.now()
                    )
                  )
              )
            )
          )
        )
    );
$$;

revoke all on function community_private.can_access_room(uuid) from public, anon;
grant execute on function community_private.can_access_room(uuid) to authenticated;

create function public.community_reconcile_academy_first_publication_access(
  p_headquarters_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access record;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_pending_count integer := 0;
  v_claim_count integer := 0;
  v_updated_count integer := 0;
  v_scope record;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Academy access reconciliation requires the service role';
  end if;

  perform private.academy_first_publication_lock(p_headquarters_id);
  select access.* into v_access
  from community_private.academy_first_publication_invitation_access(p_headquarters_id) access;
  if not found then
    raise exception using errcode = '55000', message = 'Academy first-publication access was not found';
  end if;

  if not v_access.invite_allowed then
    update public.community_academy_access_invitations invitation
    set status = 'expired', source_stopped_at = coalesce(invitation.source_stopped_at, v_now), updated_at = v_now
    where invitation.headquarters_id = p_headquarters_id
      and invitation.academy_access_scheme = v_access.scheme
      and invitation.academy_policy_version = v_access.policy_version
      and invitation.status = 'pending';
    get diagnostics v_pending_count = row_count;
  end if;

  if not v_access.active then
    for v_scope in
      select distinct claim.community_id, claim.user_id, claim.entitlement_key
      from public.community_academy_entitlement_claims claim
      join public.community_academy_access_invitations invitation
        on invitation.id = claim.invitation_id
      where invitation.headquarters_id = p_headquarters_id
        and invitation.academy_access_scheme = v_access.scheme
        and invitation.academy_policy_version = v_access.policy_version
        and claim.status = 'active'
    loop
      update public.community_academy_entitlement_claims claim
      set status = 'expired', ends_at = least(coalesce(claim.ends_at, v_now), v_now), updated_at = v_now
      from public.community_academy_access_invitations invitation
      where invitation.id = claim.invitation_id
        and invitation.headquarters_id = p_headquarters_id
        and invitation.academy_access_scheme = v_access.scheme
        and invitation.academy_policy_version = v_access.policy_version
        and claim.community_id = v_scope.community_id
        and claim.user_id = v_scope.user_id
        and claim.entitlement_key = v_scope.entitlement_key
        and claim.status = 'active';
      get diagnostics v_updated_count = row_count;
      v_claim_count := v_claim_count + v_updated_count;

      update public.community_academy_access_invitations invitation
      set status = 'expired', source_stopped_at = coalesce(invitation.source_stopped_at, v_now), updated_at = v_now
      where invitation.headquarters_id = p_headquarters_id
        and invitation.academy_access_scheme = v_access.scheme
        and invitation.academy_policy_version = v_access.policy_version
        and invitation.community_id = v_scope.community_id
        and invitation.user_id = v_scope.user_id
        and invitation.entitlement_key = v_scope.entitlement_key
        and invitation.status = 'accepted';

      perform community_private.refresh_academy_subscription_entitlement(
        v_scope.community_id, v_scope.user_id, v_scope.entitlement_key
      );
    end loop;
  end if;

  return jsonb_build_object(
    'scheme', v_access.scheme,
    'policyVersion', v_access.policy_version,
    'active', v_access.active,
    'inviteAllowed', v_access.invite_allowed,
    'pendingExpired', v_pending_count,
    'claimsExpired', v_claim_count
  );
end;
$$;

revoke all on function public.community_reconcile_academy_first_publication_access(uuid)
  from public, anon, authenticated;
grant execute on function public.community_reconcile_academy_first_publication_access(uuid)
  to service_role;

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
  v_access record;
  v_has_new_access boolean := false;
  v_invitation_count bigint;
  v_policy_count integer := 0;
  v_mapping_count integer := 0;
  v_options jsonb := '[]'::jsonb;
  v_option_state text := 'unavailable';
  v_option_reason text;
  v_instructors jsonb := '[]'::jsonb;
  v_settings public.community_safety_settings;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;
  if coalesce(private.academy_headquarters_role(p_headquarters_id, v_actor), '') <> 'owner' then
    raise exception using errcode = '42501', message = 'Academy headquarters owner authority is required';
  end if;

  select community.* into v_community
  from public.community_communities community
  where community.id = p_community_id
    and community.status = 'active'
    and community.owner_user_id = v_actor;
  if v_community.id is null then
    raise exception using errcode = '42501', message = 'Community owner authority is required';
  end if;

  select settings.* into v_settings
  from public.community_safety_settings settings
  where settings.community_id = p_community_id;
  if v_settings.community_id is null then
    raise exception using errcode = '55000', message = 'Community consent settings were not found';
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

  select access.* into v_access
  from community_private.academy_first_publication_invitation_access(p_headquarters_id) access;
  v_has_new_access := found;

  if not community_private.community_owner_write_allowed(p_community_id, pg_catalog.statement_timestamp()) then
    v_option_reason := 'community_access_unavailable';
  elsif v_has_new_access and not v_access.active then
    v_option_reason := 'academy_access_unavailable';
  elsif v_has_new_access and not v_access.invite_allowed then
    v_option_reason := 'academy_invitation_stopped';
  elsif not v_has_new_access
    and coalesce(private.academy_headquarters_access_mode(p_headquarters_id), '') <> 'paid' then
    v_option_reason := 'academy_access_unavailable';
  end if;

  select count(*) into v_policy_count
  from community_private.academy_community_invitation_policies policy
  where policy.status = 'active'
    and policy.allow_during_academy_trial is not null
    and (
      (
        v_has_new_access
        and policy.key = 'academy_first_publication_community_invitation_v1'
        and policy.academy_access_scheme = v_access.scheme
        and policy.academy_policy_version = v_access.policy_version
        and policy.community_consent_revision = 'academy-first-publication-community-invitation-consent-2026-09-08-v1'
        and policy.inviter_authority = 'community_owner'
        and policy.allow_during_academy_trial = true
        and policy.community_consent_mode = 'snapshot_current_versions_at_issue'
        and policy.source_cancellation_mode = 'preserve_accepted_until_source_end'
      )
      or (
        not v_has_new_access
        and policy.academy_access_scheme is null
      )
    );

  select count(*) into v_mapping_count
  from public.community_access_source_mappings mapping
  where mapping.community_id = p_community_id
    and mapping.provider_type = 'academy_subscription'
    and mapping.provider_owner_key = p_headquarters_id::text
    and mapping.status = 'active'
    and exists (
      select 1
      from public.community_room_entitlement_rules rule
      join public.community_rooms room
        on room.id = rule.room_id
       and room.community_id = rule.community_id
      where rule.community_id = p_community_id
        and rule.entitlement_key = mapping.entitlement_key
        and room.is_archived = false
    );

  if v_option_reason is null and v_policy_count = 0 then
    v_option_reason := 'policy_unavailable';
  elsif v_option_reason is null and v_mapping_count = 0 then
    v_option_reason := 'no_mapping';
  end if;

  if v_option_reason is null then
    v_option_state := 'available';
    select coalesce(jsonb_agg(jsonb_build_object(
      'mappingId', option.mapping_id,
      'policyKey', option.policy_key,
      'rooms', option.rooms
    ) order by option.mapping_id, option.policy_key), '[]'::jsonb)
    into v_options
    from (
      select mapping.id mapping_id, policy.key policy_key,
        (
          select jsonb_agg(jsonb_build_object('id', room.id, 'name', room.title)
            order by room.sort_order, room.created_at)
          from public.community_room_entitlement_rules rule
          join public.community_rooms room
            on room.id = rule.room_id
           and room.community_id = rule.community_id
          where rule.community_id = p_community_id
            and rule.entitlement_key = mapping.entitlement_key
            and room.is_archived = false
        ) rooms
      from public.community_access_source_mappings mapping
      cross join community_private.academy_community_invitation_policies policy
      where mapping.community_id = p_community_id
        and mapping.provider_type = 'academy_subscription'
        and mapping.provider_owner_key = p_headquarters_id::text
        and mapping.status = 'active'
        and policy.status = 'active'
        and policy.allow_during_academy_trial is not null
        and (
          (
            v_has_new_access
            and policy.key = 'academy_first_publication_community_invitation_v1'
            and policy.academy_access_scheme = v_access.scheme
            and policy.academy_policy_version = v_access.policy_version
            and policy.community_consent_revision = 'academy-first-publication-community-invitation-consent-2026-09-08-v1'
            and policy.inviter_authority = 'community_owner'
            and policy.allow_during_academy_trial = true
            and policy.community_consent_mode = 'snapshot_current_versions_at_issue'
            and policy.source_cancellation_mode = 'preserve_accepted_until_source_end'
          )
          or (not v_has_new_access and policy.academy_access_scheme is null)
        )
        and exists (
          select 1
          from public.community_room_entitlement_rules rule
          join public.community_rooms room
            on room.id = rule.room_id
           and room.community_id = rule.community_id
          where rule.community_id = p_community_id
            and rule.entitlement_key = mapping.entitlement_key
            and room.is_archived = false
        )
    ) option;

    select coalesce(jsonb_agg(jsonb_build_object(
      'instructorId', instructor.id,
      'displayName', profile.display_name
    ) order by profile.display_name, instructor.id), '[]'::jsonb)
    into v_instructors
    from public.academy_instructors instructor
    join public.profiles profile on profile.id = instructor.profile_id
    where instructor.headquarters_id = p_headquarters_id
      and instructor.user_id is not null
      and instructor.is_active = true
      and instructor.registration_status = 'registered';
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
    'invitationOptions', jsonb_build_object(
      'state', v_option_state,
      'reason', v_option_reason,
      'items', v_options
    ),
    'instructorCandidates', jsonb_build_object(
      'state', v_option_state,
      'reason', v_option_reason,
      'items', v_instructors
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

comment on function public.academy_get_community_release_overview(uuid,uuid) is
  'Academy-owner and Community-owner overview. Candidate state and reason distinguish unavailable data from a genuine empty candidate list. Invitation history remains capped at 200 rows.';
comment on function public.community_reconcile_academy_first_publication_access(uuid) is
  'Source-event reconciliation. Cancellation stops pending invitations immediately; accepted derived access remains until the source helper becomes inactive. Individual invitation cancellation remains a separate immediate-revocation event.';
