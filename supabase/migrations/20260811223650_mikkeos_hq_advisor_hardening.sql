create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter view public.mikkeos_hq_dashboard_summary set schema private;
revoke all on private.mikkeos_hq_dashboard_summary from public, anon;
grant select on private.mikkeos_hq_dashboard_summary to authenticated;

create view public.mikkeos_hq_dashboard_summary
with (security_invoker = true, security_barrier = true)
as
select summary
from private.mikkeos_hq_dashboard_summary;

revoke all on public.mikkeos_hq_dashboard_summary from public, anon;
grant select on public.mikkeos_hq_dashboard_summary to authenticated;

drop policy "Published HQ announcements are public"
  on public.mikkeos_hq_announcements;
drop policy "HQ content staff can read all announcements"
  on public.mikkeos_hq_announcements;

create policy "Published HQ announcements are public"
on public.mikkeos_hq_announcements
for select
to anon
using (
  status = 'published'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

create policy "Authenticated users read permitted HQ announcements"
on public.mikkeos_hq_announcements
for select
to authenticated
using (
  (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  )
  or exists (
    select 1
    from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor', 'analyst')
  )
);

drop policy "Published HQ updates are public"
  on public.mikkeos_hq_updates;
drop policy "HQ content staff can read all updates"
  on public.mikkeos_hq_updates;

create policy "Published HQ updates are public"
on public.mikkeos_hq_updates
for select
to anon
using (status = 'published');

create policy "Authenticated users read permitted HQ updates"
on public.mikkeos_hq_updates
for select
to authenticated
using (
  status = 'published'
  or exists (
    select 1
    from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor', 'analyst')
  )
);
