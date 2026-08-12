create table public.mikkeos_email_deliveries (
  campaign_id uuid not null references public.mikkeos_email_campaigns(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, recipient_user_id)
);

comment on table public.mikkeos_email_deliveries is
  'Server-managed campaign delivery ledger. Recipient email addresses are deliberately not stored.';

create index mikkeos_email_deliveries_campaign_status_idx
  on public.mikkeos_email_deliveries(campaign_id, status);

alter table public.mikkeos_email_deliveries enable row level security;

create policy "HQ admins read email delivery results"
on public.mikkeos_email_deliveries
for select
to authenticated
using (exists (
  select 1
  from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
    and staff.role in ('owner', 'admin')
));

revoke all on public.mikkeos_email_deliveries from public, anon, authenticated;
grant select on public.mikkeos_email_deliveries to authenticated;
grant select, insert, update on public.mikkeos_email_deliveries to service_role;

-- Once delivery starts, the exact subject/body/audience must remain frozen.
-- The Edge Function uses service_role for status transitions and delivery writes.
drop policy if exists "HQ content staff update email campaigns"
  on public.mikkeos_email_campaigns;

create policy "HQ content staff update email campaign drafts"
on public.mikkeos_email_campaigns
for update
to authenticated
using (
  status = 'draft'
  and exists (
    select 1
    from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor')
  )
)
with check (
  status = 'draft'
  and exists (
    select 1
    from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor')
  )
);
