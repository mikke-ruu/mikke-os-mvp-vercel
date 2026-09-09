"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { createFirstPublicationAccessRpc, type FirstPublicationAccess } from "@/lib/academy/first-publication/access-client";
import { firstPublicationDate } from "@/lib/academy/first-publication-view";

export function AcademySchemeUsageStatus({ headquartersId, userId, href, legacy }: {
  headquartersId: string; userId: string; href: string; legacy: React.ReactNode;
}) {
  return <Scheme key={`${userId}:${headquartersId}`} headquartersId={headquartersId} userId={userId} href={href} legacy={legacy} />;
}

function Scheme({ headquartersId, userId, href, legacy }: {
  headquartersId: string; userId: string; href: string; legacy: React.ReactNode;
}) {
  const [state, setState] = useState<{ kind: "loading" | "error" } | {kind: "loaded"; access: FirstPublicationAccess | null}>({kind:"loading"});
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let current = 0;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const generation = ++current;
      setState({kind:"loading"});
      if (!session || session.user.id !== userId) { setState({kind:"error"}); return; }
      // Run outside the auth callback to avoid blocking the auth client's session lock.
      queueMicrotask(() => {
        if (generation !== current) return;
        createFirstPublicationAccessRpc(supabase)(headquartersId).then(access => {
          if (generation === current) setState({kind:"loaded",access});
        }).catch(() => { if (generation === current) setState({kind:"error"}); });
      });
    });
    return () => { current++; data.subscription.unsubscribe(); };
  }, [headquartersId, userId, revision]);
  if (state.kind !== "loaded") return <section className="mb-2 flex flex-wrap items-center gap-2 border-b border-[var(--mikke-line)] pb-2 text-xs" aria-label="Academyの利用状態"><p role="status">{state.kind === "loading" ? "利用契約を確認しています…" : "利用契約を確認できませんでした。未契約という意味ではありません。"}</p>{state.kind === "error" ? <button type="button" className="min-h-11 px-2 text-[var(--mikke-primary)]" onClick={()=>setRevision(value=>value+1)}>再確認</button> : null}</section>;
  if (state.access === null) return legacy;
  const access = state.access;
  const periodEnded = now !== null && access.endsAt !== null && now >= Date.parse(access.endsAt);
  const labels: Record<FirstPublicationAccess["phase"], string> = {
    prepared: "公開準備中", sync_pending: "契約情報を確認中", trialing: "7日間無料体験中",
    cancelled: "有料移行取消済み", attention: "お支払い状況を確認してください", paid: "有料利用中", expired: "利用期間が終了しました",
  };
  return <section aria-label="Academyの利用状態" className="mb-2 border-b border-[var(--mikke-line)] pb-2 text-xs">
    <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1"><span className="rounded-md border border-[var(--mikke-green)] px-2 py-1 font-bold">{periodEnded && access.phase !== "expired" ? "利用期間後の状態を再確認" : labels[access.phase]}</span>{access.endsAt ? <span>{firstPublicationDate(access.endsAt)}まで</span> : null}<Link href={href} className="ml-auto inline-flex min-h-11 items-center text-[var(--mikke-primary)]">利用状態・料金を確認 →</Link></div>
    {periodEnded ? <button type="button" className="min-h-11 text-[var(--mikke-primary)]" onClick={() => setRevision(value => value + 1)}>最新の利用状態を確認</button> : null}
    <details><summary className="w-fit cursor-pointer py-1 text-[var(--mikke-muted)]">利用期間について</summary><p className="mt-1 leading-5">{access.phase === "prepared" ? "無料期間は初めての講座公開が成功した時点から始まります。" : access.cancellationAcceptedAt ? "有料移行の取消を受け付けています。現在の利用は元の無料終了日時まで続き、新しいCommunity招待はできません。" : access.phase === "paid" ? "支払いが確認された有料期間です。解約と講座の非公開は別の手続きです。" : "初公開から168時間が無料期間です。期限後は確認済みの契約条件で有料利用へ移行します。下書きに戻しても契約は終了しません。"}</p></details>
  </section>;
}
