-- Add availability only to already-authorized public event projections.
begin;
do $$begin
 if md5(replace(pg_get_functiondef('academy2_access.public_intake_with_form(uuid,boolean)'::regprocedure),chr(13),''))<>'90d616f34fff32444db9fd326e9af56a' then raise exception 'public_intake_definition_changed';end if;
end$$;
alter function academy2_access.public_intake_with_form(uuid,boolean) rename to public_intake_before_capacity;
revoke all on function academy2_access.public_intake_before_capacity(uuid,boolean) from public,anon,authenticated,service_role;
create function academy2_access.with_public_event_capacity(p_context jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare event jsonb;events jsonb:='[]';c public.academy_classes;remaining bigint;hq uuid;
begin
 if p_context is null or p_context->>'mode'<>'headquarters' then return p_context;end if;
 hq:=(p_context->'offering'->>'headquarters_id')::uuid;
 for event in select value from jsonb_array_elements(coalesce(p_context->'events','[]')) loop
  select * into c from public.academy_classes where id=(event->>'id')::uuid and headquarters_id=hq;
  if not found then
   events:=events||jsonb_build_array(event||jsonb_build_object('formReady',false,'remainingCapacity',null));
   continue;
  end if;
  remaining:=null;
  if c.capacity is not null then
   remaining:=greatest(0,c.capacity-(select count(*) from academy2_access.event_attendees(hq,c.id))-(select count(*) from academy2_access.guest_applications where class_id=c.id));
  end if;
  events:=events||jsonb_build_array(event||jsonb_build_object('remainingCapacity',remaining,'formReady',coalesce((event->>'formReady')::boolean,true) and (remaining is null or remaining>0)));
 end loop;
 return p_context||jsonb_build_object('events',events);
end$$;
create function academy2_access.public_intake_with_form(p_id uuid,p_instructor boolean) returns jsonb language sql stable security definer set search_path='' as $$
 select academy2_access.with_public_event_capacity(academy2_access.public_intake_before_capacity(p_id,p_instructor))
$$;
revoke all on function academy2_access.with_public_event_capacity(jsonb),academy2_access.public_intake_with_form(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function academy2_access.public_intake_with_form(uuid,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
