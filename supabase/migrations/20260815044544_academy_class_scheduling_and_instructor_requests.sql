-- Academy ACR-3: class scheduling details and instructor requests.
-- This migration intentionally replaces the unapplied legacy migrations with a
-- new version after reconciling the current development database schema.

alter table public.academy_classes
  add column if not exists ends_at timestamptz null,
  add column if not exists capacity integer null,
  add column if not exists venue_name text null,
  add column if not exists meeting_url text null,
  add column if not exists schedule_mode text not null default 'fixed',
  add column if not exists registration_status text not null default 'open';

alter table public.academy_classes
  drop constraint if exists academy_classes_capacity_check,
  add constraint academy_classes_capacity_check
    check (capacity is null or capacity > 0),
  drop constraint if exists academy_classes_ends_after_starts_check,
  add constraint academy_classes_ends_after_starts_check
    check (ends_at is null or ends_at > starts_at),
  drop constraint if exists academy_classes_schedule_mode_check,
  add constraint academy_classes_schedule_mode_check
    check (schedule_mode in ('fixed', 'arranged_after_application')),
  drop constraint if exists academy_classes_registration_status_check,
  add constraint academy_classes_registration_status_check
    check (registration_status in ('draft', 'open', 'closed'));

create index if not exists academy_classes_schedule_mode_idx
  on public.academy_classes(headquarters_id, schedule_mode);

create index if not exists academy_classes_registration_status_idx
  on public.academy_classes(headquarters_id, registration_status);

create table public.academy_class_instructor_requests (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete cascade,
  class_id uuid not null references public.academy_classes(id) on delete cascade,
  instructor_id uuid not null references public.academy_instructors(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'cancelled')),
  request_note text null,
  response_note text null,
  respond_by timestamptz null,
  requested_by_user_id uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  responded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index academy_class_instructor_requests_active_unique
  on public.academy_class_instructor_requests(class_id, instructor_id)
  where status = 'requested';

create index academy_class_instructor_requests_hq_status_idx
  on public.academy_class_instructor_requests(headquarters_id, status);

create index academy_class_instructor_requests_instructor_status_idx
  on public.academy_class_instructor_requests(instructor_id, status);

alter table public.academy_class_instructor_requests enable row level security;

revoke all on table public.academy_class_instructor_requests from public, anon, authenticated;
grant select, insert on table public.academy_class_instructor_requests to authenticated;

create or replace function private.academy_class_instructor_request_scope_valid(
  p_headquarters_id uuid,
  p_class_id uuid,
  p_instructor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.academy_classes class_record
    join public.academy_instructors instructor
      on instructor.id = p_instructor_id
    where class_record.id = p_class_id
      and class_record.headquarters_id = p_headquarters_id
      and instructor.headquarters_id = p_headquarters_id
      and instructor.course_id = class_record.course_id
      and instructor.is_active = true
  );
$$;

revoke all on function private.academy_class_instructor_request_scope_valid(uuid, uuid, uuid)
  from public, anon;
grant execute on function private.academy_class_instructor_request_scope_valid(uuid, uuid, uuid)
  to authenticated;

create policy "academy_class_instructor_requests_owner_or_instructor_select"
on public.academy_class_instructor_requests
for select
to authenticated
using (
  public.academy_owns_hq(headquarters_id)
  or exists (
    select 1
    from public.academy_instructors instructor
    where instructor.id = academy_class_instructor_requests.instructor_id
      and instructor.user_id = (select auth.uid())
      and instructor.is_active = true
  )
);

create policy "academy_class_instructor_requests_owner_insert"
on public.academy_class_instructor_requests
for insert
to authenticated
with check (
  public.academy_owns_hq(headquarters_id)
  and requested_by_user_id = (select auth.uid())
  and private.academy_class_instructor_request_scope_valid(
    headquarters_id,
    class_id,
    instructor_id
  )
);

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
  v_request public.academy_class_instructor_requests%rowtype;
  v_next public.academy_class_instructor_requests%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('accepted', 'declined') then
    raise exception 'Unsupported response status';
  end if;

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

create or replace function public.academy_cancel_class_instructor_request(
  p_request_id uuid
)
returns public.academy_class_instructor_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_request public.academy_class_instructor_requests%rowtype;
  v_next public.academy_class_instructor_requests%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_request
  from public.academy_class_instructor_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Request not found';
  end if;

  if not public.academy_owns_hq(v_request.headquarters_id) then
    raise exception 'Permission denied';
  end if;

  if v_request.status <> 'requested' then
    return v_request;
  end if;

  update public.academy_class_instructor_requests
  set status = 'cancelled',
      updated_at = now()
  where id = p_request_id
  returning * into v_next;

  return v_next;
end;
$$;

revoke all on function public.academy_cancel_class_instructor_request(uuid)
  from public, anon;
grant execute on function public.academy_cancel_class_instructor_request(uuid)
  to authenticated;
