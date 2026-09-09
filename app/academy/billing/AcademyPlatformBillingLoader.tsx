"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createAcademyBillingLoader, type AcademyBillingAuth } from "@/lib/academy/platform-billing-loader";
import {
  confirmAcademyPlatformCheckout,
  openAcademyPlatformBillingPortal,
  requestAcademyPlatformBillingQuote,
  type AcademyBillingMutationResult,
  type AcademyBillingQuote,
} from "@/lib/academy/platform-billing-adapter";
import { AcademyPlatformBillingPanel } from "./AcademyPlatformBillingPanel";

/** Mount below AuthGate with user.id (NOT profile.user_id), selected URL HQ and
 * existing supabase.auth.
 * Transport injection permits local tests without session/DB/provider traffic.
 */
export function AcademyPlatformBillingLoader({ userId, resourceId, isGuest, auth, fetch: fetcher, checkoutPlanKey, managementOnly = false }: {
  userId: string | null; resourceId: string | null; isGuest: boolean;
  auth: AcademyBillingAuth; fetch: typeof globalThis.fetch;
  checkoutPlanKey: "small" | "medium" | "large" | null;
  managementOnly?: boolean;
}) {
  const [portalBusy, setPortalBusy] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [quote, setQuote] = useState<AcademyBillingQuote | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const actionController = useRef<AbortController | null>(null);
  const portalInFlight = useRef(false);
  // A different scope gets its own empty store during render, BEFORE effects run.
  const loader = useMemo(() => createAcademyBillingLoader({ userId, resourceId, isGuest, auth, fetch: fetcher }), [userId, resourceId, isGuest, auth, fetcher]);
  const currentScope = useRef(loader);
  currentScope.current = loader;
  const actionGeneration = useRef(0);
  const state = useSyncExternalStore(loader.subscribe, loader.getSnapshot, loader.getServerSnapshot);
  const visibleQuote = quote?.scope.ownerUserId === userId && quote.scope.resourceId === resourceId ? quote : null;
  useEffect(() => { loader.start(); return loader.dispose; }, [loader]);
  useEffect(() => {
    actionGeneration.current++;
    actionController.current?.abort();
    portalInFlight.current = false;
    setPortalBusy(false);
    setQuoteBusy(false);
    setCheckoutBusy(false);
    setQuote(null);
    setAccepted(false);
    setActionMessage("");
    // Auth callbacks invalidate synchronously and never await another Auth call.
    const { data } = auth.onAuthStateChange(() => {
      actionGeneration.current++;
      actionController.current?.abort();
      portalInFlight.current = false;
      setPortalBusy(false);
      setQuoteBusy(false);
      setCheckoutBusy(false);
      setQuote(null);
      setAccepted(false);
      setActionMessage("");
    });
    return () => {
      actionGeneration.current++;
      actionController.current?.abort();
      data.subscription.unsubscribe();
    };
  }, [loader, auth, managementOnly]);

  const getAccessToken = async () => {
    const { data, error } = await auth.getSession();
    if (error || data.session?.user.id !== userId || data.session.user.is_anonymous) return null;
    return data.session.access_token;
  };
  const messages: Record<Exclude<AcademyBillingMutationResult["kind"], "redirect">, string> = {
    pending: "決済画面の準備状況を確認しています。重ねて申し込まず、契約情報を再確認してください。",
    sign_in_required: "ログイン状態が変わりました。もう一度ログインしてください。",
    unavailable: "手続きを続けられませんでした。最新の契約情報を確認して、時間をおいてお試しください。",
    not_configured: "請求管理との接続はまだ完了していません。",
    policy_pending: "契約条件の確認が終わるまで手続きできません。",
    state_conflict: "契約状態が変わりました。最新情報を再確認してください。",
    invalid_request: "本部の請求先を確認できませんでした。",
  };

  async function requestQuote() {
    if (managementOnly || portalInFlight.current || !userId || isGuest || !checkoutPlanKey || quoteBusy || checkoutBusy || state.kind !== "owner" || !state.allowedActions.includes("checkout")) return;
    actionController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    const requestId = crypto.randomUUID();
    setQuoteBusy(true);
    setQuote(null);
    setAccepted(false);
    setActionMessage("");
    const result = await requestAcademyPlatformBillingQuote(userId, resourceId, checkoutPlanKey, requestId, { getAccessToken, fetch: fetcher }, controller.signal);
    if (controller.signal.aborted || actionController.current !== controller) return;
    setQuoteBusy(false);
    if (result.kind === "quote") setQuote(result.quote);
    else setActionMessage(messages[result.kind]);
  }

  async function confirmCheckout() {
    if (managementOnly || portalInFlight.current || !userId || isGuest || !visibleQuote || !accepted || checkoutBusy) return;
    actionController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    setCheckoutBusy(true);
    setActionMessage("");
    const result = await confirmAcademyPlatformCheckout(visibleQuote, { getAccessToken, fetch: fetcher }, controller.signal);
    if (controller.signal.aborted || actionController.current !== controller) return;
    if (result.kind === "redirect") {
      const token = await getAccessToken();
      if (token && !controller.signal.aborted) {
        window.location.assign(result.url);
        return;
      }
      setActionMessage(messages.sign_in_required);
    } else {
      setActionMessage(messages[result.kind]);
    }
    setCheckoutBusy(false);
    if (result.kind === "pending") await loader.reload();
  }

  async function openPortal() {
    if (!userId || !resourceId || isGuest || portalBusy || portalInFlight.current || state.kind !== "owner" || !state.allowedActions.includes("portal")) return;
    portalInFlight.current = true;
    actionController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    const generation = actionGeneration.current;
    const isCurrent = () => !controller.signal.aborted && actionController.current === controller && currentScope.current === loader && actionGeneration.current === generation;
    setPortalBusy(true);
    setActionMessage("");
    try {
      const initialToken = await getAccessToken();
      if (!isCurrent()) return;
      if (!initialToken) { setActionMessage(messages.sign_in_required); return; }
      const result = await openAcademyPlatformBillingPortal(resourceId, crypto.randomUUID(), {
        getAccessToken: async () => {
          const token = await getAccessToken();
          return isCurrent() && token === initialToken ? token : null;
        }, fetch: fetcher,
      }, controller.signal);
      if (!isCurrent()) return;
      if (result.kind === "redirect") {
        const token = await getAccessToken();
        if (!isCurrent()) return;
        if (token && token === initialToken) {
          window.location.assign(result.url);
          return;
        }
      }
      setActionMessage(result.kind === "redirect" ? messages.sign_in_required : messages[result.kind]);
      await loader.reload();
    } catch {
      if (isCurrent()) setActionMessage(messages.unavailable);
    } finally {
      if (isCurrent()) {
        portalInFlight.current = false;
        setPortalBusy(false);
        actionController.current = null;
      }
    }
  }
  return <div className="space-y-4">
    <AcademyPlatformBillingPanel
      state={state}
      compact
      managementOnly={managementOnly}
      quote={visibleQuote}
      quoteAccepted={accepted}
      quoteBusy={quoteBusy}
      checkoutBusy={checkoutBusy}
      onRequestQuote={!managementOnly && checkoutPlanKey ? () => { void requestQuote(); } : undefined}
      onQuoteAccepted={setAccepted}
      onConfirmCheckout={() => { void confirmCheckout(); }}
      onOpenPortal={() => { void openPortal(); }}
      portalBusy={portalBusy}
      actionMessage={actionMessage}
    />
    {state.kind !== "loading" && state.kind !== "sign_in_required" ? <button type="button" onClick={() => { void loader.reload(); }} className="min-h-11 rounded-xl border border-[var(--mikke-line)] px-4 py-3 font-semibold">契約情報を再確認</button> : null}
  </div>;
}
