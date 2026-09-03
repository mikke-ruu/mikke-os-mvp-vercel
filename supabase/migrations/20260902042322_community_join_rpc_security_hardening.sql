-- Harden the four browser-facing Community membership lifecycle RPCs.
-- Product behavior is preserved; this migration narrows SECURITY DEFINER
-- resolution, rejects anonymous Auth identities and keeps EXECUTE explicit.

create or replace function public.community_invite_by_mikke_id(
  p_community_id uuid,
  p_mikke_id text,
  p_entitlement_key text default null,
  p_expires_at timestamptz default null
)
returns public.community_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_invited_user uuid;
  v_invitation public.community_invitations;
  v_handle text := lower(trim(regexp_replace(coalesce(p_mikke_id, ''), '^@', '')));
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'COMMUNITY_ANONYMOUS_DENIED';
  end if;
  if not community_private.is_staff(p_community_id) then
    raise exception using errcode = '42501', message = 'Staff permission is required';
  end if;
  if p_expires_at is not null and p_expires_at <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'Invitation expiry must be in the future';
  end if;

  select profile.user_id
    into v_invited_user
  from public.profiles profile
  where lower(profile.handle) = v_handle
  limit 1;

  if v_invited_user is null then
    raise exception using errcode = '22023', message = 'Mikke ID was not found';
  end if;
  if exists (
    select 1
    from public.community_memberships membership
    where membership.community_id = p_community_id
      and membership.user_id = v_invited_user
      and membership.status = 'active'
  ) then
    raise exception using errcode = '23505', message = 'This user is already an active member';
  end if;

  insert into public.community_invitations (
    community_id, invited_user_id, invited_by_user_id, invited_mikke_id,
    entitlement_key, status, expires_at
  ) values (
    p_community_id, v_invited_user, v_actor, v_handle,
    nullif(trim(p_entitlement_key), ''), 'pending', p_expires_at
  )
  on conflict (community_id, invited_user_id) do update set
    invited_by_user_id = excluded.invited_by_user_id,
    invited_mikke_id = excluded.invited_mikke_id,
    entitlement_key = excluded.entitlement_key,
    status = 'pending',
    expires_at = excluded.expires_at,
    accepted_at = null,
    updated_at = statement_timestamp()
  returning * into v_invitation;

  return v_invitation;
end;
$$;

