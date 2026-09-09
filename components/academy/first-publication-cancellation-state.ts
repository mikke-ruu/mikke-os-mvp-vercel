import type { FirstPublicationCancellationReceipt, FirstPublicationCancellationOutcome, FirstPublicationClockFault } from "@/lib/academy/first-publication/cancellation-client";

type Receipt = FirstPublicationCancellationReceipt & { applied: boolean };
type RemoteStatus = null | { status: "awaiting_durable_acknowledgment"; idempotencyKey: string }
  | FirstPublicationClockFault
  | (Receipt & { idempotencyKey: string });
export type CancellationView = {
  checked: boolean; busy: boolean; pendingKey: string | null; receipt: Receipt | null; fault?: FirstPublicationClockFault | null; error: string; serverAbsent: boolean;
};
type Dependencies = {
  check: () => Promise<void>;
  read: () => Promise<RemoteStatus>;
  cancel: (key: string) => Promise<FirstPublicationCancellationOutcome>;
  acknowledge: (key: string) => Promise<FirstPublicationCancellationOutcome>;
  apply: () => Promise<unknown>;
  newKey: () => string;
  remember: (key: string) => void;
  initialKey: string | null;
};

/** Receipt acknowledgement is durable acceptance; applying the business state is separate. */
export function createFirstPublicationCancellationState(deps: Dependencies) {
  let state: CancellationView = { checked: false, busy: false, pendingKey: deps.initialKey, receipt: null, error: "", serverAbsent: false };
  let disposed = false;
  let epoch = 0;
  let locked = false;
  const listeners = new Set<() => void>();
  function set(patch: Partial<CancellationView>) { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } }
  function hold(fault: FirstPublicationClockFault) {
    set({ fault, checked: true, pendingKey: fault.idempotencyKey, receipt: null, error: "", serverAbsent: false });
    try { deps.remember(fault.idempotencyKey); } catch { /* Durable fault remains authoritative. */ }
  }
  async function read(check: () => Promise<void>) {
    await check();
    const result = await deps.read();
    await check();
    if (result?.status === "clock_fault") {
      hold(result);
    } else if (result?.status === "accepted" && !state.fault) {
      set({ checked: true, pendingKey: result.idempotencyKey, receipt: result, error: "", serverAbsent: false });
      try { deps.remember(result.idempotencyKey); } catch { /* Server receipt remains authoritative. */ }
    } else if (result) {
      set({ checked: true, pendingKey: result.idempotencyKey, error: "", serverAbsent: false });
      try { deps.remember(result.idempotencyKey); } catch { /* Server awaiting status remains authoritative. */ }
    } else {
      // A read must never erase a receipt already acknowledged, or an ambiguous attempt.
      set({ checked: true, error: "", serverAbsent: !state.receipt && !state.fault });
    }
    return result;
  }
  async function run(operation: (check: () => Promise<void>) => Promise<void>) {
    if (locked || disposed) throw new Error("cancellation_operation_busy");
    const currentEpoch = epoch;
    const check = async () => { if (disposed || epoch !== currentEpoch) throw new Error("cancellation_scope_changed"); await deps.check(); if (disposed || epoch !== currentEpoch) throw new Error("cancellation_scope_changed"); };
    locked = true; set({ busy: true, error: "" });
    try { await operation(check); }
    catch (error) {
      if (epoch === currentEpoch) set({ checked: false, serverAbsent: false, error: state.receipt ? "取消は受付済みです。画面への反映状況を確認できませんでした。再度の取消は不要です。" : "取消の受付結果を確認できませんでした。新しく申し込まず、受付状況を再確認してください。" });
      throw error;
    } finally { if (epoch === currentEpoch) { locked = false; set({ busy: false }); } }
  }
  async function applyAccepted(check: () => Promise<void>) {
    if (state.fault || !state.receipt || state.receipt.applied) return;
    try {
      await check(); const result = await deps.apply(); await check();
      if (!result || typeof result !== "object" || !("phase" in result) || result.phase !== "cancelled"
        || !("headquartersId" in result) || result.headquartersId !== state.receipt.headquartersId
        || !("cancellationAcceptedAt" in result) || typeof result.cancellationAcceptedAt !== "string"
        || !Number.isFinite(Date.parse(result.cancellationAcceptedAt))) throw new Error("cancellation_application_unconfirmed");
      set({ receipt: { ...state.receipt, applied: true }, error: "" });
    } catch {
      // Never retract a successful durable acknowledgement because the projection failed.
      try { await check(); set({ error: "取消は受付済みです。画面への反映を待っています。再度の取消は不要です。" }); } catch { /* Old scope must stay silent. */ }
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate: () => { disposed = false; epoch++; locked = false; },
    dispose: () => { disposed = true; epoch++; locked = false; listeners.clear(); },
    refresh: () => run(async check => { await read(check); }),
    start: () => run(async check => {
      if (!state.checked || state.pendingKey || state.receipt || state.fault) throw new Error("cancellation_status_confirmation_required");
      await check();
      const key = deps.newKey();
      // Store before dispatch so a lost response cannot produce a new automatic request.
      deps.remember(key); set({ pendingKey: key, serverAbsent: false });
      const receipt = await deps.cancel(key);
      await check();
      if (receipt.status === "clock_fault") { hold(receipt); return; }
      set({ receipt: { ...receipt, applied: false }, checked: true });
      await applyAccepted(check);
    }),
    resume: () => run(async check => {
      await read(check);
      if (state.fault) return;
      if (!state.receipt) {
        if (!state.pendingKey) throw new Error("cancellation_attempt_not_found");
        if (state.serverAbsent) return; // A separate explicit action may resend the same key.
        await check();
        const receipt = await deps.acknowledge(state.pendingKey);
        await check();
        if (receipt.status === "clock_fault") { hold(receipt); return; }
        set({ receipt: { ...receipt, applied: false }, checked: true });
      }
      await applyAccepted(check);
    }),
    resendSame: () => run(async check => {
      await read(check);
      if (state.fault) return;
      if (state.receipt) { await applyAccepted(check); return; }
      if (!state.pendingKey) throw new Error("cancellation_attempt_not_found");
      await check();
      // Only an explicit click and a successful null read permit append with the saved key.
      const receipt = await (state.serverAbsent ? deps.cancel(state.pendingKey) : deps.acknowledge(state.pendingKey));
      await check();
      if (receipt.status === "clock_fault") { hold(receipt); return; }
      set({ receipt: { ...receipt, applied: false }, checked: true, serverAbsent: false });
      await applyAccepted(check);
    }),
  };
}
