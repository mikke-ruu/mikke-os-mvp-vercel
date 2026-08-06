create table if not exists public.story_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  handle text not null,
  display_name text not null,
  role_label text not null default '',
  bio text not null default '',
  area text not null default '',
  avatar_url text,
  avatar_storage_path text,
  website_url text,
  shop_url text,
  sns_links jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  status_label text not null default '',
  pickup_text text not null default '',
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_profiles_handle_format check (handle ~ '^[a-z0-9][a-z0-9_-]{2,39}$'),
  constraint story_profiles_reserved_handle check (
    handle <> all (array[
      'admin', 'administrator', 'api', 'app', 'apps', 'auth', 'dashboard', 'edit', 'help', 'home',
      'login', 'logout', 'manager', 'member', 'members', 'mikke', 'mikke-id', 'mikke-os', 'mikkeos',
      'mikkeruu', 'new', 'official', 'owner', 'preview', 'profile', 'root', 'settings', 'staff', 'start',
      'story', 'support', 'system'
    ])
    and handle not like 'admin-%'
    and handle not like 'api-%'
    and handle not like 'mikke-%'
    and handle not like 'mikkeos-%'
    and handle not like 'mikkeruu-%'
    and handle not like 'official-%'
    and handle not like 'system-%'
  ),
  constraint story_profiles_published_required_fields check (
    publication_status = 'draft'
    or (
      length(trim(display_name)) > 0
      and (length(trim(role_label)) > 0 or length(trim(bio)) > 0)
    )
  ),
  constraint story_profiles_sns_links_array check (jsonb_typeof(sns_links) = 'array')
);

comment on table public.story_profiles is
  'STORY owner records with a column-restricted public projection. Owner IDs must never be selected by public clients.';
comment on column public.story_profiles.owner_user_id is
  'Owner auth user used only by RLS and the authenticated owner RPC.';
comment on column public.story_profiles.owner_profile_id is
  'Owner profile reference used only for ownership enforcement and upsert conflict handling.';

create unique index if not exists story_profiles_owner_profile_id_key on public.story_profiles (owner_profile_id);
create unique index if not exists story_profiles_handle_lower_key on public.story_profiles (lower(handle));
create index if not exists story_profiles_owner_user_id_idx on public.story_profiles (owner_user_id);
create index if not exists story_profiles_publication_handle_idx on public.story_profiles (publication_status, lower(handle));

create or replace function public.set_story_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.publication_status = 'published' and new.published_at is null then
    new.published_at = now();
  elsif new.publication_status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

revoke all on function public.set_story_profiles_updated_at() from public, anon, authenticated;
grant execute on function public.set_story_profiles_updated_at() to postgres, service_role;

drop trigger if exists set_story_profiles_updated_at on public.story_profiles;
create trigger set_story_profiles_updated_at
before insert or update on public.story_profiles
for each row execute function public.set_story_profiles_updated_at();

alter table public.story_profiles enable row level security;

revoke all on table public.story_profiles from anon, authenticated;
grant select (
  handle, display_name, role_label, bio, area, avatar_url, avatar_storage_path, website_url, shop_url,
  sns_links, tags, status_label, pickup_text, publication_status, published_at, created_at, updated_at
) on table public.story_profiles to anon, authenticated;
grant insert, update, delete on table public.story_profiles to authenticated;
grant select, insert, update, delete on table public.story_profiles to service_role;

drop policy if exists story_profiles_select_published on public.story_profiles;
drop policy if exists story_profiles_select_owner on public.story_profiles;
drop policy if exists story_profiles_select_visible on public.story_profiles;
drop policy if exists story_profiles_insert_owner on public.story_profiles;
drop policy if exists story_profiles_update_owner on public.story_profiles;
drop policy if exists story_profiles_delete_owner on public.story_profiles;

create policy story_profiles_select_visible
on public.story_profiles for select to anon, authenticated
using (publication_status = 'published' or (select auth.uid()) = owner_user_id);

create policy story_profiles_insert_owner
on public.story_profiles for insert to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.profiles p
    where p.id = owner_profile_id and p.user_id = (select auth.uid())
  )
);

create policy story_profiles_update_owner
on public.story_profiles for update to authenticated
using ((select auth.uid()) = owner_user_id)
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.profiles p
    where p.id = owner_profile_id and p.user_id = (select auth.uid())
  )
);

create policy story_profiles_delete_owner
on public.story_profiles for delete to authenticated
using ((select auth.uid()) = owner_user_id);

create or replace function public.story_profile_get_mine()
returns table (
  handle text,
  display_name text,
  role_label text,
  bio text,
  area text,
  avatar_url text,
  avatar_storage_path text,
  website_url text,
  shop_url text,
  sns_links jsonb,
  tags text[],
  status_label text,
  pickup_text text,
  publication_status text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sp.handle, sp.display_name, sp.role_label, sp.bio, sp.area, sp.avatar_url, sp.avatar_storage_path,
    sp.website_url, sp.shop_url, sp.sns_links, sp.tags, sp.status_label, sp.pickup_text,
    sp.publication_status, sp.published_at, sp.created_at, sp.updated_at
  from public.story_profiles sp
  where sp.owner_user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.story_profile_get_mine() from public, anon;
grant execute on function public.story_profile_get_mine() to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-public', 'story-public', false, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists story_public_objects_select_owner on storage.objects;
drop policy if exists story_public_objects_insert_owner on storage.objects;
drop policy if exists story_public_objects_update_owner on storage.objects;
drop policy if exists story_public_objects_delete_owner on storage.objects;

create policy story_public_objects_select_owner
on storage.objects for select to authenticated
using (bucket_id = 'story-public' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy story_public_objects_insert_owner
on storage.objects for insert to authenticated
with check (bucket_id = 'story-public' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy story_public_objects_update_owner
on storage.objects for update to authenticated
using (bucket_id = 'story-public' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'story-public' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy story_public_objects_delete_owner
on storage.objects for delete to authenticated
using (bucket_id = 'story-public' and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload schema';
