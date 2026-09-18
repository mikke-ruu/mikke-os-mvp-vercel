-- Sequential manual purchase; no automatic charge, no provider API, no credit grant
-- until HQ confirms each stage. Every future price/access rule is fixed at stage 1.
alter table public.academy_offerings add column completion_mode text not null default 'learner' check(completion_mode in ('learner','hq'));
alter table public.academy_offering_applications add column stage_index integer not null default 0 check(stage_index between 0 and 100), add column purchase_snapshot jsonb, add column completed_at timestamptz, add column completed_by uuid references auth.users(id) on delete restrict;
alter table public.academy_offering_applications add constraint offering_completion_pair check((completed_at is null and completed_by is null) or (status='paid' and completed_at is not null and completed_by is not null));
do $$declare v_name text; begin
 select conname into v_name from pg_constraint where conrelid='public.academy_offering_applications'::regclass and contype='u' and pg_get_constraintdef(oid)='UNIQUE (offering_id, learner_user_id)';
 if v_name is null then raise exception 'offering_unique_contract_missing'; end if;
 execute format('alter table public.academy_offering_applications drop constraint %I',v_name);
end$$;
alter table public.academy_offering_applications add constraint offering_learner_stage_unique unique(offering_id,learner_user_id,stage_index);

create or replace function private.academy_guard_offering() returns trigger language plpgsql security definer set search_path='' as $$
declare v_count integer; v_actor uuid:=auth.uid(); v_price jsonb;
begin
 if v_actor is null or not private.academy_can_manage_headquarters(new.headquarters_id) then raise exception 'offering_forbidden' using errcode='42501'; end if;
 if coalesce(private.academy_headquarters_access_mode(new.headquarters_id),'blocked') not in('paid','trial_active') then raise exception 'offering_headquarters_read_only'; end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.headquarters_id is distinct from old.headquarters_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at) then raise exception 'offering_identity_immutable'; end if;
 if tg_op='INSERT' and new.created_by is distinct from v_actor then raise exception 'offering_invalid_creator'; end if;
 if cardinality(new.course_ids)>100 or cardinality(new.course_ids)<>(select count(distinct x) from unnest(new.course_ids)x) then raise exception 'offering_invalid_course_ids'; end if;
 select count(*) into v_count from public.academy_courses c where c.id=any(new.course_ids) and c.headquarters_id=new.headquarters_id;
 if v_count<>cardinality(new.course_ids) then raise exception 'offering_course_scope_mismatch'; end if;
 if length(new.title)>300 or octet_length(new.lp_blocks::text)>2000000 then raise exception 'offering_payload_too_large'; end if;
 if new.status='published' then
  if nullif(btrim(new.title),'') is null or cardinality(new.course_ids)=0 then raise exception 'offering_incomplete'; end if;
  if new.kind='月額レッスン' then raise exception 'offering_monthly_billing_not_ready'; end if;
  if new.purchase_mode='staged' then
   if cardinality(new.course_ids)<2 or (select count(*) from jsonb_object_keys(new.stage_prices))<>cardinality(new.course_ids) then raise exception 'offering_stage_prices_invalid'; end if;
   for v_price in select new.stage_prices->x::text from unnest(new.course_ids)x loop
    if v_price is null or jsonb_typeof(v_price) not in('number','string') or (v_price#>>'{}') !~ '^[0-9]{1,8}$' then raise exception 'offering_stage_prices_invalid'; end if;
   end loop;
  end if;
  if not public.academy_is_publicly_available(new.headquarters_id) then raise exception 'offering_headquarters_not_public'; end if;
  if exists(select 1 from public.academy_courses c where c.id=any(new.course_ids) and not c.is_published) then raise exception 'offering_course_not_ready'; end if;
 end if;
 new.updated_at:=clock_timestamp();return new;
end;$$;

create or replace function private.academy_guard_offering_application() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['status','paid_at','paid_by','completed_at','completed_by']) is distinct from (to_jsonb(old)-array['status','paid_at','paid_by','completed_at','completed_by']) then raise exception 'offering_application_snapshot_immutable'; end if;
 if old.status='paid' and (new.status is distinct from old.status or new.paid_at is distinct from old.paid_at or new.paid_by is distinct from old.paid_by) then raise exception 'offering_payment_immutable'; end if;
 if old.completed_at is not null and (new.completed_at is distinct from old.completed_at or new.completed_by is distinct from old.completed_by) then raise exception 'offering_completion_immutable'; end if;
 return new;
