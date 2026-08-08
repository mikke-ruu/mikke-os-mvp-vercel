-- Let each Community member choose the fallback color for their avatar.

alter table public.community_member_profiles
  add column if not exists avatar_color text not null default 'pink'
  check (avatar_color in ('blue', 'orange', 'yellow', 'pink', 'green'));
