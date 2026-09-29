-- Production candidate; review and isolated validation required before approval.
-- Local candidate only. Parent generates the formal migration. No historical answers are rewritten.
alter table academy2_access.event_plans add column if not exists kit_method text check (kit_method in ('shipping','venue_handover'));

create or replace function academy2_access.validate_application_form(p_form jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare f jsonb; c jsonb; k text; seen text[]:='{}'; typ text;
begin
 if jsonb_typeof(p_form) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_form) x where x not in('fields','conditionalVersion'))
 or (p_form ? 'conditionalVersion' and p_form->'conditionalVersion'<>'1'::jsonb) or jsonb_typeof(p_form->'fields') is distinct from 'array' or jsonb_array_length(p_form->'fields')>30 then raise exception 'academy2_invalid_application_form' using errcode='22023';end if;
 for f in select value from jsonb_array_elements(p_form->'fields') loop
  k:=f->>'id';typ:=f->>'type';c:=f->'condition';
  if jsonb_typeof(f)<>'object' or exists(select 1 from jsonb_object_keys(f) x where x not in('id','label','type','required','options','condition'))
   or k is null or k=any(seen) or length(k)>80 or jsonb_typeof(f->'label') is distinct from 'string' or length(btrim(f->>'label')) not between 1 and 200
   or jsonb_typeof(f->'required') is distinct from 'boolean' then raise exception 'academy2_invalid_form_field' using errcode='22023';end if;
  if (case k when 'name' then typ is distinct from 'text' when 'email' then typ is distinct from 'email' when 'phone' then typ is distinct from 'tel' when 'notes' then typ is distinct from 'textarea' when 'terms' then typ is distinct from 'agreement' else k !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or typ not in('text','textarea','select') or typ is null end) then raise exception 'academy2_invalid_form_type' using errcode='22023';end if;
  if typ='select' then
   if jsonb_typeof(f->'options') is distinct from 'array' or jsonb_array_length(f->'options') not between 1 and 30 or exists(select 1 from jsonb_array_elements(f->'options') v where jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}')) not between 1 and 200) or (select count(*)<>count(distinct v) from jsonb_array_elements(f->'options') v) then raise exception 'academy2_invalid_form_options' using errcode='22023';end if;
  elsif f ? 'options' then raise exception 'academy2_unused_form_options' using errcode='22023';end if;
  if c is not null then
   if k in('name','email','terms') or p_form->'conditionalVersion' is distinct from '1'::jsonb or jsonb_typeof(c)<>'object' or exists(select 1 from jsonb_object_keys(c) x where x not in('source','value','field_id')) or jsonb_typeof(c->'value') is distinct from 'string' or length(btrim(c->>'value')) not between 1 and 200 then raise exception 'academy2_invalid_form_condition' using errcode='22023';end if;
   if not coalesce((case c->>'source' when 'format' then c->>'value' in('in_person','online') when 'schedule_mode' then c->>'value' in('fixed','arranged_after_application') when 'kit_shipping' then c->>'value' in('true','false') when 'certificate' then c->>'value' in('true','false') when 'course' then c->>'value' ~* '^[0-9a-f-]{36}$' when 'answer' then c->>'field_id'=any(seen) and c->>'field_id' not in('name','email','terms') else false end),false) then raise exception 'academy2_invalid_form_condition' using errcode='22023';end if;
  end if;
  seen:=array_append(seen,k);
 end loop;
 if (select count(*) from jsonb_array_elements(p_form->'fields') required_field where required_field->>'id' in('name','email','terms') and required_field->'required'='true')<>3 then raise exception 'academy2_required_form_fields' using errcode='22023';end if;
end$$;

create or replace function academy2_access.intake_condition_matches(p_condition jsonb,p_context jsonb,p_visible jsonb) returns boolean
language sql immutable set search_path='' as $$
 select case when p_condition is null then true else coalesce(case p_condition->>'source'
 when 'answer' then p_visible ? (p_condition->>'field_id') and p_visible->>(p_condition->>'field_id')=p_condition->>'value'
 when 'course' then (p_context->'course_ids') ? (p_condition->>'value')
 when 'format' then p_context->>'format'=p_condition->>'value'
 when 'schedule_mode' then p_context->>'schedule_mode'=p_condition->>'value'
 when 'kit_shipping' then p_context->>'kit_shipping'=p_condition->>'value'
 when 'certificate' then p_context->>'certificate'=p_condition->>'value' else false end,false) end
$$;

