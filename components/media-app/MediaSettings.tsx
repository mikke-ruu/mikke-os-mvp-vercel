"use client";
import {MediaImage} from "./MediaImage";

import styles from "./MediaCompact.module.css";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { normalizeMediaSlug } from "@/lib/media-app/store";
import type { MediaSite } from "@/lib/media-app/types";
import {MediaSettingsImagePicker as MediaLocalImagePicker} from "./MediaSettingsImagePicker";
import { MediaAuthorSettings, type MediaAuthorFields } from "./MediaAuthorSettings";
import { MediaLink as Link } from "./MediaNavigation";
import { useMediaRepository } from "./MediaRepository";

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm font-medium";

export function MediaSettings() {
  const { profile } = useAuth();
  const repository = useMediaRepository();
  const { getOwnedMedia, updateMediaSite, addMediaCategory, cloud } = repository;
  const ownerKey = cloud ? profile.user_id : profile.id;
  const loadVersion = useRef(0);
  const [loadedOwner, setLoadedOwner] = useState("");
  const [site, setSite] = useState<MediaSite | null>(null);
  const [logoImageUrl,setLogoImageUrl]=useState("");
  const [bannerImageUrl,setBannerImageUrl]=useState("");
  const [bannerPosition,setBannerPosition]=useState(50);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [author,setAuthor]=useState<MediaAuthorFields>({authorName:"",authorAvatarUrl:"",authorBio:"",storyReference:"",storyLinkRequested:false});
  const [saving,setSaving]=useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applySite(next: MediaSite) {
    setSite(next);
    setLogoImageUrl(next.logoImageUrl??"");
    setBannerImageUrl(next.bannerImageUrl??"");setBannerPosition(next.bannerPosition??50);
    setName(next.name);
    setSlug(next.slug);
    setDescription(next.description);
    setAuthor({authorName:next.authorName,authorAvatarUrl:next.authorAvatarUrl??"",authorBio:next.authorBio??"",storyReference:next.storyReference??next.storyUrl??"",storyLinkRequested:next.storyLinkRequested??next.showStory===true});
    setCategories(next.categories);
  }

  useEffect(() => {
    const version = ++loadVersion.current;
    let alive = true;
    setLoadedOwner("");
    setSite(null);
    setMessage("");
    setError("");
    setNewCategory("");
    setCategoryBusy(false);
    void (async () => {
      try {
        const next = await getOwnedMedia(profile.id);
        if (!alive || loadVersion.current !== version) return;
        if (next && next.ownerProfileId !== ownerKey) throw new Error("LOGIN_CHANGED");
        if (next) applySite(next);
      } catch {
        if (alive && loadVersion.current === version) setError("設定を読み込めませんでした。");
      } finally {
        if (alive && loadVersion.current === version) setLoadedOwner(ownerKey);
      }
    })();
    return () => { alive = false; };
  }, [profile.id, ownerKey, getOwnedMedia]);

  if (loadedOwner !== ownerKey) return <p className="py-12 text-center text-sm text-[var(--mikke-muted)]">設定を開いています…</p>;
  if (error && !site) return <p role="alert">{error}</p>;
  if (!site) return <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] p-8 text-center"><Link href="/apps/media/new" className="font-bold text-[var(--mikke-primary)]">先にMediaを作成してください</Link></p>;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if(saving)return;setSaving(true);
    const version = loadVersion.current;
    const siteId = site!.id;
    setMessage("");
    setError("");
    try {
      const next = await updateMediaSite(siteId, { name, slug, description, categories, bannerImageUrl,bannerPosition,logoImageUrl,...author });
      if (loadVersion.current !== version || next.ownerProfileId !== ownerKey) return;
      applySite(next);
      setMessage("保存しました。");
    } catch (cause) {
      if (loadVersion.current === version) setError(cause instanceof Error ? cause.message : "設定を保存できませんでした。");
    } finally {setSaving(false);}
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    const value = newCategory.trim();
    if (!value || categoryBusy) return;
    const version = loadVersion.current;
    const siteId = site!.id;
    setCategoryBusy(true);
    setMessage("");
    setError("");
    try {
      const next = await addMediaCategory(siteId, value);
      if (loadVersion.current !== version || next.ownerProfileId !== ownerKey) return;
      setSite(next);
      setCategories(next.categories);
      setNewCategory("");
      setMessage(`カテゴリー「${value}」を追加しました。`);
    } catch (cause) {
      if (loadVersion.current === version) setError(cause instanceof Error ? cause.message : "カテゴリーを追加できませんでした。");
    } finally {
      if (loadVersion.current === version) setCategoryBusy(false);
    }
  }

  return <div className={`${styles.settings} mx-auto max-w-3xl`}>
    <div className={styles.saveBar}><button type="submit" form="media-settings-form" disabled={saving}>{saving?"保存しています…":"保存"}</button>{message?<p role="status">{message}</p>:null}{error?<p role="alert">{error}</p>:null}</div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="font-bold">Media設定</h1><Link href="/apps/media/reader" className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-semibold"><ExternalLink size={14}/>Mediaの見本を見る</Link></div>
    <form id="media-settings-form" onSubmit={save} className="space-y-4 rounded-xl border border-[var(--mikke-line)] bg-white p-4">
      {<><section aria-label="トップのカバー画像" className="space-y-2"><h2 className="font-bold">トップカバー画像</h2>{bannerImageUrl?<MediaImage src={bannerImageUrl} alt="カバー画像の表示例" className="h-36 w-full rounded-lg object-cover" style={{objectPosition:`center ${bannerPosition}%`}} />:null}<MediaLocalImagePicker compact onSelect={asset=>setBannerImageUrl(asset.publicUrl)} onRemove={bannerImageUrl?()=>setBannerImageUrl(""):undefined} removeLabel="カバーを外す"/>{bannerImageUrl?<label className="block text-xs">画像の表示位置<input aria-label="カバー画像の表示位置" type="range" min="0" max="100" value={bannerPosition} onChange={e=>setBannerPosition(Number(e.target.value))} className="mt-1 block w-full"/></label>:null}<p className="text-xs">トップに表示する横長の画像です。</p></section>
      <section aria-label="Mediaのロゴ" className="space-y-2"><h2 className="font-bold">Mediaのロゴ</h2><p className="text-xs">表示例</p><div className="flex min-h-14 items-center gap-3">{logoImageUrl?<MediaImage src={logoImageUrl} alt="ロゴの表示例" className="h-12 w-20 object-contain"/>:<span className="grid h-12 w-16 place-items-center rounded-lg border border-dashed border-[var(--mikke-line)] text-xs">ロゴ</span>}<span className="font-bold">{name||"Media名"}</span></div><MediaLocalImagePicker compact onSelect={asset=>setLogoImageUrl(asset.publicUrl)} onRemove={logoImageUrl?()=>setLogoImageUrl(""):undefined} removeLabel="ロゴを外す"/><p className="text-xs">Media名の横に表示します。透明背景のPNGも使えます。</p></section></>}
      <label className="block text-sm font-bold">Media名<input required value={name} onChange={e=>setName(e.target.value)} className={inputClass}/></label>
      <label className="block text-sm font-bold">公開URL名<input required value={slug} onChange={e=>setSlug(e.target.value)} onBlur={()=>setSlug(normalizeMediaSlug(slug))} className={inputClass}/><span className="mt-1 block text-xs font-normal">/media/{normalizeMediaSlug(slug)||"your-media"}</span></label>
      <label className="block text-sm font-bold">Mediaの紹介文<textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} className={inputClass}/></label>
      <MediaAuthorSettings value={author} onChange={setAuthor} cloud={cloud}/>
      <button type="submit" disabled={saving} className="w-full rounded-lg bg-[var(--mikke-orange)] px-4 py-2.5 text-sm font-bold text-white">{saving?"保存しています…":"保存"}</button>
    </form>
    <section className="mt-4 rounded-xl border border-[var(--mikke-line)] p-4"><h2 className="font-bold">カテゴリー設定</h2><p className="mt-1 text-xs">記事を整理するカテゴリーを追加できます。</p><ul className="my-3 flex flex-wrap gap-2">{categories.map(c=><li key={c} className="rounded-full bg-[var(--mikke-primary-soft)] px-3 py-1 text-xs">{c}</li>)}</ul><form onSubmit={addCategory} className="flex items-center gap-2"><input aria-label="新しいカテゴリー名" value={newCategory} maxLength={60} onChange={e=>setNewCategory(e.target.value)} placeholder="カテゴリー名" className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm"/><button type="submit" disabled={!newCategory.trim()||categoryBusy} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--mikke-blue)] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus size={14}/>{categoryBusy?"追加中…":"追加する"}</button></form></section>
    <section className="mt-4 border-t border-[var(--mikke-line)] py-4"><h2 className="font-bold">他のアプリ連携</h2><p className="mt-2 text-xs">STORY・Page・Academyへ選んだ記事を掲載する連携は準備中です。</p><Link href="/apps/media/connections" className="mt-3 inline-block text-xs text-[var(--mikke-primary)] underline">記事連携の動作見本を見る</Link></section>
  </div>;
}
