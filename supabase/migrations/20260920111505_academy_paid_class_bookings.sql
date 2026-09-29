begin;
create schema academy_booking_private;
revoke all on schema academy_booking_private from public;
grant usage on schema academy_booking_private to authenticated;

create table public.academy_offering_class_bookings(
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.academy_offering_applications(id) on delete restrict,
  class_id uuid not null references public.academy_classes(id) on delete restrict,
  course_id uuid not null references public.academy_courses(id) on delete restrict,
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  learner_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null check(status in('assigned','cancelled')),
  assigned_at timestamptz not null,
  cancelled_at timestamptz,
  unique(application_id,class_id),
  check((status='assigned' and cancelled_at is null) or (status='cancelled' and cancelled_at is not null))
);
create unique index academy_booking_one_active_seat on public.academy_offering_class_bookings(class_id,learner_user_id) where status='assigned';
create index academy_booking_learner_idx on public.academy_offering_class_bookings(learner_user_id,class_id);
alter table public.academy_offering_class_bookings enable row level security;
revoke all on public.academy_offering_class_bookings from public,anon,authenticated,service_role;
-- No direct writes or reads. Authenticated DTO RPCs are the only application entry points.

create table academy_booking_private.operations(
  request_id uuid primary key,
  actor_id uuid not null,
  action text not null,
  application_id uuid not null,
  class_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table academy_booking_private.operations enable row level security;
revoke all on academy_booking_private.operations from public,anon,authenticated,service_role;

create function academy_booking_private.actor() returns uuid language plpgsql stable security invoker set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'BOOKING_SIGN_IN_REQUIRED' using errcode='42501';
  end if;
  return v_actor;
end; $$;

-- Purchase evidence is the immutable, server-confirmed manual application, not
-- a client flag and not a Stripe payment verification. Material timing is separate.
create function academy_booking_private.has_booking_purchase(p_application_id uuid,p_course_id uuid)
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare
  a public.academy_offering_applications;
  g public.academy_course_access_grants;
  v_ids uuid[];
  v_course jsonb;
  v_link uuid;
begin
  select * into a from public.academy_offering_applications where id=p_application_id;
  if not found or a.status is distinct from 'paid' or a.paid_at is null or a.paid_by is null
    or p_course_id is null or not coalesce(p_course_id=any(a.course_ids),false)
    or not exists(select 1 from public.academy_offerings o where o.id=a.offering_id and o.headquarters_id=a.headquarters_id)
    or not exists(select 1 from public.academy_courses c where c.id=p_course_id and c.headquarters_id=a.headquarters_id)
    or jsonb_typeof(a.course_snapshot) is distinct from 'array' then return false; end if;
  select array_agg((x->>'id')::uuid order by ord) into v_ids
    from jsonb_array_elements(a.course_snapshot) with ordinality t(x,ord);
  if v_ids is distinct from a.course_ids or cardinality(v_ids)=0
    or cardinality(v_ids)<>(select count(distinct x) from unnest(v_ids) x) then return false; end if;
  select x into v_course from jsonb_array_elements(a.course_snapshot) x where x->>'id'=p_course_id::text;
  if a.stage_index>0 then
    if jsonb_typeof(a.purchase_snapshot->'course_ids') is distinct from 'array'
      or jsonb_typeof(a.purchase_snapshot->'courses') is distinct from 'array'
      or a.course_ids is distinct from array[p_course_id]
      or a.purchase_snapshot->'course_ids'->>(a.stage_index-1) is distinct from p_course_id::text
      or a.purchase_snapshot->'courses'->(a.stage_index-1) is distinct from v_course
      or (a.purchase_snapshot->'stage_prices'->>p_course_id::text)::numeric is distinct from a.price
      or a.purchase_snapshot->>'currency' is distinct from a.currency then return false; end if;
  elsif a.stage_index=0 then
    -- Older all-at-once rows have no purchase_snapshot; their immutable
    -- course_snapshot remains the source. Never infer rights from live prices.
    if a.purchase_snapshot is not null and (
      a.purchase_snapshot->'course_ids' is distinct from to_jsonb(a.course_ids)
      or a.purchase_snapshot->'courses' is distinct from a.course_snapshot
      or (a.purchase_snapshot->>'price')::numeric is distinct from a.price
      or a.purchase_snapshot->>'currency' is distinct from a.currency
      or a.purchase_snapshot->>'purchase_mode' is distinct from 'all') then return false; end if;
  else return false;
  end if;
  select access_grant_id into v_link from public.academy_offering_application_grants
    where application_id=a.id and course_id=p_course_id;
  if not found then
    return coalesce(v_course->>'learner_access_mode'='days_after_completion'
      and (v_course->>'learner_access_days')::integer>0 and a.completed_at is null,false);
  end if;
  select * into g from public.academy_course_access_grants where id=v_link;
  -- Explicit revocation/corrupt linkage is not ordinary material expiry.
  -- starts_at/ends_at continue to govern material RLS, never seat eligibility.
  return found and g.headquarters_id is not distinct from a.headquarters_id
    and g.course_id is not distinct from p_course_id and g.learner_user_id is not distinct from a.learner_user_id
    and g.status is not distinct from 'active';
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
  return false;
end;
$$;

create function academy_booking_private.class_accepting(p_class_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.academy_classes c
    join public.academy_courses course on course.id=c.course_id and course.headquarters_id=c.headquarters_id
    where c.id=p_class_id and c.material_mode='course_current'
      and c.status in('planned','active') and c.registration_status='open'
      and (c.schedule_mode='arranged_after_application' or c.starts_at>=clock_timestamp())
      and (c.instructor_id is null or exists(select 1 from public.academy_instructors i
        where i.id=c.instructor_id and i.headquarters_id=c.headquarters_id and i.course_id=c.course_id
          and i.registration_status='registered' and i.is_certified and i.is_active and i.status='active'
          and (i.renewal_due is null or i.renewal_due>=(now() at time zone 'Asia/Tokyo')::date))));
$$;

create function academy_booking_private.manage(p_application_id uuid,p_class_id uuid,p_booking_id uuid,p_request_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=academy_booking_private.actor();
  v_app public.academy_offering_applications;
  v_class public.academy_classes;
  v_booking public.academy_offering_class_bookings;
  v_old academy_booking_private.operations;
  v_result jsonb;
  v_count integer;
begin
  if p_request_id is null or p_action not in('assign','cancel') then raise exception 'BOOKING_INVALID_REQUEST' using errcode='22023'; end if;
  if p_action='cancel' then
    select * into v_booking from public.academy_offering_class_bookings where id=p_booking_id;
    if not found then raise exception 'BOOKING_NOT_AVAILABLE' using errcode='42501'; end if;
    p_application_id:=v_booking.application_id; p_class_id:=v_booking.class_id;
  end if;
  select * into v_app from public.academy_offering_applications where id=p_application_id;
  if not found or not private.academy_can_manage_headquarters(v_app.headquarters_id)
    or coalesce(private.academy_headquarters_access_mode(v_app.headquarters_id),'blocked') not in('paid','trial_active') then
    raise exception 'BOOKING_FORBIDDEN' using errcode='42501';
  end if;
  -- Every seat mutation (including cancellation) locks the same class row first.
  select * into v_class from public.academy_classes where id=p_class_id for update;
  if not found or v_class.headquarters_id<>v_app.headquarters_id or v_class.material_mode<>'course_current' then
    raise exception 'BOOKING_CLASS_SCOPE_INVALID' using errcode='22023';
  end if;
  -- Serialize a request key even if a caller mistakenly reuses it on a different class.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_old from academy_booking_private.operations where request_id=p_request_id;
  if found then
    if v_old.actor_id<>v_actor or v_old.action<>p_action or v_old.application_id<>p_application_id or v_old.class_id<>p_class_id then
      raise exception 'BOOKING_REQUEST_CONFLICT' using errcode='22023';
    end if;
    return v_old.result||jsonb_build_object('replayed',true);
  end if;
  select * into v_booking from public.academy_offering_class_bookings
    where application_id=p_application_id and class_id=p_class_id for update;
  if p_action='cancel' then
    if v_booking.id is null or v_booking.id<>p_booking_id then raise exception 'BOOKING_NOT_AVAILABLE' using errcode='42501'; end if;
    update public.academy_offering_class_bookings set status='cancelled',cancelled_at=coalesce(cancelled_at,clock_timestamp())
      where id=v_booking.id returning * into v_booking;
    v_result:=jsonb_build_object('version',1,'outcome','cancelled','booking',to_jsonb(v_booking),'replayed',false);
  else
    if v_app.status<>'paid' then raise exception 'BOOKING_PAYMENT_REQUIRED' using errcode='23514'; end if;
    -- Lock the actual linked grants so revocation and assignment cannot cross unchecked.
    perform g.id from public.academy_offering_application_grants link
      join public.academy_course_access_grants g on g.id=link.access_grant_id
      where link.application_id=p_application_id and link.course_id=v_class.course_id for share of g;
    if not academy_booking_private.has_booking_purchase(p_application_id,v_class.course_id) then
      raise exception 'BOOKING_PURCHASE_NOT_VALID' using errcode='23514';
    end if;
    if not academy_booking_private.class_accepting(p_class_id) then
      raise exception 'BOOKING_CLASS_NOT_ACCEPTING' using errcode='23514';
    end if;
    select * into v_booking from public.academy_offering_class_bookings
      where class_id=p_class_id and learner_user_id=v_app.learner_user_id and status='assigned';
    if found then
      v_result:=jsonb_build_object('version',1,'outcome','already_assigned','booking',to_jsonb(v_booking),'replayed',false);
    else
      select count(*) into v_count from public.academy_offering_class_bookings where class_id=p_class_id and status='assigned';
      if v_class.capacity is not null and v_count>=v_class.capacity then
        v_result:=jsonb_build_object('version',1,'outcome','full','booking',null,'replayed',false);
      else
        insert into public.academy_offering_class_bookings(application_id,class_id,course_id,headquarters_id,learner_user_id,status,assigned_at)
          values(v_app.id,v_class.id,v_class.course_id,v_app.headquarters_id,v_app.learner_user_id,'assigned',clock_timestamp())
          on conflict(application_id,class_id) do update set status='assigned',assigned_at=excluded.assigned_at,cancelled_at=null
          returning * into v_booking;
        v_result:=jsonb_build_object('version',1,'outcome','assigned','booking',to_jsonb(v_booking),'replayed',false);
      end if;
    end if;
  end if;
  insert into academy_booking_private.operations(request_id,actor_id,action,application_id,class_id,result)
    values(p_request_id,v_actor,p_action,p_application_id,p_class_id,v_result);
  return v_result;
end; $$;

create function academy_booking_private.list_classes(p_application_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_app public.academy_offering_applications;
begin
  perform academy_booking_private.actor();
  select * into v_app from public.academy_offering_applications where id=p_application_id;
  if not found or not private.academy_can_manage_headquarters(v_app.headquarters_id) then raise exception 'BOOKING_FORBIDDEN' using errcode='42501'; end if;
  if v_app.status<>'paid' then raise exception 'BOOKING_PAYMENT_REQUIRED' using errcode='23514'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'headquarters_id',c.headquarters_id,'course_id',c.course_id,
    'title',c.title,'starts_at',c.starts_at,'ends_at',c.ends_at,'schedule_mode',c.schedule_mode,'format',c.format,
    'capacity',c.capacity,'assigned_count',seats.n,'remaining_capacity',case when c.capacity is null then null else greatest(c.capacity-seats.n,0) end)
    order by c.starts_at nulls last,c.id),'[]'::jsonb)
    from public.academy_classes c cross join lateral(select count(*)::integer n from public.academy_offering_class_bookings b where b.class_id=c.id and b.status='assigned') seats
    where c.headquarters_id=v_app.headquarters_id and academy_booking_private.class_accepting(c.id)
      and academy_booking_private.has_booking_purchase(v_app.id,c.course_id));
