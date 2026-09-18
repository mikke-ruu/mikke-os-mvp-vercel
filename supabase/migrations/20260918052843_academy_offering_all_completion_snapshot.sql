-- Additive correction: all-at-once purchases also freeze completion authority.
-- Legacy NULL/malformed snapshots are HQ-only; never infer old consent from live settings.
create function private.academy_snapshot_all_offering_purchase() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_off public.academy_offerings;
begin
 if new.stage_index<>0 then return new; end if;
 if auth.uid() is null or new.learner_user_id is distinct from auth.uid() then raise exception 'offering_forbidden' using errcode='42501'; end if;
 select * into v_off from public.academy_offerings where id=new.offering_id for share;
 if not found or v_off.headquarters_id is distinct from new.headquarters_id or v_off.purchase_mode<>'all' then raise exception 'offering_purchase_scope_mismatch'; end if;
 new.purchase_snapshot:=jsonb_build_object('course_ids',new.course_ids,'courses',new.course_snapshot,'title',new.offering_title,'price',new.price,'currency',new.currency,'payment_methods',v_off.payment_methods,'completion_mode',v_off.completion_mode,'purchase_mode','all');
 return new;
end;$$;
revoke all on function private.academy_snapshot_all_offering_purchase() from public,anon,authenticated,service_role;
create trigger academy_offering_all_purchase_snapshot before insert on public.academy_offering_applications
 for each row execute function private.academy_snapshot_all_offering_purchase();

create or replace function public.academy_complete_offering_course(p_application_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_app public.academy_offering_applications;v_course jsonb;v_grant uuid;v_now timestamptz:=now();
begin
 if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'offering_sign_in_required' using errcode='42501'; end if;
 select * into v_app from public.academy_offering_applications where id=p_application_id for update;
 if not found then raise exception 'offering_forbidden' using errcode='42501'; end if;
 if not private.academy_can_manage_headquarters(v_app.headquarters_id) and not(v_app.learner_user_id=v_actor and coalesce(v_app.purchase_snapshot->>'completion_mode','hq')='learner') then raise exception 'offering_forbidden' using errcode='42501'; end if;
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
