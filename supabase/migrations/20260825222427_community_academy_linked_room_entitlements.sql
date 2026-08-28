-- Academy and Community remain separate products. This migration only bridges
-- Academy-origin access to explicitly mapped Community Rooms after the user
-- accepts Community terms, rules, and privacy documents.

alter table public.community_member_entitlements
  drop constraint if exists community_member_entitlements_source_check;

alter table public.community_member_entitlements
  add constraint community_member_entitlements_source_check
  check (source in ('manual', 'subscription', 'external', 'academy_subscription'));

alter table public.community_memberships
  add column if not exists access_scope text not null default 'community';

alter table public.community_memberships
  drop constraint if exists community_memberships_access_scope_check;

alter table public.community_memberships
  add constraint community_memberships_access_scope_check
  check (access_scope in ('community', 'linked_rooms'));

create table public.community_academy_access_invitations (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null references public.community_access_source_mappings(id) on delete restrict,
  community_id uuid not null references public.community_communities(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  entitlement_key text not null,
  source_reference text not null check (char_length(trim(source_reference)) between 1 and 200),
  academy_role text not null check (academy_role in ('learner', 'instructor', 'staff', 'contract_holder')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_academy_access_invitations_definition_fk
    foreign key (community_id, entitlement_key)
    references public.community_entitlement_definitions(community_id, key)
    on update cascade on delete restrict,
  constraint community_academy_access_invitations_valid_period
    check (ends_at is null or ends_at > starts_at),
  unique (mapping_id, user_id, source_reference)
);

create table public.community_academy_entitlement_claims (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.community_academy_access_invitations(id) on delete restrict,
  mapping_id uuid not null references public.community_access_source_mappings(id) on delete restrict,
  community_id uuid not null references public.community_communities(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  entitlement_key text not null,
  source_reference text not null check (char_length(trim(source_reference)) between 1 and 200),
  academy_role text not null check (academy_role in ('learner', 'instructor', 'staff', 'contract_holder')),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_academy_entitlement_claims_definition_fk
    foreign key (community_id, entitlement_key)
    references public.community_entitlement_definitions(community_id, key)
    on update cascade on delete restrict,
  constraint community_academy_entitlement_claims_valid_period
    check (ends_at is null or ends_at > starts_at),
  unique (mapping_id, user_id, source_reference)
);

create index community_academy_access_invitations_user_status_idx
  on public.community_academy_access_invitations(user_id, status, expires_at);
create index community_academy_entitlement_claims_room_access_idx
  on public.community_academy_entitlement_claims(
    community_id, user_id, entitlement_key, status, starts_at, ends_at
  );

create trigger community_academy_access_invitations_touch_updated_at
before update on public.community_academy_access_invitations
for each row execute function public.community_touch_updated_at();

create trigger community_academy_entitlement_claims_touch_updated_at
before update on public.community_academy_entitlement_claims
for each row execute function public.community_touch_updated_at();

alter table public.community_academy_access_invitations enable row level security;
alter table public.community_academy_entitlement_claims enable row level security;

revoke all on table public.community_academy_access_invitations from public, anon, authenticated;
revoke all on table public.community_academy_entitlement_claims from public, anon, authenticated;
grant select, insert, update on table public.community_academy_access_invitations to service_role;
grant select, insert, update on table public.community_academy_entitlement_claims to service_role;

-- Academy source references and mapping ids are internal identifiers. Invitees
-- read the minimum acceptance contract through a narrow RPC; neither invitees
-- nor Community staff receive direct table SELECT.

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
    or new.source_reference is distinct from old.source_reference then
    raise exception using errcode = '23514',
      message = 'Academy invitation source identity is immutable';
  end if;
  return new;
end;
$$;

create or replace function community_private.guard_academy_claim_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.invitation_id is distinct from old.invitation_id
    or new.mapping_id is distinct from old.mapping_id
    or new.community_id is distinct from old.community_id
    or new.user_id is distinct from old.user_id
    or new.entitlement_key is distinct from old.entitlement_key
    or new.source_reference is distinct from old.source_reference then
    raise exception using errcode = '23514',
      message = 'Academy entitlement source identity is immutable';
  end if;
  return new;
end;
$$;

create or replace function community_private.guard_academy_mapping_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.provider_type = 'academy_subscription'
    and (
      new.community_id is distinct from old.community_id
      or new.provider_type is distinct from old.provider_type
      or new.provider_owner_key is distinct from old.provider_owner_key
      or new.source_product_key is distinct from old.source_product_key
      or new.entitlement_key is distinct from old.entitlement_key
      or (old.status = 'active' and new.status <> 'active')
    )
    and exists (
      select 1
      from public.community_academy_entitlement_claims claim
      where claim.mapping_id = old.id
        and claim.status = 'active'
        and (claim.ends_at is null or claim.ends_at > pg_catalog.now())
    ) then
    raise exception using errcode = '23514',
      message = 'Revoke active Academy claims before changing or archiving this mapping';
  end if;
  return new;
end;
$$;

revoke all on function community_private.guard_academy_invitation_identity() from public, anon, authenticated;
revoke all on function community_private.guard_academy_claim_identity() from public, anon, authenticated;
revoke all on function community_private.guard_academy_mapping_version() from public, anon, authenticated;

create trigger community_academy_access_invitations_identity_guard
before update on public.community_academy_access_invitations
for each row execute function community_private.guard_academy_invitation_identity();

create trigger community_academy_entitlement_claims_identity_guard
before update on public.community_academy_entitlement_claims
for each row execute function community_private.guard_academy_claim_identity();

create trigger community_academy_mapping_version_guard
before update on public.community_access_source_mappings
for each row execute function community_private.guard_academy_mapping_version();

-- Community staff can manage Community-owned sources only. Academy rows are
-- projected by service-only functions and cannot be edited from operator UI.
drop policy if exists "community staff can insert entitlements" on public.community_member_entitlements;
create policy "community staff can insert entitlements"
on public.community_member_entitlements for insert
to authenticated
with check (
  community_private.is_staff(community_id)
  and source in ('manual', 'subscription', 'external')
);

drop policy if exists "community staff can update entitlements" on public.community_member_entitlements;
create policy "community staff can update entitlements"
on public.community_member_entitlements for update
to authenticated
using (
  community_private.is_staff(community_id)
  and source in ('manual', 'subscription', 'external')
)
with check (
  community_private.is_staff(community_id)
  and source in ('manual', 'subscription', 'external')
);

drop policy if exists "community staff can delete entitlements" on public.community_member_entitlements;
create policy "community staff can delete entitlements"
on public.community_member_entitlements for delete
to authenticated
using (
  community_private.is_staff(community_id)
  and source in ('manual', 'subscription', 'external')
);

create or replace function community_private.refresh_academy_subscription_entitlement(
  p_community_id uuid,
  p_user_id uuid,
  p_entitlement_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective_count integer;
  v_effective_starts_at timestamptz;
  v_effective_ends_at timestamptz;
begin
  select
    pg_catalog.count(*),
    pg_catalog.min(claim.starts_at),
    case when pg_catalog.bool_or(claim.ends_at is null) then null else pg_catalog.max(claim.ends_at) end
  into v_effective_count, v_effective_starts_at, v_effective_ends_at
  from public.community_academy_entitlement_claims claim
  join public.community_access_source_mappings mapping
    on mapping.id = claim.mapping_id
   and mapping.community_id = claim.community_id
   and mapping.entitlement_key = claim.entitlement_key
   and mapping.provider_type = 'academy_subscription'
   and mapping.status = 'active'
  where claim.community_id = p_community_id
    and claim.user_id = p_user_id
    and claim.entitlement_key = p_entitlement_key
    and claim.status = 'active'
    and claim.starts_at <= pg_catalog.now()
    and (claim.ends_at is null or claim.ends_at > pg_catalog.now());

  if v_effective_count > 0 then
    insert into public.community_member_entitlements (
      community_id, user_id, entitlement_key, source, source_reference,
      status, starts_at, ends_at
    ) values (
      p_community_id, p_user_id, p_entitlement_key,
      'academy_subscription', 'academy_subscription:active_claims',
      'active', v_effective_starts_at, v_effective_ends_at
    )
    on conflict (community_id, user_id, entitlement_key, source)
    do update set
      source_reference = excluded.source_reference,
      status = 'active',
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      updated_at = pg_catalog.now();
  else
    update public.community_member_entitlements
    set status = 'revoked',
        ends_at = coalesce(ends_at, greatest(pg_catalog.now(), starts_at + interval '1 microsecond')),
        updated_at = pg_catalog.now()
    where community_id = p_community_id
      and user_id = p_user_id
      and entitlement_key = p_entitlement_key
      and source = 'academy_subscription';
  end if;

  -- Academy cancellation must not end a normal Community membership or another
  -- paid/manual entitlement. Only an Academy-only linked membership can close.
  if not exists (
    select 1 from public.community_academy_entitlement_claims claim
    where claim.community_id = p_community_id
      and claim.user_id = p_user_id
      and claim.status = 'active'
  ) and not exists (
    select 1 from public.community_member_entitlements entitlement
    where entitlement.community_id = p_community_id
      and entitlement.user_id = p_user_id
      and entitlement.source <> 'academy_subscription'
      and entitlement.status = 'active'
      and entitlement.starts_at <= pg_catalog.now()
      and (entitlement.ends_at is null or entitlement.ends_at > pg_catalog.now())
  ) then
    update public.community_memberships
    set status = 'left', updated_at = pg_catalog.now()
    where community_id = p_community_id
      and user_id = p_user_id
      and status = 'active'
      and access_scope = 'linked_rooms';
  end if;
end;
$$;

revoke all on function community_private.refresh_academy_subscription_entitlement(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function community_private.refresh_academy_subscription_entitlement(uuid, uuid, text)
  to service_role;

create or replace function public.community_create_academy_access_invitation(
  p_mapping_id uuid,
  p_user_id uuid,
  p_source_reference text,
  p_academy_role text,
  p_starts_at timestamptz default now(),
  p_ends_at timestamptz default null,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mapping public.community_access_source_mappings;
  v_invitation_id uuid;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Academy access invitation requires the service role';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_source_reference, ''))) not between 1 and 200 then
    raise exception 'Academy source reference is required';
  end if;
  if p_academy_role not in ('learner', 'instructor', 'staff', 'contract_holder') then
    raise exception 'Unsupported Academy role';
  end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'Academy access end must be after its start';
  end if;

  select mapping.* into v_mapping
  from public.community_access_source_mappings mapping
  where mapping.id = p_mapping_id
    and mapping.provider_type = 'academy_subscription'
    and mapping.status = 'active';
  if v_mapping.id is null then
    raise exception 'Active Academy-to-Community mapping was not found';
  end if;

  insert into public.community_academy_access_invitations (
    mapping_id, community_id, user_id, entitlement_key, source_reference,
    academy_role, status, starts_at, ends_at, expires_at
  ) values (
    v_mapping.id, v_mapping.community_id, p_user_id, v_mapping.entitlement_key,
    pg_catalog.btrim(p_source_reference), p_academy_role, 'pending', p_starts_at, p_ends_at, p_expires_at
  )
  on conflict (mapping_id, user_id, source_reference)
  do update set
    academy_role = excluded.academy_role,
    status = 'pending',
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    expires_at = excluded.expires_at,
    accepted_at = null,
    updated_at = pg_catalog.now()
  returning id into v_invitation_id;
  return v_invitation_id;
end;
$$;

revoke all on function public.community_create_academy_access_invitation(
  uuid, uuid, text, text, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.community_create_academy_access_invitation(
  uuid, uuid, text, text, timestamptz, timestamptz, timestamptz
) to service_role;

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
  v_email text;
  v_membership_status text;
  v_invitation public.community_academy_access_invitations;
  v_settings public.community_safety_settings;
  v_application public.community_join_applications;
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;
  if not (p_accept_terms and p_accept_rules and p_accept_privacy) then
    raise exception 'All required Community documents must be accepted';
  end if;

  select invitation.* into v_invitation
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.user_id = v_user_id
    and invitation.status = 'pending'
    and (invitation.expires_at is null or invitation.expires_at > pg_catalog.now())
    and (invitation.ends_at is null or invitation.ends_at > pg_catalog.now());
  if v_invitation.id is null then raise exception 'Pending Academy access invitation was not found'; end if;

  -- LOCK ORDER 1: shared entitlement definition.
  perform 1
  from public.community_entitlement_definitions definition
  where definition.community_id = v_invitation.community_id
    and definition.key = v_invitation.entitlement_key
  for update;

  -- LOCK ORDER 2: re-read and lock the invitation after waiting for the shared
  -- entitlement lock. Every competing mutation uses the same order.
  select invitation.* into v_invitation
  from public.community_academy_access_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.user_id = v_user_id
    and invitation.status = 'pending'
    and (invitation.expires_at is null or invitation.expires_at > pg_catalog.now())
    and (invitation.ends_at is null or invitation.ends_at > pg_catalog.now())
  for update;
  if v_invitation.id is null then raise exception 'Pending Academy access invitation was not found'; end if;

  if exists (
    select 1
    from public.community_payment_claims payment_claim
    join public.community_membership_plans plan on plan.id = payment_claim.plan_id
    where payment_claim.community_id = v_invitation.community_id
      and payment_claim.user_id = v_user_id
      and payment_claim.status = 'pending'
      and plan.entitlement_key = v_invitation.entitlement_key
  ) then
    raise exception 'Resolve the pending Community payment claim before accepting Academy access';
  end if;
  if not exists (
    select 1
    from public.community_access_source_mappings mapping
    where mapping.id = v_invitation.mapping_id
      and mapping.community_id = v_invitation.community_id
      and mapping.entitlement_key = v_invitation.entitlement_key
      and mapping.provider_type = 'academy_subscription'
      and mapping.status = 'active'
  ) then
    raise exception 'Active Academy-to-Community mapping was not found';
  end if;

  select membership.status into v_membership_status
  from public.community_memberships membership
  where membership.community_id = v_invitation.community_id
    and membership.user_id = v_user_id
  for update;
  if v_membership_status = 'suspended' then
    raise exception 'Community membership is suspended';
  end if;

  select settings.* into v_settings
  from public.community_safety_settings settings
  join public.community_communities community on community.id = settings.community_id
  where settings.community_id = v_invitation.community_id
    and community.status = 'active';
  if v_settings.community_id is null then raise exception 'Community settings were not found'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_display_name, ''))) < 1 then raise exception 'Display name is required'; end if;
  if v_settings.require_legal_name and pg_catalog.char_length(pg_catalog.btrim(coalesce(p_legal_name, ''))) < 1 then raise exception 'Legal name is required'; end if;
  if v_settings.require_phone and pg_catalog.char_length(pg_catalog.regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')) < 8 then raise exception 'A valid phone number is required'; end if;
  if v_settings.require_join_reason and pg_catalog.char_length(pg_catalog.btrim(coalesce(p_join_reason, ''))) < 1 then raise exception 'Join reason is required'; end if;

  select email into v_email from auth.users where id = v_user_id;
  insert into public.community_join_applications (
    community_id, user_id, display_name, legal_name, email, phone, join_reason,
    status, reviewed_by_user_id, review_note, submitted_at, reviewed_at
  ) values (
    v_invitation.community_id, v_user_id, pg_catalog.btrim(p_display_name), nullif(pg_catalog.btrim(p_legal_name), ''),
    v_email, nullif(pg_catalog.btrim(p_phone), ''), nullif(pg_catalog.btrim(p_join_reason), ''),
    'approved', null, 'Approved by accepted Academy access invitation', pg_catalog.now(), pg_catalog.now()
  )
  on conflict (community_id, user_id)
  do update set
    display_name = excluded.display_name,
    legal_name = excluded.legal_name,
    email = excluded.email,
    phone = excluded.phone,
    join_reason = excluded.join_reason,
    status = 'approved',
    review_note = excluded.review_note,
    submitted_at = pg_catalog.now(),
    reviewed_at = pg_catalog.now()
  returning * into v_application;

  insert into public.community_consent_records (
    community_id, application_id, user_id, document_type, document_version
  ) values
    (v_invitation.community_id, v_application.id, v_user_id, 'terms', v_settings.terms_version),
    (v_invitation.community_id, v_application.id, v_user_id, 'rules', v_settings.rules_version),
    (v_invitation.community_id, v_application.id, v_user_id, 'privacy', v_settings.privacy_version)
  on conflict do nothing;

  insert into public.community_memberships (community_id, user_id, role, status, access_scope)
  values (v_invitation.community_id, v_user_id, 'member', 'active', 'linked_rooms')
  on conflict (community_id, user_id)
  do update set
    status = 'active',
    access_scope = case
      when public.community_memberships.status = 'active'
       and public.community_memberships.access_scope = 'community' then 'community'
      else 'linked_rooms'
    end,
    updated_at = pg_catalog.now();

  insert into public.community_member_profiles (community_id, user_id, display_name)
  values (v_invitation.community_id, v_user_id, pg_catalog.btrim(p_display_name))
  on conflict (community_id, user_id)
  do update set display_name = excluded.display_name, updated_at = pg_catalog.now();

  insert into public.community_academy_entitlement_claims (
    invitation_id, mapping_id, community_id, user_id, entitlement_key,
    source_reference, academy_role, status, starts_at, ends_at
  ) values (
    v_invitation.id, v_invitation.mapping_id, v_invitation.community_id, v_user_id,
    v_invitation.entitlement_key, v_invitation.source_reference, v_invitation.academy_role,
    'active', v_invitation.starts_at, v_invitation.ends_at
  )
  on conflict (mapping_id, user_id, source_reference)
  do update set
    academy_role = excluded.academy_role,
    status = 'active',
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    updated_at = pg_catalog.now();

  update public.community_academy_access_invitations
  set status = 'accepted', accepted_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = v_invitation.id;

  perform community_private.refresh_academy_subscription_entitlement(
    v_invitation.community_id, v_user_id, v_invitation.entitlement_key
  );
  return v_application.id;
end;
$$;

revoke all on function public.community_accept_academy_access_invitation(
  uuid, text, text, text, text, boolean, boolean, boolean
) from public, anon;
grant execute on function public.community_accept_academy_access_invitation(
  uuid, text, text, text, text, boolean, boolean, boolean
) to authenticated;

create or replace function public.community_sync_academy_entitlement(
  p_mapping_id uuid,
  p_user_id uuid,
  p_source_reference text,
  p_status text,
  p_starts_at timestamptz default now(),
  p_ends_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.community_academy_entitlement_claims;
  v_claim_id uuid;
  v_claim_community_id uuid;
  v_claim_entitlement_key text;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Academy entitlement sync requires the service role';
  end if;
  if p_status not in ('active', 'revoked', 'expired') then raise exception 'Unsupported Academy entitlement status'; end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'Academy access end must be after its start'; end if;

  -- Resolve the immutable entitlement identity without taking a row lock.
  select claim.* into v_claim
  from public.community_academy_entitlement_claims claim
  where claim.mapping_id = p_mapping_id
    and claim.user_id = p_user_id
    and claim.source_reference = pg_catalog.btrim(p_source_reference);
  if v_claim.id is null then
    raise exception 'Accepted Academy entitlement claim was not found';
  end if;
  v_claim_id := v_claim.id;
  v_claim_community_id := v_claim.community_id;
  v_claim_entitlement_key := v_claim.entitlement_key;

  -- LOCK ORDER 1: shared entitlement definition.
  perform 1
  from public.community_entitlement_definitions definition
  where definition.community_id = v_claim_community_id
    and definition.key = v_claim_entitlement_key
  for update;

  -- LOCK ORDER 2: lock and revalidate the claim after waiting.
  select claim.* into v_claim
  from public.community_academy_entitlement_claims claim
  where claim.id = v_claim_id
    and claim.mapping_id = p_mapping_id
    and claim.user_id = p_user_id
    and claim.source_reference = pg_catalog.btrim(p_source_reference)
  for update;
  if v_claim.id is null then
    raise exception 'Accepted Academy entitlement claim was not found';
  end if;
  if p_status = 'active' and not exists (
    select 1
    from public.community_access_source_mappings mapping
    where mapping.id = v_claim.mapping_id
      and mapping.community_id = v_claim.community_id
      and mapping.entitlement_key = v_claim.entitlement_key
      and mapping.provider_type = 'academy_subscription'
      and mapping.status = 'active'
  ) then
    raise exception 'Active Academy-to-Community mapping was not found';
  end if;

  update public.community_academy_entitlement_claims
  set status = p_status,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      updated_at = pg_catalog.now()
  where id = v_claim.id;

  if p_status in ('revoked', 'expired') then
    update public.community_academy_access_invitations
    set status = p_status, updated_at = pg_catalog.now()
    where id = v_claim.invitation_id;
  end if;

  perform community_private.refresh_academy_subscription_entitlement(
    v_claim.community_id, v_claim.user_id, v_claim.entitlement_key
  );
end;
$$;

revoke all on function public.community_sync_academy_entitlement(
  uuid, uuid, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.community_sync_academy_entitlement(
  uuid, uuid, text, text, timestamptz, timestamptz
) to service_role;

-- URL or membership state never grants Room access by itself. linked_rooms
-- members can only enter an entitlement Room backed by an effective claim.
create or replace function community_private.can_access_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.community_rooms room
      join public.community_memberships membership
        on membership.community_id = room.community_id
       and membership.user_id = (select auth.uid())
       and membership.status = 'active'
      where room.id = p_room_id
        and room.is_archived = false
        and (
          exists (
            select 1 from public.community_communities community
            where community.id = room.community_id
              and community.owner_user_id = (select auth.uid())
          )
          or membership.role in ('owner', 'moderator')
          or (membership.access_scope = 'community' and room.access_type = 'free')
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
                where rule.room_id = room.id
                  and claim.user_id = (select auth.uid())
                  and claim.status = 'active'
                  and claim.starts_at <= pg_catalog.now()
                  and (claim.ends_at is null or claim.ends_at > pg_catalog.now())
              )
            )
          )
        )
    );
$$;

revoke all on function community_private.can_access_room(uuid) from public;
grant execute on function community_private.can_access_room(uuid) to authenticated;

-- Events and shared Resources are Community-wide surfaces, not Rooms. Academy
-- linked members do not receive them unless they separately hold normal
-- Community membership scope.
drop policy if exists "community members can read events" on public.community_events;
create policy "community members can read events"
on public.community_events for select
to authenticated
using (
  status <> 'cancelled'
  and exists (
    select 1 from public.community_memberships membership
    where membership.community_id = community_events.community_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.access_scope = 'community'
  )
);

drop policy if exists "community members can read resources" on public.community_resources;
create policy "community members can read resources"
on public.community_resources for select
to authenticated
using (
  is_published = true
  and exists (
    select 1 from public.community_memberships membership
    where membership.community_id = community_resources.community_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.access_scope = 'community'
  )
);

drop policy if exists "community users can read their event attendance" on public.community_event_attendees;
create policy "community users can read their event attendance"
on public.community_event_attendees for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_events event
    join public.community_memberships membership on membership.community_id = event.community_id
    where event.id = community_event_attendees.event_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.access_scope = 'community'
  )
);

drop policy if exists "community users can set event attendance" on public.community_event_attendees;
create policy "community users can set event attendance"
on public.community_event_attendees for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_events event
    join public.community_memberships membership on membership.community_id = event.community_id
    where event.id = community_event_attendees.event_id
      and event.status = 'open'
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.access_scope = 'community'
  )
);

