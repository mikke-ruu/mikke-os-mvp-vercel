-- Community thread reactions for posts and comments.

create unique index if not exists community_posts_id_room_community_unique
  on public.community_posts (id, room_id, community_id);
create unique index if not exists community_comments_id_post_unique
  on public.community_comments (id, post_id);

create table if not exists public.community_post_reactions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  room_id uuid not null,
  post_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  foreign key (post_id, room_id, community_id)
    references public.community_posts(id, room_id, community_id) on delete cascade,
  unique (post_id, user_id, emoji)
);

create index if not exists community_post_reactions_room_created_idx
  on public.community_post_reactions (room_id, created_at desc);
create index if not exists community_post_reactions_user_idx
  on public.community_post_reactions (user_id);

create table if not exists public.community_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  room_id uuid not null,
  post_id uuid not null,
  comment_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  foreign key (post_id, room_id, community_id)
    references public.community_posts(id, room_id, community_id) on delete cascade,
  foreign key (comment_id, post_id)
    references public.community_comments(id, post_id) on delete cascade,
  unique (comment_id, user_id, emoji)
);

create index if not exists community_comment_reactions_room_created_idx
  on public.community_comment_reactions (room_id, created_at desc);
create index if not exists community_comment_reactions_post_idx
  on public.community_comment_reactions (post_id);
create index if not exists community_comment_reactions_user_idx
  on public.community_comment_reactions (user_id);

alter table public.community_post_reactions enable row level security;
alter table public.community_comment_reactions enable row level security;

revoke all on public.community_post_reactions from anon, authenticated;
revoke all on public.community_comment_reactions from anon, authenticated;
grant select, insert, delete on public.community_post_reactions to authenticated;
grant select, insert, delete on public.community_comment_reactions to authenticated;

create policy "community users can read accessible post reactions"
on public.community_post_reactions for select
to authenticated
using (
  exists (
    select 1 from public.community_posts post
    where post.id = community_post_reactions.post_id
      and post.room_id = community_post_reactions.room_id
      and post.community_id = community_post_reactions.community_id
      and post.deleted_at is null
      and post.is_hidden = false
      and community_private.can_access_room(post.room_id)
  )
);

create policy "community users can add accessible post reactions"
on public.community_post_reactions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts post
    where post.id = community_post_reactions.post_id
      and post.room_id = community_post_reactions.room_id
      and post.community_id = community_post_reactions.community_id
      and post.deleted_at is null
      and post.is_hidden = false
      and community_private.can_access_room(post.room_id)
  )
);

create policy "community users can remove own post reactions"
on public.community_post_reactions for delete
to authenticated
using (user_id = (select auth.uid()) and community_private.can_access_room(room_id));

create policy "community users can read accessible comment reactions"
on public.community_comment_reactions for select
to authenticated
using (
  exists (
    select 1
    from public.community_comments comment
    join public.community_posts post on post.id = comment.post_id
    where comment.id = community_comment_reactions.comment_id
      and comment.post_id = community_comment_reactions.post_id
      and post.room_id = community_comment_reactions.room_id
      and post.community_id = community_comment_reactions.community_id
      and comment.deleted_at is null
      and comment.is_hidden = false
      and post.deleted_at is null
      and post.is_hidden = false
      and community_private.can_access_room(post.room_id)
  )
);

create policy "community users can add accessible comment reactions"
on public.community_comment_reactions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_comments comment
    join public.community_posts post on post.id = comment.post_id
    where comment.id = community_comment_reactions.comment_id
      and comment.post_id = community_comment_reactions.post_id
      and post.room_id = community_comment_reactions.room_id
      and post.community_id = community_comment_reactions.community_id
      and comment.deleted_at is null
      and comment.is_hidden = false
      and post.deleted_at is null
      and post.is_hidden = false
      and community_private.can_access_room(post.room_id)
  )
);

create policy "community users can remove own comment reactions"
on public.community_comment_reactions for delete
to authenticated
using (user_id = (select auth.uid()) and community_private.can_access_room(room_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_post_reactions'
  ) then
    alter publication supabase_realtime add table public.community_post_reactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_comment_reactions'
  ) then
    alter publication supabase_realtime add table public.community_comment_reactions;
  end if;
end
$$;
