create index if not exists market_reflection_photos_user_id_idx
  on public.market_reflection_photos (user_id);

drop policy if exists market_reflection_photos_select_owner on public.market_reflection_photos;
drop policy if exists market_reflection_photos_insert_owner on public.market_reflection_photos;
drop policy if exists market_reflection_photos_update_owner on public.market_reflection_photos;
drop policy if exists market_reflection_photos_delete_owner on public.market_reflection_photos;

create policy market_reflection_photos_select_owner
on public.market_reflection_photos for select to authenticated
using ((select auth.uid()) = user_id);

create policy market_reflection_photos_insert_owner
on public.market_reflection_photos for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.market_events event
    where event.id = market_event_id
      and event.user_id = (select auth.uid())
      and event.profile_id = profile_id
  )
);

create policy market_reflection_photos_update_owner
on public.market_reflection_photos for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy market_reflection_photos_delete_owner
on public.market_reflection_photos for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists marketnote_photos_objects_select_owner on storage.objects;
drop policy if exists marketnote_photos_objects_insert_owner on storage.objects;
drop policy if exists marketnote_photos_objects_update_owner on storage.objects;
drop policy if exists marketnote_photos_objects_delete_owner on storage.objects;

create policy marketnote_photos_objects_select_owner
on storage.objects for select to authenticated
using (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy marketnote_photos_objects_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy marketnote_photos_objects_update_owner
on storage.objects for update to authenticated
using (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy marketnote_photos_objects_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
