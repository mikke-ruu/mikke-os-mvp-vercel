-- Permit authors and staff to address their own deleted rows while keeping
-- deleted chat messages invisible to other members. The client still filters
-- deleted rows from the normal timeline.

drop policy if exists "community users can read accessible chat messages"
  on public.community_chat_messages;

create policy "community users can read accessible chat messages"
on public.community_chat_messages for select
to authenticated
using (
  exists (
    select 1 from public.community_rooms r
    where r.id = community_chat_messages.room_id
      and r.community_id = community_chat_messages.community_id
      and r.conversation_mode = 'chat'
      and community_private.can_access_room(r.id)
      and (
        community_chat_messages.deleted_at is null
        or community_chat_messages.author_user_id = (select auth.uid())
        or community_private.is_staff(r.community_id)
      )
      and (
        community_chat_messages.is_hidden = false
        or community_private.is_staff(r.community_id)
      )
  )
);
