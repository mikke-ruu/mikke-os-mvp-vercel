-- Keep enrollment and subscription-management links separate. These are
-- operator-managed external URLs; saving them does not prove payment or grant
-- a Community entitlement.

alter table public.community_membership_plans
  add column external_customer_portal_url text not null default '',
  add column cancellation_guidance text,
  add column payment_setup_checklist jsonb not null default '{"productCreated":false,"recurringPriceConfirmed":false,"paymentLinkTested":false,"customerPortalEnabled":false,"customerPortalTested":false}'::jsonb;

alter table public.community_membership_plans
  add constraint community_membership_plans_customer_portal_url_check
    check (
      external_customer_portal_url = ''
      or external_customer_portal_url ~ '^https://billing[.]stripe[.]com/p/login/[A-Za-z0-9_-]+/?$'
    ),
  add constraint community_membership_plans_cancellation_guidance_check
    check (cancellation_guidance is null or char_length(trim(cancellation_guidance)) between 1 and 500),
  add constraint community_membership_plans_payment_setup_checklist_check
    check ((
      jsonb_typeof(payment_setup_checklist) = 'object'
      and jsonb_typeof(payment_setup_checklist->'productCreated') = 'boolean'
      and jsonb_typeof(payment_setup_checklist->'recurringPriceConfirmed') = 'boolean'
      and jsonb_typeof(payment_setup_checklist->'paymentLinkTested') = 'boolean'
      and jsonb_typeof(payment_setup_checklist->'customerPortalEnabled') = 'boolean'
      and jsonb_typeof(payment_setup_checklist->'customerPortalTested') = 'boolean'
      and payment_setup_checklist
        - 'productCreated'
        - 'recurringPriceConfirmed'
        - 'paymentLinkTested'
        - 'customerPortalEnabled'
        - 'customerPortalTested' = '{}'::jsonb
    ) is true);

-- Active plans are recruitment offers. A claimant may also keep reading the
-- specific archived plan needed to reach a safe shared cancellation entrance.
drop policy if exists "members can read active plans" on public.community_membership_plans;
create policy "members can read active or own contracted plans"
  on public.community_membership_plans for select to authenticated
using (
  status = 'active'
  or community_private.is_staff(community_id)
  or exists (
    select 1
    from public.community_payment_claims claim
    where claim.community_id = community_membership_plans.community_id
      and claim.plan_id = community_membership_plans.id
      and claim.user_id = (select auth.uid())
      and claim.status = 'approved'
      and claim.payment_method = 'external_link'
  )
);

comment on column public.community_membership_plans.external_payment_url is
  'External enrollment/payment URL. It is not evidence of payment and does not grant an entitlement.';
comment on column public.community_membership_plans.external_customer_portal_url is
  'Shared Stripe customer portal login URL only. Individual portal-session URLs, userinfo, query strings, and fragments are forbidden.';
comment on column public.community_membership_plans.cancellation_guidance is
  'Operator-authored display guidance that must match the external provider and the applicable contract terms.';
comment on column public.community_membership_plans.payment_setup_checklist is
  'Operator checklist only. It is not provider verification or payment evidence.';
