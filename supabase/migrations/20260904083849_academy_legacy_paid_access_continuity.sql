-- Preserve legitimate Academy headquarters that were already marked paid/active
-- before the platform billing lifecycle was introduced. This does not create a
-- subscription, a free trial, or an automatic charge. A later verified customer
-- binding always remains authoritative in resource_access_window().

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table platform_billing_private.internal_resource_grants
  drop constraint internal_resource_grants_purpose_check;

alter table platform_billing_private.internal_resource_grants
  add constraint internal_resource_grants_purpose_check
  check (purpose in ('official_operations', 'test_only', 'legacy_paid_continuity'));

do $continuity$
declare
  v_eligible_count integer;
  v_inserted_count integer;
  v_cutover timestamptz := '2026-09-03 10:30:00+00'::timestamptz;
begin
  select count(*) into v_eligible_count
  from public.academy_headquarters headquarters
  join auth.users owner on owner.id = headquarters.owner_user_id
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
   and access.access_kind = 'paid'
   and access.status = 'active'
  where headquarters.created_at < v_cutover
    and headquarters.is_active = true
    and coalesce(owner.is_anonymous, false) = false
    and not exists (
      select 1
      from platform_billing_private.creation_entitlements entitlement
      where entitlement.product_key = 'academy_platform'
        and entitlement.resource_id = headquarters.id
        and entitlement.source_kind in ('verified_paid', 'verified_trial')
    )
    and not exists (
      select 1
      from platform_billing_private.internal_resource_grants grant_record
      where grant_record.product_key = 'academy_platform'
        and grant_record.resource_id = headquarters.id
    );

  -- The production catalog and the schema-only baseline both contain exactly
  -- two pre-cutover paid/active headquarters that were missed by the earlier
  -- name-based recovery. Stop instead of broadening access if the set drifts.
  if v_eligible_count <> 2 then
    raise exception using
      errcode = '55000',
      message = 'ACADEMY_LEGACY_PAID_CONTINUITY_PREFLIGHT';
  end if;

  insert into platform_billing_private.internal_resource_grants (
    actor_user_id,
    product_key,
    resource_id,
    purpose,
    reason,
    granted_by,
    evidence,
    starts_at,
    expires_at
  )
  select headquarters.owner_user_id,
         'academy_platform',
         headquarters.id,
         'legacy_paid_continuity',
         'Preserve paid Academy access that existed before platform billing cutover',
         headquarters.owner_user_id,
         'academy_headquarters_access_states paid/active before 2026-09-03 lifecycle cutover',
         coalesce(access.paid_started_at, access.starts_at),
         null
  from public.academy_headquarters headquarters
  join auth.users owner on owner.id = headquarters.owner_user_id
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
   and access.access_kind = 'paid'
   and access.status = 'active'
  where headquarters.created_at < v_cutover
    and headquarters.is_active = true
    and coalesce(owner.is_anonymous, false) = false
    and not exists (
      select 1
      from platform_billing_private.creation_entitlements entitlement
      where entitlement.product_key = 'academy_platform'
        and entitlement.resource_id = headquarters.id
        and entitlement.source_kind in ('verified_paid', 'verified_trial')
    )
    and not exists (
      select 1
      from platform_billing_private.internal_resource_grants grant_record
      where grant_record.product_key = 'academy_platform'
        and grant_record.resource_id = headquarters.id
    );

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_eligible_count then
    raise exception using
      errcode = '55000',
      message = 'ACADEMY_LEGACY_PAID_CONTINUITY_INSERT_MISMATCH';
  end if;
end;
$continuity$;