end;$$;

-- Keep the original all-at-once implementation, callable only by the checked RPC.
alter function public.academy_submit_offering_application(uuid,uuid,text,text,text,numeric) set schema private;
alter function private.academy_submit_offering_application(uuid,uuid,text,text,text,numeric) rename to academy_submit_all_offering_application;
revoke all on function private.academy_submit_all_offering_application(uuid,uuid,text,text,text,numeric) from public,anon,authenticated,service_role;

create function public.academy_submit_offering_application(p_offering_id uuid,p_request_token uuid,p_applicant_name text,p_applicant_email text,p_payment_method text,p_expected_price numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_off public.academy_offerings; v_app public.academy_offering_applications; v_last public.academy_offering_applications; v_purchase jsonb; v_courses jsonb; v_course jsonb; v_ids uuid[]; v_index integer; v_price numeric;
begin
 if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'offering_sign_in_required' using errcode='42501'; end if;
 if p_request_token is null or nullif(btrim(p_applicant_name),'') is null or p_applicant_email is null or length(p_applicant_name)>200 or length(p_applicant_email)>320 or p_applicant_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'offering_invalid_application'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||p_offering_id::text,0));
 select * into v_app from public.academy_offering_applications where learner_user_id=v_actor and request_token=p_request_token;
 if found then
  if v_app.offering_id<>p_offering_id then raise exception 'offering_request_token_conflict'; end if;
  return to_jsonb(v_app);
 end if;
 select * into v_off from public.academy_offerings where id=p_offering_id for share;
 select * into v_last from public.academy_offering_applications where learner_user_id=v_actor and offering_id=p_offering_id order by stage_index desc limit 1;
 if found and v_last.stage_index=0 then return to_jsonb(v_last); end if;
 if v_last.id is null and v_off.purchase_mode='all' then
  return private.academy_submit_all_offering_application(p_offering_id,p_request_token,p_applicant_name,p_applicant_email,p_payment_method,p_expected_price);
 end if;
 if v_off.id is null or v_off.status<>'published' or not public.academy_is_publicly_available(v_off.headquarters_id) then raise exception 'offering_not_available'; end if;
 if v_last.id is not null then
  if v_last.status='pending' then return to_jsonb(v_last); end if;
  if v_last.completed_at is null then raise exception 'offering_previous_course_incomplete'; end if;
  v_purchase:=v_last.purchase_snapshot;
  v_index:=v_last.stage_index+1;
 else
  if v_off.purchase_mode<>'staged' or v_off.kind='月額レッスン' then raise exception 'offering_purchase_mode_not_ready'; end if;
  perform c.id from public.academy_courses c where c.id=any(v_off.course_ids) order by c.id for share;
  select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'main_image_url',c.main_image_url,'learner_access_mode',c.learner_access_mode,'learner_access_days',c.learner_access_days,'learner_access_fixed_end_at',c.learner_access_fixed_end_at) order by array_position(v_off.course_ids,c.id)) into v_courses from public.academy_courses c where c.id=any(v_off.course_ids) and c.headquarters_id=v_off.headquarters_id and c.is_published;
  if coalesce(jsonb_array_length(v_courses),0)<>cardinality(v_off.course_ids) then raise exception 'offering_course_not_available'; end if;
  v_purchase:=jsonb_build_object('course_ids',v_off.course_ids,'stage_prices',v_off.stage_prices,'courses',v_courses,'title',v_off.title,'currency',v_off.currency,'payment_methods',v_off.payment_methods,'completion_mode',v_off.completion_mode);
  v_index:=1;
 end if;
 select array_agg(x::uuid order by ord) into v_ids from jsonb_array_elements_text(v_purchase->'course_ids') with ordinality t(x,ord);
 if v_index>cardinality(v_ids) then raise exception 'offering_all_stages_complete'; end if;
 if p_payment_method is null or not (v_purchase->'payment_methods') ? p_payment_method then raise exception 'offering_payment_method_invalid'; end if;
 v_price:=(v_purchase->'stage_prices'->>v_ids[v_index]::text)::numeric;
 if v_price is null or p_expected_price is null or v_price is distinct from p_expected_price then raise exception 'offering_price_changed'; end if;
 v_course:=v_purchase->'courses'->(v_index-1);
 if (v_course->>'id')::uuid is distinct from v_ids[v_index] or not exists(select 1 from public.academy_courses c where c.id=v_ids[v_index] and c.headquarters_id=v_off.headquarters_id) then raise exception 'offering_course_scope_mismatch'; end if;
 if (v_course->>'learner_access_mode' in('days_after_payment','days_after_enrollment','days_after_completion') and (v_course->>'learner_access_days' is null or (v_course->>'learner_access_days')::integer<=0)) or (v_course->>'learner_access_mode'='fixed_end' and (v_course->>'learner_access_fixed_end_at' is null or (v_course->>'learner_access_fixed_end_at')::timestamptz<=clock_timestamp())) then raise exception 'offering_access_window_invalid'; end if;
 insert into public.academy_offering_applications(offering_id,headquarters_id,learner_user_id,request_token,applicant_name,applicant_email,offering_title,course_ids,course_snapshot,price,currency,payment_method,stage_index,purchase_snapshot)
 values(v_off.id,v_off.headquarters_id,v_actor,p_request_token,btrim(p_applicant_name),btrim(p_applicant_email),v_purchase->>'title',array[v_ids[v_index]],jsonb_build_array(v_course),v_price,v_purchase->>'currency',p_payment_method,v_index,v_purchase) returning * into v_app;
 return to_jsonb(v_app);
