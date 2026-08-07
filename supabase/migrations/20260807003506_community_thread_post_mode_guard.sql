-- Keep thread posts out of CHAT Rooms at the database boundary.

drop policy if exists "community users can create accessible posts"
  on public.community_posts;

create policy "community users can create accessible posts"
on public.community_posts for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and community_private.can_access_room(room_id)
  and exists (
    select 1 from public.community_rooms r
    where r.id = community_posts.room_id
      and r.community_id = community_posts.community_id
      and r.conversation_mode = 'thread'
      and (r.member_can_post = true or community_private.is_staff(r.community_id))
  )
);
