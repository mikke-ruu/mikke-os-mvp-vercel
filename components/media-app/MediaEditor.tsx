"use client";
import { MediaInlineEditor } from "./MediaInlineEditor";
import { MediaCloudBlockFields } from "./MediaCloudBlockFields";
import { useMediaRepository } from "./MediaRepository";

import { MediaLink as Link } from "./MediaNavigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMediaRouter as useRouter } from "./MediaNavigation";
import { Eye, Pencil, Settings2, ImageIcon, Plus, Send } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { MediaImagePicker as MikkeMediaPicker } from "./MediaImagePicker";
import { getMediaExcerpt, createMediaBlock, isSafeMediaUrl } from "@/lib/media-app/store";
import { MediaCloudPublication } from "./MediaCloudPublication";
import { MediaArticleRenderer } from "./MediaArticleRenderer";
import type { MediaArticle, MediaBlock, MediaSite } from "@/lib/media-app/types";

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm font-normal";

function WritingArea({ value, onChange, label, placeholder, title = false }: { value: string; onChange: (value: string) => void; label: string; placeholder: string; title?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (ref.current) { ref.current.style.height = "0px"; ref.current.style.height = ref.current.scrollHeight + "px"; } }, [value]);
  return <textarea ref={ref} style={{ fontSize: title ? "clamp(1.5rem, 3vw, 2rem)" : "1.0625rem", fontWeight: title ? 700 : 400, lineHeight: title ? 1.6 : 2 }} aria-label={label} value={value} placeholder={placeholder} rows={1} onChange={(event) => onChange(event.target.value)} className={title ? "w-full resize-none overflow-hidden border-0 bg-transparent py-3 text-3xl font-bold leading-relaxed outline-none placeholder:text-[var(--mikke-muted)] sm:text-4xl" : "min-h-32 w-full resize-none overflow-hidden border-0 bg-transparent py-3 text-base leading-9 outline-none placeholder:text-[var(--mikke-muted)] sm:text-lg"} />;
}

