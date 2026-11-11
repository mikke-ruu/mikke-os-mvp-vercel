-- Keep legacy upload-error cleanup from deleting the pending reservation.
-- Existing clients may still call cancel after an ambiguous upload/finalize.
begin;
do $$begin
 if md5(replace(pg_get_functiondef('private.cancel_mikke_media_reservation(uuid)'::regprocedure),chr(13),''))<>'b8db851d7b1c71c757c2b6d1b7abd098' then
  raise exception 'media_cancel_definition_changed';
 end if;
 if (select pg_get_userbyid(proowner) from pg_proc where oid='private.cancel_mikke_media_reservation(uuid)'::regprocedure) is distinct from 'postgres'
 or (select proacl::text from pg_proc where oid='private.cancel_mikke_media_reservation(uuid)'::regprocedure) is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then
  raise exception 'media_cancel_owner_or_acl_changed';
 end if;
end$$;
create or replace function private.cancel_mikke_media_reservation(p_asset_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'MIKKE_MEDIA_AUTH_REQUIRED';end if;
 -- Do not infer that Storage is absent from an upload response failure.
 -- A concurrent upload can still complete. Preserve metadata in every case.
 raise exception 'MIKKE_MEDIA_RESERVATION_MUST_BE_RESUMED' using errcode='55000';
end;
$$;
-- CREATE OR REPLACE preserves the wrapper, owner and existing ACL.
commit;
