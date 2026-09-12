-- Keep the Academy onboarding eligibility response aligned with the policy
-- required by academy_first_publication_create_preparation. This prevents the
-- UI from offering a preparation action when the matching policy is absent or
-- disabled.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.academy_get_my_onboarding_eligibility()
returns table (trial_available boolean, paid_creation_available boolean, trial_block_reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'academy_onboarding_authentication_required'; end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'academy_anonymous_auth_forbidden';
  end if;

  return query
  with facts as (
    select
      exists (select 1 from public.academy_headquarters h where h.owner_user_id = v_actor) as owns_headquarters,
      exists (select 1 from public.academy_trial_usage_ledger u where u.owner_user_id = v_actor) as used_trial,
      coalesce(private.academy_has_headquarters_creation_entitlement(v_actor), false) as has_paid_entitlement,
      exists (
        select 1
        from academy_publication_private.policies p
        where p.version = 'academy-first-publication-trial-2026-09-08-v1'
          and p.enabled
      ) as policy_available
  )
  select
    not owns_headquarters and not used_trial and policy_available,
    not owns_headquarters and has_paid_entitlement,
    case
      when owns_headquarters then 'headquarters_already_owned'
      when used_trial then 'trial_already_used'
      when not policy_available then 'policy_unavailable'
      else null
    end
  from facts;
end;
$$;

revoke all on function public.academy_get_my_onboarding_eligibility()
  from public, anon;
grant execute on function public.academy_get_my_onboarding_eligibility()
  to authenticated;