export function MediaEditor() {
  const { profile } = useAuth();
  const repository=useMediaRepository();
  const {cloud,getOwnedMedia,getMediaArticle,saveMediaArticle,publishMediaArticle,unpublishMediaArticle,addMediaCategory}=repository;
  const ownerKey=cloud?profile.user_id:profile.id;
  const [loadedOwner,setLoadedOwner]=useState("");
  const epoch=useRef(0);
  const mounted=useRef(true);
  const publicationBusy=useRef(false);
  const [publishing,setPublishing]=useState(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
  const writeQueue=useRef<Promise<unknown>>(Promise.resolve());
  const [rights,setRights]=useState(false);
  const [publicationId,setPublicationId]=useState<string|null>(null);
  const [privacy,setPrivacy]=useState(false);
  const [noAffiliate,setNoAffiliate]=useState(false);
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
  const latestPayload=useRef(serialized);
  latestPayload.current=serialized;
  const hasContent = Boolean(title.trim() || getMediaExcerpt(blocks) || coverImageUrl);
  useEffect(()=>{setRights(false);setPrivacy(false);setNoAffiliate(false);},[serialized,ownerKey]);

  useEffect(() => {
    if (requestedId && requestedId === articleId.current && loadedOwner===ownerKey) return;
    const version=++epoch.current; let alive=true; setPublicationId(null); setLoaded(false); setSite(null); setArticle(null);
    void (async()=>{try {
      const owned=await getOwnedMedia(profile.id);
      if(owned && owned.ownerProfileId!==ownerKey)throw Error("ログイン状態を確認して原稿を開き直してください。");
      const found=requestedId?await getMediaArticle(requestedId):null;
      if(!alive || epoch.current!==version)return;
      if(requestedId && (!found || !owned || found.mediaId!==owned.id))throw Error("この記事を開く権限がないか、記事が見つかりません。");
      const current=found;
      setSite(owned); articleId.current=current?.id??null;setArticle(current);
      setTitle(current?.title??"");setSlug(current?.slug??"");setExcerpt(current?.excerpt??"");setCategory(current?.category??"");
      setCoverImageUrl(current?.coverImageUrl??"");setCoverImageAssetId(current?.coverImageAssetId);
      setBlocks(current?.blocks.length?current.blocks:[createMediaBlock("paragraph")]);
      savedPayload.current=current?JSON.stringify({title:current.title.trim()||"無題の記事",slug:current.slug,excerpt:current.excerpt,category:current.category,coverImageUrl:current.coverImageUrl,coverImageAssetId:current.coverImageAssetId,blocks:current.blocks}):"";setPreview(false);setError("");setLoadedOwner(ownerKey);
      setMessage(current?(cloud?"アカウントに保存済み":"保存済み"):"タイトルか本文を書くと自動保存します");
    } catch(cause){if(alive){setError(cause instanceof Error?cause.message:"原稿を読み込めませんでした。");setLoadedOwner(ownerKey);}}
    finally{if(alive)setLoaded(true);}})();
    return()=>{alive=false;};
  },[profile.id,ownerKey,requestedId,repository,getOwnedMedia,getMediaArticle,cloud]);

  function saveDraft() {
    const version=epoch.current; const target=site; const input=structuredClone(payload); const value=serialized;
    const operation=writeQueue.current.then(async()=>{
      if(!mounted.current || !target || target.ownerProfileId!==ownerKey || version!==epoch.current)throw Error("ログイン状態を確認して原稿を開き直してください。");
      const saved=await saveMediaArticle(target.id,articleId.current,input);
      if(version!==epoch.current)throw Error("ログイン状態が変わりました。保存結果を確認してください。");
      articleId.current=saved.id;savedPayload.current=value;setArticle(saved);
      setMessage(cloud?"アカウントに保存済み":"保存済み");setError("");
      if(!requestedId)router.replace('/apps/media/write?article='+saved.id);
      return saved;
    });
    writeQueue.current=operation.catch(()=>{});return operation;
  }
  useEffect(()=>{
    if(publicationId || publishing || !loaded || loadedOwner!==ownerKey || !site || !hasContent || serialized===savedPayload.current)return;
    let alive=true;
    const timer=window.setTimeout(()=>{void saveDraft().catch(()=>{if(alive){setMessage("未保存の変更があります");setError("保存できませんでした。接続を確認してもう一度保存してください。");}});},900);
    return()=>{alive=false;window.clearTimeout(timer);};
  },[loaded,loadedOwner,ownerKey,site,hasContent,serialized,repository,publishing,publicationId]);
  async function saveNow() {
    try{if(!hasContent)throw Error("タイトルか本文を少し書いてみましょう。");
      if(blocks.some(block=>block.type==="link"&&!isSafeMediaUrl(block.url??"")))throw Error("リンクのURLを確認してください。");
      return await saveDraft();
    }catch(cause){setError(cause instanceof Error?cause.message:"保存できませんでした。");return null;}
  }
  async function publish() {
    if(publicationBusy.current)return;
    if(!title.trim()){setError("公開前にタイトルを付けてください。");return;}
    const termsVersion=process.env.NEXT_PUBLIC_MEDIA_TERMS_VERSION??"";
    publicationBusy.current=true;setPublishing(true);
    const version=epoch.current; const confirmedPayload=serialized;
    try{const saved=await saveNow();if(!saved)return;
      if(version!==epoch.current || confirmedPayload!==latestPayload.current)throw Error("原稿が変わりました。内容を確認してから公開してください。");
      if(saved.blocks.some(block=>block.type==="image"&&block.imageUrl&&!block.alt?.trim()))throw Error("画像の説明を入力してください。");
      if(cloud){setPublicationId(saved.id);return;}
      const result=await publishMediaArticle(saved.id,cloud?{termsVersion,rightsConfirmed:true,privacyConfirmed:true,affiliateFreeConfirmed:true}:undefined);
      if(version!==epoch.current)return;setArticle(result);setMessage(cloud?"記事を公開しました。":"このブラウザに公開版の見本を保存しました。外部には公開されません。");
    }catch(cause){if(version===epoch.current)setError(cause instanceof Error?cause.message:"公開できませんでした。原稿と接続を確認してください。");}
    finally{publicationBusy.current=false;if(mounted.current)setPublishing(false);}
  }
  async function cancelPublication(){if(!article)return;const version=epoch.current;try{const next=await unpublishMediaArticle(article.id);if(version!==epoch.current)return;setArticle(next);setMessage("公開をキャンセルしました。下書きは残っています。");}catch{setError("公開をキャンセルできませんでした。接続を確認してください。");}}
  async function addCategory(){if(!site)return;const version=epoch.current;const name=newCategory.trim();try{const updated=await addMediaCategory(site.id,name);if(version!==epoch.current)return;setSite(updated);setCategory(name);setNewCategory("");setAddingCategory(false);}catch(cause){setError(cause instanceof Error?cause.message:"カテゴリーを追加できませんでした。");}}
  const count = blocks.reduce((total, block) => total + Array.from(block.text ?? block.items?.join("") ?? "").length, 0);
  if (!loaded || loadedOwner!==ownerKey) return <p className="py-16 text-center">原稿を開いています…</p>;
  if (!site) return error ? <p role="alert">{error}</p> : <Link href="/apps/media/new">先にMediaを作成してください</Link>;
  if(publicationId&&cloud)return <MediaCloudPublication key={ownerKey+publicationId} articleId={publicationId} updating={Boolean(article?.publishedSnapshot)} onCancel={()=>setPublicationId(null)} onPublished={next=>{setArticle(next);setPublicationId(null);setMessage(article?.publishedSnapshot?"更新しました":"公開しました");}}/>;
  const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm font-semibold";
  return <fieldset disabled={publishing} aria-busy={publishing} className="mx-auto min-w-0 max-w-5xl border-0 p-0 pb-16">
    <header className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mikke-line)] bg-white/95 py-3">
      <p role="status" className="text-xs text-[var(--mikke-muted)]">{message}</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => setPreview(!preview)}>{preview ? <Pencil size={15} /> : <Eye size={15} />}{preview ? "執筆に戻る" : "プレビュー"}</button><button type="button" className={buttonClass} onClick={saveNow}>下書き保存</button><button type="button" onClick={publish} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--mikke-orange)] px-4 py-2 text-sm font-bold text-white"><Send size={15} />{article?.publishedSnapshot?"更新する":"公開する"}</button></div>
    </header>
    {error ? <p role="alert" className="mt-4 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-primary-soft)] p-4 text-sm">{error}</p> : null}
    {preview ? <section className="py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--mikke-muted)]">入力中の内容を表示しています。公開はされません。</p><div className="flex gap-2"><button type="button" aria-pressed={previewWidth === "wide"} className={buttonClass} onClick={() => setPreviewWidth("wide")}>PC幅</button><button type="button" aria-pressed={previewWidth === "phone"} className={buttonClass} onClick={() => setPreviewWidth("phone")}>スマホ幅</button></div></div>
      <div className={`mx-auto border border-[var(--mikke-line)] bg-white px-5 py-10 sm:px-8 ${previewWidth === "phone" ? "max-w-[390px]" : "max-w-3xl"}`}><MediaArticleRenderer compact={previewWidth === "phone"} article={{ title: title || "タイトル未入力", slug: slug || article?.slug || "preview", excerpt, category, coverImageUrl, blocks, publishedAt: article?.publishedSnapshot?.publishedAt ?? new Date().toISOString(), updatedAt: article?.updatedAt ?? new Date().toISOString() }} /></div>
      <div className="mx-auto mt-6 max-w-3xl border-t border-[var(--mikke-line)] pt-4 text-sm"><p className="text-xs font-bold text-[var(--mikke-muted)]">記事一覧に表示する紹介文（{excerpt.trim() ? "手入力" : "本文から自動"}）</p><p className="mt-2 leading-7">{excerpt.trim() || getMediaExcerpt(blocks) || "本文を書くと、ここに紹介文が入ります。"}</p></div>
    </section> : <>
      <div className="mx-auto max-w-3xl pt-5 sm:pt-8">
        <details className="mb-7"><summary className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--mikke-muted)]"><ImageIcon size={17} />{coverImageUrl ? "カバー画像を変更" : "カバー画像を添える（任意）"}</summary><div className="mt-4"><MikkeMediaPicker currentUrl={coverImageUrl} sourceApp="media-cover" onSelect={(asset) => { setCoverImageUrl(asset.publicUrl); setCoverImageAssetId(asset.id); }} /></div></details>
        <WritingArea label="記事タイトル" title value={title} onChange={(value) => setTitle(value.slice(0, 160))} placeholder="タイトルをつけよう" />
        <div className="my-5 flex flex-wrap items-center gap-3 border-b border-[var(--mikke-line)] pb-6"><select aria-label="カテゴリー" value={category} onChange={(event) => setCategory(event.target.value)} className="max-w-full rounded-full border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm"><option value="">カテゴリーなし</option>{site.categories.map((item) => <option key={item}>{item}</option>)}</select><button type="button" aria-expanded={addingCategory} onClick={() => setAddingCategory(!addingCategory)} className="inline-flex items-center gap-1 text-sm text-[var(--mikke-primary)]"><Plus size={15} />カテゴリーを追加</button></div>
        {addingCategory ? <form onSubmit={(event) => { event.preventDefault(); addCategory(); }} className="mb-6 flex flex-wrap gap-2"><input autoFocus aria-label="新しいカテゴリー名" value={newCategory} maxLength={60} onChange={(event) => setNewCategory(event.target.value)} placeholder="例：日々のこと" className="min-w-0 flex-1 rounded-xl border border-[var(--mikke-line)] px-3 py-2" /><button type="submit" className={buttonClass}>追加</button><button type="button" className={buttonClass} onClick={() => setAddingCategory(false)}>やめる</button></form> : null}
        <MediaInlineEditor blocks={blocks} onChange={setBlocks} renderBlock={(block,onChange,onSplit)=><MediaCloudBlockFields block={block} onChange={onChange} onSplit={onSplit}/>} />
        <p className="mt-5 text-right text-xs text-[var(--mikke-muted)]">{count.toLocaleString()}文字 · 読む目安 約{Math.max(1,Math.ceil(count/500))}分</p>
        <details className="mt-12 border-t border-[var(--mikke-line)] py-5"><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Settings2 size={16} />記事の設定（入力しなくても大丈夫）</summary><div className="mt-5 space-y-6">
          <label className="block text-sm font-semibold">記事URL名（任意）<input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="空欄なら自動で作成" className={inputClass} /><span className="mt-2 block break-all text-xs font-normal leading-6 text-[var(--mikke-muted)]">空欄のまま保存できます。一度作ったURLは空欄に戻しても変わりません。{article ? ` 現在：/media/${site.slug}/${article.slug}` : ""}</span></label>
          <label className="block text-sm font-semibold">記事一覧の紹介文（任意）<textarea value={excerpt} maxLength={300} onChange={(event) => setExcerpt(event.target.value)} rows={3} placeholder="書かなくても、本文のはじめから自動で作ります。" className={inputClass} /><span className="mt-2 block text-xs font-normal leading-6 text-[var(--mikke-muted)]">記事を開く前に内容を伝える短い文章です。自分で書きたいときだけ入力してください。AIは使いません。</span></label>
          {article?.publishedSnapshot ? <button type="button" className={buttonClass} onClick={cancelPublication}>公開をキャンセル</button> : null}
        </div></details>
      </div>
    </>}
  </fieldset>;
}
