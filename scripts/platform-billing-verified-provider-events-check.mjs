import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260902171944_platform_billing_verified_provider_events.sql"),
  "utf8",
);
const test = readFileSync(
  resolve(root, "supabase/tests/platform_billing_verified_provider_events.sql"),
  "utf8",
);

const requireText = (text, fragment, label) => {
  if (!text.includes(fragment)) throw new Error(`missing ${label}`);
};

for (const [fragment, label] of [
  ["create table platform_billing_private.verified_provider_events", "private event table"],
  ["attempt_id uuid not null unique", "one event per attempt"],
  ["provider_event_id text not null unique", "event identity uniqueness"],
  ["provider_event_hash text not null unique", "event hash uniqueness"],
  ["provider_session_id text not null unique", "session uniqueness"],
  ["alter table platform_billing_private.verified_provider_events enable row level security", "RLS"],
  ["revoke all on table platform_billing_private.verified_provider_events", "direct ACL denial"],
  ["create function platform_billing_private.require_verified_paid_source()", "paid source trigger"],
  ["message = 'PLATFORM_BILLING_VERIFIED_EVENT_REQUIRED'", "paid fail closed"],
  ["create function public.platform_billing_verified_payment_grant(", "verified grant RPC"],
  ["from platform_billing_private.scopes scope", "scope lock"],
  ["for update of quote", "quote lock"],
  ["from platform_billing_private.attempts attempt", "attempt reread"],
  ["v_attempt.status <> 'provider_ready'", "ready-only gate"],
  ["v_attempt.provider_session_id is distinct from p_provider_session_id", "session binding"],
  ["v_quote.payload->>'purchaseIntent' is distinct from 'explicit_paid_start'", "paid intent binding"],
  ["v_quote.payload#>'{policies,approved}' is distinct from 'true'::jsonb", "approved policy binding"],
  ["platform_billing_private.next_month_at(p_paid_at)", "one calendar month"],
  ["'verified_paid'", "verified paid source"],
  ["jsonb_build_object('eventStatus', 'verified')", "narrow event status"],
  ["from public, anon, authenticated;", "browser execute denial"],
  ["to service_role;", "service-only execute"],
]) requireText(migration, fragment, label);

for (const forbidden of [
  "raw_payload",
  "raw_event",
  "customer_email",
  "customer_name",
  "provider_secret",
  "stripe_secret",
  "refund",
  "grace_period",
  "auto_charge",
]) {
  if (migration.toLowerCase().includes(forbidden)) {
    throw new Error(`forbidden provider/payment expansion: ${forbidden}`);
  }
}

for (const [fragment, label] of [
  ["set local role anon", "anon negative test"],
  ["set local role authenticated", "authenticated negative test"],
  ["set local role service_role", "service runtime"],
  ["PLATFORM_BILLING_VERIFIED_EVENT_REQUIRED", "old paid grant bypass test"],
  ["PLATFORM_BILLING_VERIFIED_EVENT_SCOPE_MISMATCH", "unready/uncertain test"],
  ["PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT", "replay conflict tests"],
  ["same event and hash is idempotent", "idempotent replay"],
  ["provider proof fields never returned", "server-only proof fields"],
  ["status projection reports app-owned grant", "status projection"],
  ["same JST time and month-end fallback", "monthly schedule test"],
  ["platform_billing_verified_provider_events_test_ok", "success sentinel"],
]) requireText(test, fragment, label);

console.log("platform billing verified provider event contract: ok");
