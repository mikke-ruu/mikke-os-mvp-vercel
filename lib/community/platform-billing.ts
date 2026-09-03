import { getCommunityPlatformPlan } from "./platform-plans";
import {
  UUID_PATTERN, decodePlatformStatus, hasExactKeys, isCanonicalTime, isPlatformRedirect, isRecord,
  type PlatformAction, type PlatformStatusV0
} from "../billing/platform/contracts";

// Community projection of the control room's platform billing UI contract v0.
// No provider, DB, membership, Academy entitlement or authorization logic here.
export const COMMUNITY_PLATFORM_PRODUCT = "community_platform" as const;
// User-approved 2026-09-01. This is not approval of trial start, post-trial
// capabilities, renewal dates or refund/cancellation rules. No state mutation.
export const COMMUNITY_PLATFORM_TRIAL_POLICY = Object.freeze({
  automaticBillingAtTrialEnd: false,
  automaticPaidTransitionAtTrialEnd: false,
  explicitPaidApplicationRequired: true,
  postTrialCapabilities: "policy_pending",
  notice: "30日間のお試しが終わっても、自動課金・有料プランへの自動移行はありません。本人が有料プランを申し込んだ時に課金が始まります。",
  pendingNotice: "お試しの開始手続きや、終了後に使える機能などは準備中です。"
} as const);
export type CommunityPlatformAction = PlatformAction;
export type CommunityPlatformStatusV0 = Omit<PlatformStatusV0, "product"> & { product: typeof COMMUNITY_PLATFORM_PRODUCT };
export type CommunityPlatformReadState =
  | { kind: "loading" | "unavailable" | "policy_pending" | "auth_required" | "resource_unavailable" | "error" }
  | { kind: "loaded"; data: CommunityPlatformStatusV0 };

export const COMMUNITY_PLATFORM_MESSAGES = {
  loading: "契約状態を確認しています。",
  unavailable: "契約・決済の受付準備中です。現在この画面からお申し込みはできません。",
  policy_pending: "請求日・期限後に使える機能・解約等の未確定の契約条件を準備しています。現在お申し込みはできません。",
  auth_required: "ログインまたは新規登録して契約状態を確認してください。",
  resource_unavailable: "この契約を確認できません。契約を管理する運営者のアカウントで確認してください。",
  error: "契約状態を取得できませんでした。時間をおいて再確認してください。"
} as const;

const uuidPattern = UUID_PATTERN;
const record = isRecord;
const hasKeys = hasExactKeys;

export function decodeCommunityPlatformStatus(raw: unknown, resourceId: string | null): CommunityPlatformStatusV0 | null {
  if (resourceId !== null && !uuidPattern.test(resourceId)) return null;
  const decoded = decodePlatformStatus(raw, { product: COMMUNITY_PLATFORM_PRODUCT, resourceId });
  if (!decoded || (decoded.subscription && !getCommunityPlatformPlan(decoded.subscription.planKey))) return null;
  return decoded as CommunityPlatformStatusV0;
}

export function communityPlatformStatusLabel(status: unknown): string {
  const labels: Record<string, string> = {
    pending: "決済の確認中", trialing: "お試し期間中", active: "契約中",
    past_due: "お支払いの確認が必要です", ended: "利用期間終了"
  };
  return typeof status === "string" && Object.hasOwn(labels, status) ? labels[status] : "契約状態を確認してください";
}

export function communityPlatformTrialPeriodNotice(
  subscription: CommunityPlatformStatusV0["subscription"], now: number = Date.now()
): string | null {
  if (subscription?.planKey !== "trial" || subscription.state !== "trialing"
    || !subscription.currentPeriodEndsAt || !Number.isFinite(now)) return null;
  const endsAt = Date.parse(subscription.currentPeriodEndsAt);
  return Number.isFinite(endsAt) && endsAt <= now
    ? "お試し期間の終了日時を過ぎています。自動で有料契約にはなりません。最新の契約状態を再確認してください。"
    : null;
}

