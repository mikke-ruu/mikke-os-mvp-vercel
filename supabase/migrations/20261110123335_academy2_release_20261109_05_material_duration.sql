-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-material-duration.local.sql
-- LOCAL ONLY. Preserve old plan revisions; no production application.
begin;
create function academy2_access.material_access_period_open(p_paid timestamptz,p_completed timestamptz,p_configuration jsonb,p_now timestamptz) returns boolean
language plpgsql immutable set search_path='' as $$
declare months_text text; starts timestamptz;
begin
 months_text:=p_configuration#>>'{materials,access_months}';
 if months_text is null then return true;end if;
 if months_text!~'^[0-9]{1,3}$' then return false;end if;
 if months_text::integer not between 1 and 120 then return false;end if;
 starts:=case when p_configuration#>>'{materials,starts}'='after_attendance' then p_completed else p_paid end;
 return starts is not null and p_now<(((starts at time zone 'Asia/Tokyo')+make_interval(months=>months_text::integer)) at time zone 'Asia/Tokyo');
end $$;
revoke all on function academy2_access.material_access_period_open(timestamptz,timestamptz,jsonb,timestamptz) from public,anon,authenticated,service_role;
create function academy2_access.material_access_window_open(p_application uuid,p_configuration jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select academy2_access.material_access_period_open(a.paid_at,a.completed_at,p_configuration,now()) from public.academy_offering_applications a where a.id=p_application),false);
$$;
revoke all on function academy2_access.material_access_window_open(uuid,jsonb) from public,anon,authenticated,service_role;
create function academy2_access.validate_material_duration() returns trigger language plpgsql set search_path='' as $$
declare value jsonb:=new.configuration#>'{materials,access_months}';
begin
 if value is not null and value<>'null'::jsonb then
  if jsonb_typeof(value)<>'number' or (value#>>'{}')!~'^[0-9]{1,3}$' then raise exception 'academy2_invalid_material_duration' using errcode='22023';end if;
  if (value#>>'{}')::integer not between 1 and 120 then raise exception 'academy2_invalid_material_duration' using errcode='22023';end if;
 end if;
 return new;
end $$;
revoke all on function academy2_access.validate_material_duration() from public,anon,authenticated,service_role;
create trigger validate_material_duration before insert on academy2_access.sales_plan_draft_revisions for each row execute function academy2_access.validate_material_duration();
do $patch$
declare definition text; expected text:=$old$and r.configuration#>>'{materials,enabled}'='true'$old$;
begin
 definition:=pg_get_functiondef('academy2_access.learner_material_access(uuid)'::regprocedure);
 if position(expected in definition)=0 or position('material_access_window_open' in definition)>0 then raise exception 'material_access_definition_changed';end if;
 execute replace(definition,expected,expected||' and academy2_access.material_access_window_open(a.id,r.configuration)');
end $patch$;
notify pgrst,'reload schema';
commit;
