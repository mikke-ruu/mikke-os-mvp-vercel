-- Team Works P8-f: form review persistence and worker deliverable submissions.
-- Extends existing P8-c collaboration rows without adding a new public table.

create or replace function private.team_works_is_assigned_worker_for_deliverable(
  target_project_id uuid,
  target_task_id uuid,
  target_submitted_by_member_id uuid
)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.team_works_current_project_role(target_project_id) = 'worker'
    and target_submitted_by_member_id = private.team_works_current_project_member_id(target_project_id)
    and exists (
      select 1
      from public.team_works_project_tasks t
      where t.id = target_task_id
        and t.project_id = target_project_id
        and t.assignee_member_id = private.team_works_current_project_member_id(target_project_id)
    );
$$;

create or replace function private.team_works_guard_worker_deliverable_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if private.team_works_current_project_role(new.project_id) <> 'worker' then
    return new;
  end if;

  if new.project_id is distinct from old.project_id
    or new.task_id is distinct from old.task_id
    or new.source_local_id is distinct from old.source_local_id
    or new.title is distinct from old.title
    or new.deliverable_type is distinct from old.deliverable_type
    or new.client_visible is distinct from old.client_visible
    or new.reviewed_by_member_id is distinct from old.reviewed_by_member_id then
    raise exception 'worker cannot change managed deliverable fields';
  end if;

  return new;
end;
$$;

revoke all on function private.team_works_is_assigned_worker_for_deliverable(uuid,uuid,uuid) from public, anon;
revoke all on function private.team_works_guard_worker_deliverable_update() from public, anon, authenticated;
grant execute on function private.team_works_is_assigned_worker_for_deliverable(uuid,uuid,uuid) to authenticated, service_role;
grant execute on function private.team_works_guard_worker_deliverable_update() to postgres, service_role;

drop trigger if exists team_works_guard_worker_deliverable_update on public.team_works_project_deliverables;
create trigger team_works_guard_worker_deliverable_update
before update on public.team_works_project_deliverables
for each row execute function private.team_works_guard_worker_deliverable_update();

drop policy if exists team_works_deliverables_insert on public.team_works_project_deliverables;
drop policy if exists team_works_deliverables_update on public.team_works_project_deliverables;

create policy team_works_deliverables_insert on public.team_works_project_deliverables for insert to authenticated
with check (
  private.team_works_is_project_staff(project_id)
  or (
    status in ('draft', 'submitted')
    and not client_visible
    and reviewed_by_member_id is null
    and private.team_works_is_assigned_worker_for_deliverable(project_id, task_id, submitted_by_member_id)
  )
);

create policy team_works_deliverables_update on public.team_works_project_deliverables for update to authenticated
using (
  private.team_works_is_project_staff(project_id)
  or (private.team_works_current_project_role(project_id) = 'client' and client_visible and status = 'client_review')
  or (
    status in ('draft', 'revision_requested')
    and private.team_works_is_assigned_worker_for_deliverable(project_id, task_id, coalesce(submitted_by_member_id, private.team_works_current_project_member_id(project_id)))
  )
)
with check (
  private.team_works_is_project_staff(project_id)
  or (private.team_works_current_project_role(project_id) = 'client' and client_visible and status in ('revision_requested', 'approved'))
  or (
    status in ('draft', 'submitted')
    and private.team_works_is_assigned_worker_for_deliverable(project_id, task_id, submitted_by_member_id)
  )
);

notify pgrst, 'reload schema';
