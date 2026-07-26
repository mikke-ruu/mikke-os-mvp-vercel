-- Team Works R6 follow-up: let staff archive a stuck organization member so
-- the same person can accept a fresh invite for a different role/project.
--
-- team_works_organization_members had a plain unique(organization_id,user_id)
-- constraint. That meant anyone already registered under one role (e.g. a
-- partner accepted as 'worker') could never accept a second invite in the
-- same org -- even a brand-new project assignment via the directory pattern
-- from 20260726120000_team_works_r6_client_directory.sql hits this, because
-- accepting an invite always inserts a fresh organization_members row.
--
-- Per this table's own stated principle ("Browser users archive or void
-- records; hard delete is intentionally withheld.",
-- 20260717155456_team_works_p8a_foundation.sql line 3), the fix is a partial
-- unique index that excludes archived rows, not a hard delete. Archiving a
-- member keeps their history (sessions, payouts, reports, messages) intact
-- while freeing the (organization_id, user_id) slot for a fresh invite
-- acceptance.

alter table public.team_works_organization_members
  drop constraint team_works_organization_members_organization_id_user_id_key;

create unique index team_works_organization_members_org_user_active_key
  on public.team_works_organization_members (organization_id, user_id)
  where status <> 'archived';

notify pgrst, 'reload schema';
