"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listPublicOfferings, type PublicOfferingScope, type PublicOfferingSummary } from "@/lib/academy/public-offerings";

export function AcademyPublicServices({ headquartersId, instructorId, courseId }: PublicOfferingScope) {
  const scopeKey = `${headquartersId}:${instructorId ?? ""}:${courseId ?? ""}`;
  const [result, setResult] = useState<{ key: string; items: PublicOfferingSummary[]; error: boolean } | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void listPublicOfferings({ headquartersId, instructorId, courseId }).then(items => {
      if (!cancelled) setResult({ key: scopeKey, items, error: false });
    }).catch(() => {
      if (!cancelled) setResult({ key: scopeKey, items: [], error: true });
    });
    return () => { cancelled = true; };
  }, [headquartersId, instructorId, courseId, scopeKey, refresh]);
  useEffect(() => {
    const reload = () => setRefresh(value => value + 1);
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);
  return <section id="services" className="my-8 min-w-0 space-y-4" aria-label="申込できるサービス">
    <h2 className="text-xl font-bold">申込できるサービス</h2>
    {!result || result.key !== scopeKey ? <p role="status">サービスを読み込んでいます…</p>
      : result.error ? <div role="alert"><p>サービスを読み込めませんでした。</p><button type="button" className="min-h-11 underline" onClick={() => setRefresh(value => value + 1)}>再読み込み</button></div>
      : !result.items.length ? <p>現在、申込できるサービスはありません。</p>
      : <ul className="grid min-w-0 gap-4 md:grid-cols-2">
        {result.items.map(item => <li key={item.id} className="min-w-0 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5">
          <p className="text-sm text-[var(--mikke-muted)]">{item.kind}</p>
          <h3 className="break-words text-lg font-bold">{item.title}</h3>
          <p className="my-3">{item.purchase_mode === "staged" ? "講座ごとにお支払い（価格は詳細で確認）" : `${item.price.toLocaleString("ja-JP")}円`}</p>
          <Link className="inline-flex min-h-11 items-center font-bold text-[var(--mikke-primary)] underline" href={`/academy/${instructorId ? "oi" : "o"}/${item.id}`}>{item.title}の詳細・申込 →</Link>
        </li>)}
      </ul>}
  </section>;
}
