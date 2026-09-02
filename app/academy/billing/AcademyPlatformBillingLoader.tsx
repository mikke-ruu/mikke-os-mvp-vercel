"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createAcademyBillingLoader, type AcademyBillingAuth } from "@/lib/academy/platform-billing-loader";
import { openAcademyPlatformBillingPortal } from "@/lib/academy/platform-billing-adapter";
import { AcademyPlatformBillingPanel } from "./AcademyPlatformBillingPanel";

/** Mount below AuthGate with user.id (NOT profile.user_id), selected URL HQ and
 * existing supabase.auth.
 * Transport injection permits local tests without session/DB/provider traffic.
 */
export function AcademyPlatformBillingLoader({ userId, resourceId, isGuest, auth, fetch: fetcher }: {
  userId: string | null; resourceId: string | null; isGuest: boolean;
  auth: AcademyBillingAuth; fetch: typeof globalThis.fetch;
}) {
  const [portalBusy, setPortalBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  // A different scope gets its own empty store during render, BEFORE effects run.
  const loader = useMemo(() => createAcademyBillingLoader({ userId, resourceId, isGuest, auth, fetch: fetcher }), [userId, resourceId, isGuest, auth, fetcher]);
  const state = useSyncExternalStore(loader.subscribe, loader.getSnapshot, loader.getServerSnapshot);
  useEffect(() => { loader.start(); return loader.dispose; }, [loader]);
  useEffect(() => { setPortalBusy(false); setActionMessage(""); }, [userId, resourceId]);

  async function openPortal() {
    if (!userId || !resourceId || isGuest || portalBusy) return;
    setPortalBusy(true);
    setActionMessage("");
    const getAccessToken = async () => {
      const { data, error } = await auth.getSession();
      if (error || data.session?.user.id !== userId || data.session.user.is_anonymous) return null;
      return data.session.access_token;
    };
    const result = await openAcademyPlatformBillingPortal(resourceId, crypto.randomUUID(), { getAccessToken, fetch: fetcher });
    if (result.kind === "redirect") {
      const token = await getAccessToken();
      if (token) {
        window.location.assign(result.url);
        return;
      }
    }
    const messages = {
      sign_in_required: "ログイン状態が変わりました。もう一度ログインしてください。",
      unavailable: "請求管理を開けませんでした。時間をおいて再度お試しください。",
      not_configured: "請求管理との接続はまだ完了していません。",
      policy_pending: "契約条件の確認が終わるまで請求管理は利用できません。",
      state_conflict: "契約状態が変わりました。最新情報を再確認してください。",
      invalid_request: "本部の請求先を確認できませんでした。",
    } as const;
    setActionMessage(result.kind === "redirect" ? messages.sign_in_required : messages[result.kind]);
    setPortalBusy(false);
    await loader.reload();
  }
  return <div className="space-y-4">
    <AcademyPlatformBillingPanel state={state} compact onOpenPortal={() => { void openPortal(); }} portalBusy={portalBusy} actionMessage={actionMessage} />
    {state.kind !== "loading" && state.kind !== "sign_in_required" ? <button type="button" onClick={() => { void loader.reload(); }} className="min-h-11 rounded-xl border border-[var(--mikke-line)] px-4 py-3 font-semibold">契約情報を再確認</button> : null}
  </div>;
}
