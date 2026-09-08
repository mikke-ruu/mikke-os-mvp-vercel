"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AcademyCourse } from "@/types/database";
import type { FirstPublicationStatus } from "@/lib/academy/first-publication/rpc-client";
import type { FirstPublicationAccess } from "@/lib/academy/first-publication/access-client";
import { describeFirstPublication, firstPublicationDate } from "@/lib/academy/first-publication-view";

type Action = "publish" | "unpublish" | "cancel_conversion";
type Props = {
  identityKey: string;
  state: FirstPublicationStatus;
  access?: FirstPublicationAccess;
  course?: AcademyCourse;
  /** Server-derived affordances only; command handler must recheck permissions. */
  allowedActions: Action[];
  onAction: (action: Action) => Promise<void>;
  onRefresh: () => Promise<void>;
};

/** Only mount for an explicitly registered first-publication contract, never a legacy trial. */
export function AcademyFirstPublicationPanel(props: Props) {
  return <Panel key={`${props.identityKey}:${props.state.headquartersId}:${props.course?.id ?? "contract"}:${props.state.policyVersion}`} {...props} />;
}

function Panel({ state, access, course, allowedActions, onAction, onRefresh }: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const [action, setAction] = useState<Action | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    alive.current = true;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (action) dialog.current?.showModal();
    else dialog.current?.close();
  }, [action]);
  const description = describeFirstPublication(state, now, access);
  const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--mikke-line)] px-4 py-2 text-sm disabled:opacity-40";
  const revision = JSON.stringify([state, access, course?.id, course?.name, course?.price, course?.is_published, [...allowedActions].sort()]);
  const [reviewedRevision, setReviewedRevision] = useState("");
  const currentConfirmation = confirmed && reviewedRevision === revision;
  function close() { if (!inFlight.current) { setAction(null); setConfirmed(false); setError(""); } }
  function open(next: Action) { if (needsRefresh) return; setError(""); setNotice(""); setConfirmed(false); setReviewedRevision(revision); setAction(next); }
  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await onRefresh(); if (alive.current) { setNeedsRefresh(false); setConfirmed(false); setAction(null); } }
    catch { if (alive.current) setError("契約状況を取得できませんでした。表示中の情報が最新とは限りません。時間をおいて再確認してください。"); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  async function submit() {
    if (!action || !currentConfirmation || needsRefresh || inFlight.current || !allowedActions.includes(action)) return;
    const submitted = action;
    inFlight.current = true; setBusy(true); setError("");
    try {
      await onAction(submitted);
      if (alive.current) {
        setAction(null); setConfirmed(false);
        setNotice(submitted === "cancel_conversion" ? "取消の受付結果を更新しました。下の契約状況を確認してください。" : "公開状態と契約状況を更新しました。");
      }
    } catch {
      if (alive.current) { setNeedsRefresh(true); setConfirmed(false); setError("処理結果を確認できませんでした。再操作する前に「最新の状態を確認」で結果を確認してください。完了したとは扱っていません。"); }
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  return <section aria-label="初公開から7日間無料の利用契約" className="space-y-3 rounded-lg border border-[var(--mikke-line)] border-t-4 border-t-[var(--mikke-green)] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-bold">Academyの利用契約</h2><span className="rounded-md border border-[var(--mikke-line)] px-2 py-1 text-xs font-bold">{now ? description.title : "利用状態を確認中"}</span></div>
    <p className="text-sm leading-6">{description.description}</p>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-[var(--mikke-muted)]">初回月額（税込）</dt><dd className="mt-1 font-bold">{state.amountYen.toLocaleString("ja-JP")}円</dd></div>
      <div><dt className="text-[var(--mikke-muted)]">{access?.phase === "paid" ? "現在の利用期限（日本時間）" : "無料終了日時（日本時間）"}</dt><dd className="mt-1 break-words font-bold">{firstPublicationDate(access?.phase === "paid" ? access.endsAt : state.trialEndsAt)}</dd></div>
      {state.cancellationAcceptedAt ? <div className="sm:col-span-2"><dt>有料移行の取消受付日時</dt><dd>{firstPublicationDate(state.cancellationAcceptedAt)}</dd></div> : null}
    </dl>
    <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3 text-[var(--mikke-primary)]">無料期間と取消について</summary><p className="leading-7">初公開に成功すると7日間（168時間）の無料期間が始まります。終了日時までにサーバーが取消を受け付ければ初回請求はありません。取消後は新規招待・再送を停止し、未承諾の招待は失効します。公開・編集と承諾済みのAcademy由来の利用権は元の期限まで続きます。通常のCommunity契約は変更しません。</p><p className="mt-2 leading-7">下書きに戻しても利用契約は続きます。初回金額は公開時に固定し、以後の人数変化は次回更新から既存の料金規則で反映します。</p></details>
    <div className="flex flex-wrap gap-2">
      {course && allowedActions.includes(course.is_published ? "unpublish" : "publish") ? <button type="button" disabled={busy || needsRefresh} className={`${button} bg-[var(--mikke-accent)] font-bold text-white`} onClick={() => open(course.is_published ? "unpublish" : "publish")}>{course.is_published ? "下書きに戻す前に確認" : "公開前の確認へ"}</button> : null}
      {allowedActions.includes("cancel_conversion") ? <button type="button" disabled={busy || needsRefresh} className={button} onClick={() => open("cancel_conversion")}>有料移行を取り消す</button> : null}
      <button type="button" disabled={busy} className={button} onClick={refresh}>最新の状態を確認</button>
    </div>
    {notice ? <p role="status" className="text-sm">{notice}</p> : null}
    {error ? <p role="alert" className="text-sm leading-6">{error}</p> : null}
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-[var(--mikke-line)] bg-white p-5 text-[var(--mikke-text)]">
      <h2 id={titleId} className="text-xl font-bold">{action === "cancel_conversion" ? "有料移行を取り消しますか？" : action === "publish" ? "保存済みの講座を公開しますか？" : "講座を下書きに戻しますか？"}</h2>
      <p className="mt-3 text-sm leading-7">{action === "cancel_conversion" ? "取消が受け付けられると新しい招待はできなくなり、未承諾の招待は失効します。現在の利用は元の無料終了日時まで続きます。" : action === "publish" ? `「${course?.name ?? ""}」の保存済み内容を公開します。${state.firstPublishedAt ? "無料期間の起点は変わりません。" : "成功した日時から168時間後に無料期間が終了し、確認済みの初回月額で有料利用へ移行します。"}` : "講座の紹介ページを非公開にします。利用契約は継続し、有料移行の取消にはなりません。"}</p>
      <p className="mt-3 text-sm">初回月額（税込）：{state.amountYen.toLocaleString("ja-JP")}円</p>
      <label className="my-4 flex min-h-11 items-start gap-2 text-sm leading-7"><input type="checkbox" className="mt-2" checked={currentConfirmation} disabled={busy} onChange={event => { setReviewedRevision(revision); setConfirmed(event.target.checked); }} />表示された内容と契約への影響を確認しました</label>
      {error ? <p role="alert" className="mb-3 text-sm leading-6">{error}</p> : null}
      {needsRefresh ? <button type="button" disabled={busy} className={`${button} mb-3`} onClick={refresh}>最新の状態を確認</button> : null}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={button} onClick={close}>戻る</button><button type="button" disabled={busy || needsRefresh || !currentConfirmation || !action || !allowedActions.includes(action)} className={`${button} bg-[var(--mikke-accent)] font-bold text-white`} onClick={submit}>{busy ? "処理結果を確認中…" : action === "cancel_conversion" ? "有料移行の取消を申し込む" : action === "publish" ? "講座を公開する" : "下書きに戻す"}</button></div>
    </dialog>
  </section>;
}
