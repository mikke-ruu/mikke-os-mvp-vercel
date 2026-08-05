drop policy if exists "community users can read accessible posts" on public.community_posts;

create policy "community users can read accessible posts"
on public.community_posts for select
to authenticated
using (
  community_private.can_access_room(room_id)
  and (
    is_hidden = false
    or community_private.is_staff(community_id)
  )
);
