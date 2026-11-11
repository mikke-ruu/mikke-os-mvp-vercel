-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-plan-cover-image.local.sql
-- Local only. Extend a validated optional presentation field; preserve all business gates and ACLs.
begin;
do $guard$begin
-- Target identity must be verified by the runner before this transaction.
if md5(replace(pg_get_functiondef('academy2_access.save_sales_plan_draft(uuid,uuid,integer,jsonb)'::regprocedure),chr(13),''))<>'334745199af45b8387e056e47045702c' then raise exception 'plan_cover_definition_changed: academy2_access.save_sales_plan_draft(uuid,uuid,integer,jsonb)';end if;
if md5(replace(pg_get_functiondef('academy2_access.published_plan_offering_before_course_introduction(uuid)'::regprocedure),chr(13),''))<>'0ca4258b4f8583598f6429a16570b85a' then raise exception 'plan_cover_definition_changed: academy2_access.published_plan_offering_before_course_introduction(uuid)';end if;
if md5(replace(pg_get_functiondef('academy2_access.information_page_command(uuid,uuid,integer,integer,uuid,boolean)'::regprocedure),chr(13),''))<>'d99d4fdbfc515461c388941b77644b5a' then raise exception 'plan_cover_definition_changed: academy2_access.information_page_command(uuid,uuid,integer,integer,uuid,boolean)';end if;
end$guard$;
CREATE OR REPLACE FUNCTION academy2_access.save_sales_plan_draft(p_hq uuid, p_id uuid, p_expected integer, p_configuration jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d academy2_access.sales_plan_drafts; conf jsonb; ids uuid[]:='{}'; id_text text; c record; entry record; amount jsonb;
 courses jsonb:='[]'; refs jsonb:='[]'; next_revision integer; kind text; eligibility_complete boolean:=false;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_id is null or p_expected is null or p_expected<0 or p_configuration is null or jsonb_typeof(p_configuration)<>'object'
 or octet_length(p_configuration::text)>100000 then raise exception 'academy2_invalid_draft' using errcode='22023';end if;
 -- Configuration is inert draft data, never an entitlement or payment event.
 -- Keep all locked model settings; reject unknown root fields rather than dropping them.
 if p_configuration ? 'cover_image' then
  if jsonb_typeof(p_configuration->'cover_image') is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_configuration->'cover_image') k where k not in('mode','url')) or coalesce(p_configuration#>>'{cover_image,mode}','') not in('auto','custom','none') then raise exception 'academy2_invalid_cover' using errcode='22023';end if;
  if p_configuration#>>'{cover_image,mode}'='custom' then
   if jsonb_typeof(p_configuration#>'{cover_image,url}') is distinct from 'string' or length(p_configuration#>>'{cover_image,url}')>2048 or (p_configuration#>>'{cover_image,url}') !~* '^https?://' then raise exception 'academy2_invalid_cover' using errcode='22023';end if;
  elsif (p_configuration->'cover_image') ? 'url' then raise exception 'academy2_invalid_cover' using errcode='22023';end if;
 end if;
 if exists(select 1 from jsonb_object_keys(p_configuration) k where k not in ('title','description','cover_image','kind','course_ids','catalog_course_ids','price','purchase_mode','stage_prices','monthly','study_style','allowed_methods','materials','payment_methods','external_payment_urls','external_payment_details','after','dues','opening_license','kit','community','workshop','terms','show_course_introductions','application_form')) then raise exception 'academy2_unsupported_draft_field' using errcode='22023';end if;

 -- Optional additive form configuration is a draft snapshot, not proof that intake supports it.
 if p_configuration ? 'application_form' then perform academy2_access.validate_application_form(p_configuration->'application_form');end if;
 if p_configuration#>'{kit,name}' is not null and (jsonb_typeof(p_configuration#>'{kit,name}') is distinct from 'string' or length(p_configuration#>>'{kit,name}')>200) then raise exception 'academy2_invalid_kit_name' using errcode='22023';end if;
 if p_configuration#>'{after,record_completion}' is not null and jsonb_typeof(p_configuration#>'{after,record_completion}') is distinct from 'boolean' then raise exception 'academy2_invalid_completion_setting' using errcode='22023';end if;
 perform academy2_access.validate_after_course_settings(p_hq,p_configuration,(select configuration from academy2_access.sales_plan_drafts where id=p_id and headquarters_id=p_hq));
if p_configuration ? 'description' and (jsonb_typeof(p_configuration->'description') is distinct from 'string' or length(p_configuration->>'description')>10000) then raise exception 'academy2_invalid_plan_description' using errcode='22023';end if;
 conf:=p_configuration; kind:=conf->>'kind';
 if kind is null or kind not in ('ワークショップ','単品講座','コース','全講座','月額レッスン')
 or jsonb_typeof(conf->'title') is distinct from 'string' or length(conf->>'title')>200
 or jsonb_typeof(conf->'course_ids') is distinct from 'array'
 or jsonb_typeof(conf->'stage_prices') is distinct from 'object'
 or (conf->>'purchase_mode') is null or (conf->>'purchase_mode') not in ('all','staged') then raise exception 'academy2_invalid_draft' using errcode='22023';end if;
 if conf->>'purchase_mode'='staged' and kind<>'コース' then raise exception 'academy2_staged_requires_course' using errcode='22023';end if;
 if kind in ('全講座','月額レッスン') and jsonb_array_length(conf->'course_ids')<>0 then raise exception 'academy2_manual_selection_unavailable' using errcode='22023';end if;
 if kind='月額レッスン' then
  perform academy2_access.validate_monthly_policy_draft(conf->'monthly');
  if jsonb_typeof(conf#>'{monthly,months}') is distinct from 'array' or exists(select 1 from jsonb_object_keys(conf->'monthly') k where k not in ('months','period','past_access','exit_policy_id','certification_timing','completion_condition_id','billing_policy','cancellation_policy','refund_policy','unpaid_policy')) then raise exception 'academy2_invalid_months' using errcode='22023';end if;
  for c in select value from jsonb_array_elements(conf#>'{monthly,months}') loop
   if jsonb_typeof(c.value)<>'object' or jsonb_typeof(c.value->'course_ids') is distinct from 'array' or coalesce(c.value->>'month','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
   or exists(select 1 from jsonb_object_keys(c.value) k where k not in ('month','course_ids','materials','kit')) then raise exception 'academy2_invalid_months' using errcode='22023';end if;
   if (select count(*)<>count(distinct value) from jsonb_array_elements(c.value->'course_ids')) then raise exception 'academy2_duplicate_course' using errcode='22023';end if;
  end loop;
  if (select count(*)<>count(distinct value->>'month') from jsonb_array_elements(conf#>'{monthly,months}')) then raise exception 'academy2_duplicate_month' using errcode='22023';end if;
 elsif conf ? 'monthly' then raise exception 'academy2_monthly_type_required' using errcode='22023';end if;
 for id_text in select unnest(array['materials','external_payment_urls','external_payment_details','after','dues','opening_license','kit','workshop','terms']) loop
  if conf ? id_text and jsonb_typeof(conf->id_text)<>'object' then raise exception 'academy2_invalid_settings' using errcode='22023';end if;
 end loop;
 for id_text in select unnest(array['allowed_methods','payment_methods']) loop
  if conf ? id_text and jsonb_typeof(conf->id_text)<>'array' then raise exception 'academy2_invalid_settings' using errcode='22023';end if;
 end loop;
 if (select count(*)<>count(distinct value) from jsonb_array_elements(conf->'course_ids')) then raise exception 'academy2_duplicate_course' using errcode='22023';end if;
 for id_text in
  select value from jsonb_array_elements_text(conf->'course_ids')
  union select x.value from jsonb_array_elements(coalesce(conf#>'{monthly,months}','[]')) m cross join lateral jsonb_array_elements_text(m.value->'course_ids') x
 loop
  if id_text is null or id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'academy2_invalid_course_id' using errcode='22023';end if;
  ids:=array_append(ids,id_text::uuid);
 end loop;
 -- Missing prices remain null: an incomplete draft is not a zero-price sale.
 if not (conf ? 'price') then raise exception 'academy2_price_required_or_null' using errcode='22023';end if;
 for amount in select conf->'price' union all select value from jsonb_each(conf->'stage_prices') loop
  if amount='null'::jsonb then continue;end if;
  if jsonb_typeof(amount)<>'number' then raise exception 'academy2_invalid_price' using errcode='22023';end if;
  if (amount::text)::numeric<0 or (amount::text)::numeric>9007199254740991 or trunc((amount::text)::numeric)<>(amount::text)::numeric then raise exception 'academy2_invalid_price' using errcode='22023';end if;
 end loop;
 for entry in select key,value from jsonb_each(conf->'stage_prices') loop
  if not(entry.key=any(array(select u::text from unnest(ids) u))) then raise exception 'academy2_stage_course_unavailable' using errcode='22023';end if;
 end loop;
 if conf->>'purchase_mode'='all' and conf->'stage_prices'<>'{}'::jsonb then raise exception 'academy2_unused_stage_prices' using errcode='22023';end if;
 -- Lock explicit settings during the snapshot; never use legacy course.price.
 perform 1 from academy2_access.course_settings where headquarters_id=p_hq for share;
 if kind='全講座' then
 if conf ? 'catalog_course_ids' then
 if jsonb_typeof(conf->'catalog_course_ids') is distinct from 'array' or (select count(*)<>count(distinct value) from jsonb_array_elements(conf->'catalog_course_ids')) then raise exception 'academy2_invalid_course_id' using errcode='22023';end if;
 select coalesce(array_agg(value::uuid),'{}'::uuid[]) into ids from jsonb_array_elements_text(conf->'catalog_course_ids');eligibility_complete:=true;
 else
  select not exists(select 1 from public.academy_courses a left join academy2_access.course_settings s on s.course_id=a.id and s.headquarters_id=p_hq where a.headquarters_id=p_hq and s.all_courses_eligible is null) into eligibility_complete;
  select coalesce(array_agg(a.id order by a.id),'{}'::uuid[]) into ids from public.academy_courses a join academy2_access.course_settings s on s.course_id=a.id and s.headquarters_id=p_hq where a.headquarters_id=p_hq and s.all_courses_eligible=true;
 end if;
 end if;
 for c in select a.id,a.name,s.reference_price,s.revision as source_revision from public.academy_courses a left join academy2_access.course_settings s on s.course_id=a.id and s.headquarters_id=p_hq where a.id=any(ids) and a.headquarters_id=p_hq order by a.id for share of a loop
  courses:=courses||jsonb_build_array(jsonb_build_object('course_id',c.id,'title',c.name));
  refs:=refs||jsonb_build_array(jsonb_build_object('course_id',c.id,'amount',c.reference_price,'source',case when c.source_revision is null then 'reference_source_pending' else 'academy2_course_settings' end,'source_revision',c.source_revision));
 end loop;
 if jsonb_array_length(courses)<>cardinality(ids) then raise exception 'academy2_course_unavailable' using errcode='42501';end if;
 -- Serialize creations as well as updates, including uncertain-response retries.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into d from academy2_access.sales_plan_drafts where id=p_id for update;
 if d.id is null then
  if p_expected<>0 then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
  if to_regclass('public.academy_offerings') is not null then
   if exists(select 1 from public.academy_offerings where id=p_id) then raise exception 'academy2_legacy_id_unavailable' using errcode='22023';end if;
  end if;
  next_revision:=1;
  insert into academy2_access.sales_plan_drafts(id,headquarters_id,created_by,revision,configuration) values(p_id,p_hq,auth.uid(),next_revision,conf);
 else
  if d.headquarters_id<>p_hq then raise exception 'academy2_forbidden' using errcode='42501';end if;
  if d.revision<>p_expected then
   if d.created_by=auth.uid() and d.revision=1 and p_expected=0 and d.configuration=conf then return academy2_access.sales_plan_draft(p_hq,p_id);end if;
   raise exception 'academy2_revision_conflict' using errcode='PT409';
  end if;
  next_revision:=d.revision+1;
  update academy2_access.sales_plan_drafts set configuration=conf,revision=next_revision,updated_at=now() where id=p_id;
 end if;
 insert into academy2_access.sales_plan_draft_revisions(draft_id,revision,configuration,course_snapshot,reference_price_snapshot,sale_price_snapshot,saved_by)
 values(p_id,next_revision,conf,courses,refs,jsonb_build_object('currency','JPY','purchase_mode',conf->'purchase_mode','price',conf->'price','stage_prices',conf->'stage_prices','dues',conf->'dues','opening_license',conf->'opening_license'),auth.uid());
 insert into academy2_access.sales_plan_draft_course_resolution(draft_id,revision,all_courses_resolved,selected_count) values(p_id,next_revision,eligibility_complete,cardinality(ids));
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'sales_plan.draft.saved',p_id);
 return academy2_access.sales_plan_draft(p_hq,p_id);
end $function$
;
CREATE OR REPLACE FUNCTION academy2_access.published_plan_offering_before_course_introduction(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.academy_offerings;s academy2_access.operation_sources;r academy2_access.sales_plan_draft_revisions;
begin
 o:=academy2_access.validated_public_plan_row(p_id);
 if o.id is null then return null;end if;
 select * into s from academy2_access.operation_sources where offering_id=p_id;
 select * into r from academy2_access.sales_plan_draft_revisions where draft_id=s.plan_id and revision=s.plan_revision;
 return jsonb_build_object('id',o.id,'headquarters_id',o.headquarters_id,'title',o.title,'cover_image',r.configuration->'cover_image','kind',o.kind,'course_ids',o.course_ids,'price',o.price,'currency',o.currency,'payment_methods',o.payment_methods,'purchase_mode',o.purchase_mode,'stage_prices',o.stage_prices,'lp_blocks',o.lp_blocks,'status',o.status,'updated_at',o.updated_at,'courses',(
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'subtitle',c.subtitle,'main_image_url',c.main_image_url,'description',c.description,'can_do_after',c.can_do_after,'duration_text',c.duration_text,'marketing',jsonb_build_object('category',c.feature_settings#>'{marketing,category}','images',c.feature_settings#>'{marketing,images}','curriculum',c.feature_settings#>'{marketing,curriculum}','imageSide',c.feature_settings#>'{marketing,imageSide}')) order by array_position(o.course_ids,c.id)),'[]') from public.academy_courses c where c.id=any(o.course_ids) and c.headquarters_id=o.headquarters_id));
end $function$
;
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
   'price',d.configuration->'price','currency','JPY','cover_image',d.configuration->'cover_image','blocks',page.blocks,'accepting',false,
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
