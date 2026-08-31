import type { AcademyPlatformBillingState, AcademySubscriptionStatus } from "./platform-billing-view";

// Temporary, app-owned read projection of shared billing v0. No provider client,
// endpoints, access grants or mutation fallback. Replace the DTO validation with
// the shared decoder when its owner provides a reviewed contract.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isDate = (value: unknown) => value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const notices = {
  AUTH_REQUIRED: "sign_in_required", RESOURCE_UNAVAILABLE: "unavailable",
  STATE_CONFLICT: "state_conflict", INVALID_REQUEST: "invalid_request",
  BILLING_NOT_CONFIGURED: "not_configured", POLICY_PENDING: "policy_pending",
} as const;
const noticeState = (code: unknown): AcademyPlatformBillingState => ({
  kind: typeof code === "string" && Object.hasOwn(notices, code) ? notices[code as keyof typeof notices] : "unavailable",
});

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
  if (!["ready", "not_configured", "policy_pending"].includes(String(payload.availability))) return unavailable;
  if (payload.noticeCode !== null && (typeof payload.noticeCode !== "string" || !Object.hasOwn(notices, payload.noticeCode))) return unavailable;
  if (!Array.isArray(payload.allowedActions) || payload.allowedActions.some((action) => !["checkout", "portal", "create_resource"].includes(action)) || new Set(payload.allowedActions).size !== payload.allowedActions.length) return unavailable;
  if ((payload.noticeCode !== null || payload.availability !== "ready") && payload.allowedActions.length !== 0) return unavailable;
  if (!isRecord(payload.creation) || !exactKeys(payload.creation, ["state"]) || !["none", "pending", "available", "consumed"].includes(String(payload.creation.state))) return unavailable;
  let subscriptionStatus: AcademySubscriptionStatus = "none";
  let accessEndsAt: string | null = null;
  if (payload.subscription !== null) {
    const subscription = payload.subscription;
    if (!isRecord(subscription) || !exactKeys(subscription, ["state", "planKey", "currentPeriodEndsAt", "cancelAtPeriodEnd"])) return unavailable;
    if (typeof subscription.planKey !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(subscription.planKey) || !isDate(subscription.currentPeriodEndsAt) || typeof subscription.cancelAtPeriodEnd !== "boolean") return unavailable;
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
  if (payload.noticeCode !== null) return noticeState(payload.noticeCode);
  if (payload.availability !== "ready") return { kind: payload.availability === "policy_pending" ? "policy_pending" : "not_configured" };
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
    if (!response.ok) {
      const error: unknown = await response.json();
      if (!isRecord(error) || !exactKeys(error, ["error"]) || !isRecord(error.error) || !exactKeys(error.error, ["code"])) return unavailable;
      const statuses: Record<string, number> = { RESOURCE_UNAVAILABLE: 404, STATE_CONFLICT: 409, INVALID_REQUEST: 422, BILLING_NOT_CONFIGURED: 503, POLICY_PENDING: 503 };
      const code = error.error.code;
      if (typeof code !== "string" || !Object.hasOwn(statuses, code) || statuses[code] !== response.status || signal?.aborted) return unavailable;
      return noticeState(code);
    }
    const payload: unknown = await response.json();
    if (signal?.aborted) return unavailable;
    return projectAcademyPlatformBillingStatus(payload, resourceId);
  } catch {
    return unavailable;
  }
}
