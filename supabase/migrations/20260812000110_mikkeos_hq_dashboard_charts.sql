create view private.mikkeos_hq_dashboard_timeseries
with (security_barrier = true)
as
with days as (
  select generate_series(
    current_date - interval '29 days',
    current_date,
    interval '1 day'
  )::date as day
),
profile_counts as (
  select created_at::date as day, count(*)::bigint as new_profiles
  from public.profiles
  where created_at >= current_date - interval '29 days'
  group by created_at::date
),
activity_counts as (
  select
    occurred_at::date as day,
    count(distinct user_id)::bigint as active_users,
    count(*)::bigint as activity_records
  from public.activity_logs
  where occurred_at >= current_date - interval '29 days'
  group by occurred_at::date
)
select
  days.day,
  coalesce(profile_counts.new_profiles, 0)::bigint as new_profiles,
  coalesce(activity_counts.active_users, 0)::bigint as active_users,
  coalesce(activity_counts.activity_records, 0)::bigint as activity_records
from days
left join profile_counts using (day)
left join activity_counts using (day)
where exists (
  select 1
  from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
)
order by days.day;

revoke all on private.mikkeos_hq_dashboard_timeseries from public, anon;
grant select on private.mikkeos_hq_dashboard_timeseries to authenticated;

create view public.mikkeos_hq_dashboard_timeseries
with (security_invoker = true, security_barrier = true)
as
select day, new_profiles, active_users, activity_records
from private.mikkeos_hq_dashboard_timeseries;

revoke all on public.mikkeos_hq_dashboard_timeseries from public, anon;
grant select on public.mikkeos_hq_dashboard_timeseries to authenticated;
