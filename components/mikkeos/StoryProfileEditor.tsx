"use client";

import {
  ArrowLeft, Camera, ChevronLeft, ChevronRight, Eye, ImagePlus, Link as LinkIcon,
  MapPin, Palette, Plus, Save, Sparkles, Trash2, X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { getMyStoryProfile, getStorySaveErrorMessage, saveMyStoryProfile } from "@/lib/mikkeos/story-profile-db";
import { uploadStoryImage } from "@/lib/mikkeos/story-profile-media";
import {
  defaultStoryProfile, getStoryProfileValidationError, getStoryPublicUrl, loadStoryProfileDraft,
  normalizeStoryHandle, saveStoryProfileDraft, storySnsDefaults, storyThemes,
  type StoryProfileLink, type StoryProfileView, type StoryThemeKey
} from "@/lib/mikkeos/story-profile-store";
import { supabase } from "@/lib/supabase/client";

const introSeenKey = "mikkeos.story.intro.seen.v2";

export function StoryProfileEditor({ mode }: { mode: "start" | "edit" }) {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<StoryProfileView>(defaultStoryProfile);
  const [loading, setLoading] = useState(true);
  const [introStep, setIntroStep] = useState<number | null | undefined>(mode === "start" ? undefined : null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (mode === "start") setIntroStep(window.localStorage.getItem(introSeenKey) === "1" ? null : 0);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    setForm(loadStoryProfileDraft());
    getMyStoryProfile(supabase).then((remote) => {
      if (!cancelled && remote) {
        setForm(remote);
        saveStoryProfileDraft(remote);
        setIntroStep(null);
      }
    }).catch(() => {
      if (!cancelled) setMessage("端末内の下書きを表示しています。");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user.id]);

  const update = <K extends keyof StoryProfileView>(key: K, value: StoryProfileView[K]) => {
    setMessage("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const upload = async (file: File | undefined, kind: "avatar" | "banner" | "portfolio") => {
    if (!file) return;
    if (kind === "portfolio" && form.portfolio.length >= 5) return;
    setUploading(kind);
    setMessage("");
    try {
      const result = await uploadStoryImage(supabase, user.id, file, kind);
      setForm((current) => {
        if (kind === "avatar") return { ...current, avatarUrl: result.imageUrl, avatarStoragePath: result.storagePath };
        if (kind === "banner") return { ...current, bannerUrl: result.imageUrl, bannerStoragePath: result.storagePath };
        return { ...current, portfolio: [...current.portfolio, { id: crypto.randomUUID(), source: "upload" as const, storagePath: result.storagePath, imageUrl: result.imageUrl, caption: "" }].slice(0, 5) };
      });
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "画像をアップロードできませんでした。");
    } finally {
      setUploading("");
    }
  };

  const requestSave = (publish: boolean) => {
    const error = getStoryProfileValidationError(form, publish);
    if (error) { setIsError(true); setMessage(error); return; }
    if (publish) { setConfirmOpen(true); return; }
    void persist(false);
  };

  const persist = async (publish: boolean) => {
    if (!publish && (!form.displayName.trim() || !form.handle)) {
      saveStoryProfileDraft({ ...form, isPublished: false });
      setIsError(false); setMessage("この端末に下書きを保存しました。名前とURL名を決めるとサーバーにも保存できます。");
      return;
    }
    const next = { ...form, isPublished: publish };
    setConfirmOpen(false); setSaving(publish ? "publish" : "draft"); setMessage("");
    saveStoryProfileDraft({ ...next, isPublished: false });
    try {
      const saved = await saveMyStoryProfile(supabase, next);
      setForm(saved); saveStoryProfileDraft(saved); setIsError(false);
      if (publish) { router.push(`/story/${saved.handle}`); return; }
      setMessage("下書きを保存しました。まだ公開されていません。");
    } catch (error) {
      setIsError(true); setMessage(`${getStorySaveErrorMessage(error)} 端末内には下書きを残しています。`);
    } finally { setSaving(null); }
  };

  if (loading || introStep === undefined) return <main className="min-h-screen bg-white" />;
  if (introStep !== null) return <StoryIntro step={introStep} onStep={setIntroStep} onBegin={() => { window.localStorage.setItem(introSeenKey, "1"); setIntroStep(null); }} />;

  const theme = storyThemes[form.themeKey];
  const initials = form.displayName.trim().slice(0, 2) || "ST";
  const fixedSns = storySnsDefaults.map((item) => form.sns.find((candidate) => candidate.key === item.key) ?? item);
  const customLinks = form.sns.filter((item) => item.key.startsWith("custom-"));

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f5f8] pb-28 text-[#171821]" style={{ "--story-accent": theme.accent, "--story-soft": theme.soft, "--story-ink": theme.ink } as React.CSSProperties}>
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[430px] items-center justify-between">
          <Link href="/story" aria-label="STORYへ戻る" className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5"><ArrowLeft size={20} /></Link>
          <div className="text-center"><p className="text-xs font-extrabold tracking-[0.22em] text-[var(--story-accent)]">EDIT STORY</p><p className="mt-1 text-[10px] font-bold text-black/45">{form.isPublished ? "公開中・見たまま編集" : "未公開・下書き"}</p></div>
          {form.handle && form.isPublished ? <Link href={`/story/${form.handle}`} aria-label="公開画面を見る" className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5"><Eye size={19} /></Link> : <span className="h-10 w-10" />}
        </div>
      </header>

      <article className="mx-auto w-full max-w-[430px] overflow-hidden bg-white sm:my-6 sm:rounded-[28px] sm:border sm:border-black/10 sm:shadow-sm">
        {message ? <p role={isError ? "alert" : "status"} className={`m-3 rounded-2xl px-4 py-3 text-xs font-bold leading-5 ${isError ? "bg-red-50 text-red-700" : "bg-[var(--story-soft)] text-[var(--story-ink)]"}`}>{message}</p> : null}

        <section className="relative">
          <div className="relative h-36 overflow-hidden bg-[var(--story-soft)]">
            {form.bannerUrl ? <img src={form.bannerUrl} alt="バナー" className="h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center text-center text-xs font-bold text-black/35"><span><ImagePlus className="mx-auto mb-2" size={24} />バナーを追加</span></div>}
            <FileButton label="バナー画像を選ぶ" className="absolute bottom-3 right-3" busy={uploading === "banner"} onFile={(file) => void upload(file, "banner")}><Camera size={14} /> バナー</FileButton>
          </div>
          <div className="relative px-5 pb-6">
            <div className="absolute -top-12 left-5 h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[var(--story-soft)] shadow-sm">
              <div className="grid h-full w-full place-items-center text-xl font-extrabold text-[var(--story-ink)]">{initials}</div>
              {form.avatarUrl ? <img src={form.avatarUrl} alt="プロフィール写真" className="absolute inset-0 h-full w-full object-cover" /> : null}
              <FileButton label="プロフィール写真を選ぶ" className="absolute inset-x-0 bottom-0 rounded-none border-0 bg-black/60 py-1 text-[10px] text-white" busy={uploading === "avatar"} onFile={(file) => void upload(file, "avatar")}><Camera size={11} /> 写真</FileButton>
            </div>
            <div className="pt-16">
              <InlineInput label="表示名" value={form.displayName} placeholder="名前をタップ" onChange={(value) => update("displayName", value)} className="text-2xl font-extrabold" />
              <InlineInput label="肩書き" value={form.role} placeholder="肩書き・活動内容をタップ" onChange={(value) => update("role", value)} className="mt-1 text-sm font-bold text-[var(--story-accent)]" />
              <InlineTextarea label="自己紹介" value={form.bio} placeholder="自己紹介をタップして入力" onChange={(value) => update("bio", value)} className="mt-3 min-h-20 text-sm leading-7 text-black/65" />
              <div className="mt-2 flex items-center gap-1.5 text-black/45"><MapPin size={13} /><InlineInput label="活動エリア" value={form.area} placeholder="活動エリア" onChange={(value) => update("area", value)} className="text-xs" /></div>
              <InlineInput label="ひとこと" value={form.status} placeholder="今いちばん伝えたいひとこと" onChange={(value) => update("status", value)} className="mt-4 rounded-full bg-[var(--story-soft)] px-3 py-2 text-xs font-bold text-[var(--story-ink)]" />
            </div>
          </div>
        </section>

        <EditorSection eyebrow="PORTFOLIO" title="作品・活動写真" note="最大5枚。将来はItem Studioの作品もここから選べます。">
          <div className="grid grid-cols-3 gap-2">
            {form.portfolio.map((item, index) => <div key={item.id} className={`group relative overflow-hidden rounded-2xl bg-black/5 ${index === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}><img src={item.imageUrl} alt={item.caption || `作品 ${index + 1}`} className="h-full w-full object-cover" /><button type="button" aria-label="作品を削除" onClick={() => update("portfolio", form.portfolio.filter((candidate) => candidate.id !== item.id))} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><Trash2 size={13} /></button></div>)}
            {form.portfolio.length < 5 ? <FileButton label="作品写真を追加" className="flex aspect-square min-h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-black/20 bg-black/[0.02] text-xs font-bold text-black/45" busy={uploading === "portfolio"} onFile={(file) => void upload(file, "portfolio")}><Plus size={21} /><span className="mt-1">写真を追加</span></FileButton> : null}
          </div>
        </EditorSection>

        <EditorSection eyebrow="KEYWORDS" title="あなたを表すキーワード" note="検索や共通点を見つけるための小さなバッジです。任意・最大8個。">
          <input aria-label="キーワード" value={form.tags.join("、")} onChange={(event) => update("tags", event.target.value.split(/[,、]/).map((item) => item.trim().replace(/^#/, "")).filter(Boolean).slice(0, 8))} placeholder="焼き菓子、イベント出店、東京" className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[var(--story-accent)]" />
          {form.tags.length ? <div className="mt-3 flex flex-wrap gap-2">{form.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--story-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--story-ink)]">#{tag}</span>)}</div> : null}
        </EditorSection>

        <EditorSection eyebrow="PICK UP" title="いま伝えたいこと" note="イベント、募集、最近の活動など。空欄なら表示しません。">
          <InlineTextarea label="いま伝えたいこと" value={form.pickupText} placeholder="いま見てほしい活動やお知らせを入力" onChange={(value) => update("pickupText", value)} className="min-h-24 rounded-2xl border-solid border-black/10 px-4 py-3 text-sm leading-7" />
        </EditorSection>

        <EditorSection eyebrow="LINKS" title="SNSとリンク" note="未入力のものは公開画面に表示されません。">
          <div className="space-y-2">{fixedSns.map((item) => <UrlInput key={item.key} label={item.label} value={item.url} onChange={(value) => updateSns(form, update, { ...item, url: value })} />)}</div>
          <div className="mt-3 space-y-2"><UrlInput label="Webサイト" value={form.websiteUrl} onChange={(value) => update("websiteUrl", value)} /><UrlInput label="ショップ" value={form.shopUrl} onChange={(value) => update("shopUrl", value)} /></div>
          {customLinks.map((item) => <div key={item.key} className="mt-2 grid grid-cols-[1fr_1.4fr_auto] gap-2"><input aria-label="リンク名" value={item.label} onChange={(event) => updateSns(form, update, { ...item, label: event.target.value })} placeholder="リンク名" className="min-w-0 rounded-xl border border-black/10 px-3 py-2 text-sm" /><input aria-label={`${item.label || "追加リンク"} URL`} value={item.url} onChange={(event) => updateSns(form, update, { ...item, url: event.target.value })} placeholder="https://" inputMode="url" className="min-w-0 rounded-xl border border-black/10 px-3 py-2 text-sm" /><button type="button" aria-label="リンクを削除" onClick={() => update("sns", form.sns.filter((candidate) => candidate.key !== item.key))} className="grid h-10 w-10 place-items-center rounded-xl border border-black/10"><Trash2 size={14} /></button></div>)}
          <button type="button" onClick={() => update("sns", [...form.sns, { key: `custom-${crypto.randomUUID()}`, label: "", url: "" }])} className="mt-3 inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold"><Plus size={14} />リンクを追加</button>
        </EditorSection>

        <EditorSection eyebrow="COLOR" title="カードの色" note="写真が主役になる、見やすい5色から選べます。">
          <div className="flex gap-3">{(Object.keys(storyThemes) as StoryThemeKey[]).map((key) => <button key={key} type="button" aria-label={storyThemes[key].label} onClick={() => update("themeKey", key)} className={`grid h-11 w-11 place-items-center rounded-full border-2 ${form.themeKey === key ? "border-black" : "border-transparent"}`}><span className="h-8 w-8 rounded-full" style={{ backgroundColor: storyThemes[key].accent }} /></button>)}</div>
        </EditorSection>

        <EditorSection eyebrow="PUBLIC URL" title="あなたのSTORY URL" note="英小文字・数字・ハイフンで3文字以上。">
          <label className="flex min-w-0 overflow-hidden rounded-2xl border border-black/10"><span className="hidden bg-black/[0.03] px-3 py-3 text-[11px] font-bold text-black/45 min-[390px]:block">app.mikke-os.com/story/</span><input aria-label="URL名" value={form.handle} onChange={(event) => update("handle", normalizeStoryHandle(event.target.value))} placeholder="your-name" className="min-w-0 flex-1 px-3 py-3 text-sm font-bold outline-none" /></label>
        </EditorSection>

        <footer className="border-t border-black/5 py-5 text-center text-[11px] font-semibold text-black/30">STORY <span className="font-normal">by mikke</span></footer>
      </article>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 px-3 py-3 backdrop-blur"><div className="mx-auto flex max-w-[430px] gap-2"><button type="button" disabled={saving !== null || !!uploading} onClick={() => requestSave(false)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-black/10 px-3 py-3 text-sm font-bold disabled:opacity-50"><Save size={16} />{saving === "draft" ? "保存中" : "下書き保存"}</button><button type="button" disabled={saving !== null || !!uploading} onClick={() => requestSave(true)} className="flex-1 rounded-2xl bg-[var(--story-accent)] px-3 py-3 text-sm font-bold text-white disabled:opacity-50">{saving === "publish" ? "公開中" : "公開する"}</button></div></div>

      {confirmOpen ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-[24px] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-extrabold tracking-[0.18em] text-[var(--story-accent)]">PUBLIC STORY</p><h2 className="mt-2 text-xl font-extrabold">この内容を公開しますか？</h2></div><button type="button" aria-label="閉じる" onClick={() => setConfirmOpen(false)}><X size={20} /></button></div><p className="mt-3 text-sm leading-6 text-black/55">URLを知っている人は、ログインせずに写真・自己紹介・リンクを見ることができます。</p><p className="mt-3 break-all rounded-xl bg-black/[0.03] p-3 text-xs font-bold">{getStoryPublicUrl(form.handle)}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-black/10 py-3 text-sm font-bold">戻る</button><button type="button" onClick={() => void persist(true)} className="rounded-xl bg-[var(--story-accent)] py-3 text-sm font-bold text-white">公開する</button></div></div></div> : null}
    </main>
  );
}

function StoryIntro({ step, onStep, onBegin }: { step: number; onStep: (value: number) => void; onBegin: () => void }) {
  return <main className="min-h-screen bg-[#f4f5f8] p-3 text-[#171821] sm:py-8"><section className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white sm:min-h-[720px]"><header className="flex justify-between px-5 py-4"><p className="text-xs font-extrabold tracking-[0.2em] text-[#4656c7]">WELCOME TO STORY</p><p className="text-xs font-bold text-black/45">{step + 1} / 2</p></header><div className="flex flex-1 flex-col px-5 pb-5">{step === 0 ? <><IntroCard rich={false} /><div className="mt-7"><p className="text-xs font-bold text-[#4656c7]">01　あなたを一枚で伝える</p><h1 className="mt-3 text-[28px] font-extrabold leading-[1.15]">会ったあとも、<br />あなたの活動が伝わる。</h1><p className="mt-4 text-sm leading-7 text-black/55">プロフィール、作品、リンク、QRコードを、ひとつのきれいな名刺にまとめます。</p></div></> : <><IntroCard rich /><div className="mt-7"><p className="text-xs font-bold text-[#4656c7]">02　完成形を見ながら編集</p><h1 className="mt-3 text-[28px] font-extrabold leading-[1.15]">長い入力フォームは、<br />もうありません。</h1><p className="mt-4 text-sm leading-7 text-black/55">Instagramのプロフィールのように、変えたい場所を直接タップ。写真や色も、同じ画面で整えられます。</p></div></>}<div className="mt-auto pt-7"><div className="mb-4 flex justify-center gap-2"><span className={`h-1.5 rounded-full ${step === 0 ? "w-7 bg-[#4656c7]" : "w-1.5 bg-black/10"}`} /><span className={`h-1.5 rounded-full ${step === 1 ? "w-7 bg-[#4656c7]" : "w-1.5 bg-black/10"}`} /></div>{step === 0 ? <button type="button" onClick={() => onStep(1)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4656c7] py-4 text-sm font-bold text-white">次へ<ChevronRight size={17} /></button> : <div className="grid grid-cols-[52px_1fr] gap-2"><button type="button" aria-label="前へ" onClick={() => onStep(0)} className="grid place-items-center rounded-2xl border border-black/10"><ChevronLeft size={18} /></button><button type="button" onClick={onBegin} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4656c7] py-4 text-sm font-bold text-white"><Sparkles size={17} />自分のSTORYをつくる</button></div>}</div></div></section></main>;
}

function IntroCard({ rich }: { rich: boolean }) {
  return <div className="overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-sm"><div className="h-24 bg-[#eef0ff]">{rich ? <div className="flex h-full items-center justify-center gap-2"><Palette size={20} className="text-[#4656c7]" /><span className="text-xs font-bold text-[#4656c7]">写真と色を選ぶ</span></div> : null}</div><div className="relative px-5 pb-5"><div className="absolute -top-10 grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-[#ffd9df] text-lg font-extrabold">山田</div><div className="pt-12"><p className="text-xs font-bold text-[#4656c7]">焼き菓子と小さなお店</p><p className="mt-1 text-2xl font-extrabold">山田 はな</p><p className="mt-3 text-sm leading-6 text-black/55">季節のお菓子をつくっています。イベント出店とオンラインで活動中です。</p>{rich ? <div className="mt-4 grid grid-cols-3 gap-2"><span className="aspect-square rounded-xl bg-[#f0c6a7]" /><span className="aspect-square rounded-xl bg-[#d8b99d]" /><span className="aspect-square rounded-xl bg-[#eadbc9]" /></div> : <p className="mt-3 text-xs text-black/45">東京・神奈川</p>}</div></div></div>;
}

function EditorSection({ eyebrow, title, note, children }: { eyebrow: string; title: string; note: string; children: React.ReactNode }) {
  return <section className="border-t border-black/5 px-5 py-6"><p className="text-[10px] font-extrabold tracking-[0.18em] text-[var(--story-accent)]">{eyebrow}</p><h2 className="mt-1 text-lg font-extrabold">{title}</h2><p className="mt-1 text-xs leading-5 text-black/45">{note}</p><div className="mt-4">{children}</div></section>;
}

function InlineInput({ label, value, placeholder, onChange, className }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; className: string }) {
  return <input aria-label={label} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`block w-full min-w-0 rounded-lg border border-dashed border-transparent bg-transparent px-2 py-1 outline-none hover:border-black/15 focus:border-[var(--story-accent)] ${className}`} />;
}

function InlineTextarea({ label, value, placeholder, onChange, className }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; className: string }) {
  return <textarea aria-label={label} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} rows={3} className={`block w-full resize-none rounded-lg border border-dashed border-transparent bg-transparent px-2 py-1 outline-none hover:border-black/15 focus:border-[var(--story-accent)] ${className}`} />;
}

function FileButton({ label, className, busy, onFile, children }: { label: string; className: string; busy: boolean; onFile: (file?: File) => void; children: React.ReactNode }) {
  return <label aria-label={label} className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white/90 px-3 py-2 text-xs font-bold shadow-sm ${className}`}><input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} />{busy ? "処理中…" : children}</label>;
}

function UrlInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-black/10 px-3 py-2.5"><span className="w-20 shrink-0 text-xs font-bold">{label}</span><input aria-label={`${label} URL`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://" inputMode="url" className="min-w-0 flex-1 text-sm outline-none" /><LinkIcon size={14} className="text-black/25" /></label>;
}

function updateSns(form: StoryProfileView, update: <K extends keyof StoryProfileView>(key: K, value: StoryProfileView[K]) => void, item: StoryProfileLink) {
  const exists = form.sns.some((candidate) => candidate.key === item.key);
  update("sns", exists ? form.sns.map((candidate) => candidate.key === item.key ? item : candidate) : [...form.sns, item]);
}
