-- Opt-in basic course editor. Existing courses remain the source of truth.
-- No publication, billing, curriculum or learner-content transitions occur here.
create table academy2_access.course_basic_write_permits (
 transaction_id bigint not null,
 course_id uuid not null,
 headquarters_id uuid not null,
 actor_id uuid not null,
 primary key(transaction_id,course_id)
);
alter table academy2_access.course_basic_write_permits enable row level security;
revoke all on academy2_access.course_basic_write_permits from public,anon,authenticated,service_role;

create function academy2_access.has_course_basic_write_permit(p_hq uuid,p_course uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and academy2_access.can(p_hq,'courses.edit') and exists (
  select 1 from academy2_access.course_basic_write_permits
  where transaction_id=txid_current() and course_id=p_course and headquarters_id=p_hq and actor_id=auth.uid()
 )
$$;
revoke all on function academy2_access.has_course_basic_write_permit(uuid,uuid) from public,anon,authenticated,service_role;

-- Preserve the installed legacy guard verbatim. Only our private, single-write
-- permit bypasses legacy billing eligibility for an opt-in basic draft edit.
do $migration$
declare definition text; marker text := E'\nbegin\n'; addition text;
begin
 definition:=replace(pg_get_functiondef('private.academy_guard_trial_course_draft()'::regprocedure),E'\r\n',E'\n');
 if position(marker in definition)=0 or position('academy_headquarters_access_mode' in definition)=0 then
  raise exception 'academy2_unrecognized_legacy_course_guard';
 end if;
 addition:= $branch$
  if tg_op='UPDATE' and academy2_access.has_course_basic_write_permit(old.headquarters_id,old.id)
    and (to_jsonb(new)-array['code','name','subtitle','main_image_url','description','duration_text','updated_at'])
      = (to_jsonb(old)-array['code','name','subtitle','main_image_url','description','duration_text','updated_at']) then
    return new;
  end if;
$branch$;
 -- Replace just the first BEGIN, never a nested legacy branch.
 definition:=overlay(definition placing marker||addition from position(marker in definition) for length(marker));
 execute definition;
end $migration$;

create function academy2_access.course_basic_projection(c public.academy_courses) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',c.id,'headquarters_id',c.headquarters_id,'user_id',c.user_id,
  'code',c.code,'name',c.name,'subtitle',c.subtitle,'main_image_url',c.main_image_url,
  'description',c.description,'duration_text',c.duration_text,
  'created_at',c.created_at,'updated_at',c.updated_at,
  'reference_price',s.reference_price,'reference_revision',coalesce(s.revision,0),
  'lesson_count',null
 ) from (select 1) singleton left join academy2_access.course_settings s
 on s.course_id=c.id and s.headquarters_id=c.headquarters_id
$$;
revoke all on function academy2_access.course_basic_projection(public.academy_courses) from public,anon,authenticated,service_role;

create function academy2_access.course_basic_get(p_hq uuid,p_course uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.academy_courses;
begin
 if not academy2_access.can(p_hq,'courses.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into c from public.academy_courses where id=p_course and headquarters_id=p_hq;
 if not found then raise exception 'academy2_course_unavailable' using errcode='42501';end if;
 return academy2_access.course_basic_projection(c);
end $$;
create function academy2_access.course_basic_list(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not academy2_access.can(p_hq,'courses.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(academy2_access.course_basic_projection(c) order by c.created_at,c.id),'[]'::jsonb) from public.academy_courses c where c.headquarters_id=p_hq);
end $$;

create function academy2_access.course_basic_update(p_hq uuid,p_course uuid,p_expected timestamptz,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.academy_courses; key text;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_expected is null or p_input is null or jsonb_typeof(p_input)<>'object' or p_input='{}'::jsonb then raise exception 'academy2_invalid_course_input' using errcode='22023';end if;
 for key in select jsonb_object_keys(p_input) loop
  if not key=any(array['code','name','subtitle','main_image_url','description','duration_text'])
   or jsonb_typeof(p_input->key) not in ('string','null') then raise exception 'academy2_invalid_course_field' using errcode='22023';end if;
  if key in ('code','name') and (p_input->>key is null or btrim(p_input->>key)='') then raise exception 'academy2_required_course_field' using errcode='22023';end if;
 end loop;
 select * into c from public.academy_courses where id=p_course and headquarters_id=p_hq for update;
 if not found then raise exception 'academy2_course_unavailable' using errcode='42501';end if;
 if c.updated_at is distinct from p_expected then raise exception 'academy2_course_conflict' using errcode='PT409';end if;
 insert into academy2_access.course_basic_write_permits values(txid_current(),p_course,p_hq,auth.uid());
 update public.academy_courses set
  code=case when p_input?'code' then p_input->>'code' else code end,
  name=case when p_input?'name' then p_input->>'name' else name end,
  subtitle=case when p_input?'subtitle' then p_input->>'subtitle' else subtitle end,
  main_image_url=case when p_input?'main_image_url' then p_input->>'main_image_url' else main_image_url end,
  description=case when p_input?'description' then p_input->>'description' else description end,
  duration_text=case when p_input?'duration_text' then p_input->>'duration_text' else duration_text end,
  updated_at=clock_timestamp()
 where id=p_course and headquarters_id=p_hq returning * into c;
 delete from academy2_access.course_basic_write_permits where transaction_id=txid_current() and course_id=p_course;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'course.basic.update',p_course);
 return academy2_access.course_basic_projection(c);
end $$;

revoke all on function academy2_access.course_basic_get(uuid,uuid),academy2_access.course_basic_list(uuid),academy2_access.course_basic_update(uuid,uuid,timestamptz,jsonb) from public,anon,authenticated,service_role;
grant execute on function academy2_access.course_basic_get(uuid,uuid),academy2_access.course_basic_list(uuid),academy2_access.course_basic_update(uuid,uuid,timestamptz,jsonb) to authenticated;
create function public.academy2_course(p_headquarters_id uuid,p_course_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.course_basic_get(p_headquarters_id,p_course_id)$$;
create function public.academy2_courses(p_headquarters_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.course_basic_list(p_headquarters_id)$$;
create function public.academy2_update_course(p_headquarters_id uuid,p_course_id uuid,p_expected_updated_at timestamptz,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.course_basic_update(p_headquarters_id,p_course_id,p_expected_updated_at,p_input)$$;
revoke all on function public.academy2_course(uuid,uuid),public.academy2_courses(uuid),public.academy2_update_course(uuid,uuid,timestamptz,jsonb) from public,anon,service_role;
grant execute on function public.academy2_course(uuid,uuid),public.academy2_courses(uuid),public.academy2_update_course(uuid,uuid,timestamptz,jsonb) to authenticated;
notify pgrst,'reload schema';
