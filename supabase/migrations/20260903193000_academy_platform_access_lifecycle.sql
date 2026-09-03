-- Academy paid lifecycle follows the common platform-billing projection.
-- Depends on:
--   platform_billing_private.resource_access_window(text,uuid,timestamptz)

create table private.academy_retention_anonymization_runs (
  headquarters_id uuid primary key,
  ended_at timestamptz not null,
  anonymize_after timestamptz not null,
  executed_at timestamptz not null default statement_timestamp(),
  affected_rows jsonb not null check (jsonb_typeof(affected_rows) = 'object')
);

revoke all on table private.academy_retention_anonymization_runs
  from public, anon, authenticated, service_role;

create or replace function private.academy_guard_retention_run_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'academy_retention_run_is_immutable';
  end if;
  if new.anonymize_after <> new.ended_at + interval '90 days'
    or new.executed_at < new.anonymize_after then
    raise exception 'academy_retention_run_invalid_window';
  end if;
  return new;
end;
$$;

revoke all on function private.academy_guard_retention_run_immutable()
  from public, anon, authenticated, service_role;

create trigger academy_guard_retention_run_immutable
before insert or update or delete on private.academy_retention_anonymization_runs
for each row execute function private.academy_guard_retention_run_immutable();

create or replace function private.academy_paid_access_window(
  p_headquarters_id uuid,
  p_at timestamptz
)
returns table (
  actor_user_id uuid,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  write_allowed boolean,
  owner_read_until timestamptz,
  anonymize_after timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select access_window.actor_user_id,
         access_window.status,
         access_window.current_period_start,
         access_window.current_period_end,
         access_window.write_allowed,
         access_window.owner_read_until,
         access_window.anonymize_after
  from public.academy_headquarters headquarters
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
   and access.access_kind = 'paid'
   and access.status = 'active'
  cross join lateral platform_billing_private.resource_access_window(
    'academy_platform', headquarters.id, p_at
  ) access_window
  where headquarters.id = p_headquarters_id
    and access_window.actor_user_id = headquarters.owner_user_id;
$$;

revoke all on function private.academy_paid_access_window(uuid,timestamptz)
  from public, anon, authenticated, service_role;

create or replace function private.academy_headquarters_access_mode(p_headquarters_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_access public.academy_headquarters_access_states%rowtype;
  v_write_allowed boolean := false;
  v_window_count integer := 0;
begin
  select access.* into v_access
  from public.academy_headquarters headquarters
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
  where headquarters.id = p_headquarters_id;

  if v_access.headquarters_id is null then return 'blocked'; end if;
  if v_access.access_kind = 'trial' then
    if v_access.status = 'trialing' and statement_timestamp() < v_access.trial_ends_at then
      return 'trial_active';
    end if;
    return 'trial_expired';
  end if;
  if v_access.access_kind <> 'paid' or v_access.status <> 'active' then return 'blocked'; end if;

  -- This transaction-local flag is set only inside the service-only retention
  -- worker so its bounded anonymization updates can pass the ordinary guards.
  if current_setting('app.academy_retention_worker', true) = 'on'
    and current_setting('role', true) = 'service_role'
    and current_setting('app.academy_retention_headquarters', true) = p_headquarters_id::text then
    return 'paid';
  end if;

  select count(*), coalesce(bool_and(access_window.write_allowed), false)
  into v_window_count, v_write_allowed
  from private.academy_paid_access_window(p_headquarters_id, statement_timestamp()) access_window;

  if v_window_count = 1 and v_write_allowed then return 'paid'; end if;
  return 'paid_readonly';
end;
$$;

revoke all on function private.academy_headquarters_access_mode(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.academy_owner_read_allowed(
  p_headquarters_id uuid,
  p_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_status text;
  v_owner_read_until timestamptz;
  v_count integer;
begin
  select access.access_kind into v_kind
  from public.academy_headquarters headquarters
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
  where headquarters.id = p_headquarters_id;

  if v_kind = 'trial' then return true; end if;
  if v_kind is distinct from 'paid' then return false; end if;

  select count(*), min(access_window.status), min(access_window.owner_read_until)
  into v_count, v_status, v_owner_read_until
  from private.academy_paid_access_window(p_headquarters_id, p_at) access_window;

  if v_count <> 1 then return false; end if;
  if v_status in ('active', 'past_due') then return true; end if;
  return v_status = 'ended' and p_at < v_owner_read_until;
end;
$$;

revoke all on function private.academy_owner_read_allowed(uuid,timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.academy_owns_hq(p_hq_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.academy_headquarters headquarters
      where headquarters.id = p_hq_id
        and headquarters.owner_user_id = (select auth.uid())
        and private.academy_owner_read_allowed(headquarters.id, statement_timestamp())
    );
$$;

revoke all on function public.academy_owns_hq(uuid) from public, anon, authenticated;
grant execute on function public.academy_owns_hq(uuid) to anon, authenticated;

create or replace function private.academy_headquarters_role(
  p_headquarters_id uuid,
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.academy_headquarters headquarters
      where headquarters.id = p_headquarters_id
        and headquarters.owner_user_id = p_user_id
        and private.academy_owner_read_allowed(headquarters.id, statement_timestamp())
    ) then 'owner'
    when private.academy_headquarters_access_mode(p_headquarters_id) in ('paid', 'trial_active') then (
      select member.role
      from public.academy_headquarters_members member
      join public.profiles profile on profile.id = member.member_profile_id
      where member.headquarters_id = p_headquarters_id
        and profile.user_id = p_user_id
        and member.status = 'active'
      limit 1
    )
    else null
  end;
$$;

revoke all on function private.academy_headquarters_role(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.academy_headquarters_role(uuid,uuid) to authenticated;

create or replace function public.academy_is_publicly_available(p_headquarters_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_headquarters headquarters
    where headquarters.id = p_headquarters_id
      and headquarters.is_active = true
      and private.academy_headquarters_access_mode(headquarters.id) = 'paid'
  );
$$;

revoke all on function public.academy_is_publicly_available(uuid)
  from public, anon, authenticated;
grant execute on function public.academy_is_publicly_available(uuid) to anon, authenticated;

drop policy if exists "courses readable" on public.academy_courses;
create policy "courses readable"
on public.academy_courses for select to public
using (
  (is_published = true and public.academy_is_publicly_available(headquarters_id))
  or public.academy_owns_hq(headquarters_id)
  or public.academy_is_course_instructor(id)
);

-- Existing collaboration triggers keep their identity rules. The exact
-- transaction-local worker scope only bypasses actor-based publish checks.
create or replace function private.academy_guard_course_collaboration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text := private.academy_headquarters_role(old.headquarters_id, (select auth.uid()));
  v_retention boolean := current_setting('app.academy_retention_worker', true) = 'on'
    and current_setting('role', true) = 'service_role'
    and current_setting('app.academy_retention_headquarters', true) = old.headquarters_id::text;
begin
  if new.headquarters_id is distinct from old.headquarters_id
    or new.user_id is distinct from old.user_id then
    raise exception 'academy_course_identity_is_immutable';
  end if;
  if new.is_published is distinct from old.is_published and v_role <> 'owner' and not v_retention then
    raise exception 'academy_course_publish_owner_required';
  end if;
  return new;
end;
$$;

create or replace function private.academy_guard_material_collaboration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text := private.academy_headquarters_role(old.headquarters_id, (select auth.uid()));
  v_retention boolean := current_setting('app.academy_retention_worker', true) = 'on'
    and current_setting('role', true) = 'service_role'
    and current_setting('app.academy_retention_headquarters', true) = old.headquarters_id::text;
begin
  if new.headquarters_id is distinct from old.headquarters_id
    or new.course_id is distinct from old.course_id
    or new.user_id is distinct from old.user_id then
    raise exception 'academy_material_identity_is_immutable';
  end if;
  if new.is_published is distinct from old.is_published and v_role <> 'owner' and not v_retention then
    raise exception 'academy_material_publish_owner_required';
  end if;
  return new;
end;
$$;

create or replace function private.academy_guard_learner_page_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retention boolean := current_setting('app.academy_retention_worker', true) = 'on'
    and current_setting('role', true) = 'service_role'
    and current_setting('app.academy_retention_headquarters', true) = old.headquarters_id::text;
begin
  if new.headquarters_id is distinct from old.headquarters_id
    or new.course_id is distinct from old.course_id
    or new.user_id is distinct from old.user_id then
    raise exception 'academy_learner_page_scope_is_immutable';
  end if;
  if new.is_published is distinct from old.is_published
    and private.academy_headquarters_role(new.headquarters_id, (select auth.uid())) <> 'owner'
    and not v_retention then
    raise exception 'academy_learner_page_publish_owner_required';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function public.academy_guard_instructor_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retention boolean := current_setting('app.academy_retention_worker', true) = 'on'
    and current_setting('role', true) = 'service_role'
    and current_setting('app.academy_retention_headquarters', true) = old.headquarters_id::text;
begin
  if not private.academy_can_manage_headquarters(new.headquarters_id) and not v_retention then
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

revoke all on function private.academy_guard_course_collaboration() from public,anon,authenticated,service_role;
revoke all on function private.academy_guard_material_collaboration() from public,anon,authenticated,service_role;
revoke all on function private.academy_guard_learner_page_update() from public,anon,authenticated,service_role;
revoke all on function public.academy_guard_instructor_columns() from public,anon,authenticated,service_role;

create or replace function public.academy_get_my_headquarters_access(p_headquarters_id uuid)
returns table (
  headquarters_id uuid,
  access_kind text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  days_remaining integer,
  can_manage_drafts boolean,
  can_use_live_features boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select headquarters.id,
         access.access_kind,
         case
           when access.access_kind = 'trial' and access.status = 'trialing'
             and statement_timestamp() >= access.trial_ends_at then 'expired'
           when access.access_kind = 'paid' then coalesce(access_window.status, 'unavailable')
           else access.status
         end,
         access.starts_at,
         case when access.access_kind = 'paid' then access_window.current_period_end
              else access.trial_ends_at end,
         case when access.access_kind = 'trial' and access.status = 'trialing'
                   and statement_timestamp() < access.trial_ends_at
              then greatest(1, ceil(extract(epoch from (access.trial_ends_at - statement_timestamp())) / 86400.0)::integer)
              else 0 end,
         private.academy_headquarters_access_mode(headquarters.id) in ('paid', 'trial_active'),
         private.academy_headquarters_access_mode(headquarters.id) = 'paid'
  from public.academy_headquarters headquarters
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
  left join lateral private.academy_paid_access_window(headquarters.id, statement_timestamp()) access_window
    on access.access_kind = 'paid'
  where headquarters.id = p_headquarters_id
    and private.academy_headquarters_role(headquarters.id, (select auth.uid())) is not null;
$$;

revoke all on function public.academy_get_my_headquarters_access(uuid) from public, anon;
grant execute on function public.academy_get_my_headquarters_access(uuid) to authenticated;

create or replace function public.academy_export_my_headquarters(p_headquarters_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_actor is null or coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'academy_export_authentication_required';
  end if;
  if not exists (
    select 1 from public.academy_headquarters headquarters
    where headquarters.id = p_headquarters_id and headquarters.owner_user_id = v_actor
  ) or not private.academy_owner_read_allowed(p_headquarters_id, statement_timestamp()) then
    raise exception 'academy_export_unavailable';
  end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', statement_timestamp(),
    'headquarters', to_jsonb(headquarters) - array['id','owner_user_id','owner_profile_id'],
    'courses', coalesce((select jsonb_agg(to_jsonb(course) - array['id','headquarters_id','user_id'] order by course.created_at)
      from public.academy_courses course where course.headquarters_id = headquarters.id), '[]'::jsonb),
    'classes', coalesce((select jsonb_agg((to_jsonb(class_row) - array['id','headquarters_id','course_id','program_id','instructor_id','created_by_user_id','program_version_id'])
      || jsonb_build_object('courseCode', course.code) order by class_row.created_at)
      from public.academy_classes class_row join public.academy_courses course on course.id = class_row.course_id
      where class_row.headquarters_id = headquarters.id), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg((to_jsonb(application) - array['id','headquarters_id','course_id','user_id','instructor_id','class_id','provider_checkout_id','provider_checkout_url','provider_payment_id'])
      || jsonb_build_object('courseCode', course.code) order by application.created_at)
      from public.academy_applications application join public.academy_courses course on course.id = application.course_id
      where application.headquarters_id = headquarters.id), '[]'::jsonb),
    'instructors', coalesce((select jsonb_agg((to_jsonb(instructor) - array['id','headquarters_id','course_id','profile_id','user_id','withdrawn_by_user_id'])
      || jsonb_build_object('courseCode', course.code) order by instructor.created_at)
      from public.academy_instructors instructor join public.academy_courses course on course.id = instructor.course_id
      where instructor.headquarters_id = headquarters.id), '[]'::jsonb),
    'credentials', coalesce((select jsonb_agg(to_jsonb(credential) - array['id','headquarters_id'] order by credential.created_at)
      from public.academy_credentials credential where credential.headquarters_id = headquarters.id), '[]'::jsonb)
  ) into v_result
  from public.academy_headquarters headquarters
  where headquarters.id = p_headquarters_id;
  return v_result;
end;
$$;

revoke all on function public.academy_export_my_headquarters(uuid) from public, anon;
grant execute on function public.academy_export_my_headquarters(uuid) to authenticated;

create or replace function private.academy_anonymize_ended_headquarters_at(
  p_headquarters_id uuid,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window record;
  v_subscription_id uuid;
  v_source_attempt_id uuid;
  v_subscription_actor uuid;
  v_entitlement_id uuid;
  v_owner uuid;
  v_counts jsonb := '{}'::jsonb;
  v_count integer;
begin
  -- Lock the authoritative common subscription before its consumed creation
  -- entitlement. Subscription event application also locks this row, while the
  -- paid activation verifiers use the same subscription -> entitlement order.
  -- Holding both locks through the final window recheck prevents anonymization
  -- from racing a renewal/reactivation into an active state.
  select subscription.id, subscription.source_attempt_id, subscription.actor_user_id
  into strict v_subscription_id, v_source_attempt_id, v_subscription_actor
  from platform_billing_private.subscriptions subscription
  join platform_billing_private.creation_entitlements entitlement
    on entitlement.source_attempt_id = subscription.source_attempt_id
   and entitlement.actor_user_id = subscription.actor_user_id
   and entitlement.product_key = subscription.product_key
   and entitlement.plan_key = subscription.plan_key
  where subscription.product_key = 'academy_platform'
    and entitlement.source_kind = 'verified_paid'
    and entitlement.status = 'consumed'
    and entitlement.resource_id = p_headquarters_id
  for update of subscription;

  select entitlement.id into strict v_entitlement_id
  from platform_billing_private.creation_entitlements entitlement
  where entitlement.source_attempt_id = v_source_attempt_id
    and entitlement.actor_user_id = v_subscription_actor
    and entitlement.product_key = 'academy_platform'
    and entitlement.source_kind = 'verified_paid'
    and entitlement.status = 'consumed'
    and entitlement.resource_id = p_headquarters_id
  for update;

  select access_window.* into strict v_window
  from private.academy_paid_access_window(p_headquarters_id, p_at) access_window;
  if v_window.status <> 'ended' or v_window.anonymize_after is null
    or p_at < v_window.anonymize_after
    or v_window.owner_read_until is distinct from v_window.anonymize_after then
    raise exception 'academy_anonymization_not_due';
  end if;

  select headquarters.owner_user_id into strict v_owner
  from public.academy_headquarters headquarters
  where headquarters.id = p_headquarters_id
  for update;
  if v_owner is distinct from v_window.actor_user_id then
    raise exception 'academy_anonymization_owner_mismatch';
  end if;
  if exists (select 1 from private.academy_retention_anonymization_runs run where run.headquarters_id = p_headquarters_id) then
    return jsonb_build_object('status','already_anonymized');
  end if;

  perform set_config('app.academy_retention_worker', 'on', true);
  perform set_config('app.academy_retention_headquarters', p_headquarters_id::text, true);

  update public.academy_headquarters set is_active=false, contact_email=null,
    default_payment_note=null, logo_url=null, hero_image_url=null, front_message=null,
    updated_at=p_at where id=p_headquarters_id;
  get diagnostics v_count = row_count; v_counts := v_counts || jsonb_build_object('headquarters',v_count);

  update public.academy_courses set is_published=false, payment_url=null,
    kit_payment_url=null, main_image_url=null, updated_at=p_at where headquarters_id=p_headquarters_id;
  get diagnostics v_count = row_count; v_counts := v_counts || jsonb_build_object('courses',v_count);

  update public.academy_learner_pages set is_published=false, updated_at=p_at
    where headquarters_id=p_headquarters_id;
  get diagnostics v_count = row_count; v_counts := v_counts || jsonb_build_object('learnerPages',v_count);

  update public.academy_materials set is_published=false, url='about:blank#retained-record',
    updated_at=p_at where headquarters_id=p_headquarters_id;
  get diagnostics v_count = row_count; v_counts := v_counts || jsonb_build_object('materials',v_count);

  update public.academy_classes set meeting_url=null, updated_at=p_at
    where headquarters_id=p_headquarters_id;
  get diagnostics v_count = row_count; v_counts := v_counts || jsonb_build_object('classes',v_count);

  update public.academy_billing_accounts set payment_url=null, is_active=false, updated_at=p_at
    where headquarters_id=p_headquarters_id;
  get diagnostics v_count = row_count; v_counts := v_counts || jsonb_build_object('billingAccounts',v_count);

  update public.academy_applications set applicant_name='匿名化済み', applicant_email=null,
    applicant_phone=null, applicant_note=null, form_answers='{}'::jsonb,
    diploma_name_en=null, applicant_shipping_address=null, provider_checkout_id=null,
    provider_checkout_url=null, provider_payment_id=null, updated_at=p_at
    where headquarters_id=p_headquarters_id;
  get diagnostics v_count = row_count; v_counts := v_counts || jsonb_build_object('applications',v_count);

  update public.academy_instructors set memo=null, business_name=null, area=null,
    instagram_url=null, self_intro=null, message=null, available_note=null,
    photo_url=null, payment_method_note=null, payment_url=null,
    accepts_applications=false, is_listed=false, display_on_story=false, updated_at=p_at
    where headquarters_id=p_headquarters_id;
  get diagnostics v_count = row_count; v_counts := v_counts || jsonb_build_object('instructors',v_count);

  update public.academy_instructor_addresses address
  set address_text='匿名化済み'
  from public.academy_instructors instructor
  where address.instructor_id=instructor.id and instructor.headquarters_id=p_headquarters_id;
  get diagnostics v_count = row_count; v_counts := v_counts || jsonb_build_object('instructorAddresses',v_count);

  insert into private.academy_retention_anonymization_runs(
    headquarters_id, ended_at, anonymize_after, executed_at, affected_rows
  ) values (
    p_headquarters_id,
    v_window.anonymize_after - interval '90 days',
    v_window.anonymize_after,
    p_at,
    v_counts
  );
  return jsonb_build_object('status','anonymized','affectedRows',v_counts);
end;
$$;

revoke all on function private.academy_anonymize_ended_headquarters_at(uuid,timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.academy_anonymize_ended_headquarters(p_headquarters_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.academy_anonymize_ended_headquarters_at(p_headquarters_id, statement_timestamp());
$$;

revoke all on function public.academy_anonymize_ended_headquarters(uuid)
  from public, anon, authenticated;
grant execute on function public.academy_anonymize_ended_headquarters(uuid) to service_role;

comment on function public.academy_anonymize_ended_headquarters(uuid) is
  'Service-only, one-HQ idempotent worker. It anonymizes the fixed Academy allowlist after the common ended+90-day boundary; it never deletes enrollment, completion, or credential history.';
