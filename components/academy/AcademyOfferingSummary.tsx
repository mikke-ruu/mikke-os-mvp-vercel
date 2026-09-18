"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { getAcademyRouteContext, listMyAcademyContexts, toAcademyContextHref } from "@/lib/academy/access-context";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { supabase } from "@/lib/supabase/client";
type Summary = { total: number; pending: number; paid: number; amount: number; headquartersId: string };
export function AcademyOfferingSummary() {
  const { profile } = useAuth();
  const academyId = getAcademyRouteContext()?.academyId;
  return <SummaryContent key={`${profile.user_id}:${academyId ?? ""}`} userId={profile.user_id} academyId={academyId} />;
}
function SummaryContent({ userId, academyId }: { userId: string; academyId?: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setSummary(null); setAllowed(false);
    async function load() {
      try {
        const hq = await getOwnedHeadquarters(userId, academyId);
        if (!hq) return;
        const contexts = await listMyAcademyContexts();
        if (!contexts.some(context => context.academy_id === hq.id && context.capabilities.includes("academy:headquarters:manage"))) return;
        if (cancelled) return;
        setAllowed(true);
        const result: Summary = { total: 0, pending: 0, paid: 0, amount: 0, headquartersId: hq.id };
        for (let offset = 0; ; offset += 500) {
          const { data, error: readError } = await supabase.from("academy_offering_applications").select("id,status,price").eq("headquarters_id", hq.id).order("id").range(offset, offset + 499);
          if (readError) throw readError;
          if (cancelled) return;
          for (const row of data ?? []) {
            const price = Number(row.price);
            if (!Number.isFinite(price) || price < 0 || !["pending", "paid"].includes(row.status)) throw new Error("Invalid summary");
            result.total += 1;
            if (row.status === "pending") result.pending += 1;
            else { result.paid += 1; result.amount += price; }
          }
          if ((data ?? []).length < 500) break;
        }
        setSummary(result);
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [userId, academyId, retry]);
  if (!loading && !allowed && !error) return null;
  return <section className="border-y border-[var(--mikke-line)] bg-white py-4" aria-label="募集ページの申込状況">
    <h2 className="text-base font-bold">募集ページの申込状況</h2>
    {loading ? <p role="status" className="mt-2 text-sm">集計中…</p> : error ? <div role="alert" className="mt-2 text-sm"><p>申込状況を取得できませんでした。件数・金額は未確認です。</p><button type="button" className="min-h-11 font-bold text-[var(--mikke-primary)]" onClick={() => setRetry(value => value + 1)}>再読み込み</button></div> : summary ? <>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm"><p>申込件数<strong className="mt-1 block text-xl">{summary.total}件</strong></p><p>入金確認待ち<strong className="mt-1 block text-xl">{summary.pending}件</strong></p><p>入金確認済み<strong className="mt-1 block text-xl">{summary.paid}件</strong></p></div>
      <p className="mt-3 text-sm">入金済みの記録額 <strong>{summary.amount.toLocaleString("ja-JP")}円</strong></p>
      <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">新しい募集ページの全期間の記録です。講師の募集ページも含み、段階購入は講座ごとに1件と数えます。従来の申込・教材注文とは別集計で、決済会社の残高ではありません。</p>
      <div className="mt-2 flex flex-wrap gap-x-6"><Link className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--mikke-primary)]" href={toAcademyContextHref("/academy/offerings", summary.headquartersId, "manage")}>募集をつくる・編集する →</Link><Link className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--mikke-primary)]" href={toAcademyContextHref("/academy/offering-applications", summary.headquartersId, "manage")}>申込・入金を確認する →</Link></div>
    </> : null}
  </section>;
}
