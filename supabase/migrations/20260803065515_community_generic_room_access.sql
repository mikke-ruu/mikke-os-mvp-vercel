create schema if not exists community_private;
revoke all on schema community_private from public;

alter table public.community_rooms
  add column if not exists access_type text not null default 'free'
  check (access_type in ('free', 'entitlement', 'staff'));

create unique index if not exists community_rooms_id_community_unique
  on public.community_rooms (id, community_id);

create table if not exists public.community_entitlement_definitions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9:_-]{1,79}$'),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, key)
);

create table if not exists public.community_member_entitlements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_key text not null,
  source text not null default 'manual' check (source in ('manual', 'subscription', 'external')),
  source_reference text,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, user_id, entitlement_key, source),
  foreign key (community_id, entitlement_key)
    references public.community_entitlement_definitions(community_id, key)
    on update cascade on delete restrict,
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.community_room_entitlement_rules (
  community_id uuid not null references public.community_communities(id) on delete cascade,
  room_id uuid not null,
  entitlement_key text not null,
  created_at timestamptz not null default now(),
  primary key (room_id, entitlement_key),
  foreign key (room_id, community_id)
    references public.community_rooms(id, community_id)
    on delete cascade,
  foreign key (community_id, entitlement_key)
    references public.community_entitlement_definitions(community_id, key)
    on update cascade on delete restrict
);

create index if not exists community_entitlement_definitions_community_status_idx
  on public.community_entitlement_definitions (community_id, status, key);
create index if not exists community_member_entitlements_user_access_idx
  on public.community_member_entitlements (community_id, user_id, status, starts_at, ends_at);
create index if not exists community_member_entitlements_key_idx
  on public.community_member_entitlements (community_id, entitlement_key, status);
create index if not exists community_room_entitlement_rules_community_idx
  on public.community_room_entitlement_rules (community_id, entitlement_key, room_id);

drop trigger if exists community_entitlement_definitions_touch_updated_at on public.community_entitlement_definitions;
create trigger community_entitlement_definitions_touch_updated_at
before update on public.community_entitlement_definitions
for each row execute function public.community_touch_updated_at();

drop trigger if exists community_member_entitlements_touch_updated_at on public.community_member_entitlements;
create trigger community_member_entitlements_touch_updated_at
before update on public.community_member_entitlements
for each row execute function public.community_touch_updated_at();

alter table public.community_entitlement_definitions enable row level security;
alter table public.community_member_entitlements enable row level security;
alter table public.community_room_entitlement_rules enable row level security;

grant select, insert, update, delete on public.community_entitlement_definitions to authenticated;
grant select, insert, update, delete on public.community_member_entitlements to authenticated;
grant select, insert, update, delete on public.community_room_entitlement_rules to authenticated;

create or replace function community_private.is_active_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.community_memberships m
      where m.community_id = p_community_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    );
$$;

create or replace function community_private.is_staff(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.community_communities c
        where c.id = p_community_id
          and c.owner_user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.community_memberships m
        where m.community_id = p_community_id
          and m.user_id = (select auth.uid())
          and m.status = 'active'
          and m.role in ('owner', 'moderator')
      )
    );
$$;

create or replace function community_private.can_access_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.community_rooms r
      where r.id = p_room_id
        and r.is_archived = false
        and exists (
          select 1
          from public.community_memberships m
          where m.community_id = r.community_id
            and m.user_id = (select auth.uid())
            and m.status = 'active'
        )
        and (
          exists (
            select 1
            from public.community_communities c
            where c.id = r.community_id
              and c.owner_user_id = (select auth.uid())
          )
          or exists (
            select 1
            from public.community_memberships staff_membership
            where staff_membership.community_id = r.community_id
              and staff_membership.user_id = (select auth.uid())
              and staff_membership.status = 'active'
              and staff_membership.role in ('owner', 'moderator')
          )
          or r.access_type = 'free'
          or (
            r.access_type = 'entitlement'
            and exists (
              select 1
              from public.community_room_entitlement_rules rule
              join public.community_member_entitlements entitlement
                on entitlement.community_id = rule.community_id
               and entitlement.entitlement_key = rule.entitlement_key
              where rule.room_id = r.id
                and entitlement.user_id = (select auth.uid())
                and entitlement.status = 'active'
                and entitlement.starts_at <= now()
                and (entitlement.ends_at is null or entitlement.ends_at > now())
            )
          )
        )
    );
$$;

revoke all on function community_private.is_active_member(uuid) from public;
revoke all on function community_private.is_staff(uuid) from public;
revoke all on function community_private.can_access_room(uuid) from public;
grant usage on schema community_private to authenticated;
grant execute on function community_private.is_active_member(uuid) to authenticated;
grant execute on function community_private.is_staff(uuid) to authenticated;
grant execute on function community_private.can_access_room(uuid) to authenticated;

