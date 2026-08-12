alter table public.mikkeos_email_campaigns
  add column last_tested_at timestamptz,
  add column last_tested_by uuid references auth.users(id) on delete set null,
  add column last_test_fingerprint text;

comment on column public.mikkeos_email_campaigns.last_test_fingerprint is
  'SHA-256 of the exact tested campaign fields. Set only by the server-side email function.';

-- Older projects may have inherited a table-wide UPDATE grant from default privileges.
-- Remove it before granting only the fields that draft editors genuinely need.
revoke update on public.mikkeos_email_campaigns from authenticated;
grant update (
  campaign_type,
  audience_kind,
  subject,
  preview_text,
  body_text,
  updated_at
) on public.mikkeos_email_campaigns to authenticated;