end; $$;

create function academy_booking_private.list_roster(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform academy_booking_private.actor();
  if not exists(select 1 from public.academy_classes c where c.id=p_class_id and private.academy_can_manage_headquarters(c.headquarters_id)) then
    raise exception 'BOOKING_FORBIDDEN' using errcode='42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('learner_name',a.applicant_name) order by b.assigned_at,b.id),'[]'::jsonb)
    from public.academy_offering_class_bookings b join public.academy_offering_applications a on a.id=b.application_id where b.class_id=p_class_id);
end; $$;

create function academy_booking_private.list_mine()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=academy_booking_private.actor();
begin
  return (select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('class_title',c.title,'starts_at',c.starts_at,'ends_at',c.ends_at,
    'schedule_mode',c.schedule_mode,'format',c.format,'venue_name',c.venue_name,'class_status',c.status,
    'meeting_url',case when b.status='assigned' and c.status<>'cancelled'
      and b.headquarters_id=c.headquarters_id and b.course_id=c.course_id
      and b.headquarters_id=a.headquarters_id and b.learner_user_id=a.learner_user_id
      and academy_booking_private.has_booking_purchase(b.application_id,b.course_id) then c.meeting_url else null end)
    order by c.starts_at nulls last,b.id),'[]'::jsonb)
    from public.academy_offering_class_bookings b join public.academy_classes c on c.id=b.class_id
      join public.academy_offering_applications a on a.id=b.application_id where b.learner_user_id=v_actor);
