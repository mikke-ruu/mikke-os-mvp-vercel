"use client";

import { MediaLink as Link } from "./MediaNavigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMediaRouter as useRouter } from "./MediaNavigation";
import { ArrowDown, ArrowUp, Copy, Eye, Pencil, Settings2, Heading2, ImageIcon, Link2, List, Minus, Plus, Quote, Send, Trash2, Type } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { MikkeMediaPicker } from "@/components/media/MikkeMediaPicker";
import { addMediaCategory, getMediaExcerpt, createMediaBlock, getMediaArticle, getOwnedMedia, isSafeMediaUrl, normalizeMediaSlug, publishMediaArticle, saveMediaArticle, unpublishMediaArticle } from "@/lib/media-app/store";
import { MediaArticleRenderer } from "./MediaArticleRenderer";
import type { MediaArticle, MediaBlock, MediaBlockType, MediaSite } from "@/lib/media-app/types";

const choices: { type: MediaBlockType; label: string; icon: typeof Type }[] = [{ type: "paragraph", label: "文章", icon: Type }, { type: "heading", label: "見出し", icon: Heading2 }, { type: "image", label: "画像", icon: ImageIcon }, { type: "quote", label: "引用", icon: Quote }, { type: "list", label: "箇条書き", icon: List }, { type: "divider", label: "区切り", icon: Minus }, { type: "link", label: "リンク", icon: Link2 }];
const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm font-normal";

function WritingArea({ value, onChange, label, placeholder, title = false }: { value: string; onChange: (value: string) => void; label: string; placeholder: string; title?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (ref.current) { ref.current.style.height = "0px"; ref.current.style.height = ref.current.scrollHeight + "px"; } }, [value]);
  return <textarea ref={ref} style={{ fontSize: title ? "clamp(1.8rem, 3vw, 2.4rem)" : "1.0625rem", fontWeight: title ? 700 : 400, lineHeight: title ? 1.6 : 2 }} aria-label={label} value={value} placeholder={placeholder} rows={title ? 2 : 3} onChange={(event) => onChange(event.target.value)} className={title ? "w-full resize-none overflow-hidden border-0 bg-transparent py-3 text-3xl font-bold leading-relaxed outline-none placeholder:text-[var(--mikke-muted)] sm:text-4xl" : "min-h-32 w-full resize-none overflow-hidden border-0 bg-transparent py-3 text-base leading-9 outline-none placeholder:text-[var(--mikke-muted)] sm:text-lg"} />;
}

function BlockFields({ block, onChange }: { block: MediaBlock; onChange: (block: MediaBlock) => void }) {
  if (block.type === "divider") return <p className="rounded-xl bg-[var(--mikke-surface-soft)] p-5 text-center text-xs text-[var(--mikke-muted)]">記事に区切り線を表示します。</p>;
  if (block.type === "image") return <div className="space-y-3"><MikkeMediaPicker currentUrl={block.imageUrl} sourceApp="media-article" compact onSelect={(asset) => onChange({ ...block, imageUrl: asset.publicUrl, imageAssetId: asset.id, alt: block.alt || asset.originalName })} /><label className="block text-xs font-bold">画像の説明<input value={block.alt ?? ""} onChange={(event) => onChange({ ...block, alt: event.target.value })} className={inputClass} /></label><label className="block text-xs font-bold">キャプション<input value={block.caption ?? ""} onChange={(event) => onChange({ ...block, caption: event.target.value })} className={inputClass} /></label></div>;
  if (block.type === "heading") return <div className="grid gap-3 sm:grid-cols-[120px_1fr]"><label className="text-xs font-bold">大きさ<select value={block.level ?? 2} onChange={(event) => onChange({ ...block, level: Number(event.target.value) as 2 | 3 })} className={inputClass}><option value={2}>見出し2</option><option value={3}>見出し3</option></select></label><label className="text-xs font-bold">見出し<input value={block.text ?? ""} onChange={(event) => onChange({ ...block, text: event.target.value })} className={inputClass} /></label></div>;
  if (block.type === "quote") return <div className="space-y-3"><label className="block text-xs font-bold">引用文<textarea value={block.text ?? ""} onChange={(event) => onChange({ ...block, text: event.target.value })} rows={4} className={inputClass} /></label><label className="block text-xs font-bold">引用元<input value={block.attribution ?? ""} onChange={(event) => onChange({ ...block, attribution: event.target.value })} className={inputClass} /></label></div>;
  if (block.type === "list") return <label className="block text-xs font-bold">項目（1行に1つ）<textarea value={(block.items ?? []).join("\n")} onChange={(event) => onChange({ ...block, items: event.target.value.split("\n") })} rows={5} className={inputClass} /></label>;
  if (block.type === "link") return <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">表示名<input value={block.title ?? ""} onChange={(event) => onChange({ ...block, title: event.target.value })} className={inputClass} /></label><label className="text-xs font-bold">URL<input value={block.url ?? ""} placeholder="https://..." onChange={(event) => onChange({ ...block, url: event.target.value })} className={inputClass} /></label></div>;
  return <WritingArea label="本文の文章" value={block.text ?? ""} onChange={(text) => onChange({ ...block, text })} placeholder="ここから、あなたの言葉で。" />;
}

