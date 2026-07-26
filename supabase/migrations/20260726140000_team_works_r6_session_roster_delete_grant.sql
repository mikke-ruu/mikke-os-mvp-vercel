-- Team Works R6 follow-up: team_works_session_roster never had a DELETE
-- grant to `authenticated` (20260724060000_team_works_r1_operations_foundation.sql
-- only granted select, insert, update, since only staff-side update flows
-- existed at that point). 20260726103000_team_works_client_portal_roster_and_messages.sql
-- added a client-facing DELETE RLS policy for it, but a policy without the
-- underlying table GRANT still blocks every delete at the privilege layer --
-- saveOperationsClientSessionRoster's delete-then-reinsert save always failed.

grant delete on public.team_works_session_roster to authenticated;

notify pgrst, 'reload schema';
