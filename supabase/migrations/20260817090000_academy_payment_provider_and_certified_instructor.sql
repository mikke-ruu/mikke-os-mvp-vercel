-- Academy payment-provider foundation and certified-instructor promotion.
-- Academy remains unpublished in the mikkeOS app menu. This migration only
-- strengthens the existing Academy routes and data boundary.

alter table public.academy_courses
  add column if not exists payment_provider text not null default 'manual';

alter table public.academy_courses
  drop constraint if exists academy_courses_payment_provider_check,
  add constraint academy_courses_payment_provider_check
    check (payment_provider in ('manual', 'stripe', 'square', 'paycas'));

alter table public.academy_instructors
  add column if not exists payment_provider text not null default 'manual';

alter table public.academy_instructors
  drop constraint if exists academy_instructors_payment_provider_check,
  add constraint academy_instructors_payment_provider_check
    check (payment_provider in ('manual', 'stripe', 'square', 'paycas'));

alter table public.academy_applications
  add column if not exists payment_provider text not null default 'manual',
  add column if not exists provider_checkout_id text,
  add column if not exists provider_payment_id text,
  add column if not exists paid_at timestamptz;

alter table public.academy_applications
  drop constraint if exists academy_applications_payment_provider_check,
  add constraint academy_applications_payment_provider_check
    check (payment_provider in ('manual', 'stripe', 'square', 'paycas'));

create index if not exists academy_applications_provider_checkout_idx
  on public.academy_applications(payment_provider, provider_checkout_id)
  where provider_checkout_id is not null;

create unique index if not exists academy_applications_provider_payment_idx
  on public.academy_applications(payment_provider, provider_payment_id)
  where provider_payment_id is not null;

-- Store the minimum event data needed for idempotency and audit. Provider
-- payloads can contain personal/payment data and are intentionally not stored.
create table if not exists public.academy_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'square')),
  provider_event_id text not null,
  application_id uuid not null references public.academy_applications(id) on delete restrict,
  provider_payment_id text,
  amount numeric(12, 0) not null check (amount >= 0),
  currency text not null default 'JPY' check (currency = upper(currency) and char_length(currency) = 3),
  is_test boolean not null default true,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table public.academy_payment_events enable row level security;
revoke all on table public.academy_payment_events from public, anon, authenticated;
grant select, insert on table public.academy_payment_events to service_role;

-- Replace anonymous direct INSERT with a server-authoritative RPC. The caller
-- supplies contact/form answers only; course, HQ, price, provider and status
-- are resolved from published records inside the database.
drop policy if exists "public can submit applications" on public.academy_applications;

