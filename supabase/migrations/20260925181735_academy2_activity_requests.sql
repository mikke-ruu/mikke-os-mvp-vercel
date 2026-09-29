-- Additive Academy 2.0 activity requests. No legacy data migration or billing changes.
create table academy2_access.instructor_activities (
 id uuid primary key default gen_random_uuid(),
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 instructor_id uuid not null references public.academy_instructors(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 sales_plan_id uuid not null,
 status text not null check(status in ('active','payment_pending','leave','suspended')),
 leave_allowed boolean not null default false,
 billing_review_required boolean not null default true,
 transition_review_required boolean not null default false,
 requested_status text check(requested_status in ('active','leave')),
 unique(headquarters_id,instructor_id,sales_plan_id)
);
create table academy2_access.activity_requests (
 id uuid primary key default gen_random_uuid(),
 activity_id uuid not null references academy2_access.instructor_activities(id) on delete restrict,
 requested_by uuid not null references auth.users(id) on delete restrict,
 kind text not null check(kind in ('leave','resume')),
 status text not null default 'pending' check(status in ('pending','approved','declined')),
 starts_on date, ends_on date,
 reason text not null check(length(trim(reason)) between 1 and 4000),
 response text check(length(response)<=4000),
 reviewed_by uuid references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 check((kind='leave' and starts_on is not null and ends_on is not null and ends_on>=starts_on) or (kind='resume' and starts_on is null and ends_on is null))
);
create unique index academy2_one_pending_activity_request on academy2_access.activity_requests(activity_id) where status='pending';
alter table academy2_access.instructor_activities enable row level security;
alter table academy2_access.activity_requests enable row level security;
revoke all on academy2_access.instructor_activities,academy2_access.activity_requests from public,anon,authenticated,service_role;

create function academy2_access.activity_view(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a academy2_access.instructor_activities; requests jsonb;
begin
 select * into a from academy2_access.instructor_activities where id=p_id;
 if a.id is null or auth.uid() is null or not exists(select 1 from academy2_access.tenants t where t.headquarters_id=a.headquarters_id and t.runtime_enabled)
 or (a.user_id<>auth.uid() and not academy2_access.can(a.headquarters_id,'leave.review')) then
 raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'status',r.status,'startsOn',r.starts_on,'endsOn',r.ends_on,'reason',r.reason,'response',r.response) order by r.created_at desc),'[]'::jsonb)
 into requests from academy2_access.activity_requests r where r.activity_id=a.id;
 return jsonb_build_object('id',a.id,'status',a.status,'leaveAllowed',a.leave_allowed,'transitionReviewRequired',a.transition_review_required,'requests',requests);
