-- New instructor-owned provider verification and scoped assignment bridge.
-- No existing registration, contract, invoice or provider connection is changed.
create table academy2_access.instructor_connect_bindings (
 user_id uuid primary key references auth.users(id),account_reference text not null unique check(account_reference ~ '^acct_[A-Za-z0-9]+$'),
 mode text not null check(mode in('test','live')),binding_reference text not null check(length(binding_reference)>0),bound_at timestamptz not null default now()
);
create table academy2_access.instructor_connect_verifications (
 user_id uuid primary key references academy2_access.instructor_connect_bindings(user_id),account_reference text not null,
 mode text not null check(mode in('test','live')),charges_enabled boolean not null,payouts_enabled boolean not null,details_submitted boolean not null,
 verified_at timestamptz not null,valid_until timestamptz not null,check(valid_until>verified_at)
);
create table academy2_access.instructor_assignment_preferences (
 instructor_id uuid primary key references public.academy_instructors(id),accept_requests boolean not null default false,updated_at timestamptz not null default now()
);
create table academy2_access.instructor_assignment_environments (
 headquarters_id uuid primary key references academy2_access.tenants(headquarters_id),mode text not null check(mode in('test','live'))
);
create table academy2_access.instructor_assignment_details (
 request_id uuid primary key references public.academy_class_instructor_requests(id),command_id uuid not null unique,
 instructor_user_id uuid not null references auth.users(id),plan_id uuid not null,plan_revision integer not null,
 response_kind text not null default 'requested' check(response_kind in('requested','consulting','accepted','declined')),
 accepted_fee_yen bigint,revision integer not null default 1
);
create table academy2_access.instructor_assignment_responses (
 command_id uuid primary key,request_id uuid not null references academy2_access.instructor_assignment_details(request_id),actor_id uuid not null,body jsonb not null
);
do $$declare t text;begin foreach t in array array['instructor_connect_bindings','instructor_connect_verifications','instructor_assignment_preferences','instructor_assignment_environments','instructor_assignment_details','instructor_assignment_responses'] loop
 execute format('alter table academy2_access.%I enable row level security',t);execute format('revoke all on academy2_access.%I from public,anon,authenticated,service_role',t);end loop;end$$;

create function academy2_access.instructor_connect_ready(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from academy2_access.instructor_connect_bindings b join academy2_access.instructor_connect_verifications v using(user_id)
 where b.user_id=p_user and v.account_reference=b.account_reference and v.mode=b.mode and v.charges_enabled and v.payouts_enabled and v.details_submitted and v.verified_at<=now() and v.valid_until>now())
