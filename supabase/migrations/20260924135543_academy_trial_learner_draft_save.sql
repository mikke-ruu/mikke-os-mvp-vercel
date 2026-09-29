-- Permit lesson drafts during an active trial without opening any live feature.
-- No existing rows, ownership policies, or retention guards are changed.
begin;

create or replace function private.academy_guard_trial_learner_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headquarters_id uuid := case when tg_op = 'DELETE' then old.headquarters_id else new.headquarters_id end;
  v_mode text := private.academy_headquarters_access_mode(v_headquarters_id);
begin
  if tg_op = 'UPDATE' and (
    new.headquarters_id is distinct from old.headquarters_id
    or new.course_id is distinct from old.course_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'academy_learner_page_scope_is_immutable';
  end if;

  if v_mode = 'paid' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if v_mode = 'trial_active' then
    if tg_op = 'DELETE' then
      raise exception 'academy_trial_live_feature_unavailable';
    end if;
    if new.is_published or (tg_op = 'UPDATE' and old.is_published) then
      raise exception 'academy_trial_publishing_unavailable';
    end if;
    return new;
  end if;

  raise exception 'academy_access_inactive';
end;
$$;

revoke all on function private.academy_guard_trial_learner_draft() from public, anon, authenticated;

drop trigger academy_trial_guard_live on public.academy_learner_pages;
create trigger academy_trial_guard_live
before insert or update or delete on public.academy_learner_pages
for each row execute function private.academy_guard_trial_learner_draft();

commit;
