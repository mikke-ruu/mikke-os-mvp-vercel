"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JournalArticleRenderer } from "@/components/journal/JournalArticleRenderer";
import { getHqJournalArticle, type JournalArticle } from "@/lib/hq-articles";

export default function HqArticlePreviewPage() {
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<JournalArticle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getHqJournalArticle(params.id).then(setArticle).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "記事を読み込めませんでした。")).finally(() => setLoaded(true)); }, [params.id]);
  if (!loaded) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">プレビューを読み込んでいます…</p>;
  if (!article) return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || "記事が見つかりません。"}</p>;
  return <div className="mx-auto max-w-5xl space-y-5"><Link href={`/hq/articles/${article.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"><ArrowLeft size={14} />編集へ戻る</Link><section className="rounded-3xl border border-[var(--mikke-line)] bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-12"><JournalArticleRenderer article={article} preview /></section></div>;
}
