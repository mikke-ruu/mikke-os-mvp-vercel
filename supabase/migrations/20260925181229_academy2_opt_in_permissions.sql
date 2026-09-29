-- Academy 2.0 LOCK permission foundation. NO existing memberships are mapped.
-- Deliberately disabled: only a local verifier / separately reviewed rollout may
-- provision these private tables. Do not enable a tenant until legacy endpoints
-- are fenced. This migration does not revoke or widen any legacy permission.
create schema academy2_access;
revoke all on schema academy2_access from public, anon, authenticated, service_role;
grant usage on schema academy2_access to authenticated;

create table academy2_access.tenants (
 headquarters_id uuid primary key references public.academy_headquarters(id) on delete restrict,
 runtime_enabled boolean not null default false,
 created_at timestamptz not null default now()
);
create table academy2_access.memberships (
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 role text not null check(role in ('owner','administrator','learning_operator','course_editor')),
 active boolean not null default true,
 primary key(headquarters_id,user_id)
);
create table academy2_access.audit_log (
 id bigint generated always as identity primary key,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 action text not null,
 target_id uuid,
 recorded_at timestamptz not null default now()
);
alter table academy2_access.tenants enable row level security;
alter table academy2_access.memberships enable row level security;
alter table academy2_access.audit_log enable row level security;
revoke all on all tables in schema academy2_access from public,anon,authenticated,service_role;
revoke all on all sequences in schema academy2_access from public,anon,authenticated,service_role;

create function academy2_access.my_role(p_hq uuid) returns text
language sql stable security definer set search_path='' as $$
 select m.role from academy2_access.memberships m
 join academy2_access.tenants t using(headquarters_id)
 where m.headquarters_id=p_hq and m.user_id=(select auth.uid())
 and m.active and t.runtime_enabled and (select auth.uid()) is not null
$$;
revoke all on function academy2_access.my_role(uuid) from public,anon,authenticated,service_role;

create function academy2_access.can(p_hq uuid,p_action text,p_request uuid default null)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare r text:=academy2_access.my_role(p_hq);
begin
 if r is null or p_action is null then return false;end if;
 if r='owner' then
  return p_action=any(array['connect.manage','staff.revoke','certification.revoke','license.revoke','finance.read','audit.read']);
 elsif r='administrator' then
  return p_action=any(array['applications.read','applications.operate','payment.confirm','payment.refund','teacher_fee.pay','teacher_fee.edit','certification.confirm','courses.edit','pages.edit','public_price.edit','finance.read','audit.read','notifications.manage','leave.review']);
 elsif r='learning_operator' then
  if p_action='teacher_fee.edit' then
   return exists(select 1 from public.academy_class_instructor_requests q
    where q.id=p_request and q.headquarters_id=p_hq and q.requested_by_user_id=(select auth.uid()));
  end if;
  return p_action=any(array['applications.read','applications.operate']);
 elsif r='course_editor' then
  return p_action=any(array['courses.edit','pages.edit','public_price.edit']);
 end if;
 return false;
end $$;
revoke all on function academy2_access.can(uuid,text,uuid) from public,anon,authenticated,service_role;

-- Only self authorization is exposed, never a caller-supplied user/role.
create function academy2_access.context(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r text:=academy2_access.my_role(p_hq); actions jsonb;
begin
 if r is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(a),'[]'::jsonb) into actions
 from unnest(array['connect.manage','staff.revoke','certification.revoke','license.revoke','finance.read','audit.read','applications.read','applications.operate','payment.confirm','payment.refund','teacher_fee.pay','teacher_fee.edit','certification.confirm','courses.edit','pages.edit','public_price.edit','notifications.manage','leave.review']) a
 where academy2_access.can(p_hq,a,null);
 return jsonb_build_object('headquarters_id',p_hq,'role',r,'capabilities',actions);
end $$;
revoke all on function academy2_access.context(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.context(uuid) to authenticated;
create function public.academy2_access_context(p_headquarters_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.context(p_headquarters_id)$$;
revoke all on function public.academy2_access_context(uuid) from public,anon,service_role;
grant execute on function public.academy2_access_context(uuid) to authenticated;

-- Allowlisted operational projection: future legacy columns cannot leak through.
-- In particular form_answers/note can contain prices/contracts and are not copied.
create function academy2_access.application(p_hq uuid,p_application uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare source jsonb; result jsonb; allowed text[];
begin
 if not academy2_access.can(p_hq,'applications.read') then
  raise exception 'academy2_forbidden' using errcode='42501';
 end if;
 select to_jsonb(a) into source from public.academy_applications a
 where a.id=p_application and a.headquarters_id=p_hq;
 if source is null then raise exception 'academy2_application_unavailable' using errcode='42501';end if;
 allowed:=array['id','headquarters_id','course_id','instructor_id','applicant_name','applicant_email','applicant_phone','event_date','format','applicant_shipping_address','created_at'];
 if academy2_access.can(p_hq,'finance.read') then
  allowed:=allowed||array['price','payment_status','payment_method','paid_at'];
 end if;
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into result
 from jsonb_each(source) where key=any(allowed);
 return result;
end $$;
revoke all on function academy2_access.application(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.application(uuid,uuid) to authenticated;
create function public.academy2_application_detail(p_headquarters_id uuid,p_application_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.application(p_headquarters_id,p_application_id)$$;
revoke all on function public.academy2_application_detail(uuid,uuid) from public,anon,service_role;
grant execute on function public.academy2_application_detail(uuid,uuid) to authenticated;

comment on schema academy2_access is 'Disabled Academy 2.0 permission foundation; no automatic legacy enrollment. Local verification and endpoint fencing required before activation.';
