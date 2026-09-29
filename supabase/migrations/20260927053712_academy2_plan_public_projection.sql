-- Candidate: explicitly published V2 plan introductions. Never publish the
-- underlying course row (legacy material access depends on is_published).
create function academy2_access.published_plan_offering(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.academy_offerings;s academy2_access.operation_sources;r academy2_access.sales_plan_draft_revisions;
begin
 select * into o from public.academy_offerings where id=p_id;
 select * into s from academy2_access.operation_sources where offering_id=p_id;
 select * into r from academy2_access.sales_plan_draft_revisions where draft_id=s.plan_id and revision=s.plan_revision;
 if o.id is null or s.offering_id is null or r.draft_id is null
 or o.status<>'published' or not public.academy_is_publicly_available(o.headquarters_id)
 or not exists(select 1 from academy2_access.tenants where headquarters_id=o.headquarters_id and runtime_enabled)
 or not exists(select 1 from academy2_access.plan_publications where offering_id=o.id and headquarters_id=o.headquarters_id and plan_id=s.plan_id and plan_revision=s.plan_revision)
 or cardinality(o.course_ids)=0 or exists(select 1 from unnest(o.course_ids) x where not exists(select 1 from public.academy_courses c where c.id=x and c.headquarters_id=o.headquarters_id))
 then return null;end if;
 return jsonb_build_object('id',o.id,'headquarters_id',o.headquarters_id,'title',o.title,'kind',o.kind,'course_ids',o.course_ids,'price',o.price,'currency',o.currency,'payment_methods',o.payment_methods,'purchase_mode',o.purchase_mode,'stage_prices',o.stage_prices,'lp_blocks',o.lp_blocks,'status',o.status,'updated_at',o.updated_at,'courses',(
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'subtitle',c.subtitle,'main_image_url',c.main_image_url,'description',c.description,'can_do_after',c.can_do_after,'duration_text',c.duration_text,'marketing',jsonb_build_object('category',c.feature_settings#>'{marketing,category}','images',c.feature_settings#>'{marketing,images}','curriculum',c.feature_settings#>'{marketing,curriculum}','imageSide',c.feature_settings#>'{marketing,imageSide}')) order by array_position(o.course_ids,c.id)),'[]') from public.academy_courses c where c.id=any(o.course_ids) and c.headquarters_id=o.headquarters_id));
end $$;
revoke all on function academy2_access.published_plan_offering(uuid) from public,anon,authenticated,service_role;

-- Preserve the existing public intake branch for all previously bound plans.
do $patch$
declare d text;old_text text;new_text text;
begin
 d:=pg_get_functiondef('academy2_access.public_intake(uuid,boolean)'::regprocedure);
 old_text:='data:=public.academy_get_public_offering(offer);';
 new_text:='data:=case when not p_instructor and exists(select 1 from academy2_access.plan_publications where offering_id=offer) then academy2_access.published_plan_offering(offer) else public.academy_get_public_offering(offer) end;';
 if position(old_text in d)=0 then raise exception 'academy2_unrecognized_public_intake';end if;
 execute replace(d,old_text,new_text);

 d:=pg_get_functiondef('academy2_access.plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer)'::regprocedure);
 old_text:='if coalesce(cardinality(ids),0)<>1 then';
 if position(old_text in d)=0 then raise exception 'academy2_unrecognized_publication_readiness';end if;
 d:=replace(d,old_text,'if coalesce(cardinality(ids),0)<1 then');
 old_text:='co.id=id and co.headquarters_id=p_hq and co.is_published';
 if position(old_text in d)=0 then raise exception 'academy2_unrecognized_course_readiness';end if;
 execute replace(d,old_text,'co.id=id and co.headquarters_id=p_hq');

 d:=pg_get_functiondef('academy2_access.bind_operation_source(uuid,uuid,uuid,integer)'::regprocedure);
 old_text:='cardinality(o.course_ids)<>1';
 if position(old_text in d)=0 then raise exception 'academy2_unrecognized_operation_source';end if;
 execute replace(d,old_text,'coalesce(cardinality(o.course_ids),0)<1');

 d:=pg_get_functiondef('academy2_access.submit_operation(uuid,uuid,text,text,boolean,numeric,uuid)'::regprocedure);
 old_text:='published_course.headquarters_id=o.headquarters_id and published_course.is_published';
 new_text:='published_course.headquarters_id=o.headquarters_id and (published_course.is_published or academy2_access.published_plan_offering(o.id) is not null)';
 if position(old_text in d)=0 then raise exception 'academy2_unrecognized_operation_submission';end if;
 execute replace(d,old_text,new_text);

 d:=pg_get_functiondef('academy2_access.event_registration(uuid,uuid,integer,uuid,text,uuid)'::regprocedure);
 old_text:='id=c.course_id and headquarters_id=p_hq and is_published';
 new_text:='id=c.course_id and headquarters_id=p_hq and (is_published or academy2_access.published_plan_offering(p_offering) is not null)';
 if position(old_text in d)=0 then raise exception 'academy2_unrecognized_event_registration';end if;
 execute replace(d,old_text,new_text);
end $patch$;
notify pgrst,'reload schema';
