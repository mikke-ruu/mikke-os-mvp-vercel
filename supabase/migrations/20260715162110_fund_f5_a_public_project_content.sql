-- Fund F5-a: make project content database-owned and expose a separate,
-- public-safe project and plan read model. Supporter details stay private.
-- Remote migration history version: 20260715162110.

alter table public.fund_projects
  add column short_description text not null default '',
  add column description text not null default '',
  add column project_type text not null default 'other',
  add column campaign_type text not null default 'support',
  add column stage text not null default 'concept',
  add column cover_image_url text not null default '',
  add column goal_type text not null default 'supporters',
  add column goal_value numeric(12, 2) not null default 1,
  add column display_amount boolean not null default false,
  add column start_at date,
  add column end_at date,
  add column external_payment_url text not null default '',
  add column external_application_url text not null default '',
  add column why_now text not null default '',
  add column audience text not null default '',
  add column use_of_support text not null default '',
  add column schedule text not null default '',
  add column risk_notes text not null default '',
  add column cancellation_policy text not null default '',
  add column contact_note text not null default '',
  add column published_at timestamptz,
  add column completed_at timestamptz,
  add column archived_at timestamptz;

alter table public.fund_projects
  add constraint fund_projects_title_length_check
    check (char_length(title) between 1 and 160),
  add constraint fund_projects_short_description_length_check
    check (char_length(short_description) <= 500),
  add constraint fund_projects_description_length_check
    check (char_length(description) <= 10000),
  add constraint fund_projects_project_type_check
    check (project_type in ('product', 'course', 'event', 'session', 'community', 'place', 'activity', 'other')),
  add constraint fund_projects_campaign_type_check
    check (campaign_type in ('preorder', 'early_application', 'reservation', 'sponsorship', 'support', 'interest')),
  add constraint fund_projects_stage_check
    check (stage in ('concept', 'campaign', 'realization')),
  add constraint fund_projects_goal_type_check
    check (goal_type in ('amount', 'supporters', 'reservations', 'participants', 'vendors', 'sponsors')),
  add constraint fund_projects_goal_value_check
    check (goal_value > 0),
  add constraint fund_projects_display_amount_check
    check (not display_amount or goal_type = 'amount'),
  add constraint fund_projects_date_order_check
    check (start_at is null or end_at is null or end_at >= start_at),
  add constraint fund_projects_cover_url_check
    check (cover_image_url = '' or (char_length(cover_image_url) <= 2048 and cover_image_url ~ '^https?://')),
  add constraint fund_projects_payment_url_check
    check (external_payment_url = '' or (char_length(external_payment_url) <= 2048 and external_payment_url ~ '^https?://')),
  add constraint fund_projects_application_url_check
    check (external_application_url = '' or (char_length(external_application_url) <= 2048 and external_application_url ~ '^https?://')),
  add constraint fund_projects_public_text_lengths_check
    check (
      char_length(why_now) <= 10000
      and char_length(audience) <= 10000
      and char_length(use_of_support) <= 10000
      and char_length(schedule) <= 10000
      and char_length(risk_notes) <= 10000
      and char_length(cancellation_policy) <= 10000
      and char_length(contact_note) <= 2000
    );

create table public.fund_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.fund_projects(id) on delete cascade,
  source_local_id text not null,
  title text not null,
  description text not null default '',
  image_url text not null default '',
  plan_type text not null default 'support',
  price numeric(12, 2),
  quantity_limit integer,
  per_person_limit integer,
  delivery_date date,
  external_payment_url text not null default '',
  external_application_url text not null default '',
  required_information_note text not null default '',
  requires_shipping boolean not null default false,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fund_plans_source_local_id_length_check
    check (char_length(source_local_id) between 1 and 160),
  constraint fund_plans_title_length_check
    check (char_length(title) between 1 and 160),
  constraint fund_plans_description_length_check
    check (char_length(description) <= 5000),
  constraint fund_plans_plan_type_check
    check (plan_type in ('preorder', 'early_application', 'reservation', 'sponsorship', 'support', 'interest', 'non_financial')),
  constraint fund_plans_price_check
    check (price is null or price >= 0),
  constraint fund_plans_quantity_limit_check
    check (quantity_limit is null or quantity_limit > 0),
  constraint fund_plans_per_person_limit_check
    check (per_person_limit is null or per_person_limit > 0),
  constraint fund_plans_status_check
    check (status in ('draft', 'active', 'sold_out', 'closed', 'hidden')),
  constraint fund_plans_sort_order_check
    check (sort_order >= 0),
  constraint fund_plans_image_url_check
    check (image_url = '' or (char_length(image_url) <= 2048 and image_url ~ '^https?://')),
  constraint fund_plans_payment_url_check
    check (external_payment_url = '' or (char_length(external_payment_url) <= 2048 and external_payment_url ~ '^https?://')),
  constraint fund_plans_application_url_check
    check (external_application_url = '' or (char_length(external_application_url) <= 2048 and external_application_url ~ '^https?://')),
  constraint fund_plans_required_information_length_check
    check (char_length(required_information_note) <= 2000),
  constraint fund_plans_project_source_local_unique
    unique (project_id, source_local_id)
);

