-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-course-images-page.local.sql
-- Local-only: snapshot only the public image URLs. Historical publications remain unchanged.
begin;
do $guard$begin
 -- Target identity must be verified by the runner before this transaction.
 if md5(replace(pg_get_functiondef('academy2_access.information_page_command(uuid,uuid,integer,integer,uuid,boolean)'::regprocedure),chr(13),''))<>'df1f71a42d93a567a77f077fe4891969' then raise exception 'page_definition_changed';end if;
end$guard$;
CREATE OR REPLACE FUNCTION academy2_access.information_page_command(p_hq uuid, p_plan uuid, p_plan_revision integer, p_page_revision integer, p_request uuid, p_visible boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cmd academy2_access.information_page_commands; d academy2_access.sales_plan_drafts; page academy2_access.sales_pages;
 pub academy2_access.information_page_publications; input jsonb; result jsonb; ready jsonb; payload jsonb;
begin
 if auth.uid() is null or academy2_access.my_role(p_hq) is distinct from 'administrator'
 or academy2_access.can(p_hq,'pages.edit') is distinct from true or academy2_access.can(p_hq,'public_price.edit') is distinct from true
 or academy2_access.can(p_hq,'applications.operate') is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_visible is null then raise exception 'academy2_invalid_command' using errcode='22023';end if;
 input:=jsonb_build_object('plan_id',p_plan,'plan_revision',p_plan_revision,'page_revision',p_page_revision,'visible',p_visible);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,71));
 select * into cmd from academy2_access.information_page_commands where request_id=p_request;
 if found then
  if cmd.actor_id<>auth.uid() or cmd.headquarters_id<>p_hq or cmd.input<>input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return cmd.result;
 end if;
 -- Match the existing draft/page lock, then verify both expected revisions.
 perform pg_advisory_xact_lock(hashtextextended(p_plan::text,0));
 select * into d from academy2_access.sales_plan_drafts where id=p_plan and headquarters_id=p_hq for share;
 if not found then raise exception 'academy2_plan_unavailable' using errcode='42501';end if;
 select * into page from academy2_access.sales_pages where plan_id=p_plan and headquarters_id=p_hq for update;
 if d.revision is distinct from p_plan_revision or page.revision is distinct from p_page_revision then raise exception 'academy2_revision_changed' using errcode='PT409';end if;
 if exists(select 1 from academy2_access.plan_publications p join public.academy_offerings o on o.id=p.offering_id
 where p.plan_id=p_plan and p.headquarters_id=p_hq and o.status='published') then
  raise exception 'academy2_existing_accepting_publication_unchanged' using errcode='22023';
 end if;
 if p_visible then
  ready:=academy2_access.information_page_readiness(p_hq,p_plan,p_plan_revision,p_page_revision);
  if (ready->>'ready')::boolean is distinct from true then raise exception 'academy2_page_not_ready' using errcode='22023',detail=(ready->'reasons')::text;end if;
  -- Explicit safe projection only: no configuration blob, course feature_settings,
  -- event rows, private address, contact details, materials or learner content.
  select jsonb_build_object('plan_id',p_plan,'headquarters_id',p_hq,'title',d.configuration->>'title',
   'price',d.configuration->'price','currency','JPY','blocks',page.blocks,'accepting',false,
   'courses',coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'subtitle',c.subtitle,
    'main_image_url',c.main_image_url,'description',c.description,'can_do_after',c.can_do_after,'duration_text',c.duration_text,'marketing',jsonb_build_object('images',academy2_access.course_introduction_projection(c.id)->'images'))
    order by ids.ordinality),'[]'::jsonb)) into payload
  from jsonb_array_elements_text(d.configuration->'course_ids') with ordinality ids(id,ordinality)
  join public.academy_courses c on c.id=ids.id::uuid and c.headquarters_id=p_hq;
  insert into academy2_access.information_page_publications(plan_id,headquarters_id,plan_revision,page_revision,payload,visible,published_by)
  values(p_plan,p_hq,p_plan_revision,p_page_revision,payload,true,auth.uid())
  on conflict(plan_id) do update set plan_revision=excluded.plan_revision,page_revision=excluded.page_revision,
  payload=excluded.payload,visible=true,published_by=excluded.published_by,published_at=now();
 else
  update academy2_access.information_page_publications set visible=false
  where plan_id=p_plan and headquarters_id=p_hq;
  if not found then raise exception 'academy2_page_unavailable' using errcode='PT409';end if;
 end if;
 select * into pub from academy2_access.information_page_publications where plan_id=p_plan;
 result:=jsonb_build_object('plan_id',p_plan,'headquarters_id',p_hq,'plan_revision',pub.plan_revision,
 'page_revision',pub.page_revision,'public_path','/academy/page/'||p_plan::text,'published_at',pub.published_at,
 'visible',pub.visible,'accepting',false,'starts_new_trial',false);
 insert into academy2_access.information_page_commands(request_id,actor_id,headquarters_id,input,result)
 values(p_request,auth.uid(),p_hq,input,result);
 return result;
end $function$
;
notify pgrst,'reload schema';
commit;
