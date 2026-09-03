import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { applyVerifiedStripeEvent } = await import("../lib/billing/platform/webhook-runtime.ts");
const activation = Object.freeze({
  kind: "activation", eventId: "evt_Fixture", eventHash: "a".repeat(64),
  attemptId: "a0030000-0000-4000-8000-000000000001", sessionId: "cs_test_Fixture",
  customerId: "cus_Fixture", subscriptionId: "sub_Fixture", amountTotal: 5000,
  currency: "jpy", paidAt: "2026-09-03T00:00:00.000Z"
});
const result = (product, resourceId) => ({
  eventStatus: "verified", subscriptionStatus: "active", productKey: product, planKey: "small",
  currentPeriodEndsAt: "2026-10-03T00:00:00.000Z",
  creation: { created: true, state: resourceId === null ? "available" : "consumed", productKey: product, planKey: "small", resourceId, expiresAt: "2026-10-03T00:00:00.000Z" }
});

async function callsFor(data, failures = new Set()) {
  const calls = [];
  await applyVerifiedStripeEvent(activation, async (name, args) => {
    calls.push({ name, args });
    return { data: name === "platform_billing_verified_subscription_activate" ? data : null, error: failures.has(name) ? { code: "fixture" } : null };
  });
  return calls;
}

const hq = "b0030000-0000-4000-8000-000000000001";
let calls = await callsFor(result("academy_platform", hq));
assert.deepEqual(calls.map(call => call.name), [
  "platform_billing_verified_subscription_activate",
  "academy_activate_paid_access_from_platform_subscription"
]);
assert.deepEqual(calls[1].args, { p_headquarters_id: hq });

for (const data of [result("academy_platform", null), result("community_platform", hq)]) {
  calls = await callsFor(data);
  assert.deepEqual(calls.map(call => call.name), ["platform_billing_verified_subscription_activate"]);
}

await assert.rejects(
  callsFor(result("academy_platform", hq), new Set(["platform_billing_verified_subscription_activate"])),
  /PLATFORM_BILLING_ACTIVATION_FAILED/
);
await assert.rejects(
  callsFor(result("academy_platform", hq), new Set(["academy_activate_paid_access_from_platform_subscription"])),
  /PLATFORM_BILLING_ACADEMY_ACTIVATION_FAILED/
);
for (const invalid of [null, {}, result("academy_platform", "raw-id"), { ...result("academy_platform", hq), eventStatus: "pending" }]) {
  await assert.rejects(callsFor(invalid), /PLATFORM_BILLING_INVALID_ACTIVATION_RESULT/);
}

const subscriptionCalls = [];
await applyVerifiedStripeEvent({
  kind: "invoice_failed", eventId: "evt_Failed", eventHash: "b".repeat(64), subscriptionId: "sub_Fixture",
  status: "past_due", periodStart: "2026-09-03T00:00:00.000Z", periodEnd: "2026-10-03T00:00:00.000Z",
  cancelAtPeriodEnd: false, occurredAt: "2026-09-03T01:00:00.000Z"
}, async (name, args) => { subscriptionCalls.push({ name, args }); return { data: {}, error: null }; });
assert.deepEqual(subscriptionCalls.map(call => call.name), ["platform_billing_subscription_event_apply"]);

const route = readFileSync(new URL("../app/api/billing/platform/webhook/stripe/route.ts", import.meta.url), "utf8");
assert.ok(route.indexOf("verifyStripeEvent") < route.indexOf("applyVerifiedStripeEvent"));
assert.doesNotMatch(readFileSync(new URL("../app/billing/success/page.tsx", import.meta.url), "utf8"), /academy_activate_paid_access/);
assert.doesNotMatch(readFileSync(new URL("../app/billing/return/page.tsx", import.meta.url), "utf8"), /academy_activate_paid_access/);

console.log("platform_billing_webhook_bridge_check_ok");
