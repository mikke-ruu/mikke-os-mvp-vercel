"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase/client";
import { FIRST_PUBLICATION_CLOCK_FAULT_MESSAGE, createFirstPublicationCancellationClient, createFirstPublicationCancellationAcknowledgmentClient, createFirstPublicationCancellationStatusClient } from "@/lib/academy/first-publication/cancellation-client";
import { createFirstPublicationRpc } from "@/lib/academy/first-publication/rpc-client";
import { firstPublicationDate } from "@/lib/academy/first-publication-view";
import { createFirstPublicationCancellationState, type CancellationView } from "./first-publication-cancellation-state";

const serverState: CancellationView = { checked: false, busy: false, pendingKey: null, receipt: null, error: "", serverAbsent: false };
export function useAcademyCancellation({ userId, headquartersId, token, enabled }: {
  userId: string; headquartersId: string; token: string; enabled: boolean;
}) {
  const workspace = useMemo(() => {
    const storageKey = `academy-cancellation:${userId}:${headquartersId}`;
    let controller = new AbortController();
    let initialKey: string | null = null;
    try { initialKey = typeof window === "undefined" ? null : window.sessionStorage.getItem(storageKey); } catch { /* A write must succeed before any new dispatch. */ }
    const assertCurrentActor = async () => {
      if (initialKey !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(initialKey)) throw new Error("invalid_saved_cancellation_key");
      const current = controller;
      current.signal.throwIfAborted();
      const { data, error } = await supabase.auth.getSession();
      current.signal.throwIfAborted();
      if (current !== controller || error || data.session?.user.id !== userId || data.session.user.is_anonymous || data.session.access_token !== token) throw new Error("cancellation_identity_changed");
    };
    const boundary = () => ({ assertCurrentActor, signal: controller.signal });
    const model = createFirstPublicationCancellationState({
      initialKey,
      check: assertCurrentActor,
      remember: key => window.sessionStorage.setItem(storageKey, key),
      newKey: () => crypto.randomUUID(),
      read: () => createFirstPublicationCancellationStatusClient(supabase)(headquartersId, boundary()),
      cancel: key => createFirstPublicationCancellationClient(supabase)({ headquartersId, idempotencyKey: key }, boundary()),
      acknowledge: key => createFirstPublicationCancellationAcknowledgmentClient(supabase)({ headquartersId, idempotencyKey: key }, boundary()),
      apply: () => createFirstPublicationRpc(supabase)(headquartersId, { action: "cancel_conversion" }),
    });
    return {
      model,
      activate() { controller = new AbortController(); model.activate(); },
      dispose() { controller.abort(); model.dispose(); },
      invalidateIdentity() { controller.abort(); model.dispose(); /* Keep the scoped attempt for same-user recovery after token refresh or sign-in. */ },
    };
  }, [userId, headquartersId, token]);
  const state = useSyncExternalStore(workspace.model.subscribe, workspace.model.getSnapshot, () => serverState);
  useEffect(() => {
    workspace.activate();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId || session.access_token !== token) workspace.invalidateIdentity();
    });
    return () => { data.subscription.unsubscribe(); workspace.dispose(); };
  }, [workspace, userId, token]);
  useEffect(() => { if (enabled) void workspace.model.refresh().catch(() => undefined); }, [workspace, enabled]);
  return {
    state,
    canStart: enabled && state.checked && !state.busy && !state.pendingKey && !state.receipt,
    start: workspace.model.start,
    refresh: workspace.model.refresh,
    resume: workspace.model.resume,
    resendSame: workspace.model.resendSame,
  };
}

export function AcademyCancellationNotice({ cancellation }: { cancellation: ReturnType<typeof useAcademyCancellation> }) {
  const { state } = cancellation;
  if (state.fault) return <section className="space-y-2 rounded-lg border border-[var(--mikke-line)] bg-white p-4 text-sm" aria-label="取消希望と課金停止"><p role="status">{FIRST_PUBLICATION_CLOCK_FAULT_MESSAGE}</p><p>再操作は不要です。取消完了を意味するものではありません。</p></section>;
  if (!state.receipt && !state.pendingKey && !state.error) return null;
  return <section className="space-y-2 rounded-lg border border-[var(--mikke-line)] bg-white p-4 text-sm" aria-label="有料移行の取消受付">
    <h3 className="font-bold">{state.receipt ? state.receipt.applied ? "有料移行の取消を受付済み" : "取消受付済み・画面反映待ち" : "取消の受付を確認しています"}</h3>
    {state.receipt ? <><p>受付日時：{firstPublicationDate(state.receipt.requestReceivedAt)}（日本時間）</p><p>取消は受け付けています。再度の取消は不要です。元の無料終了日時は{firstPublicationDate(state.receipt.trialEndsAt)}です。</p></> : <p>受付完了はまだ確認できていません。新しい取消を申し込まず、同じ手続きの受付状況を確認してください。</p>}
    {state.error && <p role="alert" className="leading-6">{state.error}</p>}
    {state.serverAbsent && state.pendingKey && !state.receipt && <><p className="leading-6">サーバーにはこの取消がまだ記録されていません。受付完了は未確認です。同じ手続きで再送すると、サーバーが今回受け取った日時が新たな受付時刻になります。</p><button type="button" disabled={state.busy} className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 py-2 disabled:opacity-40" onClick={() => void cancellation.resendSame().catch(() => undefined)}>同じ手続きで取消を再送</button></>}
    <button type="button" disabled={state.busy} className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 py-2 disabled:opacity-40" onClick={() => void (state.pendingKey || state.receipt ? cancellation.resume() : cancellation.refresh()).catch(() => undefined)}>{state.busy ? "受付状況を確認中…" : state.pendingKey || state.receipt ? "同じ手続きの受付・反映状況を確認" : "取消の受付状況を再確認"}</button>
  </section>;
}
