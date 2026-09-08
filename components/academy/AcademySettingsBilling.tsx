"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { createFirstPublicationAccessRpc, type FirstPublicationAccess } from "@/lib/academy/first-publication/access-client";
import { createFirstPublicationRpc, type FirstPublicationStatus } from "@/lib/academy/first-publication/rpc-client";
import { AcademyFirstPublicationEnrollment } from "./AcademyFirstPublicationEnrollment";
import { AcademyFirstPublicationPanel } from "./AcademyFirstPublicationPanel";

type Props = { userId: string; headquartersId: string; sample: boolean; legacy: ReactNode };
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
  return <BillingWorkspace key={`${props.userId}:${session.token}:${props.headquartersId}`} {...props} />;
}

function BillingWorkspace({ userId, headquartersId, legacy }: Props) {
  const [view, setView] = useState<ReadState>({ kind: "loading" });
  const alive = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const assertActor = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (!alive.current || error || data.session?.user.id !== userId) throw new Error("billing_identity_changed");
  }, [userId]);
  const load = useCallback(async () => {
    const request = ++generation.current;
    if (alive.current) setView({ kind: "loading" });
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
      if (request === generation.current) setView({ kind: "new", access, status });
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
  if (view.kind === "loading") return <p role="status" className="rounded-lg border border-[var(--mikke-line)] p-4 text-sm">利用契約を確認しています…</p>;
  if (view.kind === "error") return <section className="space-y-3 rounded-lg border border-[var(--mikke-line)] bg-white p-4"><h2 className="font-bold">Academyの利用契約</h2><p role="alert" className="text-sm leading-7">契約状態を取得できませんでした。未契約という意味ではありません。確認できるまで申し込みや取消は行えません。</p><button type="button" className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 text-sm" onClick={() => void load().catch(() => undefined)}>契約状態を再確認</button></section>;
  if (view.kind === "legacy") return legacy;
  if (view.status === null) return <AcademyFirstPublicationEnrollment userId={userId} headquartersId={headquartersId} policyVersion={policyVersion} termsRevision={termsRevision} termsHref="/legal/academy/first-publication-trial/2026-09-08-v1" billingHref="/legal/academy/billing/2026-09-04-v1" onPrepared={async () => { await load(); }} />;
  const cancelAllowed = view.access.phase !== "paid" && view.access.phase !== "expired" && view.status.firstPublishedAt !== null && view.status.cancellationAcceptedAt === null && view.access.cancellationAcceptedAt === null;
  return <AcademyFirstPublicationPanel identityKey={userId} state={view.status} access={view.access} allowedActions={cancelAllowed ? ["cancel_conversion"] : []} onRefresh={load} onAction={async action => {
    if (inFlight.current || action !== "cancel_conversion" || !cancelAllowed) throw new Error("unsupported_billing_action");
    inFlight.current = true;
    try {
      await assertActor();
      await createFirstPublicationRpc(supabase)(headquartersId, { action: "cancel_conversion" });
      await assertActor();
      await load();
    } finally { inFlight.current = false; }
  }} />;
}