export function MediaEditor() {
  const { profile } = useAuth();
  const router = useRouter();
  const requestedId = useSearchParams().get("article");
  const [site, setSite] = useState<MediaSite | null>(null);
  const [article, setArticle] = useState<MediaArticle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAssetId, setCoverImageAssetId] = useState<string | undefined>();
  const [blocks, setBlocks] = useState<MediaBlock[]>([]);
  const [message, setMessage] = useState("タイトルか本文を書くと自動保存します");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<"wide" | "phone">("wide");
  const articleId = useRef<string | null>(null);
  const savedPayload = useRef("");
  const payload = useMemo(() => ({ title: title.trim() || "無題の記事", slug, excerpt, category, coverImageUrl, coverImageAssetId, blocks }), [title, slug, excerpt, category, coverImageUrl, coverImageAssetId, blocks]);
  const serialized = JSON.stringify(payload);
  const hasContent = Boolean(title.trim() || getMediaExcerpt(blocks) || coverImageUrl);

  useEffect(() => {
    const owned = getOwnedMedia(profile.id);
    setSite(owned);
    if (requestedId && requestedId === articleId.current) return;
    const found = requestedId ? getMediaArticle(requestedId) : null;
    const current = found && owned && found.mediaId === owned.id ? found : null;
    articleId.current = current?.id ?? null;
    setArticle(current);
    setMessage(current ? "このブラウザに保存済み" : "タイトルか本文を書くと自動保存します");
    setError("");
    setTitle(current?.title ?? ""); setSlug(current?.slug ?? "");
    setExcerpt(current?.excerpt ?? ""); setCategory(current?.category ?? "");
    setCoverImageUrl(current?.coverImageUrl ?? ""); setCoverImageAssetId(current?.coverImageAssetId);
    setBlocks(current?.blocks.length ? current.blocks : [createMediaBlock("paragraph")]);
    savedPayload.current = "";
    setPreview(false); setLoaded(true);
  }, [profile.id, requestedId]);

  useEffect(() => {
    if (!loaded || !site || !hasContent || serialized === savedPayload.current) return;
    const timer = window.setTimeout(() => {
      try {
        const saved = saveMediaArticle(site.id, articleId.current, payload);
        articleId.current = saved.id; savedPayload.current = serialized;
        setArticle(saved); setMessage("このブラウザに保存済み"); setError("");
        if (!requestedId) router.replace(`/apps/media/write?article=${saved.id}`);
      } catch (cause) { setMessage("未保存の変更があります"); setError(cause instanceof Error ? cause.message : "保存できませんでした。"); }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [loaded, site, hasContent, serialized, payload, requestedId, router]);

  function saveNow() {
    if (!site) return null;
    try {
      if (!hasContent) throw new Error("タイトルか本文を少し書いてみましょう。");
      if (blocks.some((block) => block.type === "link" && !isSafeMediaUrl(block.url ?? ""))) throw new Error("リンクのURLを確認してください。");
      const saved = saveMediaArticle(site.id, articleId.current, payload);
      articleId.current = saved.id; savedPayload.current = serialized;
      setArticle(saved); setMessage("このブラウザに保存済み"); setError("");
      if (!requestedId) router.replace(`/apps/media/write?article=${saved.id}`);
      return saved;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。"); return null; }
  }
  function publish() {
    if (!title.trim()) { setError("公開版にする前にタイトルを付けてください。"); return; }
    const saved = saveNow(); if (!saved) return;
    if (saved.blocks.some((block) => block.type === "image" && block.imageUrl && !block.alt?.trim())) { setError("画像の説明を入力してください。"); return; }
    try { setArticle(publishMediaArticle(saved.id)); setMessage("このブラウザに公開版の見本を保存しました。外部には公開されません。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "公開版を保存できませんでした。"); }
  }
  function addCategory() {
    if (!site) return;
    try { const updated = addMediaCategory(site.id, newCategory); setSite(updated); setCategory(newCategory.trim()); setNewCategory(""); setAddingCategory(false); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "カテゴリーを追加できませんでした。"); }
  }
  function move(index: number, direction: number) {
    setBlocks((items) => { const target = index + direction; if (target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  const count = blocks.reduce((total, block) => total + Array.from(block.text ?? block.items?.join("") ?? "").length, 0);
  if (!loaded) return <p className="py-16 text-center">原稿を開いています…</p>;
  if (!site) return <Link href="/apps/media/new">先にMediaを作成してください</Link>;
  const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm font-semibold";
  return <div className="mx-auto max-w-5xl pb-16">
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mikke-line)] bg-white/95 py-3">
      <div><p className="text-sm font-semibold">{preview ? "読者の目で、読み返す" : "あなたの言葉で、書いてみよう。"}</p><p role="status" className="mt-1 text-xs text-[var(--mikke-muted)]">{message}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => setPreview(!preview)}>{preview ? <Pencil size={15} /> : <Eye size={15} />}{preview ? "執筆に戻る" : "プレビュー"}</button><button type="button" className={buttonClass} onClick={saveNow}>保存</button><button type="button" onClick={publish} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--mikke-orange)] px-4 py-2 text-sm font-bold text-white"><Send size={15} />公開版を保存</button></div>
    </header>
    {error ? <p role="alert" className="mt-4 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-primary-soft)] p-4 text-sm">{error}</p> : null}
    {preview ? <section className="py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--mikke-muted)]">入力中の内容を表示しています。公開はされません。</p><div className="flex gap-2"><button type="button" aria-pressed={previewWidth === "wide"} className={buttonClass} onClick={() => setPreviewWidth("wide")}>PC幅</button><button type="button" aria-pressed={previewWidth === "phone"} className={buttonClass} onClick={() => setPreviewWidth("phone")}>スマホ幅</button></div></div>
      <div className={`mx-auto border border-[var(--mikke-line)] bg-white px-5 py-10 sm:px-8 ${previewWidth === "phone" ? "max-w-[390px]" : "max-w-3xl"}`}><MediaArticleRenderer compact={previewWidth === "phone"} article={{ title: title || "タイトル未入力", slug: slug || article?.slug || "preview", excerpt, category, coverImageUrl, blocks, publishedAt: article?.publishedSnapshot?.publishedAt ?? new Date().toISOString(), updatedAt: article?.updatedAt ?? new Date().toISOString() }} /></div>
      <div className="mx-auto mt-6 max-w-3xl border-t border-[var(--mikke-line)] pt-4 text-sm"><p className="text-xs font-bold text-[var(--mikke-muted)]">記事一覧に表示する紹介文（{excerpt.trim() ? "手入力" : "本文から自動"}）</p><p className="mt-2 leading-7">{excerpt.trim() || getMediaExcerpt(blocks) || "本文を書くと、ここに紹介文が入ります。"}</p></div>
    </section> : <>
      <div className="mx-auto max-w-3xl pt-8 sm:pt-12">
        <details className="mb-7"><summary className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--mikke-muted)]"><ImageIcon size={17} />{coverImageUrl ? "カバー画像を変更" : "カバー画像を添える（任意）"}</summary><div className="mt-4"><MikkeMediaPicker currentUrl={coverImageUrl} sourceApp="media-cover" onSelect={(asset) => { setCoverImageUrl(asset.publicUrl); setCoverImageAssetId(asset.id); }} /></div></details>
        <WritingArea label="記事タイトル" title value={title} onChange={(value) => setTitle(value.slice(0, 160))} placeholder="タイトルをつけよう" />
        <div className="my-5 flex flex-wrap items-center gap-3 border-b border-[var(--mikke-line)] pb-6"><select aria-label="カテゴリー" value={category} onChange={(event) => setCategory(event.target.value)} className="max-w-full rounded-full border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm"><option value="">カテゴリーなし</option>{site.categories.map((item) => <option key={item}>{item}</option>)}</select><button type="button" aria-expanded={addingCategory} onClick={() => setAddingCategory(!addingCategory)} className="inline-flex items-center gap-1 text-sm text-[var(--mikke-primary)]"><Plus size={15} />カテゴリーを追加</button></div>
        {addingCategory ? <form onSubmit={(event) => { event.preventDefault(); addCategory(); }} className="mb-6 flex flex-wrap gap-2"><input autoFocus aria-label="新しいカテゴリー名" value={newCategory} maxLength={60} onChange={(event) => setNewCategory(event.target.value)} placeholder="例：日々のこと" className="min-w-0 flex-1 rounded-xl border border-[var(--mikke-line)] px-3 py-2" /><button type="submit" className={buttonClass}>追加</button><button type="button" className={buttonClass} onClick={() => setAddingCategory(false)}>やめる</button></form> : null}
        <section aria-label="記事本文" className="space-y-5">{blocks.map((block, index) => <article key={block.id} className="group rounded-xl border border-transparent px-2 py-1 focus-within:border-[var(--mikke-line)] hover:border-[var(--mikke-line)] sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--mikke-muted)]"><span className="text-xs">{choices.find((item) => item.type === block.type)?.label}</span><div className="flex gap-1"><button type="button" title="上へ" aria-label="上へ" disabled={index === 0} onClick={() => move(index, -1)} className="p-2 disabled:opacity-25"><ArrowUp size={14} /></button><button type="button" title="下へ" aria-label="下へ" disabled={index === blocks.length - 1} onClick={() => move(index, 1)} className="p-2 disabled:opacity-25"><ArrowDown size={14} /></button><button type="button" title="複製" aria-label="複製" onClick={() => setBlocks((items) => [...items.slice(0,index+1), {...block,id:crypto.randomUUID()}, ...items.slice(index+1)])} className="p-2"><Copy size={14} /></button><button type="button" title="削除" aria-label="削除" onClick={() => setBlocks((items) => items.filter((item) => item.id !== block.id))} className="p-2"><Trash2 size={14} /></button></div></div>
          <BlockFields block={block} onChange={(next) => setBlocks((items) => items.map((item) => item.id === block.id ? next : item))} />
        </article>)}</section>
        <div className="mt-8 flex flex-wrap gap-2 border-t border-[var(--mikke-line)] pt-5">{choices.map(({type,label,icon:Icon}) => <button key={type} type="button" onClick={() => setBlocks((items) => [...items,createMediaBlock(type)])} className="inline-flex items-center gap-2 rounded-full border border-[var(--mikke-line)] px-3 py-2 text-xs text-[var(--mikke-primary)]"><Icon size={14}/>{label}を追加</button>)}</div>
        <p className="mt-5 text-right text-xs text-[var(--mikke-muted)]">{count.toLocaleString()}文字 · 読む目安 約{Math.max(1,Math.ceil(count/500))}分</p>
        <details className="mt-12 border-t border-[var(--mikke-line)] py-5"><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Settings2 size={16} />記事の設定（入力しなくても大丈夫）</summary><div className="mt-5 space-y-6">
          <label className="block text-sm font-semibold">記事URL名（任意）<input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="空欄なら自動で作成" className={inputClass} /><span className="mt-2 block break-all text-xs font-normal leading-6 text-[var(--mikke-muted)]">空欄のまま保存できます。一度作ったURLは空欄に戻しても変わりません。{article ? ` 現在：/media/${site.slug}/${article.slug}` : ""}</span></label>
          <label className="block text-sm font-semibold">記事一覧の紹介文（任意）<textarea value={excerpt} maxLength={300} onChange={(event) => setExcerpt(event.target.value)} rows={3} placeholder="書かなくても、本文のはじめから自動で作ります。" className={inputClass} /><span className="mt-2 block text-xs font-normal leading-6 text-[var(--mikke-muted)]">記事を開く前に内容を伝える短い文章です。自分で書きたいときだけ入力してください。AIは使いません。</span></label>
          {article?.publishedSnapshot ? <button type="button" className={buttonClass} onClick={() => { setArticle(unpublishMediaArticle(article.id)); setMessage("公開版を取り下げました。下書きは残っています。"); }}>公開版を取り下げる</button> : null}
        </div></details>
      </div>
    </>}
  </div>;
}
