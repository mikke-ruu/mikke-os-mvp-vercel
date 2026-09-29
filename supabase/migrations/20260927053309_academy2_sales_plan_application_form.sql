-- CANDIDATE ONLY: preserve course reference snapshots and existing guards. No legacy data rewrite.
create or replace function academy2_access.save_sales_plan_draft(p_hq uuid,p_id uuid,p_expected integer,p_configuration jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d academy2_access.sales_plan_drafts; conf jsonb; ids uuid[]:='{}'; id_text text; c record; entry record; amount jsonb;
 courses jsonb:='[]'; refs jsonb:='[]'; next_revision integer; kind text; eligibility_complete boolean:=false;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_id is null or p_expected is null or p_expected<0 or p_configuration is null or jsonb_typeof(p_configuration)<>'object'
 or octet_length(p_configuration::text)>100000 then raise exception 'academy2_invalid_draft' using errcode='22023';end if;
 -- Configuration is inert draft data, never an entitlement or payment event.
 -- Keep all locked model settings; reject unknown root fields rather than dropping them.
 if exists(select 1 from jsonb_object_keys(p_configuration) k where k not in ('title','kind','course_ids','price','purchase_mode','stage_prices','monthly','study_style','allowed_methods','materials','payment_methods','external_payment_urls','after','dues','opening_license','kit','community','workshop','terms','show_course_introductions','application_form')) then raise exception 'academy2_unsupported_draft_field' using errcode='22023';end if;

 -- Optional additive form configuration is a draft snapshot, not proof that intake supports it.
 if p_configuration ? 'application_form' then
  if jsonb_typeof(p_configuration->'application_form') is distinct from 'object' then raise exception 'academy2_invalid_application_form' using errcode='22023';end if;
  if exists(select 1 from jsonb_object_keys(p_configuration->'application_form') k where k<>'fields') or jsonb_typeof(p_configuration#>'{application_form,fields}') is distinct from 'array' then raise exception 'academy2_invalid_application_form' using errcode='22023';end if;
  for c in select value from jsonb_array_elements(p_configuration#>'{application_form,fields}') loop
   if jsonb_typeof(c.value) is distinct from 'object' then raise exception 'academy2_invalid_form_field' using errcode='22023';end if;
   if exists(select 1 from jsonb_object_keys(c.value) k where k not in('id','label','type','required'))
    or jsonb_typeof(c.value->'id') is distinct from 'string' or length(c.value->>'id') not between 1 and 80
    or jsonb_typeof(c.value->'label') is distinct from 'string' or length(btrim(c.value->>'label')) not between 1 and 200
    or jsonb_typeof(c.value->'type') is distinct from 'string' or jsonb_typeof(c.value->'required') is distinct from 'boolean' then raise exception 'academy2_invalid_form_field' using errcode='22023';end if;
   if (case c.value->>'id' when 'name' then c.value->>'type'<>'text' when 'email' then c.value->>'type'<>'email' when 'phone' then c.value->>'type'<>'tel' when 'notes' then c.value->>'type'<>'textarea' when 'terms' then c.value->>'type'<>'agreement' else (c.value->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or c.value->>'type'<>'text') end) then raise exception 'academy2_invalid_form_type' using errcode='22023';end if;
  end loop;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_configuration#>'{application_form,fields}')) then raise exception 'academy2_duplicate_form_field' using errcode='22023';end if;
  if (select count(*) from jsonb_array_elements(p_configuration#>'{application_form,fields}') where value->>'id' in('name','email','terms') and value->'required'='true'::jsonb)<>3 then raise exception 'academy2_required_form_fields' using errcode='22023';end if;
 end if;
 if p_configuration#>'{kit,name}' is not null and (jsonb_typeof(p_configuration#>'{kit,name}') is distinct from 'string' or length(p_configuration#>>'{kit,name}')>200) then raise exception 'academy2_invalid_kit_name' using errcode='22023';end if;
 if p_configuration#>'{after,record_completion}' is not null and jsonb_typeof(p_configuration#>'{after,record_completion}') is distinct from 'boolean' then raise exception 'academy2_invalid_completion_setting' using errcode='22023';end if;
 conf:=p_configuration; kind:=conf->>'kind';
 if kind is null or kind not in ('ワークショップ','単品講座','コース','全講座','月額レッスン')
 or jsonb_typeof(conf->'title') is distinct from 'string' or length(conf->>'title')>200
 or jsonb_typeof(conf->'course_ids') is distinct from 'array'
 or jsonb_typeof(conf->'stage_prices') is distinct from 'object'
 or (conf->>'purchase_mode') is null or (conf->>'purchase_mode') not in ('all','staged') then raise exception 'academy2_invalid_draft' using errcode='22023';end if;
 if conf->>'purchase_mode'='staged' and kind<>'コース' then raise exception 'academy2_staged_requires_course' using errcode='22023';end if;
 if kind in ('全講座','月額レッスン') and jsonb_array_length(conf->'course_ids')<>0 then raise exception 'academy2_manual_selection_unavailable' using errcode='22023';end if;
 if kind='月額レッスン' then
  if jsonb_typeof(conf#>'{monthly,months}') is distinct from 'array' or exists(select 1 from jsonb_object_keys(conf->'monthly') k where k not in ('months','period','past_access','exit_policy_id','certification_timing','completion_condition_id')) then raise exception 'academy2_invalid_months' using errcode='22023';end if;
  for c in select value from jsonb_array_elements(conf#>'{monthly,months}') loop
   if jsonb_typeof(c.value)<>'object' or jsonb_typeof(c.value->'course_ids') is distinct from 'array' or coalesce(c.value->>'month','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
   or exists(select 1 from jsonb_object_keys(c.value) k where k not in ('month','course_ids','materials','kit')) then raise exception 'academy2_invalid_months' using errcode='22023';end if;
   if (select count(*)<>count(distinct value) from jsonb_array_elements(c.value->'course_ids')) then raise exception 'academy2_duplicate_course' using errcode='22023';end if;
  end loop;
  if (select count(*)<>count(distinct value->>'month') from jsonb_array_elements(conf#>'{monthly,months}')) then raise exception 'academy2_duplicate_month' using errcode='22023';end if;
 elsif conf ? 'monthly' then raise exception 'academy2_monthly_type_required' using errcode='22023';end if;
 for id_text in select unnest(array['materials','external_payment_urls','after','dues','opening_license','kit','workshop','terms']) loop
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
  select not exists(select 1 from public.academy_courses a left join academy2_access.course_settings s on s.course_id=a.id and s.headquarters_id=p_hq where a.headquarters_id=p_hq and s.all_courses_eligible is null) into eligibility_complete;
  select coalesce(array_agg(a.id order by a.id),'{}'::uuid[]) into ids from public.academy_courses a join academy2_access.course_settings s on s.course_id=a.id and s.headquarters_id=p_hq where a.headquarters_id=p_hq and s.all_courses_eligible=true;
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
end $$;

-- CREATE OR REPLACE preserves previously restricted EXECUTE grants.
