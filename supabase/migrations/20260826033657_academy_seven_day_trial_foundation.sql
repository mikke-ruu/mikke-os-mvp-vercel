-- Academy seven-day trial foundation.
-- Trial headquarters may edit private headquarters/course drafts only.
-- Publishing, real applications, instructors, classes, Community links and
-- hosted video remain unavailable until a paid access state is activated.
-- Dependency order: apply every Academy migration in this branch through
-- 20260825062848 plus 20260825161200 and 20260825222427 first. This migration
-- must not be applied by itself to the older production schema.

create table public.academy_headquarters_access_states (
  headquarters_id uuid primary key references public.academy_headquarters(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  access_kind text not null,
  status text not null,
  starts_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  paid_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_headquarters_access_kind_check
    check (access_kind in ('trial', 'paid')),
  constraint academy_headquarters_access_status_check
    check (status in ('trialing', 'active', 'past_due', 'expired', 'cancelled')),
  constraint academy_headquarters_access_period_check
    check (
      (access_kind = 'trial' and status in ('trialing', 'expired', 'cancelled') and trial_ends_at is not null and paid_started_at is null)
      or
      (access_kind = 'paid' and status in ('active', 'past_due', 'cancelled') and trial_ends_at is null and paid_started_at is not null)
    ),
  constraint academy_headquarters_access_trial_length_check
    check (access_kind <> 'trial' or trial_ends_at = starts_at + interval '7 days')
);

create table public.academy_trial_usage_ledger (
  owner_user_id uuid primary key references auth.users(id) on delete restrict,
  headquarters_id uuid not null unique references public.academy_headquarters(id) on delete restrict,
  first_trial_started_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index academy_headquarters_access_owner_status_idx
  on public.academy_headquarters_access_states(owner_user_id, status, trial_ends_at);

alter table public.academy_headquarters_access_states enable row level security;
alter table public.academy_trial_usage_ledger enable row level security;
revoke all on table public.academy_headquarters_access_states from public, anon, authenticated;
revoke all on table public.academy_trial_usage_ledger from public, anon, authenticated;
grant all on table public.academy_headquarters_access_states to service_role;
grant all on table public.academy_trial_usage_ledger to service_role;

-- Existing headquarters predate this access ledger. Mark only those concrete
-- rows as paid; an unknown headquarters ID must never inherit paid access.
insert into public.academy_headquarters_access_states (
  headquarters_id,
  owner_user_id,
  access_kind,
  status,
  starts_at,
  paid_started_at
)
select
  headquarters.id,
  headquarters.owner_user_id,
  'paid',
  'active',
  coalesce(headquarters.plan_started_at::timestamptz, headquarters.created_at),
  coalesce(headquarters.plan_started_at::timestamptz, headquarters.created_at)
from public.academy_headquarters headquarters
on conflict (headquarters_id) do nothing;

create or replace function private.academy_guard_headquarters_access_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.headquarters_id is distinct from old.headquarters_id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'academy_headquarters_access_identity_is_immutable';
  end if;
  if tg_op = 'UPDATE' and old.access_kind = 'paid' and new.access_kind = 'trial' then
    raise exception 'academy_paid_access_cannot_return_to_trial';
  end if;
  if tg_op = 'UPDATE' and old.access_kind = 'trial' and new.access_kind = 'trial' and (
    new.starts_at is distinct from old.starts_at
    or new.trial_ends_at is distinct from old.trial_ends_at
  ) then
    raise exception 'academy_trial_window_is_immutable';
  end if;

  if not exists (
    select 1
    from public.academy_headquarters headquarters
    where headquarters.id = new.headquarters_id
      and headquarters.owner_user_id = new.owner_user_id
  ) then
    raise exception 'academy_headquarters_access_owner_mismatch';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.academy_guard_trial_usage_ledger_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.academy_headquarters headquarters
      join public.academy_headquarters_access_states access
        on access.headquarters_id = headquarters.id
       and access.owner_user_id = headquarters.owner_user_id
      where headquarters.id = new.headquarters_id
        and headquarters.owner_user_id = new.owner_user_id
        and access.access_kind = 'trial'
    ) then
      raise exception 'academy_trial_usage_ledger_owner_mismatch';
    end if;
    return new;
  end if;
  raise exception 'academy_trial_usage_ledger_is_immutable';
end;
$$;

revoke all on function private.academy_guard_headquarters_access_identity()
  from public, anon, authenticated;
revoke all on function private.academy_guard_trial_usage_ledger_immutable()
  from public, anon, authenticated;

create trigger academy_guard_headquarters_access_identity
before insert or update on public.academy_headquarters_access_states
for each row execute function private.academy_guard_headquarters_access_identity();

create trigger academy_guard_trial_usage_ledger_immutable
before insert or update or delete on public.academy_trial_usage_ledger
for each row execute function private.academy_guard_trial_usage_ledger_immutable();

create or replace function private.academy_headquarters_access_mode(p_headquarters_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when access.access_kind = 'paid' and access.status = 'active' then 'paid'
    when access.access_kind = 'trial' and access.status = 'trialing' and now() < access.trial_ends_at then 'trial_active'
    when access.access_kind = 'trial' then 'trial_expired'
    else 'blocked'
  end
  from public.academy_headquarters headquarters
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
  where headquarters.id = p_headquarters_id;
$$;

revoke all on function private.academy_headquarters_access_mode(uuid)
  from public, anon, authenticated;

create or replace function public.academy_get_my_onboarding_eligibility()
returns table (
  trial_available boolean,
  paid_creation_available boolean,
  trial_block_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select (select auth.uid()) as user_id
  ), facts as (
    select
      actor.user_id,
      exists (
        select 1 from public.academy_headquarters h
        where h.owner_user_id = actor.user_id
      ) as owns_headquarters,
      exists (
        select 1 from public.academy_trial_usage_ledger trial_usage
        where trial_usage.owner_user_id = actor.user_id
      ) as used_trial,
      coalesce(private.academy_has_headquarters_creation_entitlement(actor.user_id), false) as has_paid_entitlement
    from actor
  )
  select
    user_id is not null and not owns_headquarters and not used_trial,
    user_id is not null and not owns_headquarters and has_paid_entitlement,
    case
      when user_id is null then 'authentication_required'
      when owns_headquarters then 'headquarters_already_owned'
      when used_trial then 'trial_already_used'
      else null
    end
  from facts;
$$;

create or replace function public.academy_start_seven_day_trial(p_name text)
returns public.academy_headquarters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_headquarters public.academy_headquarters%rowtype;
  v_headquarters_id uuid := gen_random_uuid();
  v_handle_base text;
  v_starts_at timestamptz := now();
begin
  if v_actor is null then raise exception 'academy_trial_authentication_required'; end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 100 then
    raise exception 'academy_headquarters_invalid_name';
  end if;

  select profile.* into v_profile
  from public.profiles profile
  where profile.user_id = v_actor
  for update;

  if v_profile.id is null then raise exception 'academy_profile_not_available'; end if;
  if exists (
    select 1 from public.academy_headquarters headquarters
    where headquarters.owner_user_id = v_actor
  ) then
    raise exception 'academy_trial_headquarters_already_owned';
  end if;
  if exists (
    select 1 from public.academy_trial_usage_ledger trial_usage
    where trial_usage.owner_user_id = v_actor
  ) then
    raise exception 'academy_trial_already_used';
  end if;

  v_handle_base := left(
    trim(both '-' from regexp_replace(lower(v_profile.handle), '[^a-z0-9_-]+', '-', 'g')),
    17
  );
  if v_handle_base = '' then v_handle_base := 'academy'; end if;

  insert into public.academy_headquarters (
    id, owner_user_id, owner_profile_id, name, handle, plan, is_active
  ) values (
    v_headquarters_id,
    v_actor,
    v_profile.id,
    trim(p_name),
    left(v_handle_base || '-academy-' || left(replace(v_headquarters_id::text, '-', ''), 6), 30),
    'small',
    false
  ) returning * into v_headquarters;

  insert into public.academy_headquarters_access_states (
    headquarters_id, owner_user_id, access_kind, status, starts_at, trial_ends_at
  ) values (
    v_headquarters.id, v_actor, 'trial', 'trialing', v_starts_at, v_starts_at + interval '7 days'
  );

  insert into public.academy_trial_usage_ledger (
    owner_user_id, headquarters_id, first_trial_started_at
  ) values (
    v_actor, v_headquarters.id, v_starts_at
  );

  return v_headquarters;
end;
$$;

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
  select
    headquarters.id,
    access.access_kind,
    case
      when access.access_kind = 'trial' and access.status = 'trialing' and now() >= access.trial_ends_at then 'expired'
      else access.status
    end,
    access.starts_at,
    access.trial_ends_at,
    case
      when access.access_kind = 'trial' and access.status = 'trialing' and now() < access.trial_ends_at
        then greatest(1, ceil(extract(epoch from (access.trial_ends_at - now())) / 86400.0)::integer)
      else 0
    end,
    private.academy_headquarters_access_mode(headquarters.id) in ('paid', 'trial_active'),
    private.academy_headquarters_access_mode(headquarters.id) = 'paid'
  from public.academy_headquarters headquarters
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
  where headquarters.id = p_headquarters_id
    and private.academy_headquarters_role(headquarters.id, (select auth.uid())) is not null;
$$;

-- Replace the paid creation RPC so every future headquarters receives its
-- access row in the same transaction as entitlement consumption.
create or replace function public.academy_create_headquarters(p_name text)
returns public.academy_headquarters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_entitlement public.academy_headquarters_creation_entitlements%rowtype;
  v_headquarters public.academy_headquarters%rowtype;
  v_headquarters_id uuid := gen_random_uuid();
  v_handle_base text;
  v_started_at timestamptz := now();
begin
  if v_actor is null then raise exception 'academy_headquarters_forbidden'; end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 100 then
    raise exception 'academy_headquarters_invalid_name';
  end if;

  select profile.* into v_profile
  from public.profiles profile
  where profile.user_id = v_actor
  for update;
  if v_profile.id is null then raise exception 'academy_profile_not_available'; end if;

  select entitlement.* into v_entitlement
  from public.academy_headquarters_creation_entitlements entitlement
  where entitlement.owner_user_id = v_actor
    and entitlement.status = 'active'
    and entitlement.valid_from <= v_started_at
    and (entitlement.valid_until is null or entitlement.valid_until > v_started_at)
  order by entitlement.valid_until nulls last, entitlement.created_at
  for update skip locked
  limit 1;
  if v_entitlement.id is null then
    raise exception 'academy_headquarters_entitlement_required';
  end if;

  v_handle_base := left(
    trim(both '-' from regexp_replace(lower(v_profile.handle), '[^a-z0-9_-]+', '-', 'g')),
    17
  );
  if v_handle_base = '' then v_handle_base := 'academy'; end if;

  insert into public.academy_headquarters (
    id, owner_user_id, owner_profile_id, name, handle, plan
  ) values (
    v_headquarters_id,
    v_actor,
    v_profile.id,
    trim(p_name),
    left(v_handle_base || '-academy-' || left(replace(v_headquarters_id::text, '-', ''), 6), 30),
    'small'
  ) returning * into v_headquarters;

  insert into public.academy_headquarters_access_states (
    headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
  ) values (
    v_headquarters.id, v_actor, 'paid', 'active', v_started_at, v_started_at
  );

  update public.academy_headquarters_creation_entitlements
  set status = 'consumed',
      consumed_at = v_started_at,
      headquarters_id = v_headquarters.id,
      updated_at = v_started_at
  where id = v_entitlement.id;

  return v_headquarters;
end;
$$;

revoke all on function public.academy_get_my_onboarding_eligibility() from public, anon;
revoke all on function public.academy_start_seven_day_trial(text) from public, anon;
revoke all on function public.academy_get_my_headquarters_access(uuid) from public, anon;
revoke all on function public.academy_create_headquarters(text) from public, anon;
grant execute on function public.academy_get_my_onboarding_eligibility() to authenticated;
grant execute on function public.academy_start_seven_day_trial(text) to authenticated;
grant execute on function public.academy_get_my_headquarters_access(uuid) to authenticated;
grant execute on function public.academy_create_headquarters(text) to authenticated;

create or replace function private.academy_guard_trial_course_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headquarters_id uuid := case when tg_op = 'DELETE' then old.headquarters_id else new.headquarters_id end;
  v_mode text := private.academy_headquarters_access_mode(v_headquarters_id);
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.headquarters_id is distinct from old.headquarters_id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'academy_course_scope_is_immutable';
  end if;
  if v_mode = 'paid' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if v_mode = 'trial_active' then
    if (tg_op = 'DELETE' and old.is_published)
      or (tg_op <> 'DELETE' and new.is_published)
      or (tg_op = 'UPDATE' and old.is_published) then
      raise exception 'academy_trial_publishing_unavailable';
    end if;
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  raise exception 'academy_access_inactive';
end;
$$;

create or replace function private.academy_guard_trial_draft_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_headquarters_id uuid := coalesce(v_row ->> 'headquarters_id', v_row ->> 'id')::uuid;
  v_mode text := private.academy_headquarters_access_mode(v_headquarters_id);
begin
  if tg_table_name = 'academy_headquarters' and tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.owner_profile_id is distinct from old.owner_profile_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'academy_headquarters_identity_is_immutable';
  end if;

  if v_mode = 'paid' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if v_mode = 'trial_active' and tg_table_name = 'academy_headquarters' then
    if tg_op = 'DELETE' then
      raise exception 'academy_trial_headquarters_delete_unavailable';
    end if;
    if new.is_active
      or (to_jsonb(new) - array[
        'name', 'tagline', 'logo_url', 'main_color', 'contact_email',
        'default_payment_note', 'hero_image_url', 'front_message',
        'renewal_period_months', 'front_blocks', 'updated_at'
      ]) is distinct from (to_jsonb(old) - array[
        'name', 'tagline', 'logo_url', 'main_color', 'contact_email',
        'default_payment_note', 'hero_image_url', 'front_message',
        'renewal_period_months', 'front_blocks', 'updated_at'
      ]) then
      raise exception 'academy_trial_headquarters_protected_fields';
    end if;
    return new;
  end if;

  if v_mode = 'trial_active' and tg_table_name in ('academy_headquarters_settings', 'academy_settings') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  raise exception 'academy_access_inactive';
end;
$$;

create or replace function private.academy_guard_trial_live_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_headquarters_id uuid := (v_row ->> 'headquarters_id')::uuid;
  v_old_headquarters_id uuid := case when tg_op = 'UPDATE' then old.headquarters_id else null end;
begin
  if coalesce(private.academy_headquarters_access_mode(v_headquarters_id), 'blocked') <> 'paid'
    or (
      v_old_headquarters_id is not null
      and coalesce(private.academy_headquarters_access_mode(v_old_headquarters_id), 'blocked') <> 'paid'
    ) then
    raise exception 'academy_trial_live_feature_unavailable';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function private.academy_guard_trial_program_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headquarters_id uuid := case when tg_op = 'DELETE' then old.headquarters_id else new.headquarters_id end;
  v_mode text := private.academy_headquarters_access_mode(v_headquarters_id);
begin
  if v_mode = 'paid' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if v_mode = 'trial_active'
    and (case when tg_op = 'DELETE' then old.status else new.status end) = 'draft'
    and (tg_op <> 'UPDATE' or old.status = 'draft') then
    if tg_op <> 'DELETE' and (
      new.course_id is null
      or not exists (
        select 1
        from public.academy_courses course
        where course.id = new.course_id
          and course.headquarters_id = v_headquarters_id
          and course.is_published = false
      )
    ) then
      raise exception 'academy_trial_program_requires_unpublished_course';
    end if;
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if v_mode = 'trial_active' then
    raise exception 'academy_trial_program_publish_unavailable';
  end if;
  raise exception 'academy_access_inactive';
end;
$$;

create or replace function private.academy_guard_trial_program_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_program_id uuid;
  v_headquarters_id uuid;
  v_program_status text;
begin
  if tg_table_name = 'academy_program_sections' then
    v_program_id := (v_row ->> 'program_id')::uuid;
  else
    select section.program_id into v_program_id
    from public.academy_program_sections section
    where section.id = (v_row ->> 'section_id')::uuid;
  end if;

  select program.headquarters_id, program.status
  into v_headquarters_id, v_program_status
  from public.academy_programs program
  where program.id = v_program_id;

  if private.academy_headquarters_access_mode(v_headquarters_id) = 'paid' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if private.academy_headquarters_access_mode(v_headquarters_id) = 'trial_active'
    and v_program_status = 'draft' then
    if tg_table_name = 'academy_program_steps'
      and tg_op <> 'DELETE'
      and (to_jsonb(new) ->> 'video_asset_id') is not null then
      raise exception 'academy_trial_hosted_video_unavailable';
    end if;
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  raise exception 'academy_access_inactive';
end;
$$;

create or replace function private.academy_guard_trial_indirect_live_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_headquarters_id uuid;
  v_second_headquarters_id uuid;
begin
  case tg_table_name
    when 'academy_application_notifications' then
      select application.headquarters_id into v_headquarters_id
      from public.academy_applications application
      where application.id = (v_row ->> 'application_id')::uuid;
    when 'academy_class_status_events' then
      select class.headquarters_id into v_headquarters_id
      from public.academy_classes class
      where class.id = (v_row ->> 'class_id')::uuid;
    when 'academy_credential_applications' then
      select credential.headquarters_id into v_headquarters_id
      from public.academy_credentials credential
      where credential.id = (v_row ->> 'credential_id')::uuid;
    when 'academy_credential_holders' then
      select credential.headquarters_id into v_headquarters_id
      from public.academy_credentials credential
      where credential.id = (v_row ->> 'credential_id')::uuid;
    when 'academy_enrollments' then
      select class.headquarters_id into v_headquarters_id
      from public.academy_classes class
      where class.id = (v_row ->> 'class_id')::uuid;
    when 'academy_instructor_addresses' then
      select instructor.headquarters_id into v_headquarters_id
      from public.academy_instructors instructor
      where instructor.id = (v_row ->> 'instructor_id')::uuid;
    when 'academy_order_status_history' then
      select procurement_order.headquarters_id into v_headquarters_id
      from public.academy_procurement_orders procurement_order
      where procurement_order.id = (v_row ->> 'order_id')::uuid;
    when 'academy_payment_events' then
      select application.headquarters_id into v_headquarters_id
      from public.academy_applications application
      where application.id = (v_row ->> 'application_id')::uuid;
    when 'academy_procurement_order_items' then
      select procurement_order.headquarters_id into v_headquarters_id
      from public.academy_procurement_orders procurement_order
      where procurement_order.id = (v_row ->> 'order_id')::uuid;
    when 'academy_product_role_access' then
      select product.headquarters_id into v_headquarters_id
      from public.academy_procurement_products product
      where product.id = (v_row ->> 'product_id')::uuid;
    when 'academy_program_versions' then
      select program.headquarters_id into v_headquarters_id
      from public.academy_programs program
      where program.id = (v_row ->> 'program_id')::uuid;
    when 'academy_live_sessions',
         'academy_step_progress',
         'academy_step_submissions',
         'academy_step_test_attempts' then
      select assignment.headquarters_id into v_headquarters_id
      from public.academy_program_assignments assignment
      where assignment.id = (v_row ->> 'assignment_id')::uuid;
    when 'academy_subscriptions' then
      select product.headquarters_id into v_headquarters_id
      from public.academy_subscription_products product
      where product.id = (v_row ->> 'subscription_product_id')::uuid;
    when 'academy_entitlement_grants' then
      select program.headquarters_id into v_headquarters_id
      from public.academy_programs program
      where program.id = (v_row ->> 'program_id')::uuid;
      if v_headquarters_id is null then
        select product.headquarters_id into v_headquarters_id
        from public.academy_subscriptions subscription
        join public.academy_subscription_products product
          on product.id = subscription.subscription_product_id
        where subscription.id = (v_row ->> 'subscription_id')::uuid;
      end if;
    when 'academy_subscription_product_programs' then
      select program.headquarters_id, product.headquarters_id
      into v_headquarters_id, v_second_headquarters_id
      from public.academy_programs program
      join public.academy_subscription_products product
        on product.id = (v_row ->> 'subscription_product_id')::uuid
      where program.id = (v_row ->> 'program_id')::uuid;
    when 'academy_program_licenses' then
      v_headquarters_id := (v_row ->> 'licensor_headquarters_id')::uuid;
      v_second_headquarters_id := (v_row ->> 'licensee_headquarters_id')::uuid;
    else
      raise exception 'academy_trial_guard_table_not_supported';
  end case;

  if coalesce(private.academy_headquarters_access_mode(v_headquarters_id), 'blocked') <> 'paid'
    or (
      v_second_headquarters_id is not null
      and coalesce(private.academy_headquarters_access_mode(v_second_headquarters_id), 'blocked') <> 'paid'
    ) then
    raise exception 'academy_trial_live_feature_unavailable';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function private.academy_related_headquarters_ids(
  p_table_name text,
  p_row jsonb
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  case p_table_name
    when 'academy_application_notifications' then
      select array[application.headquarters_id] into v_ids
      from public.academy_applications application
      where application.id = (p_row ->> 'application_id')::uuid;
    when 'academy_class_status_events' then
      select array[class.headquarters_id] into v_ids
      from public.academy_classes class
      where class.id = (p_row ->> 'class_id')::uuid;
    when 'academy_credential_applications', 'academy_credential_holders' then
      select array[credential.headquarters_id] into v_ids
      from public.academy_credentials credential
      where credential.id = (p_row ->> 'credential_id')::uuid;
    when 'academy_enrollments' then
      select array[class.headquarters_id] into v_ids
      from public.academy_classes class
      where class.id = (p_row ->> 'class_id')::uuid;
    when 'academy_instructor_addresses' then
      select array[instructor.headquarters_id] into v_ids
      from public.academy_instructors instructor
      where instructor.id = (p_row ->> 'instructor_id')::uuid;
    when 'academy_order_status_history', 'academy_procurement_order_items' then
      select array[procurement_order.headquarters_id] into v_ids
      from public.academy_procurement_orders procurement_order
      where procurement_order.id = (p_row ->> 'order_id')::uuid;
    when 'academy_payment_events' then
      select array[application.headquarters_id] into v_ids
      from public.academy_applications application
      where application.id = (p_row ->> 'application_id')::uuid;
    when 'academy_product_role_access' then
      select array[product.headquarters_id] into v_ids
      from public.academy_procurement_products product
      where product.id = (p_row ->> 'product_id')::uuid;
    when 'academy_program_versions' then
      select array[program.headquarters_id] into v_ids
      from public.academy_programs program
      where program.id = (p_row ->> 'program_id')::uuid;
    when 'academy_live_sessions',
         'academy_step_progress',
         'academy_step_submissions',
         'academy_step_test_attempts' then
      select array[assignment.headquarters_id] into v_ids
      from public.academy_program_assignments assignment
      where assignment.id = (p_row ->> 'assignment_id')::uuid;
    when 'academy_subscriptions' then
      select array[product.headquarters_id] into v_ids
      from public.academy_subscription_products product
      where product.id = (p_row ->> 'subscription_product_id')::uuid;
    when 'academy_entitlement_grants' then
      select array_remove(array[program.headquarters_id, product.headquarters_id], null)
      into v_ids
      from (select 1) seed
      left join public.academy_programs program
        on program.id = (p_row ->> 'program_id')::uuid
      left join public.academy_subscriptions subscription
        on subscription.id = (p_row ->> 'subscription_id')::uuid
      left join public.academy_subscription_products product
        on product.id = subscription.subscription_product_id;
    when 'academy_subscription_product_programs' then
      select array[program.headquarters_id, product.headquarters_id]
      into v_ids
      from public.academy_programs program
      join public.academy_subscription_products product
        on product.id = (p_row ->> 'subscription_product_id')::uuid
      where program.id = (p_row ->> 'program_id')::uuid;
    when 'academy_program_licenses' then
      v_ids := array[
        (p_row ->> 'licensor_headquarters_id')::uuid,
        (p_row ->> 'licensee_headquarters_id')::uuid
      ];
    else
      raise exception 'academy_trial_guard_table_not_supported';
  end case;
  return coalesce(array_remove(v_ids, null), array[]::uuid[]);
end;
$$;

create or replace function private.academy_guard_trial_indirect_live_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headquarters_ids uuid[] := private.academy_related_headquarters_ids(
    tg_table_name,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
begin
  if tg_op = 'UPDATE' then
    v_headquarters_ids := v_headquarters_ids
      || private.academy_related_headquarters_ids(tg_table_name, to_jsonb(old));
  end if;
  if cardinality(v_headquarters_ids) = 0
    or exists (
      select 1
      from unnest(v_headquarters_ids) headquarters_id
      where coalesce(
        private.academy_headquarters_access_mode(headquarters_id),
        'blocked'
      ) <> 'paid'
    ) then
    raise exception 'academy_trial_live_feature_unavailable';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.academy_guard_trial_course_draft() from public, anon, authenticated;
revoke all on function private.academy_guard_trial_draft_edit() from public, anon, authenticated;
revoke all on function private.academy_guard_trial_live_operation() from public, anon, authenticated;
revoke all on function private.academy_guard_trial_program_draft() from public, anon, authenticated;
revoke all on function private.academy_guard_trial_program_child() from public, anon, authenticated;
revoke all on function private.academy_guard_trial_indirect_live_operation() from public, anon, authenticated;
revoke all on function private.academy_related_headquarters_ids(text, jsonb) from public, anon, authenticated;

create trigger academy_trial_guard_courses
before insert or update or delete on public.academy_courses
for each row execute function private.academy_guard_trial_course_draft();

create trigger academy_trial_guard_headquarters
before update or delete on public.academy_headquarters
for each row execute function private.academy_guard_trial_draft_edit();

create trigger academy_trial_guard_headquarters_settings
before insert or update or delete on public.academy_headquarters_settings
for each row execute function private.academy_guard_trial_draft_edit();

create trigger academy_trial_guard_academy_settings
before insert or update or delete on public.academy_settings
for each row execute function private.academy_guard_trial_draft_edit();

create trigger academy_trial_guard_programs
before insert or update or delete on public.academy_programs
for each row execute function private.academy_guard_trial_program_draft();

create trigger academy_trial_guard_program_sections
before insert or update or delete on public.academy_program_sections
for each row execute function private.academy_guard_trial_program_child();

-- PostgreSQL fires same-kind triggers by name. Run the trial gate before the
-- existing academy_guard_program_step_video_scope trigger so trial-hosted
-- video is rejected by the trial contract before asset-scope validation.
create trigger academy_00_trial_guard_program_steps
before insert or update or delete on public.academy_program_steps
for each row execute function private.academy_guard_trial_program_child();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'academy_applications',
    'academy_activity_events',
    'academy_classes',
    'academy_class_instructor_requests',
    'academy_instructors',
    'academy_kit_orders',
    'academy_headquarters_members',
    'academy_headquarters_invitations',
    'academy_materials',
    'academy_instructor_pages',
    'academy_learner_pages',
    'academy_video_assets',
    'academy_course_access_grants',
    'academy_program_assignments',
    'academy_credentials',
    'academy_billing_accounts',
    'academy_memberships',
    'academy_role_definitions',
    'academy_procurement_orders',
    'academy_procurement_products',
    'academy_subscription_products',
    'academy_instructor_billing_exclusions',
    'academy_monthly_billing_snapshots'
  ] loop
    execute format(
      'create trigger academy_trial_guard_live before insert or update or delete on public.%I for each row execute function private.academy_guard_trial_live_operation()',
      v_table
    );
  end loop;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'academy_application_notifications',
    'academy_class_status_events',
    'academy_credential_applications',
    'academy_credential_holders',
    'academy_enrollments',
    'academy_entitlement_grants',
    'academy_instructor_addresses',
    'academy_live_sessions',
    'academy_order_status_history',
    'academy_payment_events',
    'academy_procurement_order_items',
    'academy_product_role_access',
    'academy_program_licenses',
    'academy_program_versions',
    'academy_step_progress',
    'academy_step_submissions',
    'academy_step_test_attempts',
    'academy_subscription_product_programs',
    'academy_subscriptions'
  ] loop
    execute format(
      'create trigger academy_trial_guard_indirect_live before insert or update or delete on public.%I for each row execute function private.academy_guard_trial_indirect_live_operation()',
      v_table
    );
  end loop;
end;
$$;

create or replace function private.academy_guard_trial_community_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_headquarters_id uuid;
  v_old_headquarters_id uuid;
begin
  if v_row ->> 'provider_type' <> 'academy_subscription'
    and (tg_op <> 'UPDATE' or old.provider_type <> 'academy_subscription') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if v_row ->> 'provider_type' = 'academy_subscription' then
    begin
      v_headquarters_id := (v_row ->> 'provider_owner_key')::uuid;
    exception when invalid_text_representation then
      raise exception 'academy_community_mapping_owner_invalid';
    end;
  end if;
  if tg_op = 'UPDATE' and old.provider_type = 'academy_subscription' then
    begin
      v_old_headquarters_id := old.provider_owner_key::uuid;
    exception when invalid_text_representation then
      raise exception 'academy_community_mapping_owner_invalid';
    end;
  end if;
  if (
      v_headquarters_id is not null
      and coalesce(private.academy_headquarters_access_mode(v_headquarters_id), 'blocked') <> 'paid'
    ) or (
      v_old_headquarters_id is not null
      and coalesce(private.academy_headquarters_access_mode(v_old_headquarters_id), 'blocked') <> 'paid'
    ) then
    raise exception 'academy_trial_community_unavailable';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.academy_guard_trial_community_mapping() from public, anon, authenticated;

create trigger academy_trial_guard_community_mapping
before insert or update or delete on public.community_access_source_mappings
for each row execute function private.academy_guard_trial_community_mapping();
