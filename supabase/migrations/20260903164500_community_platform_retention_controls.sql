-- Community operator lifecycle controls backed by the common platform billing ledger.
-- Participant memberships and Room entitlements are intentionally not expired here.

create table community_private.platform_retention_anonymization_allowlist (
  target_table text not null,
  target_column text not null,
  primary key (target_table, target_column),
  check (
    (target_table = 'community_communities' and target_column in ('name', 'description', 'logo_url', 'banner_url'))
    or
    (target_table = 'community_operator_profiles' and target_column in (
      'business_name', 'representative_name', 'postal_address', 'contact_email',
      'contact_phone', 'website_url', 'commercial_disclosure_url', 'privacy_policy_url',
      'terms_url', 'status', 'verified_at'
    ))
  )
);

insert into community_private.platform_retention_anonymization_allowlist(target_table, target_column) values
  ('community_communities', 'name'),
  ('community_communities', 'description'),
  ('community_communities', 'logo_url'),
  ('community_communities', 'banner_url'),
  ('community_operator_profiles', 'business_name'),
  ('community_operator_profiles', 'representative_name'),
  ('community_operator_profiles', 'postal_address'),
  ('community_operator_profiles', 'contact_email'),
  ('community_operator_profiles', 'contact_phone'),
  ('community_operator_profiles', 'website_url'),
  ('community_operator_profiles', 'commercial_disclosure_url'),
  ('community_operator_profiles', 'privacy_policy_url'),
  ('community_operator_profiles', 'terms_url'),
  ('community_operator_profiles', 'status'),
  ('community_operator_profiles', 'verified_at');

create table community_private.platform_retention_anonymizations (
  community_id uuid primary key references public.community_communities(id) on delete restrict,
  anonymized_after timestamptz not null,
  anonymized_at timestamptz not null,
  target_manifest jsonb not null,
  check (jsonb_typeof(target_manifest) = 'array')
);

alter table community_private.platform_retention_anonymization_allowlist enable row level security;
alter table community_private.platform_retention_anonymizations enable row level security;
revoke all on community_private.platform_retention_anonymization_allowlist from public, anon, authenticated, service_role;
revoke all on community_private.platform_retention_anonymizations from public, anon, authenticated, service_role;

create function community_private.community_platform_access_window(
  p_community_id uuid,
  p_at timestamptz
) returns table (
  actor_user_id uuid,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  write_allowed boolean,
  owner_read_until timestamptz,
  anonymize_after timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select access.actor_user_id, access.status, access.current_period_start,
         access.current_period_end, access.write_allowed, access.owner_read_until,
         access.anonymize_after
  from public.community_communities community
  cross join lateral platform_billing_private.resource_access_window(
    'community_platform', community.id, p_at
  ) access
  where community.id = p_community_id
    and community.owner_user_id is not null
    and access.actor_user_id = community.owner_user_id;
$$;

create function community_private.community_owner_write_allowed(
  p_community_id uuid,
  p_at timestamptz
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select access.write_allowed
    from community_private.community_platform_access_window(p_community_id, p_at) access
  ), false);
$$;

create function community_private.community_owner_read_allowed(
  p_community_id uuid,
  p_user_id uuid,
  p_at timestamptz
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select access.actor_user_id = p_user_id
       and (
         access.write_allowed
         or access.status = 'past_due'
         or (
           access.status = 'ended'
           and access.owner_read_until is not null
           and p_at < access.owner_read_until
         )
       )
    from community_private.community_platform_access_window(p_community_id, p_at) access
  ), false);
$$;

create function community_private.community_current_actor_owner_read_allowed(
  p_community_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt()->>'is_anonymous'), 'false') <> 'true'
    and community_private.community_owner_read_allowed(
      p_community_id, (select auth.uid()), pg_catalog.clock_timestamp()
    );
$$;

