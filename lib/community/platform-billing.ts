import { getCommunityPlatformPlan } from "./platform-plans";

// Community projection of the control room's platform billing UI contract v0.
// No provider, DB, membership, Academy entitlement or authorization logic here.
export const COMMUNITY_PLATFORM_PRODUCT = "community_platform" as const;
export type CommunityPlatformSubscriptionState = "pending" | "trialing" | "active" | "past_due" | "ended";
export type CommunityPlatformAction = "checkout" | "portal" | "create_resource";
export type CommunityPlatformStatusV0 = {
  version: 0;
  product: typeof COMMUNITY_PLATFORM_PRODUCT;
  resourceId: string | null;
  availability: "ready" | "not_configured" | "policy_pending";
  subscription: null | {
    state: CommunityPlatformSubscriptionState;
    planKey: string;
    currentPeriodEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
  };
  creation: { state: "none" | "pending" | "available" | "consumed" };
  allowedActions: CommunityPlatformAction[];
  noticeCode: string | null;
};
export type CommunityPlatformReadState =
  | { kind: "loading" | "unavailable" | "policy_pending" | "auth_required" | "resource_unavailable" | "error" }
  | { kind: "loaded"; data: CommunityPlatformStatusV0 };

export const COMMUNITY_PLATFORM_MESSAGES = {
  loading: "契約状態を確認しています。",
  unavailable: "契約・決済の受付準備中です。現在この画面からお申し込みはできません。",
  policy_pending: "課金開始・無料期間終了・解約等の契約条件を準備しています。現在お申し込みはできません。",
  auth_required: "ログインまたは新規登録して契約状態を確認してください。",
  resource_unavailable: "この契約を確認できません。契約を管理する運営者のアカウントで確認してください。",
  error: "契約状態を取得できませんでした。時間をおいて再確認してください。"
} as const;

const subscriptionStates = ["pending", "trialing", "active", "past_due", "ended"];
const actions = ["checkout", "portal", "create_resource"];
const safeNoticeCodes = ["AUTH_REQUIRED", "RESOURCE_UNAVAILABLE", "STATE_CONFLICT", "INVALID_REQUEST", "BILLING_NOT_CONFIGURED", "POLICY_PENDING"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const hasKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isIsoDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

export function decodeCommunityPlatformStatus(raw: unknown, resourceId: string | null): CommunityPlatformStatusV0 | null {
  if (resourceId !== null && !uuidPattern.test(resourceId)) return null;
  if (!record(raw) || !hasKeys(raw, ["version", "product", "resourceId", "availability", "subscription", "creation", "allowedActions", "noticeCode"])) return null;
  if (raw.version !== 0 || raw.product !== COMMUNITY_PLATFORM_PRODUCT || raw.resourceId !== resourceId) return null;
  if (typeof raw.availability !== "string" || !["ready", "not_configured", "policy_pending"].includes(raw.availability)) return null;
  if (!record(raw.creation) || !hasKeys(raw.creation, ["state"]) || typeof raw.creation.state !== "string" || !["none", "pending", "available", "consumed"].includes(raw.creation.state)) return null;
  if (!Array.isArray(raw.allowedActions) || raw.allowedActions.some((action) => typeof action !== "string" || !actions.includes(action)) || new Set(raw.allowedActions).size !== raw.allowedActions.length) return null;
  if (raw.noticeCode !== null && (typeof raw.noticeCode !== "string" || !safeNoticeCodes.includes(raw.noticeCode))) return null;
  if (raw.subscription !== null) {
    const sub = raw.subscription;
    if (!record(sub) || !hasKeys(sub, ["state", "planKey", "currentPeriodEndsAt", "cancelAtPeriodEnd"])) return null;
    if (typeof sub.state !== "string" || !subscriptionStates.includes(sub.state) || !getCommunityPlatformPlan(sub.planKey) || typeof sub.cancelAtPeriodEnd !== "boolean") return null;
    if (sub.currentPeriodEndsAt !== null && !isIsoDate(sub.currentPeriodEndsAt)) return null;
  }
  return raw as CommunityPlatformStatusV0;
}

export function communityPlatformStatusLabel(status: unknown): string {
  const labels: Record<string, string> = {
    pending: "決済の確認中", trialing: "お試し期間中", active: "契約中",
    past_due: "お支払いの確認が必要です", ended: "利用期間終了"
  };
  return typeof status === "string" && Object.hasOwn(labels, status) ? labels[status] : "契約状態を確認してください";
}

export function communityPlatformActionBlock(state: CommunityPlatformReadState, action: CommunityPlatformAction): string | null {
  if (state.kind !== "loaded") return COMMUNITY_PLATFORM_MESSAGES[state.kind];
  const data = state.data;
  if (data.availability !== "ready") return COMMUNITY_PLATFORM_MESSAGES[data.availability === "policy_pending" ? "policy_pending" : "unavailable"];
  if (data.noticeCode !== null) return "契約状態を再確認してください。";
  // v0 has no final amount/date/legal-consent contract. Shared v1 is required.
  if (action === "checkout") return "お支払い金額・請求日・契約条件の最終確認は準備中です。まだ決済できません。";
  if (!data.allowedActions.includes(action)) return "現在この操作は利用できません。";
  if (action === "portal") return data.resourceId && data.subscription ? null : "請求・契約管理の対象を確認できません。";
  // This is a display hint, not a grant. The actual create API must atomically
  // consume the entitlement. No inference from URL, plan or local storage.
  return data.resourceId === null && data.creation.state === "available"
    && data.subscription && ["trialing", "active"].includes(data.subscription.state)
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
    const token = await transport.getAccessToken();
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
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && ["billing.stripe.com", "checkout.stripe.com"].includes(url.hostname);
  } catch { return false; }
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
