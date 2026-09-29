-- Compatibility for an existing headquarters owner after an explicit 2.0 opt-in.
-- Derive course editing from the canonical old owner ID. Do not create tenants,
-- memberships, instructor registrations, contracts, or other entitlements.
create function academy2_access.legacy_owner_course(p_hq uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and exists(
   select 1 from public.academy_headquarters h
   join academy2_access.tenants t on t.headquarters_id=h.id and t.runtime_enabled
   where h.id=p_hq and h.owner_user_id=(select auth.uid())
  )
  -- An explicit 2.0 membership, including a revoked one, takes precedence.
  and not exists(
   select 1 from academy2_access.memberships m
   where m.headquarters_id=p_hq and m.user_id=(select auth.uid())
  )
$$;
revoke all on function academy2_access.legacy_owner_course(uuid) from public,anon,authenticated,service_role;

create or replace function academy2_access.my_role(p_hq uuid) returns text
language sql stable security definer set search_path='' as $$
 select coalesce(
  (select m.role from academy2_access.memberships m
   join academy2_access.tenants t using(headquarters_id)
   where m.headquarters_id=p_hq and m.user_id=(select auth.uid())
    and m.active and t.runtime_enabled and (select auth.uid()) is not null),
  case when academy2_access.legacy_owner_course(p_hq) then 'course_editor' end
 )
$$;

create or replace function academy2_access.can(p_hq uuid,p_action text,p_request uuid default null)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare r text:=academy2_access.my_role(p_hq);
begin
 if r is null or p_action is null then return false;end if;
 -- The derived old-owner role is narrower than a real course_editor membership.
 if academy2_access.legacy_owner_course(p_hq) then return p_action='courses.edit';end if;
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

create or replace function academy2_access.my_headquarters()
returns table(id uuid,name text,handle text,role text)
language sql stable security definer set search_path='' as $$
 select h.id,h.name,h.handle,m.role
 from academy2_access.memberships m
 join academy2_access.tenants t on t.headquarters_id=m.headquarters_id and t.runtime_enabled
 join public.academy_headquarters h on h.id=t.headquarters_id
 where (select auth.uid()) is not null and m.user_id=(select auth.uid()) and m.active
 union all
 select h.id,h.name,h.handle,'legacy_owner'::text
 from public.academy_headquarters h
 join academy2_access.tenants t on t.headquarters_id=h.id and t.runtime_enabled
 where academy2_access.legacy_owner_course(h.id)
 order by name,id
$$;

-- The single-course reference price is edited inside the course editor.
-- Permit that scoped field without granting general sales-plan price control.
create or replace function academy2_access.course_settings_view(p_hq uuid,p_course uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s academy2_access.course_settings;
begin
 if not academy2_access.can(p_hq,'courses.edit') or
    (not academy2_access.can(p_hq,'public_price.edit') and not academy2_access.legacy_owner_course(p_hq))
 then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.academy_courses where id=p_course and headquarters_id=p_hq) then raise exception 'academy2_course_unavailable' using errcode='42501';end if;
 select * into s from academy2_access.course_settings where course_id=p_course and headquarters_id=p_hq;
 return jsonb_build_object('course_id',p_course,'headquarters_id',p_hq,'reference_price',s.reference_price,'all_courses_eligible',s.all_courses_eligible,'revision',coalesce(s.revision,0),'updated_at',s.updated_at);
end $$;

create or replace function academy2_access.save_course_settings(p_hq uuid,p_course uuid,p_expected integer,p_reference numeric,p_eligible boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s academy2_access.course_settings;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') or
    (not academy2_access.can(p_hq,'public_price.edit') and not academy2_access.legacy_owner_course(p_hq))
 then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_expected is null or p_expected<0 or (p_reference is not null and (p_reference::text in ('NaN','Infinity','-Infinity') or p_reference<0 or p_reference>9007199254740991 or trunc(p_reference)<>p_reference)) then raise exception 'academy2_invalid_reference_price' using errcode='22023';end if;
 perform 1 from public.academy_courses where id=p_course and headquarters_id=p_hq for share;
 if not found then raise exception 'academy2_course_unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('course-settings:'||p_course::text,0));
 select * into s from academy2_access.course_settings where course_id=p_course for update;
 if s.course_id is null then
  if p_expected<>0 then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
  insert into academy2_access.course_settings(course_id,headquarters_id,reference_price,all_courses_eligible,revision,updated_by)
  values(p_course,p_hq,p_reference::bigint,p_eligible,1,auth.uid());
 else
  if s.headquarters_id<>p_hq then raise exception 'academy2_forbidden' using errcode='42501';end if;
  if s.revision<>p_expected then
   if p_expected=0 and s.revision=1 and s.updated_by=auth.uid() and s.reference_price is not distinct from p_reference and s.all_courses_eligible is not distinct from p_eligible then return academy2_access.course_settings_view(p_hq,p_course);end if;
   raise exception 'academy2_revision_conflict' using errcode='PT409';
  end if;
  update academy2_access.course_settings set reference_price=p_reference::bigint,all_courses_eligible=p_eligible,revision=revision+1,updated_by=auth.uid(),updated_at=now() where course_id=p_course;
 end if;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'course.settings.saved',p_course);
 return academy2_access.course_settings_view(p_hq,p_course);
end $$;

comment on function academy2_access.legacy_owner_course(uuid) is
 'Read-only ownership check for an enabled legacy HQ; grants only same-HQ course editing and never provisions membership.';
notify pgrst,'reload schema';
