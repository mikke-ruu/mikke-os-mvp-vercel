alter function public.community_touch_updated_at() set search_path = pg_catalog, public;

drop policy if exists "community users can update their own membership status" on public.community_memberships;
drop policy if exists "community staff can manage memberships" on public.community_memberships;
create policy "community users or staff can update memberships"
on public.community_memberships for update
to authenticated
using (
  (
    user_id = (select auth.uid())
    and role = 'member'
    and status in ('active', 'left')
  )
  or community_private.is_staff(community_id)
)
with check (
  (
    user_id = (select auth.uid())
    and role = 'member'
    and status in ('active', 'left')
  )
  or (
    community_private.is_staff(community_id)
    and role in ('owner', 'moderator', 'member')
    and status in ('active', 'suspended', 'left')
  )
);

drop policy if exists "community staff can manage rooms" on public.community_rooms;
create policy "community staff can insert rooms"
on public.community_rooms for insert
to authenticated
with check (community_private.is_staff(community_id));
create policy "community staff can update rooms"
on public.community_rooms for update
to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));
create policy "community staff can delete rooms"
on public.community_rooms for delete
to authenticated
using (community_private.is_staff(community_id));

drop policy if exists "community staff can manage entitlement definitions" on public.community_entitlement_definitions;
create policy "community staff can insert entitlement definitions"
on public.community_entitlement_definitions for insert
to authenticated
with check (community_private.is_staff(community_id));
create policy "community staff can update entitlement definitions"
on public.community_entitlement_definitions for update
to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));
create policy "community staff can delete entitlement definitions"
on public.community_entitlement_definitions for delete
to authenticated
using (community_private.is_staff(community_id));

drop policy if exists "community staff can manage entitlements" on public.community_member_entitlements;
create policy "community staff can insert entitlements"
on public.community_member_entitlements for insert
to authenticated
with check (
  community_private.is_staff(community_id)
  and source in ('manual', 'subscription', 'external')
);
create policy "community staff can update entitlements"
on public.community_member_entitlements for update
to authenticated
using (community_private.is_staff(community_id))
with check (
  community_private.is_staff(community_id)
  and source in ('manual', 'subscription', 'external')
);
create policy "community staff can delete entitlements"
on public.community_member_entitlements for delete
to authenticated
using (community_private.is_staff(community_id));

drop policy if exists "community staff can manage room entitlement rules" on public.community_room_entitlement_rules;
create policy "community staff can insert room entitlement rules"
on public.community_room_entitlement_rules for insert
to authenticated
with check (community_private.is_staff(community_id));
create policy "community staff can update room entitlement rules"
on public.community_room_entitlement_rules for update
to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));
create policy "community staff can delete room entitlement rules"
on public.community_room_entitlement_rules for delete
to authenticated
using (community_private.is_staff(community_id));

drop policy if exists "community owners can manage events" on public.community_events;
create policy "community staff can insert events"
on public.community_events for insert
to authenticated
with check (community_private.is_staff(community_id));
create policy "community staff can update events"
on public.community_events for update
to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));
create policy "community staff can delete events"
on public.community_events for delete
to authenticated
using (community_private.is_staff(community_id));

drop policy if exists "community owners can manage resources" on public.community_resources;
create policy "community staff can insert resources"
on public.community_resources for insert
to authenticated
with check (community_private.is_staff(community_id));
create policy "community staff can update resources"
on public.community_resources for update
to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));
create policy "community staff can delete resources"
on public.community_resources for delete
to authenticated
using (community_private.is_staff(community_id));
