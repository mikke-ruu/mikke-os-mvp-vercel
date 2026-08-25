-- Academy monthly billing ledger. This migration calculates an immutable
-- quantity/price snapshot only; it does not create Stripe products, invoices,
-- subscriptions, or production schedules.

create table public.academy_instructor_billing_exclusions (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  constraint academy_instructor_billing_exclusions_window_check check (
    effective_until is null or effective_until > effective_from
  )
);

create index academy_instructor_billing_exclusions_lookup_idx
  on public.academy_instructor_billing_exclusions(
    headquarters_id, profile_id, effective_from, effective_until
  );

alter table public.academy_instructor_billing_exclusions enable row level security;
revoke all on table public.academy_instructor_billing_exclusions
  from public, anon, authenticated;
grant all on table public.academy_instructor_billing_exclusions to service_role;

create table public.academy_monthly_billing_snapshots (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  snapshot_month date not null,
  cutoff_at timestamptz not null,
  captured_at timestamptz not null,
  registered_instructor_count integer not null,
  billable_profile_ids uuid[] not null,
  catalog_price_yen integer not null,
  charge_month date not null,
  charge_price_yen integer not null,
  price_notice_required boolean not null default false,
  pricing_rule_version text not null default 'academy_early_access_v1',
  created_at timestamptz not null default now(),
  constraint academy_monthly_billing_snapshots_month_start_check check (
    snapshot_month = date_trunc('month', snapshot_month)::date
    and charge_month = (snapshot_month + interval '1 month')::date
  ),
  constraint academy_monthly_billing_snapshots_count_check check (
    registered_instructor_count >= 0
    and cardinality(billable_profile_ids) = registered_instructor_count
  ),
  constraint academy_monthly_billing_snapshots_price_check check (
    catalog_price_yen >= 0 and charge_price_yen >= 0
  ),
  constraint academy_monthly_billing_snapshots_unique unique (
    headquarters_id, snapshot_month
  )
);

create index academy_monthly_billing_snapshots_hq_month_idx
  on public.academy_monthly_billing_snapshots(headquarters_id, snapshot_month desc);

alter table public.academy_monthly_billing_snapshots enable row level security;
revoke all on table public.academy_monthly_billing_snapshots
  from public, anon, authenticated;
grant all on table public.academy_monthly_billing_snapshots to service_role;

