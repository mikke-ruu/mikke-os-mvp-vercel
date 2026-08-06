grant select (slug, name, description, join_mode, status)
  on table public.community_communities
  to anon;

drop policy if exists "community public can read active participant entries"
  on public.community_communities;
create policy "community public can read active participant entries"
on public.community_communities for select
to anon
using (status = 'active');
