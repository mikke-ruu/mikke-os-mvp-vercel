-- Academy learner content access periods.
-- Course settings are defaults for new grants. Each learner grant is an immutable
-- snapshot so later course edits do not shorten access already purchased.

alter table public.academy_courses
  add column if not exists learner_access_mode text not null default 'unlimited',
  add column if not exists learner_access_days integer,
  add column if not exists learner_access_fixed_end_at timestamptz;

alter table public.academy_courses
  drop constraint if exists academy_courses_learner_access_mode_check,
  add constraint academy_courses_learner_access_mode_check check (
    learner_access_mode in (
      'unlimited',
      'days_after_payment',
      'days_after_enrollment',
      'days_after_completion',
      'fixed_end'
    )
  ),
  drop constraint if exists academy_courses_learner_access_settings_check,
  add constraint academy_courses_learner_access_settings_check check (
    (
      learner_access_mode = 'unlimited'
      and learner_access_days is null
      and learner_access_fixed_end_at is null
    )
    or (
      learner_access_mode in ('days_after_payment', 'days_after_enrollment', 'days_after_completion')
      and learner_access_days between 1 and 3650
      and learner_access_fixed_end_at is null
    )
    or (
      learner_access_mode = 'fixed_end'
      and learner_access_days is null
      and learner_access_fixed_end_at is not null
    )
  );

create table if not exists public.academy_course_access_grants (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  course_id uuid not null references public.academy_courses(id) on delete restrict,
  application_id uuid references public.academy_applications(id) on delete restrict,
  learner_user_id uuid not null references auth.users(id) on delete restrict,
  source text not null,
  status text not null default 'active',
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_course_access_grants_source_check check (
    source in ('legacy', 'application', 'payment', 'enrollment', 'completion', 'fixed', 'manual', 'extension')
  ),
  constraint academy_course_access_grants_status_check check (
    status in ('active', 'revoked')
  ),
  constraint academy_course_access_grants_window_check check (
    ends_at is null or ends_at > starts_at
  ),
  constraint academy_course_access_grants_application_source_unique unique (application_id, source)
);

create index if not exists academy_course_access_grants_learner_course_idx
  on public.academy_course_access_grants(learner_user_id, course_id, starts_at desc);
create index if not exists academy_course_access_grants_headquarters_idx
  on public.academy_course_access_grants(headquarters_id, course_id);
create index if not exists academy_course_access_grants_active_window_idx
  on public.academy_course_access_grants(course_id, learner_user_id, starts_at, ends_at)
  where status = 'active';

alter table public.academy_course_access_grants enable row level security;

revoke all on table public.academy_course_access_grants from public, anon, authenticated;
grant select, insert, update on table public.academy_course_access_grants to authenticated;
grant all on table public.academy_course_access_grants to service_role;

