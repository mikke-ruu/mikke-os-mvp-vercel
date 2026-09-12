-- Open the approved first-publication preparation flow without enabling billing dispatch.
-- Creating a preparation does not start the 168-hour period. The period begins only
-- after a verified payment setup, explicit consent and the first successful publish.

insert into academy_publication_private.policies (
  version,
  approval_id,
  terms_revision,
  quote_ttl_seconds,
  enabled,
  initial_price,
  cancellation,
  eligibility,
  dispatch_enabled,
  pricing_revision,
  consent_revision
)
values (
  'academy-first-publication-trial-2026-09-08-v1',
  'msg_01a0802a-2242-7d50-b124-e632c3382f5b',
  'academy-first-publication-trial-terms-2026-09-08-v1',
  1800,
  true,
  'fixed_at_publication',
  'inclusive_deadline',
  'no_previous_trial_or_contract',
  false,
  null,
  'academy-first-publication-trial-consent-2026-09-08-v1'
)
on conflict (version) do nothing;

do $$
begin
  if not exists (
    select 1
    from academy_publication_private.policies
    where version = 'academy-first-publication-trial-2026-09-08-v1'
      and approval_id = 'msg_01a0802a-2242-7d50-b124-e632c3382f5b'
      and terms_revision = 'academy-first-publication-trial-terms-2026-09-08-v1'
      and quote_ttl_seconds = 1800
      and enabled
      and initial_price = 'fixed_at_publication'
      and cancellation = 'inclusive_deadline'
      and eligibility = 'no_previous_trial_or_contract'
      and not dispatch_enabled
      and pricing_revision is null
      and consent_revision = 'academy-first-publication-trial-consent-2026-09-08-v1'
  ) then
    raise exception 'academy_first_publication_preparation_policy_mismatch';
  end if;
end
$$;
