-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-page-publication.local.sql
-- LOCAL CANDIDATE ONLY. Not a migration and never applied to Production.
-- Information-page publication is independent of offerings/events/enrollments.
-- Existing commercial publication, contract, trial, learner-access and intake RPCs
-- are deliberately unchanged. New headquarters still need the existing public
-- contract; deciding a new billing trigger is outside this local candidate.
begin;
create table academy2_access.information_page_publications (
 plan_id uuid primary key references academy2_access.sales_plan_drafts(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 plan_revision integer not null,
 page_revision integer not null,
 payload jsonb not null,
 visible boolean not null default true,
 published_by uuid not null references auth.users(id),
 published_at timestamptz not null default now(),
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision),
 foreign key(plan_id,page_revision) references academy2_access.sales_page_revisions(plan_id,revision)
);
create table academy2_access.information_page_commands (
 request_id uuid primary key,
 actor_id uuid not null references auth.users(id),
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 input jsonb not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table academy2_access.information_page_publications enable row level security;
alter table academy2_access.information_page_commands enable row level security;
revoke all on academy2_access.information_page_publications,academy2_access.information_page_commands from public,anon,authenticated,service_role;

create function academy2_access.information_page_readiness(p_hq uuid,p_plan uuid,p_plan_revision integer,p_page_revision integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb; reasons jsonb; d academy2_access.sales_plan_drafts; page academy2_access.sales_pages;
 pub academy2_access.plan_publications; event_revision integer; generated jsonb; management jsonb;
begin
 if auth.uid() is null or academy2_access.my_role(p_hq) is distinct from 'administrator'
 or academy2_access.can(p_hq,'pages.edit') is distinct from true or academy2_access.can(p_hq,'public_price.edit') is distinct from true
 or academy2_access.can(p_hq,'applications.operate') is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into d from academy2_access.sales_plan_drafts where id=p_plan and headquarters_id=p_hq;
 if not found then raise exception 'academy2_plan_unavailable' using errcode='42501';end if;
 select * into pub from academy2_access.plan_publications where plan_id=p_plan and headquarters_id=p_hq;
 select revision into event_revision from academy2_access.event_plans where class_id=pub.event_id and headquarters_id=p_hq;
 -- Preserve all current non-event checks, including contract, seller, bank,
 -- terms, materials and unsupported-sales-type guards. Do not infer readiness
 -- from the local browser or from the wording of a policy document.
 base:=academy2_access.plan_publication_readiness(p_hq,p_plan,p_plan_revision,p_page_revision,pub.event_id,event_revision);
 select coalesce(jsonb_agg(value),'[]'::jsonb) into reasons
 from jsonb_array_elements(base->'reasons')
 where value#>>'{}' not in('event_required','event_revision_changed','event_not_ready','materials_event_not_needed')
 and not(value#>>'{}'='kit_public_application_pending' and d.configuration#>'{kit,contract_version}' is not distinct from '2'::jsonb);
 management:=public.academy2_management(p_hq,'plan',p_plan);
 if jsonb_typeof(management->'archived') is distinct from 'boolean' then
  reasons:=reasons||'"management_status_unavailable"'::jsonb;
 elsif management->'archived'='true'::jsonb then reasons:=reasons||'"plan_archived"'::jsonb;end if;
 select * into page from academy2_access.sales_pages where plan_id=p_plan and headquarters_id=p_hq;
 if page.plan_id is null then
  generated:=academy2_access.sales_page(p_hq,p_plan);
  if not academy2_access.sales_page_blocks_valid(generated->'blocks',d.configuration->'course_ids')
  or jsonb_array_length(generated->'blocks')=0 then reasons:=reasons||'"page_content_required"'::jsonb;end if;
 elsif not academy2_access.sales_page_blocks_valid(page.blocks,d.configuration->'course_ids')
 or jsonb_array_length(page.blocks)=0 then reasons:=reasons||'"page_content_required"'::jsonb;end if;
 if exists(select 1 from academy2_access.plan_publications p join public.academy_offerings o on o.id=p.offering_id
 where p.plan_id=p_plan and p.headquarters_id=p_hq and o.status='published')
 and not exists(select 1 from academy2_access.information_page_publications info where info.plan_id=p_plan and info.headquarters_id=p_hq and info.plan_revision=d.revision) then
  reasons:=reasons||'"existing_accepting_publication_unchanged"'::jsonb;
 end if;
 return jsonb_build_object('ready',jsonb_array_length(reasons)=0,'reasons',reasons,
 'plan_revision',d.revision,'page_revision',coalesce(page.revision,0),'event_required',false,'starts_new_trial',false);
end $$;

create function academy2_access.information_page_command(p_hq uuid,p_plan uuid,p_plan_revision integer,p_page_revision integer,p_request uuid,p_visible boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
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
    'main_image_url',c.main_image_url,'description',c.description,'can_do_after',c.can_do_after,'duration_text',c.duration_text)
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
end $$;

create function academy2_access.public_information_page(p_plan uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p academy2_access.information_page_publications; offer uuid; ctx jsonb; application_path text;
begin
 select * into p from academy2_access.information_page_publications where plan_id=p_plan and visible;
 if not found or public.academy_is_publicly_available(p.headquarters_id) is distinct from true
 or not exists(select 1 from academy2_access.tenants t where t.headquarters_id=p.headquarters_id and t.runtime_enabled) then return null;end if;
 -- Only an independently completed existing commercial publication can expose
 -- the canonical intake URL, and only while its exact saved conditions match.
 select x.offering_id into offer from academy2_access.plan_publications x
 where x.plan_id=p_plan and x.headquarters_id=p.headquarters_id and x.plan_revision=p.plan_revision and x.page_revision=p.page_revision;
 if offer is not null then
  ctx:=academy2_access.public_intake_with_form(offer,false);
  if ctx->>'mode'='headquarters' and ctx#>>'{offering,id}'=offer::text
  and ctx#>>'{offering,headquarters_id}'=p.headquarters_id::text
  and ctx#>>'{offering,status}'='published'
  and nullif(btrim(ctx#>>'{terms,body}'),'') is not null and nullif(btrim(ctx#>>'{terms,version}'),'') is not null
  and jsonb_array_length(coalesce(ctx#>'{applicationForm,readinessReasons}','[]'::jsonb))=0
  and (ctx->'eventRequired'='false'::jsonb or (ctx->'eventRequired'='true'::jsonb and exists(
   select 1 from jsonb_array_elements(coalesce(ctx->'events','[]')) e
   join public.academy_classes c on c.id=(e->>'id')::uuid
   where c.headquarters_id=p.headquarters_id and c.registration_status='open' and c.status in('planned','active')
   and coalesce(e->>'formReady','true')<>'false' and (c.capacity is null or c.capacity>(select count(*) from academy2_access.event_attendees(p.headquarters_id,c.id)))
   and (c.schedule_mode='arranged_after_application' or coalesce(c.ends_at,c.starts_at)>now())
  ))) then application_path:='/academy/o/'||offer::text;end if;
 end if;
 return p.payload||jsonb_build_object('plan_revision',p.plan_revision,'page_revision',p.page_revision,
 'published_at',p.published_at,'visible',true,'accepting',application_path is not null,'application_path',application_path);
end $$;

create function academy2_access.information_page_status(p_hq uuid,p_plan uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p academy2_access.information_page_publications; d academy2_access.sales_plan_drafts; page_revision integer;
begin
 if auth.uid() is null or academy2_access.can(p_hq,'pages.edit') is distinct from true then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into d from academy2_access.sales_plan_drafts where id=p_plan and headquarters_id=p_hq;
 if not found then raise exception 'academy2_plan_unavailable' using errcode='42501';end if;
 select revision into page_revision from academy2_access.sales_pages where plan_id=p_plan and headquarters_id=p_hq;
 select * into p from academy2_access.information_page_publications where plan_id=p_plan and headquarters_id=p_hq;
 return jsonb_build_object('state',case when p.plan_id is null then 'not_published' when p.visible then 'published' else 'unpublished' end,
 'plan_id',p_plan,'headquarters_id',p_hq,'plan_revision',p.plan_revision,'page_revision',p.page_revision,
 'published_at',p.published_at,'public_path',case when p.plan_id is not null then '/academy/page/'||p_plan::text else null end,
 'has_unpublished_changes',p.plan_id is not null and (p.plan_revision<>d.revision or p.page_revision is distinct from page_revision));
end $$;
revoke all on function academy2_access.information_page_readiness(uuid,uuid,integer,integer),
 academy2_access.information_page_command(uuid,uuid,integer,integer,uuid,boolean),
 academy2_access.public_information_page(uuid),academy2_access.information_page_status(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.information_page_readiness(uuid,uuid,integer,integer),
 academy2_access.information_page_command(uuid,uuid,integer,integer,uuid,boolean),academy2_access.information_page_status(uuid,uuid) to authenticated;
grant execute on function academy2_access.public_information_page(uuid) to anon,authenticated;

create function public.academy2_sales_page_publication_readiness(p_headquarters_id uuid,p_plan_id uuid,p_plan_revision integer,p_page_revision integer)
returns jsonb language sql stable security invoker set search_path='' as $$
 select academy2_access.information_page_readiness(p_headquarters_id,p_plan_id,p_plan_revision,p_page_revision)
$$;
create function public.academy2_publish_information_page(p_headquarters_id uuid,p_plan_id uuid,p_plan_revision integer,p_page_revision integer,p_request_id uuid,p_visible boolean)
returns jsonb language sql security invoker set search_path='' as $$
 select academy2_access.information_page_command(p_headquarters_id,p_plan_id,p_plan_revision,p_page_revision,p_request_id,p_visible)
$$;
create function public.academy2_public_information_page(p_plan_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.public_information_page(p_plan_id)$$;
create function public.academy2_information_page_status(p_headquarters_id uuid,p_plan_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.information_page_status(p_headquarters_id,p_plan_id)$$;
create function academy2_access.public_information_pages(p_hq uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('plan_id',p.plan_id,'headquarters_id',p.headquarters_id,
 'title',p.payload->>'title','price',p.payload->'price','currency','JPY',
 'main_image_url',p.payload#>>'{courses,0,main_image_url}','public_path','/academy/page/'||p.plan_id::text)
 order by p.published_at desc,p.plan_id),'[]'::jsonb)
 from academy2_access.information_page_publications p
 where p.headquarters_id=p_hq and p.visible and public.academy_is_publicly_available(p_hq) is true
 and exists(select 1 from academy2_access.tenants t where t.headquarters_id=p_hq and t.runtime_enabled)
 and not exists(select 1 from academy2_access.plan_publications x join public.academy_offerings o on o.id=x.offering_id
 where x.plan_id=p.plan_id and x.headquarters_id=p_hq and o.status='published')
$$;
create function public.academy2_public_information_pages(p_headquarters_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.public_information_pages(p_headquarters_id)$$;

create function academy2_access.event_preparation_readiness(p_hq uuid,p_plan uuid,p_plan_revision integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare page_revision integer; ready jsonb; reasons jsonb;
begin
 select p.revision into page_revision from academy2_access.sales_pages p where p.plan_id=p_plan and p.headquarters_id=p_hq;
 ready:=academy2_access.information_page_readiness(p_hq,p_plan,p_plan_revision,coalesce(page_revision,0));
 select coalesce(jsonb_agg(value),'[]'::jsonb) into reasons from jsonb_array_elements(ready->'reasons')
 where value#>>'{}'<>'existing_accepting_publication_unchanged';
 return ready||jsonb_build_object('ready',jsonb_array_length(reasons)=0,'reasons',reasons);
end $$;
create function public.academy2_event_preparation_readiness(p_headquarters_id uuid,p_plan_id uuid,p_plan_revision integer)
returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.event_preparation_readiness(p_headquarters_id,p_plan_id,p_plan_revision)$$;
-- Opt-in create endpoint: original create/edit RPCs are not replaced. Callers
-- migrate only create operations to this endpoint after local/full-schema QA.
create function academy2_access.create_ready_event(p_hq uuid,p_request uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plan uuid; ready jsonb;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'academy2_invalid_event' using errcode='22023';end if;
 plan:=(p_input->>'plan_id')::uuid;
 if plan is null then raise exception 'academy2_invalid_event' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(plan::text,0));
 ready:=academy2_access.event_preparation_readiness(p_hq,plan,(p_input->>'plan_revision')::integer);
 if (ready->>'ready')::boolean is distinct from true then raise exception 'academy2_event_plan_not_ready' using errcode='22023',detail=(ready->'reasons')::text;end if;
 return academy2_access.write_event(p_hq,null,0,p_request,p_input);
end $$;
create function public.academy2_create_ready_event(p_headquarters_id uuid,p_request_id uuid,p_input jsonb)
returns jsonb language sql security invoker set search_path='' as $$select academy2_access.create_ready_event(p_headquarters_id,p_request_id,p_input)$$;
revoke all on function academy2_access.public_information_pages(uuid),public.academy2_public_information_pages(uuid),
 academy2_access.event_preparation_readiness(uuid,uuid,integer),public.academy2_event_preparation_readiness(uuid,uuid,integer),
 academy2_access.create_ready_event(uuid,uuid,jsonb),public.academy2_create_ready_event(uuid,uuid,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function academy2_access.public_information_pages(uuid),public.academy2_public_information_pages(uuid) to anon,authenticated;
grant execute on function academy2_access.event_preparation_readiness(uuid,uuid,integer),public.academy2_event_preparation_readiness(uuid,uuid,integer),
 academy2_access.create_ready_event(uuid,uuid,jsonb),public.academy2_create_ready_event(uuid,uuid,jsonb) to authenticated;

-- Compound creation must preserve the canonical fulfillment/individual/private
-- location transaction. Do not substitute the simpler create-event endpoint.
-- Fail on an unrecognized canonical signature rather than guessing an overload.
do $dependency$
begin
 if to_regprocedure('public.academy2_write_event_with_location(uuid,uuid,integer,uuid,jsonb,jsonb,boolean,jsonb)') is null then
  raise exception 'academy2_unrecognized_compound_event_dependency';
 end if;
end $dependency$;
create function public.academy2_write_ready_event_with_location(
 p_hq uuid,p_event uuid,p_expected integer,p_request uuid,p_input jsonb,
 p_fulfillment jsonb,p_individual boolean,p_location jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare plan uuid; ready jsonb;
begin
 -- New events only. Existing event edits stay on their original endpoint.
 if p_event is not null or p_expected is distinct from 0 or p_request is null
 or p_input is null or jsonb_typeof(p_input)<>'object' then
  raise exception 'academy2_ready_event_create_only' using errcode='22023';
 end if;
 plan:=(p_input->>'plan_id')::uuid;
 if plan is null then raise exception 'academy2_invalid_event' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(plan::text,0));
 ready:=academy2_access.event_preparation_readiness(p_hq,plan,(p_input->>'plan_revision')::integer);
 if (ready->>'ready')::boolean is distinct from true then
  raise exception 'academy2_event_plan_not_ready' using errcode='22023',detail=(ready->'reasons')::text;
 end if;
 return public.academy2_write_event_with_location(p_hq,p_event,p_expected,p_request,p_input,p_fulfillment,p_individual,p_location);
end $$;
revoke all on function public.academy2_write_ready_event_with_location(uuid,uuid,integer,uuid,jsonb,jsonb,boolean,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.academy2_write_ready_event_with_location(uuid,uuid,integer,uuid,jsonb,jsonb,boolean,jsonb) to authenticated;

do $management_dependency$
begin
 if to_regprocedure('public.academy2_management_command(uuid,text,uuid,text,integer,uuid,text)') is null
 or to_regprocedure('public.academy2_management(uuid,text,uuid)') is null then
  raise exception 'academy2_unrecognized_management_dependency';
 end if;
end $management_dependency$;
create function academy2_access.archive_private_plan(p_hq uuid,p_plan uuid,p_expected integer,p_request uuid,p_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or academy2_access.can(p_hq,'pages.edit') is distinct from true then
  raise exception 'academy2_forbidden' using errcode='42501';
 end if;
 if not exists(select 1 from academy2_access.sales_plan_drafts d where d.id=p_plan and d.headquarters_id=p_hq) then
  raise exception 'academy2_plan_unavailable' using errcode='42501';
 end if;
 -- Serialize with information-page publish/unpublish and canonical commercial
 -- publication. Restore and unrelated management actions keep their old paths.
 perform pg_advisory_xact_lock(hashtextextended(p_plan::text,0));
 if exists(select 1 from academy2_access.information_page_publications p
  where p.plan_id=p_plan and p.headquarters_id=p_hq and p.visible)
 or exists(select 1 from academy2_access.plan_publications p join public.academy_offerings o on o.id=p.offering_id
  where p.plan_id=p_plan and p.headquarters_id=p_hq and o.status='published') then
  raise exception 'academy2_archive_public_plan' using errcode='22023';
 end if;
 -- Canonical actor/role, expected revision, source, history, reference and archive
 -- validation is retained. This wrapper never impersonates another auth.uid().
 return public.academy2_management_command(p_hq,'plan',p_plan,'archive',p_expected,p_request,p_source);
end $$;
create function public.academy2_archive_private_plan(p_headquarters_id uuid,p_id uuid,p_expected_revision integer,p_request_id uuid,p_source_version text)
returns jsonb language sql security invoker set search_path='' as $$
 select academy2_access.archive_private_plan(p_headquarters_id,p_id,p_expected_revision,p_request_id,p_source_version)
$$;
revoke all on function academy2_access.archive_private_plan(uuid,uuid,integer,uuid,text),public.academy2_archive_private_plan(uuid,uuid,integer,uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function academy2_access.archive_private_plan(uuid,uuid,integer,uuid,text),public.academy2_archive_private_plan(uuid,uuid,integer,uuid,text) to authenticated;
revoke all on function public.academy2_sales_page_publication_readiness(uuid,uuid,integer,integer),
 public.academy2_publish_information_page(uuid,uuid,integer,integer,uuid,boolean),public.academy2_public_information_page(uuid),public.academy2_information_page_status(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.academy2_sales_page_publication_readiness(uuid,uuid,integer,integer),
 public.academy2_publish_information_page(uuid,uuid,integer,integer,uuid,boolean),public.academy2_information_page_status(uuid,uuid) to authenticated;
grant execute on function public.academy2_public_information_page(uuid) to anon,authenticated;
commit;
