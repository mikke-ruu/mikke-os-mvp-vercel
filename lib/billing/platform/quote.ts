/**
 * Pure, server-side final-confirmation contract. This is NOT Stripe integration.
 *
 * `quote` MUST be loaded from a server-owned, immutable quote store by quoteId.
 * NEVER validate a browser-supplied quote and then treat it as authoritative.
 * `expected` MUST come from authenticated ownership/product authorization and
 * the CURRENT approved policy registry, not from the request body. Re-check it
 * at execution time. Validation does not authenticate, charge, grant access,
 * reserve a price, deduplicate a payment, or replace an atomic server commit.
 *
 * Prices/dates/refund/proration rules are supplied by approved server sources;
 * this module invents none. Academy's 7-day and Community's 30-day free trials
 * remain separate, non-auto-charging flows. Only an explicit paid application
 * can use this contract; expiry of a free trial is NOT purchase consent.
 */
export type BillingScope = Readonly<{
  ownerUserId: string;
  productKey: string;
  resourceId: string | null;
  planKey: string;
  requestId: string;
}>;

export type BillingSelection = BillingScope & Readonly<{
  policyApprovalId: string;
  policyRevision: number;
}>;

export type BillingPolicyReference = Readonly<{ version: string; url: string }>;

export type PlatformBillingQuote = Readonly<{
  quoteId: string;
  revision: number;
  purchaseIntent: "explicit_paid_start";
  scope: BillingScope;
  currency: "JPY";
  taxIncluded: true;
  dueNow: Readonly<{ totalYen: number; dueOn: string }>;
  nextPayment: Readonly<{ totalYen: number; dueOn: string }>;
  merchant: Readonly<{
    merchantId: string;
    legalName: string;
    address: string;
    contactUrl: string;
  }>;
  policies: Readonly<{
    approved: true;
    approvalId: string;
    revision: number;
    terms: BillingPolicyReference;
    privacy: BillingPolicyReference;
    refund: BillingPolicyReference;
    cancellation: BillingPolicyReference;
    proration: BillingPolicyReference;
    renewal: BillingPolicyReference;
    commercialDisclosure: BillingPolicyReference;
  }>;
  issuedAt: string;
  expiresAt: string;
}>;

/** The only accepted browser confirmation fields; no price, owner or plan. */
export type BillingQuoteConsent = Readonly<{
  quoteId: string;
  revision: number;
  termsVersion: string;
  accepted: true;
}>;

export type QuoteValidationCode =
  | "INVALID_QUOTE"
  | "INVALID_CONTEXT"
  | "CONTEXT_MISMATCH"
  | "UNRESOLVED_PRICE"
  | "INVALID_SCHEDULE"
  | "POLICY_UNAPPROVED"
  | "POLICY_CHANGED"
  | "QUOTE_NOT_YET_VALID"
  | "QUOTE_EXPIRED"
  | "CONSENT_MISMATCH";

export type QuoteValidationResult =
  | Readonly<{ ok: true; quote: PlatformBillingQuote }>
  | Readonly<{ ok: false; code: QuoteValidationCode }>;

type UnknownRecord = Record<string, unknown>;
const policyNames = ["terms", "privacy", "refund", "cancellation", "proration", "renewal", "commercialDisclosure"] as const;
const scopeKeys = ["ownerUserId", "productKey", "resourceId", "planKey", "requestId"] as const;

function exact(value: unknown, keys: readonly string[]): value is UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length && actual.every((key) => typeof key === "string" && keys.includes(key));
}

function token(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
}

function text(value: unknown, limit = 300): value is string {
  return typeof value === "string" && value.length <= limit && value.trim() === value && value.length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}

