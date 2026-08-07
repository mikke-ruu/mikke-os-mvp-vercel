create or replace function public.story_media_paths_valid(
  owner_user_id uuid,
  avatar_path text,
  banner_path text,
  portfolio jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    (avatar_path is null or avatar_path like owner_user_id::text || '/avatar/%')
    and (banner_path is null or banner_path like owner_user_id::text || '/banner/%')
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(portfolio, '[]'::jsonb)) item
      where item->>'source' <> 'upload'
        or item->>'storage_path' is null
        or item->>'storage_path' not like owner_user_id::text || '/portfolio/%'
    );
$$;

revoke all on function public.story_media_paths_valid(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.story_media_paths_valid(uuid, text, text, jsonb) to postgres, service_role;

alter table public.story_profiles
  drop constraint if exists story_profiles_media_paths_owner,
  add constraint story_profiles_media_paths_owner check (
    public.story_media_paths_valid(owner_user_id, avatar_storage_path, banner_storage_path, portfolio_items)
  );

notify pgrst, 'reload schema';