end;$$;
revoke all on function public.academy_submit_offering_application(uuid,uuid,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.academy_submit_offering_application(uuid,uuid,text,text,text,numeric) to authenticated;

create function public.academy_complete_offering_course(p_application_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_app public.academy_offering_applications;v_course jsonb;v_grant uuid;v_now timestamptz:=now();
begin
 if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'offering_sign_in_required' using errcode='42501'; end if;
 select * into v_app from public.academy_offering_applications where id=p_application_id for update;
 if not found then raise exception 'offering_forbidden' using errcode='42501'; end if;
 if not private.academy_can_manage_headquarters(v_app.headquarters_id) and not(v_app.learner_user_id=v_actor and coalesce(v_app.purchase_snapshot->>'completion_mode','learner')='learner') then raise exception 'offering_forbidden' using errcode='42501'; end if;
 if v_app.status<>'paid' then raise exception 'offering_payment_required'; end if;
 if v_app.completed_at is not null then return to_jsonb(v_app); end if;
 if coalesce(private.academy_headquarters_access_mode(v_app.headquarters_id),'blocked')<>'paid' then raise exception 'offering_headquarters_read_only'; end if;
 for v_course in select value from jsonb_array_elements(v_app.course_snapshot) where value->>'learner_access_mode'='days_after_completion' loop
  if v_course->>'learner_access_days' is null or (v_course->>'learner_access_days')::integer<=0 then raise exception 'offering_access_window_invalid'; end if;
  if not exists(select 1 from public.academy_courses c where c.id=(v_course->>'id')::uuid and c.headquarters_id=v_app.headquarters_id) then raise exception 'offering_course_scope_mismatch'; end if;
  insert into public.academy_course_access_grants(headquarters_id,course_id,application_id,learner_user_id,source,status,starts_at,ends_at,created_by_user_id)
  values(v_app.headquarters_id,(v_course->>'id')::uuid,null,v_app.learner_user_id,'completion','active',v_now,v_now+((v_course->>'learner_access_days')::integer*interval '1 day'),v_actor) returning id into v_grant;
  insert into public.academy_offering_application_grants(application_id,course_id,access_grant_id) values(v_app.id,(v_course->>'id')::uuid,v_grant);
 end loop;
 update public.academy_offering_applications set completed_at=v_now,completed_by=v_actor where id=v_app.id returning * into v_app;
 return to_jsonb(v_app);
end;$$;
revoke all on function public.academy_complete_offering_course(uuid) from public,anon,authenticated;
grant execute on function public.academy_complete_offering_course(uuid) to authenticated;

-- Extend the safe public projection without changing its existing field meanings.
alter function public.academy_get_public_offering(uuid) set schema private;
alter function private.academy_get_public_offering(uuid) rename to academy_get_public_offering_base;
revoke all on function private.academy_get_public_offering_base(uuid) from public,anon,authenticated,service_role;
create function public.academy_get_public_offering(p_offering_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select private.academy_get_public_offering_base(p_offering_id)||jsonb_build_object('completion_mode',o.completion_mode) from public.academy_offerings o where o.id=p_offering_id;
$$;
revoke all on function public.academy_get_public_offering(uuid) from public,anon,authenticated;
grant execute on function public.academy_get_public_offering(uuid) to anon,authenticated;
