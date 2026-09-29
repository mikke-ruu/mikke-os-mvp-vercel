-- Production candidate; review and isolated validation required before approval.
-- Local review candidate. Parent applies only to owned isolated DB. No data changes at installation.
create table academy2_access.event_assignment_replacements (
 request_id uuid primary key,headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 class_id uuid not null references public.academy_classes(id),actor_id uuid not null references auth.users(id),
 expected_revision integer not null,input jsonb not null,old_request_id uuid not null references public.academy_class_instructor_requests(id),
 new_request_id uuid references public.academy_class_instructor_requests(id),transaction_id bigint,created_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.event_assignment_replacements enable row level security;
revoke all on academy2_access.event_assignment_replacements from public,anon,authenticated,service_role;
create function academy2_access.replace_event_assignment(p_hq uuid,p_event uuid,p_expected integer,p_command uuid,p_old_request uuid,p_old_revision integer,p_new_instructor uuid,p_amount bigint,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ep academy2_access.event_plans;c public.academy_classes;q public.academy_class_instructor_requests;d academy2_access.instructor_assignment_details;
 ledger academy2_access.event_assignment_replacements;body jsonb;new_command uuid;new_request uuid;
begin
 if not academy2_access.can(p_hq,'applications.operate') or not academy2_access.can(p_hq,'finance.read') then raise exception 'forbidden' using errcode='42501';end if;
 if private.academy_headquarters_access_mode(p_hq) is distinct from 'paid' then raise exception 'academy2_headquarters_not_live' using errcode='42501';end if;
 if p_command is null or p_expected is null or p_old_request is null or p_old_revision is null or p_new_instructor is null or p_amount is null or p_amount<0 or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'invalid_replacement' using errcode='22023';end if;
 body:=jsonb_build_object('oldRequestId',p_old_request,'oldRevision',p_old_revision,'newInstructorId',p_new_instructor,'amount',p_amount,'reason',btrim(p_reason));
 perform pg_advisory_xact_lock(hashtextextended(p_command::text,27));
 select * into ledger from academy2_access.event_assignment_replacements where request_id=p_command;
 if found then
  if ledger.headquarters_id<>p_hq or ledger.class_id<>p_event or ledger.actor_id<>auth.uid() or ledger.expected_revision<>p_expected or ledger.input<>body then raise exception 'replacement_retry_changed' using errcode='PT409';end if;
  return jsonb_build_object('event',academy2_access.event_detail(p_hq,p_event),'assignments',academy2_access.assignment_candidates(p_hq,p_event));
 end if;
 select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq for update;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if ep.revision<>p_expected then raise exception 'event_revision_conflict' using errcode='PT409';end if;
 select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
 select * into q from public.academy_class_instructor_requests where id=p_old_request and class_id=p_event and headquarters_id=p_hq for update;
 select * into d from academy2_access.instructor_assignment_details where request_id=p_old_request for update;
 if q.id is null or d.request_id is null or d.revision<>p_old_revision or q.status<>'accepted' or c.instructor_id is distinct from q.instructor_id then raise exception 'assignment_revision_conflict' using errcode='PT409';end if;
 if c.status<>'planned' or p_new_instructor=q.instructor_id or exists(select 1 from academy2_access.event_assignees where class_id=p_event)
 or exists(select 1 from public.academy_class_instructor_requests where class_id=p_event and id<>p_old_request and status in('requested','accepted')) then raise exception 'replacement_unavailable' using errcode='22023';end if;
 if not academy2_access.instructor_assignment_eligible(p_hq,p_event,p_new_instructor) then raise exception 'instructor_not_eligible' using errcode='42501';end if;
 insert into academy2_access.event_assignment_replacements(request_id,headquarters_id,class_id,actor_id,expected_revision,input,old_request_id,transaction_id)
 values(p_command,p_hq,p_event,auth.uid(),p_expected,body,p_old_request,txid_current());
 -- Keep original request/response notes, fee, destination and immutable shipment snapshots.
 update public.academy_class_instructor_requests set status='cancelled',updated_at=clock_timestamp() where id=p_old_request;
 update academy2_access.instructor_assignment_details set revision=revision+1 where request_id=p_old_request;
 update public.academy_classes set instructor_id=null,updated_at=clock_timestamp() where id=p_event;
 new_command:=gen_random_uuid();
 perform academy2_access.request_assignment(p_hq,p_event,p_new_instructor,new_command,p_amount,btrim(p_reason));
 select request_id into strict new_request from academy2_access.instructor_assignment_details where command_id=new_command;
 update academy2_access.event_assignment_replacements set new_request_id=new_request,transaction_id=null where request_id=p_command;
 update academy2_access.event_plans set revision=revision+1 where class_id=p_event;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'event.assignment.replace',p_event);
 return jsonb_build_object('event',academy2_access.event_detail(p_hq,p_event),'assignments',academy2_access.assignment_candidates(p_hq,p_event));
end $$;
revoke all on function academy2_access.replace_event_assignment(uuid,uuid,integer,uuid,uuid,integer,uuid,bigint,text) from public,anon,authenticated,service_role;
create function public.academy2_replace_event_assignment(p_headquarters_id uuid,p_event_id uuid,p_expected_revision integer,p_request_id uuid,p_old_request_id uuid,p_old_request_revision integer,p_new_instructor_id uuid,p_amount_yen bigint,p_reason text) returns jsonb
language sql security definer set search_path='' as $$select academy2_access.replace_event_assignment(p_headquarters_id,p_event_id,p_expected_revision,p_request_id,p_old_request_id,p_old_request_revision,p_new_instructor_id,p_amount_yen,p_reason)$$;
revoke all on function public.academy2_replace_event_assignment(uuid,uuid,integer,uuid,uuid,integer,uuid,bigint,text) from public,anon,service_role;
grant execute on function public.academy2_replace_event_assignment(uuid,uuid,integer,uuid,uuid,integer,uuid,bigint,text) to authenticated;
notify pgrst,'reload schema';
