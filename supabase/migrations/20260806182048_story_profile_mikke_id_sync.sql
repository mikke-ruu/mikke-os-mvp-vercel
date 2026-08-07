alter table public.story_profiles
  drop constraint if exists story_profiles_handle_format;

alter table public.story_profiles
  add constraint story_profiles_handle_format check (handle ~ '^[a-z0-9_][a-z0-9_-]{2,29}$');

update public.story_profiles sp
set handle = p.handle,
    updated_at = now()
from public.profiles p
where p.id = sp.owner_profile_id
  and sp.handle is distinct from p.handle;

create or replace function public.story_set_canonical_mikke_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical_handle text;
begin
  select p.handle into canonical_handle
  from public.profiles p
  where p.id = new.owner_profile_id
    and p.user_id = new.owner_user_id;

  if canonical_handle is null then
    raise exception 'Canonical mikke ID profile was not found.' using errcode = 'P0002';
  end if;

  new.handle := canonical_handle;
  return new;
end;
$$;

revoke all on function public.story_set_canonical_mikke_id() from public, anon, authenticated;
grant execute on function public.story_set_canonical_mikke_id() to postgres, service_role;

drop trigger if exists story_set_canonical_mikke_id on public.story_profiles;
create trigger story_set_canonical_mikke_id
before insert or update of handle, owner_profile_id, owner_user_id on public.story_profiles
for each row execute function public.story_set_canonical_mikke_id();

create or replace function public.story_follow_profile_mikke_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.story_profiles
  set handle = new.handle,
      updated_at = now()
  where owner_profile_id = new.id
    and owner_user_id = new.user_id
    and handle is distinct from new.handle;
  return new;
end;
$$;

revoke all on function public.story_follow_profile_mikke_id() from public, anon, authenticated;
grant execute on function public.story_follow_profile_mikke_id() to postgres, service_role;

drop trigger if exists story_follow_profile_mikke_id on public.profiles;
create trigger story_follow_profile_mikke_id
after update of handle on public.profiles
for each row
when (old.handle is distinct from new.handle)
execute function public.story_follow_profile_mikke_id();

create or replace function public.story_profile_save_mine(
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
  current_handle text;
  requested_handle text;
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
    website_url, shop_url, sns_links, tags, status_label, pickup_text,
    publication_status, published_at
  ) values (
    caller_user_id, caller_profile_id, requested_handle, trim(p_display_name), trim(p_role_label),
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

notify pgrst, 'reload schema';
