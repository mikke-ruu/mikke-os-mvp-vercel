-- Community phase 3A: tenant-safe realtime chat rooms.

alter table public.community_rooms
  add column if not exists conversation_mode text not null default 'thread'
    check (conversation_mode in ('thread', 'chat'));

comment on column public.community_rooms.conversation_mode is
  'Presentation and interaction mode. Access and writing permissions remain separate.';

create unique index if not exists community_rooms_id_community_unique
  on public.community_rooms (id, community_id);

create table if not exists public.community_chat_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  room_id uuid not null,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  reply_to_message_id uuid,
  stamp_id uuid references public.community_stamps(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  is_hidden boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (room_id, community_id)
    references public.community_rooms(id, community_id) on delete cascade
);

create unique index if not exists community_chat_messages_id_room_community_unique
  on public.community_chat_messages (id, room_id, community_id);

alter table public.community_chat_messages
  add constraint community_chat_messages_reply_same_room_fk
  foreign key (reply_to_message_id, room_id, community_id)
  references public.community_chat_messages(id, room_id, community_id);

create index if not exists community_chat_messages_room_created_idx
  on public.community_chat_messages (room_id, created_at)
  where deleted_at is null;
create index if not exists community_chat_messages_author_idx
  on public.community_chat_messages (author_user_id);
create index if not exists community_chat_messages_reply_idx
  on public.community_chat_messages (reply_to_message_id)
  where reply_to_message_id is not null;
create index if not exists community_chat_messages_stamp_idx
  on public.community_chat_messages (stamp_id)
  where stamp_id is not null;
create index if not exists community_chat_messages_deleted_by_idx
  on public.community_chat_messages (deleted_by_user_id)
  where deleted_by_user_id is not null;

drop trigger if exists community_chat_messages_touch_updated_at on public.community_chat_messages;
create trigger community_chat_messages_touch_updated_at
before update on public.community_chat_messages
for each row execute function public.community_touch_updated_at();

create or replace function community_private.guard_chat_message_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, community_private
as $$
begin
  if new.id is distinct from old.id
    or new.community_id is distinct from old.community_id
    or new.room_id is distinct from old.room_id
    or new.author_user_id is distinct from old.author_user_id
    or new.reply_to_message_id is distinct from old.reply_to_message_id
    or new.stamp_id is distinct from old.stamp_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Chat message identity cannot be changed';
  end if;

  if new.is_hidden is distinct from old.is_hidden
    and not community_private.is_staff(old.community_id) then
    raise exception 'Only Community staff can moderate chat messages';
  end if;

  if (select auth.uid()) is distinct from old.author_user_id
    and (
      new.body is distinct from old.body
      or new.edited_at is distinct from old.edited_at
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by_user_id is distinct from old.deleted_by_user_id
    ) then
    raise exception 'Community staff can moderate but cannot rewrite a member message';
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    if old.deleted_at is not null
      or new.deleted_at is null
      or new.deleted_by_user_id is distinct from (select auth.uid()) then
      raise exception 'Chat message deletion is invalid';
    end if;
  elsif new.deleted_by_user_id is distinct from old.deleted_by_user_id then
    raise exception 'Chat message deletion audit cannot be changed separately';
  end if;

  return new;
end;
$$;

drop trigger if exists community_chat_messages_guard_update on public.community_chat_messages;
create trigger community_chat_messages_guard_update
before update on public.community_chat_messages
for each row execute function community_private.guard_chat_message_update();

alter table public.community_chat_messages enable row level security;
revoke all on public.community_chat_messages from anon, authenticated;
grant select, insert, update on public.community_chat_messages to authenticated;

create policy "community users can read accessible chat messages"
on public.community_chat_messages for select
to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.community_rooms r
    where r.id = community_chat_messages.room_id
      and r.community_id = community_chat_messages.community_id
      and r.conversation_mode = 'chat'
      and community_private.can_access_room(r.id)
      and (community_chat_messages.is_hidden = false or community_private.is_staff(r.community_id))
  )
);

create policy "community users can create accessible chat messages"
on public.community_chat_messages for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and is_hidden = false
  and deleted_at is null
  and deleted_by_user_id is null
  and exists (
    select 1 from public.community_rooms r
    where r.id = community_chat_messages.room_id
      and r.community_id = community_chat_messages.community_id
      and r.conversation_mode = 'chat'
      and r.is_archived = false
      and community_private.can_access_room(r.id)
      and (r.member_can_comment = true or community_private.is_staff(r.community_id))
  )
  and (
    stamp_id is null
    or exists (
      select 1 from public.community_stamps s
      where s.id = community_chat_messages.stamp_id
        and s.community_id = community_chat_messages.community_id
        and s.is_active = true
    )
  )
);

create policy "community authors and staff can update chat messages"
on public.community_chat_messages for update
to authenticated
using (
  (author_user_id = (select auth.uid()) or community_private.is_staff(community_id))
  and exists (
    select 1 from public.community_rooms r
    where r.id = community_chat_messages.room_id
      and r.community_id = community_chat_messages.community_id
      and r.conversation_mode = 'chat'
      and community_private.can_access_room(r.id)
  )
)
with check (
  (author_user_id = (select auth.uid()) or community_private.is_staff(community_id))
  and exists (
    select 1 from public.community_rooms r
    where r.id = community_chat_messages.room_id
      and r.community_id = community_chat_messages.community_id
      and r.conversation_mode = 'chat'
      and community_private.can_access_room(r.id)
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_chat_messages'
  ) then
    alter publication supabase_realtime add table public.community_chat_messages;
  end if;
end;
$$;
