-- Mikke Media lifecycle: usage references and safe deletion.

create or replace function private.sync_mikke_media_usages(
  p_app_key text,
  p_entity_type text,
  p_entity_id text,
  p_asset_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'MIKKE_MEDIA_AUTH_REQUIRED'; end if;
  if p_app_key !~ '^[a-z0-9-]{1,50}$'
    or p_entity_type !~ '^[a-z0-9_-]{1,50}$'
    or length(p_entity_id) < 1 or length(p_entity_id) > 200 then
    raise exception 'MIKKE_MEDIA_INVALID_USAGE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));

  if exists (
    select requested.id
    from unnest(coalesce(p_asset_ids, array[]::uuid[])) requested(id)
    left join public.mikke_media_assets asset
      on asset.id = requested.id and asset.owner_id = v_owner and asset.status = 'active'
    where asset.id is null
  ) then
    raise exception 'MIKKE_MEDIA_ASSET_NOT_AVAILABLE';
  end if;

  delete from public.mikke_media_usages
  where owner_id = v_owner
    and app_key = p_app_key
    and entity_type = p_entity_type
    and entity_id = p_entity_id;

  insert into public.mikke_media_usages (asset_id, owner_id, app_key, entity_type, entity_id, field_key)
  select distinct asset_id, v_owner, p_app_key, p_entity_type, p_entity_id, 'document'
  from unnest(coalesce(p_asset_ids, array[]::uuid[])) asset_id;
end;
$$;

create or replace function private.trash_mikke_media_asset(p_asset_id uuid)
returns public.mikke_media_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_asset public.mikke_media_assets;
begin
  if v_owner is null then raise exception 'MIKKE_MEDIA_AUTH_REQUIRED'; end if;
  if exists (
    select 1 from public.mikke_media_usages
    where asset_id = p_asset_id and owner_id = v_owner
  ) then
    raise exception 'MIKKE_MEDIA_ASSET_IN_USE';
  end if;

  update public.mikke_media_assets
  set status = 'trashed', trashed_at = now(), updated_at = now()
  where id = p_asset_id and owner_id = v_owner and status = 'active'
  returning * into v_asset;
  if v_asset.id is null then raise exception 'MIKKE_MEDIA_ASSET_NOT_AVAILABLE'; end if;
  return v_asset;
end;
$$;

create or replace function private.restore_mikke_media_asset(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'MIKKE_MEDIA_AUTH_REQUIRED'; end if;
  update public.mikke_media_assets
  set status = 'active', trashed_at = null, updated_at = now()
  where id = p_asset_id and owner_id = v_owner and status = 'trashed';
end;
$$;

create or replace function private.purge_mikke_media_asset_record(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_path text;
begin
  if v_owner is null then raise exception 'MIKKE_MEDIA_AUTH_REQUIRED'; end if;
  select storage_path into v_path
  from public.mikke_media_assets
  where id = p_asset_id and owner_id = v_owner and status = 'trashed';
  if v_path is null then raise exception 'MIKKE_MEDIA_ASSET_NOT_AVAILABLE'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'mikke-media' and name = v_path) then
    raise exception 'MIKKE_MEDIA_OBJECT_STILL_EXISTS';
  end if;
  delete from public.mikke_media_assets where id = p_asset_id and owner_id = v_owner;
end;
$$;

create or replace function public.sync_mikke_media_usages(
  p_app_key text,
  p_entity_type text,
  p_entity_id text,
  p_asset_ids uuid[]
) returns void
language sql security invoker set search_path = ''
as $$ select private.sync_mikke_media_usages(p_app_key, p_entity_type, p_entity_id, p_asset_ids); $$;

create or replace function public.trash_mikke_media_asset(p_asset_id uuid)
returns public.mikke_media_assets
language sql security invoker set search_path = ''
as $$ select private.trash_mikke_media_asset(p_asset_id); $$;

create or replace function public.restore_mikke_media_asset(p_asset_id uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.restore_mikke_media_asset(p_asset_id); $$;

create or replace function public.purge_mikke_media_asset_record(p_asset_id uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.purge_mikke_media_asset_record(p_asset_id); $$;

revoke all on function private.sync_mikke_media_usages(text, text, text, uuid[]) from public, anon;
revoke all on function private.trash_mikke_media_asset(uuid) from public, anon;
revoke all on function private.restore_mikke_media_asset(uuid) from public, anon;
revoke all on function private.purge_mikke_media_asset_record(uuid) from public, anon;
grant execute on function private.sync_mikke_media_usages(text, text, text, uuid[]) to authenticated;
grant execute on function private.trash_mikke_media_asset(uuid) to authenticated;
grant execute on function private.restore_mikke_media_asset(uuid) to authenticated;
grant execute on function private.purge_mikke_media_asset_record(uuid) to authenticated;

revoke all on function public.sync_mikke_media_usages(text, text, text, uuid[]) from public, anon;
revoke all on function public.trash_mikke_media_asset(uuid) from public, anon;
revoke all on function public.restore_mikke_media_asset(uuid) from public, anon;
revoke all on function public.purge_mikke_media_asset_record(uuid) from public, anon;
grant execute on function public.sync_mikke_media_usages(text, text, text, uuid[]) to authenticated;
grant execute on function public.trash_mikke_media_asset(uuid) to authenticated;
grant execute on function public.restore_mikke_media_asset(uuid) to authenticated;
grant execute on function public.purge_mikke_media_asset_record(uuid) to authenticated;
