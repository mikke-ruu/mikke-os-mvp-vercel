"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Heading2, ImageIcon, Link2, List, Minus, Plus, Quote, Save, Send, Trash2, Type } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { MikkeMediaPicker } from "@/components/media/MikkeMediaPicker";
import { JournalArticleRenderer } from "@/components/journal/JournalArticleRenderer";
import { syncMikkeMediaUsages } from "@/lib/media/client";
import { getHqStaffMembership } from "@/lib/hq";
import {
  createJournalArticle,
  createJournalBlock,
  getHqJournalArticle,
  isSafeJournalUrl,
  listJournalCategories,
  normalizeJournalSlug,
  updateJournalArticle,
  type JournalArticle,
  type JournalArticleInput,
  type JournalArticleStatus,
  type JournalBlock,
  type JournalBlockType,
  type JournalCategory
} from "@/lib/hq-articles";

const blockChoices: { type: JournalBlockType; label: string; icon: typeof Type }[] = [
  { type: "paragraph", label: "文章", icon: Type },
  { type: "heading", label: "見出し", icon: Heading2 },
  { type: "image", label: "画像", icon: ImageIcon },
  { type: "quote", label: "引用", icon: Quote },
  { type: "list", label: "箇条書き", icon: List },
  { type: "divider", label: "区切り", icon: Minus },
  { type: "link-card", label: "リンクカード", icon: Link2 },
  { type: "cta", label: "CTA", icon: Send }
];

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm font-normal text-[var(--mikke-text)]";

function blockLabel(type: JournalBlockType) {
  return blockChoices.find((choice) => choice.type === type)?.label ?? type;
}
function BlockFields({ block, onChange }: { block: JournalBlock; onChange: (next: JournalBlock) => void }) {
  if (block.type === "divider") return <p className="rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-5 text-center text-xs text-[var(--mikke-muted)]">記事に区切り線を表示します。</p>;
  if (block.type === "image") return <div className="space-y-3"><MikkeMediaPicker currentUrl={block.imageUrl} sourceApp="hq-journal" compact onSelect={(asset) => onChange({ ...block, imageUrl: asset.publicUrl, imageAssetId: asset.id, alt: block.alt || asset.originalName })} /><label className="block text-xs font-bold">代替テキスト<input value={block.alt ?? ""} onChange={(event) => onChange({ ...block, alt: event.target.value })} className={inputClass} /></label><label className="block text-xs font-bold">キャプション<input value={block.caption ?? ""} onChange={(event) => onChange({ ...block, caption: event.target.value })} className={inputClass} /></label></div>;
  if (block.type === "heading") return <div className="grid gap-3 sm:grid-cols-[120px_1fr]"><label className="text-xs font-bold">大きさ<select value={block.level ?? 2} onChange={(event) => onChange({ ...block, level: Number(event.target.value) as 2 | 3 })} className={inputClass}><option value={2}>見出し2</option><option value={3}>見出し3</option></select></label><label className="text-xs font-bold">見出し<input value={block.text ?? ""} onChange={(event) => onChange({ ...block, text: event.target.value })} className={inputClass} /></label></div>;
  if (block.type === "quote") return <div className="space-y-3"><label className="block text-xs font-bold">引用文<textarea value={block.text ?? ""} rows={4} onChange={(event) => onChange({ ...block, text: event.target.value })} className={inputClass} /></label><label className="block text-xs font-bold">引用元<input value={block.attribution ?? ""} onChange={(event) => onChange({ ...block, attribution: event.target.value })} className={inputClass} /></label></div>;
  if (block.type === "list") return <label className="block text-xs font-bold">項目（1行に1つ）<textarea value={(block.items ?? []).join("\n")} rows={5} onChange={(event) => onChange({ ...block, items: event.target.value.split("\n") })} className={inputClass} /></label>;
  if (block.type === "link-card") return <div className="space-y-3"><label className="block text-xs font-bold">タイトル<input value={block.title ?? ""} onChange={(event) => onChange({ ...block, title: event.target.value })} className={inputClass} /></label><label className="block text-xs font-bold">説明<textarea value={block.description ?? ""} rows={2} onChange={(event) => onChange({ ...block, description: event.target.value })} className={inputClass} /></label><label className="block text-xs font-bold">リンク先<input value={block.url ?? ""} placeholder="https://... または /fund/..." onChange={(event) => onChange({ ...block, url: event.target.value })} className={inputClass} /></label></div>;
  if (block.type === "cta") return <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">ボタン名<input value={block.label ?? ""} onChange={(event) => onChange({ ...block, label: event.target.value })} className={inputClass} /></label><label className="text-xs font-bold">リンク先<input value={block.url ?? ""} placeholder="https://... または /fund/..." onChange={(event) => onChange({ ...block, url: event.target.value })} className={inputClass} /></label></div>;
  return <label className="block text-xs font-bold">文章<textarea value={block.text ?? ""} rows={5} onChange={(event) => onChange({ ...block, text: event.target.value })} className={inputClass} /></label>;
}

