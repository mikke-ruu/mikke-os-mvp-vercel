-- Keep Academy certification history while ending a trainer's registered use.
-- This migration is intentionally separate from billing snapshots and Stripe.

alter table public.academy_instructors
  add column if not exists registration_status text not null default 'registered',
  add column if not exists registered_at timestamptz not null default now(),
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by_user_id uuid references auth.users(id) on delete set null;

alter table public.academy_instructors
  drop constraint if exists academy_instructors_registration_status_check,
  add constraint academy_instructors_registration_status_check
    check (registration_status in ('registered', 'withdrawn')),
  drop constraint if exists academy_instructors_withdrawal_fields_check,
  add constraint academy_instructors_withdrawal_fields_check
    check (
      (registration_status = 'registered' and withdrawn_at is null)
      or (registration_status = 'withdrawn' and withdrawn_at is not null)
    );

create index if not exists academy_instructors_hq_registration_status_idx
  on public.academy_instructors(headquarters_id, registration_status);

create or replace function private.academy_guard_instructor_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_transition text := current_setting('mikke.academy_registration_transition', true);
begin
  if (
    new.registration_status is distinct from old.registration_status
    or new.registered_at is distinct from old.registered_at
    or new.withdrawn_at is distinct from old.withdrawn_at
    or new.withdrawn_by_user_id is distinct from old.withdrawn_by_user_id
  ) and v_transition <> 'withdraw' then
    raise exception 'academy_instructor_registration_rpc_required';
  end if;

  if old.registration_status = 'withdrawn' and (
    new.is_active is distinct from old.is_active
    or new.is_listed is distinct from old.is_listed
    or new.accepts_applications is distinct from old.accepts_applications
    or new.display_on_story is distinct from old.display_on_story
  ) then
    raise exception 'academy_instructor_reinstatement_required';
  end if;

  if new.registration_status = 'withdrawn' and (
    new.is_active
    or new.is_listed
    or new.accepts_applications
    or new.display_on_story
  ) then
    raise exception 'academy_withdrawn_instructor_must_be_private';
  end if;

  return new;
end;
$$;

drop trigger if exists academy_guard_instructor_registration
  on public.academy_instructors;
create trigger academy_guard_instructor_registration
before update on public.academy_instructors
for each row execute function private.academy_guard_instructor_registration();

-- The live trigger protects headquarters-managed columns from instructor
-- self-updates, but it only recognizes the owner. Keep the same protection
-- while allowing an active administrator to perform the management actions
-- advertised by academy_list_my_contexts().
create or replace function public.academy_guard_instructor_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.academy_can_manage_headquarters(new.headquarters_id) then
    new.headquarters_id := old.headquarters_id;
    new.course_id := old.course_id;
    new.profile_id := old.profile_id;
    new.user_id := old.user_id;
    new.instructor_number := old.instructor_number;
    new.certified_at := old.certified_at;
    new.renewal_due := old.renewal_due;
    new.is_certified := old.is_certified;
    new.is_active := old.is_active;
    new.status := old.status;
    new.memo := old.memo;
  end if;
  return new;
end;
$$;

revoke all on function public.academy_guard_instructor_columns()
  from public, anon, authenticated;

drop policy if exists "instructors delete hq" on public.academy_instructors;
revoke delete on public.academy_instructors from anon, authenticated;

drop policy if exists "instructors insert hq" on public.academy_instructors;
create policy "instructors insert hq"
on public.academy_instructors
for insert
to authenticated
with check (
  private.academy_can_manage_headquarters(headquarters_id)
  and registration_status = 'registered'
  and withdrawn_at is null
);

drop policy if exists "instructors readable" on public.academy_instructors;
create policy "instructors readable"
on public.academy_instructors
for select
to public
using (
  private.academy_can_manage_headquarters(headquarters_id)
  or (
    registration_status = 'registered'
    and (user_id = (select auth.uid()) or is_listed = true)
  )
);

