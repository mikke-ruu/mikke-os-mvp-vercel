-- Team Works R6: fixed-URL portal onboarding.
--
-- Ayumi's workflow: register a partner/client in the directory (email + name),
-- hand them ONE fixed portal URL (not a per-project invite link), and let them
-- log in (or sign up) with their own mikkeOS account. The link between "this
-- logged-in account" and "the person we registered" is the email address.
--
-- This RPC self-activates the caller: for every active directory row whose
-- email matches the caller's auth email, it ensures a matching organization
-- member row exists (worker for team_works_partners, client_user for
-- team_works_clients). It is SECURITY DEFINER because a non-staff portal user
-- cannot read the staff-only directory tables under RLS; the function does the
-- lookup and insert on their behalf, strictly scoped to their own email and
-- user id. This replaces the one-time, email-bound invite link as the entry
-- point, so already-registered people never need a fresh URL per project --
-- once activated, project assignment surfaces as an in-portal notification.
--
-- Idempotent: the NOT EXISTS guards and the partial unique index
-- (organization_id, user_id, role) WHERE status <> 'archived' keep re-runs
-- from creating duplicates. Archived rows are ignored, so a previously
-- archived membership is re-created fresh (with a directory-scoped
-- source_local_id, distinct from any old invite-scoped row).

create or replace function public.team_works_activate_portal_membership()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  uemail text;
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
  select p.organization_id, uid, 'directory:worker:' || uid::text, p.display_name, 'worker', 'active'
  from public.team_works_partners p
  where p.status = 'active'
    and lower(p.email) = uemail
    and not exists (
      select 1 from public.team_works_organization_members m
      where m.organization_id = p.organization_id
        and m.user_id = uid
        and m.role = 'worker'
        and m.status <> 'archived'
    );

  insert into public.team_works_organization_members
    (organization_id, user_id, source_local_id, display_name, role, status)
  select c.organization_id, uid, 'directory:client:' || uid::text, c.display_name, 'client_user', 'active'
  from public.team_works_clients c
  where c.status = 'active'
    and lower(c.email) = uemail
    and not exists (
      select 1 from public.team_works_organization_members m
      where m.organization_id = c.organization_id
        and m.user_id = uid
        and m.role = 'client_user'
        and m.status <> 'archived'
    );
end;
$$;

revoke all on function public.team_works_activate_portal_membership() from public, anon;
grant execute on function public.team_works_activate_portal_membership() to authenticated, service_role;

notify pgrst, 'reload schema';
