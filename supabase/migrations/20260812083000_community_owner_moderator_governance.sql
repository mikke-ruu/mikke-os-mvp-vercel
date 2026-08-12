-- Keep one canonical Community owner while allowing multiple moderators.
-- Moderators may manage participation, but only the canonical owner may grant
-- or revoke moderator privileges. The canonical owner membership is protected.

create or replace function community_private.enforce_community_staff_roles()
returns trigger
language plpgsql
security definer
set search_path = public, community_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
begin
  select owner_user_id into v_owner
  from public.community_communities
  where id = new.community_id;

  -- Preserve service-role maintenance and migration operations.
  if v_actor is null then
    return new;
  end if;

  -- Ownership transfer requires a separate audited workflow. Until then the
  -- canonical owner's membership must stay active and keep the owner role.
  if old.user_id = v_owner then
    if new.role <> 'owner' or new.status <> 'active' then
      raise exception 'The Community owner cannot be demoted or suspended.';
    end if;
    return new;
  end if;

  -- No other membership may become an owner. Co-operators use moderator.
  if new.role = 'owner' then
    raise exception 'Use the moderator role for additional operators.';
  end if;

  -- Only the canonical owner may grant or revoke moderator privileges.
  if new.role is distinct from old.role and v_actor <> v_owner then
    raise exception 'Only the Community owner can change staff roles.';
  end if;

  return new;
end;
$$;

drop trigger if exists community_membership_staff_role_guard on public.community_memberships;
create trigger community_membership_staff_role_guard
before update on public.community_memberships
for each row execute function community_private.enforce_community_staff_roles();
