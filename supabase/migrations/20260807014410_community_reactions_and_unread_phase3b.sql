-- Community phase 3B: message reactions and per-member Room read state.

create table if not exists public.community_chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  room_id uuid not null,
  message_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  foreign key (message_id, room_id, community_id)
    references public.community_chat_messages(id, room_id, community_id) on delete cascade,
  unique (message_id, user_id, emoji)
);

create index if not exists community_chat_reactions_room_idx
  on public.community_chat_message_reactions (room_id, created_at);
create index if not exists community_chat_reactions_community_idx
  on public.community_chat_message_reactions (community_id);
create index if not exists community_chat_reactions_user_idx
  on public.community_chat_message_reactions (user_id);

alter table public.community_chat_message_reactions enable row level security;
revoke all on public.community_chat_message_reactions from anon, authenticated;
grant select, insert, delete on public.community_chat_message_reactions to authenticated;

create policy "community users can read accessible chat reactions"
on public.community_chat_message_reactions for select
to authenticated
using (
  exists (
    select 1 from public.community_chat_messages message
    where message.id = community_chat_message_reactions.message_id
      and message.room_id = community_chat_message_reactions.room_id
      and message.community_id = community_chat_message_reactions.community_id
      and message.deleted_at is null
      and message.is_hidden = false
      and community_private.can_access_room(message.room_id)
  )
);

create policy "community users can add accessible chat reactions"
on public.community_chat_message_reactions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.community_chat_messages message
    where message.id = community_chat_message_reactions.message_id
      and message.room_id = community_chat_message_reactions.room_id
      and message.community_id = community_chat_message_reactions.community_id
      and message.deleted_at is null
      and message.is_hidden = false
      and community_private.can_access_room(message.room_id)
  )
);

create policy "community users can remove own chat reactions"
on public.community_chat_message_reactions for delete
to authenticated
using (
  user_id = (select auth.uid())
  and community_private.can_access_room(room_id)
);

create table if not exists public.community_room_reads (
  community_id uuid not null references public.community_communities(id) on delete cascade,
  room_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (community_id, room_id, user_id),
  foreign key (room_id, community_id)
    references public.community_rooms(id, community_id) on delete cascade
);

create index if not exists community_room_reads_room_idx
  on public.community_room_reads (room_id, last_seen_at);
create index if not exists community_room_reads_user_idx
  on public.community_room_reads (user_id, community_id);

alter table public.community_room_reads enable row level security;
revoke all on public.community_room_reads from anon, authenticated;
grant select, insert, update on public.community_room_reads to authenticated;

create policy "community users can read own room state"
on public.community_room_reads for select
to authenticated
using (
  user_id = (select auth.uid())
  and community_private.can_access_room(room_id)
);

create policy "community users can create own accessible room state"
on public.community_room_reads for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and community_private.can_access_room(room_id)
);

create policy "community users can update own accessible room state"
on public.community_room_reads for update
to authenticated
using (
  user_id = (select auth.uid())
  and community_private.can_access_room(room_id)
)
with check (
  user_id = (select auth.uid())
  and community_private.can_access_room(room_id)
);

-- Existing members start with a clean unread state at rollout time.
insert into public.community_room_reads (community_id, room_id, user_id, last_seen_at)
select membership.community_id, room.id, membership.user_id, now()
from public.community_memberships membership
join public.community_rooms room on room.community_id = membership.community_id
where membership.status = 'active'
on conflict (community_id, room_id, user_id) do nothing;