drop policy if exists "community owners can update communities" on public.community_communities;
create policy "community owners can update communities"
on public.community_communities for update
to authenticated
using (
  community_private.is_staff(id)
  or (
    owner_user_id is null
    and community_private.is_active_member(id)
  )
)
with check (
  owner_user_id = (select auth.uid())
  or community_private.is_staff(id)
);

drop policy if exists "community users can read their own membership" on public.community_memberships;
create policy "community users and staff can read memberships"
on public.community_memberships for select
to authenticated
using (
  user_id = (select auth.uid())
  or community_private.is_staff(community_id)
);

create policy "community staff can manage memberships"
on public.community_memberships for update
to authenticated
using (community_private.is_staff(community_id))
with check (
  community_private.is_staff(community_id)
  and role in ('owner', 'moderator', 'member')
  and status in ('active', 'suspended', 'left')
);

drop policy if exists "community members can read rooms" on public.community_rooms;
create policy "community members can read room catalog"
on public.community_rooms for select
to authenticated
using (
  is_archived = false
  and community_private.is_active_member(community_id)
);

drop policy if exists "community owners can manage rooms" on public.community_rooms;
create policy "community staff can manage rooms"
on public.community_rooms for all
to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));

create policy "community members can read entitlement definitions"
on public.community_entitlement_definitions for select
to authenticated
using (
  status = 'active'
  and community_private.is_active_member(community_id)
);

create policy "community staff can manage entitlement definitions"
on public.community_entitlement_definitions for all
to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));

create policy "community users and staff can read entitlements"
on public.community_member_entitlements for select
to authenticated
using (
  user_id = (select auth.uid())
  or community_private.is_staff(community_id)
);

create policy "community staff can manage entitlements"
on public.community_member_entitlements for all
to authenticated
using (community_private.is_staff(community_id))
with check (
  community_private.is_staff(community_id)
  and source in ('manual', 'subscription', 'external')
);

create policy "community members can read room entitlement rules"
on public.community_room_entitlement_rules for select
to authenticated
using (community_private.is_active_member(community_id));

create policy "community staff can manage room entitlement rules"
on public.community_room_entitlement_rules for all
to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));

drop policy if exists "community members can read posts" on public.community_posts;
create policy "community users can read accessible posts"
on public.community_posts for select
to authenticated
using (
  is_hidden = false
  and community_private.can_access_room(room_id)
);

drop policy if exists "community members can create posts" on public.community_posts;
create policy "community users can create accessible posts"
on public.community_posts for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and community_private.can_access_room(room_id)
  and exists (
    select 1 from public.community_rooms r
    where r.id = room_id
      and r.community_id = community_posts.community_id
      and (r.member_can_post = true or community_private.is_staff(r.community_id))
  )
);

drop policy if exists "community authors can update their posts" on public.community_posts;
create policy "community authors can update accessible posts"
on public.community_posts for update
to authenticated
using (
  (author_user_id = (select auth.uid()) or community_private.is_staff(community_id))
  and community_private.can_access_room(room_id)
)
with check (
  (author_user_id = (select auth.uid()) or community_private.is_staff(community_id))
  and community_private.can_access_room(room_id)
);

drop policy if exists "community members can read comments" on public.community_comments;
create policy "community users can read accessible comments"
on public.community_comments for select
to authenticated
using (
  is_hidden = false
  and exists (
    select 1 from public.community_posts p
    where p.id = community_comments.post_id
      and p.is_hidden = false
      and community_private.can_access_room(p.room_id)
  )
);

drop policy if exists "community members can create comments" on public.community_comments;
create policy "community users can create accessible comments"
on public.community_comments for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_posts p
    join public.community_rooms r on r.id = p.room_id
    where p.id = community_comments.post_id
      and p.is_hidden = false
      and r.member_can_comment = true
      and community_private.can_access_room(r.id)
  )
);

drop policy if exists "community authors can update their comments" on public.community_comments;
create policy "community authors can update accessible comments"
on public.community_comments for update
to authenticated
using (
  author_user_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts p
    where p.id = community_comments.post_id
      and community_private.can_access_room(p.room_id)
  )
)
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts p
    where p.id = community_comments.post_id
      and community_private.can_access_room(p.room_id)
  )
);

insert into public.community_entitlement_definitions (community_id, key, name, description)
select id, 'paid:member', '有料メンバー', '有料・限定Roomを開放するための汎用利用権限'
from public.community_communities
where slug = 'official-academy-community'
on conflict (community_id, key) do nothing;
