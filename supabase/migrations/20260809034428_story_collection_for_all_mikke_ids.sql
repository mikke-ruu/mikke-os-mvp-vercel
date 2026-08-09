-- A private STORY collection belongs to a mikke ID profile, not to a published STORY.
-- Keep the existing RPC signatures so deployed clients remain compatible.

create or replace function public.story_collection_get_state(p_handle text)
returns table (viewer_has_story boolean, is_own_story boolean, is_saved boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  caller_profile_id uuid;
  target_story_id uuid;
  target_owner_user_id uuid;
  normalized_handle text := lower(trim(regexp_replace(coalesce(p_handle, ''), '^@', '')));
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.id into caller_profile_id
  from public.profiles p
  where p.user_id = caller_user_id
  limit 1;

  select sp.id, sp.owner_user_id into target_story_id, target_owner_user_id
  from public.story_profiles sp
  where lower(sp.handle) = normalized_handle
    and sp.publication_status = 'published'
  limit 1;

  return query select
    caller_profile_id is not null,
    target_owner_user_id = caller_user_id,
    caller_profile_id is not null and target_story_id is not null and exists (
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

  select p.id into caller_profile_id
  from public.profiles p
  where p.user_id = caller_user_id
  limit 1;
  if caller_profile_id is null then
    raise exception 'A mikke ID profile is required before saving a collection.' using errcode = 'P0002';
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

revoke all on function public.story_collection_get_state(text) from public, anon;
revoke all on function public.story_collection_save(text) from public, anon;
grant execute on function public.story_collection_get_state(text) to authenticated, service_role;
grant execute on function public.story_collection_save(text) to authenticated, service_role;

comment on function public.story_collection_save(text) is
  'Saves a published STORY to the authenticated mikke ID profile private collection. Owning a STORY is not required.';