export function communityPlatformActionBlock(state: CommunityPlatformReadState, action: CommunityPlatformAction): string | null {
  if (state.kind !== "loaded") return COMMUNITY_PLATFORM_MESSAGES[state.kind];
  const data = state.data;
  if (data.availability !== "ready") return COMMUNITY_PLATFORM_MESSAGES[data.availability === "policy_pending" ? "policy_pending" : "unavailable"];
  if (data.noticeCode !== null) return "契約状態を再確認してください。";
  if (!data.allowedActions.includes(action)) return "現在この操作は利用できません。";
  if (action === "checkout") return null;
  if (action === "portal") return data.resourceId && data.subscription ? null : "請求・契約管理の対象を確認できません。";
  // This is a display hint, not a grant. The actual create API must atomically
  // consume the entitlement. No inference from URL, plan or local storage.
  return data.resourceId === null && data.creation.state === "available"
    ? null : "利用開始の確認ができるまで、Communityは作成できません。";
}

export function communityPlatformLoginHref(resourceId: string | null = null): string {
  const next = resourceId && uuidPattern.test(resourceId)
    ? `/community/platform-billing?resourceId=${resourceId}` : "/community/start";
  return `/login?next=${encodeURIComponent(next)}`;
}

export type CommunityBillingFetch = (input: string, init: RequestInit) => Promise<Response>;
export type CommunityBillingTransport = {
  getAccessToken: () => Promise<string | null>;
  fetch: CommunityBillingFetch;
};
type UnloadedKind = Exclude<CommunityPlatformReadState["kind"], "loaded">;
function safeErrorKind(status: number, raw: unknown): UnloadedKind {
  const code = record(raw) && record(raw.error) && typeof raw.error.code === "string" ? raw.error.code : null;
  if (status === 401 && code === "AUTH_REQUIRED") return "auth_required";
  if (status === 404) return code === "RESOURCE_UNAVAILABLE" ? "resource_unavailable" : "unavailable";
  if (status === 503 && code === "POLICY_PENDING") return "policy_pending";
  if (status === 503 && code === "BILLING_NOT_CONFIGURED") return "unavailable";
  return "error";
}

export async function loadCommunityPlatformStatus(
  resourceId: string | null, transport: CommunityBillingTransport, signal?: AbortSignal
): Promise<CommunityPlatformReadState> {
  if (resourceId !== null && !uuidPattern.test(resourceId)) return { kind: "resource_unavailable" };
  try {
    if (signal?.aborted) return { kind: "error" };
    const token = await transport.getAccessToken();
    if (signal?.aborted) return { kind: "error" };
    if (!token) return { kind: "auth_required" };
    const query = new URLSearchParams({ product: COMMUNITY_PLATFORM_PRODUCT });
    if (resourceId) query.set("resourceId", resourceId);
    const timeout = AbortSignal.timeout(15000);
    const response = await transport.fetch(`/api/billing/platform/status?${query}`, { method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) return { kind: safeErrorKind(response.status, raw) };
    const data = decodeCommunityPlatformStatus(raw, resourceId);
    return data ? { kind: "loaded", data } : { kind: "unavailable" };
  } catch { return { kind: "error" }; }
}

export function isCommunityPlatformProviderUrl(value: unknown): value is string {
  return isPlatformRedirect(value, "portal");
}

export type CommunityBillingPolicyName = "terms" | "privacy" | "refund" | "cancellation" | "proration" | "renewal" | "commercialDisclosure";
export type CommunityPlatformQuote = Readonly<{
  quoteId: string;
  revision: number;
  purchaseIntent: "explicit_paid_start";
  scope: Readonly<{ ownerUserId: string; productKey: typeof COMMUNITY_PLATFORM_PRODUCT; resourceId: string | null; planKey: string; requestId: string }>;
  currency: "JPY";
  taxIncluded: true;
  dueNow: Readonly<{ totalYen: number; dueOn: string }>;
  nextPayment: Readonly<{ totalYen: number; dueOn: string }>;
  merchant: Readonly<{ merchantId: string; legalName: string; address: string; contactUrl: string }>;
  policies: Readonly<{ approved: true; approvalId: string; revision: number } & Record<CommunityBillingPolicyName, Readonly<{ version: string; url: string }>>>;
  issuedAt: string;
  expiresAt: string;
}>;
export type CommunityCheckoutResult =
  | { ok: true; state: "pending" }
  | { ok: true; state: "redirect"; redirectUrl: string }
  | { ok: false; message: string; authRequired?: boolean };

const policyNames: readonly CommunityBillingPolicyName[] = ["terms", "privacy", "refund", "cancellation", "proration", "renewal", "commercialDisclosure"];
const token = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
const text = (value: unknown, limit = 500) => typeof value === "string" && value.length > 0 && value.length <= limit && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const httpsUrl = (value: unknown) => {
  if (!text(value, 2048)) return false;
  try { const url = new URL(value as string); return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname); } catch { return false; }
};
const day = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
};
const payment = (value: unknown) => record(value) && hasKeys(value, ["totalYen", "dueOn"])
  && typeof value.totalYen === "number" && Number.isSafeInteger(value.totalYen) && value.totalYen >= 0 && day(value.dueOn);