create index fund_plans_project_id_idx on public.fund_plans (project_id);

drop trigger if exists set_fund_plans_updated_at on public.fund_plans;
create trigger set_fund_plans_updated_at
before update on public.fund_plans
for each row execute function public.set_fund_updated_at();

alter table public.fund_plans enable row level security;
alter table public.fund_plans force row level security;

revoke all on table public.fund_plans from public, anon, authenticated;
grant select, insert, update, delete on table public.fund_plans to authenticated;
grant all on table public.fund_plans to service_role;

create policy "fund_plans_select_own_project"
on public.fund_plans for select to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_plans.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_plans_insert_own_project"
on public.fund_plans for insert to authenticated
with check (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_plans.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_plans_update_own_project"
on public.fund_plans for update to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_plans.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_plans.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_plans_delete_own_project"
on public.fund_plans for delete to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_plans.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create table public.fund_public_projects (
  project_id uuid primary key references public.fund_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  profile_slug text not null,
  slug text not null,
  title text not null,
  short_description text not null,
  description text not null,
  project_type text not null,
  campaign_type text not null,
  stage text not null,
  status text not null,
  cover_image_url text not null,
  goal_type text not null,
  goal_value numeric(12, 2) not null,
  current_value numeric(12, 2) not null,
  display_amount boolean not null,
  start_at date,
  end_at date,
  external_payment_url text not null,
  external_application_url text not null,
  why_now text not null,
  audience text not null,
  use_of_support text not null,
  schedule text not null,
  risk_notes text not null,
  cancellation_policy text not null,
  contact_note text not null,
  published_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,

  constraint fund_public_projects_profile_slug_format_check
    check (profile_slug ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  constraint fund_public_projects_slug_format_check
    check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint fund_public_projects_profile_slug_unique
    unique (profile_slug, slug)
);

create index fund_public_projects_owner_profile_id_idx
  on public.fund_public_projects (owner_profile_id);
create index fund_public_projects_published_at_idx
  on public.fund_public_projects (published_at desc);

create table public.fund_public_plans (
  plan_id uuid primary key references public.fund_plans(id) on delete cascade,
  project_id uuid not null references public.fund_public_projects(project_id) on delete cascade,
  title text not null,
  description text not null,
  image_url text not null,
  plan_type text not null,
  price numeric(12, 2),
  quantity_limit integer,
  per_person_limit integer,
  delivery_date date,
  external_payment_url text not null,
  external_application_url text not null,
  status text not null,
  sort_order integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index fund_public_plans_project_id_sort_order_idx
  on public.fund_public_plans (project_id, sort_order);

alter table public.fund_public_projects enable row level security;
alter table public.fund_public_projects force row level security;
alter table public.fund_public_plans enable row level security;
alter table public.fund_public_plans force row level security;

revoke all on table public.fund_public_projects, public.fund_public_plans from public, anon, authenticated;
grant select on table public.fund_public_projects, public.fund_public_plans to anon, authenticated;
grant all on table public.fund_public_projects, public.fund_public_plans to service_role;

create policy "fund_public_projects_select_published"
on public.fund_public_projects for select to anon, authenticated
using (true);

create policy "fund_public_plans_select_published"
on public.fund_public_plans for select to anon, authenticated
using (true);

create or replace function private.sync_fund_public_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.fund_projects%rowtype;
  v_profile_slug text;
  v_current_value numeric(12, 2) := 0;
begin
  select * into v_project
  from public.fund_projects
  where id = p_project_id;

  if not found then
    delete from public.fund_public_projects where project_id = p_project_id;
    return;
  end if;

  select handle into v_profile_slug
  from public.profiles
  where id = v_project.owner_profile_id;

  if v_project.visibility <> 'public'
    or v_project.status = 'draft'
    or v_profile_slug is null
    or v_profile_slug !~ '^[a-z0-9][a-z0-9_-]{0,79}$' then
    delete from public.fund_public_projects where project_id = p_project_id;
    return;
  end if;

  if v_project.goal_type = 'amount' then
    select coalesce(sum(support.amount), 0)::numeric(12, 2)
    into v_current_value
    from public.fund_supports as support
    where support.project_id = p_project_id
      and support.record_status = 'valid'
      and support.payment_status = 'confirmed'
      and support.fulfillment_status <> 'cancelled';
  elsif v_project.goal_type = 'supporters' then
    select count(distinct coalesce(
      participation.supporter_user_id::text,
      nullif(lower(btrim(support.supporter_email)), ''),
      nullif(lower(btrim(support.supporter_name)), ''),
      support.id::text
    ))::numeric(12, 2)
    into v_current_value
    from public.fund_supports as support
    left join public.fund_participations as participation on participation.support_id = support.id
    where support.project_id = p_project_id
      and support.record_status = 'valid'
      and support.payment_status not in ('refunded', 'cancelled')
      and support.fulfillment_status <> 'cancelled';
  else
    select coalesce(sum(support.quantity), 0)::numeric(12, 2)
    into v_current_value
    from public.fund_supports as support
    where support.project_id = p_project_id
      and support.record_status = 'valid'
      and support.payment_status not in ('refunded', 'cancelled')
      and support.fulfillment_status <> 'cancelled';
  end if;

  insert into public.fund_public_projects (
    project_id, owner_profile_id, profile_slug, slug, title,
    short_description, description, project_type, campaign_type, stage, status,
    cover_image_url, goal_type, goal_value, current_value, display_amount,
    start_at, end_at, external_payment_url, external_application_url,
    why_now, audience, use_of_support, schedule, risk_notes,
    cancellation_policy, contact_note, published_at, completed_at,
    created_at, updated_at
  ) values (
    v_project.id, v_project.owner_profile_id, v_profile_slug, v_project.slug, v_project.title,
    v_project.short_description, v_project.description, v_project.project_type,
    v_project.campaign_type, v_project.stage, v_project.status,
    v_project.cover_image_url, v_project.goal_type,
    case when v_project.goal_type = 'amount' and not v_project.display_amount then 0 else v_project.goal_value end,
    case when v_project.goal_type = 'amount' and not v_project.display_amount then 0 else v_current_value end,
    v_project.display_amount, v_project.start_at, v_project.end_at,
    v_project.external_payment_url, v_project.external_application_url,
    v_project.why_now, v_project.audience, v_project.use_of_support,
    v_project.schedule, v_project.risk_notes, v_project.cancellation_policy,
    v_project.contact_note, coalesce(v_project.published_at, v_project.created_at),
    v_project.completed_at, v_project.created_at, v_project.updated_at
  )
  on conflict (project_id) do update set
    owner_profile_id = excluded.owner_profile_id,
    profile_slug = excluded.profile_slug,
    slug = excluded.slug,
    title = excluded.title,
    short_description = excluded.short_description,
    description = excluded.description,
    project_type = excluded.project_type,
    campaign_type = excluded.campaign_type,
    stage = excluded.stage,
    status = excluded.status,
    cover_image_url = excluded.cover_image_url,
    goal_type = excluded.goal_type,
    goal_value = excluded.goal_value,
    current_value = excluded.current_value,
    display_amount = excluded.display_amount,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    external_payment_url = excluded.external_payment_url,
    external_application_url = excluded.external_application_url,
    why_now = excluded.why_now,
    audience = excluded.audience,
    use_of_support = excluded.use_of_support,
    schedule = excluded.schedule,
    risk_notes = excluded.risk_notes,
    cancellation_policy = excluded.cancellation_policy,
    contact_note = excluded.contact_note,
    published_at = excluded.published_at,
    completed_at = excluded.completed_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;

  delete from public.fund_public_plans where project_id = p_project_id;

  insert into public.fund_public_plans (
    plan_id, project_id, title, description, image_url, plan_type, price,
    quantity_limit, per_person_limit, delivery_date, external_payment_url,
    external_application_url, status, sort_order, created_at, updated_at
  )
  select
    plan.id, plan.project_id, plan.title, plan.description, plan.image_url,
    plan.plan_type, case when v_project.display_amount then plan.price else null end,
    plan.quantity_limit, plan.per_person_limit, plan.delivery_date,
    plan.external_payment_url, plan.external_application_url, plan.status,
    plan.sort_order, plan.created_at, plan.updated_at
  from public.fund_plans as plan
  where plan.project_id = p_project_id
    and plan.status not in ('draft', 'hidden');
end;
$$;

create or replace function private.sync_fund_public_project_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  if tg_table_name = 'fund_projects' then
    perform private.sync_fund_public_project(new.id);
  elsif tg_table_name = 'fund_plans' or tg_table_name = 'fund_supports' then
    v_project_id := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
    perform private.sync_fund_public_project(v_project_id);
  elsif tg_table_name = 'profiles' then
    for v_project_id in
      select id from public.fund_projects where owner_profile_id = new.id
    loop
      perform private.sync_fund_public_project(v_project_id);
    end loop;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_fund_public_project(uuid) from public, anon, authenticated;
revoke all on function private.sync_fund_public_project_trigger() from public, anon, authenticated;

create trigger sync_fund_public_project_after_project_change
after insert or update on public.fund_projects
for each row execute function private.sync_fund_public_project_trigger();

create trigger sync_fund_public_project_after_plan_change
after insert or update or delete on public.fund_plans
for each row execute function private.sync_fund_public_project_trigger();

create trigger sync_fund_public_project_after_support_change
after insert or update or delete on public.fund_supports
for each row execute function private.sync_fund_public_project_trigger();

create trigger sync_fund_public_project_after_owner_handle_change
after update of handle on public.profiles
for each row execute function private.sync_fund_public_project_trigger();

create or replace function public.save_fund_project_content(
  p_owner_profile_id uuid,
  p_project jsonb,
  p_plans jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_project_id uuid;
  v_source_local_id text := nullif(btrim(p_project ->> 'id'), '');
  v_visibility text := p_project ->> 'visibility';
  v_status text := p_project ->> 'status';
  v_plan jsonb;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_source_local_id is null then
    raise exception 'Project local id is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_plans) <> 'array' then
    raise exception 'Plans must be a JSON array' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_owner_profile_id and user_id = v_actor_user_id
  ) then
    raise exception 'Owner profile does not belong to the authenticated user' using errcode = '42501';
  end if;

  select id into v_project_id
  from public.fund_projects
  where owner_user_id = v_actor_user_id
    and source_local_id = v_source_local_id;

  if v_project_id is null then
    insert into public.fund_projects (
      owner_user_id, owner_profile_id, source_local_id, slug, title,
      visibility, status, short_description, description, project_type,
      campaign_type, stage, cover_image_url, goal_type, goal_value,
      display_amount, start_at, end_at, external_payment_url,
      external_application_url, why_now, audience, use_of_support,
      schedule, risk_notes, cancellation_policy, contact_note,
      published_at, completed_at, archived_at
    ) values (
      v_actor_user_id, p_owner_profile_id, v_source_local_id,
      p_project ->> 'slug', p_project ->> 'title', v_visibility, v_status,
      coalesce(p_project ->> 'shortDescription', ''),
      coalesce(p_project ->> 'description', ''),
      p_project ->> 'projectType', p_project ->> 'campaignType',
      p_project ->> 'stage', coalesce(p_project ->> 'coverImageUrl', ''),
      p_project ->> 'goalType', (p_project ->> 'goalValue')::numeric,
      coalesce((p_project ->> 'displayAmount')::boolean, false),
      nullif(p_project ->> 'startAt', '')::date,
      nullif(p_project ->> 'endAt', '')::date,
      coalesce(p_project ->> 'externalPaymentUrl', ''),
      coalesce(p_project ->> 'externalApplicationUrl', ''),
      coalesce(p_project ->> 'whyNow', ''), coalesce(p_project ->> 'audience', ''),
      coalesce(p_project ->> 'useOfSupport', ''), coalesce(p_project ->> 'schedule', ''),
      coalesce(p_project ->> 'riskNotes', ''),
      coalesce(p_project ->> 'cancellationPolicy', ''),
      coalesce(p_project ->> 'contactNote', ''),
      case when v_visibility = 'public' and v_status <> 'draft' then now() else null end,
      case when v_status = 'completed' then now() else null end,
      case when v_status = 'archived' then now() else null end
    ) returning id into v_project_id;
  else
    update public.fund_projects
    set owner_profile_id = p_owner_profile_id,
        slug = p_project ->> 'slug',
        title = p_project ->> 'title',
        visibility = v_visibility,
        status = v_status,
        short_description = coalesce(p_project ->> 'shortDescription', ''),
        description = coalesce(p_project ->> 'description', ''),
        project_type = p_project ->> 'projectType',
        campaign_type = p_project ->> 'campaignType',
        stage = p_project ->> 'stage',
        cover_image_url = coalesce(p_project ->> 'coverImageUrl', ''),
        goal_type = p_project ->> 'goalType',
        goal_value = (p_project ->> 'goalValue')::numeric,
        display_amount = coalesce((p_project ->> 'displayAmount')::boolean, false),
        start_at = nullif(p_project ->> 'startAt', '')::date,
        end_at = nullif(p_project ->> 'endAt', '')::date,
        external_payment_url = coalesce(p_project ->> 'externalPaymentUrl', ''),
        external_application_url = coalesce(p_project ->> 'externalApplicationUrl', ''),
        why_now = coalesce(p_project ->> 'whyNow', ''),
        audience = coalesce(p_project ->> 'audience', ''),
        use_of_support = coalesce(p_project ->> 'useOfSupport', ''),
        schedule = coalesce(p_project ->> 'schedule', ''),
        risk_notes = coalesce(p_project ->> 'riskNotes', ''),
        cancellation_policy = coalesce(p_project ->> 'cancellationPolicy', ''),
        contact_note = coalesce(p_project ->> 'contactNote', ''),
        published_at = case
          when v_visibility = 'public' and v_status <> 'draft' then coalesce(published_at, now())
          else published_at
        end,
        completed_at = case when v_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
        archived_at = case when v_status = 'archived' then coalesce(archived_at, now()) else archived_at end
    where id = v_project_id;
  end if;

  delete from public.fund_plans where project_id = v_project_id;

  for v_plan in select value from jsonb_array_elements(p_plans)
  loop
    if nullif(btrim(v_plan ->> 'id'), '') is null
      or nullif(btrim(v_plan ->> 'title'), '') is null then
      raise exception 'Each plan requires id and title' using errcode = '22023';
    end if;

    insert into public.fund_plans (
      project_id, source_local_id, title, description, image_url, plan_type,
      price, quantity_limit, per_person_limit, delivery_date,
      external_payment_url, external_application_url,
      required_information_note, requires_shipping, status, sort_order
    ) values (
      v_project_id, v_plan ->> 'id', v_plan ->> 'title',
      coalesce(v_plan ->> 'description', ''), coalesce(v_plan ->> 'imageUrl', ''),
      v_plan ->> 'planType', nullif(v_plan ->> 'price', '')::numeric,
      nullif(v_plan ->> 'quantityLimit', '')::integer,
      nullif(v_plan ->> 'perPersonLimit', '')::integer,
      nullif(v_plan ->> 'deliveryDate', '')::date,
      coalesce(v_plan ->> 'externalPaymentUrl', ''),
      coalesce(v_plan ->> 'externalApplicationUrl', ''),
      coalesce(v_plan ->> 'requiredInformationNote', ''),
      coalesce((v_plan ->> 'requiresShipping')::boolean, false),
      v_plan ->> 'status', coalesce((v_plan ->> 'sortOrder')::integer, 0)
    );
  end loop;

  return v_project_id;
end;
$$;

revoke all on function public.save_fund_project_content(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_fund_project_content(uuid, jsonb, jsonb) to authenticated, service_role;

do $$
declare
  v_project_id uuid;
begin
  for v_project_id in select id from public.fund_projects
  loop
    perform private.sync_fund_public_project(v_project_id);
  end loop;
end;
$$;

comment on table public.fund_projects is
  'Owner-private Fund project source of truth. Public clients must read fund_public_projects instead.';
comment on table public.fund_plans is
  'Owner-private Fund plans, including fields that are not always public.';
comment on table public.fund_public_projects is
  'Public-only Fund project content for cross-device profile and detail pages.';
comment on table public.fund_public_plans is
  'Public-safe Fund plans. Price is null unless the owner enabled amount display.';

notify pgrst, 'reload schema';