revoke all on function community_private.community_platform_access_window(uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function community_private.community_owner_write_allowed(uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function community_private.community_owner_read_allowed(uuid, uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function community_private.community_current_actor_owner_read_allowed(uuid) from public, anon;
grant execute on function community_private.community_current_actor_owner_read_allowed(uuid) to authenticated;

-- Staff privileges are operating privileges. A moderator remains an ordinary
-- participant while the owner contract is read-only, but loses staff mutation powers.
create or replace function community_private.is_staff(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt()->>'is_anonymous'), 'false') <> 'true'
    and community_private.community_owner_write_allowed(p_community_id, pg_catalog.clock_timestamp())
    and (
      exists (
        select 1 from public.community_communities community
        where community.id = p_community_id
          and community.owner_user_id = (select auth.uid())
      )
      or exists (
        select 1 from public.community_memberships membership
        where membership.community_id = p_community_id
          and membership.user_id = (select auth.uid())
          and membership.status = 'active'
          and membership.role in ('owner', 'moderator')
      )
    );
$$;

-- The canonical owner's membership is platform-derived. Other participant
-- memberships remain independent and keep their existing read/write contract.
create or replace function community_private.is_active_member(p_community_id uuid)
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
      from public.community_memberships membership
      join public.community_communities community on community.id = membership.community_id
      where membership.community_id = p_community_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and (
          community.owner_user_id <> (select auth.uid())
          or community_private.community_owner_read_allowed(
            p_community_id, (select auth.uid()), pg_catalog.clock_timestamp()
          )
        )
    );
$$;

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

revoke all on function community_private.is_staff(uuid) from public, anon;
revoke all on function community_private.is_active_member(uuid) from public, anon;
revoke all on function community_private.can_access_room(uuid) from public, anon;
grant execute on function community_private.is_staff(uuid) to authenticated;
grant execute on function community_private.is_active_member(uuid) to authenticated;
grant execute on function community_private.can_access_room(uuid) to authenticated;

-- Existing policies use is_staff for both reads and writes. Add read-only
-- owner policies without restoring any staff mutation privilege.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'community_memberships', 'community_member_profiles',
    'community_rooms', 'community_posts', 'community_events', 'community_resources',
    'community_entitlement_definitions', 'community_member_entitlements',
    'community_room_entitlement_rules', 'community_post_attachments', 'community_stamps',
    'community_chat_messages', 'community_chat_message_reactions', 'community_room_reads',
    'community_post_reactions', 'community_comment_reactions', 'community_post_bookmarks',
    'community_safety_settings', 'community_join_applications', 'community_consent_records',
    'community_blocked_words', 'community_reports', 'community_inquiries',
    'community_moderation_actions', 'community_invitations', 'community_membership_plans',
    'community_payment_claims', 'community_access_source_mappings',
    'community_member_data_requests', 'community_operator_profiles',
    'community_operator_agreements', 'community_platform_subscriptions'
  ] loop
    execute format('drop policy if exists "community retention owner can read" on public.%I', v_table);
    execute format(
      'create policy "community retention owner can read" on public.%I for select to authenticated using (community_private.community_current_actor_owner_read_allowed(community_id))',
      v_table
    );
  end loop;
end;
$$;

drop policy if exists "community retention owner can read" on public.community_communities;
create policy "community retention owner can read"
on public.community_communities for select to authenticated
using (community_private.community_current_actor_owner_read_allowed(id));

drop policy if exists "community retention owner can read" on public.community_comments;
create policy "community retention owner can read"
on public.community_comments for select to authenticated
using (exists (
  select 1 from public.community_posts post
  where post.id = community_comments.post_id
    and community_private.community_current_actor_owner_read_allowed(post.community_id)
));

drop policy if exists "community retention owner can read" on public.community_event_attendees;
create policy "community retention owner can read"
on public.community_event_attendees for select to authenticated
using (exists (
  select 1 from public.community_events event
  where event.id = community_event_attendees.event_id
    and community_private.community_current_actor_owner_read_allowed(event.community_id)
));

