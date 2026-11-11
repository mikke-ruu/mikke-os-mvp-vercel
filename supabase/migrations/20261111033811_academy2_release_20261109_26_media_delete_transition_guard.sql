-- Permanent deletion has no restore UI. Legacy clients must not resurrect an
-- object whose Storage deletion may already have committed.
begin;
do $$begin
 if md5(replace(pg_get_functiondef('private.restore_mikke_media_asset(uuid)'::regprocedure),chr(13),''))<>'01dc79186046316a751a5147021a0238' then raise exception 'media_restore_definition_changed';end if;
 if md5(replace(pg_get_functiondef('private.purge_mikke_media_asset_record(uuid)'::regprocedure),chr(13),''))<>'d54287ac28cbfd8c2c421da1fb051f9f' then raise exception 'media_purge_definition_changed';end if;
end$$;
create or replace function private.restore_mikke_media_asset(p_asset_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'MIKKE_MEDIA_AUTH_REQUIRED';end if;
 raise exception 'MIKKE_MEDIA_DELETE_MUST_BE_RESUMED' using errcode='55000';
end;
$$;
create or replace function private.purge_mikke_media_asset_record(p_asset_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_path text;
begin
 if v_owner is null then raise exception 'MIKKE_MEDIA_AUTH_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text,0));
 select storage_path into v_path from public.mikke_media_assets
 where id=p_asset_id and owner_id=v_owner and status='trashed' for update;
 if v_path is null then raise exception 'MIKKE_MEDIA_ASSET_NOT_AVAILABLE';end if;
 if exists(select 1 from storage.objects where bucket_id='mikke-media' and name=v_path) then
  raise exception 'MIKKE_MEDIA_OBJECT_STILL_EXISTS';
 end if;
 delete from public.mikke_media_assets where id=p_asset_id and owner_id=v_owner and status='trashed';
 if not found then raise exception 'MIKKE_MEDIA_ASSET_NOT_AVAILABLE';end if;
end;
$$;
-- CREATE OR REPLACE retains the existing owner and ACL; no new access grant.
commit;
