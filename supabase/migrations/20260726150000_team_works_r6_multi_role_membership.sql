-- Team Works R6: allow one account to hold several roles at once (Plan A).
--
-- 20260726130000_team_works_r6_member_reactivation.sql replaced the plain
-- unique(organization_id, user_id) with a partial unique index on
-- (organization_id, user_id) WHERE status <> 'archived'. That still caps an
-- active user at ONE role per organization: a partner (worker) could not also
-- be a client of the same org, let alone of the same project.
--
-- Ayumi's requirement is that the same account can be, e.g., worker AND client
-- simultaneously -- across different projects and even within the same project
-- (a headquarters person who also commissions a project as its client). Since
-- role lives on the organization_members row and project_members references a
-- specific member id, the clean minimal enabler is to let a user hold one
-- active member row PER ROLE. The uniqueness key gains `role`.
--
-- Archived rows stay excluded, so the reactivation/archive flow from the
-- previous migration keeps working. project_members' PK (project_id,
-- organization_member_id) is unchanged: two roles on one project are two
-- different member ids, so no collision.

drop index if exists public.team_works_organization_members_org_user_active_key;

create unique index team_works_organization_members_org_user_role_active_key
  on public.team_works_organization_members (organization_id, user_id, role)
  where status <> 'archived';

notify pgrst, 'reload schema';
