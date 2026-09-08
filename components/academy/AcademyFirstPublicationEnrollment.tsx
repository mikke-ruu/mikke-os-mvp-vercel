"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { createFirstPublicationQuoteRpc, createFirstPublicationRpc, type FirstPublicationQuote, type FirstPublicationStatus } from "@/lib/academy/first-publication/rpc-client";
import { approvedAcademySetupUrl, createAcademySetupClient } from "@/lib/academy/first-publication-setup-client";
import { firstPublicationDate } from "@/lib/academy/first-publication-view";

type Props = {
  userId: string;
  headquartersId: string;
  policyVersion: string;
  termsRevision: string;
  termsHref: string;
  billingHref: string;
  /** Re-preparation must not mistake the previous quote for the new consent. */
  replacePreparedQuoteId?: string;
  onPrepared: (state: FirstPublicationStatus) => void | Promise<void>;
};
type ReturnAttempt = { quoteId: string; attemptId: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const buttonClass = "min-h-11 rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm disabled:opacity-40";

export function readAcademySetupReturn(href: string, headquartersId: string): ReturnAttempt | "cancelled" | null {
  const url = new URL(href);
  if (url.pathname !== `/academy/h/${headquartersId}/manage/settings`) return null;
  if (url.searchParams.getAll("billing").length !== 1) return null;
  if (url.searchParams.get("billing") === "setup_cancel") return "cancelled";
  if (url.searchParams.get("billing") !== "setup_return") return null;
  if (url.searchParams.getAll("quoteId").length !== 1 || url.searchParams.getAll("attemptId").length !== 1) return null;
  const quoteId = url.searchParams.get("quoteId") ?? "";
  const attemptId = url.searchParams.get("attemptId") ?? "";
  return UUID.test(quoteId) && UUID.test(attemptId) ? { quoteId, attemptId } : null;
}

export function shouldResumeAcademyRepreparation(href: string, headquartersId: string, status: FirstPublicationStatus | null) {
  const returned = readAcademySetupReturn(href, headquartersId);
  return Boolean(status && status.headquartersId === headquartersId && status.phase === "prepared" && status.firstPublishedAt === null
    && status.cancellationAcceptedAt === null && returned && returned !== "cancelled" && returned.quoteId !== status.quoteId);
}

export function usableAcademyEnrollmentQuote(quote: FirstPublicationQuote, scope: Pick<Props, "headquartersId" | "policyVersion" | "termsRevision">, now: number) {
  return UUID.test(quote.id) && quote.headquartersId === scope.headquartersId && quote.policyVersion === scope.policyVersion
    && quote.termsRevision === scope.termsRevision && Number.isSafeInteger(quote.amountYen) && quote.amountYen > 0
    && Number.isFinite(Date.parse(quote.issuedAt)) && Date.parse(quote.issuedAt) <= now
    && Number.isFinite(Date.parse(quote.expiresAt)) && Date.parse(quote.expiresAt) > now;
}

export function matchesAcademyEnrollmentResult(state: FirstPublicationStatus, scope: Pick<Props, "headquartersId" | "policyVersion" | "termsRevision" | "replacePreparedQuoteId">, expectedQuoteId: string | null) {
  return state.headquartersId === scope.headquartersId && state.policyVersion === scope.policyVersion && state.termsRevision === scope.termsRevision
    && state.phase === "prepared" && state.firstPublishedAt === null && state.cancellationAcceptedAt === null
    && (!expectedQuoteId || state.quoteId === expectedQuoteId)
    && (!scope.replacePreparedQuoteId || Boolean(expectedQuoteId) && state.quoteId !== scope.replacePreparedQuoteId);
}

export function AcademyFirstPublicationEnrollment(props: Props) {
  const [session, setSession] = useState<{ userId: string; token: string } | null>(null);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, value) => setSession(value ? { userId: value.user.id, token: value.access_token } : null));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!session || session.userId !== props.userId) return <p role="status" className="text-sm">契約するアカウントを確認しています。ログインし直した場合はページを再読み込みしてください。</p>;
  return <Enrollment key={`${props.userId}:${session.token}:${props.headquartersId}:${props.policyVersion}:${props.termsRevision}:${props.replacePreparedQuoteId ?? "new"}`} {...props} />;
}

