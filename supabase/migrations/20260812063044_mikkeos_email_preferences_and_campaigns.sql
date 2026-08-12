create table public.mikkeos_email_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  newsletter_enabled boolean not null default false,
  product_updates_enabled boolean not null default false,
  consent_source text not null default 'settings' check (consent_source in ('signup', 'settings', 'import')),
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.mikkeos_email_preferences is
  'Optional email preferences. Essential account and service notices are managed separately.';

alter table public.mikkeos_email_preferences enable row level security;

create policy "Users read their own email preferences"
on public.mikkeos_email_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users create their own email preferences"
on public.mikkeos_email_preferences
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users update their own email preferences"
on public.mikkeos_email_preferences
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.mikkeos_email_preferences from public, anon;
grant select, insert on public.mikkeos_email_preferences to authenticated;
grant update (newsletter_enabled, product_updates_enabled, consent_source, consented_at, updated_at)
  on public.mikkeos_email_preferences to authenticated;

create table public.mikkeos_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_type text not null check (campaign_type in ('essential_notice', 'newsletter', 'product_update')),
  audience_kind text not null check (audience_kind in ('all_accounts', 'newsletter_subscribers', 'product_update_subscribers')),
  subject text not null check (char_length(trim(subject)) between 1 and 160),
  preview_text text not null default '',
  body_text text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (campaign_type = 'essential_notice' and audience_kind = 'all_accounts')
    or (campaign_type = 'newsletter' and audience_kind = 'newsletter_subscribers')
    or (campaign_type = 'product_update' and audience_kind = 'product_update_subscribers')
  )
);

create index mikkeos_email_campaigns_status_created_idx
  on public.mikkeos_email_campaigns(status, created_at desc);

alter table public.mikkeos_email_campaigns enable row level security;

create policy "HQ content staff read email campaigns"
on public.mikkeos_email_campaigns
for select
to authenticated
using (exists (
  select 1
  from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
    and staff.role in ('owner', 'admin', 'editor', 'analyst')
));

create policy "HQ content staff create email campaigns"
on public.mikkeos_email_campaigns
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor')
  )
);

create policy "HQ content staff update email campaigns"
on public.mikkeos_email_campaigns
for update
to authenticated
using (exists (
  select 1
  from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
    and staff.role in ('owner', 'admin', 'editor')
))
with check (exists (
  select 1
  from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
    and staff.role in ('owner', 'admin', 'editor')
));

create policy "HQ admins delete email campaign drafts"
on public.mikkeos_email_campaigns
for delete
to authenticated
using (
  status = 'draft'
  and exists (
    select 1
    from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin')
  )
);

revoke all on public.mikkeos_email_campaigns from public, anon;
grant select, insert, delete on public.mikkeos_email_campaigns to authenticated;
grant update (campaign_type, audience_kind, subject, preview_text, body_text, status, scheduled_for, sent_at, recipient_count, updated_at)
  on public.mikkeos_email_campaigns to authenticated;

create rule mikkeos_email_campaigns_audit_insert
as on insert to public.mikkeos_email_campaigns do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'insert', 'mikkeos_email_campaigns', new.id, jsonb_build_object('status', new.status, 'campaign_type', new.campaign_type));

create rule mikkeos_email_campaigns_audit_update
as on update to public.mikkeos_email_campaigns do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'update', 'mikkeos_email_campaigns', new.id, jsonb_build_object('status', new.status, 'campaign_type', new.campaign_type));

create rule mikkeos_email_campaigns_audit_delete
as on delete to public.mikkeos_email_campaigns do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'delete', 'mikkeos_email_campaigns', old.id, jsonb_build_object('status', old.status, 'campaign_type', old.campaign_type));

create view private.mikkeos_hq_email_audience_summary
with (security_barrier = true)
as
select jsonb_build_object(
  'all_accounts', (select count(*) from public.profiles),
  'newsletter_subscribers', (
    select count(*) from public.mikkeos_email_preferences where newsletter_enabled
  ),
  'product_update_subscribers', (
    select count(*) from public.mikkeos_email_preferences where product_updates_enabled
  ),
  'campaign_drafts', (
    select count(*) from public.mikkeos_email_campaigns where status = 'draft'
  )
) as summary
where exists (
  select 1
  from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid())
    and staff.is_active
    and staff.role in ('owner', 'admin', 'editor', 'analyst')
);

revoke all on private.mikkeos_hq_email_audience_summary from public, anon;
grant select on private.mikkeos_hq_email_audience_summary to authenticated;

create view public.mikkeos_hq_email_audience_summary
with (security_invoker = true, security_barrier = true)
as
select summary
from private.mikkeos_hq_email_audience_summary;

revoke all on public.mikkeos_hq_email_audience_summary from public, anon;
grant select on public.mikkeos_hq_email_audience_summary to authenticated;
