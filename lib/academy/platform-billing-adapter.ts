import type { AcademyPlatformBillingState, AcademySubscriptionStatus } from "./platform-billing-view";

// Temporary, app-owned read projection of shared billing v0. No provider client,
// endpoints, access grants or mutation fallback. Replace the DTO validation with
// the shared decoder when its owner provides a reviewed contract.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isDate = (value: unknown) => value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));

/** Input must come from authenticated shared status API, not query/storage.
 * `owner` describes the intended audience only; this is not authorization.
 * All actions remain disabled in this slice, even if v0 lists allowedActions.
 */
export function projectAcademyPlatformBillingStatus(
  payload: unknown,
  expectedResourceId: string | null,
): AcademyPlatformBillingState {
  const unavailable = { kind: "unavailable" } as const;
  if (expectedResourceId !== null && !uuid.test(expectedResourceId)) return unavailable;
  if (!isRecord(payload) || !exactKeys(payload, ["version", "product", "resourceId", "availability", "subscription", "creation", "allowedActions", "noticeCode"])) return unavailable;
  if (payload.version !== 0 || payload.product !== "academy_platform" || payload.resourceId !== expectedResourceId) return unavailable;
  // V0 has no approved notice codes yet. Do not ignore a future blocking notice.
  if (payload.noticeCode !== null || payload.availability !== "ready") return unavailable;
  if (!Array.isArray(payload.allowedActions) || payload.allowedActions.some((action) => !["checkout", "portal", "create_resource"].includes(action)) || new Set(payload.allowedActions).size !== payload.allowedActions.length) return unavailable;
  if (!isRecord(payload.creation) || !exactKeys(payload.creation, ["state"]) || !["none", "pending", "available", "consumed"].includes(String(payload.creation.state))) return unavailable;
  let subscriptionStatus: AcademySubscriptionStatus = "none";
  let accessEndsAt: string | null = null;
  if (payload.subscription !== null) {
    const subscription = payload.subscription;
    if (!isRecord(subscription) || !exactKeys(subscription, ["state", "planKey", "currentPeriodEndsAt", "cancelAtPeriodEnd"])) return unavailable;
    if (typeof subscription.planKey !== "string" || !subscription.planKey.trim() || !isDate(subscription.currentPeriodEndsAt) || typeof subscription.cancelAtPeriodEnd !== "boolean") return unavailable;
    const states: Record<string, AcademySubscriptionStatus> = { pending: "processing", trialing: "trialing", active: "active", past_due: "past_due", ended: "ended" };
    if (typeof subscription.state !== "string" || !Object.hasOwn(states, subscription.state)) return unavailable;
    subscriptionStatus = states[subscription.state];
    if (subscription.cancelAtPeriodEnd) {
      if (!["active", "trialing", "past_due"].includes(subscription.state) || subscription.currentPeriodEndsAt === null) return unavailable;
      // Payment failure must remain visible even when cancellation is scheduled.
      if (subscription.state !== "past_due") subscriptionStatus = "cancel_scheduled";
    }
    if (subscription.cancelAtPeriodEnd || subscription.state === "trialing" || subscription.state === "ended") {
      accessEndsAt = subscription.currentPeriodEndsAt as string | null;
    }
  }
  // Neither paid nor a consumed creation grant proves present HQ access.
  return {
    kind: "owner",
    subscriptionStatus,
    constructionPurchase: "unverified",
    headquartersState: "unverified",
    nextInvoice: null,
    accessEndsAt,
    snapshot: null,
  };
}

export type AcademyBillingReadTransport = {
  getAccessToken: () => Promise<string | null>;
  fetch: typeof globalThis.fetch;
};

/** Read only. Request-local token; no cookie auth, external URLs or retry loop.
 * Caller must discard this response when account/HQ changes or signal aborts.
 */
export async function readAcademyPlatformBillingStatus(
  resourceId: string | null,
  transport: AcademyBillingReadTransport,
  signal?: AbortSignal,
): Promise<AcademyPlatformBillingState> {
  const unavailable = { kind: "unavailable" } as const;
  if (resourceId !== null && !uuid.test(resourceId)) return unavailable;
  if (signal?.aborted) return unavailable;
  try {
    const token = await transport.getAccessToken();
    if (!token?.trim()) return { kind: "sign_in_required" };
    if (signal?.aborted) return unavailable;
    const query = new URLSearchParams({ product: "academy_platform" });
    if (resourceId !== null) query.set("resourceId", resourceId);
    const response = await transport.fetch(`/api/billing/platform/status?${query}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
    });
    if (signal?.aborted) return unavailable;
    if (response.status === 401) return { kind: "sign_in_required" };
    // 404 may mean absent API or inaccessible resource; do not disclose which.
    if (!response.ok) return unavailable;
    const payload: unknown = await response.json();
    if (signal?.aborted) return unavailable;
    return projectAcademyPlatformBillingStatus(payload, resourceId);
  } catch {
    return unavailable;
  }
}
