-- Production candidate; review and isolated validation required before approval.
-- LOCAL candidate. Records an actual human-confirmed dispatch; no carrier, billing or notification call.
create table academy2_access.event_kit_shipping_state(
 class_id uuid primary key references public.academy_classes(id) on delete restrict,
 revision integer not null default 0 check(revision>=0)
);
create table academy2_access.event_kit_shipments(
 id uuid primary key default gen_random_uuid(),
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 class_id uuid not null references public.academy_classes(id) on delete restrict,
 assignment_request_id uuid not null references public.academy_class_instructor_requests(id) on delete restrict,
 instructor_id uuid not null references public.academy_instructors(id) on delete restrict,
 destination_revision integer not null,address_snapshot text not null,event_snapshot jsonb not null,assignment_snapshot jsonb not null,
 plan_id uuid not null,plan_revision integer not null,kit_name text,
 participants jsonb not null check(jsonb_typeof(participants)='array' and jsonb_array_length(participants)>0),
 shipped_at timestamptz not null,tracking_number text check(length(tracking_number)<=200),
 recorded_by uuid not null references auth.users(id),recorded_at timestamptz not null default clock_timestamp(),
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision)
);
create table academy2_access.event_kit_shipment_commands(
 request_id uuid primary key,headquarters_id uuid not null,class_id uuid not null,
 shipment_id uuid not null references academy2_access.event_kit_shipments(id),
 actor_id uuid not null references auth.users(id),expected_revision integer not null,input jsonb not null
);
alter table academy2_access.event_kit_shipping_state enable row level security;
alter table academy2_access.event_kit_shipments enable row level security;
alter table academy2_access.event_kit_shipment_commands enable row level security;
revoke all on academy2_access.event_kit_shipping_state,academy2_access.event_kit_shipments,academy2_access.event_kit_shipment_commands from public,anon,authenticated,service_role;
create index academy2_event_kit_shipments_class on academy2_access.event_kit_shipments(class_id,assignment_request_id);

create function academy2_access.event_kit_shipping(p_hq uuid,p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.academy_classes;ep academy2_access.event_plans;q public.academy_class_instructor_requests;conf jsonb;
 dest jsonb;roster jsonb;history jsonb;active boolean:=false;remaining integer;rev integer;
begin
 if not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq;
 if c.id is null then raise exception 'academy2_event_unavailable' using errcode='42501';end if;
 select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq;
 select configuration into conf from academy2_access.sales_plan_draft_revisions where draft_id=ep.plan_id and revision=ep.plan_revision;
 select r.* into q from public.academy_class_instructor_requests r join academy2_access.instructor_assignment_details d on d.request_id=r.id
 where r.class_id=p_event and r.headquarters_id=p_hq and r.instructor_id=c.instructor_id and r.status='accepted'
 order by r.created_at desc,r.id limit 1;
 if q.id is not null then dest:=academy2_access.event_kit_destination(q.id);active:=coalesce((dest->>'applicable')::boolean,false);end if;
 select coalesce(jsonb_agg(jsonb_build_object('key',id,'name',name) order by id),'[]') into roster from academy2_access.event_attendees(p_hq,p_event);
 select count(*) into remaining from jsonb_array_elements(roster) p where not exists(
  select 1 from academy2_access.event_kit_shipments s,jsonb_array_elements(s.participants) target
  where s.class_id=p_event and s.headquarters_id=p_hq and s.assignment_request_id=q.id and target->>'key'=p->>'key');
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'assignmentRequestId',s.assignment_request_id,'instructorId',s.instructor_id,
  'currentRecipient',active and s.assignment_request_id=q.id,
  'address',case when active and s.assignment_request_id=q.id then s.address_snapshot end,
  'trackingNumber',case when active and s.assignment_request_id=q.id then s.tracking_number end,
  'destinationRevision',s.destination_revision,'eventSnapshot',s.event_snapshot,'assignmentSnapshot',s.assignment_snapshot,'planId',s.plan_id,'planRevision',s.plan_revision,'kitName',s.kit_name,
  'participants',s.participants,'quantity',jsonb_array_length(s.participants),'shippedAt',s.shipped_at,'recordedAt',s.recorded_at) order by s.recorded_at,s.id),'[]')
 into history from academy2_access.event_kit_shipments s where s.headquarters_id=p_hq and s.class_id=p_event;
 select revision into rev from academy2_access.event_kit_shipping_state where class_id=p_event;
 return jsonb_build_object('eventId',p_event,'headquartersId',p_hq,'revision',coalesce(rev,0),'applicable',active,
  'assignmentRequestId',case when active then q.id end,'destinationRevision',case when active then (dest->>'revision')::integer end,
  'address',case when active then dest->>'selectedAddress' end,'kitName',conf#>>'{kit,name}',
  'roster',roster,'rosterToken',md5(roster::text),'remainingCount',remaining,'shipments',history,
  'canRecord',academy2_access.can(p_hq,'applications.operate') and active and dest->>'selectedAddress' is not null and remaining>0 and c.status in('planned','active'));
end $$;

