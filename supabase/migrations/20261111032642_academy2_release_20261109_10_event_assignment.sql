-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-event-assignment.local.sql
-- Local candidate only; requires academy2-hq-teachers.local.sql.
begin;
alter table academy2_access.memberships drop constraint memberships_role_check;
alter table academy2_access.memberships add constraint memberships_role_check check(role in('owner','administrator','learning_operator','course_editor','headquarters_teacher','external_teacher'));
alter table academy2_access.staff_invitations drop constraint staff_invitations_role_check;
alter table academy2_access.staff_invitations add constraint staff_invitations_role_check check(role in('administrator','learning_operator','course_editor','headquarters_teacher','external_teacher'));
alter table academy2_access.external_event_instructors add column user_id uuid references auth.users(id) on delete restrict;
create unique index academy2_external_instructor_user on academy2_access.external_event_instructors(headquarters_id,user_id) where user_id is not null;

create function academy2_access.event_assignee_candidates(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff jsonb;external_staff jsonb;
begin
 if not academy2_access.can(p_hq,'applications.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(p.display_name,''),p.handle,'本部スタッフ')) order by m.user_id),'[]') into staff
 from academy2_access.memberships m left join public.profiles p on p.user_id=m.user_id where m.headquarters_id=p_hq and m.active and m.role<>'external_teacher';
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',coalesce(nullif(p.display_name,''),p.handle,i.name)) order by i.id),'[]') into external_staff
 from academy2_access.external_event_instructors i left join public.profiles p on p.user_id=i.user_id where i.headquarters_id=p_hq and i.active
 and (i.user_id is null or exists(select 1 from academy2_access.memberships m where m.headquarters_id=p_hq and m.user_id=i.user_id and m.active and m.role='external_teacher'));
 return jsonb_build_object('assignment',null,'staff',staff,'external',external_staff,'certified','[]'::jsonb,'certifiedHold','');
end $$;
revoke all on function academy2_access.event_assignee_candidates(uuid) from public,anon,service_role;
grant execute on function academy2_access.event_assignee_candidates(uuid) to authenticated;
create function public.academy2_event_assignee_candidates(p_headquarters_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.event_assignee_candidates(p_headquarters_id)$$;
revoke all on function public.academy2_event_assignee_candidates(uuid) from public,anon,service_role;
grant execute on function public.academy2_event_assignee_candidates(uuid) to authenticated;

create or replace function academy2_access.event_assignee_view(p_hq uuid,p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;assignment jsonb;
begin
 result:=academy2_access.event_assignee_candidates(p_hq);
 if not exists(select 1 from public.academy_classes c join academy2_access.event_plans ep on ep.class_id=c.id and ep.headquarters_id=c.headquarters_id where c.id=p_event and c.headquarters_id=p_hq) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select jsonb_build_object('revision',a.revision,'kind',a.kind,'assigneeId',coalesce(a.staff_user_id,a.external_instructor_id),
 'name',case when a.kind='headquarters' then coalesce(nullif(p.display_name,''),p.handle,'本部スタッフ') else coalesce(nullif(xp.display_name,''),xp.handle,i.name) end) into assignment
 from academy2_access.event_assignees a left join public.profiles p on p.user_id=a.staff_user_id
 left join academy2_access.external_event_instructors i on i.id=a.external_instructor_id and i.headquarters_id=a.headquarters_id
 left join public.profiles xp on xp.user_id=i.user_id where a.class_id=p_event and a.headquarters_id=p_hq;
 return result||jsonb_build_object('assignment',assignment);
end $$;

create table academy2_access.event_creation_assignments(
 request_id uuid primary key,headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 class_id uuid not null references public.academy_classes(id),actor_id uuid not null references auth.users(id),input jsonb not null,created_at timestamptz not null default now());
alter table academy2_access.event_creation_assignments enable row level security;
revoke all on academy2_access.event_creation_assignments from public,anon,authenticated,service_role;
create function academy2_access.create_event_assigned(p_hq uuid,p_request uuid,p_input jsonb,p_fulfillment jsonb,p_individual boolean,p_location jsonb,p_assignment jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;event_id uuid;cmd academy2_access.event_creation_assignments;signature jsonb;
begin
 if not academy2_access.can(p_hq,'applications.operate') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null then raise exception 'academy2_invalid_event' using errcode='22023';end if;
 if p_assignment is not null and (jsonb_typeof(p_assignment)<>'object' or not p_assignment?&array['kind','assigneeId']
   or p_assignment->>'kind' not in('headquarters','external') or coalesce(p_assignment->>'assigneeId','') !~ '^[0-9a-fA-F-]{36}$'
   or exists(select 1 from jsonb_object_keys(p_assignment) k where k not in('kind','assigneeId'))) then raise exception 'academy2_invalid_assignee' using errcode='22023';end if;
 signature:=jsonb_build_object('input',p_input,'fulfillment',p_fulfillment,'individual',p_individual,'location',p_location,'assignment',p_assignment);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,541));
 select * into cmd from academy2_access.event_creation_assignments where request_id=p_request;
 if found then
  if cmd.headquarters_id<>p_hq or cmd.actor_id<>auth.uid() or cmd.input<>signature then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return academy2_access.event_detail(p_hq,cmd.class_id);
 end if;
 result:=public.academy2_write_ready_event_with_location(p_hq,null,0,p_request,p_input,p_fulfillment,p_individual,p_location);
 event_id:=(result->>'id')::uuid;
 if p_assignment is not null then
  if p_assignment->>'kind'='headquarters' and exists(select 1 from academy2_access.memberships where headquarters_id=p_hq and user_id=(p_assignment->>'assigneeId')::uuid and role='external_teacher') then raise exception 'academy2_assignee_scope' using errcode='42501';end if;
  if p_assignment->>'kind'='external' and not exists(select 1 from academy2_access.external_event_instructors i where i.id=(p_assignment->>'assigneeId')::uuid and i.headquarters_id=p_hq and i.active and
   (i.user_id is null or exists(select 1 from academy2_access.memberships m where m.headquarters_id=p_hq and m.user_id=i.user_id and m.active and m.role='external_teacher'))) then raise exception 'academy2_assignee_scope' using errcode='42501';end if;
  perform academy2_access.set_event_assignee(p_hq,event_id,0,p_request,p_assignment->>'kind',(p_assignment->>'assigneeId')::uuid);
 end if;
 insert into academy2_access.event_creation_assignments(request_id,headquarters_id,class_id,actor_id,input) values(p_request,p_hq,event_id,auth.uid(),signature);
 return result;
end $$;
revoke all on function academy2_access.create_event_assigned(uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb) from public,anon,service_role;
grant execute on function academy2_access.create_event_assigned(uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb) to authenticated;
create function public.academy2_create_event_assigned(p_hq uuid,p_request uuid,p_input jsonb,p_fulfillment jsonb,p_individual boolean,p_location jsonb,p_assignment jsonb default null) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.create_event_assigned(p_hq,p_request,p_input,p_fulfillment,p_individual,p_location,p_assignment)$$;
revoke all on function public.academy2_create_event_assigned(uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb) from public,anon,service_role;
grant execute on function public.academy2_create_event_assigned(uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb) to authenticated;

create function academy2_access.event_plan_review_status(p_hq uuid,p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not academy2_access.can(p_hq,'applications.operate') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select jsonb_build_object('needsReview',d.revision<>ep.plan_revision and c.status='planned' and c.registration_status='closed'
  and not exists(select 1 from academy2_access.event_attendees(p_hq,p_event))) into result from academy2_access.event_plans ep
 join public.academy_classes c on c.id=ep.class_id and c.headquarters_id=ep.headquarters_id
 join academy2_access.sales_plan_drafts d on d.id=ep.plan_id and d.headquarters_id=ep.headquarters_id
 where ep.class_id=p_event and ep.headquarters_id=p_hq;
 if result is null then raise exception 'academy2_event_unavailable' using errcode='42501';end if;
 return result;
end $$;
revoke all on function academy2_access.event_plan_review_status(uuid,uuid) from public,anon,service_role;
grant execute on function academy2_access.event_plan_review_status(uuid,uuid) to authenticated;
create function public.academy2_event_plan_review_status(p_hq uuid,p_event uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.event_plan_review_status(p_hq,p_event)$$;
revoke all on function public.academy2_event_plan_review_status(uuid,uuid) from public,anon,service_role;
grant execute on function public.academy2_event_plan_review_status(uuid,uuid) to authenticated;
-- Invitation/teaching function extensions are appended below before commit.

create or replace function academy2_access.staff_invite(p_headquarters_id uuid,p_channel text,p_target text,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); person public.profiles%rowtype; existing academy2_access.staff_invitations%rowtype; result academy2_access.staff_invitations%rowtype; target text;
begin
 if actor is null or not academy2_access.staff_manager(p_headquarters_id,actor) then raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 if p_role is null or p_role not in('administrator','learning_operator','course_editor','headquarters_teacher','external_teacher') or p_channel is null or p_channel not in('mikke_id','email') then raise exception 'academy2_staff_invalid';end if;
 perform 1 from academy2_access.tenants where headquarters_id=p_headquarters_id and runtime_enabled for update;
 if not found then raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 target:=lower(btrim(p_target));
 if p_channel='mikke_id' then
  target:=regexp_replace(target,'^@','');
  select * into person from public.profiles where lower(handle)=target;
  if person.user_id is null or person.user_id=actor then raise exception 'academy2_staff_target_unavailable';end if;
  if exists(select 1 from academy2_access.memberships where headquarters_id=p_headquarters_id and user_id=person.user_id) then raise exception 'academy2_staff_membership_exists';end if;
  select * into existing from academy2_access.staff_invitations where headquarters_id=p_headquarters_id and target_user_id=person.user_id and status='pending';
 else
  if target is null or length(target)>320 or target !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'academy2_staff_invalid';end if;
  if exists(select 1 from auth.users where id=actor and lower(btrim(email))=target) then raise exception 'academy2_staff_target_unavailable';end if;
  if exists(select 1 from auth.users u join academy2_access.memberships m on m.user_id=u.id where m.headquarters_id=p_headquarters_id and lower(btrim(u.email))=target) then raise exception 'academy2_staff_membership_exists' using errcode='22023';end if;
  select * into existing from academy2_access.staff_invitations where headquarters_id=p_headquarters_id and recipient_email=target and status='pending';
 end if;
 if existing.id is not null then
  if existing.role<>p_role or existing.expires_at<=now() then raise exception 'academy2_staff_pending_conflict';end if;
  return jsonb_build_object('id',existing.id,'status',existing.status,'delivery_status',existing.delivery_status,'expires_at',existing.expires_at);
 end if;
 insert into academy2_access.staff_invitations(headquarters_id,invited_by,target_user_id,target_profile_id,recipient_email,role,channel,delivery_status)
 values(p_headquarters_id,actor,person.user_id,person.id,case when p_channel='email' then target end,p_role,p_channel,case when p_channel='email' then 'queued' else 'not_required' end) returning * into result;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_headquarters_id,actor,'staff.invited',result.id);
 return jsonb_build_object('id',result.id,'status',result.status,'delivery_status',result.delivery_status,'expires_at',result.expires_at);
end $$;


create or replace function academy2_access.staff_respond(p_invitation_id uuid,p_response text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();i academy2_access.staff_invitations;
begin
 if actor is null or p_response is null or p_response not in('accepted','declined') then raise exception 'academy2_staff_forbidden' using errcode='42501';end if;
 -- Match the verified recipient both before and after taking the row lock.
 i:=academy2_access.staff_invitation_for_self(p_invitation_id);
 perform 1 from academy2_access.tenants where headquarters_id=i.headquarters_id and runtime_enabled for share;
 perform 1 from academy2_access.memberships where headquarters_id=i.headquarters_id and user_id=i.invited_by and active for share;
 select * into i from academy2_access.staff_invitations where id=p_invitation_id for update;
 i:=academy2_access.staff_invitation_for_self(p_invitation_id);
 if i.expires_at<=now() then raise exception 'academy2_staff_unavailable' using errcode='22023';end if;
 if i.status=p_response then return jsonb_build_object('id',i.id,'status',i.status);end if;
 if i.status<>'pending' then raise exception 'academy2_staff_unavailable' using errcode='22023';end if;
 if p_response='accepted' then
  if exists(select 1 from academy2_access.memberships where headquarters_id=i.headquarters_id and user_id=actor) then
   raise exception 'academy2_staff_membership_exists' using errcode='22023';end if;
  insert into academy2_access.memberships(headquarters_id,user_id,role,active) values(i.headquarters_id,actor,i.role,true);
 end if;
 update academy2_access.staff_invitations set status=p_response,responded_at=now() where id=i.id;
 if p_response='accepted' and i.role='external_teacher' then
  insert into academy2_access.external_event_instructors(headquarters_id,user_id,name)
  values(i.headquarters_id,actor,coalesce((select coalesce(nullif(display_name,''),handle) from public.profiles where user_id=actor),'外部講師'));
 end if;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(i.headquarters_id,actor,'staff.'||p_response,i.id);
 return jsonb_build_object('id',i.id,'status',p_response);
end $$;


create or replace function public.academy2_my_hq_teaching(p_headquarters_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from academy2_access.memberships m join academy2_access.tenants t using(headquarters_id)
  where m.headquarters_id=p_headquarters_id and m.user_id=auth.uid() and m.active and t.runtime_enabled) then
  raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'startsAt',c.starts_at,'endsAt',c.ends_at,
   'format',c.format,'venueName',c.venue_name,'meetingUrl',c.meeting_url,'status',c.status,
   'participants',(select coalesce(jsonb_agg(jsonb_build_object('name',names.name) order by names.name,names.id),'[]')
    from academy2_access.event_attendees(p_headquarters_id,c.id) names))
   order by c.starts_at nulls last,c.id),'[]') into result
 from academy2_access.event_assignees a join public.academy_classes c on c.id=a.class_id and c.headquarters_id=a.headquarters_id
 left join academy2_access.external_event_instructors external_staff on external_staff.id=a.external_instructor_id and external_staff.headquarters_id=a.headquarters_id
 where a.headquarters_id=p_headquarters_id and ((a.kind='headquarters' and a.staff_user_id=auth.uid()) or (a.kind='external' and external_staff.user_id=auth.uid() and external_staff.active));
 return result;
end $$;


create or replace function public.academy2_hq_application_overview(p_headquarters_id uuid,p_application_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;event_id uuid;person text;items text;kit jsonb;material_method text;
begin
 result:=public.academy2_hq_fulfillment_workspace(p_headquarters_id,p_application_id);
 event_id:=(result#>>'{headquarters,event,id}')::uuid;
 if event_id is not null then
  select case when a.kind='headquarters' then '本部 ／ '||coalesce(nullif(p.display_name,''),p.handle,'本部スタッフ')
    when a.kind='external' then '外部講師 ／ '||coalesce(x.name,'担当者未設定')
    when c.instructor_id is not null then '講師 ／ '||coalesce(nullif(ip.display_name,''),ip.handle,'登録済み講師') else '本部（担当者の指定なし）' end
   into person from public.academy_classes c
   left join academy2_access.event_assignees a on a.class_id=c.id and a.headquarters_id=c.headquarters_id
   left join public.profiles p on p.user_id=a.staff_user_id
   left join academy2_access.external_event_instructors x on x.id=a.external_instructor_id and x.headquarters_id=c.headquarters_id
   left join public.academy_instructors i on i.id=c.instructor_id and i.headquarters_id=c.headquarters_id
   left join public.profiles ip on ip.user_id=i.user_id
   where c.id=event_id and c.headquarters_id=p_headquarters_id;
  select r.configuration->'kit',coalesce(s.method,f.method,ep.kit_method) into kit,material_method from academy2_access.event_plans ep
   join academy2_access.sales_plan_draft_revisions r on r.draft_id=ep.plan_id and r.revision=ep.plan_revision
   left join academy2_access.application_material_snapshots s on s.application_id=p_application_id and s.headquarters_id=p_headquarters_id and s.class_id=ep.class_id
   left join academy2_access.event_material_fulfillment f on f.class_id=ep.class_id and f.headquarters_id=p_headquarters_id
   where ep.class_id=event_id and ep.headquarters_id=p_headquarters_id;
 end if;
 items:=case when result#>>'{headquarters,shipping,required}'='true' or (kit->>'enabled'='true' and material_method in('shipping','learner_shipping','designated_shipping')) then '教材・材料の発送あり'
   when kit->>'enabled'='true' then '教材・材料あり（会場などで受け渡し）'
   when kit->>'enabled'='false' then '教材・材料なし' else '教材・材料の設定記録なし' end;
 if result->'headquarters'<>'null'::jsonb then
  result:=jsonb_set(result,'{workspace}',coalesce(result->'workspace','{}'::jsonb)||jsonb_build_object('eventFacts',jsonb_build_object('assignee',coalesce(person,'担当者未設定'),'materials',items)));
 end if;
 return result;
end $$;


create or replace function academy2_access.set_event_assignee(p_hq uuid,p_event uuid,p_expected integer,p_request uuid,p_kind text,p_assignee uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.academy_classes;a academy2_access.event_assignees;cmd academy2_access.event_assignee_commands;input jsonb:=jsonb_build_object('kind',p_kind,'assignee_id',p_assignee);
begin
 if not academy2_access.can(p_hq,'applications.operate') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_expected is null or p_expected<0 or p_assignee is null or p_kind is null or p_kind not in('headquarters','external') then raise exception 'academy2_invalid_assignee' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,37));
 select * into cmd from academy2_access.event_assignee_commands where request_id=p_request;
 if found then
  if cmd.headquarters_id<>p_hq or cmd.class_id<>p_event or cmd.actor_id<>auth.uid() or cmd.expected_revision<>p_expected or cmd.input<>input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return academy2_access.event_assignee_view(p_hq,p_event);
 end if;
 select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
 if not found or not exists(select 1 from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if c.status not in('planned','active') or c.instructor_id is not null or exists(select 1 from public.academy_class_instructor_requests where class_id=c.id and headquarters_id=p_hq and status in('requested','accepted')) then raise exception 'academy2_existing_assignment_preserved' using errcode='22023';end if;
 select * into a from academy2_access.event_assignees where class_id=p_event for update;
 if coalesce(a.revision,0)<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 if p_kind='headquarters' and not exists(select 1 from academy2_access.memberships where headquarters_id=p_hq and user_id=p_assignee and active and role<>'external_teacher') then raise exception 'academy2_assignee_scope' using errcode='42501';end if;
 if p_kind='external' and not exists(select 1 from academy2_access.external_event_instructors where id=p_assignee and headquarters_id=p_hq and active and (user_id is null or exists(select 1 from academy2_access.memberships m where m.headquarters_id=p_hq and m.user_id=academy2_access.external_event_instructors.user_id and m.active and m.role='external_teacher'))) then raise exception 'academy2_assignee_scope' using errcode='42501';end if;
 insert into academy2_access.event_assignees(class_id,headquarters_id,revision,kind,staff_user_id,external_instructor_id,changed_by)
 values(p_event,p_hq,p_expected+1,p_kind,case when p_kind='headquarters' then p_assignee end,case when p_kind='external' then p_assignee end,auth.uid())
 on conflict(class_id) do update set revision=excluded.revision,kind=excluded.kind,staff_user_id=excluded.staff_user_id,external_instructor_id=excluded.external_instructor_id,changed_by=excluded.changed_by,changed_at=now();
 insert into academy2_access.event_assignee_commands values(p_request,p_hq,p_event,auth.uid(),p_expected,input,now());
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'event.assignee.saved',p_event);
 return academy2_access.event_assignee_view(p_hq,p_event);
end $$;

commit;
notify pgrst,'reload schema';
