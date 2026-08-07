alter table public.story_profiles
  add column if not exists website_label text not null default 'Webサイト',
  add column if not exists shop_label text not null default 'ショップ';

alter table public.story_profiles
  drop constraint if exists story_profiles_portfolio_items_limit,
  drop constraint if exists story_profiles_theme_key;

update public.story_profiles
set theme_key = case theme_key
  when 'indigo' then 'blue'
  when 'rose' then 'pink'
  when 'sage' then 'green'
  when 'sun' then 'yellow'
  when 'ink' then 'blue'
  else theme_key
end
where theme_key in ('indigo', 'rose', 'sage', 'sun', 'ink');

alter table public.story_profiles
  alter column theme_key set default 'blue',
  add constraint story_profiles_portfolio_items_limit check (jsonb_array_length(portfolio_items) <= 6),
  add constraint story_profiles_theme_key check (theme_key in ('blue', 'orange', 'green', 'yellow', 'pink'));

grant select (website_label, shop_label) on table public.story_profiles to anon, authenticated;

drop function if exists public.story_profile_get_mine();
create function public.story_profile_get_mine()
returns table (
  handle text, display_name text, role_label text, bio text, area text,
  avatar_url text, avatar_storage_path text, banner_storage_path text,
  portfolio_items jsonb, theme_key text,
  website_label text, website_url text, shop_label text, shop_url text,
  sns_links jsonb, tags text[], status_label text, pickup_text text,
  publication_status text, published_at timestamptz, created_at timestamptz, updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.handle, sp.display_name, sp.role_label, sp.bio, sp.area,
    sp.avatar_url, sp.avatar_storage_path, sp.banner_storage_path,
    sp.portfolio_items, sp.theme_key,
    sp.website_label, sp.website_url, sp.shop_label, sp.shop_url,
    sp.sns_links, sp.tags, sp.status_label, sp.pickup_text,
    sp.publication_status, sp.published_at, sp.created_at, sp.updated_at
  from public.story_profiles sp
  where sp.owner_user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.story_profile_get_mine() from public, anon;
grant execute on function public.story_profile_get_mine() to authenticated, service_role;

drop function if exists public.story_profile_save_mine(
  text, text, text, text, text, text, text, text, jsonb, text, text, text, jsonb, text[], text, text, text
);

create function public.story_profile_save_mine(
  p_handle text,
  p_display_name text,
  p_role_label text default '',
  p_bio text default '',
  p_area text default '',
  p_avatar_url text default null,
  p_avatar_storage_path text default null,
  p_banner_storage_path text default null,
  p_portfolio_items jsonb default '[]'::jsonb,
  p_theme_key text default 'blue',
  p_website_label text default 'Webサイト',
  p_website_url text default null,
  p_shop_label text default 'ショップ',
  p_shop_url text default null,
  p_sns_links jsonb default '[]'::jsonb,
  p_tags text[] default '{}'::text[],
  p_status_label text default '',
  p_pickup_text text default '',
  p_publication_status text default 'draft'
)
returns table (
  handle text, display_name text, role_label text, bio text, area text,
  avatar_url text, avatar_storage_path text, banner_storage_path text,
  portfolio_items jsonb, theme_key text,
  website_label text, website_url text, shop_label text, shop_url text,
  sns_links jsonb, tags text[], status_label text, pickup_text text,
  publication_status text, published_at timestamptz, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  caller_profile_id uuid;
  current_handle text;
  requested_handle text;
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_publication_status not in ('draft', 'published') then
    raise exception 'Invalid publication status.' using errcode = '22023';
  end if;
  if p_theme_key not in ('blue', 'orange', 'green', 'yellow', 'pink') then
    raise exception 'Invalid theme.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_portfolio_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_portfolio_items, '[]'::jsonb)) > 6 then
    raise exception 'Portfolio must be an array of at most six items.' using errcode = '22023';
  end if;

  select p.id, p.handle into caller_profile_id, current_handle
  from public.profiles p
  where p.user_id = caller_user_id
  order by p.created_at asc
  limit 1;
  if caller_profile_id is null then
    raise exception 'Profile not found for authenticated user.' using errcode = 'P0002';
  end if;

  requested_handle := lower(trim(regexp_replace(coalesce(nullif(trim(p_handle), ''), current_handle), '^@', '')));
  if requested_handle !~ '^[a-z0-9_][a-z0-9_-]{2,29}$' then
    raise exception 'Invalid mikke ID.' using errcode = '22023';
  end if;
  if requested_handle = any (array[
    'admin', 'administrator', 'api', 'app', 'apps', 'auth', 'dashboard', 'edit', 'help', 'home',
    'login', 'logout', 'manager', 'member', 'members', 'mikke', 'mikke-id', 'mikke-os', 'mikkeos',
    'mikkeruu', 'new', 'official', 'owner', 'preview', 'profile', 'root', 'settings', 'staff', 'start',
    'story', 'support', 'system'
  ])
  or requested_handle like 'admin-%'
  or requested_handle like 'api-%'
  or requested_handle like 'mikke-%'
  or requested_handle like 'mikkeos-%'
  or requested_handle like 'mikkeruu-%'
  or requested_handle like 'official-%'
  or requested_handle like 'system-%' then
    raise exception 'Reserved mikke ID.' using errcode = '22023';
  end if;

  if requested_handle is distinct from current_handle then
    update public.profiles
    set handle = requested_handle,
        updated_at = now()
    where id = caller_profile_id
      and user_id = caller_user_id;
  end if;

  insert into public.story_profiles as sp (
    owner_user_id, owner_profile_id, handle, display_name, role_label, bio, area,
    avatar_url, avatar_storage_path, banner_storage_path, portfolio_items, theme_key,
    website_label, website_url, shop_label, shop_url, sns_links, tags, status_label, pickup_text,
    publication_status, published_at
  ) values (
    caller_user_id, caller_profile_id, requested_handle, trim(p_display_name), trim(p_role_label),
    trim(p_bio), trim(p_area), nullif(trim(p_avatar_url), ''), nullif(trim(p_avatar_storage_path), ''),
    nullif(trim(p_banner_storage_path), ''), coalesce(p_portfolio_items, '[]'::jsonb), p_theme_key,
    coalesce(nullif(trim(p_website_label), ''), 'Webサイト'), nullif(trim(p_website_url), ''),
    coalesce(nullif(trim(p_shop_label), ''), 'ショップ'), nullif(trim(p_shop_url), ''),
    coalesce(p_sns_links, '[]'::jsonb), coalesce(p_tags, '{}'::text[]),
    trim(p_status_label), trim(p_pickup_text), p_publication_status,
    case when p_publication_status = 'published' then now() else null end
  )
  on conflict (owner_profile_id) do update set
    handle = excluded.handle, display_name = excluded.display_name, role_label = excluded.role_label,
    bio = excluded.bio, area = excluded.area, avatar_url = excluded.avatar_url,
    avatar_storage_path = excluded.avatar_storage_path, banner_storage_path = excluded.banner_storage_path,
    portfolio_items = excluded.portfolio_items, theme_key = excluded.theme_key,
    website_label = excluded.website_label, website_url = excluded.website_url,
    shop_label = excluded.shop_label, shop_url = excluded.shop_url, sns_links = excluded.sns_links,
    tags = excluded.tags, status_label = excluded.status_label, pickup_text = excluded.pickup_text,
    publication_status = excluded.publication_status,
    published_at = case when excluded.publication_status = 'published' then coalesce(sp.published_at, now()) else null end,
    updated_at = now()
  where sp.owner_user_id = caller_user_id;

  return query
  select sp.handle, sp.display_name, sp.role_label, sp.bio, sp.area,
    sp.avatar_url, sp.avatar_storage_path, sp.banner_storage_path,
    sp.portfolio_items, sp.theme_key,
    sp.website_label, sp.website_url, sp.shop_label, sp.shop_url,
    sp.sns_links, sp.tags, sp.status_label, sp.pickup_text,
    sp.publication_status, sp.published_at, sp.created_at, sp.updated_at
  from public.story_profiles sp
  where sp.owner_user_id = caller_user_id
  limit 1;
end;
$$;

revoke all on function public.story_profile_save_mine(
  text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, jsonb, text[], text, text, text
) from public, anon;
grant execute on function public.story_profile_save_mine(
  text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, jsonb, text[], text, text, text
) to authenticated, service_role;

create table if not exists public.story_collections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  saved_story_profile_id uuid not null references public.story_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint story_collections_owner_saved_unique unique (owner_profile_id, saved_story_profile_id)
);

comment on table public.story_collections is
  'Private STORY name-card collection. Only the collector can read membership; saved owners are never notified or exposed.';

create index if not exists story_collections_owner_user_id_idx on public.story_collections (owner_user_id);
create index if not exists story_collections_saved_story_profile_id_idx on public.story_collections (saved_story_profile_id);

alter table public.story_collections enable row level security;

revoke all on table public.story_collections from public, anon, authenticated;
grant select, insert, update, delete on table public.story_collections to service_role;

drop policy if exists story_collections_select_owner on public.story_collections;
drop policy if exists story_collections_insert_owner on public.story_collections;
drop policy if exists story_collections_delete_owner on public.story_collections;

create policy story_collections_select_owner
on public.story_collections for select to authenticated
using ((select auth.uid()) = owner_user_id);

create policy story_collections_insert_owner
on public.story_collections for insert to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.profiles p
    where p.id = owner_profile_id and p.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.story_profiles target
    where target.id = saved_story_profile_id
      and target.publication_status = 'published'
      and target.owner_user_id <> (select auth.uid())
  )
);

