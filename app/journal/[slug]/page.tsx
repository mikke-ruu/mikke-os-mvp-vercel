"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JournalArticleRenderer } from "@/components/journal/JournalArticleRenderer";
import { getPublishedJournalArticle, type JournalArticle } from "@/lib/hq-articles";

export default function JournalArticlePage() {
  const params = useParams<{ slug: string }>();
  const [article, setArticle] = useState<JournalArticle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getPublishedJournalArticle(params.slug).then(setArticle).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "記事を読み込めませんでした。")).finally(() => setLoaded(true)); }, [params.slug]);
  return <main className="min-h-screen bg-[#f7f5ef]"><header className="border-b border-[var(--mikke-line)] bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4"><Link href="/journal" className="inline-flex items-center gap-1 text-xs font-black text-[var(--mikke-primary)]"><ArrowLeft size={14} />JOURNAL</Link><Link href="/home" className="font-black text-[var(--mikke-primary)]">mikkeOS</Link></div></header><div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">{!loaded ? <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">記事を読み込んでいます…</p> : article ? <JournalArticleRenderer article={article} /> : <section className="rounded-3xl border border-[var(--mikke-line)] bg-white p-8 text-center"><h1 className="text-xl font-black">記事が見つかりません</h1><p className="mt-3 text-sm text-[var(--mikke-muted)]">{error || "この記事は公開されていないか、URLが変更されています。"}</p><Link href="/journal" className="mt-6 inline-flex rounded-xl bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white">記事一覧へ戻る</Link></section>}</div></main>;
}
