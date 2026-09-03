-- Enforce the server-owned Community platform capacity whenever one of the
-- four canonical membership flows would newly activate a membership.
-- Existing active members and every entitlement ledger remain unchanged.

create function community_private.community_assert_new_membership_capacity(
  p_community_id uuid,
  p_user_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid;
  v_capacity integer;
  v_active_count integer;
begin
  if p_community_id is null or p_user_id is null or p_now is null or not pg_catalog.isfinite(p_now) then
    raise exception using errcode = '22023', message = 'COMMUNITY_MEMBER_CAPACITY_INVALID_CONTEXT';
  end if;

  -- Shared first lock for every activation path. This serializes the count and
  -- keeps the order ahead of invitation, application, payment and definition locks.
  select community.owner_user_id
    into v_owner_user_id
  from public.community_communities community
  where community.id = p_community_id
    and community.status = 'active'
  for update;

  if v_owner_user_id is null then
    raise exception using errcode = '55000', message = 'COMMUNITY_MEMBER_CAPACITY_UNAVAILABLE';
  end if;

  -- A status refresh or entitlement change must never evict an existing member.
  if exists (
    select 1
    from public.community_memberships membership
    where membership.community_id = p_community_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
  ) then
    return;
  end if;

  v_capacity := platform_billing_private.community_capacity_for_resource(
    v_owner_user_id, p_community_id, p_now
  );
  if v_capacity is null then
    raise exception using errcode = '55000', message = 'COMMUNITY_MEMBER_CAPACITY_UNAVAILABLE';
  end if;

  select pg_catalog.count(*)::integer
    into v_active_count
  from public.community_memberships membership
  where membership.community_id = p_community_id
    and membership.status = 'active';

  if v_active_count >= v_capacity then
    raise exception using errcode = '54000', message = 'COMMUNITY_MEMBER_CAPACITY_REACHED';
  end if;
end;
$$;

revoke all on function community_private.community_assert_new_membership_capacity(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- Existing RLS lets a member leave and lets staff suspend members. It must not
-- also become a direct left/suspended -> active bypass around the serialized
-- RPC paths. The exact transaction-local marker is set only after a wrapper
-- has acquired the parent lock and passed the capacity check.
create function community_private.community_require_capacity_checked_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text := new.community_id::text || ':' || new.user_id::text;
begin
  if old.status <> 'active'
     and new.status = 'active'
     and (select auth.uid()) is not null
     and pg_catalog.current_setting('mikke.community_capacity_checked', true) is distinct from v_expected then
    raise exception using
      errcode = '42501',
      message = 'COMMUNITY_MEMBERSHIP_ACTIVATION_REQUIRES_GUARDED_FLOW';
  end if;
  return new;
end;
$$;

revoke all on function community_private.community_require_capacity_checked_activation()
  from public, anon, authenticated, service_role;

drop trigger if exists community_membership_capacity_activation_guard
  on public.community_memberships;
create trigger community_membership_capacity_activation_guard
before update of status on public.community_memberships
for each row execute function community_private.community_require_capacity_checked_activation();

-- Keep the previously reviewed implementations intact behind non-executable
-- internal names. Public wrappers acquire the Community parent lock first.
alter function public.community_submit_join_application(uuid,text,text,text,text,boolean,boolean,boolean)
  rename to community_submit_join_application_without_capacity_20260903;
alter function public.community_review_join_application(uuid,text,text)
  rename to community_review_join_application_without_capacity_20260903;
alter function public.community_accept_academy_access_invitation(uuid,text,text,text,text,boolean,boolean,boolean)
  rename to community_accept_academy_invitation_pre_capacity;
alter function public.community_review_payment_claim(uuid,boolean,text)
  rename to community_review_payment_claim_without_capacity_20260903;

revoke all on function public.community_submit_join_application_without_capacity_20260903(uuid,text,text,text,text,boolean,boolean,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.community_review_join_application_without_capacity_20260903(uuid,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.community_accept_academy_invitation_pre_capacity(uuid,text,text,text,text,boolean,boolean,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.community_review_payment_claim_without_capacity_20260903(uuid,boolean,text)
  from public, anon, authenticated, service_role;

create function public.community_submit_join_application(
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
  v_will_activate boolean;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'COMMUNITY_ANONYMOUS_DENIED';
  end if;

  -- Lock the Community before the retained implementation locks an invitation.
  perform 1
  from public.community_communities community
  where community.id = p_community_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'This Community is not accepting applications';
  end if;

  select (
    settings.approval_mode = 'auto'
    or exists (
      select 1
      from public.community_invitations invitation
      where invitation.community_id = p_community_id
        and invitation.invited_user_id = v_user_id
        and invitation.status = 'pending'
        and (invitation.expires_at is null or invitation.expires_at > v_now)
    )
  )
  into v_will_activate
  from public.community_safety_settings settings
  join public.community_communities community on community.id = settings.community_id
  where settings.community_id = p_community_id
    and community.status = 'active';

  if coalesce(v_will_activate, false) then
    perform community_private.community_assert_new_membership_capacity(p_community_id, v_user_id, v_now);
    perform pg_catalog.set_config(
      'mikke.community_capacity_checked', p_community_id::text || ':' || v_user_id::text, true
    );
  end if;

  return public.community_submit_join_application_without_capacity_20260903(
    p_community_id, p_display_name, p_legal_name, p_phone, p_join_reason,
    p_accept_terms, p_accept_rules, p_accept_privacy
  );
end;
$$;

create function public.community_review_join_application(
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
  v_community_id uuid;
  v_application_user_id uuid;
  v_status text;
  v_now timestamptz := pg_catalog.statement_timestamp();
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

  select application.community_id, application.user_id, application.status
    into v_community_id, v_application_user_id, v_status
  from public.community_join_applications application
  where application.id = p_application_id;
  if v_community_id is null or not community_private.is_staff(v_community_id) then
    raise exception using errcode = '42501', message = 'Staff permission is required';
  end if;
  if v_status <> 'pending' then
    raise exception using errcode = '55000', message = 'Only pending applications can be reviewed';
  end if;

  perform 1 from public.community_communities community where community.id = v_community_id for update;
  if p_decision = 'approved' then
    perform community_private.community_assert_new_membership_capacity(v_community_id, v_application_user_id, v_now);
    perform pg_catalog.set_config(
      'mikke.community_capacity_checked', v_community_id::text || ':' || v_application_user_id::text, true
    );
  end if;

  return public.community_review_join_application_without_capacity_20260903(
    p_application_id, p_decision, p_review_note
  );
end;
$$;

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
  v_user_id uuid := (select auth.uid());
  v_community_id uuid;
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

  select invitation.community_id
    into v_community_id
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.user_id = v_user_id
    and invitation.status = 'pending'
    and (invitation.expires_at is null or invitation.expires_at > v_now)
    and (invitation.ends_at is null or invitation.ends_at > v_now);
  if v_community_id is null then
    raise exception 'Pending Academy access invitation was not found';
  end if;

  perform community_private.community_assert_new_membership_capacity(v_community_id, v_user_id, v_now);
  perform pg_catalog.set_config(
    'mikke.community_capacity_checked', v_community_id::text || ':' || v_user_id::text, true
  );

  return public.community_accept_academy_invitation_pre_capacity(
    p_invitation_id, p_display_name, p_legal_name, p_phone, p_join_reason,
    p_accept_terms, p_accept_rules, p_accept_privacy
  );
end;
$$;

create function public.community_review_payment_claim(
  p_claim_id uuid,
  p_approved boolean,
  p_review_note text default null
)
returns public.community_payment_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_community_id uuid;
  v_claim_user_id uuid;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;

  select claim.community_id, claim.user_id
    into v_community_id, v_claim_user_id
  from public.community_payment_claims claim
  where claim.id = p_claim_id
    and claim.status = 'pending';
  if v_community_id is null then
    raise exception 'Pending Community payment claim was not found';
  end if;
  if not community_private.is_staff(v_community_id) then
    raise exception using errcode = '42501', message = 'Community staff authority is required';
  end if;

  if p_approved and exists (
    select 1 from public.community_memberships membership
    where membership.community_id = v_community_id
      and membership.user_id = v_claim_user_id
      and membership.status <> 'active'
  ) then
    perform community_private.community_assert_new_membership_capacity(v_community_id, v_claim_user_id, v_now);
    perform pg_catalog.set_config(
      'mikke.community_capacity_checked', v_community_id::text || ':' || v_claim_user_id::text, true
    );
  elsif p_approved then
    -- Retain a consistent parent-first order even when the claim only grants an
    -- entitlement and cannot activate a missing membership row.
    perform 1 from public.community_communities community where community.id = v_community_id for update;
  end if;

  return public.community_review_payment_claim_without_capacity_20260903(
    p_claim_id, p_approved, p_review_note
  );
end;
$$;

revoke all on function public.community_submit_join_application(uuid,text,text,text,text,boolean,boolean,boolean)
  from public, anon;
grant execute on function public.community_submit_join_application(uuid,text,text,text,text,boolean,boolean,boolean)
  to authenticated;
revoke all on function public.community_review_join_application(uuid,text,text)
  from public, anon;
grant execute on function public.community_review_join_application(uuid,text,text)
  to authenticated;
revoke all on function public.community_accept_academy_access_invitation(uuid,text,text,text,text,boolean,boolean,boolean)
  from public, anon;
grant execute on function public.community_accept_academy_access_invitation(uuid,text,text,text,text,boolean,boolean,boolean)
  to authenticated;
revoke all on function public.community_review_payment_claim(uuid,boolean,text)
  from public, anon;
grant execute on function public.community_review_payment_claim(uuid,boolean,text)
  to authenticated;

notify pgrst, 'reload schema';
