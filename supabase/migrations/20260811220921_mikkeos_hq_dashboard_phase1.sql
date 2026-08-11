create table if not exists public.mikkeos_hq_staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'support', 'editor', 'analyst')),
  is_active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.mikkeos_hq_staff_members is
  'OS-wide headquarters authorization, separate from app memberships.';

alter table public.mikkeos_hq_staff_members enable row level security;

create policy "HQ staff can read permitted staff rows"
on public.mikkeos_hq_staff_members
for select
to authenticated
using (
  user_id = (select auth.uid())
);

grant select on public.mikkeos_hq_staff_members to authenticated;

create table if not exists public.mikkeos_hq_inquiries (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(trim(subject)) between 1 and 160),
  body text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  app_key text not null default 'mikkeos',
  category text not null default 'other',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting', 'resolved')),
  assigned_to uuid references auth.users(id) on delete set null,
  internal_note text not null default '',
  received_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mikkeos_hq_inquiries_status_received_idx
  on public.mikkeos_hq_inquiries(status, received_at desc);

alter table public.mikkeos_hq_inquiries enable row level security;

create policy "HQ support can read inquiries"
on public.mikkeos_hq_inquiries
for select
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'support')
));

create policy "HQ support can insert inquiries"
on public.mikkeos_hq_inquiries
for insert
to authenticated
with check (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'support')
));

create policy "HQ support can update inquiries"
on public.mikkeos_hq_inquiries
for update
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'support')
))
with check (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'support')
));

create policy "HQ admins can delete inquiries"
on public.mikkeos_hq_inquiries
for delete
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
));

grant select, insert, update, delete on public.mikkeos_hq_inquiries to authenticated;

create table if not exists public.mikkeos_hq_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null default '',
  audience text not null default 'all' check (audience in ('all', 'marketnote', 'story', 'community', 'academy', 'staff')),
  severity text not null default 'info' check (severity in ('info', 'important', 'maintenance', 'incident')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists mikkeos_hq_announcements_status_published_idx
  on public.mikkeos_hq_announcements(status, published_at desc);

alter table public.mikkeos_hq_announcements enable row level security;

create policy "Published HQ announcements are public"
on public.mikkeos_hq_announcements
for select
to anon, authenticated
using (
  status = 'published'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

create policy "HQ content staff can read all announcements"
on public.mikkeos_hq_announcements
for select
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'editor', 'analyst')
));

create policy "HQ content staff can insert announcements"
on public.mikkeos_hq_announcements
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'editor')
  )
);

create policy "HQ content staff can update announcements"
on public.mikkeos_hq_announcements
for update
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'editor')
))
with check (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'editor')
));

create policy "HQ admins can delete announcements"
on public.mikkeos_hq_announcements
for delete
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
));

grant select on public.mikkeos_hq_announcements to anon;
grant select, insert, delete on public.mikkeos_hq_announcements to authenticated;
grant update (title, body, audience, severity, status, starts_at, ends_at, published_at, updated_at)
  on public.mikkeos_hq_announcements to authenticated;

create table if not exists public.mikkeos_hq_updates (
  id uuid primary key default gen_random_uuid(),
  app_key text not null default 'mikkeos',
  version_label text not null default '',
  title text not null check (char_length(trim(title)) between 1 and 160),
  summary text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  released_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mikkeos_hq_updates_status_released_idx
  on public.mikkeos_hq_updates(status, released_at desc);

alter table public.mikkeos_hq_updates enable row level security;

create policy "Published HQ updates are public"
on public.mikkeos_hq_updates
for select
to anon, authenticated
using (status = 'published');

create policy "HQ content staff can read all updates"
on public.mikkeos_hq_updates
for select
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'editor', 'analyst')
));

create policy "HQ content staff can insert updates"
on public.mikkeos_hq_updates
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'editor')
  )
);

create policy "HQ content staff can update updates"
on public.mikkeos_hq_updates
for update
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'editor')
))
with check (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin', 'editor')
));

create policy "HQ admins can delete updates"
on public.mikkeos_hq_updates
for delete
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
));