export function decodeCommunityPlatformQuote(raw: unknown, resourceId: string | null, planKey: string, requestId: string): CommunityPlatformQuote | null {
  if (!record(raw) || !hasKeys(raw, ["quoteId", "revision", "purchaseIntent", "scope", "currency", "taxIncluded", "dueNow", "nextPayment", "merchant", "policies", "issuedAt", "expiresAt"])
    || !token(raw.quoteId) || !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 1 || raw.purchaseIntent !== "explicit_paid_start"
    || raw.currency !== "JPY" || raw.taxIncluded !== true || !payment(raw.dueNow) || !payment(raw.nextPayment)
    || !isCanonicalTime(raw.issuedAt) || !isCanonicalTime(raw.expiresAt) || raw.expiresAt <= raw.issuedAt) return null;
  const scope = raw.scope;
  if (!record(scope) || !hasKeys(scope, ["ownerUserId", "productKey", "resourceId", "planKey", "requestId"])
    || !UUID_PATTERN.test(String(scope.ownerUserId)) || scope.productKey !== COMMUNITY_PLATFORM_PRODUCT || scope.resourceId !== resourceId
    || scope.planKey !== planKey || scope.requestId !== requestId) return null;
  const merchant = raw.merchant;
  if (!record(merchant) || !hasKeys(merchant, ["merchantId", "legalName", "address", "contactUrl"])
    || !token(merchant.merchantId) || !text(merchant.legalName, 300) || !text(merchant.address) || !httpsUrl(merchant.contactUrl)) return null;
  const policies = raw.policies;
  if (!record(policies) || !hasKeys(policies, ["approved", "approvalId", "revision", ...policyNames]) || policies.approved !== true
    || !token(policies.approvalId) || !Number.isSafeInteger(policies.revision) || (policies.revision as number) < 1) return null;
  for (const name of policyNames) {
    const policy = policies[name];
    if (!record(policy) || !hasKeys(policy, ["version", "url"]) || !token(policy.version) || !httpsUrl(policy.url)) return null;
  }
  return raw as CommunityPlatformQuote;
}

