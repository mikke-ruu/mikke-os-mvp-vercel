import { readAcademyPlatformBillingStatus } from "@/lib/academy/platform-billing-adapter";
import type { AcademyPlatformBillingState } from "@/lib/academy/platform-billing-view";

/** Structural subset of the existing browser Auth client; injectable without real tokens.
 * getSession is transport only. The shared API MUST verify bearer + billing ownership.
 */
export type AcademyBillingAuth = {
  getSession: () => Promise<{ data: { session: null | { access_token: string; user: { id: string; is_anonymous?: boolean } } }; error: unknown }>;
  onAuthStateChange: (callback: () => void) => { data: { subscription: { unsubscribe: () => void } } };
};

const loading: AcademyPlatformBillingState = { kind: "loading" };
export function createAcademyBillingLoader({ userId, resourceId, isGuest, auth, fetch: fetcher, timeoutMs = 15000 }: {
  userId: string | null; resourceId: string | null; isGuest: boolean;
  auth: AcademyBillingAuth; fetch: typeof globalThis.fetch; timeoutMs?: number;
}) {
  let state: AcademyPlatformBillingState = loading;
  let revision = 0;
  let disposed = false;
  let controller: AbortController | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let deferred: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: AcademyPlatformBillingState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const invalidate = () => {
    revision++;
    controller?.abort();
    clearTimeout(deadline);
    clearTimeout(deferred);
    publish(loading);
  };
  async function reload() {
    if (disposed) return;
    invalidate();
    if (!userId || isGuest) { publish({ kind: "sign_in_required" }); return; }
    const requestRevision = revision;
    const request = new AbortController();
    controller = request;
    deadline = setTimeout(() => {
      if (revision !== requestRevision || disposed) return;
      revision++;
      request.abort();
      publish({ kind: "unavailable" });
    }, timeoutMs);
    const result = await readAcademyPlatformBillingStatus(resourceId, {
      fetch: fetcher,
      getAccessToken: async () => {
        const { data, error } = await auth.getSession();
        if (error) throw new Error("session unavailable");
        // Never use profile.user_id, purchase state, URL owner or cached token.
        if (data.session?.user.id !== userId || data.session.user.is_anonymous) return null;
        return data.session.access_token;
      },
    }, request.signal);
    if (disposed || request.signal.aborted || revision !== requestRevision) return;
    clearTimeout(deadline);
    publish(result);
  }
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => loading,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reload,
    start: () => {
      disposed = false;
      unsubscribe?.();
      unsubscribe = auth.onAuthStateChange(() => {
        if (disposed) return;
        // Clear synchronously; defer Auth calls until outside the Auth callback lock.
        invalidate();
        deferred = setTimeout(() => { void reload(); }, 0);
      }).data.subscription.unsubscribe;
      void reload();
    },
    dispose: () => {
      disposed = true;
      unsubscribe?.();
      unsubscribe = undefined;
      invalidate();
      listeners.clear();
    },
  };
}