drop policy if exists "community users can update event attendance" on public.community_event_attendees;
create policy "community users can update event attendance"
on public.community_event_attendees for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_events event
    join public.community_memberships membership on membership.community_id = event.community_id
    where event.id = community_event_attendees.event_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.access_scope = 'community'
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_events event
    join public.community_memberships membership on membership.community_id = event.community_id
    where event.id = community_event_attendees.event_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.access_scope = 'community'
  )
);

-- Direct inserts bypass equivalent-entitlement checks, so payment claims now
-- enter through one authenticated RPC.
drop policy if exists "members can create payment claims" on public.community_payment_claims;
drop policy if exists "staff can review payment claims" on public.community_payment_claims;
revoke insert on table public.community_payment_claims from authenticated;

create or replace function public.community_create_payment_claim(
  p_community_id uuid,
  p_plan_id uuid,
  p_payer_name text,
  p_external_reference text default null,
  p_note text default null
)
returns public.community_payment_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan public.community_membership_plans;
  v_claim public.community_payment_claims;
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;
  if not community_private.is_active_member(p_community_id) then raise exception 'Active Community participation is required'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_payer_name, ''))) not between 1 and 120 then raise exception 'Payer name is required'; end if;

  select plan.* into v_plan
  from public.community_membership_plans plan
  where plan.id = p_plan_id
    and plan.community_id = p_community_id
    and plan.status = 'active';
  if v_plan.id is null then raise exception 'Active Community plan was not found'; end if;

  -- LOCK ORDER 1: shared entitlement definition; the pending claim is inserted
  -- only after this lock so review and duplicate-create cannot invert order.
  perform 1
  from public.community_entitlement_definitions definition
  where definition.community_id = p_community_id
    and definition.key = v_plan.entitlement_key
  for update;

  if exists (
    select 1
    from public.community_academy_entitlement_claims academy_claim
    where academy_claim.community_id = p_community_id
      and academy_claim.user_id = v_user_id
      and academy_claim.entitlement_key = v_plan.entitlement_key
      and academy_claim.status = 'active'
      and academy_claim.starts_at <= pg_catalog.now()
      and (academy_claim.ends_at is null or academy_claim.ends_at > pg_catalog.now())
  ) then
    raise exception 'This access is already included with an active Academy benefit';
  end if;

  insert into public.community_payment_claims (
    community_id, plan_id, user_id, payer_name, external_reference, note, status
  ) values (
    p_community_id, p_plan_id, v_user_id, pg_catalog.btrim(p_payer_name),
    nullif(pg_catalog.btrim(coalesce(p_external_reference, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_note, '')), ''), 'pending'
  ) returning * into v_claim;
  return v_claim;
