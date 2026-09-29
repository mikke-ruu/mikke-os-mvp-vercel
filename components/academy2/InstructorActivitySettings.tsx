"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./instructor-activity.module.css";

export type ActivityRequestInput = {
  kind: "leave" | "resume";
  startsOn: string | null;
  endsOn: string | null;
  reason: string;
};

export type InstructorActivityState = {
  status: "active" | "payment_pending" | "leave" | "suspended";
  leaveAllowed: boolean;
  transitionReviewRequired?: boolean;
  requests: Array<ActivityRequestInput & {
    id: string;
    status: "pending" | "approved" | "declined";
    response: string | null;
  }>;
};

const activityLabels = { active: "有効", payment_pending: "支払待ち", leave: "休会", suspended: "休止" };
const requestLabels = { pending: "本部確認待ち", approved: "承認済み", declined: "承認されませんでした" };

/** Application only: the parent/server verifies scope and eligibility; no fee or license state is changed here. */
export function InstructorActivitySettings({ state, onSubmit, loading = false, error, historyHref }: {
  state: InstructorActivityState;
  onSubmit: (input: ActivityRequestInput) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  historyHref?: string;
}) {
  const id = useId();
  const inFlight = useRef(false);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [reason, setReason] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "unsaved" | "saving" | "saved" | "failed">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const kind = state.status === "leave" || state.status === "suspended" ? "resume" : "leave";
  const canRequest = kind === "resume" || (state.status === "active" && state.leaveAllowed);
  const pendingRequest = state.requests.some(request => request.status === "pending");
  const saving = loading || saveState === "saving";

  function changed(update: () => void) {
    update();
    setSaveState("unsaved");
    setFormError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || inFlight.current || !canRequest || pendingRequest) return;
    if (kind === "leave" && (!startsOn || !endsOn || endsOn < startsOn)) {
      setFormError("希望する休会期間を確認してください。終了日は開始日以降を選んでください。");
      setSaveState("failed");
      return;
    }
    inFlight.current = true;
    setSaveState("saving");
    setFormError(null);
    try {
      await onSubmit({ kind, startsOn: kind === "leave" ? startsOn : null, endsOn: kind === "leave" ? endsOn : null, reason: reason.trim() });
      setSaveState("saved");
    } catch {
      setSaveState("failed");
      setFormError("保存結果を確認できませんでした。入力内容は残っています。申請状況を確認してから、もう一度お試しください。");
    } finally {
      inFlight.current = false;
    }
  }

  return <section className={styles.panel} aria-labelledby={`${id}-title`}>
    <div className={styles.card}>
      <h2 id={`${id}-title`}>F 活動・契約</h2>
      <p className={styles.help}>現在の状態：<strong>{activityLabels[state.status]}</strong></p>
      {state.transitionReviewRequired && <p className={styles.note}>状態の反映を本部で確認中です。</p>}
      <p className={styles.help}>休会・再開は、本部が申請を確認してから反映されます。</p>
      {historyHref && <Link className={styles.historyLink} href={historyHref}>過去の申込・開催・認定履歴を見る →</Link>}
      {canRequest ? <form onSubmit={submit} aria-busy={saving}>
        <fieldset className={styles.fields} disabled={saving || pendingRequest}>
          <legend className={styles.legend}>{kind === "leave" ? "休会を申請する" : "再開を申請する"}</legend>
          {kind === "leave" && <div className={styles.grid2}>
            <div className={styles.field}><label htmlFor={`${id}-start`}>希望する休会開始日</label><input id={`${id}-start`} type="date" required value={startsOn} onChange={event => changed(() => setStartsOn(event.target.value))} /></div>
            <div className={styles.field}><label htmlFor={`${id}-end`}>希望する休会終了日</label><input id={`${id}-end`} type="date" required min={startsOn || undefined} value={endsOn} onChange={event => changed(() => setEndsOn(event.target.value))} /></div>
          </div>}
          <div className={styles.field}><label htmlFor={`${id}-reason`}>{kind === "leave" ? "休会理由" : "本部への連絡事項"}</label><textarea id={`${id}-reason`} required maxLength={4000} value={reason} onChange={event => changed(() => setReason(event.target.value))} /></div>
          <div className={styles.actions}><button className={styles.primary} type="submit" disabled={saving || saveState === "saved"}>{saving ? "申請を保存しています…" : kind === "leave" ? "休会を申請する" : "再開を申請する"}</button></div>
        </fieldset>
        <p className={styles.help} role="status" aria-live="polite">{saveState === "saved" ? "申請を保存しました。本部の確認をお待ちください。" : pendingRequest ? "申請済みです。本部の確認をお待ちください。" : saveState === "unsaved" ? "未保存の入力があります。" : saveState === "saving" ? "保存中です。" : saveState === "failed" ? "保存を確認できませんでした。申請状況をご確認ください。" : "入力後に申請してください。"}</p>
      </form> : <p className={styles.note}>{state.status === "payment_pending" ? "支払い待ちのため、現在は休会を申請できません。" : "この本部では休会申請を受け付けていません。"}</p>}
      {(formError || error) && <p className={styles.warning} role="alert">{error || formError}</p>}
    </div>
    <div className={styles.card}>
      <h2>申請状況・本部からの回答</h2>
      {state.requests.length === 0 ? <p className={styles.help}>申請はまだありません。</p> : <ul className={styles.requestList}>{state.requests.map(request => <li className={styles.request} key={request.id}>
        <div className={styles.requestTop}><strong>{request.kind === "leave" ? "休会申請" : "再開申請"}</strong><span>{requestLabels[request.status]}</span></div>
        {request.kind === "leave" && <p className={styles.help}>希望期間：{request.startsOn ?? "未設定"} 〜 {request.endsOn ?? "未設定"}</p>}
        {request.reason && <p className={styles.response}>{request.reason}</p>}
        <p className={styles.response}><strong>本部からの回答</strong><br />{request.response || "回答はまだありません。"}</p>
      </li>)}</ul>}
    </div>
  </section>;
}
