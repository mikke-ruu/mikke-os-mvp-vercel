-- Production candidate; review and isolated validation required before approval.
-- LOCAL additive contract correction. Apply AFTER event_kit_shipping, not by reapplying its tables.
-- Preserve installed material/all-course/manual-payment/intake changes with guarded replacements.
create function academy2_access.hq_instructor_kit(p_config jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(p_config#>'{kit,enabled}'='true'::jsonb and p_config#>>'{kit,recipient}'='instructor'
 and p_config->>'study_style'='instructor' and (p_config->'allowed_methods')?'in_person',false)
$$;

create or replace function academy2_access.initialize_hq_shipping() returns trigger
language plpgsql security definer set search_path='' as $$
declare config jsonb;begin
 select configuration into config from academy2_access.sales_plan_draft_revisions where draft_id=new.plan_id and revision=new.plan_revision;
 if config#>'{kit,enabled}'='true'::jsonb then
  if config#>>'{kit,recipient}'='learner' then
   insert into academy2_access.hq_shipping(application_id) values(new.application_id);
  elsif academy2_access.hq_instructor_kit(config) and exists(
   select 1 from public.academy_classes c join academy2_access.event_plans ep on ep.class_id=c.id and ep.headquarters_id=c.headquarters_id
   where c.id=new.class_id and c.headquarters_id=new.headquarters_id and c.format='in_person'
   and c.status in('planned','active') and ep.plan_id=new.plan_id and ep.plan_revision=new.plan_revision) then
   -- Shipment targets are obtained from event_attendees; no per-learner address row is invented.
   null;
  else raise exception 'academy2_shipping_scope_on_hold' using errcode='22023';end if;
 end if;
 return new;
end $$;

-- Private projection. Instructor address/label/tracking are intentionally absent from individual applications.
create function academy2_access.hq_application_shipping(p_hq uuid,p_app uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e academy2_access.operation_enrollments;conf jsonb;c public.academy_classes;s academy2_access.hq_shipping;
 q uuid;dispatch academy2_access.event_kit_shipments;state text;
begin
 select * into e from academy2_access.operation_enrollments where application_id=p_app and headquarters_id=p_hq;
 select configuration into conf from academy2_access.sales_plan_draft_revisions where draft_id=e.plan_id and revision=e.plan_revision;
 if conf#>'{kit,enabled}'='true' and conf#>>'{kit,recipient}'='instructor' then
  select * into c from public.academy_classes where id=e.class_id and headquarters_id=p_hq;
  select r.id into q from public.academy_class_instructor_requests r join academy2_access.instructor_assignment_details d on d.request_id=r.id
  where r.class_id=c.id and r.headquarters_id=p_hq and r.instructor_id=c.instructor_id and r.status='accepted' order by r.created_at desc,r.id limit 1;
  select ship.* into dispatch from academy2_access.event_kit_shipments ship where ship.headquarters_id=p_hq and ship.class_id=e.class_id
  and ship.assignment_request_id=q and ship.plan_id=e.plan_id and ship.plan_revision=e.plan_revision
  and exists(select 1 from jsonb_array_elements(ship.participants)p where p->>'key'='offering:'||p_app::text)
  order by ship.recorded_at desc,ship.id limit 1;
  state:=case when not academy2_access.hq_instructor_kit(conf) or c.id is null or c.format<>'in_person' or c.status='cancelled' then 'blocked'
   when dispatch.id is not null then 'shipped' when q is null then 'waiting_assignment'
   when not exists(select 1 from academy2_access.event_kit_destinations where request_id=q) then 'awaiting_destination' else 'preparing' end;
  return jsonb_build_object('required',true,'recipient','instructor','eventId',e.class_id,'status',state,'address',null,
   'shippedAt',case when state='shipped' then dispatch.shipped_at end,'trackingNumber',null);
 end if;
 select hs.* into s from academy2_access.hq_shipping hs join academy2_access.operation_enrollments oe on oe.application_id=hs.application_id where hs.application_id=p_app and oe.headquarters_id=p_hq;
 return jsonb_build_object('required',s.application_id is not null,'recipient','learner','status',case when s.application_id is null then 'not_required' when s.shipped_at is not null then 'shipped' else 'preparing' end,
  'address',s.address,'shippedAt',s.shipped_at,'trackingNumber',s.tracking_number);
end $$;
create function academy2_access.hq_kit_completion_ready(p_hq uuid,p_app uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select v->>'required'='false' or v->>'status'='shipped' from (select academy2_access.hq_application_shipping(p_hq,p_app) v)q
$$;
create or replace function academy2_access.guard_hq_shipping_completion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.completed_at is null and new.completed_at is not null then
  -- Serialize the decision with assignment changes and event dispatch recording.
  perform 1 from public.academy_classes c join academy2_access.operation_enrollments e on e.class_id=c.id and e.headquarters_id=c.headquarters_id
  where e.application_id=old.id for update of c;
  if academy2_access.hq_kit_completion_ready(old.headquarters_id,old.id) is distinct from true then raise exception 'academy2_shipping_not_complete' using errcode='22023';end if;
 end if;
 return new;
end $$;
revoke all on function academy2_access.hq_instructor_kit(jsonb),academy2_access.hq_application_shipping(uuid,uuid),academy2_access.hq_kit_completion_ready(uuid,uuid) from public,anon,authenticated,service_role;

do $patch$
declare fn text;old_text text;new_text text;definition text;routine regprocedure;
begin
 for fn,old_text,new_text in select * from(values
 ('bind_operation_source',$old$(coalesce((r.configuration#>>'{kit,enabled}')::boolean,false) and r.configuration#>>'{kit,recipient}' is distinct from 'learner')$old$,$new$(coalesce((r.configuration#>>'{kit,enabled}')::boolean,false) and r.configuration#>>'{kit,recipient}' is distinct from 'learner' and not academy2_access.hq_instructor_kit(r.configuration))$new$),
 ('plan_publication_readiness',$old$if coalesce((conf#>>'{kit,enabled}')::boolean,false) then reasons:=reasons||'"kit_public_application_pending"'::jsonb;end if;$old$,$new$if coalesce((conf#>>'{kit,enabled}')::boolean,false) and not(academy2_access.hq_instructor_kit(conf) and exists(select 1 from public.academy_classes kit_event where kit_event.id=p_event and kit_event.headquarters_id=p_hq and kit_event.format='in_person')) then reasons:=reasons||'"kit_public_application_pending"'::jsonb;end if;$new$),
 ('public_intake',$old$and (cfg->'allowed_methods')?c.format;$old$,$new$and (cfg->'allowed_methods')?c.format and (not academy2_access.hq_instructor_kit(cfg) or c.format='in_person');$new$),
 ('event_kit_shipping',$old$and c.status in('planned','active')$old$,$new$and c.status in('planned','active','completed')$new$),
 ('hq_application',$old$and (s.application_id is null or s.shipped_at is not null)$old$,$new$and academy2_access.hq_kit_completion_ready(p_hq,p_id)$new$),
 ('hq_application',$old$kit_status:=case when s.application_id is null then 'not_required' when s.shipped_at is not null then 'shipped' else 'preparing' end;$old$,$new$kit_status:=academy2_access.hq_application_shipping(p_hq,p_id)->>'status';$new$),
 ('hq_application',$old$when actions?'confirm_completion' then 'confirm_completion'$old$,$new$when config#>>'{kit,recipient}'='instructor' and not academy2_access.hq_kit_completion_ready(p_hq,p_id) then 'event_kit_shipping' when actions?'confirm_completion' then 'confirm_completion'$new$),
 ('hq_application',$old$when s.application_id is not null and s.shipped_at is null then '発送準備中'$old$,$new$when not academy2_access.hq_kit_completion_ready(p_hq,p_id) then '発送準備中'$new$),
 ('hq_application',$old$jsonb_build_object('required',s.application_id is not null,'status',kit_status,'address',s.address,'shippedAt',s.shipped_at,'trackingNumber',s.tracking_number)$old$,$new$academy2_access.hq_application_shipping(p_hq,p_id)$new$),
 ('operation_view',$old$when a.completed_at is null then case when academy2_access.can(p_hq,'applications.operate') then 'confirm_completion' else 'wait' end$old$,$new$when a.completed_at is null and academy2_access.hq_application_shipping(p_hq,p_id)->>'recipient'='instructor' and not academy2_access.hq_kit_completion_ready(p_hq,p_id) then case when academy2_access.can(p_hq,'applications.operate') then 'event_kit_shipping' else 'wait' end
 when a.completed_at is null then case when academy2_access.can(p_hq,'applications.operate') then 'confirm_completion' else 'wait' end$new$)
 )changes(function_name,old_value,new_value) loop
  select p.oid::regprocedure into strict routine from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academy2_access' and p.proname=fn;
  definition:=pg_get_functiondef(routine);
  if position(new_text in definition)>0 then continue;end if;
  if position(old_text in definition)=0 then raise exception 'academy2_unrecognized_instructor_kit_contract: %',fn;end if;
  execute replace(definition,old_text,new_text);
 end loop;
end $patch$;
notify pgrst,'reload schema';
