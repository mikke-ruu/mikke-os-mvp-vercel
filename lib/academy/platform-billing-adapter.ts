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
 * Listed actions are only UI capabilities. The shared API must re-authorize every
 * mutation and remains the authority for subscription and access state.
 */
export function projectAcademyPlatformBillingStatus(
  payload: unknown,
  expectedResourceId: string | null,
): AcademyPlatformBillingState {
  const unavailable = { kind: "unavailable" } as const;
  if (expectedResourceId !== null && !uuid.test(expectedResourceId)) return unavailable;
  if (!isRecord(payload) || !exactKeys(payload, ["version", "product", "resourceId", "availability", "subscription", "creation", "allowedActions", "noticeCode"])) return unavailable;
  if (payload.version !== 0 || payload.product !== "academy_platform" || payload.resourceId !== expectedResourceId) return unavailable;
  if (typeof payload.availability !== "string" || !["ready", "not_configured", "policy_pending"].includes(payload.availability)) return unavailable;
  if (payload.noticeCode !== null && (typeof payload.noticeCode !== "string" || !Object.hasOwn(notices, payload.noticeCode))) return unavailable;
  if (!Array.isArray(payload.allowedActions) || payload.allowedActions.some((action) => !["checkout", "portal", "create_resource"].includes(action)) || new Set(payload.allowedActions).size !== payload.allowedActions.length) return unavailable;
  if ((payload.noticeCode !== null || payload.availability !== "ready") && payload.allowedActions.length !== 0) return unavailable;
  if (!isRecord(payload.creation) || !exactKeys(payload.creation, ["state"]) || typeof payload.creation.state !== "string" || !["none", "pending", "available", "consumed"].includes(payload.creation.state)) return unavailable;
  let subscriptionStatus: AcademySubscriptionStatus = "none";
  let accessEndsAt: string | null = null;
  let planKey: string | null = null;
  if (payload.subscription !== null) {
    const subscription = payload.subscription;
    if (!isRecord(subscription) || !exactKeys(subscription, ["state", "planKey", "currentPeriodEndsAt", "cancelAtPeriodEnd"])) return unavailable;
    if (typeof subscription.planKey !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(subscription.planKey) || !isDate(subscription.currentPeriodEndsAt) || typeof subscription.cancelAtPeriodEnd !== "boolean") return unavailable;
    const states: Record<string, AcademySubscriptionStatus> = { pending: "processing", trialing: "trialing", active: "active", past_due: "past_due", ended: "ended" };
    if (typeof subscription.state !== "string" || !Object.hasOwn(states, subscription.state)) return unavailable;
    subscriptionStatus = states[subscription.state];
    planKey = subscription.planKey;
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
    allowedActions: [...payload.allowedActions] as Array<"checkout" | "portal" | "create_resource">,
    planKey,
    snapshot: null,
  };
}

export type AcademyBillingReadTransport = {
  getAccessToken: () => Promise<string | null>;
  fetch: typeof globalThis.fetch;
};

const policyNames = ["terms", "privacy", "refund", "cancellation", "proration", "renewal", "commercialDisclosure"] as const;
export type AcademyBillingPolicyName = typeof policyNames[number];
export type AcademyBillingQuote = Readonly<{
  quoteId: string;
  revision: number;
  scope: Readonly<{ ownerUserId: string; resourceId: string | null; planKey: string; requestId: string }>;
  dueNow: Readonly<{ totalYen: number; dueOn: string }>;
  nextPayment: Readonly<{ totalYen: number; dueOn: string }>;
  merchant: Readonly<{ legalName: string; address: string; contactUrl: string }>;
  policies: Readonly<Record<AcademyBillingPolicyName, Readonly<{ version: string; url: string }>>>;
  expiresAt: string;
}>;

const token = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const validDay = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
};
const canonicalTime = (value: unknown) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const safeText = (value: unknown, limit = 500) => typeof value === "string" && value.length > 0
  && value.length <= limit && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const safeHttps = (value: unknown) => {
  if (!safeText(value, 2048)) return false;
  try {
    const url = new URL(value as string);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
  } catch { return false; }
};

