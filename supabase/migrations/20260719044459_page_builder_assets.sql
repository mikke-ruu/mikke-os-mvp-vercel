-- Page Builder: public site imagery with authenticated owner-only writes.
-- Object path: <auth.uid()>/<page-site-id>/<yyyy-mm>/<uuid>.webp

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'page-assets',
  'page-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists page_assets_objects_select_owner on storage.objects;
drop policy if exists page_assets_objects_insert_owner on storage.objects;
drop policy if exists page_assets_objects_update_owner on storage.objects;
drop policy if exists page_assets_objects_delete_owner on storage.objects;

create policy page_assets_objects_select_owner on storage.objects
for select to authenticated
using (
  bucket_id = 'page-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy page_assets_objects_insert_owner on storage.objects
for insert to authenticated
with check (
  bucket_id = 'page-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy page_assets_objects_update_owner on storage.objects
for update to authenticated
using (
  bucket_id = 'page-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'page-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy page_assets_objects_delete_owner on storage.objects
for delete to authenticated
using (
  bucket_id = 'page-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
