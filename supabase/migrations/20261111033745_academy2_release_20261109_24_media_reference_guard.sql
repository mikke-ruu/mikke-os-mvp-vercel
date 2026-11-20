-- Release candidate. Protect current drafts, public snapshots and purchased snapshots.
-- Existing shared usage checks and all other bucket policies remain in force.
begin;
do $$begin
 if md5(replace(pg_get_functiondef('private.trash_mikke_media_asset(uuid)'::regprocedure),chr(13),''))<>'a7888464c3eb86f2d4ba771934ab5d20' then raise exception 'shared_media_trash_definition_changed';end if;
end$$;
lock table storage.objects,public.mikke_media_assets,public.academy_courses,public.academy_headquarters,public.academy_offerings,public.academy_offering_applications,academy2_access.sales_plan_drafts,academy2_access.sales_pages,academy2_access.homepage_documents,academy2_access.information_page_publications,academy2_access.guest_applications in share row exclusive mode;
create table academy2_access.media_reference_origins(origin text primary key check(origin ~ '^https?://[a-zA-Z0-9.-]+(:[0-9]+)?$'));
insert into academy2_access.media_reference_origins values('https://nttqpprkqbynxyldbnjs.supabase.co');
create table academy2_access.media_asset_references(
 source_kind text not null,source_id text not null,asset_id uuid not null references public.mikke_media_assets(id) on delete restrict,
 owner_id uuid not null references auth.users(id) on delete restrict,
 primary key(source_kind,source_id,asset_id)
);
create index academy_media_references_asset on academy2_access.media_asset_references(asset_id,owner_id);
alter table academy2_access.media_reference_origins enable row level security;
alter table academy2_access.media_asset_references enable row level security;
revoke all on academy2_access.media_reference_origins,academy2_access.media_asset_references from public,anon,authenticated,service_role;

