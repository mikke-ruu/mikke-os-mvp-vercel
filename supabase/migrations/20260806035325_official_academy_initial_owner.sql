with initial_owner as (
  select c.id as community_id, (array_agg(m.user_id order by m.joined_at))[1] as user_id
  from public.community_communities c
  join public.community_memberships m
    on m.community_id = c.id
   and m.status = 'active'
  join auth.users u
    on u.id = m.user_id
   and u.email_confirmed_at is not null
  where c.slug = 'official-academy-community'
    and c.status = 'active'
    and c.join_mode = 'open_free'
    and c.owner_user_id is null
  group by c.id
  having count(*) = 1
)
update public.community_communities c
set owner_user_id = initial_owner.user_id
from initial_owner
where c.id = initial_owner.community_id;

update public.community_memberships m
set role = 'owner'
from public.community_communities c
where c.slug = 'official-academy-community'
  and c.owner_user_id = m.user_id
  and c.id = m.community_id
  and m.status = 'active';
