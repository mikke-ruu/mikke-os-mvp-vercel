grant delete on public.team_works_holidays to authenticated;

drop policy if exists team_works_holidays_delete on public.team_works_holidays;

create policy team_works_holidays_delete
on public.team_works_holidays
for delete
to authenticated
using (private.team_works_is_org_staff(organization_id));

notify pgrst, 'reload schema';
