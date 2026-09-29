-- Explicit Academy 2.0 course settings. Legacy course.price is never read or changed.
create table academy2_access.course_settings (
 course_id uuid primary key references public.academy_courses(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 reference_price bigint check(reference_price between 0 and 9007199254740991),
 all_courses_eligible boolean,
 revision integer not null check(revision>0),
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now()
);
create index academy2_course_settings_hq on academy2_access.course_settings(headquarters_id);
create table academy2_access.sales_plan_draft_course_resolution (
 draft_id uuid not null,
 revision integer not null,
 all_courses_resolved boolean not null,
 selected_count integer not null check(selected_count>=0),
 primary key(draft_id,revision),
 foreign key(draft_id,revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision) on delete restrict
);
alter table academy2_access.course_settings enable row level security;
alter table academy2_access.sales_plan_draft_course_resolution enable row level security;
revoke all on academy2_access.course_settings,academy2_access.sales_plan_draft_course_resolution from public,anon,authenticated,service_role;

create function academy2_access.course_settings_view(p_hq uuid,p_course uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s academy2_access.course_settings;
begin
 if not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.academy_courses where id=p_course and headquarters_id=p_hq) then raise exception 'academy2_course_unavailable' using errcode='42501';end if;
 select * into s from academy2_access.course_settings where course_id=p_course and headquarters_id=p_hq;
 return jsonb_build_object('course_id',p_course,'headquarters_id',p_hq,'reference_price',s.reference_price,'all_courses_eligible',s.all_courses_eligible,'revision',coalesce(s.revision,0),'updated_at',s.updated_at);
end $$;
revoke all on function academy2_access.course_settings_view(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.course_settings_view(uuid,uuid) to authenticated;
create function public.academy2_course_settings(p_headquarters_id uuid,p_course_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.course_settings_view(p_headquarters_id,p_course_id)$$;
revoke all on function public.academy2_course_settings(uuid,uuid) from public,anon,service_role;
grant execute on function public.academy2_course_settings(uuid,uuid) to authenticated;

create function academy2_access.save_course_settings(p_hq uuid,p_course uuid,p_expected integer,p_reference numeric,p_eligible boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s academy2_access.course_settings;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_expected is null or p_expected<0 or (p_reference is not null and (p_reference::text in ('NaN','Infinity','-Infinity') or p_reference<0 or p_reference>9007199254740991 or trunc(p_reference)<>p_reference)) then raise exception 'academy2_invalid_reference_price' using errcode='22023';end if;
 perform 1 from public.academy_courses where id=p_course and headquarters_id=p_hq for share;
 if not found then raise exception 'academy2_course_unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('course-settings:'||p_course::text,0));
 select * into s from academy2_access.course_settings where course_id=p_course for update;
 if s.course_id is null then
  if p_expected<>0 then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
  insert into academy2_access.course_settings(course_id,headquarters_id,reference_price,all_courses_eligible,revision,updated_by)
  values(p_course,p_hq,p_reference::bigint,p_eligible,1,auth.uid());
 else
  if s.headquarters_id<>p_hq then raise exception 'academy2_forbidden' using errcode='42501';end if;
  if s.revision<>p_expected then
   if p_expected=0 and s.revision=1 and s.updated_by=auth.uid() and s.reference_price is not distinct from p_reference and s.all_courses_eligible is not distinct from p_eligible then return academy2_access.course_settings_view(p_hq,p_course);end if;
   raise exception 'academy2_revision_conflict' using errcode='PT409';
  end if;
  update academy2_access.course_settings set reference_price=p_reference::bigint,all_courses_eligible=p_eligible,revision=revision+1,updated_by=auth.uid(),updated_at=now() where course_id=p_course;
 end if;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'course.settings.saved',p_course);
 return academy2_access.course_settings_view(p_hq,p_course);
end $$;
revoke all on function academy2_access.save_course_settings(uuid,uuid,integer,numeric,boolean) from public,anon,authenticated,service_role;
grant execute on function academy2_access.save_course_settings(uuid,uuid,integer,numeric,boolean) to authenticated;
create function public.academy2_save_course_settings(p_headquarters_id uuid,p_course_id uuid,p_expected_revision integer,p_reference_price numeric,p_all_courses_eligible boolean) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.save_course_settings(p_headquarters_id,p_course_id,p_expected_revision,p_reference_price,p_all_courses_eligible)$$;
revoke all on function public.academy2_save_course_settings(uuid,uuid,integer,numeric,boolean) from public,anon,service_role;
grant execute on function public.academy2_save_course_settings(uuid,uuid,integer,numeric,boolean) to authenticated;

-- Only new draft revisions read the explicit source. Existing snapshots remain untouched.
create or replace function academy2_access.sales_plan_draft(p_hq uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d academy2_access.sales_plan_drafts; r academy2_access.sales_plan_draft_revisions; resolution academy2_access.sales_plan_draft_course_resolution;
begin
 if not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into d from academy2_access.sales_plan_drafts where id=p_id and headquarters_id=p_hq;
 if d.id is null then raise exception 'academy2_draft_unavailable' using errcode='42501';end if;
 select * into r from academy2_access.sales_plan_draft_revisions where draft_id=d.id and revision=d.revision;
 select * into resolution from academy2_access.sales_plan_draft_course_resolution where draft_id=d.id and revision=d.revision;
 return jsonb_build_object('id',d.id,'headquarters_id',d.headquarters_id,'revision',d.revision,'status','draft','configuration',d.configuration,
 'course_snapshot',r.course_snapshot,'reference_price_snapshot',r.reference_price_snapshot,'sale_price_snapshot',r.sale_price_snapshot,
 'publication_hold',true,'hold_reasons',case when d.configuration->>'kind'='全講座' and not coalesce(resolution.all_courses_resolved,false) then jsonb_build_array('draft_only','all_courses_eligibility_source_pending') when d.configuration->>'kind'='全講座' and resolution.selected_count=0 then jsonb_build_array('draft_only','no_eligible_courses') else jsonb_build_array('draft_only') end,
 'created_at',d.created_at,'updated_at',d.updated_at);
end $$;

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
 if exists(select 1 from jsonb_object_keys(p_configuration) k where k not in ('title','kind','course_ids','price','purchase_mode','stage_prices','monthly','study_style','allowed_methods','materials','payment_methods','external_payment_urls','after','dues','opening_license','kit','community','workshop','terms','show_course_introductions')) then raise exception 'academy2_unsupported_draft_field' using errcode='22023';end if;
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
