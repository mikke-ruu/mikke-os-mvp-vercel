revoke all on table public.library_user_stores from anon, authenticated;

grant select, insert, update, delete on table public.library_user_stores to authenticated;
