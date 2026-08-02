create table if not exists public.library_user_stores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"version":1,"items":[],"quickMemos":[],"compositionTemplates":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.library_user_stores enable row level security;

revoke all on table public.library_user_stores from anon, authenticated;
grant select, insert, update, delete on table public.library_user_stores to authenticated;

create policy library_user_stores_select_own
  on public.library_user_stores
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy library_user_stores_insert_own
  on public.library_user_stores
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy library_user_stores_update_own
  on public.library_user_stores
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy library_user_stores_delete_own
  on public.library_user_stores
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists library_user_stores_updated_at_idx
  on public.library_user_stores (updated_at desc);