create policy story_collections_delete_owner
on public.story_collections for delete to authenticated
using ((select auth.uid()) = owner_user_id);

create or replace function public.story_collection_get_state(p_handle text)
returns table (viewer_has_story boolean, is_own_story boolean, is_saved boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  viewer_story_id uuid;
  target_story_id uuid;
  target_owner_user_id uuid;
  normalized_handle text := lower(trim(regexp_replace(coalesce(p_handle, ''), '^@', '')));
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select sp.id into viewer_story_id
  from public.story_profiles sp
  where sp.owner_user_id = caller_user_id
  limit 1;

  select sp.id, sp.owner_user_id into target_story_id, target_owner_user_id
  from public.story_profiles sp
  where lower(sp.handle) = normalized_handle
    and sp.publication_status = 'published'
  limit 1;

  return query select
    viewer_story_id is not null,
    target_owner_user_id = caller_user_id,
    viewer_story_id is not null and target_story_id is not null and exists (
      select 1 from public.story_collections sc
      where sc.owner_user_id = caller_user_id
        and sc.saved_story_profile_id = target_story_id
    );
end;
$$;

create or replace function public.story_collection_save(p_handle text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  caller_profile_id uuid;
  target_story_id uuid;
  target_owner_user_id uuid;
  saved_id uuid;
  normalized_handle text := lower(trim(regexp_replace(coalesce(p_handle, ''), '^@', '')));
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select sp.owner_profile_id into caller_profile_id
  from public.story_profiles sp
  where sp.owner_user_id = caller_user_id
  limit 1;
  if caller_profile_id is null then
    raise exception 'Create your STORY before saving a collection.' using errcode = 'P0002';
  end if;

  select sp.id, sp.owner_user_id into target_story_id, target_owner_user_id
  from public.story_profiles sp
  where lower(sp.handle) = normalized_handle
    and sp.publication_status = 'published'
  limit 1;
  if target_story_id is null then
    raise exception 'Published STORY was not found.' using errcode = 'P0002';
  end if;
  if target_owner_user_id = caller_user_id then
    raise exception 'Your own STORY cannot be saved to your collection.' using errcode = '22023';
  end if;

  insert into public.story_collections (owner_user_id, owner_profile_id, saved_story_profile_id)
  values (caller_user_id, caller_profile_id, target_story_id)
  on conflict (owner_profile_id, saved_story_profile_id) do update
    set owner_user_id = excluded.owner_user_id
  returning id into saved_id;

  return saved_id;
end;
$$;

create or replace function public.story_collection_remove(p_collection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  delete from public.story_collections
  where id = p_collection_id and owner_user_id = caller_user_id;
end;
$$;

create or replace function public.story_collection_remove_by_handle(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  normalized_handle text := lower(trim(regexp_replace(coalesce(p_handle, ''), '^@', '')));
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  delete from public.story_collections sc
  using public.story_profiles sp
  where sc.saved_story_profile_id = sp.id
    and sc.owner_user_id = caller_user_id
    and lower(sp.handle) = normalized_handle;
end;
$$;

create or replace function public.story_collection_list_mine()
returns table (
  collection_id uuid,
  saved_at timestamptz,
  available boolean,
  handle text,
  display_name text,
  role_label text,
  avatar_storage_path text,
  theme_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  return query
  select
    sc.id,
    sc.created_at,
    sp.publication_status = 'published',
    case when sp.publication_status = 'published' then sp.handle else null end,
    case when sp.publication_status = 'published' then sp.display_name else null end,
    case when sp.publication_status = 'published' then sp.role_label else null end,
    case when sp.publication_status = 'published' then sp.avatar_storage_path else null end,
    case when sp.publication_status = 'published' then sp.theme_key else null end
  from public.story_collections sc
  join public.story_profiles sp on sp.id = sc.saved_story_profile_id
  where sc.owner_user_id = caller_user_id
  order by sc.created_at desc;
end;
$$;

revoke all on function public.story_collection_get_state(text) from public, anon;
revoke all on function public.story_collection_save(text) from public, anon;
revoke all on function public.story_collection_remove(uuid) from public, anon;
revoke all on function public.story_collection_remove_by_handle(text) from public, anon;
revoke all on function public.story_collection_list_mine() from public, anon;

grant execute on function public.story_collection_get_state(text) to authenticated, service_role;
grant execute on function public.story_collection_save(text) to authenticated, service_role;
grant execute on function public.story_collection_remove(uuid) to authenticated, service_role;
grant execute on function public.story_collection_remove_by_handle(text) to authenticated, service_role;
grant execute on function public.story_collection_list_mine() to authenticated, service_role;

notify pgrst, 'reload schema';
