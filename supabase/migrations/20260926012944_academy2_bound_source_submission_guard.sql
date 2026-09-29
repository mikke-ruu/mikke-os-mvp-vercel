-- New opt-in submissions must keep their consent and immutable plan linkage.
-- Existing rows and unbound legacy sales retain their existing behavior.
create table academy2_access.submission_permits (
 application_id uuid primary key,offering_id uuid not null references public.academy_offerings(id),
 actor_id uuid not null references auth.users(id),request_id uuid not null,transaction_id bigint not null
);
alter table academy2_access.submission_permits enable row level security;
revoke all on academy2_access.submission_permits from public,anon,authenticated,service_role;
create function academy2_access.guard_bound_submission() returns trigger
language plpgsql security definer set search_path='' as $$
declare consumed uuid;
begin
 if exists(select 1 from academy2_access.operation_sources where offering_id=new.offering_id) then
  delete from academy2_access.submission_permits where application_id=new.id and offering_id=new.offering_id and actor_id=auth.uid() and actor_id=new.learner_user_id and request_id=new.request_token and transaction_id=txid_current() returning application_id into consumed;
  if consumed is null then raise exception 'academy2_dedicated_application_required' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function academy2_access.guard_bound_submission() from public,anon,authenticated,service_role;
create trigger academy2_bound_submission_guard before insert on public.academy_offering_applications for each row execute function academy2_access.guard_bound_submission();
create function academy2_access.guard_legacy_event_entry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from academy2_access.event_plans where class_id=new.class_id) then
  if tg_op='INSERT' then raise exception 'academy2_dedicated_application_required' using errcode='42501';end if;
  if new.class_id is distinct from old.class_id or (tg_table_name='academy_offering_class_bookings' and to_jsonb(new)->>'status'='assigned' and to_jsonb(old)->>'status'<>'assigned') then raise exception 'academy2_dedicated_application_required' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function academy2_access.guard_legacy_event_entry() from public,anon,authenticated,service_role;
create trigger academy2_legacy_event_application_guard before insert or update on public.academy_applications for each row execute function academy2_access.guard_legacy_event_entry();
create trigger academy2_legacy_event_booking_guard before insert or update on public.academy_offering_class_bookings for each row execute function academy2_access.guard_legacy_event_entry();
-- Patch the already-installed function, with an explicit shape check.
do $migration$ declare definition text;needle text:='insert into public.academy_offering_applications(id,offering_id';begin
 definition:=pg_get_functiondef('academy2_access.submit_operation(uuid,uuid,text,text,boolean,numeric,uuid)'::regprocedure);
 if position('insert into academy2_access.submission_permits' in definition)=0 then
  if position(needle in definition)=0 then raise exception 'academy2_unrecognized_submit_function';end if;
  definition:=replace(definition,needle,'insert into academy2_access.submission_permits(application_id,offering_id,actor_id,request_id,transaction_id) values(new_id,p_offering,auth.uid(),p_request,txid_current());'||chr(10)||needle);
  execute definition;
 end if;
end $migration$;
notify pgrst,'reload schema';
