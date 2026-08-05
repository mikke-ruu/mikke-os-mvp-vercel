drop policy if exists "community members can read room catalog" on public.community_rooms;

create policy "community members can read room catalog"
on public.community_rooms for select
to authenticated
using (
  community_private.is_active_member(community_id)
  and (
    is_archived = false
    or community_private.is_staff(community_id)
  )
);
