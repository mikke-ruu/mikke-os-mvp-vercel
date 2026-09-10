-- Pending Community invitations can be managed only through narrow,
-- staff-authorized RPCs. No email or shared notification is sent here.

create function public.community_update_pending_invitation(
  p_invitation_id uuid,
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
  v_invitation public.community_invitations;
  v_entitlement_key text := nullif(pg_catalog.btrim(coalesce(p_entitlement_key, '')), '');
  v_now timestamptz := statement_timestamp();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'COMMUNITY_ANONYMOUS_DENIED';
  end if;

  select invitation.*
    into v_invitation
  from public.community_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  if v_invitation.id is null
     or not community_private.is_staff(v_invitation.community_id) then
    raise exception using errcode = '42501', message = 'Staff permission is required';
  end if;
  if v_invitation.status <> 'pending'
     or (v_invitation.expires_at is not null and v_invitation.expires_at <= v_now) then
    raise exception using errcode = '55000', message = 'Only a current pending invitation can be updated';
  end if;
  if p_expires_at is not null and p_expires_at <= v_now then
    raise exception using errcode = '22023', message = 'Invitation expiry must be in the future';
  end if;
  if v_entitlement_key is not null and not exists (
    select 1
    from public.community_entitlement_definitions definition
    where definition.community_id = v_invitation.community_id
      and definition.key = v_entitlement_key
      and definition.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'Active Community entitlement was not found';
  end if;

  update public.community_invitations invitation
  set entitlement_key = v_entitlement_key,
      expires_at = p_expires_at,
      updated_at = v_now
  where invitation.id = v_invitation.id
  returning invitation.* into v_invitation;

  return v_invitation;
end;
$$;

create function public.community_revoke_pending_invitation(
  p_invitation_id uuid
)
returns public.community_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_invitation public.community_invitations;
  v_now timestamptz := statement_timestamp();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'COMMUNITY_ANONYMOUS_DENIED';
  end if;

  select invitation.*
    into v_invitation
  from public.community_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  if v_invitation.id is null
     or not community_private.is_staff(v_invitation.community_id) then
    raise exception using errcode = '42501', message = 'Staff permission is required';
  end if;
  if v_invitation.status <> 'pending'
     or (v_invitation.expires_at is not null and v_invitation.expires_at <= v_now) then
    raise exception using errcode = '55000', message = 'Only a current pending invitation can be revoked';
  end if;

  update public.community_invitations invitation
  set status = 'revoked',
      updated_at = v_now
  where invitation.id = v_invitation.id
  returning invitation.* into v_invitation;

  return v_invitation;
end;
$$;

revoke all on function public.community_update_pending_invitation(uuid, text, timestamptz)
  from public, anon, service_role;
grant execute on function public.community_update_pending_invitation(uuid, text, timestamptz)
  to authenticated;

revoke all on function public.community_revoke_pending_invitation(uuid)
  from public, anon, service_role;
grant execute on function public.community_revoke_pending_invitation(uuid)
  to authenticated;

comment on function public.community_update_pending_invitation(uuid, text, timestamptz) is
  'Changes only the planned entitlement and expiry of a current pending invitation. Invitation identity and lifecycle state remain unchanged.';
comment on function public.community_revoke_pending_invitation(uuid) is
  'Revokes a current pending invitation. This does not send a notification or delete history.';

notify pgrst, 'reload schema';
