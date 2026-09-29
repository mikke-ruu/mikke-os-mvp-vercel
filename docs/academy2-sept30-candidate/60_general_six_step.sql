-- Production candidate; review and isolated validation required before approval.
-- Additive owned-local extension. Existing guards, revisions and immutable documents remain intact.
do $$declare d text;marker text;begin
 d:=pg_get_functiondef('academy2_access.save_sales_plan_draft(uuid,uuid,integer,jsonb)'::regprocedure);
 marker:='''course_ids'',''price''';if position(marker in d)=0 then raise exception 'catalog_field_contract_changed';end if;
 d:=replace(d,marker,'''course_ids'',''catalog_course_ids'',''price''');
 marker:='if kind=''全講座'' then';if position(marker in d)=0 then raise exception 'catalog_resolution_contract_changed';end if;
 d:=replace(d,marker,marker||E'\n if conf ? ''catalog_course_ids'' then\n if jsonb_typeof(conf->''catalog_course_ids'') is distinct from ''array'' or (select count(*)<>count(distinct value) from jsonb_array_elements(conf->''catalog_course_ids'')) then raise exception ''academy2_invalid_course_id'' using errcode=''22023'';end if;\n select coalesce(array_agg(value::uuid),''{}''::uuid[]) into ids from jsonb_array_elements_text(conf->''catalog_course_ids'');eligibility_complete:=true;\n else');
 marker:='where a.headquarters_id=p_hq and s.all_courses_eligible=true;';if position(marker in d)=0 then raise exception 'catalog_resolution_end_changed';end if;
 d:=replace(d,marker,marker||E'\n end if;');execute d;
end $$;

