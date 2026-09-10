-- Community owner usability: auditable manual payments and private resource files.

alter table public.community_membership_plans
  drop constraint community_membership_plans_external_payment_url_check;
alter table public.community_membership_plans
  add constraint community_membership_plans_external_payment_url_check
  check (
    external_payment_url = ''
    or (
      pg_catalog.char_length(external_payment_url) <= 2048
      and external_payment_url ~ '^https://'
    )
  );

alter table public.community_payment_claims
  add column if not exists payment_method text not null default 'external_link';

alter table public.community_payment_claims
  add column if not exists manual_request_id uuid;

alter table public.community_payment_claims
  drop constraint if exists community_payment_claims_payment_method_check;
alter table public.community_payment_claims
  add constraint community_payment_claims_payment_method_check
  check (payment_method in ('external_link', 'uword_points', 'bank_transfer', 'cash', 'other'));

alter table public.community_payment_claims
  drop constraint if exists community_payment_claims_manual_identity_check;
alter table public.community_payment_claims
  add constraint community_payment_claims_manual_identity_check check (
    (payment_method = 'external_link' and manual_request_id is null)
    or (payment_method <> 'external_link' and manual_request_id is not null)
  );

create unique index if not exists community_payment_claims_manual_request_unique
  on public.community_payment_claims(manual_request_id)
  where manual_request_id is not null;

create or replace function community_private.guard_payment_claim_method_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.payment_method is distinct from old.payment_method
    or new.manual_request_id is distinct from old.manual_request_id
  then
    raise exception using errcode = '22023', message = 'Community payment method identity is immutable';
  end if;
  return new;
end;
$function$;

revoke all on function community_private.guard_payment_claim_method_identity() from public, anon, authenticated, service_role;
drop trigger if exists community_payment_claim_method_identity_immutable on public.community_payment_claims;
create trigger community_payment_claim_method_identity_immutable
before update of payment_method, manual_request_id on public.community_payment_claims
for each row execute function community_private.guard_payment_claim_method_identity();

alter table public.community_resources
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint;

alter table public.community_resources
  drop constraint if exists community_resources_file_metadata_check;
alter table public.community_resources
  add constraint community_resources_file_metadata_check check (
    (storage_path is null and file_name is null and mime_type is null and file_size_bytes is null)
    or (
      storage_path is not null
      and file_name is not null
      and mime_type is not null
      and file_size_bytes is not null
      and file_size_bytes between 1 and 52428800
      and external_url = ''
      and split_part(storage_path, '/', 1) = community_id::text
      and split_part(storage_path, '/', 2) = id::text
      and split_part(storage_path, '/', 3) <> ''
      and split_part(storage_path, '/', 4) <> ''
      and split_part(storage_path, '/', 5) = ''
      and pg_catalog.cardinality(pg_catalog.string_to_array(storage_path, '/')) = 4
      and (
        (kind = 'pdf' and mime_type = 'application/pdf')
        or (kind = 'video' and mime_type in ('video/mp4', 'video/webm', 'video/quicktime'))
      )
    )
  );

create unique index if not exists community_resources_storage_path_unique
  on public.community_resources(storage_path)
  where storage_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-resources',
  'community-resources',
  false,
  52428800,
  array[
    'application/pdf',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_resource_objects_select on storage.objects;
drop policy if exists community_resource_objects_insert on storage.objects;
drop policy if exists community_resource_objects_delete on storage.objects;

create policy community_resource_objects_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'community-resources'
  and exists (
    select 1
    from public.community_resources resource
    where resource.storage_path = name
      and resource.community_id::text = (storage.foldername(name))[1]
      and resource.id::text = (storage.foldername(name))[2]
      and (
        community_private.is_staff(resource.community_id)
        or (
          resource.is_published = true
          and exists (
            select 1
            from public.community_memberships membership
            where membership.community_id = resource.community_id
              and membership.user_id = (select auth.uid())
              and membership.status = 'active'
              and membership.access_scope = 'community'
          )
        )
      )
  )
);

create policy community_resource_objects_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-resources'
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and exists (
    select 1
    from public.community_resources resource
    where resource.storage_path = name
      and resource.community_id::text = (storage.foldername(name))[1]
      and resource.id::text = (storage.foldername(name))[2]
      and community_private.is_staff(resource.community_id)
  )
);

create policy community_resource_objects_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-resources'
  and exists (
    select 1
    from public.community_resources resource
    where resource.storage_path = name
      and resource.community_id::text = (storage.foldername(name))[1]
      and resource.id::text = (storage.foldername(name))[2]
      and community_private.is_staff(resource.community_id)
  )
);

