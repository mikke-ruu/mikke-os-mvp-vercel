"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import {
  COMMUNITY_PLATFORM_MESSAGES, COMMUNITY_PLATFORM_TRIAL_POLICY, communityPlatformActionBlock, communityPlatformLoginHref,
  communityPlatformStatusLabel, communityPlatformTrialPeriodNotice, openCommunityPlatformPortal, requestCommunityPlatformQuote,
  startCommunityPlatformCheckout, type CommunityPlatformQuote, type CommunityPlatformReadState
} from "@/lib/community/platform-billing";
import { COMMUNITY_PLATFORM_PLANS, communityPlatformPriceLabel, getCommunityPlatformPlan, type CommunityPlatformPlanKey } from "@/lib/community/platform-plans";
import { createCommunityPlatformStatusLoader } from "@/lib/community/platform-billing-loader";
import { communityPlatformBrowserTransport as transport } from "@/lib/community/platform-billing-browser";

const panel = "rounded-[var(--mikke-radius-card)] border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 sm:p-5";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--mikke-line)] px-4 py-2.5 text-sm font-bold text-[var(--mikke-primary)] disabled:cursor-not-allowed disabled:opacity-50";

function dateLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "未確定";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

// Pure view exported for fixture-only tests. No fixture state is served by routes.
export function CommunityPlatformBillingView({
  state, resourceId = null, busy = false, message = "", quote = null, selectedKey: selectedKeyProp,
  onRefresh, onPortal, onSelectPlan, onQuote, onCheckout
}: {
  state: CommunityPlatformReadState;
  resourceId?: string | null;
  busy?: boolean;
  message?: string;
  quote?: CommunityPlatformQuote | null;
  selectedKey?: CommunityPlatformPlanKey;
  onRefresh?: () => void;
  onPortal?: () => void;
  onSelectPlan?: (plan: CommunityPlatformPlanKey) => void;
  onQuote?: (plan: CommunityPlatformPlanKey) => void;
  onCheckout?: (accepted: boolean) => void;
}) {
  const [localSelectedKey, setLocalSelectedKey] = useState<CommunityPlatformPlanKey>("starter");
  const [accepted, setAccepted] = useState(false);
  const selectedKey = selectedKeyProp ?? localSelectedKey;
  useEffect(() => setAccepted(false), [quote?.quoteId, selectedKey]);
  const selected = getCommunityPlatformPlan(selectedKey)!;
  const data = state.kind === "loaded" ? state.data : null;
  const subscription = data?.subscription ?? null;
  const currentPlan = subscription ? getCommunityPlatformPlan(subscription.planKey) : null;
  const trialPeriodNotice = communityPlatformTrialPeriodNotice(subscription);
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
            <p className="mt-4 font-bold text-[var(--mikke-primary)]">{currentPlan?.name} · {trialPeriodNotice ? "お試しの契約状態を再確認してください" : communityPlatformStatusLabel(subscription.state)}</p>
            {trialPeriodNotice ? <p className="mt-2 text-sm leading-6">{trialPeriodNotice}</p> : null}
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-[var(--mikke-muted)]">現在の利用期間の終了日時</dt><dd className="mt-1">{dateLabel(subscription.currentPeriodEndsAt)}</dd></div>
              <div><dt className="text-[var(--mikke-muted)]">解約予約</dt><dd className="mt-1">{subscription.cancelAtPeriodEnd ? "期間終了時の解約を予約済み" : "なし"}</dd></div>
            </dl>
          </> : <p className="mt-4 text-sm text-[var(--mikke-muted)]">{data?.creation.state === "available" ? "Communityの利用開始確認が完了しています。下のボタンから作成できます。" : data ? "表示できる契約はありません。既存契約がある場合は運営者のアカウントで再確認してください。" : "契約情報はまだ取得できていません。"}</p>}
          <p className="mt-3 text-sm text-[var(--mikke-muted)]">今回・次回の請求額と請求日は未取得です。下の料金表はプラン料金であり、あなたへの確定請求ではありません。</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className={button} disabled={busy || Boolean(portalBlock) || !onPortal} onClick={onPortal} aria-describedby="community-portal-note"><CreditCard size={16} aria-hidden="true" />請求・契約管理</button>
          </div>
          <p id="community-portal-note" className="mt-2 text-xs leading-6 text-[var(--mikke-muted)]">{portalBlock ?? "請求情報の確認画面へ進みます。プラン変更・解約の受付条件は契約管理画面で確認してください。"}</p>
          {data?.creation.state === "pending" || subscription?.state === "pending" ? <p className="mt-3 text-sm font-bold">決済・利用開始を確認中です。重複して申し込まず、状態を再確認してください。</p> : null}
          {!createBlock ? <p className="mt-3 text-sm">利用開始の権利を確認しました。作成時に1回だけ安全に消費します。</p> : null}
          {!createBlock ? <Link href="/community/create" className={`${button} mt-3`} aria-describedby="community-create-note">Communityを作成</Link>
            : <button type="button" disabled className={`${button} mt-3`} aria-describedby="community-create-note">Communityを作成</button>}
          <p id="community-create-note" className="mt-2 text-xs leading-6 text-[var(--mikke-muted)]">{createBlock ?? "契約の作成権をサーバーで再確認してから作成します。"}</p>
        </section>

        <section aria-labelledby="community-plans-title">
          <h2 id="community-plans-title" className="text-lg font-bold">運営プランを比較</h2>
          <p className="mt-2 text-sm text-[var(--mikke-muted)]">1 Communityごとの料金です。選ぶだけでは申し込み・請求は発生しません。</p>
          <p className="mt-3 rounded-lg border border-[var(--mikke-green)] p-3 text-sm leading-7">{COMMUNITY_PLATFORM_TRIAL_POLICY.notice}</p>
          <fieldset className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="sr-only">比較するプラン</legend>
            {COMMUNITY_PLATFORM_PLANS.map((plan) => <label key={plan.key} className={`${panel} cursor-pointer ${selectedKey === plan.key ? "border-[var(--mikke-primary)] ring-1 ring-[var(--mikke-primary)]" : ""}`}>
              <span className="flex items-center gap-2"><input type="radio" name="community-platform-plan" value={plan.key} checked={selectedKey === plan.key} onChange={() => { setLocalSelectedKey(plan.key); onSelectPlan?.(plan.key); }} className="h-4 w-4 accent-[var(--mikke-primary)]" /><span className="font-bold">{plan.name}</span></span>
              <span className="mt-3 block text-lg font-bold text-[var(--mikke-primary)]">{communityPlatformPriceLabel(plan)}</span>
              <span className="mt-2 block text-sm">{plan.memberLimit === null ? "1,001名以上" : `${plan.memberLimit.toLocaleString("ja-JP")}名まで`}</span>
              {plan.key === "trial" ? <span className="mt-2 block text-xs leading-6 text-[var(--mikke-muted)]">期間限定のお試しです。恒久無料プランではありません。</span> : null}
            </label>)}
          </fieldset>
        </section>

        <section className={panel} aria-labelledby="community-confirm-title">
          <h2 id="community-confirm-title" className="text-lg font-bold">選択中：{selected.name}</h2>
          <p className="mt-2 text-sm font-bold">{communityPlatformPriceLabel(selected)} · {selected.memberLimit === null ? "1,001名以上" : `${selected.memberLimit}名まで`}</p>
          <p className="mt-3 text-sm leading-7">{selectedKey === "enterprise" ? "個別見積のプランです。この画面では決済しません。" : selectedKey === "trial" ? `${COMMUNITY_PLATFORM_TRIAL_POLICY.pendingNotice}ここでは試用も請求も開始しません。` : checkoutBlock ?? "契約条件を取得して確認しても、確定ボタンを押すまでは請求されません。"}</p>
          {!quote ? <button type="button" disabled={busy || Boolean(checkoutBlock) || selectedKey === "trial" || selectedKey === "enterprise" || !onQuote} onClick={() => onQuote?.(selectedKey)} className={`${button} mt-4`} aria-describedby="community-checkout-note">{selectedKey === "enterprise" ? "個別見積の受付準備中" : selectedKey === "trial" ? "お試しの受付準備中" : "契約条件を確認"}</button> : <>
            <div className="mt-5 grid gap-3 rounded-xl border border-[var(--mikke-yellow)] bg-[var(--mikke-bg)] p-4 text-sm sm:grid-cols-2" data-testid="community-server-quote">
              <div><p className="text-xs text-[var(--mikke-muted)]">今回のお支払い（税込）</p><p className="mt-1 text-xl font-bold">{quote.dueNow.totalYen.toLocaleString("ja-JP")}円</p><p className="mt-1">{quote.dueNow.dueOn}</p></div>
              <div><p className="text-xs text-[var(--mikke-muted)]">次回のお支払い予定（税込）</p><p className="mt-1 text-xl font-bold">{quote.nextPayment.totalYen.toLocaleString("ja-JP")}円</p><p className="mt-1">{quote.nextPayment.dueOn}</p></div>
              <div className="sm:col-span-2"><p className="font-bold">販売者：{quote.merchant.legalName}</p><p className="mt-1 whitespace-pre-line leading-6">{quote.merchant.address}</p><a href={quote.merchant.contactUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-bold text-[var(--mikke-primary)] underline">お問い合わせ先</a></div>
              <ul className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                {([['terms','利用規約'],['privacy','プライバシーポリシー'],['refund','返金条件'],['cancellation','解約条件'],['proration','日割り条件'],['renewal','更新条件'],['commercialDisclosure','特定商取引法に基づく表記']] as const).map(([key, label]) => <li key={key}><a href={quote.policies[key].url} target="_blank" rel="noreferrer" className="font-bold text-[var(--mikke-primary)] underline">{label}</a><span className="ml-2 text-xs text-[var(--mikke-muted)]">{quote.policies[key].version}</span></li>)}
              </ul>
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--mikke-line)] p-3 text-sm leading-6"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--mikke-primary)]" /><span>今回・次回の金額と日付、販売者情報、上記すべての規約・条件を確認し、有料プランを申し込みます。</span></label>
            <button type="button" disabled={busy || !accepted || !onCheckout} onClick={() => onCheckout?.(accepted)} className={`${button} mt-4 border-transparent bg-[var(--mikke-accent)] text-white`}>内容に同意して決済へ進む<ArrowRight size={16} aria-hidden="true" /></button>
          </>}
          <p id="community-checkout-note" className="mt-3 text-xs leading-6 text-[var(--mikke-muted)]">30日無料の終了だけでは自動課金されません。有料プランは、本人が内容を確認して申し込み、決済が成功した時から開始します。</p>
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
  // Remount before render so even the first frame cannot show another resource.
  return <CommunityPlatformBillingSession key={resourceId ?? "new"} resourceId={resourceId} />;
}

