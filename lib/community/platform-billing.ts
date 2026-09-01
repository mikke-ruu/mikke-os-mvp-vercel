import { getCommunityPlatformPlan } from "./platform-plans";
import {
  UUID_PATTERN, decodePlatformStatus, hasExactKeys, isPlatformRedirect, isRecord,
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
