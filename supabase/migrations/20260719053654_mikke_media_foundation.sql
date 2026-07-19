-- Mikke Media: shared public-image library for every mikkeOS app.
-- Free allowance: 100 MB per authenticated mikkeID (auth user).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.mikke_media_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null default 'free' check (plan_code in ('free', 'standard', 'business')),
  max_bytes bigint not null default 104857600 check (max_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mikke_media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type = 'image/webp'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 3145728),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  source_app text not null default 'page',
  status text not null default 'pending' check (status in ('pending', 'active', 'trashed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trashed_at timestamptz
);

create table if not exists public.mikke_media_usages (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.mikke_media_assets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  app_key text not null,
  entity_type text not null,
  entity_id text not null,
  field_key text not null,
  created_at timestamptz not null default now(),
  unique (asset_id, app_key, entity_type, entity_id, field_key)
);

create index if not exists mikke_media_assets_owner_status_created_idx
  on public.mikke_media_assets (owner_id, status, created_at desc);
create index if not exists mikke_media_usages_owner_asset_idx
  on public.mikke_media_usages (owner_id, asset_id);

alter table public.mikke_media_accounts enable row level security;
alter table public.mikke_media_assets enable row level security;
alter table public.mikke_media_usages enable row level security;

revoke all on public.mikke_media_accounts from anon, authenticated;
revoke all on public.mikke_media_assets from anon, authenticated;
revoke all on public.mikke_media_usages from anon, authenticated;
grant select on public.mikke_media_accounts to authenticated;
grant select on public.mikke_media_assets to authenticated;
grant select on public.mikke_media_usages to authenticated;

drop policy if exists mikke_media_accounts_select_owner on public.mikke_media_accounts;
create policy mikke_media_accounts_select_owner on public.mikke_media_accounts
for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists mikke_media_assets_select_owner on public.mikke_media_assets;
create policy mikke_media_assets_select_owner on public.mikke_media_assets
for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists mikke_media_usages_select_owner on public.mikke_media_usages;
create policy mikke_media_usages_select_owner on public.mikke_media_usages
for select to authenticated
using (owner_id = (select auth.uid()));

create or replace function private.reserve_mikke_media_asset(
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_width integer,
  p_height integer,
  p_source_app text
) returns public.mikke_media_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_max_bytes bigint;
  v_used_bytes bigint;
  v_asset public.mikke_media_assets;
begin
  if v_owner is null then
    raise exception 'MIKKE_MEDIA_AUTH_REQUIRED';
  end if;
  if p_mime_type <> 'image/webp' or p_byte_size <= 0 or p_byte_size > 3145728 then
    raise exception 'MIKKE_MEDIA_INVALID_FILE';
  end if;
  if p_storage_path !~ ('^' || v_owner::text || '/images/[0-9]{4}-[0-9]{2}/[a-zA-Z0-9-]+[.]webp$') then
    raise exception 'MIKKE_MEDIA_INVALID_PATH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));

  insert into public.mikke_media_accounts (owner_id)
  values (v_owner)
  on conflict (owner_id) do nothing;

  select max_bytes into v_max_bytes
  from public.mikke_media_accounts
  where owner_id = v_owner;

  select coalesce(sum(byte_size), 0) into v_used_bytes
  from public.mikke_media_assets
  where owner_id = v_owner
    and status in ('pending', 'active', 'trashed');

  if v_used_bytes + p_byte_size > v_max_bytes then
    raise exception 'MIKKE_MEDIA_QUOTA_EXCEEDED';
  end if;

  insert into public.mikke_media_assets (
    owner_id, storage_path, original_name, mime_type, byte_size,
    width, height, source_app, status
  ) values (
    v_owner, p_storage_path, left(coalesce(nullif(p_original_name, ''), 'image.webp'), 255),
    p_mime_type, p_byte_size, p_width, p_height,
    left(coalesce(nullif(p_source_app, ''), 'unknown'), 50), 'pending'
  ) returning * into v_asset;

  return v_asset;
end;
$$;

create or replace function private.finalize_mikke_media_asset(p_asset_id uuid)
returns public.mikke_media_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_asset public.mikke_media_assets;
  v_object_size bigint;
begin
  if v_owner is null then
    raise exception 'MIKKE_MEDIA_AUTH_REQUIRED';
  end if;

  select * into v_asset
  from public.mikke_media_assets
  where id = p_asset_id and owner_id = v_owner and status = 'pending'
  for update;

  if v_asset.id is null then
    raise exception 'MIKKE_MEDIA_RESERVATION_NOT_FOUND';
  end if;

  select nullif(metadata->>'size', '')::bigint into v_object_size
  from storage.objects
  where bucket_id = 'mikke-media'
    and name = v_asset.storage_path
    and owner_id = v_owner::text;

  if v_object_size is null then
    raise exception 'MIKKE_MEDIA_OBJECT_NOT_FOUND';
  end if;
  if v_object_size <> v_asset.byte_size then
    raise exception 'MIKKE_MEDIA_SIZE_MISMATCH';
  end if;

  update public.mikke_media_assets
  set status = 'active', updated_at = now()
  where id = v_asset.id
  returning * into v_asset;

  return v_asset;
end;
$$;

create or replace function private.cancel_mikke_media_reservation(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'MIKKE_MEDIA_AUTH_REQUIRED';
  end if;
  delete from public.mikke_media_assets
  where id = p_asset_id and owner_id = v_owner and status = 'pending';
end;
$$;

create or replace function public.reserve_mikke_media_asset(
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_width integer,
  p_height integer,
  p_source_app text
) returns public.mikke_media_assets
language sql
security invoker
set search_path = ''
as $$
  select private.reserve_mikke_media_asset(
    p_storage_path, p_original_name, p_mime_type, p_byte_size,
    p_width, p_height, p_source_app
  );
$$;

create or replace function public.finalize_mikke_media_asset(p_asset_id uuid)
returns public.mikke_media_assets
language sql
security invoker
set search_path = ''
as $$ select private.finalize_mikke_media_asset(p_asset_id); $$;

create or replace function public.cancel_mikke_media_reservation(p_asset_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.cancel_mikke_media_reservation(p_asset_id); $$;

create or replace function public.get_mikke_media_usage()
returns table (used_bytes bigint, max_bytes bigint, asset_count bigint)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    coalesce(sum(a.byte_size) filter (where a.status in ('pending', 'active', 'trashed')), 0)::bigint,
    coalesce(max(q.max_bytes), 104857600)::bigint,
    count(a.id) filter (where a.status = 'active')::bigint
  from (select auth.uid() as owner_id) current_user_id
  left join public.mikke_media_accounts q on q.owner_id = current_user_id.owner_id
  left join public.mikke_media_assets a on a.owner_id = current_user_id.owner_id;
$$;

revoke all on function private.reserve_mikke_media_asset(text, text, text, bigint, integer, integer, text) from public, anon;
revoke all on function private.finalize_mikke_media_asset(uuid) from public, anon;
revoke all on function private.cancel_mikke_media_reservation(uuid) from public, anon;
grant execute on function private.reserve_mikke_media_asset(text, text, text, bigint, integer, integer, text) to authenticated;
grant execute on function private.finalize_mikke_media_asset(uuid) to authenticated;
grant execute on function private.cancel_mikke_media_reservation(uuid) to authenticated;

revoke all on function public.reserve_mikke_media_asset(text, text, text, bigint, integer, integer, text) from public, anon;
revoke all on function public.finalize_mikke_media_asset(uuid) from public, anon;
revoke all on function public.cancel_mikke_media_reservation(uuid) from public, anon;
revoke all on function public.get_mikke_media_usage() from public, anon;
grant execute on function public.reserve_mikke_media_asset(text, text, text, bigint, integer, integer, text) to authenticated;
grant execute on function public.finalize_mikke_media_asset(uuid) to authenticated;
grant execute on function public.cancel_mikke_media_reservation(uuid) to authenticated;
grant execute on function public.get_mikke_media_usage() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mikke-media', 'mikke-media', true, 3145728, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mikke_media_objects_select_owner on storage.objects;
drop policy if exists mikke_media_objects_insert_reserved on storage.objects;
drop policy if exists mikke_media_objects_update_owner on storage.objects;
drop policy if exists mikke_media_objects_delete_owner on storage.objects;

create policy mikke_media_objects_select_owner on storage.objects
for select to authenticated
using (
  bucket_id = 'mikke-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy mikke_media_objects_insert_reserved on storage.objects
for insert to authenticated
with check (
  bucket_id = 'mikke-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.mikke_media_assets asset
    where asset.owner_id = (select auth.uid())
      and asset.storage_path = name
      and asset.status = 'pending'
  )
);

create policy mikke_media_objects_update_owner on storage.objects
for update to authenticated
using (
  bucket_id = 'mikke-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'mikke-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy mikke_media_objects_delete_owner on storage.objects
for delete to authenticated
using (
  bucket_id = 'mikke-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