create function academy2_access.record_event_kit_shipping(p_hq uuid,p_event uuid,p_expected integer,p_request uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior academy2_access.event_kit_shipment_commands;ep academy2_access.event_plans;v jsonb;target_keys jsonb;targets jsonb;
 shipped timestamptz;shipment uuid:=gen_random_uuid();q uuid;dest academy2_access.event_kit_destinations;
begin
 if not academy2_access.can(p_hq,'applications.operate') or not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_expected is null or p_expected<0 or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'academy2_invalid_shipment' using errcode='22023';end if;
 -- Lock order matches event writes (plan then class). Class lock serializes intake, assignment and destination selection.
 select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq for update;
 if not found then raise exception 'academy2_event_unavailable' using errcode='42501';end if;
 perform 1 from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,271000));
 select * into prior from academy2_access.event_kit_shipment_commands where request_id=p_request;
 if found then
  if prior.headquarters_id<>p_hq or prior.class_id<>p_event or prior.actor_id<>auth.uid() or prior.expected_revision<>p_expected or prior.input<>p_input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  -- Read through current redaction, never replay the old unredacted address payload.
  return academy2_access.event_kit_shipping(p_hq,p_event);
 end if;
 if exists(select 1 from jsonb_each(p_input) x where x.key not in('assignmentRequestId','destinationRevision','rosterToken','participantKeys','shippedAt','trackingNumber')
 or (x.key='participantKeys' and jsonb_typeof(x.value)<>'array') or (x.key='destinationRevision' and jsonb_typeof(x.value)<>'number')
 or (x.key not in('participantKeys','destinationRevision') and jsonb_typeof(x.value)<>'string')) then raise exception 'academy2_invalid_shipment' using errcode='22023';end if;
 v:=academy2_access.event_kit_shipping(p_hq,p_event);
 if (v->>'revision')::integer<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 if v->>'canRecord' is distinct from 'true' then raise exception 'academy2_shipment_not_ready' using errcode='22023';end if;
 if p_input->>'assignmentRequestId' is distinct from v->>'assignmentRequestId' or p_input->'destinationRevision' is distinct from v->'destinationRevision' or p_input->>'rosterToken' is distinct from v->>'rosterToken' then raise exception 'academy2_shipment_context_changed' using errcode='PT409';end if;
 target_keys:=p_input->'participantKeys';
 if target_keys is null or jsonb_typeof(target_keys)<>'array' or jsonb_array_length(target_keys)=0 then raise exception 'academy2_shipment_targets_required' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(target_keys) t where jsonb_typeof(t)<>'string') or jsonb_array_length(target_keys)<>(select count(distinct t) from jsonb_array_elements_text(target_keys)t) then raise exception 'academy2_invalid_shipment_targets' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements_text(target_keys)t where not exists(select 1 from jsonb_array_elements(v->'roster') p where p->>'key'=t)) then raise exception 'academy2_participant_unavailable' using errcode='42501';end if;
 q:=(v->>'assignmentRequestId')::uuid;
 if exists(select 1 from academy2_access.event_kit_shipments s,jsonb_array_elements(s.participants)p where s.class_id=p_event and s.assignment_request_id=q and target_keys?(p->>'key')) then raise exception 'academy2_target_already_shipped' using errcode='22023';end if;
 select coalesce(jsonb_agg(p order by p->>'key'),'[]') into targets from jsonb_array_elements(v->'roster') p where target_keys?(p->>'key');
 select * into dest from academy2_access.event_kit_destinations where request_id=q;
 begin shipped:=(p_input->>'shippedAt')::timestamptz;exception when others then raise exception 'academy2_invalid_shipping_date' using errcode='22023';end;
 if shipped is null or not isfinite(shipped) or shipped>clock_timestamp() or shipped<dest.selected_at or length(coalesce(p_input->>'trackingNumber',''))>200 then raise exception 'academy2_invalid_shipping_date' using errcode='22023';end if;
 insert into academy2_access.event_kit_shipments(id,headquarters_id,class_id,assignment_request_id,instructor_id,destination_revision,address_snapshot,event_snapshot,assignment_snapshot,plan_id,plan_revision,kit_name,participants,shipped_at,tracking_number,recorded_by)
 select shipment,p_hq,p_event,q,r.instructor_id,dest.revision,dest.address_snapshot,
 jsonb_build_object('id',c.id,'title',c.title,'startsAt',c.starts_at,'endsAt',c.ends_at,'format',c.format,'venueName',c.venue_name),
 jsonb_build_object('requestId',r.id,'instructorId',r.instructor_id,'instructorName',i.business_name,'requestedAt',r.created_at),
 ep.plan_id,ep.plan_revision,v->>'kitName',targets,shipped,nullif(btrim(p_input->>'trackingNumber'),''),auth.uid()
 from public.academy_class_instructor_requests r join public.academy_classes c on c.id=r.class_id join public.academy_instructors i on i.id=r.instructor_id where r.id=q;
 insert into academy2_access.event_kit_shipping_state(class_id,revision) values(p_event,1) on conflict(class_id) do update set revision=event_kit_shipping_state.revision+1;
 insert into academy2_access.event_kit_shipment_commands values(p_request,p_hq,p_event,shipment,auth.uid(),p_expected,p_input);
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'event.kit_shipping.record',shipment);
 return academy2_access.event_kit_shipping(p_hq,p_event);
end $$;
revoke all on function academy2_access.event_kit_shipping(uuid,uuid),academy2_access.record_event_kit_shipping(uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
create function public.academy2_event_kit_shipping(p_headquarters_id uuid,p_event_id uuid) returns jsonb language sql stable security definer set search_path='' as $$select academy2_access.event_kit_shipping(p_headquarters_id,p_event_id)$$;
create function public.academy2_record_event_kit_shipping(p_headquarters_id uuid,p_event_id uuid,p_expected_revision integer,p_request_id uuid,p_input jsonb) returns jsonb language sql security definer set search_path='' as $$select academy2_access.record_event_kit_shipping(p_headquarters_id,p_event_id,p_expected_revision,p_request_id,p_input)$$;
revoke all on function public.academy2_event_kit_shipping(uuid,uuid),public.academy2_record_event_kit_shipping(uuid,uuid,integer,uuid,jsonb) from public,anon,service_role;
grant execute on function public.academy2_event_kit_shipping(uuid,uuid),public.academy2_record_event_kit_shipping(uuid,uuid,integer,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
