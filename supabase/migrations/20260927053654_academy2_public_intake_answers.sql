-- Independent candidate. No historical application update, no mail or billing work.
create table academy2_access.application_answers (
 application_id uuid primary key references public.academy_offering_applications(id),
 learner_user_id uuid not null, request_id uuid not null, source_id uuid not null,
 instructor boolean not null, fields jsonb not null, answers jsonb not null,
 created_at timestamptz not null default now(), unique(learner_user_id,request_id)
);
create table academy2_access.application_answer_permits (
 learner_user_id uuid not null, request_id uuid not null, transaction_id bigint not null,
 offering_id uuid not null, primary key(learner_user_id,request_id)
);
alter table academy2_access.application_answers enable row level security;
alter table academy2_access.application_answer_permits enable row level security;
revoke all on academy2_access.application_answers,academy2_access.application_answer_permits from public,anon,authenticated,service_role;
create trigger application_answers_immutable before update or delete on academy2_access.application_answers for each row execute function academy2_access.opening_immutable();

create function academy2_access.intake_fields(p_offering uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(r.configuration->'application_form'->'fields','[]'::jsonb)
 from (select plan_id,plan_revision from academy2_access.operation_sources where offering_id=p_offering
 union all select plan_id,plan_revision from academy2_access.opening_license_sources where offering_id=p_offering) s
 join academy2_access.sales_plan_draft_revisions r on r.draft_id=s.plan_id and r.revision=s.plan_revision limit 1
$$;
create function academy2_access.normalize_intake_answers(p_fields jsonb,p_answers jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare f jsonb; k text; v text; result jsonb:='{}'; seen text[]:='{}';
begin
 if jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields)>30 or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>40000 then raise exception 'application_answers_invalid' using errcode='22023';end if;
 for f in select value from jsonb_array_elements(p_fields) loop
  k:=f->>'id';
  if k is null or k=any(seen) or jsonb_typeof(f->'required') is distinct from 'boolean' or length(coalesce(f->>'label','')) not between 1 and 200 then raise exception 'application_form_invalid' using errcode='22023';end if;
  seen:=array_append(seen,k);
  if k in('name','email','terms') then continue;end if;
  if not ((k='phone' and f->>'type'='tel') or (k='notes' and f->>'type'='textarea') or (k ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and f->>'type'='text')) then raise exception 'application_form_unsupported' using errcode='22023';end if;
  if p_answers ? k and jsonb_typeof(p_answers->k)<>'string' then raise exception 'application_answers_invalid' using errcode='22023';end if;
  v:=btrim(coalesce(p_answers->>k,''));
  if (f->>'required')::boolean and v='' then raise exception 'application_answer_required' using errcode='22023';end if;
  if length(v)>(case when k='phone' then 50 when k='notes' then 4000 else 1000 end) then raise exception 'application_answer_too_long' using errcode='22023';end if;
  result:=result||jsonb_build_object(k,v);
 end loop;
 if exists(select 1 from jsonb_object_keys(p_answers) a where not result ? a) then raise exception 'application_answer_unknown' using errcode='22023';end if;
 return result;
end$$;

create function academy2_access.public_intake_with_form(p_id uuid,p_instructor boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb; fields jsonb;
begin
 ctx:=academy2_access.public_intake(p_id,p_instructor);
 if ctx is null or ctx->>'mode' not in('headquarters','instructor') then return ctx;end if;
 fields:=coalesce(academy2_access.intake_fields((ctx->'offering'->>'id')::uuid),'[]');
 return ctx||jsonb_build_object('applicationForm',jsonb_build_object('fields',fields));
end$$;
create function academy2_access.application_answers_insert_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare fields jsonb;
begin
 fields:=coalesce(academy2_access.intake_fields(new.offering_id),'[]');
 if exists(select 1 from jsonb_array_elements(fields) f where f->>'id' not in('name','email','terms')) and not exists(
 select 1 from academy2_access.application_answer_permits p where p.learner_user_id=new.learner_user_id and p.request_id=new.request_token and p.offering_id=new.offering_id and p.transaction_id=txid_current()) then
 raise exception 'application_answers_required' using errcode='22023';end if;
 return new;
end$$;
create trigger academy2_application_answers_guard before insert on public.academy_offering_applications for each row execute function academy2_access.application_answers_insert_guard();

create function academy2_access.submit_public_intake_with_answers(p_id uuid,p_instructor boolean,p_request uuid,p_name text,p_terms text,p_agree boolean,p_price numeric,p_class uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old academy2_access.application_answers%rowtype; fields jsonb; answers jsonb; result jsonb; offer uuid; ctx jsonb;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or p_request is null then raise exception 'authenticated_user_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request::text,213000));
 select * into old from academy2_access.application_answers where learner_user_id=auth.uid() and request_id=p_request;
 if found then
  answers:=academy2_access.normalize_intake_answers(old.fields,p_answers);
  if old.source_id is distinct from p_id or old.instructor is distinct from p_instructor or old.answers is distinct from answers then raise exception 'application_answer_retry_changed' using errcode='PT409';end if;
  return academy2_access.submit_public_intake(p_id,p_instructor,p_request,p_name,p_terms,p_agree,p_price,p_class);
 end if;
 ctx:=academy2_access.public_intake(p_id,p_instructor);
 if ctx is null or ctx->>'mode' not in('headquarters','instructor') then raise exception 'intake_unavailable' using errcode='42501';end if;
 offer:=(ctx->'offering'->>'id')::uuid;
 -- Lock publication source revision through the existing submit in this transaction.
 perform 1 from academy2_access.operation_sources where offering_id=offer for share;
 perform 1 from academy2_access.opening_license_sources where offering_id=offer for share;
 fields:=coalesce(academy2_access.intake_fields(offer),'[]');
 answers:=academy2_access.normalize_intake_answers(fields,p_answers);
 if exists(select 1 from public.academy_offering_applications where learner_user_id=auth.uid() and request_token=p_request) then raise exception 'application_answer_snapshot_missing' using errcode='PT409';end if;
 insert into academy2_access.application_answer_permits values(auth.uid(),p_request,txid_current(),offer);
 result:=academy2_access.submit_public_intake(p_id,p_instructor,p_request,p_name,p_terms,p_agree,p_price,p_class);
 insert into academy2_access.application_answers(application_id,learner_user_id,request_id,source_id,instructor,fields,answers) values((result->>'id')::uuid,auth.uid(),p_request,p_id,p_instructor,fields,answers);
 delete from academy2_access.application_answer_permits where learner_user_id=auth.uid() and request_id=p_request;
 return result;
end$$;
create function academy2_access.my_application_answers(p_application uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r academy2_access.application_answers%rowtype;
begin
 select * into r from academy2_access.application_answers where application_id=p_application and learner_user_id=auth.uid();
 if not found then raise exception 'application_answers_not_found' using errcode='42501';end if;
 return jsonb_build_object('fields',r.fields,'answers',r.answers,'savedAt',r.created_at);
end$$;
create function public.academy2_public_intake_with_form(p_id uuid,p_instructor boolean) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.public_intake_with_form(p_id,p_instructor)$$;
create function public.academy2_submit_public_intake_with_answers(p_id uuid,p_instructor boolean,p_request uuid,p_name text,p_terms text,p_agree boolean,p_price numeric,p_class uuid,p_answers jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.submit_public_intake_with_answers(p_id,p_instructor,p_request,p_name,p_terms,p_agree,p_price,p_class,p_answers)$$;
create function public.academy2_my_application_answers(p_application uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.my_application_answers(p_application)$$;
revoke all on function academy2_access.intake_fields(uuid),academy2_access.normalize_intake_answers(jsonb,jsonb),academy2_access.application_answers_insert_guard(),academy2_access.public_intake_with_form(uuid,boolean),academy2_access.submit_public_intake_with_answers(uuid,boolean,uuid,text,text,boolean,numeric,uuid,jsonb),academy2_access.my_application_answers(uuid),public.academy2_public_intake_with_form(uuid,boolean),public.academy2_submit_public_intake_with_answers(uuid,boolean,uuid,text,text,boolean,numeric,uuid,jsonb),public.academy2_my_application_answers(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.public_intake_with_form(uuid,boolean),public.academy2_public_intake_with_form(uuid,boolean) to anon,authenticated;
grant execute on function academy2_access.submit_public_intake_with_answers(uuid,boolean,uuid,text,text,boolean,numeric,uuid,jsonb),public.academy2_submit_public_intake_with_answers(uuid,boolean,uuid,text,text,boolean,numeric,uuid,jsonb),academy2_access.my_application_answers(uuid),public.academy2_my_application_answers(uuid) to authenticated;

create function academy2_access.intake_form_supported(p_fields jsonb) returns boolean language plpgsql immutable security definer set search_path='' as $$
declare sample jsonb;
begin
 select coalesce(jsonb_object_agg(f->>'id','x'::text),'{}') into sample from jsonb_array_elements(p_fields) f where f->>'id' not in('name','email','terms');
 perform academy2_access.normalize_intake_answers(p_fields,sample);
 return true;
exception when others then return false;
end$$;
revoke all on function academy2_access.intake_form_supported(jsonb) from public,anon,authenticated,service_role;
-- Upgrade only the additional-question hold after its required-answer enforcement exists.
do $upgrade$
declare definition text; old_condition text:=$old$conf ? 'application_form' and exists(select 1 from jsonb_array_elements(conf#>'{application_form,fields}') f where f->>'id' not in('name','email','terms'))$old$;
begin
 definition:=pg_get_functiondef('academy2_access.plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer)'::regprocedure);
 if length(definition)-length(replace(definition,old_condition,''))<>length(old_condition) then raise exception 'publication_readiness_expected_condition_missing';end if;
 definition:=replace(definition,old_condition,$new$conf ? 'application_form' and not academy2_access.intake_form_supported(conf#>'{application_form,fields}')$new$);
 execute definition;
end$upgrade$;