-- Defense in depth for user-owned mutations that do not call is_staff. It only
-- applies when the actor is the canonical owner; ordinary participant writes,
-- Academy claims and non-platform entitlements are not changed.
create function community_private.guard_platform_owner_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_community_id uuid;
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_table_name = 'community_communities' then
    if tg_op = 'INSERT' then return new; end if;
    v_community_id := (v_row->>'id')::uuid;
  elsif v_row ? 'community_id' then
    v_community_id := (v_row->>'community_id')::uuid;
  elsif tg_table_name = 'community_comments' then
    select post.community_id into v_community_id
    from public.community_posts post where post.id = (v_row->>'post_id')::uuid;
  elsif tg_table_name = 'community_event_attendees' then
    select event.community_id into v_community_id
    from public.community_events event where event.id = (v_row->>'event_id')::uuid;
  end if;

  if v_community_id is not null
     and exists (
       select 1 from public.community_communities community
       where community.id = v_community_id and community.owner_user_id = v_actor
     )
     and not community_private.community_owner_write_allowed(
       v_community_id, pg_catalog.clock_timestamp()
     ) then
    raise exception using errcode = '55000', message = 'COMMUNITY_PLATFORM_OWNER_READ_ONLY';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function community_private.guard_platform_owner_write() from public, anon, authenticated, service_role;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'community_communities', 'community_memberships', 'community_member_profiles',
    'community_rooms', 'community_posts', 'community_comments', 'community_events',
    'community_event_attendees', 'community_resources', 'community_entitlement_definitions',
    'community_member_entitlements', 'community_room_entitlement_rules',
    'community_post_attachments', 'community_stamps', 'community_chat_messages',
    'community_chat_message_reactions', 'community_room_reads', 'community_post_reactions',
    'community_comment_reactions', 'community_post_bookmarks', 'community_safety_settings',
    'community_join_applications', 'community_blocked_words', 'community_moderation_actions',
    'community_invitations', 'community_membership_plans', 'community_payment_claims',
    'community_access_source_mappings', 'community_operator_profiles',
    'community_operator_agreements'
  ] loop
    execute format('drop trigger if exists community_platform_owner_write_guard on public.%I', v_table);
    execute format(
      'create trigger community_platform_owner_write_guard before insert or update or delete on public.%I for each row execute function community_private.guard_platform_owner_write()',
      v_table
    );
  end loop;
end;
$$;

create function public.community_export_owner_archive(p_community_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_export jsonb;
begin
  if v_actor is null or coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'Authenticated non-anonymous user required';
  end if;
  if not community_private.community_owner_read_allowed(p_community_id, v_actor, pg_catalog.clock_timestamp()) then
    raise exception using errcode = '42501', message = 'COMMUNITY_OWNER_EXPORT_NOT_AVAILABLE';
  end if;

  select jsonb_build_object(
    'version', 1,
    'exportedAt', pg_catalog.clock_timestamp(),
    'community', to_jsonb(community) - 'owner_user_id' - 'updated_at',
    'rooms', coalesce((select jsonb_agg(to_jsonb(room) order by room.sort_order, room.created_at) from public.community_rooms room where room.community_id = p_community_id), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(to_jsonb(post) order by post.created_at) from public.community_posts post where post.community_id = p_community_id), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(comment) order by comment.created_at) from public.community_comments comment join public.community_posts post on post.id = comment.post_id where post.community_id = p_community_id), '[]'::jsonb),
    'chatMessages', coalesce((select jsonb_agg(to_jsonb(message) order by message.created_at) from public.community_chat_messages message where message.community_id = p_community_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(event) order by event.starts_at) from public.community_events event where event.community_id = p_community_id), '[]'::jsonb),
    'resources', coalesce((select jsonb_agg(to_jsonb(resource) order by resource.sort_order, resource.created_at) from public.community_resources resource where resource.community_id = p_community_id), '[]'::jsonb),
    'memberships', coalesce((select jsonb_agg(to_jsonb(membership) - 'memo' order by membership.joined_at) from public.community_memberships membership where membership.community_id = p_community_id), '[]'::jsonb),
    'memberProfiles', coalesce((select jsonb_agg(to_jsonb(profile) order by profile.created_at) from public.community_member_profiles profile where profile.community_id = p_community_id), '[]'::jsonb),
    'joinApplications', coalesce((select jsonb_agg(to_jsonb(application) order by application.submitted_at) from public.community_join_applications application where application.community_id = p_community_id), '[]'::jsonb),
    'consentRecords', coalesce((select jsonb_agg(to_jsonb(consent) order by consent.accepted_at) from public.community_consent_records consent where consent.community_id = p_community_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(report) order by report.created_at) from public.community_reports report where report.community_id = p_community_id), '[]'::jsonb),
    'inquiries', coalesce((select jsonb_agg(to_jsonb(inquiry) order by inquiry.created_at) from public.community_inquiries inquiry where inquiry.community_id = p_community_id), '[]'::jsonb),
    'moderationActions', coalesce((select jsonb_agg(to_jsonb(action) order by action.created_at) from public.community_moderation_actions action where action.community_id = p_community_id), '[]'::jsonb),
    'invitations', coalesce((select jsonb_agg(to_jsonb(invitation) order by invitation.created_at) from public.community_invitations invitation where invitation.community_id = p_community_id), '[]'::jsonb),
    'membershipPlans', coalesce((select jsonb_agg(to_jsonb(plan) order by plan.sort_order, plan.created_at) from public.community_membership_plans plan where plan.community_id = p_community_id), '[]'::jsonb),
    'paymentClaims', coalesce((select jsonb_agg(to_jsonb(claim) order by claim.created_at) from public.community_payment_claims claim where claim.community_id = p_community_id), '[]'::jsonb),
    'memberDataRequests', coalesce((select jsonb_agg(to_jsonb(request) order by request.created_at) from public.community_member_data_requests request where request.community_id = p_community_id), '[]'::jsonb),
    'operatorProfile', (select to_jsonb(profile) from public.community_operator_profiles profile where profile.community_id = p_community_id),
    'operatorAgreements', coalesce((select jsonb_agg(to_jsonb(agreement) order by agreement.accepted_at) from public.community_operator_agreements agreement where agreement.community_id = p_community_id), '[]'::jsonb)
  ) into v_export
  from public.community_communities community
  where community.id = p_community_id;
  return v_export;