create or replace function public.community_leave(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'COMMUNITY_ANONYMOUS_DENIED';
  end if;
  if exists (
    select 1
    from public.community_communities community
    where community.id = p_community_id
      and community.owner_user_id = v_user
  ) then
    raise exception using errcode = '42501', message = 'The owner must transfer ownership before leaving';
  end if;

  update public.community_memberships membership
  set status = 'left'
  where membership.community_id = p_community_id
    and membership.user_id = v_user
    and membership.status = 'active';
  if not found then
    raise exception using errcode = 'P0002', message = 'Active membership was not found';
  end if;

  update public.community_member_entitlements entitlement
  set status = 'revoked',
      ends_at = coalesce(entitlement.ends_at, statement_timestamp())
  where entitlement.community_id = p_community_id
    and entitlement.user_id = v_user
    and entitlement.status = 'active';
end;
$$;

create or replace function public.community_submit_join_application(
  p_community_id uuid,
  p_display_name text,
  p_legal_name text,
  p_phone text,
  p_join_reason text,
  p_accept_terms boolean,
  p_accept_rules boolean,
  p_accept_privacy boolean
)
returns public.community_join_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_settings public.community_safety_settings;
  v_application public.community_join_applications;
  v_status text;
  v_invitation public.community_invitations;
  v_now timestamptz := statement_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'COMMUNITY_ANONYMOUS_DENIED';
  end if;
  if exists (
    select 1
    from public.community_memberships membership
    where membership.community_id = p_community_id
      and membership.user_id = v_user_id
      and membership.status = 'active'
  ) then
    raise exception using errcode = '23505', message = 'This user is already an active member';
  end if;

  select auth_user.email
    into v_email
  from auth.users auth_user
  where auth_user.id = v_user_id;

  select invitation.*
    into v_invitation
  from public.community_invitations invitation
  where invitation.community_id = p_community_id
    and invitation.invited_user_id = v_user_id
    and invitation.status = 'pending'
    and (invitation.expires_at is null or invitation.expires_at > v_now)
  for update;

  select settings.*
    into v_settings
  from public.community_safety_settings settings
  join public.community_communities community
    on community.id = settings.community_id
  where settings.community_id = p_community_id
    and community.status = 'active'
    and (community.join_mode = 'open_free' or v_invitation.id is not null);

  if v_settings.community_id is null then
    raise exception using errcode = '42501', message = 'This Community is not accepting applications';
  end if;
  if char_length(trim(coalesce(p_display_name, ''))) < 1 then
    raise exception using errcode = '22023', message = 'Display name is required';
  end if;
  if v_settings.require_legal_name
     and char_length(trim(coalesce(p_legal_name, ''))) < 1 then
    raise exception using errcode = '22023', message = 'Legal name is required';
  end if;
  if v_settings.require_phone
     and char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')) < 8 then
    raise exception using errcode = '22023', message = 'A valid phone number is required';
  end if;
  if v_settings.require_join_reason
     and char_length(trim(coalesce(p_join_reason, ''))) < 1 then
    raise exception using errcode = '22023', message = 'Join reason is required';
  end if;
  if not (p_accept_terms and p_accept_rules and p_accept_privacy) then
    raise exception using errcode = '22023', message = 'All required documents must be accepted';
  end if;

  v_status := case
    when v_invitation.id is not null or v_settings.approval_mode = 'auto' then 'approved'
    else 'pending'
  end;

  insert into public.community_join_applications (
    community_id, user_id, display_name, legal_name, email, phone, join_reason,
    status, reviewed_by_user_id, review_note, submitted_at, reviewed_at
  ) values (
    p_community_id, v_user_id, trim(p_display_name), nullif(trim(p_legal_name), ''), v_email,
    nullif(trim(p_phone), ''), nullif(trim(p_join_reason), ''), v_status,
    case
      when v_invitation.id is not null then v_invitation.invited_by_user_id
      when v_status = 'approved' then v_user_id
      else null
    end,
    case
      when v_invitation.id is not null then 'Approved by mikke ID invitation'
      when v_status = 'approved' then 'Auto approved'
      else null
    end,
    v_now,
    case when v_status = 'approved' then v_now else null end
  )
  on conflict (community_id, user_id) do update set
    display_name = excluded.display_name,
    legal_name = excluded.legal_name,
    email = excluded.email,
    phone = excluded.phone,
    join_reason = excluded.join_reason,
    status = excluded.status,
    reviewed_by_user_id = excluded.reviewed_by_user_id,
    review_note = excluded.review_note,
    submitted_at = v_now,
    reviewed_at = excluded.reviewed_at
  returning * into v_application;

  insert into public.community_consent_records (
    community_id, application_id, user_id, document_type, document_version
  ) values
    (p_community_id, v_application.id, v_user_id, 'terms', v_settings.terms_version),
    (p_community_id, v_application.id, v_user_id, 'rules', v_settings.rules_version),
    (p_community_id, v_application.id, v_user_id, 'privacy', v_settings.privacy_version)
  on conflict do nothing;

  if v_status = 'approved' then
    insert into public.community_memberships (community_id, user_id, role, status)
    values (p_community_id, v_user_id, 'member', 'active')
    on conflict (community_id, user_id) do update set status = 'active';

    insert into public.community_member_profiles (community_id, user_id, display_name)
    values (p_community_id, v_user_id, trim(p_display_name))
    on conflict (community_id, user_id) do update
      set display_name = excluded.display_name;

    if v_invitation.id is not null then
      update public.community_invitations invitation
      set status = 'accepted',
          accepted_at = v_now
      where invitation.id = v_invitation.id;

      if v_invitation.entitlement_key is not null then
        insert into public.community_member_entitlements (
          community_id, user_id, entitlement_key, source, source_reference,
          status, granted_by_user_id
        ) values (
          p_community_id, v_user_id, v_invitation.entitlement_key,
          'external', 'invitation:' || v_invitation.id, 'active',
          v_invitation.invited_by_user_id
        )
        on conflict (community_id, user_id, entitlement_key, source) do update set
          status = 'active',
          source_reference = excluded.source_reference,
          granted_by_user_id = excluded.granted_by_user_id,
          starts_at = v_now,
          ends_at = null;
      end if;
    end if;
  end if;

  return v_application;
end;
$$;

create or replace function public.community_review_join_application(
  p_application_id uuid,
  p_decision text,
  p_review_note text default null
)
returns public.community_join_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_application public.community_join_applications;
  v_now timestamptz := statement_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'COMMUNITY_ANONYMOUS_DENIED';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'Invalid decision';
  end if;

  select application.*
    into v_application
  from public.community_join_applications application
  where application.id = p_application_id
  for update;

  if v_application.id is null
     or not community_private.is_staff(v_application.community_id) then
    raise exception using errcode = '42501', message = 'Staff permission is required';
  end if;
  if v_application.status <> 'pending' then
    raise exception using errcode = '55000', message = 'Only pending applications can be reviewed';
  end if;

  update public.community_join_applications application
  set status = p_decision,
      reviewed_by_user_id = v_user_id,
      review_note = nullif(trim(p_review_note), ''),
      reviewed_at = v_now
  where application.id = p_application_id
  returning * into v_application;

  if p_decision = 'approved' then
    insert into public.community_memberships (community_id, user_id, role, status)
    values (v_application.community_id, v_application.user_id, 'member', 'active')
    on conflict (community_id, user_id) do update set status = 'active';

    insert into public.community_member_profiles (community_id, user_id, display_name)
    values (v_application.community_id, v_application.user_id, v_application.display_name)
    on conflict (community_id, user_id) do update
      set display_name = excluded.display_name;
  end if;

  insert into public.community_moderation_actions (
    community_id, actor_user_id, action_type, target_type, target_id, reason
  ) values (
    v_application.community_id, v_user_id, 'join_application_' || p_decision,
    'join_application', v_application.id, p_review_note
  );

  return v_application;
end;
$$;

revoke all on function public.community_invite_by_mikke_id(uuid, text, text, timestamptz)
  from public, anon;
grant execute on function public.community_invite_by_mikke_id(uuid, text, text, timestamptz)
  to authenticated;

revoke all on function public.community_leave(uuid) from public, anon;
grant execute on function public.community_leave(uuid) to authenticated;

revoke all on function public.community_submit_join_application(
  uuid, text, text, text, text, boolean, boolean, boolean
) from public, anon;
grant execute on function public.community_submit_join_application(
  uuid, text, text, text, text, boolean, boolean, boolean
) to authenticated;

revoke all on function public.community_review_join_application(uuid, text, text)
  from public, anon;
grant execute on function public.community_review_join_application(uuid, text, text)
  to authenticated;

notify pgrst, 'reload schema';
