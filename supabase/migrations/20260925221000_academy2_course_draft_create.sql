-- A new course is a draft. No contract, trial clock or publication is started.
create table academy2_access.course_creations (
 creation_id uuid primary key,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 course_id uuid not null unique references public.academy_courses(id) on delete restrict deferrable initially deferred,
 input_snapshot jsonb not null,
 permit_transaction_id bigint,
 created_at timestamptz not null default now()
);
alter table academy2_access.course_creations enable row level security;
revoke all on academy2_access.course_creations from public,anon,authenticated,service_role;

create function academy2_access.has_course_create_permit(c public.academy_courses) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and c.user_id=auth.uid() and not c.is_published
 and academy2_access.can(c.headquarters_id,'courses.edit') and exists(
  select 1 from academy2_access.course_creations r
  where r.course_id=c.id and r.headquarters_id=c.headquarters_id and r.actor_id=auth.uid()
  and r.permit_transaction_id=txid_current()
  and r.input_snapshot=jsonb_build_object('code',c.code,'name',c.name,'subtitle',c.subtitle,
   'main_image_url',c.main_image_url,'description',c.description,'duration_text',c.duration_text)
 )
$$;
revoke all on function academy2_access.has_course_create_permit(public.academy_courses) from public,anon,authenticated,service_role;

do $migration$
declare definition text;marker text:=E'\nbegin\n';addition text;
begin
 definition:=replace(pg_get_functiondef('private.academy_guard_trial_course_draft()'::regprocedure),E'\r\n',E'\n');
 if position(marker in definition)=0 or position('has_course_basic_write_permit' in definition)=0 then raise exception 'academy2_unrecognized_course_guard';end if;
 addition:= $branch$
  if tg_op='INSERT' and academy2_access.has_course_create_permit(new) then return new;end if;
$branch$;
 definition:=overlay(definition placing marker||addition from position(marker in definition) for length(marker));
 execute definition;
end $migration$;

create function academy2_access.course_draft_create(p_hq uuid,p_creation uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r academy2_access.course_creations; payload jsonb; key text; new_id uuid:=gen_random_uuid(); c public.academy_courses; inserted boolean;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_creation is null or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'academy2_invalid_course_input' using errcode='22023';end if;
 for key in select jsonb_object_keys(p_input) loop
  if not key=any(array['code','name','subtitle','main_image_url','description','duration_text'])
   or jsonb_typeof(p_input->key) not in ('string','null') then raise exception 'academy2_invalid_course_field' using errcode='22023';end if;
 end loop;
 if p_input->>'name' is null or btrim(p_input->>'name')='' then raise exception 'academy2_required_course_name' using errcode='22023';end if;
 payload:=jsonb_build_object('code',coalesce(nullif(btrim(p_input->>'code'),''),'c_'||replace(p_creation::text,'-','')),
  'name',p_input->>'name','subtitle',p_input->>'subtitle','main_image_url',p_input->>'main_image_url',
  'description',p_input->>'description','duration_text',p_input->>'duration_text');
 -- A durable marker distinguishes retries from legacy course IDs. It is not an upsert into courses.
 insert into academy2_access.course_creations(creation_id,headquarters_id,actor_id,course_id,input_snapshot,permit_transaction_id)
 values(p_creation,p_hq,auth.uid(),new_id,payload,txid_current()) on conflict(creation_id) do nothing;
 inserted:=found;
 select * into r from academy2_access.course_creations where creation_id=p_creation for update;
 if r.headquarters_id<>p_hq or r.actor_id<>auth.uid() then raise exception 'academy2_creation_scope_conflict' using errcode='42501';end if;
 if r.input_snapshot<>payload then raise exception 'academy2_creation_input_conflict' using errcode='PT409';end if;
 if not inserted then
  if r.permit_transaction_id is not null then raise exception 'academy2_creation_incomplete' using errcode='PT409';end if;
  return academy2_access.course_basic_get(p_hq,r.course_id);
 end if;
 insert into public.academy_courses(id,headquarters_id,user_id,code,name,subtitle,main_image_url,description,duration_text,is_published)
 values(new_id,p_hq,auth.uid(),payload->>'code',payload->>'name',payload->>'subtitle',payload->>'main_image_url',payload->>'description',payload->>'duration_text',false)
 returning * into c;
 update academy2_access.course_creations set permit_transaction_id=null where creation_id=p_creation;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'course.draft.create',new_id);
 return academy2_access.course_basic_projection(c);
end $$;
revoke all on function academy2_access.course_draft_create(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function academy2_access.course_draft_create(uuid,uuid,jsonb) to authenticated;
create function public.academy2_create_course(p_headquarters_id uuid,p_creation_id uuid,p_input jsonb) returns jsonb
language sql security invoker set search_path='' as $$select academy2_access.course_draft_create(p_headquarters_id,p_creation_id,p_input)$$;
revoke all on function public.academy2_create_course(uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.academy2_create_course(uuid,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
