-- Normalize legacy owner-role memberships without removing operating access.
-- The canonical owner is community_communities.owner_user_id; every additional
-- operator keeps staff access through the moderator role.

update public.community_memberships m
set role = 'moderator', updated_at = now()
from public.community_communities c
where c.id = m.community_id
  and m.role = 'owner'
  and m.user_id <> c.owner_user_id;
