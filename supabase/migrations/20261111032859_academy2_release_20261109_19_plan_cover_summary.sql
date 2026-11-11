-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-plan-cover-summary.local.sql
-- Local only: use the frozen public cover in public page summaries.
begin;
do $guard$begin
-- Target identity must be verified by the runner before this transaction.
if md5(replace(pg_get_functiondef('academy2_access.public_information_pages(uuid)'::regprocedure),chr(13),''))<>'305476369779ef06a1c18ce55051e1ab' then raise exception 'public_summary_definition_changed';end if;
end$guard$;
CREATE OR REPLACE FUNCTION academy2_access.public_information_pages(p_hq uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('plan_id',p.plan_id,'headquarters_id',p.headquarters_id,
 'title',p.payload->>'title','price',p.payload->'price','currency','JPY',
 'main_image_url',case when p.payload#>>'{cover_image,mode}'='custom' then p.payload#>>'{cover_image,url}' when p.payload#>>'{cover_image,mode}'='none' then null when p.payload#>>'{cover_image,mode}' is null or p.payload#>>'{cover_image,mode}'='auto' then case when jsonb_array_length(p.payload->'courses')=1 then p.payload#>>'{courses,0,main_image_url}' else null end else null end,'public_path','/academy/page/'||p.plan_id::text)
 order by p.published_at desc,p.plan_id),'[]'::jsonb)
 from academy2_access.information_page_publications p
 where p.headquarters_id=p_hq and p.visible and public.academy_is_publicly_available(p_hq) is true
 and exists(select 1 from academy2_access.tenants t where t.headquarters_id=p_hq and t.runtime_enabled)
 and not exists(select 1 from academy2_access.plan_publications x join public.academy_offerings o on o.id=x.offering_id
 where x.plan_id=p.plan_id and x.headquarters_id=p_hq and o.status='published')
$function$
;
notify pgrst,'reload schema';
commit;
