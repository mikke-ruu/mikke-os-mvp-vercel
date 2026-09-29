-- The legacy timestamp trigger uses transaction-start now(). Ensure each
-- authorized basic edit has a distinct optimistic-concurrency token, even
-- when several edits are performed in one database transaction.
create function academy2_access.course_basic_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if academy2_access.has_course_basic_write_permit(old.headquarters_id,old.id) then
  new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
 end if;
 return new;
end $$;
revoke all on function academy2_access.course_basic_version() from public,anon,authenticated,service_role;
create trigger zzzz_academy2_course_basic_version before update on public.academy_courses
for each row execute function academy2_access.course_basic_version();
