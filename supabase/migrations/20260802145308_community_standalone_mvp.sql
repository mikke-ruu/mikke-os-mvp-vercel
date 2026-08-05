create extension if not exists pgcrypto;

create table if not exists public.community_communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  join_mode text not null default 'open_free' check (join_mode in ('open_free', 'invite_only', 'paid')),
  status text not null default 'active' check (status in ('active', 'archived')),
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  status text not null default 'active' check (status in ('active', 'suspended', 'left')),
  memo text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create table if not exists public.community_member_profiles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create table if not exists public.community_rooms (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'normal' check (kind in ('announcement', 'normal', 'question', 'event')),
  sort_order integer not null default 100,
  is_archived boolean not null default false,
  member_can_post boolean not null default true,
  member_can_comment boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  room_id uuid not null references public.community_rooms(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'normal' check (kind in ('announcement', 'normal', 'question')),
  url text,
  is_pinned boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_label text,
  external_url text,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.community_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.community_resources (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'web' check (kind in ('web', 'pdf', 'video', 'other')),
  external_url text not null,
  is_published boolean not null default true,
  sort_order integer not null default 100,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_memberships_community_user_idx on public.community_memberships(community_id, user_id);
create index if not exists community_memberships_user_idx on public.community_memberships(user_id);
create index if not exists community_member_profiles_community_user_idx on public.community_member_profiles(community_id, user_id);
create index if not exists community_rooms_community_sort_idx on public.community_rooms(community_id, is_archived, sort_order);
create index if not exists community_posts_community_created_idx on public.community_posts(community_id, is_hidden, is_pinned, created_at desc);
create index if not exists community_posts_room_created_idx on public.community_posts(room_id, is_hidden, created_at desc);
create index if not exists community_comments_post_created_idx on public.community_comments(post_id, is_hidden, created_at);
create index if not exists community_events_community_starts_idx on public.community_events(community_id, status, starts_at);
create index if not exists community_event_attendees_event_user_idx on public.community_event_attendees(event_id, user_id);
create index if not exists community_resources_community_sort_idx on public.community_resources(community_id, is_published, sort_order);

create or replace function public.community_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_communities_touch_updated_at on public.community_communities;
create trigger community_communities_touch_updated_at before update on public.community_communities for each row execute function public.community_touch_updated_at();
drop trigger if exists community_memberships_touch_updated_at on public.community_memberships;
create trigger community_memberships_touch_updated_at before update on public.community_memberships for each row execute function public.community_touch_updated_at();
drop trigger if exists community_member_profiles_touch_updated_at on public.community_member_profiles;
create trigger community_member_profiles_touch_updated_at before update on public.community_member_profiles for each row execute function public.community_touch_updated_at();
drop trigger if exists community_rooms_touch_updated_at on public.community_rooms;
create trigger community_rooms_touch_updated_at before update on public.community_rooms for each row execute function public.community_touch_updated_at();
drop trigger if exists community_posts_touch_updated_at on public.community_posts;
create trigger community_posts_touch_updated_at before update on public.community_posts for each row execute function public.community_touch_updated_at();
drop trigger if exists community_comments_touch_updated_at on public.community_comments;
create trigger community_comments_touch_updated_at before update on public.community_comments for each row execute function public.community_touch_updated_at();
drop trigger if exists community_events_touch_updated_at on public.community_events;
create trigger community_events_touch_updated_at before update on public.community_events for each row execute function public.community_touch_updated_at();
drop trigger if exists community_event_attendees_touch_updated_at on public.community_event_attendees;
create trigger community_event_attendees_touch_updated_at before update on public.community_event_attendees for each row execute function public.community_touch_updated_at();
drop trigger if exists community_resources_touch_updated_at on public.community_resources;
create trigger community_resources_touch_updated_at before update on public.community_resources for each row execute function public.community_touch_updated_at();

alter table public.community_communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_member_profiles enable row level security;
alter table public.community_rooms enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_events enable row level security;
alter table public.community_event_attendees enable row level security;
alter table public.community_resources enable row level security;

grant select, insert, update, delete on public.community_communities to authenticated;
grant select, insert, update, delete on public.community_memberships to authenticated;
grant select, insert, update, delete on public.community_member_profiles to authenticated;
grant select, insert, update, delete on public.community_rooms to authenticated;
grant select, insert, update, delete on public.community_posts to authenticated;
grant select, insert, update, delete on public.community_comments to authenticated;
grant select, insert, update, delete on public.community_events to authenticated;
grant select, insert, update, delete on public.community_event_attendees to authenticated;
grant select, insert, update, delete on public.community_resources to authenticated;

create policy "community authenticated can read active communities"
on public.community_communities for select
to authenticated
using (status = 'active' or owner_user_id = (select auth.uid()));

create policy "community owners can update communities"
on public.community_communities for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  or exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_communities.id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'moderator')
  )
)
with check (
  owner_user_id = (select auth.uid())
  or exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_communities.id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'moderator')
  )
);

create policy "community users can read their own membership"
on public.community_memberships for select
to authenticated
using (user_id = (select auth.uid()));

create policy "community users can join open free community"
on public.community_memberships for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and status = 'active'
  and exists (
    select 1
    from public.community_communities c
    where c.id = community_id
      and c.status = 'active'
      and c.join_mode = 'open_free'
  )
);

create policy "community users can update their own membership status"
on public.community_memberships for update
to authenticated
using (
  user_id = (select auth.uid())
  and role = 'member'
  and status in ('active', 'left')
)
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and status in ('active', 'left')
);

