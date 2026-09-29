-- New drafts only. Never updates legacy offerings, learner purchases, terms
-- agreements, course content, billing, trial periods, or publication state.
create table academy2_access.sales_plan_drafts (
 id uuid primary key,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 created_by uuid not null references auth.users(id) on delete restrict,
 revision integer not null check(revision>0),
 status text not null default 'draft' check(status='draft'),
 configuration jsonb not null check(jsonb_typeof(configuration)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index academy2_draft_hq on academy2_access.sales_plan_drafts(headquarters_id,updated_at desc);
create table academy2_access.sales_plan_draft_revisions (
 draft_id uuid not null references academy2_access.sales_plan_drafts(id) on delete restrict,
 revision integer not null,
 configuration jsonb not null,
 course_snapshot jsonb not null,
 reference_price_snapshot jsonb not null,
 sale_price_snapshot jsonb not null,
 saved_by uuid not null references auth.users(id) on delete restrict,
 saved_at timestamptz not null default now(),
 primary key(draft_id,revision)
);
alter table academy2_access.sales_plan_drafts enable row level security;
alter table academy2_access.sales_plan_draft_revisions enable row level security;
revoke all on academy2_access.sales_plan_drafts,academy2_access.sales_plan_draft_revisions from public,anon,authenticated,service_role;

create function academy2_access.sales_plan_draft(p_hq uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d academy2_access.sales_plan_drafts; r academy2_access.sales_plan_draft_revisions;
begin
 if not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into d from academy2_access.sales_plan_drafts where id=p_id and headquarters_id=p_hq;
 if d.id is null then raise exception 'academy2_draft_unavailable' using errcode='42501';end if;
 select * into r from academy2_access.sales_plan_draft_revisions where draft_id=d.id and revision=d.revision;
 return jsonb_build_object('id',d.id,'headquarters_id',d.headquarters_id,'revision',d.revision,'status','draft','configuration',d.configuration,
 'course_snapshot',r.course_snapshot,'reference_price_snapshot',r.reference_price_snapshot,'sale_price_snapshot',r.sale_price_snapshot,
 'publication_hold',true,'hold_reasons',case when d.configuration->>'kind'='全講座' then jsonb_build_array('draft_only','all_courses_eligibility_source_pending') else jsonb_build_array('draft_only') end,
 'created_at',d.created_at,'updated_at',d.updated_at);
end $$;
revoke all on function academy2_access.sales_plan_draft(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.sales_plan_draft(uuid,uuid) to authenticated;
create function public.academy2_sales_plan_draft(p_headquarters_id uuid,p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.sales_plan_draft(p_headquarters_id,p_id)$$;
revoke all on function public.academy2_sales_plan_draft(uuid,uuid) from public,anon,service_role;
grant execute on function public.academy2_sales_plan_draft(uuid,uuid) to authenticated;

create function academy2_access.sales_plan_drafts(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(academy2_access.sales_plan_draft(p_hq,d.id) order by d.updated_at desc),'[]'::jsonb) into result
 from academy2_access.sales_plan_drafts d where d.headquarters_id=p_hq;
 return result;
end $$;
revoke all on function academy2_access.sales_plan_drafts(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.sales_plan_drafts(uuid) to authenticated;
create function public.academy2_sales_plan_drafts(p_headquarters_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.sales_plan_drafts(p_headquarters_id)$$;
revoke all on function public.academy2_sales_plan_drafts(uuid) from public,anon,service_role;
grant execute on function public.academy2_sales_plan_drafts(uuid) to authenticated;

create function academy2_access.save_sales_plan_draft(p_hq uuid,p_id uuid,p_expected integer,p_configuration jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d academy2_access.sales_plan_drafts; conf jsonb; ids uuid[]:='{}'; id_text text; c record; entry record; amount jsonb;
 courses jsonb:='[]'; refs jsonb:='[]'; next_revision integer; kind text;
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
 -- Existing course prices have legacy sales meaning and are deliberately NOT read.
 for c in select a.id,a.name from public.academy_courses a where a.id=any(ids) and a.headquarters_id=p_hq order by a.id for share loop
  courses:=courses||jsonb_build_array(jsonb_build_object('course_id',c.id,'title',c.name));
  refs:=refs||jsonb_build_array(jsonb_build_object('course_id',c.id,'amount',null,'source','reference_source_pending'));
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
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'sales_plan.draft.saved',p_id);
 return academy2_access.sales_plan_draft(p_hq,p_id);
end $$;
revoke all on function academy2_access.save_sales_plan_draft(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function academy2_access.save_sales_plan_draft(uuid,uuid,integer,jsonb) to authenticated;
create function public.academy2_save_sales_plan_draft(p_headquarters_id uuid,p_id uuid,p_expected_revision integer,p_configuration jsonb) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.save_sales_plan_draft(p_headquarters_id,p_id,p_expected_revision,p_configuration)$$;
revoke all on function public.academy2_save_sales_plan_draft(uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.academy2_save_sales_plan_draft(uuid,uuid,integer,jsonb) to authenticated;
