-- Fund F5-b: source_local_id is the stable bridge between the existing
-- owner routes/cache and database UUIDs. Make it a required invariant before
-- the owner screens start reading project content from the database.
-- Remote migration history version: 20260715165421.

update public.fund_projects
set source_local_id = 'fund_db_' || replace(id::text, '-', '')
where source_local_id is null or btrim(source_local_id) = '';

alter table public.fund_projects
  add constraint fund_projects_source_local_id_length_check
    check (char_length(source_local_id) between 1 and 160) not valid;

alter table public.fund_projects
  validate constraint fund_projects_source_local_id_length_check;

alter table public.fund_projects
  alter column source_local_id set not null;

drop index if exists public.fund_projects_owner_source_local_id_unique_idx;
create unique index fund_projects_owner_source_local_id_unique_idx
  on public.fund_projects (owner_user_id, source_local_id);
