revoke all privileges
  on table public.community_communities
  from anon;

grant select (slug, name, description, join_mode, status)
  on table public.community_communities
  to anon;
