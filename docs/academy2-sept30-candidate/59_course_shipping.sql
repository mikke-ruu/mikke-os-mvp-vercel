-- Production candidate; review and isolated validation required before approval.
-- Owned isolated local review only. Existing plans and course data are never backfilled.
create table academy2_access.course_shipping_settings(
 course_id uuid primary key references public.academy_courses(id),headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 revision integer not null check(revision>0),configuration jsonb not null,changed_by uuid not null references auth.users(id),updated_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.course_shipping_settings enable row level security;
revoke all on academy2_access.course_shipping_settings from public,anon,authenticated,service_role;
create function academy2_access.course_shipping(p_hq uuid,p_courses uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not(academy2_access.can(p_hq,'courses.edit') or academy2_access.can(p_hq,'applications.operate')) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if cardinality(p_courses)>200 or exists(select 1 from unnest(p_courses) id where not exists(select 1 from public.academy_courses c where c.id=id and c.headquarters_id=p_hq)) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('course_id',c.id,'revision',coalesce(s.revision,0),'configuration',s.configuration) order by a.ord),'[]') into result from unnest(p_courses) with ordinality a(id,ord) join public.academy_courses c on c.id=a.id and c.headquarters_id=p_hq left join academy2_access.course_shipping_settings s on s.course_id=c.id and s.headquarters_id=p_hq;
 return result;
end $$;
create function public.academy2_course_shipping(p_hq uuid,p_courses uuid[]) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.course_shipping(p_hq,p_courses)$$;
create function public.academy2_save_course_shipping(p_hq uuid,p_course uuid,p_expected integer,p_configuration jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior academy2_access.course_shipping_settings;begin
 if not academy2_access.can(p_hq,'courses.edit') or not exists(select 1 from public.academy_courses where id=p_course and headquarters_id=p_hq) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_configuration is null or jsonb_typeof(p_configuration)<>'object' or exists(select 1 from jsonb_object_keys(p_configuration) k where k not in('enabled','name','contents','shipping','handover')) or jsonb_typeof(p_configuration->'enabled') is distinct from 'boolean' or jsonb_typeof(p_configuration->'shipping') is distinct from 'boolean' or jsonb_typeof(p_configuration->'handover') is distinct from 'boolean' or jsonb_typeof(p_configuration->'name') is distinct from 'string' or jsonb_typeof(p_configuration->'contents') is distinct from 'string' or length(p_configuration->>'name')>200 or length(p_configuration->>'contents')>4000 or (p_configuration->'enabled'='true' and (nullif(btrim(p_configuration->>'name'),'') is null or not(p_configuration->'shipping'='true' or p_configuration->'handover'='true'))) then raise exception 'academy2_invalid_shipping' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_course::text,91));select * into prior from academy2_access.course_shipping_settings where course_id=p_course and headquarters_id=p_hq for update;
 if coalesce(prior.revision,0) is distinct from p_expected then
  if prior.revision=p_expected+1 and prior.configuration=p_configuration and prior.changed_by=auth.uid() then return academy2_access.course_shipping(p_hq,array[p_course])->0;end if;
  raise exception 'academy2_revision_conflict' using errcode='PT409';
 end if;
 insert into academy2_access.course_shipping_settings(course_id,headquarters_id,revision,configuration,changed_by) values(p_course,p_hq,p_expected+1,p_configuration,auth.uid()) on conflict(course_id) do update set revision=excluded.revision,configuration=excluded.configuration,changed_by=excluded.changed_by,updated_at=clock_timestamp();
 return academy2_access.course_shipping(p_hq,array[p_course])->0;
end $$;
revoke all on function academy2_access.course_shipping(uuid,uuid[]),public.academy2_course_shipping(uuid,uuid[]),public.academy2_save_course_shipping(uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function academy2_access.course_shipping(uuid,uuid[]),public.academy2_course_shipping(uuid,uuid[]),public.academy2_save_course_shipping(uuid,uuid,integer,jsonb) to authenticated;

-- Additive field contract: external instructions remain independent of all after-course fees.
do $$declare definition text;begin
 definition:=pg_get_functiondef('academy2_access.save_sales_plan_draft(uuid,uuid,integer,jsonb)'::regprocedure);
 if position('''external_payment_urls'', ''after''' in definition)>0 then definition:=replace(definition,'''external_payment_urls'', ''after''','''external_payment_urls'', ''external_payment_details'', ''after''');
 elsif position('''external_payment_urls'',''after''' in definition)>0 then definition:=replace(definition,'''external_payment_urls'',''after''','''external_payment_urls'',''external_payment_details'',''after''');
 else raise exception 'unrecognized_save_field_contract';end if;
 execute definition;
end $$;

