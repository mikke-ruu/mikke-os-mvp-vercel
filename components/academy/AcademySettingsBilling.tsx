"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { createFirstPublicationAccessRpc, type FirstPublicationAccess } from "@/lib/academy/first-publication/access-client";
import { createFirstPublicationRpc, type FirstPublicationStatus } from "@/lib/academy/first-publication/rpc-client";
import { AcademyFirstPublicationEnrollment, shouldResumeAcademyRepreparation } from "./AcademyFirstPublicationEnrollment";
import { AcademyFirstPublicationPanel } from "./AcademyFirstPublicationPanel";
import { AcademyPlatformBillingLoader } from "@/app/academy/billing/AcademyPlatformBillingLoader";
import { useAcademyCancellation, AcademyCancellationNotice } from "./useAcademyCancellation";

type Props = { userId: string; headquartersId: string; sample: boolean; isGuest: boolean; legacy: ReactNode };
type ReadState = { kind: "loading" } | { kind: "error" } | { kind: "legacy" }
  | { kind: "new"; access: FirstPublicationAccess; status: FirstPublicationStatus | null };
const policyVersion = "academy-first-publication-trial-2026-09-08-v1";
const termsRevision = "academy-first-publication-trial-terms-2026-09-08-v1";

export function AcademySettingsBilling(props: Props) {
  const [session, setSession] = useState<{ userId: string; token: string } | null>(null);
  const sample = process.env.NODE_ENV === "development" && props.sample;
  useEffect(() => {
    if (sample) return;
    const { data } = supabase.auth.onAuthStateChange((_event, value) => setSession(value ? { userId: value.user.id, token: value.access_token } : null));
    return () => data.subscription.unsubscribe();
  }, [sample]);
  if (sample) return props.legacy;
  if (!session || session.userId !== props.userId) return <p role="status" className="rounded-lg border border-[var(--mikke-line)] p-4 text-sm">契約を確認するアカウントを確認しています。</p>;
  return <BillingWorkspace key={`${props.userId}:${session.token}:${props.headquartersId}`} {...props} token={session.token} />;
}

function BillingWorkspace({ userId, headquartersId, legacy, isGuest, token }: Props & { token: string }) {
  const [view, setView] = useState<ReadState>({ kind: "loading" });
  const [renewPrepared, setRenewPrepared] = useState(false);
  const alive = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const cancellation = useAcademyCancellation({ userId, headquartersId, token, enabled: view.kind === "new" && view.status?.firstPublishedAt != null });
  const cancellationNotice = <AcademyCancellationNotice cancellation={cancellation} />;
  const assertActor = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (!alive.current || error || data.session?.user.id !== userId) throw new Error("billing_identity_changed");
  }, [userId]);
  const load = useCallback(async () => {
    const request = ++generation.current;
    if (alive.current) { setView({ kind: "loading" }); setRenewPrepared(false); }
    try {
      await assertActor();
      const access = await createFirstPublicationAccessRpc(supabase)(headquartersId);
      await assertActor();
      if (request !== generation.current) return;
      if (access === null) { setView({ kind: "legacy" }); return; }
      if (access.policyVersion !== policyVersion) throw new Error("unknown_billing_policy");
      const status = await createFirstPublicationRpc(supabase)(headquartersId, { action: "status" });
      await assertActor();
      if (status === null && (access.phase !== "prepared" || access.active || access.cancellationAcceptedAt !== null)) throw new Error("inconsistent_billing_registration");
      if (status && (status.policyVersion !== access.policyVersion || status.termsRevision !== termsRevision)) throw new Error("billing_policy_changed");
      if (request === generation.current) {
        setRenewPrepared(shouldResumeAcademyRepreparation(window.location.href, headquartersId, status));
        setView({ kind: "new", access, status });
      }
    } catch (error) {
      if (alive.current && request === generation.current) setView({ kind: "error" });
      throw error;
    }
  }, [assertActor, headquartersId]);
  useEffect(() => {
    alive.current = true;
    void load().catch(() => undefined);
    return () => { alive.current = false; generation.current++; };
  }, [load]);
  if (view.kind === "loading") return <>{cancellationNotice}<p role="status" className="rounded-lg border border-[var(--mikke-line)] p-4 text-sm">利用契約を確認しています…</p></>;
  if (view.kind === "error") return <>{cancellationNotice}<section className="space-y-3 rounded-lg border border-[var(--mikke-line)] bg-white p-4"><h2 className="font-bold">Academyの利用契約</h2><p role="alert" className="text-sm leading-7">契約状態を取得できませんでした。未契約という意味ではありません。確認できるまで申し込みや取消は行えません。</p><button type="button" className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 text-sm" onClick={() => void load().catch(() => undefined)}>契約状態を再確認</button></section></>;
  if (view.kind === "legacy") return legacy;
  if (view.status === null || renewPrepared) return <div className="space-y-3">
    {renewPrepared && <p className="text-sm leading-7">新しい見積もりで料金と支払方法を確認し直します。以前の見積もりと支払方法の確認結果は引き継ぎません。</p>}
    <AcademyFirstPublicationEnrollment userId={userId} headquartersId={headquartersId} policyVersion={policyVersion} termsRevision={termsRevision} replacePreparedQuoteId={renewPrepared ? view.status?.quoteId : undefined} termsHref="/legal/academy/first-publication-trial/2026-09-08-v1" billingHref="/legal/academy/billing/2026-09-04-v1" onPrepared={async () => { await load(); }} />
    {renewPrepared && <button type="button" className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 text-sm" onClick={() => setRenewPrepared(false)}>契約状態の表示に戻る</button>}
  </div>;
  const cancelAllowed = cancellation.canStart && view.access.phase !== "paid" && view.access.phase !== "expired" && view.status.firstPublishedAt !== null && view.status.cancellationAcceptedAt === null && view.access.cancellationAcceptedAt === null;
  return <div className="space-y-3">{cancellationNotice}<AcademyFirstPublicationPanel identityKey={userId} state={view.status} access={view.access} allowedActions={cancelAllowed ? ["cancel_conversion"] : []} onRefresh={async () => { await cancellation.refresh(); await load(); }} onAction={async action => {
    if (inFlight.current || action !== "cancel_conversion" || !cancelAllowed) throw new Error("unsupported_billing_action");
    inFlight.current = true;
    try {
      await assertActor();
      await cancellation.start();
      await assertActor();
      await load();
    } finally { inFlight.current = false; }
  }} />{view.access.phase === "paid" ? <AcademyPlatformBillingLoader userId={userId} resourceId={headquartersId} isGuest={isGuest} auth={supabase.auth} fetch={globalThis.fetch} managementOnly checkoutPlanKey={null} /> : null}{view.status.phase === "prepared" && view.status.firstPublishedAt === null && view.access.phase === "prepared" && <button type="button" className="min-h-11 rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm" onClick={() => setRenewPrepared(true)}>料金と支払方法を確認し直す</button>}</div>;
}
