drop policy if exists marketnote_photos_objects_update_owner on storage.objects;

create policy marketnote_photos_objects_update_owner
on storage.objects for update to authenticated
using (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
