-- Production candidate; review and isolated validation required before approval.
-- LOCAL REVIEW CANDIDATE. No installation-time data updates. Parent applies in isolated DB.
-- Attendance is an event record, never a completion, certification or payment decision.
create table academy2_access.event_attendance (
 class_id uuid not null references public.academy_classes(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 participant_key text not null check(participant_key ~ '^(legacy|offering):[0-9a-f-]{36}$'),
 status text not null check(status in('present','absent','late')),
 note text not null default '' check(length(note)<=2000),
 recorded_by uuid not null references auth.users(id),recorded_at timestamptz not null default clock_timestamp(),
 primary key(class_id,participant_key)
);
alter table academy2_access.event_attendance enable row level security;
revoke all on academy2_access.event_attendance from public,anon,authenticated,service_role;

create function academy2_access.event_operations(p_hq uuid,p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; participant record; row_data jsonb; people jsonb:='[]'; actions jsonb:='[]';
 a public.academy_offering_applications; old_app public.academy_applications; attendance academy2_access.event_attendance;
 c public.academy_classes; ep academy2_access.event_plans; finance boolean; operate boolean; unconfirmed integer:=0; detail jsonb;
begin
 -- Includes the canonical applications.read gate and HQ scope check.
 result:=academy2_access.event_detail(p_hq,p_event);
 select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq;
 select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq;
 finance:=academy2_access.can(p_hq,'finance.read');operate:=academy2_access.can(p_hq,'applications.operate');
 for participant in select * from academy2_access.event_attendees(p_hq,p_event) order by id loop
  select * into attendance from academy2_access.event_attendance where class_id=p_event and headquarters_id=p_hq and participant_key=participant.id;
  if attendance.class_id is null then unconfirmed:=unconfirmed+1;end if;
  row_data:=jsonb_build_object('key',participant.id,'name',participant.name,'source',split_part(participant.id,':',1),
   'attendance',coalesce(attendance.status,'unconfirmed'),'attendanceNote',coalesce(attendance.note,''),'recordedAt',attendance.recorded_at,
   'learnerPageAvailable',null,'application',null);
  if participant.id like 'offering:%' then
   select * into a from public.academy_offering_applications where id=split_part(participant.id,':',2)::uuid and headquarters_id=p_hq;
   -- Booking-only historical applications remain visible without inventing an enrollment.
   if exists(select 1 from academy2_access.operation_enrollments where application_id=a.id and headquarters_id=p_hq) then
    detail:=academy2_access.hq_application(p_hq,a.id);
    row_data:=row_data||jsonb_build_object('application',detail);
   end if;
   if finance then row_data:=row_data||jsonb_build_object('payment',jsonb_build_object('status',a.status,'method',a.payment_method,'amount',a.price,'currency',a.currency));end if;
  else
   select * into old_app from public.academy_applications where id=split_part(participant.id,':',2)::uuid and headquarters_id=p_hq;
   -- Legacy lifecycle fields are not treated as payment evidence or migrated.
   if finance then row_data:=row_data||jsonb_build_object('payment',jsonb_build_object('status',old_app.payment_status,'method',null,'amount',old_app.price,'currency','JPY'));end if;
  end if;
  people:=people||jsonb_build_array(row_data);
 end loop;
 if operate and ep.class_id is not null and c.status in('planned','active') and c.starts_at is not null and c.starts_at<=now() then
  actions:=actions||'"record_attendance"'::jsonb;
  if unconfirmed=0 and coalesce(c.ends_at,c.starts_at)<=now() then actions:=actions||'"finish_event"'::jsonb;end if;
 end if;
 return jsonb_build_object('event',result,'revision',ep.revision,'participants',people,'unconfirmedCount',unconfirmed,
  'permissions',jsonb_build_object('finance',finance,'operate',operate),'allowedActions',actions,
  'finishedAt',(select max(created_at) from academy2_access.event_commands where headquarters_id=p_hq and class_id=p_event and action='finish_event'));
end $$;

-- Narrow permit for the single class lifecycle transition, not a broad bypass.
create function academy2_access.has_event_finish_permit(p_hq uuid,p_event uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select academy2_access.can(p_hq,'applications.operate') and exists(
 select 1 from academy2_access.event_commands where headquarters_id=p_hq and class_id=p_event
 and actor_id=auth.uid() and action='finish_event' and transaction_id=txid_current())
$$;
do $install$
declare definition text;marker text:=E'\nbegin\n';addition text;
begin
 definition:=replace(pg_get_functiondef('private.academy_guard_trial_live_operation()'::regprocedure),E'\r\n',E'\n');
 if position(marker in definition)=0 or position('academy_headquarters_access_mode' in definition)=0 then raise exception 'academy2_unrecognized_live_guard';end if;
 addition:=$branch$
 if tg_table_schema='public' and tg_table_name='academy_classes' and tg_op='UPDATE' then
  if old.status in('planned','active') and new.status='completed' and new.registration_status='closed'
   and (to_jsonb(new)-array['status','registration_status','updated_at'])=(to_jsonb(old)-array['status','registration_status','updated_at'])
   and academy2_access.has_event_finish_permit(new.headquarters_id,new.id) then return new;end if;
 end if;
 $branch$;
 execute overlay(definition placing marker||addition from position(marker in definition) for length(marker));
end $install$;

create function academy2_access.event_operation_command(p_hq uuid,p_event uuid,p_expected integer,p_request uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ep academy2_access.event_plans;c public.academy_classes;cmd academy2_access.event_commands;keys text[];
begin
 if not academy2_access.can(p_hq,'applications.operate') or not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_expected is null or p_input is null or jsonb_typeof(p_input)<>'object' or p_action is null or p_action not in('record_attendance','finish_event') then raise exception 'academy2_invalid_event_command' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,12));
 select * into cmd from academy2_access.event_commands where request_id=p_request;
 if found then
  if cmd.headquarters_id<>p_hq or cmd.class_id<>p_event or cmd.actor_id<>auth.uid() or cmd.expected_revision<>p_expected or cmd.action<>p_action or cmd.input<>p_input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return academy2_access.event_operations(p_hq,p_event);
 end if;
 select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq for update;
 if not found then raise exception 'academy2_event_unavailable' using errcode='42501';end if;
 if ep.revision<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
 if c.status not in('planned','active') or c.starts_at is null or c.starts_at>now() then raise exception 'academy2_event_not_started' using errcode='22023';end if;
 keys:=case p_action when 'record_attendance' then array['participantKey','status','note'] else array[]::text[] end;
 if exists(select 1 from jsonb_each(p_input) x where x.key<>all(keys) or jsonb_typeof(x.value)<>'string') then raise exception 'academy2_invalid_event_command' using errcode='22023';end if;
 if p_action='record_attendance' then
  if (p_input->>'status' in('present','absent','late')) is distinct from true or length(coalesce(p_input->>'note',''))>2000 then raise exception 'academy2_invalid_attendance' using errcode='22023';end if;
  if not exists(select 1 from academy2_access.event_attendees(p_hq,p_event) where id=p_input->>'participantKey') then raise exception 'academy2_participant_unavailable' using errcode='42501';end if;
 else
  if coalesce(c.ends_at,c.starts_at)>now() or exists(select 1 from academy2_access.event_attendees(p_hq,p_event) p where not exists(select 1 from academy2_access.event_attendance a where a.class_id=p_event and a.headquarters_id=p_hq and a.participant_key=p.id)) then raise exception 'academy2_attendance_required' using errcode='22023';end if;
 end if;
 insert into academy2_access.event_commands(request_id,headquarters_id,class_id,actor_id,action,expected_revision,input,transaction_id)
 values(p_request,p_hq,p_event,auth.uid(),p_action,p_expected,p_input,txid_current());
 if p_action='record_attendance' then
  insert into academy2_access.event_attendance(class_id,headquarters_id,participant_key,status,note,recorded_by)
  values(p_event,p_hq,p_input->>'participantKey',p_input->>'status',coalesce(p_input->>'note',''),auth.uid())
  on conflict(class_id,participant_key) do update set status=excluded.status,note=excluded.note,recorded_by=excluded.recorded_by,recorded_at=clock_timestamp();
 else
  update public.academy_classes set status='completed',registration_status='closed' where id=p_event and headquarters_id=p_hq;
 end if;
 update academy2_access.event_plans set revision=revision+1 where class_id=p_event and headquarters_id=p_hq;
 update academy2_access.event_commands set transaction_id=null where request_id=p_request;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'event.'||p_action,p_event);
 return academy2_access.event_operations(p_hq,p_event);
end $$;
revoke all on function academy2_access.event_operations(uuid,uuid),academy2_access.has_event_finish_permit(uuid,uuid),academy2_access.event_operation_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.academy2_event_operations(p_headquarters_id uuid,p_event_id uuid) returns jsonb language sql stable security definer set search_path='' as $$select academy2_access.event_operations(p_headquarters_id,p_event_id)$$;
create function public.academy2_event_operation_command(p_headquarters_id uuid,p_event_id uuid,p_expected_revision integer,p_request_id uuid,p_action text,p_input jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select academy2_access.event_operation_command(p_headquarters_id,p_event_id,p_expected_revision,p_request_id,p_action,p_input)$$;
revoke all on function public.academy2_event_operations(uuid,uuid),public.academy2_event_operation_command(uuid,uuid,integer,uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.academy2_event_operations(uuid,uuid),public.academy2_event_operation_command(uuid,uuid,integer,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
