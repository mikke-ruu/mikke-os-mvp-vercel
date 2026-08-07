-- Cover composite foreign keys reported by the database advisor.

create index if not exists community_chat_reactions_message_room_community_idx
  on public.community_chat_message_reactions (message_id, room_id, community_id);

create index if not exists community_room_reads_room_community_idx
  on public.community_room_reads (room_id, community_id);
