-- Cover Community chat foreign-key paths for deletes and reply integrity.

create index if not exists community_chat_messages_community_idx
  on public.community_chat_messages (community_id);

create index if not exists community_chat_messages_room_community_idx
  on public.community_chat_messages (room_id, community_id);

create index if not exists community_chat_messages_reply_room_community_idx
  on public.community_chat_messages (reply_to_message_id, room_id, community_id);