async function postCommunityBilling(path: string, body: unknown, transport: CommunityBillingTransport, signal?: AbortSignal) {
  if (signal?.aborted) return { response: null, raw: null, authRequired: false };
  const accessToken = await transport.getAccessToken();
  if (signal?.aborted) return { response: null, raw: null, authRequired: false };
  if (!accessToken) return { response: null, raw: null, authRequired: true };
  const timeout = AbortSignal.timeout(15000);
  const response = await transport.fetch(path, { method: "POST", credentials: "omit", redirect: "error", cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
  const raw: unknown = await response.json().catch(() => null);
  return { response, raw, authRequired: response.status === 401 };
}

export async function requestCommunityPlatformQuote(
  state: CommunityPlatformReadState, planKey: string, requestId: string, transport: CommunityBillingTransport, signal?: AbortSignal
): Promise<{ ok: true; quote: CommunityPlatformQuote } | { ok: false; message: string; authRequired?: boolean }> {
  const blocked = communityPlatformActionBlock(state, "checkout");
  const plan = getCommunityPlatformPlan(planKey);
  if (blocked || state.kind !== "loaded" || !plan || plan.key === "trial" || plan.key === "enterprise" || !UUID_PATTERN.test(requestId))
    return { ok: false, message: blocked ?? "このプランはこの画面から申し込めません。" };
  try {
    const { response, raw, authRequired } = await postCommunityBilling("/api/billing/platform/quote", {
      product: COMMUNITY_PLATFORM_PRODUCT, resourceId: state.data.resourceId, planKey, requestId
    }, transport, signal);
    if (authRequired) return { ok: false, message: COMMUNITY_PLATFORM_MESSAGES.auth_required, authRequired: true };
    if (!response?.ok) return { ok: false, message: "契約条件を取得できませんでした。状態を再確認してください。" };
    const quote = decodeCommunityPlatformQuote(raw, state.data.resourceId, planKey, requestId);
    return quote ? { ok: true, quote } : { ok: false, message: "契約条件を安全に確認できませんでした。状態を再確認してください。" };
  } catch { return { ok: false, message: "通信できませんでした。状態を再確認してください。" }; }
}

export async function startCommunityPlatformCheckout(
  state: CommunityPlatformReadState, quote: CommunityPlatformQuote, accepted: boolean, transport: CommunityBillingTransport, signal?: AbortSignal
): Promise<CommunityCheckoutResult> {
  const blocked = communityPlatformActionBlock(state, "checkout");
  if (blocked || state.kind !== "loaded" || accepted !== true
    || !decodeCommunityPlatformQuote(quote, state.data.resourceId, quote.scope.planKey, quote.scope.requestId))
    return { ok: false, message: blocked ?? "契約条件への同意を確認してください。" };
  try {
    const { response, raw, authRequired } = await postCommunityBilling("/api/billing/platform/checkout", {
      version: 1, product: COMMUNITY_PLATFORM_PRODUCT, resourceId: state.data.resourceId, planKey: quote.scope.planKey,
      requestId: quote.scope.requestId, consent: { quoteId: quote.quoteId, revision: quote.revision, termsVersion: quote.policies.terms.version, accepted: true }
    }, transport, signal);
    if (authRequired) return { ok: false, message: COMMUNITY_PLATFORM_MESSAGES.auth_required, authRequired: true };
    if (!response?.ok || !record(raw)) return { ok: false, message: "お申し込みを開始できませんでした。状態を再確認してください。" };
    if (hasKeys(raw, ["state"]) && raw.state === "pending") return { ok: true, state: "pending" };
    if (hasKeys(raw, ["state", "redirectUrl"]) && raw.state === "redirect" && isPlatformRedirect(raw.redirectUrl, "checkout"))
      return { ok: true, state: "redirect", redirectUrl: raw.redirectUrl };
    return { ok: false, message: "安全な決済画面を確認できませんでした。状態を再確認してください。" };
  } catch { return { ok: false, message: "通信できませんでした。状態を再確認してください。" }; }
}

export async function openCommunityPlatformPortal(
  state: CommunityPlatformReadState, requestId: string, transport: CommunityBillingTransport
): Promise<{ ok: true; redirectUrl: string } | { ok: false; message: string; authRequired?: boolean }> {
  const blocked = communityPlatformActionBlock(state, "portal");
  if (blocked || state.kind !== "loaded" || !uuidPattern.test(requestId)) return { ok: false, message: blocked ?? "操作を再試行してください。" };
  try {
    const token = await transport.getAccessToken();
    if (!token) return { ok: false, message: COMMUNITY_PLATFORM_MESSAGES.auth_required, authRequired: true };
    const response = await transport.fetch("/api/billing/platform/portal", {
      method: "POST", credentials: "omit", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ product: COMMUNITY_PLATFORM_PRODUCT, resourceId: state.data.resourceId, requestId })
    });
    const raw: unknown = await response.json().catch(() => null);
    if (response.status === 401) return { ok: false, message: COMMUNITY_PLATFORM_MESSAGES.auth_required, authRequired: true };
    if (!response.ok || !record(raw) || !hasKeys(raw, ["version", "redirectUrl"]) || raw.version !== 0 || !isCommunityPlatformProviderUrl(raw.redirectUrl)) {
      return { ok: false, message: "請求・契約管理を開けませんでした。契約状態を再確認してください。" };
    }
    return { ok: true, redirectUrl: raw.redirectUrl };
  } catch { return { ok: false, message: "通信できませんでした。契約状態を再確認してください。" }; }
}
