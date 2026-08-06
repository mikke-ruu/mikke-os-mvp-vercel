alter table public.story_profiles
  add column if not exists banner_storage_path text,
  add column if not exists portfolio_items jsonb not null default '[]'::jsonb,
  add column if not exists theme_key text not null default 'indigo';

alter table public.story_profiles
  drop constraint if exists story_profiles_portfolio_items_array,
  drop constraint if exists story_profiles_portfolio_items_limit,
  drop constraint if exists story_profiles_theme_key;

alter table public.story_profiles
  add constraint story_profiles_portfolio_items_array check (jsonb_typeof(portfolio_items) = 'array'),
  add constraint story_profiles_portfolio_items_limit check (jsonb_array_length(portfolio_items) <= 5),
  add constraint story_profiles_theme_key check (theme_key in ('indigo', 'rose', 'sage', 'sun', 'ink'));

revoke all on table public.story_profiles from anon, authenticated;
grant select (
  handle, display_name, role_label, bio, area, avatar_url, avatar_storage_path, banner_storage_path,
  portfolio_items, theme_key, website_url, shop_url, sns_links, tags, status_label, pickup_text,
  publication_status, published_at, created_at, updated_at
) on table public.story_profiles to anon, authenticated;
grant insert, update, delete on table public.story_profiles to authenticated;

drop function if exists public.story_profile_get_mine();
create function public.story_profile_get_mine()
returns table (
  handle text, display_name text, role_label text, bio text, area text,
  avatar_url text, avatar_storage_path text, banner_storage_path text,
  portfolio_items jsonb, theme_key text, website_url text, shop_url text,
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
    sp.portfolio_items, sp.theme_key, sp.website_url, sp.shop_url,
    sp.sns_links, sp.tags, sp.status_label, sp.pickup_text,
    sp.publication_status, sp.published_at, sp.created_at, sp.updated_at
  from public.story_profiles sp
  where sp.owner_user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.story_profile_get_mine() from public, anon;
grant execute on function public.story_profile_get_mine() to authenticated, service_role;

drop function if exists public.story_profile_save_mine(
  text, text, text, text, text, text, text, text, jsonb, text[], text, text, text
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
  p_theme_key text default 'indigo',
  p_website_url text default null,
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
  portfolio_items jsonb, theme_key text, website_url text, shop_url text,
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
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_publication_status not in ('draft', 'published') then
    raise exception 'Invalid publication status.' using errcode = '22023';
  end if;
  if p_theme_key not in ('indigo', 'rose', 'sage', 'sun', 'ink') then
    raise exception 'Invalid theme.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_portfolio_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_portfolio_items, '[]'::jsonb)) > 5 then
    raise exception 'Portfolio must be an array of at most five items.' using errcode = '22023';
  end if;

  select p.id into caller_profile_id
  from public.profiles p
  where p.user_id = caller_user_id
  order by p.created_at asc
  limit 1;
  if caller_profile_id is null then
    raise exception 'Profile not found for authenticated user.' using errcode = 'P0002';
  end if;

  insert into public.story_profiles as sp (
    owner_user_id, owner_profile_id, handle, display_name, role_label, bio, area,
    avatar_url, avatar_storage_path, banner_storage_path, portfolio_items, theme_key,
    website_url, shop_url, sns_links, tags, status_label, pickup_text,
    publication_status, published_at
  ) values (
    caller_user_id, caller_profile_id, p_handle, trim(p_display_name), trim(p_role_label),
    trim(p_bio), trim(p_area), nullif(trim(p_avatar_url), ''), nullif(trim(p_avatar_storage_path), ''),
    nullif(trim(p_banner_storage_path), ''), coalesce(p_portfolio_items, '[]'::jsonb), p_theme_key,
    nullif(trim(p_website_url), ''), nullif(trim(p_shop_url), ''), coalesce(p_sns_links, '[]'::jsonb),
    coalesce(p_tags, '{}'::text[]), trim(p_status_label), trim(p_pickup_text), p_publication_status,
    case when p_publication_status = 'published' then now() else null end
  )
  on conflict (owner_profile_id) do update set
    handle = excluded.handle, display_name = excluded.display_name, role_label = excluded.role_label,
    bio = excluded.bio, area = excluded.area, avatar_url = excluded.avatar_url,
    avatar_storage_path = excluded.avatar_storage_path, banner_storage_path = excluded.banner_storage_path,
    portfolio_items = excluded.portfolio_items, theme_key = excluded.theme_key,
    website_url = excluded.website_url, shop_url = excluded.shop_url, sns_links = excluded.sns_links,
    tags = excluded.tags, status_label = excluded.status_label, pickup_text = excluded.pickup_text,
    publication_status = excluded.publication_status,
    published_at = case when excluded.publication_status = 'published' then coalesce(sp.published_at, now()) else null end,
    updated_at = now()
  where sp.owner_user_id = caller_user_id;

  return query
  select sp.handle, sp.display_name, sp.role_label, sp.bio, sp.area,
    sp.avatar_url, sp.avatar_storage_path, sp.banner_storage_path,
    sp.portfolio_items, sp.theme_key, sp.website_url, sp.shop_url,
    sp.sns_links, sp.tags, sp.status_label, sp.pickup_text,
    sp.publication_status, sp.published_at, sp.created_at, sp.updated_at
  from public.story_profiles sp
  where sp.owner_user_id = caller_user_id
  limit 1;
end;
$$;

revoke all on function public.story_profile_save_mine(
  text, text, text, text, text, text, text, text, jsonb, text, text, text, jsonb, text[], text, text, text
) from public, anon;
grant execute on function public.story_profile_save_mine(
  text, text, text, text, text, text, text, text, jsonb, text, text, text, jsonb, text[], text, text, text
) to authenticated, service_role;

drop policy if exists story_public_objects_select_published on storage.objects;
create policy story_public_objects_select_published
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'story-public'
  and exists (
    select 1
    from public.story_profiles sp
    where sp.publication_status = 'published'
      and (
        sp.avatar_storage_path = name
        or sp.banner_storage_path = name
        or exists (
          select 1 from jsonb_array_elements(sp.portfolio_items) item
          where item->>'storage_path' = name
        )
      )
  )
);

notify pgrst, 'reload schema';
