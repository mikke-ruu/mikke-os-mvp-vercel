"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { listOfferings, offeringError, type AcademyOffering } from "@/lib/academy/offerings";
import { offeringUsage } from "@/lib/academy/instructor-offerings";

function Content() {
  const { profile } = useAuth();
  const [offerings, setOfferings] = useState<AcademyOffering[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasHeadquarters, setHasHeadquarters] = useState(false);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setOfferings([]); setHasHeadquarters(false);
    (async () => {
      const hq = await getOwnedHeadquarters(profile.user_id);
      if (!active) return;
      if (!hq) { setHasHeadquarters(false); return; }
      setHasHeadquarters(true);
      const [found, counts] = await Promise.all([listOfferings(hq.id), offeringUsage(hq.id)]);
      if (active) { setOfferings(found); setUsage(counts); }
    })().catch(cause => { if (active) setError(offeringError(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.user_id, retry]);
  if (loading) return <p className="py-8 text-sm">募集を読み込み中…</p>;
  if (error) return <div role="alert" className="space-y-3"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-lg border px-4">再読み込み</button></div>;
  if (!hasHeadquarters) return <p>管理する本部が見つかりません。</p>;
  const visible = offerings.filter(offering => offering.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (filter === "active" ? offering.status !== "archived" : offering.status === filter));
  return <div className="space-y-4"><header className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">募集一覧</h2><Link href={toCurrentAcademyContextHref("/academy/offerings/new")} className="min-h-11 rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white">募集をつくる</Link></header><div className="flex flex-wrap gap-2"><input aria-label="募集を検索" value={query} onChange={event => setQuery(event.target.value)} placeholder="募集名で検索" className="min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-base" /><select aria-label="公開状態で絞り込む" value={filter} onChange={event => setFilter(event.target.value)} className="min-h-11 rounded-lg border bg-white px-3 text-base"><option value="active">公開中・下書き</option><option value="published">公開中</option><option value="draft">下書き</option><option value="archived">アーカイブ</option></select></div>{visible.length ? <div className="divide-y divide-[var(--mikke-line)]">{visible.map(offering => <article key={offering.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="text-xs text-[var(--mikke-muted)]">{usage[offering.id] ? `講師${usage[offering.id]}名が利用中 · ` : ""}{offering.kind} · {{ draft: "下書き", published: "公開中", archived: "受付終了" }[offering.status]}</p><h3 className="break-words text-base font-bold">{offering.title}</h3><p className="mt-1 text-sm">{offering.course_ids.length}講座 · ¥{Number(offering.price).toLocaleString("ja-JP")}</p></div><Link className="min-h-11 rounded-lg border px-4 py-3 text-sm font-bold" href={toCurrentAcademyContextHref(`/academy/offerings/${offering.id}`)}>編集する</Link></article>)}</div> : <p className="py-8 text-sm">{offerings.length ? "条件に合う募集がありません。" : "講座を選び、募集の価格とページをつくりましょう。"}</p>}</div>;
}
export default function Page() { return <HonbuShell title="募集"><Content /></HonbuShell>; }
