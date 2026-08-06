alter table public.community_rooms
  add column if not exists theme_color text not null default 'yellow'
  check (theme_color in ('blue', 'orange', 'yellow', 'pink', 'green'));

alter table public.community_posts
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id) on delete set null;

alter table public.community_comments
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists community_posts_active_room_created_idx
  on public.community_posts (room_id, created_at desc)
  where deleted_at is null;

create index if not exists community_comments_active_post_created_idx
  on public.community_comments (post_id, created_at)
  where deleted_at is null;

drop policy if exists "community members can read room catalog" on public.community_rooms;
create policy "community members can read accessible room catalog"
on public.community_rooms for select
to authenticated
using (community_private.can_access_room(id));

drop policy if exists "community users can read accessible posts" on public.community_posts;
create policy "community users can read accessible posts"
on public.community_posts for select
to authenticated
using (
  deleted_at is null
  and community_private.can_access_room(room_id)
  and (
    is_hidden = false
    or community_private.is_staff(community_id)
  )
);

drop policy if exists "community users can read accessible comments" on public.community_comments;
create policy "community users can read accessible comments"
on public.community_comments for select
to authenticated
using (
  deleted_at is null
  and is_hidden = false
  and exists (
    select 1 from public.community_posts p
    where p.id = community_comments.post_id
      and p.deleted_at is null
      and p.is_hidden = false
      and community_private.can_access_room(p.room_id)
  )
);

comment on column public.community_posts.deleted_at is
  'Soft-delete timestamp. Author deletion is retained for audit and recovery.';
comment on column public.community_comments.deleted_at is
  'Soft-delete timestamp. Author deletion is retained for audit and recovery.';
