import "server-only";
import type { VerifiedStripeEvent } from "./stripe";

type RpcResult = Readonly<{ data: unknown; error: unknown }>;
export type PlatformWebhookRpc = (name: string, args: Readonly<Record<string, unknown>>) => Promise<RpcResult>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function activatedResource(value: unknown): { product: "academy_platform" | "community_platform"; resourceId: string | null } {
  if (!isRecord(value)
    || value.eventStatus !== "verified"
    || value.subscriptionStatus !== "active"
    || (value.productKey !== "academy_platform" && value.productKey !== "community_platform")
    || !isRecord(value.creation)
    || (value.creation.state !== "available" && value.creation.state !== "consumed")) {
    throw new Error("PLATFORM_BILLING_INVALID_ACTIVATION_RESULT");
  }
  const resourceId = value.creation.resourceId;
  if (resourceId !== null && (typeof resourceId !== "string" || !uuid.test(resourceId))) {
    throw new Error("PLATFORM_BILLING_INVALID_ACTIVATION_RESULT");
  }
  if ((resourceId === null) !== (value.creation.state === "available")) {
    throw new Error("PLATFORM_BILLING_INVALID_ACTIVATION_RESULT");
  }
  return { product: value.productKey, resourceId };
}

export async function applyVerifiedStripeEvent(event: VerifiedStripeEvent, rpc: PlatformWebhookRpc): Promise<void> {
  if (event.kind !== "activation") {
    const result = await rpc("platform_billing_subscription_event_apply", {
      p_provider_subscription_id: event.subscriptionId,
      p_provider_event_id: event.eventId,
      p_provider_event_hash: event.eventHash,
      p_event_kind: event.kind,
      p_projected_status: event.status,
      p_period_start: event.periodStart,
      p_period_end: event.periodEnd,
      p_cancel_at_period_end: event.kind === "subscription_state" ? event.cancelAtPeriodEnd : null,
      p_occurred_at: event.occurredAt
    });
    if (result.error) throw new Error("PLATFORM_BILLING_EVENT_APPLY_FAILED");
    return;
  }

  const result = await rpc("platform_billing_verified_subscription_activate", {
    p_attempt_id: event.attemptId,
    p_provider_event_id: event.eventId,
    p_provider_event_hash: event.eventHash,
    p_provider_session_id: event.sessionId,
    p_provider_customer_id: event.customerId,
    p_provider_subscription_id: event.subscriptionId,
    p_amount_total: event.amountTotal,
    p_currency: event.currency,
    p_paid_at: event.paidAt
  });
  if (result.error) throw new Error("PLATFORM_BILLING_ACTIVATION_FAILED");

  const activation = activatedResource(result.data);
  if (activation.product === "academy_platform" && activation.resourceId !== null) {
    const academy = await rpc("academy_activate_paid_access_from_platform_subscription", {
      p_headquarters_id: activation.resourceId
    });
    if (academy.error) throw new Error("PLATFORM_BILLING_ACADEMY_ACTIVATION_FAILED");
  }
}
