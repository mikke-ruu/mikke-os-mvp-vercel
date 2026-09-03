# Platform billing Stripe runtime (local only)

## Status

This package is a local release candidate for shared Academy and Community platform billing. It is not proof of a production payment, production entitlement, or a configured Stripe account. No production database migration or Stripe setting is part of this change.

An explicit paid checkout is required. A free-period ending does not create a Checkout Session, subscription, payment, or paid entitlement.

## Runtime flow

1. `POST /api/billing/platform/quote` issues and persists a server-calculated, policy-approved quote.
2. `POST /api/billing/platform/checkout` revalidates the authenticated owner/resource and exact quote consent, reserves one attempt, and creates or retrieves one Stripe Checkout Session.
3. `POST /api/billing/platform/webhook/stripe` verifies the signature over the raw body before parsing. A paid subscription Checkout event is bound to the immutable quote and attempt, then creates the app-owned creation entitlement and one-month subscription projection atomically.
4. Invoice and subscription events update the projection idempotently. Renewal uses the original paid-at day, with month-end fallback.
5. `GET /api/billing/platform/status` exposes only the narrow customer status. `POST /api/billing/platform/portal` obtains the server-only Stripe customer reference and creates a Billing Portal Session.

Raw provider payloads, webhook secrets, provider event hashes, Stripe customer IDs, and subscription IDs are not returned to browsers. The database does not record a `paid` state from an unverified or uncertain Checkout attempt.

The webhook parser accepts both Stripe's legacy subscription references/period fields and the Basil shapes (`invoice.parent.subscription_details.subscription` and subscription-item periods). When legacy and Basil values disagree, or subscription items contain no period or conflicting periods, it fails closed. This compatibility does not pin or change the Stripe account API version.

Academy must call one service-only verifier from its owner-authorized paid-activation database wrapper in the same transaction. New HQ creation uses `platform_billing_academy_new_paid_consume(uuid,uuid)` with a generated, absent HQ id and must insert that owner HQ immediately afterwards. Existing trial upgrade uses `platform_billing_academy_existing_paid_consume(uuid,uuid)`, which also locks and revalidates the existing HQ owner. Both acquire the shared actor/scope/quote/attempt/event/subscription/entitlement chain first. Calling either as a separate HTTP preflight is not an atomic activation contract.

## Deployment order

Apply and verify these migrations in order:

1. `20260831180143_platform_billing_checkout_ledger.sql`
2. `20260901124412_platform_billing_creation_entitlements.sql`
3. `20260902171944_platform_billing_verified_provider_events.sql` (frozen; do not edit)
4. `20260902223651_platform_billing_subscription_runtime.sql`

The new tables use RLS and deny direct table access, including `service_role`; only the named service-only RPCs are granted. Production application, rollback planning, and authenticated two-account validation are separate approval gates.

## Required server configuration

- `PLATFORM_BILLING_API_ENABLED=1`
- `NEXT_PUBLIC_SUPABASE_URL` plus exactly one approved server secret (`SUPABASE_SECRET_KEY` or the legacy service-role key)
- `PLATFORM_BILLING_CATALOG_JSON` containing approved amounts, merchant identity, policy versions, and approval metadata
- `PLATFORM_BILLING_STRIPE_MODE=test|live`, matching `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`
- `PLATFORM_BILLING_STRIPE_PRICES_JSON` mapping approved `product:plan` keys to recurring Stripe Price IDs
- fixed `https://app.mikke-os.com` success, cancel, and portal return URLs

No environment value or secret belongs in Git, browser code, logs, or evidence files.

## Remaining release gates

- Reconcile the approved catalog with Stripe recurring Price currency/amount/interval and the legal pages before enabling the API.
- Register the exact webhook endpoint and event allowlist, then verify Stripe test-mode Checkout, signed webhook replay, Portal, payment failure, renewal, and cancellation behavior.
- Apply the migrations through the controlled database gate, run the SQL negative and concurrency tests, confirm zero unexpected catalog drift, then run two-account authenticated UI checks.

Refund, delinquency grace, retention, reactivation, and production publication policies are intentionally not invented here. They remain separate decisions.
