-- Fund F5-f: keep operational history in the owner-facing Data API.
-- Owners use archive/private/draft/cancelled/invalid states instead of hard delete.
-- fund_plans intentionally keeps DELETE because save_fund_project_content replaces
-- the owner's plan set atomically inside a security-invoker transaction.

revoke delete on table public.fund_projects from authenticated;
revoke delete on table public.fund_supports from authenticated;
revoke delete on table public.fund_updates from authenticated;
revoke delete on table public.fund_challenge_records from authenticated;
revoke delete on table public.fund_app_links from authenticated;

drop policy if exists "fund_projects_delete_own" on public.fund_projects;
drop policy if exists "fund_supports_delete_own_project" on public.fund_supports;
drop policy if exists "fund_updates_delete_own_project" on public.fund_updates;
drop policy if exists "fund_challenge_records_delete_owner" on public.fund_challenge_records;
drop policy if exists "fund_app_links_delete_owner" on public.fund_app_links;

comment on table public.fund_projects is
  'Owner Fund source of truth. Browser owners archive or privatize records instead of hard deleting them.';
comment on table public.fund_supports is
  'Owner-private support history. Browser owners cancel, refund, or invalidate records instead of hard deleting them.';

notify pgrst, 'reload schema';
