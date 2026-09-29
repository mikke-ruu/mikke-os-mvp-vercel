-- Production candidate; review and isolated validation required before approval.
-- LOCAL candidate only; no production application. Instructor explicitly shares one address snapshot.
create table academy2_access.event_kit_destinations(
 request_id uuid primary key references public.academy_class_instructor_requests(id),
 address_id uuid references public.academy_instructor_addresses(id) on delete set null,
 address_snapshot text not null check(length(btrim(address_snapshot))>0),
 revision integer not null default 1, selected_by uuid not null references auth.users(id), selected_at timestamptz not null default now()
);
create table academy2_access.event_kit_destination_commands(command_id uuid primary key,request_id uuid not null references public.academy_class_instructor_requests(id),actor_id uuid not null references auth.users(id),body jsonb not null);
alter table academy2_access.event_kit_destinations enable row level security;
alter table academy2_access.event_kit_destination_commands enable row level security;
revoke all on academy2_access.event_kit_destinations,academy2_access.event_kit_destination_commands from public,anon,authenticated,service_role;
create function academy2_access.event_kit_destination(p_request uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q public.academy_class_instructor_requests;d academy2_access.instructor_assignment_details;c public.academy_classes;conf jsonb;dest academy2_access.event_kit_destinations;own boolean;applicable boolean;options jsonb:='[]';
begin
 select * into q from public.academy_class_instructor_requests where id=p_request;
 select * into d from academy2_access.instructor_assignment_details where request_id=p_request;
 if q.id is null or d.request_id is null or auth.uid() is null then raise exception 'forbidden' using errcode='42501';end if;
 own:=coalesce(d.instructor_user_id=auth.uid(),false) and exists(select 1 from public.academy_instructors where id=q.instructor_id and user_id=auth.uid() and headquarters_id=q.headquarters_id);
 if not exists(select 1 from academy2_access.tenants where headquarters_id=q.headquarters_id and runtime_enabled) then raise exception 'forbidden' using errcode='42501';end if;
 if not own and not academy2_access.can(q.headquarters_id,'applications.read') then raise exception 'forbidden' using errcode='42501';end if;
 select * into c from public.academy_classes where id=q.class_id and headquarters_id=q.headquarters_id;
 select r.configuration into conf from academy2_access.event_plans ep join academy2_access.sales_plan_draft_revisions r on r.draft_id=ep.plan_id and r.revision=ep.plan_revision where ep.class_id=q.class_id and ep.headquarters_id=q.headquarters_id;
 applicable:=q.status='accepted' and c.instructor_id=q.instructor_id and c.format='in_person' and coalesce(conf#>'{kit,enabled}'='true',false) and conf#>>'{kit,recipient}'='instructor';
 if applicable then
  select * into dest from academy2_access.event_kit_destinations where request_id=p_request;
  if own then select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'address',address_text) order by created_at,id),'[]') into options from public.academy_instructor_addresses where instructor_id=q.instructor_id and nullif(btrim(address_text),'') is not null;end if;
 end if;
 return jsonb_build_object('requestId',p_request,'applicable',coalesce(applicable,false),'canSelect',own and applicable and c.status='planned' and academy2_access.instructor_assignment_eligible(q.headquarters_id,q.class_id,q.instructor_id),'revision',coalesce(dest.revision,0),'selectedAddressId',dest.address_id,'selectedAddress',dest.address_snapshot,'selectedAt',dest.selected_at,'options',options);
end $$;
create function academy2_access.save_event_kit_destination(p_request uuid,p_address uuid,p_expected integer,p_command uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.academy_class_instructor_requests;destination_view jsonb;address_value text;body jsonb;prior academy2_access.event_kit_destination_commands;
begin
 if auth.uid() is null or p_command is null or p_address is null or p_expected is null then raise exception 'invalid_destination' using errcode='22023';end if;
 select * into q from public.academy_class_instructor_requests where id=p_request;
 if q.id is null then raise exception 'forbidden' using errcode='42501';end if;
 perform 1 from public.academy_classes where id=q.class_id for update;
 perform pg_advisory_xact_lock(hashtextextended(p_command::text,0));
 body:=jsonb_build_object('addressId',p_address,'revision',p_expected);
 select * into prior from academy2_access.event_kit_destination_commands where command_id=p_command;
 if found then
  if prior.request_id<>p_request or prior.actor_id<>auth.uid() or prior.body<>body then raise exception 'destination_retry_changed' using errcode='PT409';end if;
  return academy2_access.event_kit_destination(p_request);
 end if;
 destination_view:=academy2_access.event_kit_destination(p_request);
 if destination_view->>'canSelect' is distinct from 'true' then raise exception 'forbidden' using errcode='42501';end if;
 if (destination_view->>'revision')::integer<>p_expected then raise exception 'destination_stale' using errcode='PT409';end if;
 select address_text into address_value from public.academy_instructor_addresses where id=p_address and instructor_id=q.instructor_id;
 if nullif(btrim(address_value),'') is null then raise exception 'forbidden' using errcode='42501';end if;
 insert into academy2_access.event_kit_destinations(request_id,address_id,address_snapshot,selected_by) values(p_request,p_address,address_value,auth.uid()) on conflict(request_id) do update set address_id=excluded.address_id,address_snapshot=excluded.address_snapshot,revision=event_kit_destinations.revision+1,selected_by=excluded.selected_by,selected_at=clock_timestamp();
 insert into academy2_access.event_kit_destination_commands values(p_command,p_request,auth.uid(),body);
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(q.headquarters_id,auth.uid(),'event_kit_destination.select',p_request);
 return academy2_access.event_kit_destination(p_request);
end $$;
create function public.academy2_event_kit_destination(p_request uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.event_kit_destination(p_request)$$;
create function public.academy2_save_event_kit_destination(p_request uuid,p_address uuid,p_expected integer,p_command uuid) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.save_event_kit_destination(p_request,p_address,p_expected,p_command)$$;
revoke all on function academy2_access.event_kit_destination(uuid),academy2_access.save_event_kit_destination(uuid,uuid,integer,uuid),public.academy2_event_kit_destination(uuid),public.academy2_save_event_kit_destination(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.event_kit_destination(uuid),academy2_access.save_event_kit_destination(uuid,uuid,integer,uuid),public.academy2_event_kit_destination(uuid),public.academy2_save_event_kit_destination(uuid,uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