create or replace function academy2_access.intake_configuration(p_offering uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when r.configuration->>'kind' in ('全講座','月額レッスン') then r.configuration||jsonb_build_object('course_ids',to_jsonb(o.course_ids)) else r.configuration end from (select plan_id,plan_revision from academy2_access.operation_sources where offering_id=p_offering union all select plan_id,plan_revision from academy2_access.opening_license_sources where offering_id=p_offering) s join academy2_access.sales_plan_draft_revisions r on r.draft_id=s.plan_id and r.revision=s.plan_revision join public.academy_offerings o on o.id=p_offering limit 1
$$;
create or replace function academy2_access.intake_condition_context(p_configuration jsonb,p_event jsonb,p_instructor boolean) returns jsonb
language plpgsql immutable set search_path='' as $$
declare delivery text;kit jsonb:=p_configuration->'kit';instructed boolean:=coalesce(p_configuration->>'study_style','instructor')<>'materials_only';
begin
 delivery:=p_event->>'kitMethod';
 if delivery is null and jsonb_array_length(coalesce(kit->'methods','[]'))=1 then delivery:=kit->'methods'->>0;end if;
 return jsonb_build_object('format',case when instructed then p_event->>'format' else null end,'schedule_mode',case when not instructed then null when p_instructor then 'arranged_after_application' else p_event->>'scheduleMode' end,
 'kit_shipping',coalesce(kit->'enabled'='true' and kit->>'recipient' is distinct from 'instructor' and delivery='shipping',false),
 'certificate',coalesce(jsonb_typeof(p_configuration#>'{after,certificate}')='object',false),'physical_certificate',coalesce(coalesce(jsonb_typeof(p_configuration#>'{after,certificate}')='object',false) and p_configuration#>>'{after,certificate,delivery}'<>'digital',false),
 'course_ids',coalesce(p_configuration->'course_ids','[]'),'kit_ready',not(coalesce(kit->'enabled'='true',false) and jsonb_array_length(coalesce(kit->'methods','[]'))>1 and delivery is null));
end$$;
create or replace function academy2_access.intake_runtime_fields(p_configuration jsonb,p_context jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare fields jsonb:=coalesce(p_configuration#>'{application_form,fields}','[]');autofields jsonb:='[]';
begin
 if p_configuration#>'{application_form,conditionalVersion}' is distinct from '1' then return fields;end if;
 if p_context->>'schedule_mode'='arranged_after_application' then autofields:='[{"id":"preferred_date_1","label":"第1希望日","type":"date","required":true},{"id":"preferred_time","label":"希望時間帯","type":"select","required":false,"options":["指定なし","午前","午後","夕方以降"]},{"id":"preferred_date_2","label":"第2希望日","type":"date","required":false},{"id":"preferred_date_3","label":"第3希望日","type":"date","required":false},{"id":"preferred_date_note","label":"日程についての補足","type":"textarea","required":false}]';end if;
 if p_context->'certificate'='true' then autofields:=autofields||'[{"id":"certificate_name","label":"証書記載名","type":"text","required":true}]';end if;
 if p_context->'kit_shipping'='true' or p_context->'physical_certificate'='true' then autofields:=autofields||'[{"id":"shipping_address","label":"発送先（郵便番号・住所・宛名）","type":"textarea","required":true}]';end if;
 select coalesce(jsonb_agg(f||jsonb_build_object('_context',p_context) order by ord),'[]') into fields from jsonb_array_elements(fields||autofields) with ordinality a(f,ord);
 return fields;
end$$;
create or replace function academy2_access.normalize_intake_answers(p_fields jsonb,p_answers jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare f jsonb;k text;v text;result jsonb:='{}';seen text[]:='{}';
begin
 if jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields)>40 or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>40000 then raise exception 'application_answers_invalid' using errcode='22023';end if;
 for f in select value from jsonb_array_elements(p_fields) loop
  k:=f->>'id';
  if k is null or k=any(seen) or jsonb_typeof(f->'required') is distinct from 'boolean' or length(coalesce(f->>'label','')) not between 1 and 200 then raise exception 'application_form_invalid' using errcode='22023';end if;
  seen:=array_append(seen,k);
  if k in('name','email','terms') or not academy2_access.intake_condition_matches(f->'condition',f->'_context',result) then continue;end if;
  if f->>'type' not in('text','textarea','tel','select','date') then raise exception 'application_form_unsupported' using errcode='22023';end if;
  if p_answers ? k and jsonb_typeof(p_answers->k)<>'string' then raise exception 'application_answers_invalid' using errcode='22023';end if;
  v:=btrim(coalesce(p_answers->>k,''));
  if (f->>'required')::boolean and v='' then raise exception 'application_answer_required' using errcode='22023';end if;
  if length(v)>(case when k='phone' then 50 when k in('notes','preferred_date_note','shipping_address') then 4000 else 1000 end) then raise exception 'application_answer_too_long' using errcode='22023';end if;
  if v<>'' and f->>'type'='select' and not (f->'options')?v then raise exception 'application_answer_invalid_option' using errcode='22023';end if;
  if v<>'' and f->>'type'='date' then
   if v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'application_answer_invalid_date' using errcode='22023';end if;
   begin if to_char(v::date,'YYYY-MM-DD')<>v then raise exception 'application_answer_invalid_date' using errcode='22023';end if; exception when datetime_field_overflow or invalid_datetime_format then raise exception 'application_answer_invalid_date' using errcode='22023';end;
  end if;
  result:=result||jsonb_build_object(k,v);
 end loop;
 if exists(select 1 from jsonb_object_keys(p_answers) a where not result ? a) then raise exception 'application_answer_unknown_or_hidden' using errcode='22023';end if;
 return result;
end$$;
create or replace function academy2_access.intake_form_supported(p_fields jsonb) returns boolean language plpgsql immutable set search_path='' as $$begin
 perform academy2_access.validate_application_form(jsonb_build_object('fields',(select coalesce(jsonb_agg(f),'[]') from jsonb_array_elements('[{"id":"name","label":"お名前","type":"text","required":true},{"id":"email","label":"メール","type":"email","required":true},{"id":"terms","label":"規約","type":"agreement","required":true}]'::jsonb) f where not exists(select 1 from jsonb_array_elements(p_fields) p where p->>'id'=f->>'id'))||p_fields,'conditionalVersion',1));return true;exception when others then return false;end$$;

create or replace function academy2_access.public_intake_with_form(p_id uuid,p_instructor boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;conf jsonb;events jsonb;conditions jsonb;problems jsonb:='[]';
begin
 ctx:=academy2_access.public_intake(p_id,p_instructor);
 if ctx is null or ctx->>'mode' not in('headquarters','instructor') then return ctx;end if;
 conf:=academy2_access.intake_configuration((ctx#>>'{offering,id}')::uuid);
 select coalesce(jsonb_agg(ev||jsonb_build_object('kitMethod',ep.kit_method,'formReady',academy2_access.intake_condition_context(conf,ev||jsonb_build_object('kitMethod',ep.kit_method),p_instructor)->'kit_ready') order by ord),'[]') into events from jsonb_array_elements(ctx->'events') with ordinality a(ev,ord) left join academy2_access.event_plans ep on ep.class_id=(ev->>'id')::uuid;
 conditions:=academy2_access.intake_condition_context(conf,null,p_instructor);
 if p_instructor and conditions->'kit_ready'='false' then problems:='["kit_delivery_unconfigured"]';end if;
 return ctx||jsonb_build_object('events',events,'formConfiguration',jsonb_build_object('study_style',conf->'study_style','kit',conf->'kit','after',jsonb_build_object('certificate',conf#>'{after,certificate}'),'course_ids',conf->'course_ids'),
 'applicationForm',coalesce(conf->'application_form','{"fields":[]}'::jsonb)||jsonb_build_object('readinessReasons',problems));
end$$;

create or replace function academy2_access.application_answers_insert_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare conf jsonb;fields jsonb;
begin
 conf:=academy2_access.intake_configuration(new.offering_id);fields:=coalesce(conf#>'{application_form,fields}','[]');
 if (conf#>'{application_form,conditionalVersion}'='1' or exists(select 1 from jsonb_array_elements(fields) f where f->>'id' not in('name','email','terms'))) and not exists(select 1 from academy2_access.application_answer_permits p where p.learner_user_id=new.learner_user_id and p.request_id=new.request_token and p.offering_id=new.offering_id and p.transaction_id=txid_current()) then raise exception 'application_answers_required' using errcode='22023';end if;
 return new;
end$$;

create or replace function academy2_access.submit_public_intake_with_answers(p_id uuid,p_instructor boolean,p_request uuid,p_name text,p_terms text,p_agree boolean,p_price numeric,p_class uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old academy2_access.application_answers%rowtype;fields jsonb;answers jsonb;result jsonb;offer uuid;ctx jsonb;conf jsonb;ev jsonb;conditions jsonb;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or p_request is null then raise exception 'authenticated_user_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request::text,213000));
 select * into old from academy2_access.application_answers where learner_user_id=auth.uid() and request_id=p_request;
 if found then
  answers:=academy2_access.normalize_intake_answers(old.fields,p_answers);
  if old.source_id is distinct from p_id or old.instructor is distinct from p_instructor or old.answers is distinct from answers then raise exception 'application_answer_retry_changed' using errcode='PT409';end if;
  return academy2_access.submit_public_intake(p_id,p_instructor,p_request,p_name,p_terms,p_agree,p_price,p_class);
 end if;
 ctx:=academy2_access.public_intake_with_form(p_id,p_instructor);
 if ctx is null or ctx->>'mode' not in('headquarters','instructor') then raise exception 'intake_unavailable' using errcode='42501';end if;
 offer:=(ctx#>>'{offering,id}')::uuid;
 perform 1 from academy2_access.operation_sources where offering_id=offer for share;
 perform 1 from academy2_access.opening_license_sources where offering_id=offer for share;
 ctx:=academy2_access.public_intake_with_form(p_id,p_instructor);
 if p_class is not null then
  perform 1 from academy2_access.event_plans where class_id=p_class for share;
  ctx:=academy2_access.public_intake_with_form(p_id,p_instructor);
  select value into ev from jsonb_array_elements(ctx->'events') where value->>'id'=p_class::text;
  if ev is null then raise exception 'application_event_unavailable' using errcode='42501';end if;
 end if;
 conf:=academy2_access.intake_configuration(offer);conditions:=academy2_access.intake_condition_context(conf,ev,p_instructor);
 if conf#>'{application_form,conditionalVersion}'='1' and conditions->'kit_ready'='false' then raise exception 'application_kit_delivery_unconfigured' using errcode='22023';end if;
 fields:=academy2_access.intake_runtime_fields(conf,conditions);answers:=academy2_access.normalize_intake_answers(fields,p_answers);
 if exists(select 1 from public.academy_offering_applications where learner_user_id=auth.uid() and request_token=p_request) then raise exception 'application_answer_snapshot_missing' using errcode='PT409';end if;
 insert into academy2_access.application_answer_permits values(auth.uid(),p_request,txid_current(),offer);
 result:=academy2_access.submit_public_intake(p_id,p_instructor,p_request,p_name,p_terms,p_agree,p_price,p_class);
 insert into academy2_access.application_answers(application_id,learner_user_id,request_id,source_id,instructor,fields,answers) values((result->>'id')::uuid,auth.uid(),p_request,p_id,p_instructor,fields,answers);
 delete from academy2_access.application_answer_permits where learner_user_id=auth.uid() and request_id=p_request;
 return result;
end$$;

create or replace function academy2_access.application_answers_for_viewer(p_application uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.academy_offering_applications;r academy2_access.application_answers;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into a from public.academy_offering_applications where id=p_application;
 if a.id is null or not exists(select 1 from academy2_access.tenants where headquarters_id=a.headquarters_id and runtime_enabled) or not coalesce((a.learner_user_id=auth.uid() or academy2_access.can(a.headquarters_id,'applications.read') or academy2_access.instructor_operation_authorized(p_application)),false) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into r from academy2_access.application_answers where application_id=a.id;
 if not found then return jsonb_build_object('fields','[]'::jsonb,'answers','{}'::jsonb,'legacy',true);end if;
 return jsonb_build_object('fields',r.fields,'answers',r.answers,'savedAt',r.created_at,'legacy',false);
end$$;
create or replace function public.academy2_application_answers(p_application uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.application_answers_for_viewer(p_application)$$;
revoke all on function academy2_access.validate_application_form(jsonb),academy2_access.intake_condition_matches(jsonb,jsonb,jsonb),academy2_access.intake_configuration(uuid),academy2_access.intake_condition_context(jsonb,jsonb,boolean),academy2_access.intake_runtime_fields(jsonb,jsonb),academy2_access.application_answers_for_viewer(uuid),public.academy2_application_answers(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.application_answers_for_viewer(uuid),public.academy2_application_answers(uuid) to authenticated;
-- Existing functions retain their restricted EXECUTE grants under CREATE OR REPLACE.
notify pgrst,'reload schema';
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
 if p_configuration ? 'application_form' then perform academy2_access.validate_application_form(p_configuration->'application_form');end if;
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