create or replace function public.community_record_manual_payment(
  p_community_id uuid,
  p_plan_id uuid,
  p_member_user_id uuid,
  p_payment_method text,
  p_external_reference text default null,
  p_note text default null,
  p_request_id uuid default null
)
returns public.community_payment_claims
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_plan public.community_membership_plans;
  v_claim public.community_payment_claims;
  v_existing public.community_payment_claims;
  v_payer_name text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception using errcode = '42501', message = 'A registered account is required';
  end if;
  if p_payment_method not in ('uword_points', 'bank_transfer', 'cash', 'other') then
    raise exception using errcode = '22023', message = 'A supported manual payment method is required';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'A manual payment request ID is required';
  end if;
  if not community_private.is_staff(p_community_id) then
    raise exception using errcode = '42501', message = 'Community staff authority is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('community-manual-payment:' || p_request_id::text, 0)
  );

  -- Preserve the shared Community parent-first lock order.
  perform 1
  from public.community_communities community
  where community.id = p_community_id
  for update;

  -- Lock the actor's membership when present, then re-check authority after
  -- every earlier wait. The canonical owner is protected by the parent lock.
  perform 1
  from public.community_memberships membership
  where membership.community_id = p_community_id
    and membership.user_id = v_actor
  for update;
  if not community_private.is_staff(p_community_id) then
    raise exception using errcode = '42501', message = 'Community staff authority is required';
  end if;

  -- An idempotent replay crosses the same post-wait authorization boundary as
  -- a new grant. A staff member revoked while waiting must not receive the
  -- recorded payment row.
  select claim.* into v_existing
  from public.community_payment_claims claim
  where claim.manual_request_id = p_request_id
  for update;
  if v_existing.id is not null then
    if v_existing.community_id <> p_community_id
      or v_existing.plan_id <> p_plan_id
      or v_existing.user_id <> p_member_user_id
      or v_existing.payment_method <> p_payment_method
      or coalesce(v_existing.external_reference, '') <> pg_catalog.btrim(coalesce(p_external_reference, ''))
      or coalesce(v_existing.note, '') <> pg_catalog.btrim(coalesce(p_note, ''))
      or v_existing.status <> 'approved'
    then
      raise exception using errcode = '22023', message = 'Manual payment request payload does not match the recorded request';
    end if;
    if not community_private.is_staff(p_community_id) then
      raise exception using errcode = '42501', message = 'Community staff authority is required';
    end if;
    return v_existing;
  end if;

  select plan.* into v_plan
  from public.community_membership_plans plan
  where plan.id = p_plan_id
    and plan.community_id = p_community_id
    and plan.status = 'active'
  for update;
  if v_plan.id is null then
    raise exception 'Active Community plan was not found';
  end if;

  perform 1
  from public.community_entitlement_definitions definition
  where definition.community_id = p_community_id
    and definition.key = v_plan.entitlement_key
    and definition.status = 'active'
  for update;
  if not found then
    raise exception 'Active Community entitlement was not found';
  end if;

  perform 1
  from public.community_memberships membership
  where membership.community_id = p_community_id
    and membership.user_id = p_member_user_id
    and membership.status = 'active'
  for update;
  if not found then
    raise exception 'Active Community member was not found';
  end if;
  if not community_private.is_staff(p_community_id) then
    raise exception using errcode = '42501', message = 'Community staff authority is required';
  end if;

  if exists (
    select 1
    from public.community_academy_entitlement_claims academy_claim
    join public.community_access_source_mappings mapping
      on mapping.id = academy_claim.mapping_id
     and mapping.community_id = academy_claim.community_id
     and mapping.entitlement_key = academy_claim.entitlement_key
     and mapping.provider_type = 'academy_subscription'
     and mapping.status = 'active'
    where academy_claim.community_id = p_community_id
      and academy_claim.user_id = p_member_user_id
      and academy_claim.entitlement_key = v_plan.entitlement_key
      and academy_claim.status = 'active'
      and academy_claim.starts_at <= pg_catalog.now()
      and (academy_claim.ends_at is null or academy_claim.ends_at > pg_catalog.now())
  ) then
    raise exception 'This access is already included with an active Academy benefit';
  end if;

  select coalesce(nullif(pg_catalog.btrim(profile.display_name), ''), '参加者')
    into v_payer_name
  from public.community_member_profiles profile
  where profile.community_id = p_community_id
    and profile.user_id = p_member_user_id;
  v_payer_name := coalesce(v_payer_name, '参加者');

  insert into public.community_payment_claims (
    community_id, plan_id, user_id, payer_name, external_reference, note,
    payment_method, manual_request_id, status, reviewed_by_user_id, reviewed_at, review_note
  ) values (
    p_community_id, p_plan_id, p_member_user_id, v_payer_name,
    nullif(pg_catalog.btrim(coalesce(p_external_reference, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
    p_payment_method, p_request_id, 'approved', v_actor, pg_catalog.now(),
    '運営者が支払いを確認'
  ) returning * into v_claim;

  if exists (
    select 1
    from public.community_member_entitlements entitlement
    where entitlement.community_id = p_community_id
      and entitlement.user_id = p_member_user_id
      and entitlement.entitlement_key = v_plan.entitlement_key
      and entitlement.source = 'external'
      and coalesce(entitlement.source_reference, '') not like 'manual-payment-claim:%'
  ) then
    raise exception using errcode = '23505', message = 'A different external entitlement already provides this access';
  end if;

  insert into public.community_member_entitlements (
    community_id, user_id, entitlement_key, source, source_reference,
    status, starts_at, ends_at, granted_by_user_id
  ) values (
    p_community_id, p_member_user_id, v_plan.entitlement_key,
    'external', 'manual-payment-claim:' || v_claim.id::text,
    'active', pg_catalog.now(), null, v_actor
  )
  on conflict (community_id, user_id, entitlement_key, source)
  do update set
    source_reference = excluded.source_reference,
    status = 'active',
    starts_at = excluded.starts_at,
    ends_at = null,
    granted_by_user_id = excluded.granted_by_user_id,
    updated_at = pg_catalog.now();

  return v_claim;
end;
$function$;

revoke all on function public.community_record_manual_payment(uuid, uuid, uuid, text, text, text, uuid) from public, anon, service_role;
grant execute on function public.community_record_manual_payment(uuid, uuid, uuid, text, text, text, uuid) to authenticated;