end; $$;

create function academy_booking_private.guard_class_seats()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  select count(*) into v_count from public.academy_offering_class_bookings b where b.class_id=old.id and b.status='assigned';
  if exists(select 1 from public.academy_offering_class_bookings b where b.class_id=old.id)
     and (new.id is distinct from old.id or new.headquarters_id is distinct from old.headquarters_id or new.course_id is distinct from old.course_id) then
    raise exception 'BOOKING_CLASS_IDENTITY_IMMUTABLE' using errcode='23514';
  end if;
  if new.capacity is not null and new.capacity<v_count then raise exception 'BOOKING_CAPACITY_BELOW_ASSIGNED' using errcode='23514'; end if;
  return new;
end; $$;
create trigger academy_class_booked_seats_guard before update on public.academy_classes for each row execute function academy_booking_private.guard_class_seats();

revoke all on all functions in schema academy_booking_private from public,anon,authenticated,service_role;
grant execute on function academy_booking_private.manage(uuid,uuid,uuid,uuid,text),academy_booking_private.list_classes(uuid),academy_booking_private.list_roster(uuid),academy_booking_private.list_mine() to authenticated;

create function public.academy_assign_paid_application_class(p_application_id uuid,p_class_id uuid,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select academy_booking_private.manage(p_application_id,p_class_id,null,p_request_id,'assign'); $$;
create function public.academy_cancel_offering_class_booking(p_booking_id uuid,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select academy_booking_private.manage(null,null,p_booking_id,p_request_id,'cancel'); $$;
create function public.academy_list_assignment_classes(p_application_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select academy_booking_private.list_classes(p_application_id); $$;
create function public.academy_list_class_bookings(p_class_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select academy_booking_private.list_roster(p_class_id); $$;
create function public.academy_list_my_offering_bookings()
returns jsonb language sql stable security invoker set search_path='' as $$ select academy_booking_private.list_mine(); $$;
revoke all on function public.academy_assign_paid_application_class(uuid,uuid,uuid),public.academy_cancel_offering_class_booking(uuid,uuid),public.academy_list_assignment_classes(uuid),public.academy_list_class_bookings(uuid),public.academy_list_my_offering_bookings() from public,anon,authenticated,service_role;
grant execute on function public.academy_assign_paid_application_class(uuid,uuid,uuid),public.academy_cancel_offering_class_booking(uuid,uuid),public.academy_list_assignment_classes(uuid),public.academy_list_class_bookings(uuid),public.academy_list_my_offering_bookings() to authenticated;
commit;
