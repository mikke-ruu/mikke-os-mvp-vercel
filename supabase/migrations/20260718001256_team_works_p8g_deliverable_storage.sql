-- Team Works P8-g: private Storage-backed deliverable files.
-- File bodies live in a private bucket; project_deliverables stores only the object path.

alter table public.team_works_project_deliverables
  add column if not exists storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-works-deliverables',
  'team-works-deliverables',
  false,
  26214400,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.team_works_storage_project_id(object_name text)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create or replace function private.team_works_storage_task_source_id(object_name text)
returns text language sql stable security definer set search_path = ''
as $$
  select nullif(split_part(object_name, '/', 2), '');
$$;

create or replace function private.team_works_storage_deliverable_source_id(object_name text)
returns text language sql stable security definer set search_path = ''
as $$
  select nullif(split_part(object_name, '/', 3), '');
$$;

create or replace function private.team_works_can_write_deliverable_object(object_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.team_works_project_tasks t
    where t.project_id = private.team_works_storage_project_id(object_name)
      and t.source_local_id = private.team_works_storage_task_source_id(object_name)
      and t.assignee_member_id = private.team_works_current_project_member_id(t.project_id)
      and private.team_works_current_project_role(t.project_id) = 'worker'
  );
$$;

create or replace function private.team_works_can_read_deliverable_object(object_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.team_works_is_project_staff(private.team_works_storage_project_id(object_name))
    or exists (
      select 1
      from public.team_works_project_tasks t
      where t.project_id = private.team_works_storage_project_id(object_name)
        and t.source_local_id = private.team_works_storage_task_source_id(object_name)
        and t.assignee_member_id = private.team_works_current_project_member_id(t.project_id)
        and private.team_works_current_project_role(t.project_id) = 'worker'
    )
    or exists (
      select 1
      from public.team_works_project_deliverables d
      where d.project_id = private.team_works_storage_project_id(object_name)
        and d.source_local_id = private.team_works_storage_deliverable_source_id(object_name)
        and d.storage_path = object_name
        and d.client_visible
        and d.status in ('client_review', 'revision_requested', 'approved', 'delivered')
        and private.team_works_current_project_role(d.project_id) = 'client'
    );
$$;

revoke all on function private.team_works_storage_project_id(text) from public, anon;
revoke all on function private.team_works_storage_task_source_id(text) from public, anon;
revoke all on function private.team_works_storage_deliverable_source_id(text) from public, anon;
revoke all on function private.team_works_can_write_deliverable_object(text) from public, anon;
revoke all on function private.team_works_can_read_deliverable_object(text) from public, anon;
grant execute on function private.team_works_storage_project_id(text) to authenticated, service_role;
grant execute on function private.team_works_storage_task_source_id(text) to authenticated, service_role;
grant execute on function private.team_works_storage_deliverable_source_id(text) to authenticated, service_role;
grant execute on function private.team_works_can_write_deliverable_object(text) to authenticated, service_role;
grant execute on function private.team_works_can_read_deliverable_object(text) to authenticated, service_role;

drop policy if exists team_works_deliverable_objects_select on storage.objects;
drop policy if exists team_works_deliverable_objects_insert on storage.objects;
drop policy if exists team_works_deliverable_objects_update on storage.objects;

create policy team_works_deliverable_objects_select on storage.objects
for select to authenticated
using (
  bucket_id = 'team-works-deliverables'
  and private.team_works_can_read_deliverable_object(name)
);

create policy team_works_deliverable_objects_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'team-works-deliverables'
  and private.team_works_can_write_deliverable_object(name)
);

create policy team_works_deliverable_objects_update on storage.objects
for update to authenticated
using (
  bucket_id = 'team-works-deliverables'
  and private.team_works_can_write_deliverable_object(name)
)
with check (
  bucket_id = 'team-works-deliverables'
  and private.team_works_can_write_deliverable_object(name)
);

notify pgrst, 'reload schema';