function Enrollment(props: Props) {
  const [quote, setQuote] = useState<FirstPublicationQuote | null>(null);
  const [returnAttempt, setReturnAttempt] = useState<ReturnAttempt | null>(null);
  const [verified, setVerified] = useState(false);
  const [consent, setConsent] = useState(false);
  const [readTerms, setReadTerms] = useState(false);
  const [readBilling, setReadBilling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requiresCheck, setRequiresCheck] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const inFlight = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    lifetime.current = new AbortController();
    const returned = readAcademySetupReturn(window.location.href, props.headquartersId);
    if (returned === "cancelled") setMessage("支払方法の登録を中断しました。この操作だけでは契約準備や課金は行われません。");
    else if (returned) { setReturnAttempt(returned); setMessage("支払方法の登録結果をサーバーで確認してください。戻ってきただけでは契約準備は完了していません。"); }
    else if (new URL(window.location.href).searchParams.has("billing")) setError("支払方法の登録手続きを特定できません。契約状態を確認してからやり直してください。");
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { lifetime.current?.abort(); window.clearInterval(timer); };
  }, [props.headquartersId]);
  const alive = () => lifetime.current !== null && !lifetime.current.signal.aborted;
  const validQuote = quote !== null && usableAcademyEnrollmentQuote(quote, props, now);
  const ready = validQuote && consent && readTerms && readBilling;
  async function currentToken() {
    const { data, error: authError } = await supabase.auth.getSession();
    if (!alive() || authError || data.session?.user.id !== props.userId) throw new Error("契約するアカウントが変わりました。ページを再読み込みしてください。");
    return data.session.access_token;
  }
  const setup = createAcademySetupClient(currentToken);
  function clearConsent() { setConsent(false); setReadTerms(false); setReadBilling(false); }
  async function run(operation: () => Promise<void>, ambiguous = false) {
    if (inFlight.current || !alive()) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await operation(); }
    catch (cause) {
      if (alive()) {
        clearConsent();
        if (ambiguous) setRequiresCheck(true);
        setError(cause instanceof Error ? cause.message : "結果を確認できませんでした。契約状態を確認してください。");
      }
    } finally { inFlight.current = false; if (alive()) setBusy(false); }
  }
  async function showPrepared(state: FirstPublicationStatus) {
    if (!alive()) return;
    setPrepared(true); setRequiresCheck(false); clearConsent();
    setMessage(state.phase === "prepared" ? "契約の準備ができました。初めて講座を公開するまでは無料期間は始まりません。" : "登録済みの契約状態を確認できました。最新の利用状態を確認してください。");
    try { await props.onPrepared(state); }
    catch { if (alive()) setError("契約準備は完了しましたが画面を更新できませんでした。再申し込みせずページを再読み込みしてください。"); }
  }
  function refreshStatus() {
    void run(async () => {
      await currentToken();
      const state = await createFirstPublicationRpc(supabase)(props.headquartersId, { action: "status" });
      await currentToken();
      const expectedQuoteId = quote?.id ?? returnAttempt?.quoteId ?? null;
      if (state && matchesAcademyEnrollmentResult(state, props, expectedQuoteId)) { await showPrepared(state); return; }
      if (state && (state.firstPublishedAt !== null || state.phase !== "prepared")) throw new Error("別の操作で契約状態が変わりました。再申し込みせずページを再読み込みしてください。");
      setRequiresCheck(false); clearConsent();
      setMessage(state ? "以前の見積もりによる準備を確認しましたが、今回の料金と支払方法の確認はまだ完了していません。新しい見積もりで手続きを続けてください。" : "契約準備はまだ登録されていません。支払方法を登録済みの場合は登録結果を確認してください。未登録の場合は料金を確認して進めてください。");
    });
  }
  function getQuote() {
    if (requiresCheck || prepared) return;
    void run(async () => {
      await currentToken();
      const next = await createFirstPublicationQuoteRpc(supabase)(props.headquartersId, props.policyVersion);
      await currentToken();
      if (!usableAcademyEnrollmentQuote(next, props, Date.now()) || next.id === props.replacePreparedQuoteId) throw new Error("料金の有効期限または契約条件が変わりました。最新の条件で見積もりを取得してください。");
      setQuote(next); setVerified(false); setReturnAttempt(null); clearConsent(); setMessage("");
    });
  }
  function startSetup() {
    if (!quote || !ready || verified || requiresCheck || prepared) return;
    void run(async () => {
      if (!usableAcademyEnrollmentQuote(quote, props, Date.now())) throw new Error("見積もりの有効期限が終了しました。料金を再確認してください。");
      const result = await setup.start(props.headquartersId, quote.id, lifetime.current!.signal);
      await currentToken();
      window.location.assign(approvedAcademySetupUrl(result.setupUrl));
    }, true);
  }
  function confirmSetup() {
    if (!returnAttempt || requiresCheck || prepared) return;
    void run(async () => {
      const result = await setup.confirm(props.headquartersId, returnAttempt.quoteId, returnAttempt.attemptId, lifetime.current!.signal);
      await currentToken();
      if (result.verified !== true || result.quote.id !== returnAttempt.quoteId || !usableAcademyEnrollmentQuote(result.quote, props, Date.now())) {
        setVerified(false); setQuote(null); setReturnAttempt(null);
        throw new Error("元の見積もりの期限または契約条件が変わりました。新しい料金を確認してやり直してください。");
      }
      setQuote(result.quote); setVerified(true); clearConsent();
      setMessage("支払方法を確認できました。元の見積もりと契約条件を確認し、契約準備を完了してください。まだ無料期間は始まりません。");
    }, true);
  }
  function prepare() {
    if (!quote || !ready || !verified || requiresCheck || prepared) return;
    void run(async () => {
      await currentToken();
      if (!usableAcademyEnrollmentQuote(quote, props, Date.now())) throw new Error("見積もりの有効期限が終了しました。料金を再確認してください。");
      const state = await createFirstPublicationRpc(supabase)(props.headquartersId, { action: "prepare", quoteId: quote.id, termsRevision: quote.termsRevision, amountYen: quote.amountYen, consent: true });
      await currentToken();
      if (!state || !matchesAcademyEnrollmentResult(state, props, quote.id)) throw new Error("今回の見積もりによる契約準備を確認できませんでした。再申し込みせず契約状態を確認してください。");
      await showPrepared(state);
    }, true);
  }
  return <section aria-label="初公開から7日間無料の申し込み" className="space-y-4 rounded-lg border border-[var(--mikke-line)] bg-white p-4">
    <h2 className="text-base font-bold">講座を公開するための準備</h2>
    <p className="text-sm leading-7">料金と支払方法を確認してから講座を公開できます。初めての公開に成功した日時から7日間（168時間）は無料です。下書きに戻しても無料期間はリセットされず、期限後は有料利用へ移行します。</p>
    {message && <p role="status" className="text-sm leading-7">{message}</p>}
    {error && <p role="alert" className="text-sm leading-7">{error}</p>}
    {!prepared && <>
      {returnAttempt && !verified && <button type="button" className={buttonClass} disabled={busy || requiresCheck} onClick={confirmSetup}>支払方法の登録結果を確認</button>}
      {quote && <div className="space-y-2 rounded-lg border border-[var(--mikke-line)] p-3 text-sm"><p>初回月額（税込）：<strong className="text-lg">{quote.amountYen.toLocaleString("ja-JP")}円</strong></p><p>登録講師：{quote.instructorCount}名</p><p>見積もりの有効期限：{firstPublicationDate(quote.expiresAt)}（日本時間）</p>{!validQuote && <p role="status">見積もりの期限が終了したか条件が変更されています。新しい料金を確認してください。</p>}</div>}
      {validQuote && <div className="space-y-2 text-sm"><p>初回料金は公開時に固定し、後の人数変化は次回更新から反映します。無料終了日時までに取消を受け付ければ初回請求はありません。</p><div className="flex flex-wrap gap-3"><a className="inline-flex min-h-11 items-center text-[var(--mikke-primary)] underline" href={props.termsHref} target="_blank" rel="noopener noreferrer" onClick={() => setReadTerms(true)}>利用規約を開く</a><a className="inline-flex min-h-11 items-center text-[var(--mikke-primary)] underline" href={props.billingHref} target="_blank" rel="noopener noreferrer" onClick={() => setReadBilling(true)}>料金・取消条件を開く</a></div><label className="flex min-h-11 items-start gap-2 leading-7"><input className="mt-2" type="checkbox" disabled={busy || requiresCheck || !readTerms || !readBilling} checked={consent} onChange={event => setConsent(event.target.checked)} />上の2つの文書と表示された料金を確認し、条件に同意します</label></div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={busy || requiresCheck} onClick={getQuote}>{returnAttempt ? "新しい見積もりでやり直す" : quote ? "最新の料金で見積もり直す" : "料金を確認する"}</button>
        {quote && !verified && <button type="button" className={buttonClass} disabled={busy || requiresCheck || !ready} onClick={startSetup}>支払方法の登録へ進む</button>}
        {verified && <button type="button" className={`${buttonClass} font-bold`} disabled={busy || requiresCheck || !ready} onClick={prepare}>同意して契約準備を完了</button>}
      </div>
    </>}
    <button type="button" className={buttonClass} disabled={busy} onClick={refreshStatus}>{busy ? "処理結果を確認中…" : "契約状態を再確認"}</button>
    <p className="text-xs leading-6">この画面で講座が勝手に公開されることはありません。支払方法の登録先はStripeです。カード情報はこの画面では入力しません。</p>
  </section>;
}
