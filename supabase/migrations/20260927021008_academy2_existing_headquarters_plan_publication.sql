-- Existing publicly available headquarters only. Never starts/restarts a trial,
-- changes a contract, publishes a course, or mutates an existing application.
create table academy2_access.plan_publications (
 plan_id uuid primary key references academy2_access.sales_plan_drafts(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 plan_revision integer not null,page_revision integer not null,
 offering_id uuid not null unique references public.academy_offerings(id) on delete restrict,
 event_id uuid not null references public.academy_classes(id) on delete restrict,
 published_by uuid not null references auth.users(id),published_at timestamptz not null default now(),
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision),
 foreign key(plan_id,page_revision) references academy2_access.sales_page_revisions(plan_id,revision)
);
create table academy2_access.plan_publication_commands (
 request_id uuid primary key,headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 actor_id uuid not null references auth.users(id),input jsonb not null,result jsonb not null,
 created_at timestamptz not null default now()
);
create table academy2_access.plan_publication_permits (
 transaction_id bigint not null,actor_id uuid not null,offering_id uuid not null,
 operation text not null check(operation in('INSERT','UPDATE')),old_row jsonb,new_row jsonb not null,
 primary key(transaction_id,actor_id,offering_id)
);
alter table academy2_access.plan_publications enable row level security;
alter table academy2_access.plan_publication_commands enable row level security;
alter table academy2_access.plan_publication_permits enable row level security;
revoke all on academy2_access.plan_publications,academy2_access.plan_publication_commands,academy2_access.plan_publication_permits from public,anon,authenticated,service_role;

create function academy2_access.consume_publication_permit(p_operation text,p_old jsonb,p_new jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare matched boolean;
begin
 delete from academy2_access.plan_publication_permits
 where transaction_id=txid_current() and actor_id=auth.uid() and offering_id=(p_new->>'id')::uuid
 and operation=p_operation and old_row is not distinct from p_old and new_row=p_new
 returning true into matched;
 return coalesce(matched,false);
end $$;
revoke all on function academy2_access.consume_publication_permit(text,jsonb,jsonb) from public,anon,authenticated,service_role;

-- Preserve the existing trigger OID, grants, and entire legacy branch.
-- No broad role helper is relaxed. Only a private, exact-row single-use permit
-- authored by the new publication transaction can enter the added branch.
do $patch$
declare definition text;marker text:=E'\nbegin\n';addition text;
begin
 definition:=replace(pg_get_functiondef('private.academy_guard_offering()'::regprocedure),E'\r\n',E'\n');
 if position(marker in definition)=0 or position('offering_forbidden' in definition)=0 or position('consume_publication_permit' in definition)>0 then raise exception 'academy2_unrecognized_offering_guard';end if;
 addition:=$branch$
 if tg_op in('INSERT','UPDATE') and academy2_access.consume_publication_permit(tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new)) then return new;end if;
$branch$;
 execute overlay(definition placing marker||addition from position(marker in definition) for length(marker));
end $patch$;

