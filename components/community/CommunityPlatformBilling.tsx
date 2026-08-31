"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import {
  COMMUNITY_PLATFORM_MESSAGES, communityPlatformActionBlock, communityPlatformLoginHref,
  communityPlatformStatusLabel, loadCommunityPlatformStatus, openCommunityPlatformPortal,
  type CommunityBillingTransport, type CommunityPlatformReadState
} from "@/lib/community/platform-billing";
import { COMMUNITY_PLATFORM_PLANS, communityPlatformPriceLabel, getCommunityPlatformPlan, type CommunityPlatformPlanKey } from "@/lib/community/platform-plans";

const transport: CommunityBillingTransport = {
  async getAccessToken() {
    // Session is only used to transport the token; the billing server verifies
    // the actual user, anonymous status and billing ownership on every request.
    const { supabase } = await import("@/lib/supabase/client");
    const { data, error } = await supabase.auth.getSession();
    return error ? null : data.session?.access_token ?? null;
  },
  fetch: (input, init) => fetch(input, init)
};

const panel = "rounded-[var(--mikke-radius-card)] border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 sm:p-5";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--mikke-line)] px-4 py-2.5 text-sm font-bold text-[var(--mikke-primary)] disabled:cursor-not-allowed disabled:opacity-50";

function dateLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "未確定";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

