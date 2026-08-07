-- Tenant logo and banner are part of the deliberately public participant entry.
-- Keep anon access column-scoped; no owner or membership fields are exposed.
grant select (logo_url, banner_url)
  on table public.community_communities
  to anon;