grant select on public.mikkeos_hq_updates to anon;
grant select, insert, delete on public.mikkeos_hq_updates to authenticated;
grant update (app_key, version_label, title, summary, status, released_at, updated_at)
  on public.mikkeos_hq_updates to authenticated;

create table if not exists public.mikkeos_hq_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mikkeos_hq_audit_logs_created_idx
  on public.mikkeos_hq_audit_logs(created_at desc);

alter table public.mikkeos_hq_audit_logs enable row level security;

create policy "HQ admins can read audit logs"
on public.mikkeos_hq_audit_logs
for select
to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
));

create policy "HQ staff can write their own audit rows"
on public.mikkeos_hq_audit_logs
for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid()) and staff.is_active
  )
);

grant select, insert on public.mikkeos_hq_audit_logs to authenticated;
grant usage, select on sequence public.mikkeos_hq_audit_logs_id_seq to authenticated;

create rule mikkeos_hq_inquiries_audit_insert as on insert to public.mikkeos_hq_inquiries do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'insert', 'mikkeos_hq_inquiries', new.id, jsonb_build_object('status', new.status));

create rule mikkeos_hq_inquiries_audit_update as on update to public.mikkeos_hq_inquiries do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'update', 'mikkeos_hq_inquiries', new.id, jsonb_build_object('status', new.status));

create rule mikkeos_hq_inquiries_audit_delete as on delete to public.mikkeos_hq_inquiries do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'delete', 'mikkeos_hq_inquiries', old.id, jsonb_build_object('status', old.status));

create rule mikkeos_hq_announcements_audit_insert as on insert to public.mikkeos_hq_announcements do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'insert', 'mikkeos_hq_announcements', new.id, jsonb_build_object('status', new.status));

create rule mikkeos_hq_announcements_audit_update as on update to public.mikkeos_hq_announcements do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'update', 'mikkeos_hq_announcements', new.id, jsonb_build_object('status', new.status));

create rule mikkeos_hq_announcements_audit_delete as on delete to public.mikkeos_hq_announcements do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'delete', 'mikkeos_hq_announcements', old.id, jsonb_build_object('status', old.status));

create rule mikkeos_hq_updates_audit_insert as on insert to public.mikkeos_hq_updates do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'insert', 'mikkeos_hq_updates', new.id, jsonb_build_object('status', new.status));

create rule mikkeos_hq_updates_audit_update as on update to public.mikkeos_hq_updates do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'update', 'mikkeos_hq_updates', new.id, jsonb_build_object('status', new.status));

create rule mikkeos_hq_updates_audit_delete as on delete to public.mikkeos_hq_updates do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'delete', 'mikkeos_hq_updates', old.id, jsonb_build_object('status', old.status));

create or replace view public.mikkeos_hq_dashboard_summary
with (security_barrier = true)
as
select jsonb_build_object(
  'profiles_total', (select count(*) from public.profiles),
  'profiles_new_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
  'story_users', (select count(distinct owner_user_id) from public.story_profiles),
  'community_active_users', (select count(distinct user_id) from public.community_memberships where status = 'active'),
  'marketnote_users', (select count(distinct user_id) from public.market_events),
  'active_users_30d', (select count(distinct user_id) from public.activity_logs where occurred_at >= now() - interval '30 days'),
  'inquiries_open', (select count(*) from public.mikkeos_hq_inquiries where status <> 'resolved'),
  'inquiries_urgent', (select count(*) from public.mikkeos_hq_inquiries where status <> 'resolved' and priority = 'urgent'),
  'announcement_drafts', (select count(*) from public.mikkeos_hq_announcements where status in ('draft', 'scheduled')),
  'updates_drafts', (select count(*) from public.mikkeos_hq_updates where status = 'draft')
) as summary
where exists (
  select 1
  from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
);

revoke all on public.mikkeos_hq_dashboard_summary from public, anon;
grant select on public.mikkeos_hq_dashboard_summary to authenticated;

insert into public.mikkeos_hq_staff_members (user_id, role, is_active)
select id, 'owner', true
from auth.users
where lower(email) = lower('joes.style.a@gmail.com')
on conflict (user_id) do update
set role = 'owner', is_active = true, updated_at = now();