// Pure view exported for fixture-only tests. No fixture state is served by routes.
export function CommunityPlatformBillingView({
  state, resourceId = null, busy = false, message = "", onRefresh, onPortal
}: {
  state: CommunityPlatformReadState;
  resourceId?: string | null;
  busy?: boolean;
  message?: string;
  onRefresh?: () => void;
  onPortal?: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState<CommunityPlatformPlanKey>("starter");
  const selected = getCommunityPlatformPlan(selectedKey)!;
  const data = state.kind === "loaded" ? state.data : null;
  const subscription = data?.subscription ?? null;
  const currentPlan = subscription ? getCommunityPlatformPlan(subscription.planKey) : null;
  const portalBlock = communityPlatformActionBlock(state, "portal");
  const checkoutBlock = communityPlatformActionBlock(state, "checkout");
  const createBlock = communityPlatformActionBlock(state, "create_resource");
  const notice = state.kind !== "loaded" ? COMMUNITY_PLATFORM_MESSAGES[state.kind]
    : data?.availability === "policy_pending" ? COMMUNITY_PLATFORM_MESSAGES.policy_pending
    : data?.availability === "not_configured" ? COMMUNITY_PLATFORM_MESSAGES.unavailable
    : data?.noticeCode !== null ? "契約状態を再確認してください。" : null;

  return (
    <main className="min-h-screen bg-[var(--mikke-bg)] px-4 py-6 text-[var(--mikke-text)] sm:px-6">
      <div className="mx-auto min-w-0 max-w-5xl space-y-5">
        <Link href="/community" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><ArrowLeft size={16} aria-hidden="true" />Communityへ戻る</Link>
        <header className="border-b border-[var(--mikke-line)] pb-5">
          <p className="text-xs font-bold tracking-widest text-[var(--mikke-primary)]">COMMUNITY</p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--mikke-primary)]">運営プラン・契約</h1>
          <p className="mt-3 text-sm leading-7">あなたのCommunityを運営するための利用料金です。参加者から受け取る会費やAcademyの利用料金とは別の契約です。</p>
        </header>
        <ol aria-label="利用開始の流れ" className="grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-4">
          {["1 ログイン・新規登録", "2 プラン・契約条件", "3 決済・利用開始の確認", "4 Community作成"].map((text) => <li key={text} className="rounded-lg border border-[var(--mikke-line)] p-3">{text}</li>)}
        </ol>
        {notice ? <p role="status" className="rounded-lg border border-[var(--mikke-yellow)] bg-[var(--mikke-surface)] p-4 text-sm leading-6">{notice}</p> : null}
        {state.kind === "auth_required" ? <Link href={communityPlatformLoginHref(resourceId)} className={`${button} border-transparent bg-[var(--mikke-accent)] text-white`}>ログイン・新規登録<ArrowRight size={16} aria-hidden="true" /></Link> : null}

        <section className={panel} aria-labelledby="community-current-contract">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="community-current-contract" className="text-lg font-bold">現在の契約</h2>
            <button type="button" className={button} disabled={busy || !onRefresh} onClick={onRefresh}><RefreshCw size={16} aria-hidden="true" />状態を再確認</button>
          </div>
          {subscription ? <>
            <p className="mt-4 font-bold text-[var(--mikke-primary)]">{currentPlan?.name} · {communityPlatformStatusLabel(subscription.state)}</p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-[var(--mikke-muted)]">現在の利用期間の終了日時</dt><dd className="mt-1">{dateLabel(subscription.currentPeriodEndsAt)}</dd></div>
              <div><dt className="text-[var(--mikke-muted)]">解約予約</dt><dd className="mt-1">{subscription.cancelAtPeriodEnd ? "期間終了時の解約を予約済み" : "なし"}</dd></div>
            </dl>
          </> : <p className="mt-4 text-sm text-[var(--mikke-muted)]">{data ? "表示できる契約はありません。既存契約がある場合は運営者のアカウントで再確認してください。" : "契約情報はまだ取得できていません。"}</p>}
          <p className="mt-3 text-sm text-[var(--mikke-muted)]">今回・次回の請求額と請求日は未取得です。下の料金表はプラン料金であり、あなたへの確定請求ではありません。</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className={button} disabled={busy || Boolean(portalBlock) || !onPortal} onClick={onPortal} aria-describedby="community-portal-note"><CreditCard size={16} aria-hidden="true" />請求・契約管理</button>
          </div>
          <p id="community-portal-note" className="mt-2 text-xs leading-6 text-[var(--mikke-muted)]">{portalBlock ?? "請求情報の確認画面へ進みます。プラン変更・解約の受付条件は契約管理画面で確認してください。"}</p>
          {data?.creation.state === "pending" || subscription?.state === "pending" ? <p className="mt-3 text-sm font-bold">決済・利用開始を確認中です。重複して申し込まず、状態を再確認してください。</p> : null}
          {!createBlock ? <p className="mt-3 text-sm">利用開始の権利を確認しました。Community作成への接続は準備中です。</p> : null}
          {/* The old /community/create endpoint has no billing consume guard yet.
              Do not link to it until the common backend gate is implemented. */}
          <button type="button" disabled className={`${button} mt-3`} aria-describedby="community-create-note">Communityを作成</button>
          <p id="community-create-note" className="mt-2 text-xs leading-6 text-[var(--mikke-muted)]">{createBlock ?? "契約を確認してから作成する手続きは準備中です。"}</p>
        </section>

        <section aria-labelledby="community-plans-title">
          <h2 id="community-plans-title" className="text-lg font-bold">運営プランを比較</h2>
          <p className="mt-2 text-sm text-[var(--mikke-muted)]">1 Communityごとの料金です。選ぶだけでは申し込み・請求は発生しません。</p>
          <fieldset className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="sr-only">比較するプラン</legend>
            {COMMUNITY_PLATFORM_PLANS.map((plan) => <label key={plan.key} className={`${panel} cursor-pointer ${selectedKey === plan.key ? "border-[var(--mikke-primary)] ring-1 ring-[var(--mikke-primary)]" : ""}`}>
              <span className="flex items-center gap-2"><input type="radio" name="community-platform-plan" value={plan.key} checked={selectedKey === plan.key} onChange={() => setSelectedKey(plan.key)} className="h-4 w-4 accent-[var(--mikke-primary)]" /><span className="font-bold">{plan.name}</span></span>
              <span className="mt-3 block text-lg font-bold text-[var(--mikke-primary)]">{communityPlatformPriceLabel(plan)}</span>
              <span className="mt-2 block text-sm">{plan.memberLimit === null ? "1,001名以上" : `${plan.memberLimit.toLocaleString("ja-JP")}名まで`}</span>
              {plan.key === "trial" ? <span className="mt-2 block text-xs leading-6 text-[var(--mikke-muted)]">期間限定のお試しです。恒久無料プランではありません。</span> : null}
            </label>)}
          </fieldset>
        </section>

        <section className={panel} aria-labelledby="community-confirm-title">
          <h2 id="community-confirm-title" className="text-lg font-bold">選択中：{selected.name}</h2>
          <p className="mt-2 text-sm font-bold">{communityPlatformPriceLabel(selected)} · {selected.memberLimit === null ? "1,001名以上" : `${selected.memberLimit}名まで`}</p>
          <p className="mt-3 text-sm leading-7">{selectedKey === "enterprise" ? "個別見積のプランです。この画面では決済しません。" : selectedKey === "trial" ? "30日間お試しの開始手続き・終了後の条件は準備中です。ここでは試用も請求も開始しません。" : checkoutBlock}</p>
          <button type="button" disabled className={`${button} mt-4`} aria-describedby="community-checkout-note">{selectedKey === "enterprise" ? "個別見積の受付準備中" : selectedKey === "trial" ? "お試しの受付準備中" : "契約条件の確認へ（準備中）"}</button>
          <p id="community-checkout-note" className="mt-3 text-xs leading-6 text-[var(--mikke-muted)]">課金開始日、次回請求、無料期間の終了、プラン変更、解約・返金の条件を確認できる形でご案内します。</p>
        </section>
        <p role="status" aria-live="polite" className="text-sm text-[var(--mikke-primary)]">{message}</p>
        <aside className="flex items-start gap-3 rounded-lg border border-[var(--mikke-green)] p-4 text-sm leading-7">
          <ShieldCheck size={20} className="mt-1 shrink-0 text-[var(--mikke-primary)]" aria-hidden="true" />
          <p>ここで管理するのは運営者のCommunity利用契約だけです。参加者の会費、Academyから付与されたRoomの利用権、既存会員の権利は変更しません。</p>
        </aside>
      </div>
    </main>
  );
}

export function CommunityPlatformBilling({ resourceId = null }: { resourceId?: string | null }) {
  const [state, setState] = useState<CommunityPlatformReadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const request = useRef<{ resourceId: string | null; id: string } | null>(null);
  const sequence = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setState({ kind: "loading" });
    const next = await loadCommunityPlatformStatus(resourceId, transport, controller.signal);
    if (sequence.current === current) setState(next);
  }, [resourceId]);
  useEffect(() => {
    void refresh();
    return () => { sequence.current += 1; inflight.current?.abort(); };
  }, [refresh]);

  async function portal() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      // A manual retry reuses the same ID for the same target. No auto-retry.
      if (!request.current || request.current.resourceId !== resourceId) request.current = { resourceId, id: crypto.randomUUID() };
      const result = await openCommunityPlatformPortal(state, request.current.id, transport);
      if (result.ok) window.location.assign(result.redirectUrl);
      else {
        setMessage(result.message);
        if (result.authRequired) setState({ kind: "auth_required" });
        else await refresh();
      }
    } finally { pending.current = false; setBusy(false); }
  }

  return <CommunityPlatformBillingView state={state} resourceId={resourceId} busy={busy || state.kind === "loading"} message={message} onRefresh={() => void refresh()} onPortal={() => void portal()} />;
}
