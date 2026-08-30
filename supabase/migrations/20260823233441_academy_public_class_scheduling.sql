-- Publish only safe Academy class schedule fields and bind an application to
-- the selected class without exposing meeting URLs or private HQ data.

alter table public.academy_applications
  add column if not exists class_id uuid
    references public.academy_classes(id) on delete set null;

create index if not exists academy_applications_class_id_idx
  on public.academy_applications(class_id)
  where class_id is not null;

create or replace function public.academy_list_public_classes(
  p_course_id uuid,
  p_instructor_id uuid default null
)
returns table (
  id uuid,
  course_id uuid,
  instructor_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  remaining_capacity integer,
  venue_name text,
  schedule_mode text,
  format text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    class_record.id,
    class_record.course_id,
    class_record.instructor_id,
    class_record.title,
    class_record.starts_at,
    class_record.ends_at,
    class_record.capacity,
    case
      when class_record.capacity is null then null
      else greatest(
        class_record.capacity - count(application.id)::integer,
        0
      )
    end as remaining_capacity,
    class_record.venue_name,
    class_record.schedule_mode,
    class_record.format
  from public.academy_classes class_record
  join public.academy_courses course
    on course.id = class_record.course_id
   and course.headquarters_id = class_record.headquarters_id
   and course.is_published = true
  join public.academy_headquarters headquarters
    on headquarters.id = class_record.headquarters_id
   and headquarters.is_active = true
  left join public.academy_applications application
    on application.class_id = class_record.id
   and application.status not in ('cancelled', 'closed')
  where class_record.course_id = p_course_id
    and class_record.registration_status = 'open'
    and class_record.status in ('planned', 'active')
    and (
      class_record.schedule_mode = 'arranged_after_application'
      or class_record.starts_at >= now()
    )
    and (
      p_instructor_id is null
      or (
        class_record.instructor_id = p_instructor_id
        and exists (
          select 1
          from public.academy_instructors instructor
          where instructor.id = p_instructor_id
            and instructor.course_id = class_record.course_id
            and instructor.headquarters_id = class_record.headquarters_id
            and instructor.registration_status = 'registered'
            and instructor.is_certified = true
            and instructor.is_active = true
            and instructor.is_listed = true
            and instructor.accepts_applications = true
        )
      )
    )
  group by class_record.id
  having class_record.capacity is null
    or count(application.id) < class_record.capacity
  order by
    case when class_record.schedule_mode = 'fixed' then 0 else 1 end,
    class_record.starts_at asc,
    class_record.created_at asc;
$$;

revoke all on function public.academy_list_public_classes(uuid, uuid) from public;
grant execute on function public.academy_list_public_classes(uuid, uuid)
  to anon, authenticated, service_role;

create or replace function public.academy_submit_public_class_application(
  p_course_id uuid,
  p_class_id uuid,
  p_instructor_id uuid,
  p_applicant_name text,
  p_applicant_email text,
  p_applicant_phone text,
  p_applicant_note text,
  p_form_answers jsonb,
  p_diploma_name_en text,
  p_applicant_shipping_address text
)
returns table (
  application_id uuid,
  payment_provider text,
  payment_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.academy_classes%rowtype;
  v_application_id uuid;
  v_payment_provider text;
  v_payment_url text;
  v_reserved_count integer;
begin
  select * into v_class
  from public.academy_classes class_record
  where class_record.id = p_class_id
  for update;

  if v_class.id is null
    or v_class.course_id <> p_course_id
    or v_class.registration_status <> 'open'
    or v_class.status not in ('planned', 'active')
    or (v_class.schedule_mode = 'fixed' and v_class.starts_at < now()) then
    raise exception 'academy_class_not_accepting_applications';
  end if;

  if p_instructor_id is not null and v_class.instructor_id is distinct from p_instructor_id then
    raise exception 'academy_class_instructor_mismatch';
  end if;

  if v_class.capacity is not null then
    select count(*)::integer into v_reserved_count
    from public.academy_applications application
    where application.class_id = v_class.id
      and application.status not in ('cancelled', 'closed');

    if v_reserved_count >= v_class.capacity then
      raise exception 'academy_class_capacity_reached';
    end if;
  end if;

  select submitted.application_id, submitted.payment_provider, submitted.payment_url
  into v_application_id, v_payment_provider, v_payment_url
  from public.academy_submit_public_application(
    p_course_id,
    p_instructor_id,
    p_applicant_name,
    p_applicant_email,
    p_applicant_phone,
    p_applicant_note,
    p_form_answers,
    case
      when v_class.schedule_mode = 'fixed' then v_class.starts_at::date::text
      else ''
    end,
    v_class.format,
    p_diploma_name_en,
    p_applicant_shipping_address
  ) submitted;

  update public.academy_applications
  set class_id = v_class.id,
      updated_at = now()
  where id = v_application_id;

  return query
  select v_application_id, v_payment_provider, v_payment_url;
end;
$$;

revoke all on function public.academy_submit_public_class_application(
  uuid, uuid, uuid, text, text, text, text, jsonb, text, text
) from public;
grant execute on function public.academy_submit_public_class_application(
  uuid, uuid, uuid, text, text, text, text, jsonb, text, text
) to anon, authenticated, service_role;
