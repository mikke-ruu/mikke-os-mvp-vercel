-- Community commercial foundation: invitations, external membership plans,
-- operator records, member data requests, and storage authorization hardening.

create table public.community_invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  invited_mikke_id text not null,
  entitlement_key text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, invited_user_id),
  foreign key (community_id, entitlement_key)
    references public.community_entitlement_definitions(community_id, key)
    on update cascade on delete restrict
);

create table public.community_membership_plans (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  entitlement_key text not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text,
  amount_yen integer not null check (amount_yen >= 0),
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year', 'one_time')),
  payment_provider_label text not null default '外部決済',
  external_payment_url text not null check (external_payment_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  sort_order integer not null default 0,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, name),
  foreign key (community_id, entitlement_key)
    references public.community_entitlement_definitions(community_id, key)
    on update cascade on delete restrict
);

create table public.community_payment_claims (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  plan_id uuid not null references public.community_membership_plans(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  payer_name text not null check (char_length(trim(payer_name)) between 1 and 120),
  external_reference text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_access_source_mappings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  provider_type text not null check (provider_type in ('academy_subscription', 'external_membership', 'api')),
  provider_owner_key text not null,
  source_product_key text not null,
  entitlement_key text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, provider_type, provider_owner_key, source_product_key),
  foreign key (community_id, entitlement_key)
    references public.community_entitlement_definitions(community_id, key)
    on update cascade on delete restrict
);

create table public.community_member_data_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('data_export', 'personal_data_delete')),
  status text not null default 'received' check (status in ('received', 'identity_check', 'processing', 'completed', 'rejected', 'cancelled')),
  member_note text,
  response_note text,
  handled_by_user_id uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index community_member_data_requests_open_unique
  on public.community_member_data_requests (community_id, user_id, request_type)
  where status in ('received', 'identity_check', 'processing');

create table public.community_operator_profiles (
  community_id uuid primary key references public.community_communities(id) on delete cascade,
  business_name text not null default '',
  representative_name text not null default '',
  business_type text not null default 'individual' check (business_type in ('individual', 'sole_proprietor', 'corporation', 'organization')),
  postal_address text not null default '',
  contact_email text not null default '',
  contact_phone text,
  website_url text,
  commercial_disclosure_url text,
  privacy_policy_url text,
  terms_url text,
  status text not null default 'incomplete' check (status in ('incomplete', 'submitted', 'verified')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_operator_agreements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  operator_user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('platform_terms', 'privacy_data_processing', 'paid_service_terms')),
  document_version integer not null check (document_version > 0),
  accepted_at timestamptz not null default now(),
  unique (community_id, operator_user_id, document_type, document_version)
);