drop policy if exists "instructors update hq or self" on public.academy_instructors;
create policy "instructors update hq or self"
on public.academy_instructors
for update
to authenticated
using (
  private.academy_can_manage_headquarters(headquarters_id)
  or (registration_status = 'registered' and user_id = (select auth.uid()))
)
with check (
  private.academy_can_manage_headquarters(headquarters_id)
  or (registration_status = 'registered' and user_id = (select auth.uid()))
);

create or replace function public.academy_withdraw_instructor(p_instructor_id uuid)
returns public.academy_instructors
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_instructor public.academy_instructors%rowtype;
begin
  if v_actor is null then
    raise exception 'academy_headquarters_forbidden';
  end if;

  select * into v_instructor
  from public.academy_instructors i
  where i.id = p_instructor_id
  for update;

  if v_instructor.id is null
    or not private.academy_can_manage_headquarters(v_instructor.headquarters_id) then
    raise exception 'academy_headquarters_forbidden';
  end if;

  if v_instructor.registration_status = 'withdrawn' then
    return v_instructor;
  end if;

  perform set_config('mikke.academy_registration_transition', 'withdraw', true);

  update public.academy_instructors
  set registration_status = 'withdrawn',
      withdrawn_at = now(),
      withdrawn_by_user_id = v_actor,
      is_active = false,
      is_listed = false,
      accepts_applications = false,
      display_on_story = false,
      updated_at = now()
  where id = p_instructor_id
  returning * into v_instructor;

  update public.academy_class_instructor_requests
  set status = 'cancelled',
      responded_at = coalesce(responded_at, now()),
      updated_at = now()
  where instructor_id = p_instructor_id
    and status = 'requested';

  update public.academy_classes
  set instructor_id = null,
      updated_at = now()
  where instructor_id = p_instructor_id
    and starts_at >= now()
    and status = 'planned';

  return v_instructor;
end;
$$;

revoke all on function public.academy_withdraw_instructor(uuid) from public, anon;
grant execute on function public.academy_withdraw_instructor(uuid) to authenticated;

create or replace function private.academy_class_instructor_request_scope_valid(
  p_headquarters_id uuid,
  p_class_id uuid,
  p_instructor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
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
      and instructor.registration_status = 'registered'
      and instructor.is_active = true
  );
$$;

create or replace function private.academy_class_scope_valid(
  p_headquarters_id uuid,
  p_course_id uuid,
  p_program_id uuid,
  p_instructor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.academy_courses course
      where course.id = p_course_id
        and course.headquarters_id = p_headquarters_id
    )
    and exists (
      select 1
      from public.academy_programs program
      where program.id = p_program_id
        and program.headquarters_id = p_headquarters_id
        and program.course_id = p_course_id
    )
    and (
      p_instructor_id is null
      or exists (
        select 1
        from public.academy_instructors instructor
        where instructor.id = p_instructor_id
          and instructor.headquarters_id = p_headquarters_id
          and instructor.course_id = p_course_id
          and instructor.registration_status = 'registered'
          and instructor.is_active = true
      )
    );
$$;

create or replace function public.academy_is_course_instructor(
  p_course_id uuid,
  p_require_active boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_instructors i
    where i.course_id = p_course_id
      and i.user_id = (select auth.uid())
      and i.registration_status = 'registered'
      and (p_require_active = false or i.is_active = true)
  );
$$;

create or replace function public.academy_is_instructor_self(p_instructor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_instructors i
    where i.id = p_instructor_id
      and i.user_id = (select auth.uid())
      and i.registration_status = 'registered'
      and i.is_active = true
  );
$$;

-- These helpers are internal authorization predicates used by authenticated
-- Academy policies. They are not public RPC endpoints.
revoke all on function public.academy_is_course_instructor(uuid, boolean)
  from public, anon;
revoke all on function public.academy_is_instructor_self(uuid)
  from public, anon;

grant execute on function public.academy_is_course_instructor(uuid, boolean)
  to authenticated;
grant execute on function public.academy_is_instructor_self(uuid)
  to authenticated;