function CommunityPlatformBillingSession({ resourceId }: { resourceId: string | null }) {
  const [state, setState] = useState<CommunityPlatformReadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [quote, setQuote] = useState<CommunityPlatformQuote | null>(null);
  const [selectedKey, setSelectedKey] = useState<CommunityPlatformPlanKey>("starter");
  const pending = useRef(false);
  const portalRequest = useRef<{ resourceId: string | null; id: string } | null>(null);
  const quoteRequest = useRef<{ resourceId: string | null; planKey: string; id: string } | null>(null);
  const operation = useRef<AbortController | null>(null);
  const principal = useRef<string | null>(null);
  const identityEpoch = useRef(0);
  const loader = useRef<ReturnType<typeof createCommunityPlatformStatusLoader> | null>(null);
  const refresh = useCallback(async () => {
    operation.current?.abort();
    quoteRequest.current = null;
    setQuote(null);
    await loader.current?.load(resourceId);
  }, [resourceId]);
  useEffect(() => {
    const current = createCommunityPlatformStatusLoader(transport, setState);
    loader.current = current;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void import("@/lib/supabase/client").then(({ supabase }) => {
      if (disposed) return;
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (disposed) return;
        identityEpoch.current++;
        // Token refresh/refocus is not a new operation by the same person.
        const nextPrincipal = session?.user.id ?? null;
        if (principal.current !== nextPrincipal) { portalRequest.current = null; quoteRequest.current = null; setQuote(null); operation.current?.abort(); }
        principal.current = nextPrincipal;
        pending.current = false;
        setBusy(false);
        setMessage("");
        current.authChanged(resourceId, Boolean(session));
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => { if (!disposed) current.clear({ kind: "unavailable" }); });
    return () => {
      disposed = true;
      identityEpoch.current++;
      operation.current?.abort();
      unsubscribe?.();
      current.dispose();
      loader.current = null;
    };
  }, [resourceId]);

  async function portal() {
    if (pending.current) return;
    const epoch = identityEpoch.current;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      // A manual retry reuses the same ID for the same target. No auto-retry.
      if (!portalRequest.current || portalRequest.current.resourceId !== resourceId) portalRequest.current = { resourceId, id: crypto.randomUUID() };
      const result = await openCommunityPlatformPortal(state, portalRequest.current.id, transport);
      if (identityEpoch.current !== epoch) return;
      if (result.ok) window.location.assign(result.redirectUrl);
      else {
        setMessage(result.message);
        if (result.authRequired) loader.current?.clear({ kind: "auth_required" });
        else await refresh();
      }
    } finally {
      if (identityEpoch.current === epoch) { pending.current = false; setBusy(false); }
    }
  }

  function selectPlan(planKey: CommunityPlatformPlanKey) {
    operation.current?.abort(); quoteRequest.current = null; setQuote(null); setMessage(""); setSelectedKey(planKey);
  }

  async function loadQuote(planKey: CommunityPlatformPlanKey) {
    if (pending.current) return;
    const epoch = identityEpoch.current;
    const controller = new AbortController(); operation.current?.abort(); operation.current = controller;
    pending.current = true; setBusy(true); setMessage(""); setQuote(null);
    try {
      if (!quoteRequest.current || quoteRequest.current.resourceId !== resourceId || quoteRequest.current.planKey !== planKey)
        quoteRequest.current = { resourceId, planKey, id: crypto.randomUUID() };
      const result = await requestCommunityPlatformQuote(state, planKey, quoteRequest.current.id, transport, controller.signal);
      if (identityEpoch.current !== epoch || controller.signal.aborted) return;
      if (result.ok) setQuote(result.quote);
      else { setMessage(result.message); if (result.authRequired) loader.current?.clear({ kind: "auth_required" }); }
    } finally { if (identityEpoch.current === epoch) { pending.current = false; setBusy(false); } }
  }

  async function checkout(accepted: boolean) {
    if (pending.current || !quote) return;
    const epoch = identityEpoch.current;
    const controller = new AbortController(); operation.current?.abort(); operation.current = controller;
    pending.current = true; setBusy(true); setMessage("");
    try {
      const result = await startCommunityPlatformCheckout(state, quote, accepted, transport, controller.signal);
      if (identityEpoch.current !== epoch || controller.signal.aborted) return;
      if (result.ok && result.state === "redirect") window.location.assign(result.redirectUrl);
      else if (result.ok) { setMessage("決済画面の準備を確認中です。重複して申し込まず、状態を再確認してください。"); await refresh(); }
      else { setMessage(result.message); if (result.authRequired) loader.current?.clear({ kind: "auth_required" }); }
    } finally { if (identityEpoch.current === epoch) { pending.current = false; setBusy(false); } }
  }

  return <CommunityPlatformBillingView state={state} resourceId={resourceId} busy={busy || state.kind === "loading"} message={message}
    quote={quote} selectedKey={selectedKey} onSelectPlan={selectPlan} onRefresh={() => void refresh()} onPortal={() => void portal()}
    onQuote={(plan) => void loadQuote(plan)} onCheckout={(accepted) => void checkout(accepted)} />;
}