create or replace function academy2_access.save_plan_six_step(p_hq uuid,p_id uuid,p_expected integer,p_configuration jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare conf jsonb:=p_configuration;prior jsonb;ids uuid[];rows jsonb;item jsonb;enabled integer:=0;missing boolean:=false;names text[]:='{}';ship boolean:=true;hand boolean:=true;methods jsonb:='[]';kit jsonb;previous jsonb;begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if conf is null or jsonb_typeof(conf)<>'object' or conf->>'kind' not in('ワークショップ','単品講座','コース','全講座','月額レッスン') then raise exception 'academy2_invalid_draft' using errcode='22023';end if;
 if conf ? 'catalog_course_ids' and conf->>'kind'<>'全講座' then raise exception 'catalog_selection_type_required' using errcode='22023';end if;
 select r.configuration into prior from academy2_access.sales_plan_draft_revisions r join academy2_access.sales_plan_drafts d on d.id=r.draft_id where d.headquarters_id=p_hq and r.draft_id=p_id and r.revision=p_expected;
 if conf->>'kind'='月額レッスン' then select array_agg(distinct x.value::uuid) into ids from jsonb_array_elements(conf#>'{monthly,months}') m cross join lateral jsonb_array_elements_text(m->'course_ids') x;
 elsif conf->>'kind'='全講座' then
  if conf ? 'catalog_course_ids' then select array_agg(value::uuid) into ids from jsonb_array_elements_text(conf->'catalog_course_ids');else select array_agg(course_id) into ids from academy2_access.course_settings where headquarters_id=p_hq and all_courses_eligible=true;end if;
 else select array_agg(value::uuid) into ids from jsonb_array_elements_text(conf->'course_ids');end if;
 ids:=coalesce(ids,'{}');perform 1 from academy2_access.course_shipping_settings where headquarters_id=p_hq and course_id=any(ids) for share;
 rows:=academy2_access.course_shipping(p_hq,ids);
 for item in select value from jsonb_array_elements(rows) loop
  if item->'configuration'='null' then missing:=true;continue;end if;
  if item#>'{configuration,enabled}'='true' then enabled:=enabled+1;names:=array_append(names,item#>>'{configuration,name}');ship:=ship and item#>'{configuration,shipping}'='true';hand:=hand and item#>'{configuration,handover}'='true';end if;
 end loop;
 previous:=case when prior#>'{kit,previous_plan_settings}' is not null then prior#>'{kit,previous_plan_settings}' when prior#>'{kit,course_source}' is null then prior->'kit' else null end;
 if missing then kit:=coalesce(prior->'kit',conf->'kit','{"enabled":false,"methods":[]}')||jsonb_build_object('course_source',rows,'source_pending',true);
 else
  if enabled>0 and ship then methods:=methods||'"shipping"'::jsonb;end if;if enabled>0 and hand then methods:=methods||'"venue_handover"'::jsonb;end if;
  kit:=jsonb_build_object('enabled',enabled>0,'name',array_to_string(names,'・'),'recipient','learner','methods',methods,'course_source',rows,'source_pending',enabled>0 and jsonb_array_length(methods)=0);
 end if;
 if previous is not null then kit:=kit||jsonb_build_object('previous_plan_settings',previous);end if;
 conf:=jsonb_set(conf,'{kit}',kit);conf:=jsonb_set(conf,'{after}',coalesce(conf->'after','{}')||'{"record_completion":true}');
 if (conf->'payment_methods')?'card' and not coalesce((prior->'payment_methods')?'card',false) and (not academy2_access.after_course_card_contracted(p_hq) or not academy2_access.payment_provider_ready(p_hq)) then raise exception 'academy2_card_contract_required' using errcode='42501';end if;
 if conf->>'kind'='月額レッスン' then
  conf:=jsonb_set(conf,'{monthly,months}',coalesce((select jsonb_agg(m||case when not exists(select 1 from jsonb_array_elements_text(m->'course_ids') x left join academy2_access.course_shipping_settings s on s.course_id=x::uuid where s.course_id is null) then jsonb_build_object('kit',exists(select 1 from jsonb_array_elements_text(m->'course_ids') x join academy2_access.course_shipping_settings s on s.course_id=x::uuid where s.configuration->'enabled'='true')) else '{}'::jsonb end order by ord) from jsonb_array_elements(conf#>'{monthly,months}') with ordinality q(m,ord)),'[]'));
 end if;
 return academy2_access.save_sales_plan_draft(p_hq,p_id,p_expected,conf);
end $$;


create function public.academy2_save_plan_six_step(p_headquarters_id uuid,p_id uuid,p_expected_revision integer,p_configuration jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.save_plan_six_step(p_headquarters_id,p_id,p_expected_revision,p_configuration)$$;
revoke all on function academy2_access.save_plan_six_step(uuid,uuid,integer,jsonb),public.academy2_save_plan_six_step(uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function academy2_access.save_plan_six_step(uuid,uuid,integer,jsonb),public.academy2_save_plan_six_step(uuid,uuid,integer,jsonb) to authenticated;

create or replace function academy2_access.six_step_review_ready(p_plan uuid,p_revision integer) returns boolean language plpgsql stable security definer set search_path='' as $$
declare c jsonb;snapshot jsonb;hq uuid;begin
 select r.configuration,d.headquarters_id into c,hq from academy2_access.sales_plan_draft_revisions r join academy2_access.sales_plan_drafts d on d.id=r.draft_id where r.draft_id=p_plan and r.revision=p_revision;
 snapshot:=c#>'{kit,course_source}';if snapshot is null then return true;end if;
 if jsonb_typeof(snapshot)<>'array' or jsonb_array_length(snapshot)=0 or c#>'{kit,source_pending}'='true' then return false;end if;
 if ((c->'payment_methods')?'card' or c#>'{after,instructor_license}'='true' or c->>'kind'='月額レッスン') and (not academy2_access.after_course_card_contracted(hq) or not academy2_access.payment_provider_ready(hq)) then return false;end if;
 if (c#>'{after,commercial_license}'='true' and c#>'{after,commercial_policy}' is not null) then return false;end if;
 return not exists(select 1 from jsonb_array_elements(snapshot) x left join academy2_access.course_shipping_settings s on s.course_id=(x->>'course_id')::uuid and s.headquarters_id=hq where s.course_id is null or s.revision<>(x->>'revision')::integer or s.configuration is distinct from x->'configuration');
end $$;
revoke all on function academy2_access.six_step_review_ready(uuid,integer) from public,anon,authenticated,service_role;


do $$declare d text;marker text:='conf:=academy2_access.resolved_saved_plan_configuration(d.id,d.revision);';begin
 d:=pg_get_functiondef('academy2_access.plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer)'::regprocedure);
 if position('six_step_review_settings_pending' in d)=0 then
 if position(marker in d)=0 then raise exception 'unrecognized_publication_guard';end if;
 execute replace(d,marker,marker||E'\n if not academy2_access.six_step_review_ready(p_plan,p_plan_revision) then reasons:=reasons||''"six_step_review_settings_pending"''::jsonb;end if;');
 end if;end $$;
create or replace function academy2_access.copy_review_shipping_answer() returns trigger language plpgsql security definer set search_path='' as $$
declare e academy2_access.operation_enrollments;c jsonb;address text;begin
 select * into e from academy2_access.operation_enrollments where application_id=new.application_id;
 select configuration into c from academy2_access.sales_plan_draft_revisions where draft_id=e.plan_id and revision=e.plan_revision;
 if c#>'{kit,course_source}' is null then return new;end if;
 address:=nullif(btrim(new.answers->>'shipping_address'),'');
 if address is not null and ((c#>>'{kit,recipient}'='learner' and c#>'{kit,enabled}'='true' and (c#>'{kit,methods}')?'shipping') or c#>>'{after,certificate,delivery}' in('physical','both')) then
  insert into academy2_access.hq_shipping(application_id,address) values(new.application_id,address) on conflict(application_id) do update set address=excluded.address where hq_shipping.address is null and hq_shipping.shipped_at is null and hq_shipping.confirmed_at is null;
 end if;return new;
end $$;
revoke all on function academy2_access.copy_review_shipping_answer() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';

create trigger academy2_copy_review_shipping_answer after insert on academy2_access.application_answers for each row execute function academy2_access.copy_review_shipping_answer();
