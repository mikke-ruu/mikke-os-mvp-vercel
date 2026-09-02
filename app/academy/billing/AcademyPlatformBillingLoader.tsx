"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createAcademyBillingLoader, type AcademyBillingAuth } from "@/lib/academy/platform-billing-loader";
import { AcademyPlatformBillingPanel } from "./AcademyPlatformBillingPanel";

/** Mount below AuthGate with user.id (NOT profile.user_id), selected URL HQ and
 * existing supabase.auth. Not mounted by the fixture page or production routes yet.
 * Transport injection permits local tests without session/DB/provider traffic.
 */
export function AcademyPlatformBillingLoader({ userId, resourceId, isGuest, auth, fetch: fetcher }: {
  userId: string | null; resourceId: string | null; isGuest: boolean;
  auth: AcademyBillingAuth; fetch: typeof globalThis.fetch;
}) {
  // A different scope gets its own empty store during render, BEFORE effects run.
  const loader = useMemo(() => createAcademyBillingLoader({ userId, resourceId, isGuest, auth, fetch: fetcher }), [userId, resourceId, isGuest, auth, fetcher]);
  const state = useSyncExternalStore(loader.subscribe, loader.getSnapshot, loader.getServerSnapshot);
  useEffect(() => { loader.start(); return loader.dispose; }, [loader]);
  return <div className="space-y-4">
    <AcademyPlatformBillingPanel state={state} />
    {state.kind !== "loading" && state.kind !== "sign_in_required" ? <button type="button" onClick={() => { void loader.reload(); }} className="min-h-11 rounded-xl border border-[var(--mikke-line)] px-4 py-3 font-semibold">契約情報を再確認</button> : null}
  </div>;
}