create or replace function private.academy_can_manage_learner_access(p_headquarters_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.academy_headquarters_role(p_headquarters_id, (select auth.uid()))
    in ('owner', 'administrator');
$$;

revoke all on function private.academy_can_manage_learner_access(uuid)
  from public, anon, authenticated;
grant execute on function private.academy_can_manage_learner_access(uuid)
  to authenticated;

create policy "academy course access grants learner select"
on public.academy_course_access_grants
for select
to authenticated
using (
  learner_user_id = (select auth.uid())
  or private.academy_can_manage_learner_access(headquarters_id)
);

create policy "academy course access grants manager insert"
on public.academy_course_access_grants
for insert
to authenticated
with check (
  private.academy_can_manage_learner_access(headquarters_id)
  and created_by_user_id = (select auth.uid())
  and exists (
    select 1
    from public.academy_courses course
    where course.id = academy_course_access_grants.course_id
      and course.headquarters_id = academy_course_access_grants.headquarters_id
  )
);

create policy "academy course access grants manager update"
on public.academy_course_access_grants
for update
to authenticated
using (private.academy_can_manage_learner_access(headquarters_id))
with check (private.academy_can_manage_learner_access(headquarters_id));

create or replace function private.academy_guard_course_access_grant_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.headquarters_id is distinct from old.headquarters_id
    or new.course_id is distinct from old.course_id
    or new.application_id is distinct from old.application_id
    or new.learner_user_id is distinct from old.learner_user_id
    or new.source is distinct from old.source
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'academy_course_access_grant_window_is_immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.academy_guard_course_access_grant_update()
  from public, anon, authenticated;

drop trigger if exists academy_guard_course_access_grant_update
  on public.academy_course_access_grants;
create trigger academy_guard_course_access_grant_update
before update on public.academy_course_access_grants
for each row execute function private.academy_guard_course_access_grant_update();

create or replace function private.academy_has_course_content_access(
  p_course_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid()) and exists (
    select 1
    from public.academy_course_access_grants access_grant
    where access_grant.course_id = p_course_id
      and access_grant.learner_user_id = p_user_id
      and access_grant.status = 'active'
      and access_grant.starts_at <= now()
      and (access_grant.ends_at is null or access_grant.ends_at > now())
  );
$$;

revoke all on function private.academy_has_course_content_access(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.academy_has_course_content_access(uuid, uuid)
  to authenticated;

create or replace function private.academy_insert_automatic_course_access_grant(
  p_headquarters_id uuid,
  p_course_id uuid,
  p_application_id uuid,
  p_learner_user_id uuid,
  p_source text,
  p_starts_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
  v_days integer;
  v_fixed_end timestamptz;
  v_ends_at timestamptz;
begin
  if p_application_id is null or p_learner_user_id is null or p_starts_at is null then
    return;
  end if;

  select course.learner_access_mode, course.learner_access_days, course.learner_access_fixed_end_at
  into v_mode, v_days, v_fixed_end
  from public.academy_courses course
  where course.id = p_course_id
    and course.headquarters_id = p_headquarters_id;

  if not found then
    return;
  end if;

  if v_mode = 'unlimited' and p_source = 'application' then
    v_ends_at := null;
  elsif v_mode = 'days_after_payment' and p_source = 'payment' then
    v_ends_at := p_starts_at + (v_days * interval '1 day');
  elsif v_mode = 'days_after_enrollment' and p_source = 'enrollment' then
    v_ends_at := p_starts_at + (v_days * interval '1 day');
  elsif v_mode = 'days_after_completion' and p_source = 'completion' then
    v_ends_at := p_starts_at + (v_days * interval '1 day');
  elsif v_mode = 'fixed_end' and p_source = 'fixed' then
    v_ends_at := v_fixed_end;
  else
    return;
  end if;

  if v_ends_at is not null and v_ends_at <= p_starts_at then
    return;
  end if;

  insert into public.academy_course_access_grants (
    headquarters_id,
    course_id,
    application_id,
    learner_user_id,
    source,
    starts_at,
    ends_at,
    created_by_user_id
  ) values (
    p_headquarters_id,
    p_course_id,
    p_application_id,
    p_learner_user_id,
    p_source,
    p_starts_at,
    v_ends_at,
    null
  )
  on conflict (application_id, source) do nothing;
end;
$$;

revoke all on function private.academy_insert_automatic_course_access_grant(uuid, uuid, uuid, uuid, text, timestamptz)
  from public, anon, authenticated;

create or replace function private.academy_sync_application_course_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null
    or new.status not in (
      'paid', 'kit_pending', 'kit_preparing', 'kit_shipped', 'scheduled',
      'completed', 'cert_pending', 'certified', 'instructor_added'
    ) then
    return new;
  end if;

  perform private.academy_insert_automatic_course_access_grant(
    new.headquarters_id,
    new.course_id,
    new.id,
    new.user_id,
    'application',
    coalesce(new.paid_at, new.created_at)
  );

  if new.paid_at is not null then
    perform private.academy_insert_automatic_course_access_grant(
      new.headquarters_id,
      new.course_id,
      new.id,
      new.user_id,
      'payment',
      new.paid_at
    );
  end if;

  perform private.academy_insert_automatic_course_access_grant(
    new.headquarters_id,
    new.course_id,
    new.id,
    new.user_id,
    'fixed',
    coalesce(new.paid_at, new.created_at)
  );

  return new;
end;
$$;

revoke all on function private.academy_sync_application_course_access()
  from public, anon, authenticated;

drop trigger if exists academy_sync_application_course_access
  on public.academy_applications;
create trigger academy_sync_application_course_access
after insert or update of status, paid_at, user_id
on public.academy_applications
for each row execute function private.academy_sync_application_course_access();

create or replace function private.academy_sync_enrollment_course_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.academy_applications%rowtype;
  v_learner_user_id uuid;
begin
  if new.application_id is null then
    return new;
  end if;

  select application.*
  into v_application
  from public.academy_applications application
  where application.id = new.application_id;

  if not found then
    return new;
  end if;

  select coalesce(v_application.user_id, profile.user_id)
  into v_learner_user_id
  from public.profiles profile
  where profile.id = new.learner_profile_id;

  perform private.academy_insert_automatic_course_access_grant(
    v_application.headquarters_id,
    v_application.course_id,
    v_application.id,
    v_learner_user_id,
    'enrollment',
    new.enrolled_at
  );

  if new.completed_at is not null then
    perform private.academy_insert_automatic_course_access_grant(
      v_application.headquarters_id,
      v_application.course_id,
      v_application.id,
      v_learner_user_id,
      'completion',
      new.completed_at
    );
  end if;

  return new;
end;
$$;

revoke all on function private.academy_sync_enrollment_course_access()
  from public, anon, authenticated;

drop trigger if exists academy_sync_enrollment_course_access
  on public.academy_enrollments;
create trigger academy_sync_enrollment_course_access
after insert or update of status, enrolled_at, completed_at, learner_profile_id, application_id
on public.academy_enrollments
for each row execute function private.academy_sync_enrollment_course_access();

-- Existing learners retain the access promised before timed access existed.
insert into public.academy_course_access_grants (
  headquarters_id,
  course_id,
  application_id,
  learner_user_id,
  source,
  starts_at,
  ends_at,
  created_by_user_id
)
select
  application.headquarters_id,
  application.course_id,
  application.id,
  application.user_id,
  'legacy',
  coalesce(application.paid_at, application.created_at),
  null,
  null
from public.academy_applications application
where application.user_id is not null
  and application.status in (
    'paid', 'kit_pending', 'kit_preparing', 'kit_shipped', 'scheduled',
    'completed', 'cert_pending', 'certified', 'instructor_added'
  )
on conflict (application_id, source) do nothing;

-- The learner keeps course/application history after expiry, but learner content
-- requires a currently active course access grant.
drop policy if exists "academy_learner_pages_learner_select"
  on public.academy_learner_pages;
create policy "academy_learner_pages_learner_select"
on public.academy_learner_pages
for select
to authenticated
using (
  is_published = true
  and private.academy_has_course_content_access(course_id, (select auth.uid()))
);

-- Program/step RLS already calls this helper. Add the course access window while
-- preserving subscription-product programs that are not attached to a course.
create or replace function private.academy_profile_has_program_access(
  p_profile_id uuid,
  p_program_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = p_profile_id
      and profile.user_id = (select auth.uid())
  )
  and (
    not exists (
      select 1
      from public.academy_programs program
      where program.id = p_program_id
        and program.course_id is not null
    )
    or exists (
      select 1
      from public.academy_programs program
      join public.profiles profile on profile.id = p_profile_id
      where program.id = p_program_id
        and private.academy_has_course_content_access(program.course_id, profile.user_id)
    )
  )
  and (
    not exists (
      select 1
      from public.academy_subscription_product_programs mapping
      where mapping.program_id = p_program_id
    )
    or exists (
      select 1
      from public.academy_entitlement_grants entitlement
      where entitlement.member_profile_id = p_profile_id
        and entitlement.program_id = p_program_id
        and entitlement.status = 'active'
        and (entitlement.ends_at is null or entitlement.ends_at > now())
    )
    or exists (
      select 1
      from public.academy_program_assignments assignment
      where assignment.learner_profile_id = p_profile_id
        and assignment.program_id = p_program_id
        and assignment.status = 'active'
        and private.academy_active_program_license_exists(
          assignment.program_id,
          assignment.headquarters_id,
          assignment.program_version_id
        )
    )
  );
$$;

revoke all on function private.academy_profile_has_program_access(uuid, uuid)
  from public, anon, authenticated;
