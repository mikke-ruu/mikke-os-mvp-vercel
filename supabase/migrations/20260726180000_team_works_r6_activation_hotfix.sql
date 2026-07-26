-- Team Works R6 hotfix: self-activation broke for anyone with an ARCHIVED
-- membership row. team_works_activate_portal_membership() inserted with a
-- fixed source_local_id ('directory:worker:<uid>'), which collides with the
-- archived row's identical source_local_id on the FULL unique constraint
-- (organization_id, source_local_id) -- and because the function runs at the
-- top of every portal load, both portals failed entirely with
-- "duplicate key ... organization_id_source_local__key".
--
-- Fix: make each activation's source_local_id unique with a timestamp suffix,
-- and add ON CONFLICT DO NOTHING so concurrent double-loads are harmless.
-- The (organization_id, user_id, role) partial unique index (WHERE status <>
-- 'archived') still guarantees at most one ACTIVE row per role.

create or replace function public.team_works_activate_portal_membership()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  uemail text;
  suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
begin
  if uid is null then
    return;
  end if;
  select lower(email) into uemail from auth.users where id = uid;
  if uemail is null then
    return;
  end if;

  insert into public.team_works_organization_members
    (organization_id, user_id, source_local_id, display_name, role, status)
  select p.organization_id, uid, 'directory:worker:' || uid::text || ':' || suffix, p.display_name, 'worker', 'active'
  from public.team_works_partners p
  where p.status = 'active'
    and lower(p.email) = uemail
    and not exists (
      select 1 from public.team_works_organization_members m
      where m.organization_id = p.organization_id
        and m.user_id = uid
        and m.role = 'worker'
        and m.status <> 'archived'
    )
  on conflict do nothing;

  insert into public.team_works_organization_members
    (organization_id, user_id, source_local_id, display_name, role, status)
  select c.organization_id, uid, 'directory:client:' || uid::text || ':' || suffix, c.display_name, 'client_user', 'active'
  from public.team_works_clients c
  where c.status = 'active'
    and lower(c.email) = uemail
    and not exists (
      select 1 from public.team_works_organization_members m
      where m.organization_id = c.organization_id
        and m.user_id = uid
        and m.role = 'client_user'
        and m.status <> 'archived'
    )
  on conflict do nothing;
end;
$$;

notify pgrst, 'reload schema';
