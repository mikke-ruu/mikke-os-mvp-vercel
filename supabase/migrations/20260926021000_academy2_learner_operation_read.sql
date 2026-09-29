-- Read-only learner projection for explicitly enrolled Academy 2 operations.
-- No enrollment, material entitlement, certificate or license is created here.
create function academy2_access.learner_operations(p_headquarters_id uuid default null,p_application_id uuid default null,p_limit integer default 50,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'academy2_sign_in_required' using errcode='42501';
 end if;
 if p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0 then
  raise exception 'academy2_invalid_pagination' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(item order by created_at desc,id),'[]'::jsonb) into result from (
  select a.id,a.created_at,jsonb_build_object(
   'id',a.id,'headquarters_id',e.headquarters_id,'headquarters_name',h.name,
   'sales_plan_id',e.plan_id,'sales_plan_name',a.offering_title,
   'application_status',a.status,'applied_at',a.created_at,
   'tuition',jsonb_build_object('amount',a.price,'payment_method',a.payment_method,'paid_at',a.paid_at),
   'schedule',case when c.id is null then null else jsonb_build_object(
    'id',c.id,'title',c.title,'schedule_mode',c.schedule_mode,'starts_at',c.starts_at,'ends_at',c.ends_at,
    'format',c.format,'venue_name',case when c.format='in_person' then c.venue_name else null end,
    'meeting_url',case when c.format='online' then c.meeting_url else null end,'status',c.status) end,
   'completed_at',a.completed_at,
   -- A certification fact is not a diploma or an active commercial/teacher right.
   'certification',case when e.certification_at is null then null else jsonb_build_object('certified_at',e.certification_at) end
  ) item
  from academy2_access.operation_enrollments e
  join public.academy_offering_applications a on a.id=e.application_id and a.headquarters_id=e.headquarters_id
  join academy2_access.tenants t on t.headquarters_id=e.headquarters_id and t.runtime_enabled
  join public.academy_headquarters h on h.id=e.headquarters_id
  left join public.academy_classes c on c.id=e.class_id and c.headquarters_id=e.headquarters_id
  where a.learner_user_id=auth.uid()
   and (p_headquarters_id is null or e.headquarters_id=p_headquarters_id)
   and (p_application_id is null or a.id=p_application_id)
  order by a.created_at desc,a.id limit p_limit offset p_offset
 ) own_rows;
 if p_application_id is not null and jsonb_array_length(result)=0 then
  raise exception 'academy2_application_unavailable' using errcode='42501';
 end if;
 return case when p_application_id is null then result else result->0 end;
end $$;
revoke all on function academy2_access.learner_operations(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function academy2_access.learner_operations(uuid,uuid,integer,integer) to authenticated;
create function public.academy2_my_applications(p_headquarters_id uuid default null,p_limit integer default 50,p_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$
 select academy2_access.learner_operations(p_headquarters_id,null,p_limit,p_offset)
$$;
create function public.academy2_my_application(p_application_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$begin
 if p_application_id is null then raise exception 'academy2_application_unavailable' using errcode='42501';end if;
 return academy2_access.learner_operations(null,p_application_id,1,0);
end $$;
revoke all on function public.academy2_my_applications(uuid,integer,integer),public.academy2_my_application(uuid) from public,anon,authenticated,service_role;
grant execute on function public.academy2_my_applications(uuid,integer,integer),public.academy2_my_application(uuid) to authenticated;
notify pgrst, 'reload schema';