end;
$$;

revoke all on function public.community_create_payment_claim(uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.community_create_payment_claim(uuid, uuid, text, text, text)
  to authenticated;

create or replace function public.community_review_payment_claim(
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
  v_reviewer_user_id uuid := (select auth.uid());
  v_claim public.community_payment_claims;
  v_entitlement_key text;
  v_claim_community_id uuid;
  v_claim_plan_id uuid;
  v_claim_user_id uuid;
begin
  if v_reviewer_user_id is null then raise exception 'Authentication is required'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;

  -- Resolve the immutable payment identity without taking a row lock.
  select payment_claim.* into v_claim
  from public.community_payment_claims payment_claim
  where payment_claim.id = p_claim_id
    and payment_claim.status = 'pending';
  if v_claim.id is null then raise exception 'Pending Community payment claim was not found'; end if;
  v_claim_community_id := v_claim.community_id;
  v_claim_plan_id := v_claim.plan_id;
  v_claim_user_id := v_claim.user_id;
  if not community_private.is_staff(v_claim.community_id) then
    raise exception using errcode = '42501', message = 'Community staff authority is required';
  end if;

  select plan.entitlement_key into v_entitlement_key
  from public.community_membership_plans plan
  where plan.id = v_claim.plan_id
    and plan.community_id = v_claim.community_id;
  if v_entitlement_key is null then raise exception 'Community plan was not found'; end if;

  -- LOCK ORDER 1: shared entitlement definition.
  perform 1
  from public.community_entitlement_definitions definition
  where definition.community_id = v_claim.community_id
    and definition.key = v_entitlement_key
  for update;

  -- LOCK ORDER 2: lock and revalidate the pending payment claim after waiting.
  select payment_claim.* into v_claim
  from public.community_payment_claims payment_claim
  where payment_claim.id = p_claim_id
    and payment_claim.status = 'pending'
    and payment_claim.community_id = v_claim_community_id
    and payment_claim.plan_id = v_claim_plan_id
    and payment_claim.user_id = v_claim_user_id
  for update;
  if v_claim.id is null then raise exception 'Pending Community payment claim was not found'; end if;
  if not community_private.is_staff(v_claim.community_id) then
    raise exception using errcode = '42501', message = 'Community staff authority is required';
  end if;

  if p_approved and exists (
    select 1
    from public.community_academy_entitlement_claims academy_claim
    join public.community_access_source_mappings mapping
      on mapping.id = academy_claim.mapping_id
     and mapping.community_id = academy_claim.community_id
     and mapping.entitlement_key = academy_claim.entitlement_key
     and mapping.provider_type = 'academy_subscription'
     and mapping.status = 'active'
    where academy_claim.community_id = v_claim.community_id
      and academy_claim.user_id = v_claim.user_id
      and academy_claim.entitlement_key = v_entitlement_key
      and academy_claim.status = 'active'
      and academy_claim.starts_at <= pg_catalog.now()
      and (academy_claim.ends_at is null or academy_claim.ends_at > pg_catalog.now())
  ) then
    raise exception 'This access is already included with an active Academy benefit';
  end if;

  update public.community_payment_claims
  set status = case when p_approved then 'approved' else 'rejected' end,
      reviewed_by_user_id = v_reviewer_user_id,
      reviewed_at = pg_catalog.now(),
      review_note = nullif(pg_catalog.btrim(coalesce(p_review_note, '')), '')
  where id = v_claim.id
  returning * into v_claim;

  if p_approved then
    insert into public.community_member_entitlements (
      community_id, user_id, entitlement_key, source, source_reference,
      status, starts_at, ends_at, granted_by_user_id
    ) values (
      v_claim.community_id, v_claim.user_id, v_entitlement_key,
      'subscription', 'payment-claim:' || v_claim.id::text,
      'active', pg_catalog.now(), null, v_reviewer_user_id
    )
    on conflict (community_id, user_id, entitlement_key, source)
    do update set
      source_reference = excluded.source_reference,
      status = 'active',
      starts_at = excluded.starts_at,
      ends_at = null,
      granted_by_user_id = excluded.granted_by_user_id,
      updated_at = pg_catalog.now();
  end if;

  return v_claim;
end;
$$;

revoke all on function public.community_review_payment_claim(uuid, boolean, text)
  from public, anon;
grant execute on function public.community_review_payment_claim(uuid, boolean, text)
  to authenticated;

create or replace function community_private.community_paid_claim_upgrades_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.community_memberships
    set access_scope = 'community', status = 'active', updated_at = pg_catalog.now()
    where community_id = new.community_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function community_private.community_paid_claim_upgrades_scope() from public, anon, authenticated;

create trigger community_payment_claim_approved_upgrades_scope
after update of status on public.community_payment_claims
for each row execute function community_private.community_paid_claim_upgrades_scope();

comment on column public.community_memberships.access_scope is
  'community shows normal Community scope; linked_rooms restricts Academy-linked users to entitled Rooms.';
comment on table public.community_academy_entitlement_claims is
  'Immutable-source Academy benefit ledger. Revoke one source_reference without changing Community-owned rights.';