create policy "community members can read member profiles"
on public.community_member_profiles for select
to authenticated
using (
  exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_member_profiles.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community users can create their profile"
on public.community_member_profiles for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_member_profiles.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community users can update their profile"
on public.community_member_profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "community members can read rooms"
on public.community_rooms for select
to authenticated
using (
  is_archived = false
  and exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_rooms.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community owners can manage rooms"
on public.community_rooms for all
to authenticated
using (
  exists (
    select 1
    from public.community_communities c
    where c.id = community_rooms.community_id
      and c.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_rooms.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'moderator')
  )
)
with check (
  exists (
    select 1
    from public.community_communities c
    where c.id = community_rooms.community_id
      and c.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_rooms.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'moderator')
  )
);

create policy "community members can read posts"
on public.community_posts for select
to authenticated
using (
  is_hidden = false
  and exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_posts.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community members can create posts"
on public.community_posts for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_posts.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
  and exists (
    select 1
    from public.community_rooms r
    where r.id = room_id
      and r.community_id = community_posts.community_id
      and r.is_archived = false
      and r.member_can_post = true
  )
);

create policy "community authors can update their posts"
on public.community_posts for update
to authenticated
using (author_user_id = (select auth.uid()))
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_posts.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
  and exists (
    select 1
    from public.community_rooms r
    where r.id = room_id
      and r.community_id = community_posts.community_id
      and r.is_archived = false
  )
);

create policy "community members can read comments"
on public.community_comments for select
to authenticated
using (
  is_hidden = false
  and exists (
    select 1
    from public.community_posts p
    join public.community_memberships m on m.community_id = p.community_id
    where p.id = community_comments.post_id
      and p.is_hidden = false
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community members can create comments"
on public.community_comments for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_posts p
    join public.community_rooms r on r.id = p.room_id
    join public.community_memberships m on m.community_id = p.community_id
    where p.id = community_comments.post_id
      and p.is_hidden = false
      and r.member_can_comment = true
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community authors can update their comments"
on public.community_comments for update
to authenticated
using (author_user_id = (select auth.uid()))
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_posts p
    join public.community_memberships m on m.community_id = p.community_id
    where p.id = community_comments.post_id
      and p.is_hidden = false
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community members can read events"
on public.community_events for select
to authenticated
using (
  status <> 'cancelled'
  and exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_events.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community owners can manage events"
on public.community_events for all
to authenticated
using (
  exists (
    select 1
    from public.community_communities c
    where c.id = community_events.community_id
      and c.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_events.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'moderator')
  )
)
with check (
  exists (
    select 1
    from public.community_communities c
    where c.id = community_events.community_id
      and c.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_events.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'moderator')
  )
);

create policy "community users can read their event attendance"
on public.community_event_attendees for select
to authenticated
using (user_id = (select auth.uid()));

create policy "community users can set event attendance"
on public.community_event_attendees for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_events e
    join public.community_memberships m on m.community_id = e.community_id
    where e.id = community_event_attendees.event_id
      and e.status = 'open'
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community users can update event attendance"
on public.community_event_attendees for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "community members can read resources"
on public.community_resources for select
to authenticated
using (
  is_published = true
  and exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_resources.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "community owners can manage resources"
on public.community_resources for all
to authenticated
using (
  exists (
    select 1
    from public.community_communities c
    where c.id = community_resources.community_id
      and c.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_resources.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'moderator')
  )
)
with check (
  exists (
    select 1
    from public.community_communities c
    where c.id = community_resources.community_id
      and c.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.community_memberships m
    where m.community_id = community_resources.community_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'moderator')
  )
);

insert into public.community_communities (slug, name, description, join_mode, status)
values (
  'official-academy-community',
  'Official Academy COMMUNITY',
  'Free standalone community for app release notes, briefings, and certification course updates.',
  'open_free',
  'active'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  join_mode = excluded.join_mode,
  status = excluded.status;

with target as (
  select id from public.community_communities where slug = 'official-academy-community'
)
insert into public.community_rooms (community_id, title, description, kind, sort_order, member_can_post, member_can_comment)
select target.id, seed.title, seed.description, seed.kind, seed.sort_order, seed.member_can_post, seed.member_can_comment
from target
cross join (
  values
    ('Announcements', 'Important updates from the community owner.', 'announcement', 10, false, true),
    ('New App Updates', 'Release notes and improvement updates for new mikke apps.', 'announcement', 20, false, true),
    ('Briefings and Trials', 'Free briefings, trial sessions, and event information.', 'event', 30, true, true),
    ('Certification Courses', 'Recruitment, schedules, and preparation notes for certification courses.', 'announcement', 40, false, true),
    ('Member Lounge', 'Introductions and casual exchange between members.', 'normal', 50, true, true),
    ('Questions', 'Questions about courses, briefings, and new apps.', 'question', 60, true, true)
) as seed(title, description, kind, sort_order, member_can_post, member_can_comment)
where not exists (
  select 1
  from public.community_rooms r
  where r.community_id = target.id
    and r.title = seed.title
);

with target as (
  select id from public.community_communities where slug = 'official-academy-community'
)
insert into public.community_resources (community_id, title, description, kind, external_url, is_published, sort_order, published_at)
select id, 'Community operation memo', 'Initial standalone operation notes and later feature backlog.', 'web', 'https://example.com/community-start', true, 10, now()
from target
where not exists (
  select 1
  from public.community_resources r
  where r.community_id = target.id
    and r.title = 'Community operation memo'
);