export function decodeAcademyBillingQuote(payload: unknown, expected: {
  userId: string; resourceId: string | null; planKey: string; requestId: string; now?: Date;
}): AcademyBillingQuote | null {
  const now = expected.now ?? new Date();
  if (!uuid.test(expected.userId) || (expected.resourceId !== null && !uuid.test(expected.resourceId))
    || !/^[a-z][a-z0-9_]{0,39}$/.test(expected.planKey) || !uuid.test(expected.requestId)
    || !Number.isFinite(now.getTime()) || !isRecord(payload)
    || !exactKeys(payload, ["quoteId", "revision", "purchaseIntent", "scope", "currency", "taxIncluded", "dueNow", "nextPayment", "merchant", "policies", "issuedAt", "expiresAt"])) return null;
  if (!token(payload.quoteId) || !Number.isSafeInteger(payload.revision) || Number(payload.revision) < 1
    || payload.purchaseIntent !== "explicit_paid_start" || payload.currency !== "JPY" || payload.taxIncluded !== true
    || !canonicalTime(payload.issuedAt) || !canonicalTime(payload.expiresAt)
    || Date.parse(payload.issuedAt as string) > now.getTime() || Date.parse(payload.expiresAt as string) <= now.getTime()) return null;
  const scope = payload.scope;
  if (!isRecord(scope) || !exactKeys(scope, ["ownerUserId", "productKey", "resourceId", "planKey", "requestId"])
    || scope.ownerUserId !== expected.userId || scope.productKey !== "academy_platform" || scope.resourceId !== expected.resourceId
    || scope.planKey !== expected.planKey || scope.requestId !== expected.requestId) return null;
  const dueNow = payload.dueNow;
  const nextPayment = payload.nextPayment;
  if (!isRecord(dueNow) || !exactKeys(dueNow, ["totalYen", "dueOn"]) || !integer(dueNow.totalYen) || !validDay(dueNow.dueOn)
    || !isRecord(nextPayment) || !exactKeys(nextPayment, ["totalYen", "dueOn"]) || !integer(nextPayment.totalYen) || !validDay(nextPayment.dueOn)
    || String(nextPayment.dueOn) <= String(dueNow.dueOn)) return null;
  const merchant = payload.merchant;
  if (!isRecord(merchant) || !exactKeys(merchant, ["merchantId", "legalName", "address", "contactUrl"])
    || !token(merchant.merchantId) || !safeText(merchant.legalName, 300) || !safeText(merchant.address)
    || !safeHttps(merchant.contactUrl)) return null;
  const policies = payload.policies;
  if (!isRecord(policies) || !exactKeys(policies, ["approved", "approvalId", "revision", ...policyNames])
    || policies.approved !== true || !token(policies.approvalId) || !Number.isSafeInteger(policies.revision) || Number(policies.revision) < 1) return null;
  const decodedPolicies = {} as Record<AcademyBillingPolicyName, { version: string; url: string }>;
  for (const name of policyNames) {
    const policy = policies[name];
    if (!isRecord(policy) || !exactKeys(policy, ["version", "url"]) || !token(policy.version) || !safeHttps(policy.url)) return null;
    decodedPolicies[name] = { version: policy.version as string, url: policy.url as string };
  }
  return Object.freeze({
    quoteId: payload.quoteId as string,
    revision: payload.revision as number,
    scope: Object.freeze({ ownerUserId: expected.userId, resourceId: expected.resourceId, planKey: expected.planKey, requestId: expected.requestId }),
    dueNow: Object.freeze({ totalYen: dueNow.totalYen as number, dueOn: dueNow.dueOn as string }),
    nextPayment: Object.freeze({ totalYen: nextPayment.totalYen as number, dueOn: nextPayment.dueOn as string }),
    merchant: Object.freeze({ legalName: merchant.legalName as string, address: merchant.address as string, contactUrl: merchant.contactUrl as string }),
    policies: Object.freeze(decodedPolicies),
    expiresAt: payload.expiresAt as string,
  });
}

export type AcademyBillingMutationResult =
  | { kind: "redirect"; url: string }
  | { kind: "pending" }
  | { kind: "sign_in_required" | "unavailable" | "not_configured" | "policy_pending" | "state_conflict" | "invalid_request" };

export type AcademyBillingQuoteResult = { kind: "quote"; quote: AcademyBillingQuote }
  | Exclude<AcademyBillingMutationResult, { kind: "redirect" | "pending" }>;

function isApprovedBillingRedirect(value: unknown, action: "checkout" | "portal"): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && url.hostname === (action === "checkout" ? "checkout.stripe.com" : "billing.stripe.com");
  } catch {
    return false;
  }
}

