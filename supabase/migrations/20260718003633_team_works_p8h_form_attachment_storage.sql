-- Team Works P8-h: private Storage-backed form file / image answers.
-- Answers store attachment metadata only; file bodies live in a private bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-works-form-attachments',
  'team-works-form-attachments',
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

create or replace function private.team_works_storage_form_project_id(object_name text)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create or replace function private.team_works_storage_form_source_id(object_name text)
returns text language sql stable security definer set search_path = ''
as $$
  select nullif(split_part(object_name, '/', 2), '');
$$;

create or replace function private.team_works_storage_form_submission_source_id(object_name text)
returns text language sql stable security definer set search_path = ''
as $$
  select nullif(split_part(object_name, '/', 3), '');
$$;

create or replace function private.team_works_storage_form_field_id(object_name text)
returns text language sql stable security definer set search_path = ''
as $$
  select nullif(split_part(object_name, '/', 4), '');
$$;

create or replace function private.team_works_can_write_form_attachment_object(object_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.team_works_project_forms f
    where f.project_id = private.team_works_storage_form_project_id(object_name)
      and f.source_local_id = private.team_works_storage_form_source_id(object_name)
      and f.input_actor = private.team_works_current_project_role(f.project_id)
      and (
        f.input_actor <> 'client'
        or f.client_visible
      )
      and exists (
        select 1
        from jsonb_array_elements(f.fields) as field
        where field->>'id' = private.team_works_storage_form_field_id(object_name)
          and field->>'type' in ('file', 'image')
      )
  );
$$;

create or replace function private.team_works_can_read_form_attachment_object(object_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.team_works_is_project_staff(private.team_works_storage_form_project_id(object_name))
    or private.team_works_can_write_form_attachment_object(object_name)
    or exists (
      select 1
      from public.team_works_project_forms f
      join public.team_works_form_submissions s
        on s.project_id = f.project_id
       and s.form_id = f.id
      where f.project_id = private.team_works_storage_form_project_id(object_name)
        and f.source_local_id = private.team_works_storage_form_source_id(object_name)
        and s.source_local_id = private.team_works_storage_form_submission_source_id(object_name)
        and s.submitted_by_member_id = private.team_works_current_project_member_id(f.project_id)
  );
$$;

revoke all on function private.team_works_storage_form_project_id(text) from public, anon;
revoke all on function private.team_works_storage_form_source_id(text) from public, anon;
revoke all on function private.team_works_storage_form_submission_source_id(text) from public, anon;
revoke all on function private.team_works_storage_form_field_id(text) from public, anon;
revoke all on function private.team_works_can_write_form_attachment_object(text) from public, anon;
revoke all on function private.team_works_can_read_form_attachment_object(text) from public, anon;
grant execute on function private.team_works_storage_form_project_id(text) to authenticated, service_role;
grant execute on function private.team_works_storage_form_source_id(text) to authenticated, service_role;
grant execute on function private.team_works_storage_form_submission_source_id(text) to authenticated, service_role;
grant execute on function private.team_works_storage_form_field_id(text) to authenticated, service_role;
grant execute on function private.team_works_can_write_form_attachment_object(text) to authenticated, service_role;
grant execute on function private.team_works_can_read_form_attachment_object(text) to authenticated, service_role;

drop policy if exists team_works_form_attachment_objects_select on storage.objects;
drop policy if exists team_works_form_attachment_objects_insert on storage.objects;
drop policy if exists team_works_form_attachment_objects_update on storage.objects;

create policy team_works_form_attachment_objects_select on storage.objects
for select to authenticated
using (
  bucket_id = 'team-works-form-attachments'
  and private.team_works_can_read_form_attachment_object(name)
);

create policy team_works_form_attachment_objects_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'team-works-form-attachments'
  and private.team_works_can_write_form_attachment_object(name)
);

create policy team_works_form_attachment_objects_update on storage.objects
for update to authenticated
using (
  bucket_id = 'team-works-form-attachments'
  and private.team_works_can_write_form_attachment_object(name)
)
with check (
  bucket_id = 'team-works-form-attachments'
  and private.team_works_can_write_form_attachment_object(name)
);

notify pgrst, 'reload schema';
