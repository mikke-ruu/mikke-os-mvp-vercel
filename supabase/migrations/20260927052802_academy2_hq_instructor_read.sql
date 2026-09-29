-- CANDIDATE ONLY. Not in the verified 29 migrations. No table/data mutation.
-- Read existing registrations/activity/grants; never infer a license from certification.
create function academy2_access.hq_instructors(p_hq uuid,p_instructor uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r text:=academy2_access.my_role(p_hq);result jsonb;
begin
 if auth.uid() is null or r is null or r not in('owner','administrator','learning_operator') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_instructor is not null and not exists(select 1 from public.academy_instructors where id=p_instructor and headquarters_id=p_hq) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(item order by item->>'name',item->>'id'),'[]'::jsonb) into result from (
 select jsonb_build_object('id',i.id,'name',i.business_name,'instructorNumber',i.instructor_number::text,
 'courseId',i.course_id,'courseName',c.name,'registrationStatus',i.registration_status,
 'certified',i.is_certified,'listed',i.is_listed,
 'activities',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'salesPlanId',a.sales_plan_id,'status',a.status,
 'licenseEffective',a.status='active' and exists(select 1 from academy2_access.instructor_contracts ct join academy2_access.instructor_license_grants g on g.contract_id=ct.id and g.activity_id=ct.activity_id where ct.activity_id=a.id and ct.accepted_by=a.user_id and ct.status='active' and ct.accepted_at<=now() and ct.starts_at<=now() and ct.ends_at>now() and g.status='active' and g.starts_at<=now() and g.ends_at>now()),
 'transitionReviewRequired',a.transition_review_required) order by a.id) from academy2_access.instructor_activities a where a.instructor_id=i.id and a.headquarters_id=p_hq and a.user_id=i.user_id),'[]'::jsonb)) item
 from public.academy_instructors i left join public.academy_courses c on c.id=i.course_id and c.headquarters_id=i.headquarters_id
 where i.headquarters_id=p_hq and (p_instructor is null or i.id=p_instructor)) q;
 return result;
end$$;
revoke all on function academy2_access.hq_instructors(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.hq_instructors(uuid,uuid) to authenticated;
create function public.academy2_hq_instructors(p_headquarters_id uuid,p_instructor_id uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.hq_instructors(p_headquarters_id,p_instructor_id)$$;
revoke all on function public.academy2_hq_instructors(uuid,uuid) from public,anon,service_role;
grant execute on function public.academy2_hq_instructors(uuid,uuid) to authenticated;
