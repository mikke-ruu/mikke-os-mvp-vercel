-- Attach a public Academy application to the signed-in person only when the
-- person's verified Supabase email matches the application email. Public
-- applications may be created before the applicant has a mikke account, so
-- the application history stays intact and is claimed later.

create or replace function private.academy_guard_application_user_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verified_email text;
begin
  if new.user_id is null then
    return new;
  end if;

  select lower(trim(user_account.email))
  into v_verified_email
  from auth.users user_account
  where user_account.id = new.user_id
    and user_account.email_confirmed_at is not null;

  if v_verified_email is null
    or v_verified_email <> lower(trim(coalesce(new.applicant_email, ''))) then
    new.user_id := null;
  end if;

  return new;
end;
$$;

revoke all on function private.academy_guard_application_user_link()
  from public, anon, authenticated;

drop trigger if exists academy_guard_application_user_link
  on public.academy_applications;
create trigger academy_guard_application_user_link
before insert on public.academy_applications
for each row execute function private.academy_guard_application_user_link();

-- This is the current production guard with one narrow addition: an unclaimed
-- row may receive auth.uid() when that user's verified email matches the
-- immutable applicant email. Every other applicant-editable column keeps the
-- existing restrictions.
create or replace function public.guard_academy_application_self_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Provider webhook functions run with the service-role JWT and must be able
  -- to record server-validated payment fields. This bypass is limited to the
  -- trusted service role; browser-authenticated applicants still enter the
  -- narrow self-claim branch below.
  if (select auth.role()) = 'service_role' then
    return new;
  end if;

  if private.academy_can_manage_headquarters(new.headquarters_id)
    or exists (
      select 1
      from public.academy_instructors i
      where i.id = new.instructor_id
        and i.user_id = (select auth.uid())
    ) then
    return new;
  end if;

  if old.user_id is null
    and new.user_id = (select auth.uid())
    and exists (
      select 1
      from auth.users user_account
      where user_account.id = (select auth.uid())
        and user_account.email_confirmed_at is not null
        and lower(trim(user_account.email)) = lower(trim(coalesce(old.applicant_email, '')))
    ) then
    new.headquarters_id := old.headquarters_id;
    new.course_id := old.course_id;
    new.status := old.status;
    new.payment_status := old.payment_status;
    new.payment_provider := old.payment_provider;
    new.provider_checkout_id := old.provider_checkout_id;
    new.provider_checkout_url := old.provider_checkout_url;
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
  end if;

  new.headquarters_id := old.headquarters_id;
  new.course_id := old.course_id;
  new.user_id := old.user_id;
  new.status := old.status;
  new.payment_status := old.payment_status;
  new.payment_provider := old.payment_provider;
  new.provider_checkout_id := old.provider_checkout_id;
  new.provider_checkout_url := old.provider_checkout_url;
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

revoke all on function public.guard_academy_application_self_columns()
  from public, anon, authenticated;

create or replace function public.academy_claim_my_application(p_application_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_verified_email text;
  v_claimed_id uuid;
begin
  if v_user_id is null then
    raise exception 'academy_authentication_required';
  end if;

  select lower(trim(user_account.email))
  into v_verified_email
  from auth.users user_account
  where user_account.id = v_user_id
    and user_account.email_confirmed_at is not null;

  if v_verified_email is null then
    raise exception 'academy_verified_email_required';
  end if;

  update public.academy_applications application
  set user_id = v_user_id
  where application.id = p_application_id
    and application.user_id is null
    and lower(trim(coalesce(application.applicant_email, ''))) = v_verified_email
  returning application.id into v_claimed_id;

  if v_claimed_id is not null then
    return true;
  end if;

  if exists (
    select 1
    from public.academy_applications application
    where application.id = p_application_id
      and application.user_id = v_user_id
      and lower(trim(coalesce(application.applicant_email, ''))) = v_verified_email
  ) then
    return true;
  end if;

  raise exception 'academy_application_claim_not_available';
end;
$$;

revoke all on function public.academy_claim_my_application(uuid)
  from public, anon;
grant execute on function public.academy_claim_my_application(uuid)
  to authenticated;
