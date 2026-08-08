alter table public.story_collections
  add column if not exists is_favorite boolean not null default false,
  add column if not exists favorited_at timestamptz;

comment on column public.story_collections.is_favorite is
  'Private favorite marker visible only to the collection owner.';

create index if not exists story_collections_owner_favorite_idx
  on public.story_collections (owner_user_id, is_favorite desc, favorited_at desc, created_at desc);

create or replace function public.story_collection_set_favorite(
  p_collection_id uuid,
  p_is_favorite boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  updated_favorite boolean;
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.story_collections
  set
    is_favorite = coalesce(p_is_favorite, false),
    favorited_at = case when coalesce(p_is_favorite, false) then now() else null end
  where id = p_collection_id
    and owner_user_id = caller_user_id
  returning is_favorite into updated_favorite;

  if updated_favorite is null then
    raise exception 'Collection item was not found.' using errcode = 'P0002';
  end if;

  return updated_favorite;
end;
$$;

drop function if exists public.story_collection_list_mine();

create function public.story_collection_list_mine()
returns table (
  collection_id uuid,
  saved_at timestamptz,
  is_favorite boolean,
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
    sc.is_favorite,
    sp.publication_status = 'published',
    case when sp.publication_status = 'published' then sp.handle else null end,
    case when sp.publication_status = 'published' then sp.display_name else null end,
    case when sp.publication_status = 'published' then sp.role_label else null end,
    case when sp.publication_status = 'published' then sp.avatar_storage_path else null end,
    case when sp.publication_status = 'published' then sp.theme_key else null end
  from public.story_collections sc
  join public.story_profiles sp on sp.id = sc.saved_story_profile_id
  where sc.owner_user_id = caller_user_id
  order by sc.is_favorite desc, sc.favorited_at desc nulls last, sc.created_at desc;
end;
$$;

revoke all on function public.story_collection_set_favorite(uuid, boolean) from public, anon, authenticated;
revoke all on function public.story_collection_list_mine() from public, anon, authenticated;

grant execute on function public.story_collection_set_favorite(uuid, boolean) to authenticated, service_role;
grant execute on function public.story_collection_list_mine() to authenticated, service_role;

notify pgrst, 'reload schema';