create or replace function private.academy_catalog_monthly_price_yen(
  p_instructor_count integer
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_instructor_count is null or p_instructor_count < 0 then
    raise exception 'academy_instructor_count_invalid';
  end if;
  if p_instructor_count <= 20 then
    return 5000;
  elsif p_instructor_count <= 50 then
    return 10000;
  elsif p_instructor_count <= 200 then
    return 20000;
  end if;
  return 20000 + ((p_instructor_count - 200) * 100);
end;
$$;

revoke all on function private.academy_catalog_monthly_price_yen(integer)
  from public, anon, authenticated;

create or replace function private.academy_block_billing_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'academy_billing_snapshot_is_immutable';
end;
$$;

revoke all on function private.academy_block_billing_snapshot_mutation()
  from public, anon, authenticated;

create trigger academy_block_billing_snapshot_update
before update on public.academy_monthly_billing_snapshots
for each row execute function private.academy_block_billing_snapshot_mutation();

create trigger academy_block_billing_snapshot_delete
before delete on public.academy_monthly_billing_snapshots
for each row execute function private.academy_block_billing_snapshot_mutation();

create or replace function public.academy_capture_month_end_billing_snapshot(
  p_headquarters_id uuid,
  p_snapshot_month date,
  p_captured_at timestamptz default now()
)
returns public.academy_monthly_billing_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot public.academy_monthly_billing_snapshots%rowtype;
  v_previous public.academy_monthly_billing_snapshots%rowtype;
  v_cutoff timestamptz;
  v_profile_ids uuid[];
  v_count integer;
  v_catalog_price integer;
  v_charge_price integer;
  v_notice_required boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'academy_billing_service_role_required';
  end if;
  if p_headquarters_id is null
    or p_snapshot_month is null
    or p_snapshot_month <> date_trunc('month', p_snapshot_month)::date then
    raise exception 'academy_billing_snapshot_month_invalid';
  end if;
  if not exists (
    select 1 from public.academy_headquarters headquarters
    where headquarters.id = p_headquarters_id
  ) then
    raise exception 'academy_headquarters_not_found';
  end if;

  -- Midnight at the start of the following month is the exact instant after
  -- 23:59:59.999... in Asia/Tokyo, and is safe across delayed capture jobs.
  v_cutoff := ((p_snapshot_month + interval '1 month')::timestamp
    at time zone 'Asia/Tokyo');
  if p_captured_at < v_cutoff or p_captured_at > now() + interval '5 minutes' then
    raise exception 'academy_billing_snapshot_capture_time_invalid';
  end if;

  select * into v_snapshot
  from public.academy_monthly_billing_snapshots snapshot
  where snapshot.headquarters_id = p_headquarters_id
    and snapshot.snapshot_month = p_snapshot_month;
  if found then
    return v_snapshot;
  end if;

  select coalesce(array_agg(profile_id order by profile_id), '{}'::uuid[])
  into v_profile_ids
  from (
    select distinct instructor.profile_id
    from public.academy_instructors instructor
    where instructor.headquarters_id = p_headquarters_id
      and instructor.created_at < v_cutoff
      and (instructor.withdrawn_at is null or instructor.withdrawn_at >= v_cutoff)
      and not exists (
        select 1
        from public.academy_instructor_billing_exclusions exclusion
        where exclusion.headquarters_id = instructor.headquarters_id
          and exclusion.profile_id = instructor.profile_id
          and exclusion.effective_from < v_cutoff
          and (
            exclusion.effective_until is null
            or exclusion.effective_until >= v_cutoff
          )
      )
  ) billable;

  v_count := cardinality(v_profile_ids);
  v_catalog_price := private.academy_catalog_monthly_price_yen(v_count);

  select * into v_previous
  from public.academy_monthly_billing_snapshots snapshot
  where snapshot.headquarters_id = p_headquarters_id
    and snapshot.snapshot_month = (p_snapshot_month - interval '1 month')::date;

  if v_previous.id is not null and (
    (v_previous.registered_instructor_count <= 20 and v_count > 20)
    or (v_previous.registered_instructor_count <= 50 and v_count > 50)
  ) then
    -- 21/51 reached: keep the already-announced amount for the coming month,
    -- notify during that month, and let the next month-end snapshot apply the
    -- higher amount only if the count remains above the boundary.
    v_charge_price := v_previous.charge_price_yen;
    v_notice_required := true;
  else
    v_charge_price := v_catalog_price;
  end if;

  insert into public.academy_monthly_billing_snapshots (
    headquarters_id,
    snapshot_month,
    cutoff_at,
    captured_at,
    registered_instructor_count,
    billable_profile_ids,
    catalog_price_yen,
    charge_month,
    charge_price_yen,
    price_notice_required
  ) values (
    p_headquarters_id,
    p_snapshot_month,
    v_cutoff,
    p_captured_at,
    v_count,
    v_profile_ids,
    v_catalog_price,
    (p_snapshot_month + interval '1 month')::date,
    v_charge_price,
    v_notice_required
  )
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;

revoke all on function public.academy_capture_month_end_billing_snapshot(
  uuid, date, timestamptz
) from public, anon, authenticated;
grant execute on function public.academy_capture_month_end_billing_snapshot(
  uuid, date, timestamptz
) to service_role;

create or replace function public.academy_get_my_billing_snapshot(
  p_headquarters_id uuid,
  p_snapshot_month date default null
)
returns table (
  headquarters_id uuid,
  snapshot_month date,
  cutoff_at timestamptz,
  captured_at timestamptz,
  registered_instructor_count integer,
  catalog_price_yen integer,
  charge_month date,
  charge_price_yen integer,
  price_notice_required boolean,
  pricing_rule_version text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or private.academy_headquarters_role(
      p_headquarters_id,
      (select auth.uid())
    ) is distinct from 'owner' then
    raise exception 'academy_billing_owner_required';
  end if;

  return query
  select
    snapshot.headquarters_id,
    snapshot.snapshot_month,
    snapshot.cutoff_at,
    snapshot.captured_at,
    snapshot.registered_instructor_count,
    snapshot.catalog_price_yen,
    snapshot.charge_month,
    snapshot.charge_price_yen,
    snapshot.price_notice_required,
    snapshot.pricing_rule_version
  from public.academy_monthly_billing_snapshots snapshot
  where snapshot.headquarters_id = p_headquarters_id
    and (p_snapshot_month is null or snapshot.snapshot_month = p_snapshot_month)
  order by snapshot.snapshot_month desc
  limit case when p_snapshot_month is null then 1 else 1 end;
end;
$$;

revoke all on function public.academy_get_my_billing_snapshot(uuid, date)
  from public, anon;
grant execute on function public.academy_get_my_billing_snapshot(uuid, date)
  to authenticated;