create or replace function public.academy_submit_public_application(
  p_course_id uuid,
  p_instructor_id uuid,
  p_applicant_name text,
  p_applicant_email text,
  p_applicant_phone text,
  p_applicant_note text,
  p_form_answers jsonb,
  p_event_date text,
  p_format text,
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
  v_course public.academy_courses%rowtype;
  v_instructor public.academy_instructors%rowtype;
  v_application_id uuid;
  v_intake_source text;
  v_email text := nullif(lower(trim(coalesce(p_applicant_email, ''))), '');
  v_provider text;
  v_payment_url text;
  v_event_date date;
begin
  select * into v_course
  from public.academy_courses c
  where c.id = p_course_id
    and c.is_published = true;

  if v_course.id is null then
    raise exception 'academy_course_not_accepting_applications';
  end if;

  if p_instructor_id is null then
    if not v_course.accept_at_honbu then
      raise exception 'academy_honbu_intake_closed';
    end if;
    v_intake_source := 'honbu';
    v_provider := v_course.payment_provider;
    v_payment_url := v_course.payment_url;
    if v_email is null then
      raise exception 'academy_applicant_email_required';
    end if;
  else
    select * into v_instructor
    from public.academy_instructors i
    where i.id = p_instructor_id
      and i.course_id = v_course.id
      and i.headquarters_id = v_course.headquarters_id
      and i.is_active = true
      and i.is_listed = true
      and i.accepts_applications = true;

    if v_instructor.id is null or not v_course.accept_at_koushi then
      raise exception 'academy_instructor_intake_closed';
    end if;
    v_intake_source := 'koushi';
    v_provider := v_instructor.payment_provider;
    v_payment_url := v_instructor.payment_url;
  end if;

  if char_length(trim(coalesce(p_applicant_name, ''))) < 1
    or char_length(trim(coalesce(p_applicant_name, ''))) > 200 then
    raise exception 'academy_applicant_name_invalid';
  end if;
  if v_email is not null and (char_length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'academy_applicant_email_invalid';
  end if;
  if char_length(trim(coalesce(p_diploma_name_en, ''))) < 1
    or char_length(trim(coalesce(p_diploma_name_en, ''))) > 200 then
    raise exception 'academy_diploma_name_invalid';
  end if;
  if jsonb_typeof(coalesce(p_form_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'academy_form_answers_invalid';
  end if;
  if p_format is not null and p_format <> '' and p_format not in ('in_person', 'online') then
    raise exception 'academy_format_invalid';
  end if;
  if p_format = 'online' and nullif(trim(coalesce(p_applicant_shipping_address, '')), '') is null then
    raise exception 'academy_shipping_address_required';
  end if;
  if nullif(trim(coalesce(p_event_date, '')), '') is not null then
    begin
      v_event_date := trim(p_event_date)::date;
    exception when others then
      raise exception 'academy_event_date_invalid';
    end;
  end if;

  insert into public.academy_applications (
    headquarters_id,
    course_id,
    user_id,
    intake_source,
    instructor_id,
    applicant_name,
    applicant_email,
    applicant_phone,
    applicant_note,
    form_answers,
    event_date,
    format,
    diploma_name_en,
    applicant_shipping_address,
    price,
    kit_cost,
    honbu_revenue,
    instructor_revenue,
    status,
    payment_status,
    payment_provider,
    certification_status,
    display_on_story,
    reflect_on_desk
  ) values (
    v_course.headquarters_id,
    v_course.id,
    (select auth.uid()),
    v_intake_source,
    p_instructor_id,
    trim(p_applicant_name),
    v_email,
    nullif(trim(coalesce(p_applicant_phone, '')), ''),
    nullif(trim(coalesce(p_applicant_note, '')), ''),
    coalesce(p_form_answers, '{}'::jsonb),
    v_event_date,
    nullif(p_format, ''),
    trim(p_diploma_name_en),
    nullif(trim(coalesce(p_applicant_shipping_address, '')), ''),
    v_course.price,
    0,
    0,
    0,
    'received',
    case when v_course.price = 0 then 'not_required' else 'unpaid' end,
    v_provider,
    'not_yet',
    false,
    false
  ) returning id into v_application_id;

  return query select v_application_id, v_provider, v_payment_url;
end;
$$;

revoke all on function public.academy_submit_public_application(
  uuid, uuid, text, text, text, text, jsonb, text, text, text, text
) from public;
grant execute on function public.academy_submit_public_application(
  uuid, uuid, text, text, text, text, jsonb, text, text, text, text
) to anon, authenticated;

-- Keep applicant self-service limited to community_interest. The existing
-- trigger predates provider fields, so replace it before those fields can be
-- changed by an applicant update.
create or replace function public.guard_academy_application_self_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.academy_can_manage_headquarters(new.headquarters_id)
    or exists (
      select 1
      from public.academy_instructors i
      where i.id = new.instructor_id
        and i.user_id = (select auth.uid())
    ) then
    return new;
  end if;

  new.headquarters_id := old.headquarters_id;
  new.course_id := old.course_id;
  new.user_id := old.user_id;
  new.status := old.status;
  new.payment_status := old.payment_status;
  new.payment_provider := old.payment_provider;
  new.provider_checkout_id := old.provider_checkout_id;
  new.provider_payment_id := old.provider_payment_id;
  new.paid_at := old.paid_at;
  new.certification_status := old.certification_status;
  new.price := old.price;
  new.kit_cost := old.kit_cost;
  new.honbu_revenue := old.honbu_revenue;
  new.instructor_revenue := old.instructor_revenue;
  new.applicant_name := old.applicant_name;
  new.applicant_email := old.applicant_email;
  new.applicant_phone := old.applicant_phone;
  new.applicant_note := old.applicant_note;
  new.instructor_id := old.instructor_id;
  new.intake_source := old.intake_source;
  new.diploma_name_en := old.diploma_name_en;
  new.applicant_shipping_address := old.applicant_shipping_address;
  new.form_answers := old.form_answers;
  new.event_date := old.event_date;
  new.format := old.format;
  new.display_on_story := old.display_on_story;
  new.reflect_on_desk := old.reflect_on_desk;
  return new;
end;
$$;

revoke all on function public.guard_academy_application_self_columns() from public, anon, authenticated;

-- Only a signed-in HQ Owner/Administrator can turn a certified application
-- into an instructor. Number assignment and application status update happen
-- in one transaction.
drop policy if exists "academy_instructors_self_register" on public.academy_instructors;

create or replace function public.academy_promote_certified_application(
  p_application_id uuid,
  p_profile_id uuid
)
returns public.academy_instructors
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.academy_applications%rowtype;
  v_profile public.profiles%rowtype;
  v_headquarters public.academy_headquarters%rowtype;
  v_instructor public.academy_instructors%rowtype;
  v_number text;
begin
  select * into v_application
  from public.academy_applications a
  where a.id = p_application_id
  for update;

  if v_application.id is null then
    raise exception 'academy_application_not_found';
  end if;
  if not private.academy_can_manage_headquarters(v_application.headquarters_id) then
    raise exception 'academy_headquarters_forbidden';
  end if;
  if v_application.certification_status <> 'certified' then
    raise exception 'academy_application_not_certified';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = p_profile_id;
  if v_profile.id is null or v_profile.user_id is null then
    raise exception 'academy_profile_not_available';
  end if;

  select * into v_instructor
  from public.academy_instructors i
  where i.course_id = v_application.course_id
    and i.profile_id = v_profile.id
  limit 1;

  if v_instructor.id is not null then
    update public.academy_applications
    set status = 'instructor_added', updated_at = now()
    where id = v_application.id;
    return v_instructor;
  end if;

  select i.instructor_number into v_number
  from public.academy_instructors i
  where i.headquarters_id = v_application.headquarters_id
    and i.profile_id = v_profile.id
    and i.instructor_number is not null
  order by i.created_at asc
  limit 1;

  select * into v_headquarters
  from public.academy_headquarters h
  where h.id = v_application.headquarters_id
  for update;

  if v_number is null then
    v_number := coalesce(v_headquarters.next_instructor_number, 1)::text;
    update public.academy_headquarters
    set next_instructor_number = coalesce(next_instructor_number, 1) + 1,
        updated_at = now()
    where id = v_headquarters.id;
  end if;

  insert into public.academy_instructors (
    headquarters_id,
    course_id,
    profile_id,
    user_id,
    instructor_number,
    certified_at,
    renewal_due,
    is_certified,
    is_active,
    is_listed,
    accepts_applications
  ) values (
    v_application.headquarters_id,
    v_application.course_id,
    v_profile.id,
    v_profile.user_id,
    v_number,
    current_date,
    case
      when v_headquarters.renewal_period_months is null then null
      else current_date + make_interval(months => v_headquarters.renewal_period_months)
    end,
    true,
    true,
    false,
    false
  ) returning * into v_instructor;

  update public.academy_applications
  set status = 'instructor_added', updated_at = now()
  where id = v_application.id;

  return v_instructor;
end;
$$;

revoke all on function public.academy_promote_certified_application(uuid, uuid) from public, anon;
grant execute on function public.academy_promote_certified_application(uuid, uuid) to authenticated;

-- Called only by signature-validating Stripe/Square webhook functions. This
-- function is provider-neutral, idempotent and refuses amount/provider drift.
create or replace function public.academy_record_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_application_id uuid,
  p_provider_payment_id text,
  p_amount numeric,
  p_currency text,
  p_is_test boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.academy_applications%rowtype;
begin
  if p_provider not in ('stripe', 'square') then
    raise exception 'academy_payment_provider_invalid';
  end if;

  select * into v_application
  from public.academy_applications a
  where a.id = p_application_id
  for update;

  if v_application.id is null then
    raise exception 'academy_application_not_found';
  end if;
  if v_application.payment_provider <> p_provider then
    raise exception 'academy_payment_provider_mismatch';
  end if;
  if upper(coalesce(p_currency, '')) <> 'JPY' or p_amount <> v_application.price then
    raise exception 'academy_payment_amount_mismatch';
  end if;

  insert into public.academy_payment_events (
    provider,
    provider_event_id,
    application_id,
    provider_payment_id,
    amount,
    currency,
    is_test
  ) values (
    p_provider,
    p_provider_event_id,
    v_application.id,
    nullif(trim(coalesce(p_provider_payment_id, '')), ''),
    p_amount,
    upper(p_currency),
    coalesce(p_is_test, true)
  ) on conflict (provider, provider_event_id) do nothing;

  if not found then
    return false;
  end if;

  update public.academy_applications
  set payment_status = 'paid',
      status = case when status in ('received', 'awaiting_payment') then 'paid' else status end,
      provider_payment_id = nullif(trim(coalesce(p_provider_payment_id, '')), ''),
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = v_application.id;

  return true;
end;
$$;

revoke all on function public.academy_record_payment_event(
  text, text, uuid, text, numeric, text, boolean
) from public, anon, authenticated;
grant execute on function public.academy_record_payment_event(
  text, text, uuid, text, numeric, text, boolean
) to service_role;
