-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-homepage-preparation.local.sql
-- LOCAL CANDIDATE ONLY: no production migration/history or automatic application.
-- Canonical editor projection is reused; this never saves or publishes a homepage.
begin;
create table academy2_access.homepage_preparation_reviews(
 headquarters_id uuid primary key references academy2_access.tenants(headquarters_id),
 reviewed_revision integer not null check(reviewed_revision>=0),
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.homepage_preparation_reviews enable row level security;
revoke all on academy2_access.homepage_preparation_reviews from public,anon,authenticated,service_role;
create function academy2_access.homepage_preparation(p_hq uuid,p_expected integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); doc jsonb; current_revision integer; reviewed_revision integer;
begin
 if actor is null or not academy2_access.can(p_hq,'pages.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_expected is not null then
  if p_expected<0 then raise exception 'invalid_revision' using errcode='22023';end if;
  -- Same parent-row lock as the existing homepage save/publish contract.
  perform 1 from public.academy_headquarters where id=p_hq for update;
  if not found then raise exception 'academy2_forbidden' using errcode='42501';end if;
 end if;
 doc:=public.academy2_homepage_editor(p_hq);
 if jsonb_typeof(doc->'homepage_revision') is distinct from 'number'
 or (doc->>'homepage_revision')!~'^[0-9]+$'
 or jsonb_typeof(doc->'publicly_available') is distinct from 'boolean' then
  raise exception 'homepage_state_unavailable' using errcode='22023';
 end if;
 current_revision:=(doc->>'homepage_revision')::integer;
 if p_expected is not null then
  if p_expected<>current_revision then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
  if nullif(btrim(doc->>'name'),'') is null or nullif(btrim(doc->>'handle'),'') is null
   or jsonb_typeof(doc->'front_blocks') is distinct from 'array' then
   raise exception 'homepage_not_ready' using errcode='22023';end if;
  insert into academy2_access.homepage_preparation_reviews(headquarters_id,reviewed_revision,reviewed_by)
   values(p_hq,current_revision,actor)
   on conflict(headquarters_id) do update set reviewed_revision=excluded.reviewed_revision,reviewed_by=excluded.reviewed_by,reviewed_at=clock_timestamp();
  insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,actor,'homepage.preparation.reviewed',p_hq);
 end if;
 select r.reviewed_revision into reviewed_revision from academy2_access.homepage_preparation_reviews r where r.headquarters_id=p_hq;
 return jsonb_build_object('reviewed',coalesce(reviewed_revision=current_revision,false),'reviewedRevision',reviewed_revision,'currentRevision',current_revision,'publiclyAvailable',(doc->>'publicly_available')::boolean);
end $$;
create function public.academy2_homepage_preparation(p_hq uuid,p_expected integer default null) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.homepage_preparation(p_hq,p_expected)$$;
revoke all on function academy2_access.homepage_preparation(uuid,integer),public.academy2_homepage_preparation(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function academy2_access.homepage_preparation(uuid,integer),public.academy2_homepage_preparation(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
-- Limited rollback: remove feature entry points first; retain review rows and homepage data.
