# Fund F4-b2 Handoff

Date: 2026-07-15
Repository: `G:/Musubiプロジェクト/mikke-os-mvp`

## Completed

- Applied `20260714222029_fund_f4_b2_claims_and_participations.sql` to the linked Supabase database.
- Added `fund_support_claims`, `fund_participations`, and `fund_public_participations`.
- Raw invitation tokens are returned only once from `create_fund_support_claim`; the database retains only a SHA-256 hash.
- Direct browser writes to claims, participations, and the public projection are denied. The limited RPCs are:
  - `create_fund_support_claim(uuid, timestamptz)`
  - `revoke_fund_support_claim(uuid)`
  - `accept_fund_support_claim(text)`
  - `update_fund_participation_consent(uuid, text, text, text, text)`
- The public projection is created only when the project is `public`, the support record is `valid`, both consents are `granted`, and the display mode is not `hidden`. Consent revocation, project visibility changes, and support invalidation remove it through triggers.
- Fund UI remains localStorage-backed. F4-c is responsible for invite and supporter-facing screens.

## Verification

- Local and remote migration history both include `20260714222029`.
- `supabase/tests/fund_f4_b2_rls.sql` passed against the linked database and rolls back all fixtures.
  - owner claim creation and owner-only claim visibility
  - supporter cannot read private support records
  - supporter accepts once and cannot directly update participation ownership/consent
  - supporter cannot change owner consent through RPC
  - redeemed, revoked, and expired tokens are rejected
  - public projection appears only after both consents plus public project visibility
  - anonymous read of the projection succeeds; owner revocation removes it
- `npm.cmd run lint` passed.
- `npm.cmd run build` could not start because another Next build process already owns the workspace lock. Do not remove the lock or stop the other process without confirming it is no longer needed; rerun the build once it exits.

## Advisor note

Database Advisor reports the four Fund RPCs as authenticated-callable `SECURITY DEFINER` functions. This is intentional for F4-b2: each function checks `auth.uid()`, uses a fixed empty search path, has explicit grants (no anon grant), and is required to perform the constrained multi-table transaction. Existing Academy warnings and leaked-password-protection warning are outside Fund scope.

## Next

1. Rerun `npm.cmd run build` after the existing Next build process finishes.
2. Review and commit only the two F4-b2 files below; keep existing Manager changes separate.
3. Start F4-c only after that checkpoint: invite acceptance and `/fund/me` UI backed by these RPCs, then private Activity Log integration.

## Files to commit for F4-b2

- `supabase/migrations/20260714222029_fund_f4_b2_claims_and_participations.sql`
- `supabase/tests/fund_f4_b2_rls.sql`
- `docs/MIKKEOS_FUND_F4_B2_HANDOFF_2026-07-15.md`