export function HqArticleEditor({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [article, setArticle] = useState<JournalArticle | null>(null);
  const [categories, setCategories] = useState<JournalCategory[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAssetId, setCoverImageAssetId] = useState<string | null>(null);
  const [featured, setFeatured] = useState(false);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [blocks, setBlocks] = useState<JournalBlock[]>([createJournalBlock("paragraph")]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getHqStaffMembership(user.id), listJournalCategories(), articleId ? getHqJournalArticle(articleId) : Promise.resolve(null)])
      .then(([membership, nextCategories, nextArticle]) => {
        if (cancelled) return;
        setCanWrite(Boolean(membership && ["owner", "admin", "editor"].includes(membership.role)));
        setCategories(nextCategories);
        if (nextArticle) {
          setArticle(nextArticle); setTitle(nextArticle.title); setSlug(nextArticle.slug); setExcerpt(nextArticle.excerpt);
          setCategoryId(nextArticle.category_id ?? ""); setCoverImageUrl(nextArticle.cover_image_url); setCoverImageAssetId(nextArticle.cover_image_asset_id);
          setFeatured(nextArticle.is_featured); setCtaLabel(nextArticle.cta_label); setCtaUrl(nextArticle.cta_url);
          setBlocks(nextArticle.blocks.length ? nextArticle.blocks : [createJournalBlock("paragraph")]);
        }
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "記事を読み込めませんでした。"))
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [articleId, user.id]);

  const assetIds = useMemo(() => [coverImageAssetId, ...blocks.map((block) => block.imageAssetId)].filter((id): id is string => Boolean(id)), [blocks, coverImageAssetId]);

  function changeBlock(id: string, next: JournalBlock) { setBlocks((current) => current.map((block) => block.id === id ? next : block)); }
  function moveBlock(index: number, direction: -1 | 1) { setBlocks((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  function duplicateBlock(index: number) { setBlocks((current) => { const next = { ...current[index], id: `journal_block_${crypto.randomUUID()}` }; return [...current.slice(0, index + 1), next, ...current.slice(index + 1)]; }); }

  async function save(status: JournalArticleStatus) {
    if (!canWrite) return;
    setError(""); setMessage("");
    const nextSlug = normalizeJournalSlug(slug) || `article-${Date.now()}`;
    const blockUrls = blocks.filter((block) => ["link-card", "cta"].includes(block.type)).map((block) => block.url ?? "");
    if (!title.trim()) { setError("タイトルを入力してください。"); return; }
    if (!isSafeJournalUrl(ctaUrl) || blockUrls.some((url) => !isSafeJournalUrl(url))) { setError("リンク先は https://、http://、または / から始まるmikkeOS内URLにしてください。"); return; }
    const input: JournalArticleInput = {
      category_id: categoryId || null, slug: nextSlug, title: title.trim(), excerpt: excerpt.trim(),
      cover_image_url: coverImageUrl, cover_image_asset_id: coverImageAssetId, blocks, is_featured: featured,
      cta_label: ctaLabel.trim(), cta_url: ctaUrl.trim(), status
    };
    setSaving(true);
    try {
      const saved = article ? await updateJournalArticle(article.id, input, article.published_at) : await createJournalArticle(input);
      await syncMikkeMediaUsages({ appKey: "mikkeos", entityType: "hq_article", entityId: saved.id, assetIds });
      setArticle(saved); setSlug(saved.slug); setMessage(status === "published" ? "記事を公開状態で保存しました。" : "下書きを保存しました。");
      if (!articleId) router.replace(`/hq/articles/${saved.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "記事を保存できませんでした。");
    } finally { setSaving(false); }
  }

  if (!loaded) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">記事エディタを読み込んでいます…</p>;
  if (articleId && !article) return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || "記事が見つかりません。"}</p>;
  if (!canWrite && !article) return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">記事の新規作成は、本部オーナー・管理者・編集者に限定されています。</p>;
  if (!canWrite && article) return <div className="mx-auto max-w-5xl space-y-5"><Link href="/hq/articles" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"><ArrowLeft size={14} />記事一覧</Link><p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">分析担当は閲覧のみです。</p><section className="rounded-3xl border border-[var(--mikke-line)] bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-12"><JournalArticleRenderer article={article} preview={article.status !== "published"} /></section></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/hq/articles" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"><ArrowLeft size={14} />記事一覧</Link><h1 className="mt-2 text-2xl font-black">{article ? "記事を編集" : "新しい記事"}</h1><p className="mt-1 text-sm text-[var(--mikke-muted)]">ブロックを上から組み立てて、noteのように記事を作ります。</p></div><div className="flex flex-wrap gap-2">{article ? <Link href={`/hq/articles/${article.id}/preview`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-[var(--mikke-primary)]"><Eye size={15} />プレビュー</Link> : null}<button type="button" disabled={!canWrite || saving} onClick={() => void save("draft")} className="inline-flex items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-40"><Save size={15} />下書き保存</button><button type="button" disabled={!canWrite || saving} onClick={() => void save("published")} className="inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Send size={15} />公開状態で保存</button></div></header>
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}{message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p> : null}

      <section className="grid gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:grid-cols-2 md:p-5">
        <label className="text-sm font-bold md:col-span-2">タイトル<input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></label>
        <label className="text-sm font-bold">URL名<input value={slug} placeholder="例: why-we-built-mikkeos" onChange={(event) => setSlug(event.target.value)} onBlur={() => setSlug(normalizeJournalSlug(slug))} className={inputClass} /><span className="mt-1 block text-[10px] font-normal text-[var(--mikke-muted)]">英小文字・数字・ハイフン。空欄なら自動発行します。</span></label>
        <label className="text-sm font-bold">カテゴリー<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}><option value="">カテゴリーなし</option>{categories.filter((category) => category.is_active || category.id === categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}{category.is_active ? "" : "（非表示）"}</option>)}</select></label>
        <label className="text-sm font-bold md:col-span-2">概要<textarea value={excerpt} maxLength={500} rows={3} onChange={(event) => setExcerpt(event.target.value)} className={inputClass} /></label>
        <div className="md:col-span-2"><p className="text-sm font-bold">カバー画像</p><div className="mt-1.5"><MikkeMediaPicker currentUrl={coverImageUrl} sourceApp="hq-journal-cover" onSelect={(asset) => { setCoverImageUrl(asset.publicUrl); setCoverImageAssetId(asset.id); }} /></div></div>
        <label className="inline-flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />注目記事として先頭に表示</label>
        <div />
        <label className="text-sm font-bold">記事末尾CTA名<input value={ctaLabel} placeholder="FUNDで応援する" maxLength={80} onChange={(event) => setCtaLabel(event.target.value)} className={inputClass} /></label>
        <label className="text-sm font-bold">記事末尾CTA URL<input value={ctaUrl} placeholder="https://... または /fund/..." onChange={(event) => setCtaUrl(event.target.value)} className={inputClass} /></label>
      </section>

      <section className="space-y-3"><div><h2 className="text-lg font-black">本文</h2><p className="text-xs text-[var(--mikke-muted)]">画像・引用・リンクなどを好きな順番で追加できます。</p></div>{blocks.map((block, index) => <article key={block.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><header className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black text-[var(--mikke-primary)]">{index + 1}. {blockLabel(block.type)}</span><div className="flex gap-1"><button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30" aria-label="上へ"><ArrowUp size={14} /></button><button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30" aria-label="下へ"><ArrowDown size={14} /></button><button type="button" onClick={() => duplicateBlock(index)} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)]" aria-label="複製"><Copy size={14} /></button><button type="button" onClick={() => setBlocks((current) => current.filter((item) => item.id !== block.id))} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-600" aria-label="削除"><Trash2 size={14} /></button></div></header><BlockFields block={block} onChange={(next) => changeBlock(block.id, next)} /></article>)}</section>

      <section className="rounded-2xl border border-dashed border-[var(--mikke-primary-border)] bg-[var(--mikke-primary-soft)] p-4"><p className="mb-3 text-xs font-black text-[var(--mikke-primary)]">ブロックを追加</p><div className="flex flex-wrap gap-2">{blockChoices.map(({ type, label, icon: Icon }) => <button key={type} type="button" onClick={() => setBlocks((current) => [...current, createJournalBlock(type)])} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text)] shadow-sm"><Icon size={14} /><Plus size={11} />{label}</button>)}</div></section>
    </div>
  );
}