function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function httpsUrl(value: unknown): value is string {
  if (!text(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !!url.hostname;
  } catch { return false; }
}

/** Canonical UTC milliseconds; rejects relative dates, infinity and rollovers. */
function instant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

/** A known JST calendar day, not a locale-dependent date or an estimate. */
function day(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function validScope(value: unknown): value is UnknownRecord {
  return exact(value, scopeKeys) && token(value.ownerUserId) && token(value.productKey) && token(value.planKey) && token(value.requestId)
    && (value.resourceId === null || token(value.resourceId));
}

function payment(value: unknown): value is UnknownRecord {
  return exact(value, ["totalYen", "dueOn"]) && typeof value.totalYen === "number"
    && Number.isSafeInteger(value.totalYen) && value.totalYen >= 0 && day(value.dueOn);
}

function reject(code: QuoteValidationCode): QuoteValidationResult { return { ok: false, code }; }

/** Return a detached frozen value, not an alias a caller could mutate later. */
function snapshot(quote: PlatformBillingQuote): PlatformBillingQuote {
  const policies = Object.fromEntries(policyNames.map((name) => [name, Object.freeze({ ...quote.policies[name] })]));
  return Object.freeze({
    ...quote,
    scope: Object.freeze({ ...quote.scope }),
    dueNow: Object.freeze({ ...quote.dueNow }),
    nextPayment: Object.freeze({ ...quote.nextPayment }),
    merchant: Object.freeze({ ...quote.merchant }),
    policies: Object.freeze({ ...quote.policies, ...policies }),
  });
}

export function validatePlatformBillingQuote(
  quote: unknown,
  expected: BillingSelection,
  now: Date,
): QuoteValidationResult {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !exact(expected, [...scopeKeys, "policyApprovalId", "policyRevision"])
    || !validScope({ ownerUserId: expected.ownerUserId, productKey: expected.productKey, resourceId: expected.resourceId, planKey: expected.planKey, requestId: expected.requestId })
    || !token(expected.policyApprovalId) || !revision(expected.policyRevision)) return reject("INVALID_CONTEXT");
  if (!exact(quote, ["quoteId", "revision", "purchaseIntent", "scope", "currency", "taxIncluded", "dueNow", "nextPayment", "merchant", "policies", "issuedAt", "expiresAt"])
    || !token(quote.quoteId) || !revision(quote.revision) || quote.purchaseIntent !== "explicit_paid_start" || !validScope(quote.scope)) return reject("INVALID_QUOTE");
  const scope = quote.scope;
  if (scopeKeys.some((key) => scope[key] !== expected[key])) return reject("CONTEXT_MISMATCH");
  if (quote.currency !== "JPY" || quote.taxIncluded !== true || !payment(quote.dueNow) || !payment(quote.nextPayment)) return reject("UNRESOLVED_PRICE");
  if (!exact(quote.merchant, ["merchantId", "legalName", "address", "contactUrl"])
    || !token(quote.merchant.merchantId) || !text(quote.merchant.legalName) || !text(quote.merchant.address, 500) || !httpsUrl(quote.merchant.contactUrl)) return reject("INVALID_QUOTE");
  if (!exact(quote.policies, ["approved", "approvalId", "revision", ...policyNames]) || quote.policies.approved !== true
    || !token(quote.policies.approvalId) || !revision(quote.policies.revision)) return reject("POLICY_UNAPPROVED");
  for (const name of policyNames) {
    const policy = quote.policies[name];
    if (!exact(policy, ["version", "url"]) || !token(policy.version) || !httpsUrl(policy.url)) return reject("POLICY_UNAPPROVED");
  }
  if (quote.policies.approvalId !== expected.policyApprovalId || quote.policies.revision !== expected.policyRevision) return reject("POLICY_CHANGED");
  if (!instant(quote.issuedAt) || !instant(quote.expiresAt) || quote.expiresAt <= quote.issuedAt) return reject("INVALID_SCHEDULE");
  const nowTime = now.getTime();
  if (Date.parse(quote.issuedAt) > nowTime) return reject("QUOTE_NOT_YET_VALID");
  if (Date.parse(quote.expiresAt) <= nowTime) return reject("QUOTE_EXPIRED");
  const jstTime = nowTime + 9 * 60 * 60 * 1000;
  if (!Number.isFinite(new Date(jstTime).getTime())) return reject("INVALID_CONTEXT");
  const todayJst = new Date(jstTime).toISOString().slice(0, 10);
  if (!day(todayJst)) return reject("INVALID_CONTEXT");
  // Never infer an unknown next amount/day from a plan label or interval.
  if ((quote.dueNow.dueOn as string) < todayJst || (quote.nextPayment.dueOn as string) <= (quote.dueNow.dueOn as string)) return reject("INVALID_SCHEDULE");
  return { ok: true, quote: snapshot(quote as unknown as PlatformBillingQuote) };
}

export function validatePlatformBillingConsent(
  quote: unknown,
  expected: BillingSelection,
  consent: unknown,
  now: Date,
): QuoteValidationResult {
  const result = validatePlatformBillingQuote(quote, expected, now);
  if (!result.ok) return result;
  if (!exact(consent, ["quoteId", "revision", "termsVersion", "accepted"]) || consent.accepted !== true
    || consent.quoteId !== result.quote.quoteId || consent.revision !== result.quote.revision
    || consent.termsVersion !== result.quote.policies.terms.version) return reject("CONSENT_MISMATCH");
  return result;
}
