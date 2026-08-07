-- Community phase 2B: private post attachments and tenant-managed stamps.

create unique index if not exists community_posts_id_community_unique
  on public.community_posts (id, community_id);

create table if not exists public.community_post_attachments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  post_id uuid not null,
  uploader_user_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 1 and 150),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now(),
  foreign key (post_id, community_id)
    references public.community_posts(id, community_id) on delete cascade
);

create index if not exists community_post_attachments_post_created_idx
  on public.community_post_attachments (post_id, created_at);
create index if not exists community_post_attachments_uploader_idx
  on public.community_post_attachments (uploader_user_id);

create table if not exists public.community_stamps (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_communities(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  image_url text not null check (char_length(image_url) <= 2048 and image_url ~ '^https://'),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_stamps_community_active_order_idx
  on public.community_stamps (community_id, is_active, sort_order, created_at);
create index if not exists community_stamps_created_by_idx
  on public.community_stamps (created_by_user_id);

alter table public.community_comments
  add column if not exists stamp_id uuid references public.community_stamps(id) on delete set null;
create index if not exists community_comments_stamp_idx
  on public.community_comments (stamp_id)
  where stamp_id is not null;

drop trigger if exists community_stamps_touch_updated_at on public.community_stamps;
create trigger community_stamps_touch_updated_at
before update on public.community_stamps
for each row execute function public.community_touch_updated_at();

alter table public.community_post_attachments enable row level security;
alter table public.community_stamps enable row level security;

revoke all on public.community_post_attachments from anon, authenticated;
revoke all on public.community_stamps from anon, authenticated;
grant select, insert, delete on public.community_post_attachments to authenticated;
grant select, insert, update, delete on public.community_stamps to authenticated;

create policy "community users can read accessible attachments"
on public.community_post_attachments for select
to authenticated
using (
  exists (
    select 1 from public.community_posts p
    where p.id = community_post_attachments.post_id
      and p.community_id = community_post_attachments.community_id
      and p.deleted_at is null
      and community_private.can_access_room(p.room_id)
      and (p.is_hidden = false or community_private.is_staff(p.community_id))
  )
);

create policy "community authors can create post attachments"
on public.community_post_attachments for insert
to authenticated
with check (
  uploader_user_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts p
    where p.id = community_post_attachments.post_id
      and p.community_id = community_post_attachments.community_id
      and p.deleted_at is null
      and community_private.can_access_room(p.room_id)
      and (p.author_user_id = (select auth.uid()) or community_private.is_staff(p.community_id))
  )
);

create policy "community uploaders can delete post attachments"
on public.community_post_attachments for delete
to authenticated
using (
  uploader_user_id = (select auth.uid())
  or community_private.is_staff(community_id)
);

create policy "community members can read active stamps"
on public.community_stamps for select
to authenticated
using (
  community_private.is_active_member(community_id)
  and (is_active = true or community_private.is_staff(community_id))
);

create policy "community staff can insert stamps"
on public.community_stamps for insert
to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and community_private.is_staff(community_id)
);

create policy "community staff can update stamps"
on public.community_stamps for update
to authenticated
using (community_private.is_staff(community_id))
with check (community_private.is_staff(community_id));

create policy "community staff can delete stamps"
on public.community_stamps for delete
to authenticated
using (community_private.is_staff(community_id));

drop policy if exists "community users can create accessible comments" on public.community_comments;
create policy "community users can create accessible comments"
on public.community_comments for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_posts p
    join public.community_rooms r on r.id = p.room_id
    where p.id = community_comments.post_id
      and p.deleted_at is null
      and p.is_hidden = false
      and r.member_can_comment = true
      and community_private.can_access_room(r.id)
      and (
        community_comments.stamp_id is null
        or exists (
          select 1 from public.community_stamps s
          where s.id = community_comments.stamp_id
            and s.community_id = p.community_id
            and s.is_active = true
        )
      )
  )
);

drop policy if exists "community authors can update accessible comments" on public.community_comments;
create policy "community authors can update accessible comments"
on public.community_comments for update
to authenticated
using (
  author_user_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts p
    where p.id = community_comments.post_id
      and p.deleted_at is null
      and community_private.can_access_room(p.room_id)
  )
)
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts p
    where p.id = community_comments.post_id
      and p.deleted_at is null
      and community_private.can_access_room(p.room_id)
      and (
        community_comments.stamp_id is null
        or exists (
          select 1 from public.community_stamps s
          where s.id = community_comments.stamp_id
            and s.community_id = p.community_id
            and s.is_active = true
        )
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-files',
  'community-files',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_files_objects_select on storage.objects;
drop policy if exists community_files_objects_insert on storage.objects;
drop policy if exists community_files_objects_delete on storage.objects;

create policy community_files_objects_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'community-files'
  and exists (
    select 1 from public.community_post_attachments a
    where a.storage_path = name
  )
);

create policy community_files_objects_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-files'
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and exists (
    select 1 from public.community_post_attachments a
    where a.storage_path = name
      and a.uploader_user_id = (select auth.uid())
      and a.community_id::text = (storage.foldername(name))[1]
      and a.post_id::text = (storage.foldername(name))[2]
  )
);

create policy community_files_objects_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-files'
  and exists (
    select 1 from public.community_post_attachments a
    where a.storage_path = name
      and (
        a.uploader_user_id = (select auth.uid())
        or community_private.is_staff(a.community_id)
      )
  )
);
