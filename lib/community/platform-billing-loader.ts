import { loadCommunityPlatformStatus, type CommunityBillingTransport, type CommunityPlatformReadState } from "./platform-billing";

// A transport may ignore AbortSignal. Generation checks also prevent stale
// contracts from being published after auth/resource changes or unmount.
export function createCommunityPlatformStatusLoader(
  transport: CommunityBillingTransport,
  publish: (state: CommunityPlatformReadState) => void,
  schedule: (callback: () => void) => void = (callback) => { setTimeout(callback, 0); }
) {
  let generation = 0;
  let disposed = false;
  let inflight: AbortController | null = null;
  function clear(state: CommunityPlatformReadState = { kind: "loading" }) {
    generation++;
    inflight?.abort();
    inflight = null;
    if (!disposed) publish(state);
  }
  async function load(resourceId: string | null) {
    if (disposed) return;
    clear();
    const current = generation;
    const controller = new AbortController();
    inflight = controller;
    const state = await loadCommunityPlatformStatus(resourceId, transport, controller.signal);
    if (!disposed && generation === current && !controller.signal.aborted) publish(state);
  }
  return {
    load, clear,
    authChanged(resourceId: string | null, hasSession: boolean) {
      clear({ kind: hasSession ? "loading" : "auth_required" });
      const current = generation;
      // Never await getSession inside the auth callback (auth lock held).
      if (hasSession) schedule(() => {
        if (!disposed && generation === current) void load(resourceId);
      });
    },
    dispose() {
      disposed = true;
      clear();
    }
  };
}