async function mutateAcademyPlatformBilling(
  action: "portal",
  resourceId: string | null,
  requestId: string,
  transport: AcademyBillingReadTransport,
  signal?: AbortSignal,
): Promise<AcademyBillingMutationResult> {
  const unavailable = { kind: "unavailable" } as const;
  if (resourceId === null || !uuid.test(resourceId) || !uuid.test(requestId)) return { kind: "invalid_request" };
  if (signal?.aborted) return unavailable;
  try {
    const token = await transport.getAccessToken();
    if (!token?.trim()) return { kind: "sign_in_required" };
    const body = { product: "academy_platform", resourceId, requestId };
    const response = await transport.fetch(`/api/billing/platform/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
    });
    if (signal?.aborted) return unavailable;
    const payload: unknown = await response.json();
    if (!response.ok) {
      if (!isRecord(payload) || !exactKeys(payload, ["error"]) || !isRecord(payload.error) || !exactKeys(payload.error, ["code"])) return unavailable;
      const code = payload.error.code;
      if (response.status === 401 && code === "AUTH_REQUIRED") return { kind: "sign_in_required" };
      const statuses: Record<string, number> = { RESOURCE_UNAVAILABLE: 404, STATE_CONFLICT: 409, INVALID_REQUEST: 422, BILLING_NOT_CONFIGURED: 503, POLICY_PENDING: 503 };
      if (typeof code !== "string" || !Object.hasOwn(statuses, code) || statuses[code] !== response.status) return unavailable;
      return noticeState(code) as AcademyBillingMutationResult;
    }
    if (!isRecord(payload) || !exactKeys(payload, ["version", "redirectUrl"]) || payload.version !== 0
      || !isApprovedBillingRedirect(payload.redirectUrl, action)) return unavailable;
    return { kind: "redirect", url: payload.redirectUrl };
  } catch {
    return unavailable;
  }
}

async function billingError(response: Response): Promise<AcademyBillingMutationResult> {
  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !exactKeys(payload, ["error"]) || !isRecord(payload.error) || !exactKeys(payload.error, ["code"])) return { kind: "unavailable" };
    const code = payload.error.code;
    if (response.status === 401 && code === "AUTH_REQUIRED") return { kind: "sign_in_required" };
    const statuses: Record<string, number> = { RESOURCE_UNAVAILABLE: 404, STATE_CONFLICT: 409, INVALID_REQUEST: 422, BILLING_NOT_CONFIGURED: 503, POLICY_PENDING: 503 };
    if (typeof code !== "string" || !Object.hasOwn(statuses, code) || statuses[code] !== response.status) return { kind: "unavailable" };
    return noticeState(code) as AcademyBillingMutationResult;
  } catch { return { kind: "unavailable" }; }
}

export async function requestAcademyPlatformBillingQuote(userId: string, resourceId: string | null, planKey: string, requestId: string, transport: AcademyBillingReadTransport, signal?: AbortSignal): Promise<AcademyBillingQuoteResult> {
  if (!uuid.test(userId) || (resourceId !== null && !uuid.test(resourceId)) || !/^[a-z][a-z0-9_]{0,39}$/.test(planKey) || !uuid.test(requestId)) return { kind: "invalid_request" };
  if (signal?.aborted) return { kind: "unavailable" };
  try {
    const accessToken = await transport.getAccessToken();
    if (!accessToken?.trim()) return { kind: "sign_in_required" };
    const response = await transport.fetch("/api/billing/platform/quote", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ product: "academy_platform", resourceId, planKey, requestId }),
      cache: "no-store", credentials: "omit", redirect: "error", signal,
    });
    if (!response.ok) return await billingError(response) as AcademyBillingQuoteResult;
    const quote = decodeAcademyBillingQuote(await response.json(), { userId, resourceId, planKey, requestId });
    return quote ? { kind: "quote", quote } : { kind: "unavailable" };
  } catch { return { kind: "unavailable" }; }
}

export async function confirmAcademyPlatformCheckout(quote: AcademyBillingQuote, transport: AcademyBillingReadTransport, signal?: AbortSignal): Promise<AcademyBillingMutationResult> {
  if (signal?.aborted) return { kind: "unavailable" };
  try {
    const accessToken = await transport.getAccessToken();
    if (!accessToken?.trim()) return { kind: "sign_in_required" };
    const response = await transport.fetch("/api/billing/platform/checkout", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1, product: "academy_platform", resourceId: quote.scope.resourceId,
        planKey: quote.scope.planKey, requestId: quote.scope.requestId,
        consent: { quoteId: quote.quoteId, revision: quote.revision, termsVersion: quote.policies.terms.version, accepted: true },
      }),
      cache: "no-store", credentials: "omit", redirect: "error", signal,
    });
    if (!response.ok) return await billingError(response);
    const payload: unknown = await response.json();
    if (!isRecord(payload)) return { kind: "unavailable" };
    if (exactKeys(payload, ["state"]) && payload.state === "pending") return { kind: "pending" };
    if (exactKeys(payload, ["state", "redirectUrl"]) && payload.state === "redirect" && isApprovedBillingRedirect(payload.redirectUrl, "checkout")) {
      return { kind: "redirect", url: payload.redirectUrl as string };
    }
    return { kind: "unavailable" };
  } catch { return { kind: "unavailable" }; }
}

export function openAcademyPlatformBillingPortal(resourceId: string, requestId: string, transport: AcademyBillingReadTransport, signal?: AbortSignal) {
  return mutateAcademyPlatformBilling("portal", resourceId, requestId, transport, signal);
}

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