create function academy2_access.plan_publication_readiness(p_hq uuid,p_plan uuid,p_plan_revision integer,p_page_revision integer,p_event uuid,p_event_revision integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d academy2_access.sales_plan_drafts;p academy2_access.sales_pages;pub academy2_access.plan_publications;
 ep academy2_access.event_plans;c public.academy_classes;conf jsonb;reasons jsonb:='[]';ids uuid[];
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'applications.operate') or not academy2_access.can(p_hq,'pages.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into d from academy2_access.sales_plan_drafts where id=p_plan and headquarters_id=p_hq;
 if not found then raise exception 'academy2_plan_unavailable' using errcode='42501';end if;
 conf:=d.configuration;
 select * into p from academy2_access.sales_pages where plan_id=p_plan and headquarters_id=p_hq;
 if p_plan_revision is distinct from d.revision or p_page_revision is distinct from coalesce(p.revision,0) then reasons:=reasons||'"revision_changed"'::jsonb;end if;
 if p.plan_id is not null and p.plan_revision<>d.revision then reasons:=reasons||'"page_needs_rebase"'::jsonb;end if;
 if (p.plan_id is not null and jsonb_array_length(p.blocks)=0) or (p.plan_id is null and conf->>'show_course_introductions'='false') then reasons:=reasons||'"empty_page_renderer_pending"'::jsonb;end if;
 if public.academy_is_publicly_available(p_hq) is distinct from true then reasons:=reasons||'"existing_public_contract_required"'::jsonb;end if;
 select array_agg(value::uuid order by ord) into ids from jsonb_array_elements_text(conf->'course_ids') with ordinality a(value,ord);
 if coalesce(cardinality(ids),0)<>1 then reasons:=reasons||'"single_course_bridge_only"'::jsonb;end if;
 if exists(select 1 from unnest(ids) id where not exists(select 1 from public.academy_courses co where co.id=id and co.headquarters_id=p_hq and co.is_published)) then reasons:=reasons||'"course_public_projection_pending"'::jsonb;end if;
 if nullif(btrim(conf->>'title'),'') is null or (conf->>'price') is null or (conf->>'price')::numeric>99999999 then reasons:=reasons||'"title_or_price_required"'::jsonb;end if;
 if conf->>'kind' not in('ワークショップ','単品講座','コース') or conf->>'purchase_mode' is distinct from 'all' then reasons:=reasons||'"sales_type_or_staged_purchase_pending"'::jsonb;end if;
 if conf->'payment_methods' is distinct from '["bank"]'::jsonb then reasons:=reasons||'"bank_only_bridge"'::jsonb;end if;
 if conf->>'study_style' is distinct from 'instructor' or coalesce((conf#>>'{materials,enabled}')::boolean,false) then reasons:=reasons||'"learner_material_release_pending"'::jsonb;end if;
 if jsonb_array_length(coalesce(conf->'allowed_methods','[]'))=0 or exists(select 1 from jsonb_array_elements_text(coalesce(conf->'allowed_methods','[]')) x where x not in('in_person','online')) then reasons:=reasons||'"teaching_method_required"'::jsonb;end if;
 if coalesce((conf#>>'{after,commercial_license}')::boolean,false) or coalesce((conf#>>'{after,instructor_license}')::boolean,false) or coalesce((conf#>>'{dues,enabled}')::boolean,false) or coalesce((conf#>>'{opening_license,enabled}')::boolean,false) then reasons:=reasons||'"rights_or_dues_flow_pending"'::jsonb;end if;
 if coalesce((conf#>>'{kit,enabled}')::boolean,false) then reasons:=reasons||'"kit_public_application_pending"'::jsonb;end if;
 if (conf#>'{after,certificate}') is not null and conf#>'{after,certificate}'<>'null'::jsonb or coalesce(conf->>'community','none')<>'none' or conf#>>'{after,record_completion}'='false' then reasons:=reasons||'"after_course_flow_pending"'::jsonb;end if;
 if nullif(btrim(conf#>>'{terms,version}'),'') is null or nullif(btrim(conf#>>'{terms,body}'),'') is null then reasons:=reasons||'"application_terms_required"'::jsonb;end if;
 if conf ? 'application_form' and exists(select 1 from jsonb_array_elements(conf#>'{application_form,fields}') f where f->>'id' not in('name','email','terms')) then reasons:=reasons||'"application_form_answers_pending"'::jsonb;end if;
 select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq;
 select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq;
 if ep.class_id is null or c.id is null then reasons:=reasons||'"event_required"'::jsonb;
 elsif ep.plan_id<>p_plan or ep.plan_revision<>p_plan_revision or ep.revision is distinct from p_event_revision then reasons:=reasons||'"event_revision_changed"'::jsonb;
 elsif c.status not in('planned','active') or not coalesce(c.course_id=any(ids),false) or ((conf->'allowed_methods')?c.format) is distinct from true or (c.schedule_mode='fixed' and c.starts_at is null) then reasons:=reasons||'"event_not_ready"'::jsonb;end if;
 select * into pub from academy2_access.plan_publications where plan_id=p_plan;
 if pub.plan_id is not null and (pub.plan_revision<>p_plan_revision or pub.event_id<>p_event) then reasons:=reasons||'"published_conditions_change_pending"'::jsonb;end if;
 return jsonb_build_object('ready',jsonb_array_length(reasons)=0,'reasons',reasons,'plan_revision',d.revision,'page_revision',coalesce(p.revision,0),'offering_id',pub.offering_id,'starts_new_trial',false);
end $$;
revoke all on function academy2_access.plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function academy2_access.plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer) to authenticated;
create function public.academy2_plan_publication_readiness(p_headquarters_id uuid,p_plan_id uuid,p_plan_revision integer,p_page_revision integer,p_event_id uuid,p_event_revision integer) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.plan_publication_readiness(p_headquarters_id,p_plan_id,p_plan_revision,p_page_revision,p_event_id,p_event_revision)$$;
revoke all on function public.academy2_plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer) from public,anon,service_role;
grant execute on function public.academy2_plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer) to authenticated;

create function academy2_access.publish_existing_plan(p_hq uuid,p_plan uuid,p_plan_revision integer,p_page_revision integer,p_event uuid,p_event_revision integer,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d academy2_access.sales_plan_drafts;page academy2_access.sales_pages;pub academy2_access.plan_publications;cmd academy2_access.plan_publication_commands;
 o public.academy_offerings;prior_row jsonb;input jsonb;result jsonb;ready jsonb;generated jsonb;ids uuid[];event_state jsonb;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'applications.operate') or not academy2_access.can(p_hq,'pages.edit') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_plan is null then raise exception 'academy2_invalid_publication' using errcode='22023';end if;
 input:=jsonb_build_object('plan_id',p_plan,'plan_revision',p_plan_revision,'page_revision',p_page_revision,'event_id',p_event,'event_revision',p_event_revision);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,47));
 select * into cmd from academy2_access.plan_publication_commands where request_id=p_request;
 if found then
  if cmd.headquarters_id<>p_hq or cmd.actor_id<>auth.uid() or cmd.input<>input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return cmd.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_plan::text,0));
 select * into d from academy2_access.sales_plan_drafts where id=p_plan and headquarters_id=p_hq for share;
 if not found then raise exception 'academy2_plan_unavailable' using errcode='42501';end if;
 perform 1 from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq for update;
 perform 1 from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
 ready:=academy2_access.plan_publication_readiness(p_hq,p_plan,p_plan_revision,p_page_revision,p_event,p_event_revision);
 if (ready->>'ready')::boolean is distinct from true then raise exception 'academy2_publication_not_ready' using errcode='22023',detail=(ready->'reasons')::text;end if;
 select * into page from academy2_access.sales_pages where plan_id=p_plan for update;
 if not found then
  generated:=academy2_access.sales_page(p_hq,p_plan);
  perform academy2_access.save_sales_page(p_hq,p_plan,0,p_plan_revision,generated->'blocks');
  select * into page from academy2_access.sales_pages where plan_id=p_plan;
 end if;
 select * into pub from academy2_access.plan_publications where plan_id=p_plan for update;
 if pub.plan_id is null then
  select array_agg(value::uuid order by ord) into ids from jsonb_array_elements_text(d.configuration->'course_ids') with ordinality a(value,ord);
  o.id:=gen_random_uuid();o.headquarters_id:=p_hq;o.title:=d.configuration->>'title';o.kind:=d.configuration->>'kind';o.course_ids:=ids;
  o.price:=(d.configuration->>'price')::numeric;o.payment_methods:=array['bank'];o.currency:='JPY';o.purchase_mode:='all';o.stage_prices:='{}';
  o.lp_blocks:=page.blocks;o.status:='published';o.created_by:=auth.uid();o.created_at:=now();o.updated_at:=now();o.completion_mode:='hq';
  insert into academy2_access.plan_publication_permits(transaction_id,actor_id,offering_id,operation,new_row) values(txid_current(),auth.uid(),o.id,'INSERT',to_jsonb(o));
  insert into public.academy_offerings select (o).*;
  perform academy2_access.bind_operation_source(p_hq,o.id,p_plan,p_plan_revision);
  insert into academy2_access.plan_publications(plan_id,headquarters_id,plan_revision,page_revision,offering_id,event_id,published_by) values(p_plan,p_hq,p_plan_revision,page.revision,o.id,p_event,auth.uid());
 else
  select * into o from public.academy_offerings where id=pub.offering_id and headquarters_id=p_hq for update;
  if o.id is null or o.status<>'published' then raise exception 'academy2_existing_publication_unavailable' using errcode='PT409';end if;
  prior_row:=to_jsonb(o);o.lp_blocks:=page.blocks;o.updated_at:=now();
  insert into academy2_access.plan_publication_permits(transaction_id,actor_id,offering_id,operation,old_row,new_row) values(txid_current(),auth.uid(),o.id,'UPDATE',prior_row,to_jsonb(o));
  update public.academy_offerings set lp_blocks=o.lp_blocks,updated_at=o.updated_at where id=o.id;
  update academy2_access.plan_publications set page_revision=page.revision,published_by=auth.uid(),published_at=now() where plan_id=p_plan;
 end if;
 if exists(select 1 from academy2_access.plan_publication_permits where transaction_id=txid_current() and actor_id=auth.uid() and offering_id=o.id) then raise exception 'academy2_publication_permit_not_consumed';end if;
 if exists(select 1 from public.academy_classes where id=p_event and registration_status<>'open') then
  event_state:=academy2_access.event_registration(p_hq,p_event,p_event_revision,p_request,'open',o.id);
 else
  perform academy2_access.bind_operation_source(p_hq,o.id,p_plan,p_plan_revision);
  event_state:=academy2_access.events(p_hq,p_event);
 end if;
 result:=jsonb_build_object('plan_id',p_plan,'plan_revision',p_plan_revision,'page_revision',page.revision,'offering_id',o.id,'public_path','/academy/o/'||o.id::text,'event',event_state,'starts_new_trial',false);
 insert into academy2_access.plan_publication_commands(request_id,headquarters_id,actor_id,input,result) values(p_request,p_hq,auth.uid(),input,result);
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'sales_plan.publish_existing',o.id);
 return result;
end $$;
revoke all on function academy2_access.publish_existing_plan(uuid,uuid,integer,integer,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.publish_existing_plan(uuid,uuid,integer,integer,uuid,integer,uuid) to authenticated;
create function public.academy2_publish_existing_plan(p_headquarters_id uuid,p_plan_id uuid,p_plan_revision integer,p_page_revision integer,p_event_id uuid,p_event_revision integer,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.publish_existing_plan(p_headquarters_id,p_plan_id,p_plan_revision,p_page_revision,p_event_id,p_event_revision,p_request_id)$$;
revoke all on function public.academy2_publish_existing_plan(uuid,uuid,integer,integer,uuid,integer,uuid) from public,anon,service_role;
grant execute on function public.academy2_publish_existing_plan(uuid,uuid,integer,integer,uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
