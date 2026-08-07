create table if not exists public.market_reflection_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  market_event_id uuid not null references public.market_events(id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index if not exists market_reflection_photos_profile_id_idx
  on public.market_reflection_photos (profile_id);

create index if not exists market_reflection_photos_event_id_idx
  on public.market_reflection_photos (market_event_id, sort_order, created_at);

alter table public.market_reflection_photos enable row level security;

drop policy if exists market_reflection_photos_select_owner on public.market_reflection_photos;
drop policy if exists market_reflection_photos_insert_owner on public.market_reflection_photos;
drop policy if exists market_reflection_photos_update_owner on public.market_reflection_photos;
drop policy if exists market_reflection_photos_delete_owner on public.market_reflection_photos;

create policy market_reflection_photos_select_owner
on public.market_reflection_photos for select to authenticated
using (auth.uid() = user_id);

create policy market_reflection_photos_insert_owner
on public.market_reflection_photos for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.market_events event
    where event.id = market_event_id
      and event.user_id = auth.uid()
      and event.profile_id = profile_id
  )
);

create policy market_reflection_photos_update_owner
on public.market_reflection_photos for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy market_reflection_photos_delete_owner
on public.market_reflection_photos for delete to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketnote-photos',
  'marketnote-photos',
  false,
  4194304,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists marketnote_photos_objects_select_owner on storage.objects;
drop policy if exists marketnote_photos_objects_insert_owner on storage.objects;
drop policy if exists marketnote_photos_objects_delete_owner on storage.objects;

create policy marketnote_photos_objects_select_owner
on storage.objects for select to authenticated
using (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy marketnote_photos_objects_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy marketnote_photos_objects_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'marketnote-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
