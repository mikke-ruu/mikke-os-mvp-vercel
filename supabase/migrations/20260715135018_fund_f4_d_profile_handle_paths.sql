-- Fund F4-d follow-up: generated Mikke ID handles may contain underscores.
-- Keep the materialized public path compatible and resync it after handle edits.

alter table public.fund_public_participations
  drop constraint fund_public_participations_path_format_check;

alter table public.fund_public_participations
  add constraint fund_public_participations_path_format_check
  check (public_fund_path ~ '^/fund/[a-z0-9][a-z0-9_-]{0,79}/[a-z0-9][a-z0-9-]{0,79}$');

create or replace function private.sync_fund_public_participation_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participation_id uuid;
begin
  if tg_table_name = 'fund_participations' then
    perform private.sync_fund_public_participation(new.id);
  elsif tg_table_name = 'fund_projects' then
    for v_participation_id in
      select id from public.fund_participations where project_id = new.id
    loop
      perform private.sync_fund_public_participation(v_participation_id);
    end loop;
  elsif tg_table_name = 'fund_supports' then
    for v_participation_id in
      select id from public.fund_participations where support_id = new.id
    loop
      perform private.sync_fund_public_participation(v_participation_id);
    end loop;
  elsif tg_table_name = 'profiles' then
    for v_participation_id in
      select participation.id
      from public.fund_participations as participation
      join public.fund_projects as project on project.id = participation.project_id
      where project.owner_profile_id = new.id
    loop
      perform private.sync_fund_public_participation(v_participation_id);
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_fund_public_participation_trigger() from public, anon, authenticated;

drop trigger if exists sync_fund_public_participation_after_owner_handle_change on public.profiles;
create trigger sync_fund_public_participation_after_owner_handle_change
after update of handle on public.profiles
for each row execute function private.sync_fund_public_participation_trigger();

notify pgrst, 'reload schema';
