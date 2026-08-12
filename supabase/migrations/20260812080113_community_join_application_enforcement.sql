-- Apply only after the application code uses community_submit_join_application.
-- This closes the former direct membership-insert path for open communities.

drop policy if exists "community users can join or initialize owned community" on public.community_memberships;
create policy "community users can initialize owned community"
on public.community_memberships for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'active'
  and role = 'owner'
  and exists (
    select 1
    from public.community_communities c
    where c.id = community_id
      and c.owner_user_id = (select auth.uid())
  )
);
