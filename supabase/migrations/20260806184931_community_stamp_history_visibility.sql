-- Keep previously sent stamps visible to members after operators hide them
-- from the send picker. Tenant isolation remains enforced by membership.

drop policy if exists "community members can read active stamps" on public.community_stamps;

create policy "community members can read tenant stamp history"
on public.community_stamps for select
to authenticated
using (community_private.is_active_member(community_id));
