-- Serialize instructor responses per class. The original ACR-3 migration is
-- also corrected for fresh databases; this migration updates databases where
-- the original function has already been applied.

create or replace function public.academy_respond_class_instructor_request(
  p_request_id uuid,
  p_status text,
  p_response_note text default null
)
returns public.academy_class_instructor_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_class_id uuid;
  v_request public.academy_class_instructor_requests%rowtype;
  v_next public.academy_class_instructor_requests%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('accepted', 'declined') then
    raise exception 'Unsupported response status';
  end if;

  select class_id
  into v_class_id
  from public.academy_class_instructor_requests
  where id = p_request_id;

  if v_class_id is null then
    raise exception 'Request not found';
  end if;

  perform 1
  from public.academy_classes
  where id = v_class_id
  for update;

  select *
  into v_request
  from public.academy_class_instructor_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Request not found';
  end if;

  if v_request.status <> 'requested' then
    raise exception 'Request is already closed';
  end if;

  if not exists (
    select 1
    from public.academy_instructors instructor
    where instructor.id = v_request.instructor_id
      and instructor.user_id = v_actor_user_id
      and instructor.is_active = true
  ) then
    raise exception 'Permission denied';
  end if;

  if not private.academy_class_instructor_request_scope_valid(
    v_request.headquarters_id,
    v_request.class_id,
    v_request.instructor_id
  ) then
    raise exception 'Request scope is no longer valid';
  end if;

  update public.academy_class_instructor_requests
  set status = p_status,
      response_note = nullif(trim(coalesce(p_response_note, '')), ''),
      responded_at = now(),
      updated_at = now()
  where id = p_request_id
  returning * into v_next;

  if p_status = 'accepted' then
    update public.academy_classes
    set instructor_id = v_request.instructor_id,
        updated_at = now()
    where id = v_request.class_id
      and headquarters_id = v_request.headquarters_id;

    update public.academy_class_instructor_requests
    set status = 'cancelled',
        updated_at = now()
    where class_id = v_request.class_id
      and id <> p_request_id
      and status = 'requested';
  end if;

  return v_next;
end;
$$;

revoke all on function public.academy_respond_class_instructor_request(uuid, text, text)
  from public, anon;
grant execute on function public.academy_respond_class_instructor_request(uuid, text, text)
  to authenticated;
