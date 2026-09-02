"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, PenLine } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { getOwnedMedia, listMediaArticles } from "@/lib/media-app/store";
import type { MediaArticle, MediaSite } from "@/lib/media-app/types";

export function MediaArticleList() {
  const { profile } = useAuth();
  const [site, setSite] = useState<MediaSite | null>(null);
  const [items, setItems] = useState<MediaArticle[]>([]);
  useEffect(() => { const next = getOwnedMedia(profile.id); setSite(next); setItems(next ? listMediaArticles(next.id) : []); }, [profile.id]);
  if (!site) return <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] p-8 text-center"><p className="font-bold">先にMediaを作成してください。</p><Link href="/apps/media/new" className="mt-4 inline-flex text-sm font-bold text-[var(--mikke-primary)]">Mediaを作る</Link></div>;
  return <div><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black tracking-[0.14em] text-[var(--mikke-primary)]">ARTICLES</p><h1 className="mt-2 text-3xl font-black">記事</h1><p className="mt-2 text-sm text-[var(--mikke-muted)]">下書き、公開中、取り下げた記事を管理します。</p></div><Link href="/apps/media/write" className="inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white"><PenLine size={16} />記事を書く</Link></header>{items.length === 0 ? <div className="mt-8 grid min-h-64 place-items-center rounded-3xl border border-dashed border-[var(--mikke-line)] bg-white text-center"><div><FileText className="mx-auto text-[var(--mikke-primary)]" /><p className="mt-4 font-bold">記事はまだありません</p><p className="mt-2 text-sm text-[var(--mikke-muted)]">最初のお知らせを書いてみましょう。</p></div></div> : <div className="mt-8 space-y-3">{items.map((article) => <Link key={article.id} href={`/apps/media/write?article=${article.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${article.publishedSnapshot ? "bg-emerald-50 text-emerald-700" : article.status === "unpublished" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>{article.publishedSnapshot ? "公開中" : article.status === "unpublished" ? "非公開" : "下書き"}</span>{article.publishedSnapshot && article.updatedAt > article.publishedSnapshot.updatedAt ? <span className="text-[10px] font-bold text-amber-700">未公開の変更あり</span> : null}</div><h2 className="mt-2 truncate font-bold">{article.title || "無題の記事"}</h2><p className="mt-1 text-xs text-[var(--mikke-muted)]">{new Date(article.updatedAt).toLocaleString("ja-JP")}・/{article.slug}</p></div><ArrowRight size={17} className="shrink-0 text-[var(--mikke-primary)]" /></Link>)}</div>}</div>;
}
