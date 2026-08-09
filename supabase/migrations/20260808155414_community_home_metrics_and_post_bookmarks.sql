-- Community HOME metric customization and private post bookmarks.

alter table public.community_communities
  add column if not exists home_metric_1 text not null default 'unread',
  add column if not exists home_metric_2 text not null default 'today_activity',
  add column if not exists home_metric_3 text not null default 'upcoming_events';

alter table public.community_communities
  drop constraint if exists community_communities_home_metrics_valid;
alter table public.community_communities
  add constraint community_communities_home_metrics_valid check (
    home_metric_1 in ('unread', 'today_activity', 'upcoming_events', 'rooms', 'posts', 'comments', 'chat_messages', 'resources')
    and home_metric_2 in ('unread', 'today_activity', 'upcoming_events', 'rooms', 'posts', 'comments', 'chat_messages', 'resources')
    and home_metric_3 in ('unread', 'today_activity', 'upcoming_events', 'rooms', 'posts', 'comments', 'chat_messages', 'resources')
    and home_metric_1 <> home_metric_2
    and home_metric_1 <> home_metric_3
    and home_metric_2 <> home_metric_3
  );

create table if not exists public.community_post_bookmarks (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  room_id uuid not null,
  post_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (post_id, room_id, community_id)
    references public.community_posts(id, room_id, community_id) on delete cascade,
  unique (post_id, user_id)
);

create index if not exists community_post_bookmarks_user_community_created_idx
  on public.community_post_bookmarks (user_id, community_id, created_at desc);
create index if not exists community_post_bookmarks_post_room_community_idx
  on public.community_post_bookmarks (post_id, room_id, community_id);

alter table public.community_post_bookmarks enable row level security;

revoke all on public.community_post_bookmarks from anon, authenticated;
grant select, insert, delete on public.community_post_bookmarks to authenticated;

create policy "community users can read own accessible post bookmarks"
on public.community_post_bookmarks for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts post
    where post.id = community_post_bookmarks.post_id
      and post.room_id = community_post_bookmarks.room_id
      and post.community_id = community_post_bookmarks.community_id
      and post.deleted_at is null
      and post.is_hidden = false
      and community_private.can_access_room(post.room_id)
  )
);

create policy "community users can add own accessible post bookmarks"
on public.community_post_bookmarks for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts post
    where post.id = community_post_bookmarks.post_id
      and post.room_id = community_post_bookmarks.room_id
      and post.community_id = community_post_bookmarks.community_id
      and post.deleted_at is null
      and post.is_hidden = false
      and community_private.can_access_room(post.room_id)
  )
);

create policy "community users can remove own post bookmarks"
on public.community_post_bookmarks for delete
to authenticated
using (user_id = (select auth.uid()));