end;
$$;

revoke all on function public.community_export_owner_archive(uuid) from public, anon, service_role;
grant execute on function public.community_export_owner_archive(uuid) to authenticated;

create function public.community_apply_platform_retention_anonymization(
  p_community_id uuid,
  p_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access record;
  v_owner_user_id uuid;
  v_manifest jsonb;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  select community.owner_user_id into v_owner_user_id
  from public.community_communities community
  where community.id = p_community_id
  for update;
  if v_owner_user_id is null then
    raise exception using errcode = '22023', message = 'COMMUNITY_RETENTION_SCOPE_INVALID';
  end if;

  select access.* into v_access
  from community_private.community_platform_access_window(p_community_id, p_at) access;
  if v_access.actor_user_id is distinct from v_owner_user_id
     or v_access.status is distinct from 'ended'
     or v_access.anonymize_after is null
     or p_at < v_access.anonymize_after then
    raise exception using errcode = '55000', message = 'COMMUNITY_RETENTION_NOT_DUE';
  end if;

  if exists (
    select 1 from community_private.platform_retention_anonymizations log
    where log.community_id = p_community_id
  ) then
    return false;
  end if;

  select jsonb_agg(jsonb_build_object('table', target.target_table, 'column', target.target_column)
                   order by target.target_table, target.target_column)
  into v_manifest
  from community_private.platform_retention_anonymization_allowlist target;

  update public.community_communities
  set name = '終了したCommunity', description = null, logo_url = null, banner_url = null
  where id = p_community_id;

  update public.community_operator_profiles
  set business_name = '', representative_name = '', postal_address = '', contact_email = '',
      contact_phone = null, website_url = null, commercial_disclosure_url = null,
      privacy_policy_url = null, terms_url = null, status = 'incomplete', verified_at = null
  where community_id = p_community_id;

  insert into community_private.platform_retention_anonymizations(
    community_id, anonymized_after, anonymized_at, target_manifest
  ) values (p_community_id, v_access.anonymize_after, p_at, v_manifest);
  return true;
end;
$$;

revoke all on function public.community_apply_platform_retention_anonymization(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.community_apply_platform_retention_anonymization(uuid, timestamptz) to service_role;

comment on function public.community_apply_platform_retention_anonymization(uuid, timestamptz) is
  'Service-only, allowlisted Community operator metadata anonymization after the common billing retention deadline. Participant records and entitlement ledgers are not mutated.';