create table public.community_platform_subscriptions (
  community_id uuid primary key references public.community_communities(id) on delete cascade,
  plan_key text not null default 'trial',
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled', 'suspended')),
  current_period_ends_at timestamptz,
  external_customer_reference text,
  external_subscription_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_invitations_invitee_status_idx on public.community_invitations (invited_user_id, status, created_at desc);
create index community_membership_plans_community_status_idx on public.community_membership_plans (community_id, status, sort_order);
create index community_payment_claims_community_status_idx on public.community_payment_claims (community_id, status, created_at desc);
create unique index community_payment_claims_pending_unique on public.community_payment_claims (plan_id, user_id) where status = 'pending';
create index community_member_data_requests_community_status_idx on public.community_member_data_requests (community_id, status, created_at desc);

create trigger community_invitations_touch_updated_at before update on public.community_invitations for each row execute function public.community_touch_updated_at();
create trigger community_membership_plans_touch_updated_at before update on public.community_membership_plans for each row execute function public.community_touch_updated_at();
create trigger community_payment_claims_touch_updated_at before update on public.community_payment_claims for each row execute function public.community_touch_updated_at();
create trigger community_access_source_mappings_touch_updated_at before update on public.community_access_source_mappings for each row execute function public.community_touch_updated_at();
create trigger community_member_data_requests_touch_updated_at before update on public.community_member_data_requests for each row execute function public.community_touch_updated_at();
create trigger community_operator_profiles_touch_updated_at before update on public.community_operator_profiles for each row execute function public.community_touch_updated_at();
create trigger community_platform_subscriptions_touch_updated_at before update on public.community_platform_subscriptions for each row execute function public.community_touch_updated_at();

alter table public.community_invitations enable row level security;
alter table public.community_membership_plans enable row level security;
alter table public.community_payment_claims enable row level security;
alter table public.community_access_source_mappings enable row level security;
alter table public.community_member_data_requests enable row level security;
alter table public.community_operator_profiles enable row level security;
alter table public.community_operator_agreements enable row level security;
alter table public.community_platform_subscriptions enable row level security;

revoke all on public.community_invitations, public.community_membership_plans, public.community_payment_claims,
  public.community_access_source_mappings, public.community_member_data_requests, public.community_operator_profiles,
  public.community_operator_agreements, public.community_platform_subscriptions from anon, authenticated;
grant select on public.community_invitations to authenticated;
grant select, insert, update on public.community_membership_plans to authenticated;
grant select, insert, update on public.community_payment_claims to authenticated;
grant select, insert, update on public.community_access_source_mappings to authenticated;
grant select, insert, update on public.community_member_data_requests to authenticated;
grant select, insert, update on public.community_operator_profiles to authenticated;
grant select, insert on public.community_operator_agreements to authenticated;
grant select on public.community_platform_subscriptions to authenticated;

create policy "invitees and staff can read invitations" on public.community_invitations for select to authenticated
using (invited_user_id = (select auth.uid()) or community_private.is_staff(community_id));

create policy "members can read active plans" on public.community_membership_plans for select to authenticated
using (status = 'active' or community_private.is_staff(community_id));
create policy "staff can insert plans" on public.community_membership_plans for insert to authenticated
with check (community_private.is_staff(community_id) and created_by_user_id = (select auth.uid()));
create policy "staff can update plans" on public.community_membership_plans for update to authenticated
using (community_private.is_staff(community_id)) with check (community_private.is_staff(community_id));

create policy "claimants and staff can read payment claims" on public.community_payment_claims for select to authenticated
using (user_id = (select auth.uid()) or community_private.is_staff(community_id));
create policy "members can create payment claims" on public.community_payment_claims for insert to authenticated
with check (user_id = (select auth.uid()) and community_private.is_active_member(community_id));
create policy "claimants can cancel payment claims" on public.community_payment_claims for update to authenticated
using (user_id = (select auth.uid()) and status = 'pending')
with check (user_id = (select auth.uid()) and status = 'cancelled');
create policy "staff can review payment claims" on public.community_payment_claims for update to authenticated
using (community_private.is_staff(community_id)) with check (community_private.is_staff(community_id));

create policy "staff can read access mappings" on public.community_access_source_mappings for select to authenticated
using (community_private.is_staff(community_id));
create policy "staff can insert access mappings" on public.community_access_source_mappings for insert to authenticated
with check (community_private.is_staff(community_id) and created_by_user_id = (select auth.uid()));
create policy "staff can update access mappings" on public.community_access_source_mappings for update to authenticated
using (community_private.is_staff(community_id)) with check (community_private.is_staff(community_id));

create policy "members and staff can read data requests" on public.community_member_data_requests for select to authenticated
using (user_id = (select auth.uid()) or community_private.is_staff(community_id));
create policy "members can create data requests" on public.community_member_data_requests for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "members can cancel own data requests" on public.community_member_data_requests for update to authenticated
using (user_id = (select auth.uid()) and status = 'received')
with check (user_id = (select auth.uid()) and status = 'cancelled');
create policy "staff can process data requests" on public.community_member_data_requests for update to authenticated
using (community_private.is_staff(community_id)) with check (community_private.is_staff(community_id));

create policy "staff can read operator profiles" on public.community_operator_profiles for select to authenticated
using (community_private.is_staff(community_id));
create policy "staff can insert operator profiles" on public.community_operator_profiles for insert to authenticated
with check (community_private.is_staff(community_id));
create policy "staff can update operator profiles" on public.community_operator_profiles for update to authenticated
using (community_private.is_staff(community_id)) with check (community_private.is_staff(community_id));
create policy "staff can read operator agreements" on public.community_operator_agreements for select to authenticated
using (community_private.is_staff(community_id));
create policy "operators can accept agreements" on public.community_operator_agreements for insert to authenticated
with check (operator_user_id = (select auth.uid()) and community_private.is_staff(community_id));
create policy "staff can read platform subscriptions" on public.community_platform_subscriptions for select to authenticated
using (community_private.is_staff(community_id));

create or replace function public.community_invite_by_mikke_id(
  p_community_id uuid,
  p_mikke_id text,
  p_entitlement_key text default null,
  p_expires_at timestamptz default null
)
returns public.community_invitations
language plpgsql
security definer
set search_path = pg_catalog, public, community_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_invited_user uuid;
  v_invitation public.community_invitations;
  v_handle text := lower(trim(regexp_replace(coalesce(p_mikke_id, ''), '^@', '')));
begin
  if v_actor is null or not community_private.is_staff(p_community_id) then
    raise exception 'Staff permission is required';
  end if;
  select p.user_id into v_invited_user from public.profiles p where lower(p.handle) = v_handle limit 1;
  if v_invited_user is null then raise exception 'Mikke ID was not found'; end if;
  if exists (select 1 from public.community_memberships m where m.community_id = p_community_id and m.user_id = v_invited_user and m.status = 'active') then
    raise exception 'This user is already an active member';
  end if;
  insert into public.community_invitations (community_id, invited_user_id, invited_by_user_id, invited_mikke_id, entitlement_key, status, expires_at)
  values (p_community_id, v_invited_user, v_actor, v_handle, nullif(trim(p_entitlement_key), ''), 'pending', p_expires_at)
  on conflict (community_id, invited_user_id) do update set
    invited_by_user_id = excluded.invited_by_user_id,
    invited_mikke_id = excluded.invited_mikke_id,
    entitlement_key = excluded.entitlement_key,
    status = 'pending', expires_at = excluded.expires_at, accepted_at = null, updated_at = now()
  returning * into v_invitation;
  return v_invitation;
end;
$$;

create or replace function public.community_leave(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, community_private
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Authentication is required'; end if;
  if exists (select 1 from public.community_communities where id = p_community_id and owner_user_id = v_user) then
    raise exception 'The owner must transfer ownership before leaving';
  end if;
  update public.community_memberships set status = 'left' where community_id = p_community_id and user_id = v_user;
  if not found then raise exception 'Active membership was not found'; end if;
  update public.community_member_entitlements set status = 'revoked', ends_at = coalesce(ends_at, now())
    where community_id = p_community_id and user_id = v_user and status = 'active';
end;
$$;

revoke all on function public.community_invite_by_mikke_id(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.community_invite_by_mikke_id(uuid, text, text, timestamptz) to authenticated;
revoke all on function public.community_leave(uuid) from public, anon;
grant execute on function public.community_leave(uuid) to authenticated;

-- A pending staff invitation permits the standard consent/application flow and
-- is treated as pre-approved only after the invitee submits all required fields.
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
set search_path = pg_catalog, public, community_private
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_settings public.community_safety_settings;
  v_application public.community_join_applications;
  v_status text;
  v_invitation public.community_invitations;
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;
  select email into v_email from auth.users where id = v_user_id;
  select i.* into v_invitation from public.community_invitations i
    where i.community_id = p_community_id and i.invited_user_id = v_user_id and i.status = 'pending'
      and (i.expires_at is null or i.expires_at > now()) for update;
  select s.* into v_settings
  from public.community_safety_settings s
  join public.community_communities c on c.id = s.community_id
  where s.community_id = p_community_id and c.status = 'active'
    and (c.join_mode = 'open_free' or v_invitation.id is not null);
  if v_settings.community_id is null then raise exception 'This Community is not accepting applications'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) < 1 then raise exception 'Display name is required'; end if;
  if v_settings.require_legal_name and char_length(trim(coalesce(p_legal_name, ''))) < 1 then raise exception 'Legal name is required'; end if;
  if v_settings.require_phone and char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')) < 8 then raise exception 'A valid phone number is required'; end if;
  if v_settings.require_join_reason and char_length(trim(coalesce(p_join_reason, ''))) < 1 then raise exception 'Join reason is required'; end if;
  if not (p_accept_terms and p_accept_rules and p_accept_privacy) then raise exception 'All required documents must be accepted'; end if;
  v_status := case when v_invitation.id is not null or v_settings.approval_mode = 'auto' then 'approved' else 'pending' end;

  insert into public.community_join_applications (
    community_id, user_id, display_name, legal_name, email, phone, join_reason,
    status, reviewed_by_user_id, review_note, submitted_at, reviewed_at
  ) values (
    p_community_id, v_user_id, trim(p_display_name), nullif(trim(p_legal_name), ''), v_email,
    nullif(trim(p_phone), ''), nullif(trim(p_join_reason), ''), v_status,
    case when v_invitation.id is not null then v_invitation.invited_by_user_id when v_status = 'approved' then v_user_id else null end,
    case when v_invitation.id is not null then 'Approved by mikke ID invitation' when v_status = 'approved' then 'Auto approved' else null end,
    now(), case when v_status = 'approved' then now() else null end
  ) on conflict (community_id, user_id) do update set
    display_name = excluded.display_name, legal_name = excluded.legal_name,
    email = excluded.email, phone = excluded.phone, join_reason = excluded.join_reason,
    status = excluded.status, reviewed_by_user_id = excluded.reviewed_by_user_id,
    review_note = excluded.review_note, submitted_at = now(), reviewed_at = excluded.reviewed_at
  returning * into v_application;

  insert into public.community_consent_records (community_id, application_id, user_id, document_type, document_version)
  values
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
    on conflict (community_id, user_id) do update set display_name = excluded.display_name;
    if v_invitation.id is not null then
      update public.community_invitations set status = 'accepted', accepted_at = now() where id = v_invitation.id;
      if v_invitation.entitlement_key is not null then
        insert into public.community_member_entitlements (
          community_id, user_id, entitlement_key, source, source_reference, status, granted_by_user_id
        ) values (
          p_community_id, v_user_id, v_invitation.entitlement_key, 'external', 'invitation:' || v_invitation.id, 'active', v_invitation.invited_by_user_id
        ) on conflict (community_id, user_id, entitlement_key, source) do update set
          status = 'active', source_reference = excluded.source_reference, granted_by_user_id = excluded.granted_by_user_id,
          starts_at = now(), ends_at = null;
      end if;
    end if;
  end if;
  return v_application;
end;
$$;

revoke all on function public.community_submit_join_application(uuid, text, text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.community_submit_join_application(uuid, text, text, text, text, boolean, boolean, boolean) to authenticated;

-- Storage objects must be readable only when the signed-in user can access the
-- attachment's Room. The previous policy only checked that an attachment row existed.
drop policy if exists community_files_objects_select on storage.objects;
create policy community_files_objects_select on storage.objects for select to authenticated
using (
  bucket_id = 'community-files'
  and exists (
    select 1
    from public.community_post_attachments a
    join public.community_posts p on p.id = a.post_id
    where a.storage_path = name
      and p.deleted_at is null
      and p.is_hidden = false
      and community_private.can_access_room(p.room_id)
  )
);

-- All existing active members, including the current Official Academy test
-- participants, remain approved. No retroactive application is required.
