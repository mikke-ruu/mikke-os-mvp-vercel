# Platform billing creation entitlement contract

Status: local contract for Academy/Community integration. No production DB, provider, or public route is enabled by this document.

## Ownership

- The common platform-billing layer owns grant issuance and status projection.
- The app layer owns atomic consumption while creating its resource.
- Browsers cannot grant, edit, delete, or consume a ledger row directly.
- Academy and Community use separate `productKey` values and cannot consume each other's grants.

## Server-only grant input

```ts
type GrantCreationEntitlementV1 = {
  actorUserId: string; // UUID of the verified owner receiving the grant
  productKey: 'academy_platform' | 'community_platform';
  resourceId: null; // creation grants are unbound until atomic consumption
  planKey: string;
  source: {
    kind: 'verified_trial' | 'verified_paid';
    attemptId: string; // UUID of the authoritative verified source attempt/event
  };
  startsAt: string; // canonical UTC timestamp
  expiresAt: string | null; // required for trial; null allowed only for paid
  idempotencyKey: string; // UUID stable for the same logical grant
};
```

`actorUserId` is the beneficiary owner, not proof that the caller is authorized. The database function is executable only by the server role and must load the authoritative source attempt/event itself.

## Grant validation

Before insert, the common server/DB layer must lock and re-read the authoritative source attempt/event and verify all of the following:

- payment/trial verification is final and not inferred from a return URL, browser state, existing resource, purchase code, membership, or app usage;
- source owner, product and plan exactly match `actorUserId`, `productKey` and `planKey`;
- `resourceId` is null for a new-resource entitlement;
- `startsAt` is not after `expiresAt`; trial requires an expiry; paid does not inherit a trial expiry;
- the source attempt is not refunded, cancelled, revoked, uncertain or superseded;
- the same source attempt cannot grant a second entitlement;
- the same `idempotencyKey` returns the same row and rejects payload drift.

Required uniqueness:

- `(product_key, source_kind, source_attempt_id)`;
- `(actor_user_id, product_key, idempotency_key)`;
- one usable unconsumed grant per `(actor_user_id, product_key)` unless an explicit multi-resource policy is introduced later.

Identity fields are immutable. Grant rows are append-only apart from the allowed terminal transition to `consumed`, `expired` or `revoked`. No browser role receives table privileges or function EXECUTE.

## Status projection

`GET /api/billing/platform/status` projects only the common authoritative ledger:

- `resourceId=null` and one usable grant: `creation.state='available'` and `create_resource` is allowed;
- source verification still pending: `creation.state='pending'`, with no create action;
- expired/revoked/no grant: `creation.state='none'`, with no create action;
- a grant already bound to a created resource: `creation.state='consumed'`; the response never makes creation available again;
- unknown, conflicting or unavailable data fails closed and must never become `available`.

The projection must not infer creation rights from an existing Community, Community membership/staff role, Academy claim, manual/subscription Community entitlement, purchase code, checkout success query, or provider redirect.

## Atomic app consumption

The app-owned create function follows this order in one transaction:

1. verify authenticated non-anonymous `auth.uid()`;
2. lock the creation-entitlement row first;
3. re-read and validate owner, product, state, start/expiry and unbound `resource_id`;
4. create the app resource;
5. bind the new resource UUID and move the entitlement to `consumed`;
6. return the new resource only after both writes succeed.

For Community, the public mutation must be a guarded Community-owned RPC such as `community_create_with_platform_entitlement(...)`. The old browser-callable `community_create` path must either delegate to the same locked contract or lose authenticated EXECUTE. UI gating alone is insufficient.

Concurrent calls for the same entitlement must yield exactly one Community and one consumed grant. The loser receives a stable conflict error; no duplicate row or partial mutation remains.

## Mandatory negative tests

- unauthenticated and anonymous Auth;
- another owner and another product;
- missing, pending, expired, revoked, refunded, cancelled and uncertain source;
- payload drift with the same idempotency key;
- reused source attempt;
- direct table insert/update/delete/truncate;
- direct old `community_create` bypass;
- two concurrent create calls;
- failure after resource insert rolls back both resource and consumption;
- Academy-derived Room access and normal Community manual/subscription rights remain unchanged.

## Current gate

This contract permits Community to implement the guarded create path and negative tests locally. It does not authorize production migration, provider connection, billing enablement, push, PR, deploy, publication, or customer access.