$$;
create function academy2_access.instructor_connect_binding(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('userId',user_id,'accountId',account_reference,'mode',mode) from academy2_access.instructor_connect_bindings where user_id=p_user
$$;
create function academy2_access.record_instructor_connect(p_user uuid,p_account text,p_mode text,p_charges boolean,p_payouts boolean,p_details boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from academy2_access.instructor_connect_bindings where user_id=p_user and account_reference=p_account and mode=p_mode for share;
 if not found or p_charges is null or p_payouts is null or p_details is null then raise exception 'instructor_binding_mismatch' using errcode='42501';end if;
 insert into academy2_access.instructor_connect_verifications values(p_user,p_account,p_mode,p_charges,p_payouts,p_details,clock_timestamp(),clock_timestamp()+interval '5 minutes')
 on conflict(user_id) do update set account_reference=excluded.account_reference,mode=excluded.mode,charges_enabled=excluded.charges_enabled,payouts_enabled=excluded.payouts_enabled,details_submitted=excluded.details_submitted,verified_at=excluded.verified_at,valid_until=excluded.valid_until;
end$$;
create function academy2_access.hq_instructors_with_assignments(p_hq uuid,p_instructor uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare original jsonb; requests jsonb; result jsonb;
begin
 original:=academy2_access.hq_instructors(p_hq,p_instructor);
 requests:=academy2_access.assignment_requests(p_hq,null);
 select coalesce(jsonb_agg(item||jsonb_build_object('connectReady',academy2_access.instructor_connect_ready(i.user_id),'acceptHqRequests',coalesce(p.accept_requests,false),
 'assignmentRequests',coalesce((select jsonb_agg(r) from jsonb_array_elements(requests) r where r->>'instructorId'=i.id::text),'[]'))),'[]') into result
 from jsonb_array_elements(original) item join public.academy_instructors i on i.id=(item->>'id')::uuid left join academy2_access.instructor_assignment_preferences p on p.instructor_id=i.id;
 return result;
end$$;
revoke all on function academy2_access.hq_instructors_with_assignments(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.hq_instructors_with_assignments(uuid,uuid) to authenticated;
create or replace function public.academy2_hq_instructors(p_headquarters_id uuid,p_instructor_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.hq_instructors_with_assignments(p_headquarters_id,p_instructor_id)$$;
create function academy2_access.instructor_assignment_eligible(p_hq uuid,p_event uuid,p_instructor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.academy_instructors i join academy2_access.instructor_assignment_preferences pref on pref.instructor_id=i.id and pref.accept_requests
 join academy2_access.event_plans ep on ep.class_id=p_event and ep.headquarters_id=i.headquarters_id
 join public.academy_classes c on c.id=ep.class_id and c.headquarters_id=ep.headquarters_id and c.course_id=i.course_id
 join academy2_access.instructor_activities a on a.instructor_id=i.id and a.user_id=i.user_id and a.headquarters_id=i.headquarters_id and a.sales_plan_id=ep.plan_id
 join academy2_access.instructor_contracts ct on ct.activity_id=a.id and ct.accepted_by=a.user_id
 join academy2_access.instructor_license_grants g on g.contract_id=ct.id and g.activity_id=a.id
 join academy2_access.tenants t on t.headquarters_id=i.headquarters_id and t.runtime_enabled
 where i.id=p_instructor and i.headquarters_id=p_hq and i.is_active and a.status='active' and not a.transition_review_required
 and ct.status='active' and ct.accepted_at<=now() and ct.starts_at<=now() and ct.ends_at>now() and g.status='active' and g.starts_at<=now() and g.ends_at>now()
 and academy2_access.instructor_connect_ready(i.user_id) and exists(select 1 from academy2_access.instructor_assignment_environments e join academy2_access.instructor_connect_bindings b on b.mode=e.mode where e.headquarters_id=p_hq and b.user_id=i.user_id))
$$;
create function academy2_access.assignment_requests(p_hq uuid default null,p_event uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_hq is not null and not (academy2_access.can(p_hq,'applications.read') or academy2_access.can(p_hq,'finance.read')) then raise exception 'forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'headquartersId',q.headquarters_id,'eventId',q.class_id,'instructorId',q.instructor_id,'instructorName',i.business_name,'status',case when q.status='requested' then d.response_kind else q.status end,
 'requestNote',case when d.instructor_user_id=auth.uid() or academy2_access.can(q.headquarters_id,'finance.read') or academy2_access.can(q.headquarters_id,'teacher_fee.edit',q.id) then q.request_note else null end,'responseNote',case when d.instructor_user_id=auth.uid() or academy2_access.can(q.headquarters_id,'finance.read') or academy2_access.can(q.headquarters_id,'teacher_fee.edit',q.id) then q.response_note else null end,'revision',d.revision,
 'feeYen',case when d.instructor_user_id=auth.uid() or academy2_access.can(q.headquarters_id,'finance.read') or academy2_access.can(q.headquarters_id,'teacher_fee.edit',q.id) then coalesce(d.accepted_fee_yen,f.amount_yen) else null end,
 'feeRevision',case when academy2_access.can(q.headquarters_id,'teacher_fee.edit',q.id) then f.revision else null end,
 'feeEditable',q.status='requested' and academy2_access.can(q.headquarters_id,'teacher_fee.edit',q.id),
 'canAccept',q.status='requested' and d.instructor_user_id=auth.uid() and academy2_access.instructor_assignment_eligible(q.headquarters_id,q.class_id,q.instructor_id),
 'event',jsonb_build_object('title',c.title,'startsAt',c.starts_at,'endsAt',c.ends_at,'format',c.format,'venue',c.venue_name)) order by q.created_at desc),'[]') into result
 from academy2_access.instructor_assignment_details d join public.academy_class_instructor_requests q on q.id=d.request_id join public.academy_classes c on c.id=q.class_id join public.academy_instructors i on i.id=q.instructor_id left join academy2_access.instructor_request_fee_drafts f on f.request_id=q.id
 where (p_hq is null and d.instructor_user_id=auth.uid() or p_hq=q.headquarters_id) and (p_event is null or q.class_id=p_event);
 return result;
end$$;
create function academy2_access.assignment_candidates(p_hq uuid,p_event uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare candidates jsonb;
begin
 if not academy2_access.can(p_hq,'applications.read') or not exists(select 1 from academy2_access.event_plans where headquarters_id=p_hq and class_id=p_event) then raise exception 'forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.business_name) order by i.business_name,i.id),'[]') into candidates from public.academy_instructors i where i.headquarters_id=p_hq and academy2_access.instructor_assignment_eligible(p_hq,p_event,i.id);
 return jsonb_build_object('candidates',candidates,'requests',academy2_access.assignment_requests(p_hq,p_event));
end$$;
create function academy2_access.request_assignment(p_hq uuid,p_event uuid,p_instructor uuid,p_command uuid,p_amount bigint,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.academy_class_instructor_requests;d academy2_access.instructor_assignment_details;ep academy2_access.event_plans;i public.academy_instructors;
begin
 if not academy2_access.can(p_hq,'applications.operate') then raise exception 'forbidden' using errcode='42501';end if;
 if p_command is null or p_amount is null or p_amount<0 or length(coalesce(p_note,''))>2000 then raise exception 'invalid_request' using errcode='22023';end if;
 perform 1 from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 select * into d from academy2_access.instructor_assignment_details where command_id=p_command;
 if found then
  select * into q from public.academy_class_instructor_requests where id=d.request_id;
  if q.headquarters_id<>p_hq or q.class_id<>p_event or q.instructor_id<>p_instructor or q.requested_by_user_id<>auth.uid() or coalesce(q.request_note,'')<>btrim(coalesce(p_note,'')) or not exists(select 1 from academy2_access.instructor_request_fee_drafts where request_id=q.id and amount_yen=p_amount) then raise exception 'request_retry_changed' using errcode='PT409';end if;
  return academy2_access.assignment_candidates(p_hq,p_event);
 end if;
 if not academy2_access.instructor_assignment_eligible(p_hq,p_event,p_instructor) then raise exception 'instructor_not_eligible' using errcode='42501';end if;
 if exists(select 1 from public.academy_classes where id=p_event and (status<>'planned' or instructor_id is not null)) or exists(select 1 from public.academy_class_instructor_requests where class_id=p_event and status in('requested','accepted')) or exists(select 1 from academy2_access.event_assignees where class_id=p_event) then raise exception 'assignment_exists_or_event_started' using errcode='PT409';end if;
 select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq;
 select * into i from public.academy_instructors where id=p_instructor;
 insert into public.academy_class_instructor_requests(headquarters_id,class_id,instructor_id,requested_by_user_id,request_note) values(p_hq,p_event,p_instructor,auth.uid(),nullif(btrim(p_note),'')) returning * into q;
 insert into academy2_access.instructor_assignment_details(request_id,command_id,instructor_user_id,plan_id,plan_revision) values(q.id,p_command,i.user_id,ep.plan_id,ep.plan_revision);
 insert into academy2_access.instructor_request_fee_drafts(request_id,revision,amount_yen,changed_by) values(q.id,1,p_amount,auth.uid());
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'instructor_assignment.request',q.id);
 return academy2_access.assignment_candidates(p_hq,p_event);
end$$;
create function academy2_access.respond_assignment(p_request uuid,p_revision integer,p_command uuid,p_response text,p_note text,p_fee bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.academy_class_instructor_requests;d academy2_access.instructor_assignment_details;old academy2_access.instructor_assignment_responses;body jsonb;amount bigint;
begin
 if auth.uid() is null or p_command is null or p_response not in('accepted','declined','consulting') or length(coalesce(p_note,''))>2000 then raise exception 'invalid_response' using errcode='22023';end if;
 select r.* into q from public.academy_class_instructor_requests r join academy2_access.instructor_assignment_details x on x.request_id=r.id where r.id=p_request and x.instructor_user_id=auth.uid();
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 perform 1 from public.academy_classes where id=q.class_id for update;
 select * into q from public.academy_class_instructor_requests where id=p_request for update;
 select * into d from academy2_access.instructor_assignment_details where request_id=p_request for update;
 body:=jsonb_build_object('revision',p_revision,'response',p_response,'note',btrim(coalesce(p_note,'')),'fee',p_fee);
 select * into old from academy2_access.instructor_assignment_responses where command_id=p_command;
 if found then
  if old.request_id<>p_request or old.actor_id<>auth.uid() or old.body<>body then raise exception 'response_retry_changed' using errcode='PT409';end if;
  return academy2_access.assignment_requests();
 end if;
 if d.revision<>p_revision or q.status<>'requested' then raise exception 'response_stale' using errcode='PT409';end if;
 if p_response='accepted' then
  if not academy2_access.instructor_assignment_eligible(q.headquarters_id,q.class_id,q.instructor_id) then raise exception 'instructor_not_eligible' using errcode='42501';end if;
  select amount_yen into amount from academy2_access.instructor_request_fee_drafts where request_id=p_request for update;
  if amount is null then raise exception 'fee_missing' using errcode='22023';end if;
  if p_fee is distinct from amount then raise exception 'fee_changed' using errcode='PT409';end if;
 end if;
 if p_response='consulting' then update public.academy_class_instructor_requests set response_note=nullif(btrim(p_note),''),responded_at=now(),updated_at=now() where id=p_request;
 else perform academy2_access.legacy_respond_class_instructor(p_request,p_response,p_note);end if;
 update academy2_access.instructor_assignment_details set response_kind=p_response,revision=revision+1,accepted_fee_yen=case when p_response='accepted' then amount else accepted_fee_yen end where request_id=p_request;
 insert into academy2_access.instructor_assignment_responses values(p_command,p_request,auth.uid(),body);
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(q.headquarters_id,auth.uid(),'instructor_assignment.'||p_response,p_request);
 return academy2_access.assignment_requests();
end$$;
create function academy2_access.my_assignment_preferences(p_instructor uuid default null,p_accept boolean default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_accept is not null then
  if not exists(select 1 from public.academy_instructors i join academy2_access.tenants t on t.headquarters_id=i.headquarters_id and t.runtime_enabled where i.id=p_instructor and i.user_id=auth.uid()) then raise exception 'forbidden' using errcode='42501';end if;
  insert into academy2_access.instructor_assignment_preferences values(p_instructor,p_accept,now()) on conflict(instructor_id) do update set accept_requests=excluded.accept_requests,updated_at=excluded.updated_at;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.business_name,'headquartersId',i.headquarters_id,'courseName',c.name,'acceptRequests',coalesce(p.accept_requests,false),'connectReady',academy2_access.instructor_connect_ready(i.user_id))),'[]') into result from public.academy_instructors i join academy2_access.tenants t on t.headquarters_id=i.headquarters_id and t.runtime_enabled left join public.academy_courses c on c.id=i.course_id left join academy2_access.instructor_assignment_preferences p on p.instructor_id=i.id where i.user_id=auth.uid();
 return result;
end$$;
-- Explicit public wrappers; private tables and verification writes stay server-only.
create function public.academy2_assignment_candidates(p_hq uuid,p_event uuid) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.assignment_candidates(p_hq,p_event)$$;
create function public.academy2_assignment_requests(p_hq uuid default null,p_event uuid default null) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.assignment_requests(p_hq,p_event)$$;
create function public.academy2_request_assignment(p_hq uuid,p_event uuid,p_instructor uuid,p_command uuid,p_amount bigint,p_note text) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.request_assignment(p_hq,p_event,p_instructor,p_command,p_amount,p_note)$$;
create function public.academy2_respond_assignment(p_request uuid,p_revision integer,p_command uuid,p_response text,p_note text,p_fee bigint default null) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.respond_assignment(p_request,p_revision,p_command,p_response,p_note,p_fee)$$;
create function public.academy2_my_assignment_preferences(p_instructor uuid default null,p_accept boolean default null) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.my_assignment_preferences(p_instructor,p_accept)$$;
create function public.academy2_instructor_connect_binding(p_user uuid) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.instructor_connect_binding(p_user)$$;
create function public.academy2_record_instructor_connect(p_user uuid,p_account text,p_mode text,p_charges boolean,p_payouts boolean,p_details boolean) returns void language sql security invoker set search_path='' as $$select academy2_access.record_instructor_connect(p_user,p_account,p_mode,p_charges,p_payouts,p_details)$$;
do $$declare f record;begin
 for f in select p.oid::regprocedure sig,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','academy2_access') and p.proname in('instructor_connect_ready','instructor_connect_binding','record_instructor_connect','instructor_assignment_eligible','assignment_requests','assignment_candidates','request_assignment','respond_assignment','my_assignment_preferences','academy2_assignment_candidates','academy2_assignment_requests','academy2_request_assignment','academy2_respond_assignment','academy2_my_assignment_preferences','academy2_instructor_connect_binding','academy2_record_instructor_connect') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 if f.proname in('instructor_connect_binding','record_instructor_connect','academy2_instructor_connect_binding','academy2_record_instructor_connect') then execute format('grant execute on function %s to service_role',f.sig);
 elsif f.proname not in('instructor_connect_ready','instructor_assignment_eligible') then execute format('grant execute on function %s to authenticated',f.sig);end if;
 end loop;
end$$;