end $$;
revoke all on function academy2_access.activity_view(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.activity_view(uuid) to authenticated;
create function public.academy2_instructor_activity(p_activity_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.activity_view(p_activity_id)$$;
revoke all on function public.academy2_instructor_activity(uuid) from public,anon,service_role;
grant execute on function public.academy2_instructor_activity(uuid) to authenticated;

create function academy2_access.request_activity(p_id uuid,p_kind text,p_starts date,p_ends date,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a academy2_access.instructor_activities; existing academy2_access.activity_requests; request_id uuid;
begin
 select * into a from academy2_access.instructor_activities where id=p_id for update;
 if auth.uid() is null or a.id is null or a.user_id<>auth.uid() or not exists(select 1 from academy2_access.tenants t where t.headquarters_id=a.headquarters_id and t.runtime_enabled) then
 raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('leave','resume') or p_reason is null or length(trim(p_reason)) not between 1 and 4000 then raise exception 'academy2_invalid_request' using errcode='22023';end if;
 if p_kind='leave' and (a.status<>'active' or not a.leave_allowed or p_starts is null or p_ends is null or p_ends<p_starts) then raise exception 'academy2_leave_unavailable' using errcode='22023';end if;
 if p_kind='resume' and (a.status not in ('leave','suspended') or p_starts is not null or p_ends is not null) then raise exception 'academy2_invalid_request' using errcode='22023';end if;
 select * into existing from academy2_access.activity_requests where activity_id=a.id and status='pending';
 if existing.id is not null then
  if existing.kind=p_kind and existing.starts_on is not distinct from p_starts and existing.ends_on is not distinct from p_ends and existing.reason=trim(p_reason) then return academy2_access.activity_view(a.id);end if;
  raise exception 'academy2_request_pending' using errcode='23505';
 end if;
 insert into academy2_access.activity_requests(activity_id,requested_by,kind,starts_on,ends_on,reason)
 values(a.id,auth.uid(),p_kind,p_starts,p_ends,trim(p_reason)) returning id into request_id;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(a.headquarters_id,auth.uid(),'activity.'||p_kind||'.requested',request_id);
 return academy2_access.activity_view(a.id);
end $$;
revoke all on function academy2_access.request_activity(uuid,text,date,date,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.request_activity(uuid,text,date,date,text) to authenticated;
create function public.academy2_request_activity(p_activity_id uuid,p_kind text,p_starts_on date,p_ends_on date,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.request_activity(p_activity_id,p_kind,p_starts_on,p_ends_on,p_reason)$$;
revoke all on function public.academy2_request_activity(uuid,text,date,date,text) from public,anon,service_role;
grant execute on function public.academy2_request_activity(uuid,text,date,date,text) to authenticated;

create function academy2_access.review_activity(p_request uuid,p_status text,p_response text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a academy2_access.instructor_activities; r academy2_access.activity_requests;
begin
 select * into r from academy2_access.activity_requests where id=p_request;
 select * into a from academy2_access.instructor_activities where id=r.activity_id for update;
 if a.id is null or not academy2_access.can(a.headquarters_id,'leave.review') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into r from academy2_access.activity_requests where id=p_request for update;
 if p_status is null or p_status not in ('approved','declined') or p_response is null or length(trim(p_response)) not between 1 and 4000 then raise exception 'academy2_invalid_review' using errcode='22023';end if;
 if r.status<>'pending' then
  if r.status=p_status and r.response=trim(p_response) then return academy2_access.activity_view(a.id);end if;
  raise exception 'academy2_already_reviewed' using errcode='23505';
 end if;
 if p_status='approved' and r.kind='leave' and not a.leave_allowed then raise exception 'academy2_leave_unavailable' using errcode='22023';end if;
 update academy2_access.activity_requests set status=p_status,response=trim(p_response),reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
 if p_status='approved' then
  -- Approval records intent. Activation waits for the separately verified
  -- effective date / existing bookings / dues / authority conditions. In particular
  -- do not immediately suspend future-dated leave or reinstate a revoked license.
  update academy2_access.instructor_activities set requested_status=case when r.kind='leave' then 'leave' else 'active' end,transition_review_required=true,billing_review_required=true where id=a.id;
 end if;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(a.headquarters_id,auth.uid(),'activity.'||r.kind||'.'||p_status,r.id);
 return academy2_access.activity_view(a.id);
end $$;
revoke all on function academy2_access.review_activity(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function academy2_access.review_activity(uuid,text,text) to authenticated;
create function public.academy2_review_activity(p_request_id uuid,p_status text,p_response text) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.review_activity(p_request_id,p_status,p_response)$$;
revoke all on function public.academy2_review_activity(uuid,text,text) from public,anon,service_role;
grant execute on function public.academy2_review_activity(uuid,text,text) to authenticated;

-- Important history is readable by owner/administrator only, never operators/editors.
create function academy2_access.audit_history(p_hq uuid,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not academy2_access.can(p_hq,'audit.read') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(rows) order by id desc),'[]'::jsonb) into result
 from (select id,actor_id,action,target_id,recorded_at from academy2_access.audit_log where headquarters_id=p_hq and (p_before is null or id<p_before) order by id desc limit 50) rows;
 return result;
end $$;
revoke all on function academy2_access.audit_history(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function academy2_access.audit_history(uuid,bigint) to authenticated;
create function public.academy2_audit_history(p_headquarters_id uuid,p_before bigint default null) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.audit_history(p_headquarters_id,p_before)$$;
revoke all on function public.academy2_audit_history(uuid,bigint) from public,anon,service_role;
grant execute on function public.academy2_audit_history(uuid,bigint) to authenticated;

-- Reject mismatched instructor identity even during trusted fixture/provisioning.
create function academy2_access.check_activity_scope() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.academy_instructors i where i.id=new.instructor_id and i.headquarters_id=new.headquarters_id and i.user_id=new.user_id) then
  raise exception 'academy2_activity_scope_mismatch' using errcode='23514';end if;
 -- Plan registry is not yet connected. No client provisioning API is exposed.
 -- A rollout must validate sales_plan_id against its canonical HQ before enablement.
 return new;
end $$;
revoke all on function academy2_access.check_activity_scope() from public,anon,authenticated,service_role;
create trigger academy2_activity_scope before insert or update of headquarters_id,instructor_id,user_id on academy2_access.instructor_activities for each row execute function academy2_access.check_activity_scope();
