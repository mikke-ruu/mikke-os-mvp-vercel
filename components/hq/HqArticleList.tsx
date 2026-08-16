"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, EyeOff, FolderCog, Pencil, Plus, Star } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { getHqStaffMembership } from "@/lib/hq";
import { listHqJournalArticles, updateJournalArticle, type JournalArticle, type JournalArticleInput } from "@/lib/hq-articles";

function articleInput(article: JournalArticle, status: JournalArticle["status"]): JournalArticleInput {
  return {
    category_id: article.category_id, slug: article.slug, title: article.title, excerpt: article.excerpt,
    cover_image_url: article.cover_image_url, cover_image_asset_id: article.cover_image_asset_id,
    blocks: article.blocks, is_featured: article.is_featured, cta_label: article.cta_label, cta_url: article.cta_url, status
  };
}

export function HqArticleList() {
  const { user } = useAuth();
  const [items, setItems] = useState<JournalArticle[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const [membership, articles] = await Promise.all([getHqStaffMembership(user.id), listHqJournalArticles()]);
      setCanWrite(Boolean(membership && ["owner", "admin", "editor"].includes(membership.role)));
      setItems(articles);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "記事を読み込めませんでした。"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [user.id]);

  async function togglePublished(article: JournalArticle) {
    if (!canWrite) return;
    setSaving(article.id); setError("");
    try { await updateJournalArticle(article.id, articleInput(article, article.status === "published" ? "draft" : "published"), article.published_at); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "公開状態を変更できませんでした。"); }
    finally { setSaving(""); }
  }

  return <div className="mx-auto max-w-6xl space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black tracking-[0.15em] text-[var(--mikke-primary)]">JOURNAL</p><h1 className="mt-2 text-2xl font-black">記事管理</h1><p className="mt-2 text-sm text-[var(--mikke-muted)]">mikkeOSのアップデート、お知らせ、開発ストーリーを本部から発信します。</p></div><div className="flex flex-wrap gap-2"><Link href="/hq/articles/categories" className="inline-flex items-center gap-2 rounded-xl border border-[var(--mikke-primary)] bg-white px-4 py-3 text-sm font-bold text-[var(--mikke-primary)]"><FolderCog size={16} />カテゴリー管理</Link>{canWrite ? <Link href="/hq/articles/new" className="inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white"><Plus size={16} />記事を書く</Link> : null}</div></header>
    {!canWrite && !loading ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">分析担当は記事を閲覧できます。編集・公開は本部オーナー、管理者、編集者に限定されています。</p> : null}
    {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
    {loading ? <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">記事を読み込んでいます…</p> : items.length === 0 ? <section className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white px-5 py-14 text-center"><p className="font-bold">記事はまだありません</p><p className="mt-2 text-sm text-[var(--mikke-muted)]">最初の記事を下書きして、プレビューから見え方を確認できます。</p></section> : <div className="grid gap-4 md:grid-cols-2">{items.map((article) => <article key={article.id} className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white shadow-sm">{article.cover_image_url ? <img src={article.cover_image_url} alt="" className="h-44 w-full object-cover" /> : <div className="grid h-32 place-items-center bg-[var(--mikke-primary-soft)] text-xs font-black tracking-[0.15em] text-[var(--mikke-primary)]">mikkeOS JOURNAL</div>}<div className="p-4"><div className="flex flex-wrap items-center gap-2 text-[11px] font-bold"><span className={`rounded-full px-2 py-1 ${article.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{article.status === "published" ? "公開中" : article.status === "draft" ? "下書き" : "アーカイブ"}</span>{article.category ? <span className="rounded-full px-2 py-1 text-white" style={{ backgroundColor: article.category.color }}>{article.category.name}</span> : null}{article.is_featured ? <span className="inline-flex items-center gap-1 text-amber-600"><Star size={12} fill="currentColor" />注目</span> : null}</div><h2 className="mt-3 text-lg font-black">{article.title}</h2>{article.excerpt ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--mikke-muted)]">{article.excerpt}</p> : null}<p className="mt-3 text-[11px] text-[var(--mikke-muted)]">最終更新 {new Date(article.updated_at).toLocaleString("ja-JP")}</p><div className="mt-4 flex flex-wrap gap-2"><Link href={`/hq/articles/${article.id}/preview`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><Eye size={14} />プレビュー</Link><Link href={`/hq/articles/${article.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><Pencil size={14} />{canWrite ? "編集" : "閲覧"}</Link>{canWrite ? <button type="button" disabled={saving === article.id} onClick={() => void togglePublished(article)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-40">{article.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}{article.status === "published" ? "下書きに戻す" : "公開する"}</button> : null}</div></div></article>)}</div>}
  </div>;
}