create function academy2_access.sync_media_references(p_kind text,p_id text,p_document jsonb,p_strict boolean default true) returns integer
language plpgsql security definer set search_path='' as $$
declare paths text[];asset_owner uuid;missing integer;
begin
 if p_kind is null or p_id is null then raise exception 'invalid_media_source' using errcode='22023';end if;
 select coalesce(array_agg(distinct split_part(split_part(substring(v.url from length(o.origin||prefix.value)+1),'?',1),'#',1)),'{}') into paths
 from jsonb_path_query(p_document,'$.** ? (@.type() == "string")') as item(value)
 cross join lateral regexp_matches(item.value#>>'{}','https?://[^[:space:]"''<>]+','g') as found(parts)
 cross join lateral (select found.parts[1] as url) v
 cross join academy2_access.media_reference_origins o
 cross join (values('/storage/v1/object/public/mikke-media/'),('/storage/v1/render/image/public/mikke-media/')) prefix(value)
 where left(v.url,length(o.origin||prefix.value))=o.origin||prefix.value;
 -- Serialize against shared sync/trash and direct Storage mutations, in a stable order.
 for asset_owner in select distinct owner_id from (
  select owner_id from academy2_access.media_asset_references where source_kind=p_kind and source_id=p_id
  union all select split_part(value,'/',1)::uuid from unnest(paths) value where split_part(value,'/',1) ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 ) owners order by owner_id loop
  perform pg_advisory_xact_lock(hashtextextended(asset_owner::text,0));
 end loop;
 select count(*) into missing from unnest(paths) value where not exists(select 1 from public.mikke_media_assets a where a.storage_path=value and a.owner_id::text=split_part(value,'/',1) and a.status='active' and exists(select 1 from storage.objects o where o.bucket_id='mikke-media' and o.name=a.storage_path));
 if p_strict and missing>0 then raise exception 'MIKKE_MEDIA_ASSET_NOT_AVAILABLE' using errcode='22023';end if;
 delete from academy2_access.media_asset_references where source_kind=p_kind and source_id=p_id;
 insert into academy2_access.media_asset_references(source_kind,source_id,asset_id,owner_id)
 select p_kind,p_id,a.id,a.owner_id from public.mikke_media_assets a where a.storage_path=any(paths) and a.owner_id::text=split_part(a.storage_path,'/',1) and a.status='active' and exists(select 1 from storage.objects o where o.bucket_id='mikke-media' and o.name=a.storage_path);
 return missing;
end$$;
create function academy2_access.record_media_references() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then perform academy2_access.sync_media_references(tg_argv[0],to_jsonb(old)->>tg_argv[1],'{}');return old;end if;
 if tg_op='UPDATE' and (to_jsonb(old)->>tg_argv[1]) is distinct from (to_jsonb(new)->>tg_argv[1]) then
  perform academy2_access.sync_media_references(tg_argv[0],to_jsonb(old)->>tg_argv[1],'{}');
 end if;
 perform academy2_access.sync_media_references(tg_argv[0],to_jsonb(new)->>tg_argv[1],to_jsonb(new));
 return new;
end$$;
revoke all on function academy2_access.sync_media_references(text,text,jsonb,boolean),academy2_access.record_media_references() from public,anon,authenticated,service_role;

create trigger academy_media_course after insert or update or delete on public.academy_courses for each row execute function academy2_access.record_media_references('course','id');
create trigger academy_media_headquarters after insert or update or delete on public.academy_headquarters for each row execute function academy2_access.record_media_references('headquarters','id');
create trigger academy_media_offering after insert or update or delete on public.academy_offerings for each row execute function academy2_access.record_media_references('offering','id');
create trigger academy_media_member_application after insert or update or delete on public.academy_offering_applications for each row execute function academy2_access.record_media_references('member_application','id');
create trigger academy_media_plan_draft after insert or update or delete on academy2_access.sales_plan_drafts for each row execute function academy2_access.record_media_references('plan_draft','id');
create trigger academy_media_sales_page after insert or update or delete on academy2_access.sales_pages for each row execute function academy2_access.record_media_references('sales_page','plan_id');
create trigger academy_media_homepage after insert or update or delete on academy2_access.homepage_documents for each row execute function academy2_access.record_media_references('homepage','headquarters_id');
create trigger academy_media_publication after insert or update or delete on academy2_access.information_page_publications for each row execute function academy2_access.record_media_references('publication','plan_id');
create trigger academy_media_guest_application after insert or update or delete on academy2_access.guest_applications for each row execute function academy2_access.record_media_references('guest_application','id');

-- Backfill only existing active assets. Report unresolved historical URLs; do not rewrite them.
do $$declare r record;unresolved bigint:=0;begin
 for r in select 'course'::text as kind,id::text as id,to_jsonb(c) as doc from public.academy_courses c
 union all select 'headquarters',id::text,to_jsonb(h) from public.academy_headquarters h
 union all select 'offering',id::text,to_jsonb(o) from public.academy_offerings o
 union all select 'member_application',id::text,to_jsonb(a) from public.academy_offering_applications a
 union all select 'plan_draft',id::text,to_jsonb(p) from academy2_access.sales_plan_drafts p
 union all select 'sales_page',plan_id::text,to_jsonb(p) from academy2_access.sales_pages p
 union all select 'homepage',headquarters_id::text,to_jsonb(h) from academy2_access.homepage_documents h
 union all select 'publication',plan_id::text,to_jsonb(p) from academy2_access.information_page_publications p
 union all select 'guest_application',id::text,to_jsonb(a) from academy2_access.guest_applications a loop
  unresolved:=unresolved+academy2_access.sync_media_references(r.kind,r.id,r.doc,false);
 end loop;
 raise notice 'Academy media unresolved historical references: %',unresolved;
end$$;

do $$declare definition text;marker text:=$m$if v_owner is null then raise exception 'MIKKE_MEDIA_AUTH_REQUIRED'; end if;$m$;addition text:=$a$
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text,0));
  if exists(select 1 from academy2_access.media_asset_references where asset_id=p_asset_id and owner_id=v_owner) then raise exception 'MIKKE_MEDIA_ASSET_IN_USE';end if;
$a$;
begin
 definition:=pg_get_functiondef('private.trash_mikke_media_asset(uuid)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'shared_media_trash_marker_changed';end if;
 execute replace(definition,marker,marker||addition);
end$$;

create function academy2_access.may_mutate_media_object(p_path text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();asset uuid;asset_status text;
begin
 if actor is null or p_path is null or split_part(p_path,'/',1)<>actor::text then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select id,status into asset,asset_status from public.mikke_media_assets where storage_path=p_path and owner_id=actor;
 if asset is null then return true;end if;
 -- Active objects are immutable. Delete only after the guarded trash RPC.
 return asset_status='trashed' and not exists(select 1 from academy2_access.media_asset_references where asset_id=asset)
 and not exists(select 1 from public.mikke_media_usages where asset_id=asset);
end$$;
revoke all on function academy2_access.may_mutate_media_object(text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.may_mutate_media_object(text) to authenticated;
create policy academy_media_references_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'mikke-media' or academy2_access.may_mutate_media_object(name));
create policy academy_media_references_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'mikke-media') with check(bucket_id<>'mikke-media');
notify pgrst,'reload schema';
commit;
