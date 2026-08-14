"use client";

import {
  Camera, ChevronLeft, ChevronRight, Eye, ImagePlus, Link as LinkIcon,
  MapPin, Palette, Plus, Save, Sparkles, Trash2, X
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { StoryNameCard } from "@/components/mikkeos/StoryNameCard";
import { getMyStoryProfile, getStorySaveErrorMessage, saveMyStoryProfile } from "@/lib/mikkeos/story-profile-db";
import { removeStoryImages, uploadStoryImage, type StoryImageCrop } from "@/lib/mikkeos/story-profile-media";
import {
  defaultStoryProfile, getStoryProfileValidationError, getStoryPublicUrl, loadStoryProfileDraft,
  normalizeStoryHandleInput, saveStoryProfileDraft, storySnsDefaults, storyThemes,
  type StoryProfileLink, type StoryProfileView, type StoryThemeKey
} from "@/lib/mikkeos/story-profile-store";
import { supabase } from "@/lib/supabase/client";

const introSeenKey = "mikkeos.story.intro.seen.v2";

type CropDraft = {
  file: File;
  kind: "avatar" | "banner";
  objectUrl: string;
  crop: StoryImageCrop;
};

export function StoryProfileEditor({ mode }: { mode: "start" | "edit" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState<StoryProfileView>(defaultStoryProfile);
  const [loading, setLoading] = useState(true);
  const [introStep, setIntroStep] = useState<number | null | undefined>(mode === "start" ? undefined : null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [idEditing, setIdEditing] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [persistedMediaPaths, setPersistedMediaPaths] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    if (mode === "start") setIntroStep(window.localStorage.getItem(introSeenKey) === "1" ? null : 0);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    const commonDisplayName = profile.display_name?.trim() ?? "";
    const savedDraft = loadStoryProfileDraft();
    const localDraft = {
      ...savedDraft,
      handle: profile.handle,
      displayName: savedDraft.displayName.trim() || commonDisplayName
    };
    setForm(localDraft);
    setTagsInput(localDraft.tags.join("、"));
    getMyStoryProfile(supabase).then((remote) => {
      if (!cancelled && remote) {
        const next = { ...remote, displayName: remote.displayName.trim() || commonDisplayName };
        setForm(next);
        setTagsInput(next.tags.join("、"));
        setPersistedMediaPaths(storyMediaPaths(next));
        saveStoryProfileDraft(next);
        setIntroStep(null);
      }
    }).catch(() => {
      if (!cancelled) setMessage("端末内の下書きを表示しています。");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile.display_name, profile.handle, user.id]);

  const update = <K extends keyof StoryProfileView>(key: K, value: StoryProfileView[K]) => {
    setMessage("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const upload = async (file: File | undefined, kind: "avatar" | "banner" | "portfolio", crop?: StoryImageCrop) => {
    if (!file) return;
    if (kind === "portfolio" && form.portfolio.length >= 6) return;
    setUploading(kind);
    setIsError(false);
    setMessage("写真を見やすい大きさに調整しています…");
    try {
      const result = await uploadStoryImage(supabase, user.id, file, kind, crop);
      setForm((current) => {
        if (kind === "avatar") return { ...current, avatarUrl: result.imageUrl, avatarStoragePath: result.storagePath };
        if (kind === "banner") return { ...current, bannerUrl: result.imageUrl, bannerStoragePath: result.storagePath };
        return { ...current, portfolio: [...current.portfolio, { id: crypto.randomUUID(), source: "upload" as const, storagePath: result.storagePath, imageUrl: result.imageUrl, caption: "" }].slice(0, 6) };
      });
      setMessage("写真を追加しました。保存すると公開内容に反映されます。");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "画像をアップロードできませんでした。");
    } finally {
      setUploading("");
    }
  };

  const requestImage = (file: File | undefined, kind: "avatar" | "banner" | "portfolio") => {
    if (!file) return;
    if (kind === "portfolio") {
      void upload(file, kind);
      return;
    }
    setCropDraft({ file, kind, objectUrl: URL.createObjectURL(file), crop: { x: 50, y: 50 } });
  };

  const closeCrop = () => {
    if (cropDraft) URL.revokeObjectURL(cropDraft.objectUrl);
    setCropDraft(null);
  };

  const confirmCrop = () => {
    if (!cropDraft) return;
    const next = cropDraft;
    URL.revokeObjectURL(next.objectUrl);
    setCropDraft(null);
    void upload(next.file, next.kind, next.crop);
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
      setIsError(false); setMessage("この端末に下書きを保存しました。表示名を入力するとサーバーにも保存できます。");
      return;
    }
    const next = { ...form, isPublished: publish || form.isPublished };
    setConfirmOpen(false); setSaving(publish ? "publish" : "draft"); setMessage("");
    saveStoryProfileDraft(next);
    try {
      const saved = await saveMyStoryProfile(supabase, next);
      setForm(saved); setTagsInput(saved.tags.join("、")); saveStoryProfileDraft(saved); setIsError(false);
      const savedPaths = storyMediaPaths(saved);
      const removedPaths = persistedMediaPaths.filter((path) => !savedPaths.includes(path));
      if (removedPaths.length) void removeStoryImages(supabase, removedPaths).catch(() => undefined);
      setPersistedMediaPaths(savedPaths);
      await refreshProfile();
      setIdEditing(false);
      if (publish) { router.push(safeStoryNextPath(searchParams.get("next")) ?? "/story"); return; }
      setMessage(saved.isPublished ? "変更を保存しました。公開ページにも反映されています。" : "下書きを保存しました。まだ公開されていません。");
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
    <div className="overflow-x-hidden text-[#171821]" style={{ "--story-accent": theme.accent, "--story-soft": theme.soft, "--story-ink": theme.ink } as React.CSSProperties}>
      <div className="mx-auto mb-4 grid w-full max-w-[430px] grid-cols-2 rounded-xl border border-[var(--mikke-line)] bg-white p-1">
        <button type="button" onClick={() => setViewMode("edit")} aria-pressed={viewMode === "edit"} className={`rounded-lg px-3 py-2.5 text-sm font-medium ${viewMode === "edit" ? "bg-[var(--story-accent)] text-white" : "text-black/50"}`}>編集</button>
        <button type="button" onClick={() => setViewMode("preview")} aria-pressed={viewMode === "preview"} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${viewMode === "preview" ? "bg-[var(--story-accent)] text-white" : "text-black/50"}`}><Eye size={16} />見え方</button>
      </div>

      {viewMode === "preview" ? <StoryNameCard story={form} preview /> : <article className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[24px] border border-black/10 bg-white">
        {message ? <p role={isError ? "alert" : "status"} className={`m-3 rounded-2xl px-4 py-3 text-xs font-bold leading-5 ${isError ? "bg-red-50 text-red-700" : "bg-[var(--story-soft)] text-[var(--story-ink)]"}`}>{message}</p> : null}

        <section className="relative">
          <div className="relative h-36 overflow-hidden bg-[var(--story-soft)]">
            {form.bannerUrl ? <img src={form.bannerUrl} alt="バナー" className="h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center text-center text-xs font-bold text-black/35"><span><ImagePlus className="mx-auto mb-2" size={24} />バナーを追加</span></div>}
              <FileButton label="バナー画像を選ぶ" className="absolute bottom-3 right-3 rounded-full bg-white/90" busy={uploading === "banner"} onFile={(file) => requestImage(file, "banner")}><Camera size={14} /> バナー</FileButton>
          </div>
          <div className="relative px-5 pb-6">
            <div className="absolute -top-12 left-5 h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[var(--story-soft)] shadow-sm">
              <div className="grid h-full w-full place-items-center text-xl font-semibold text-[var(--story-ink)]">{initials}</div>
              {form.avatarUrl ? <img src={form.avatarUrl} alt="プロフィール写真" className="absolute inset-0 h-full w-full object-cover" /> : null}
               <FileButton label="プロフィール写真を選ぶ" className="absolute bottom-1 right-1 h-8 w-8 rounded-full border-2 border-white bg-[var(--story-accent)] p-0 text-white" busy={uploading === "avatar"} onFile={(file) => requestImage(file, "avatar")}><Camera size={15} /></FileButton>
            </div>
            <div className="pt-16">
              <InlineInput label="表示名" value={form.displayName} placeholder="名前" onChange={(value) => update("displayName", value)} className="text-2xl font-semibold" />
              <InlineInput label="肩書き" value={form.role} placeholder="肩書き・活動内容（任意）" onChange={(value) => update("role", value)} className="mt-1 text-sm font-medium text-[var(--story-accent)]" />
              <InlineTextarea label="自己紹介" value={form.bio} placeholder="自己紹介（任意）" onChange={(value) => update("bio", value)} className="mt-3 min-h-20 text-sm leading-7 text-black/65" />
              <div className="mt-2 flex items-center gap-1.5 text-black/45"><MapPin size={13} /><InlineInput label="活動エリア" value={form.area} placeholder="活動エリア" onChange={(value) => update("area", value)} className="text-xs" /></div>
              <InlineInput label="ひとこと" value={form.status} placeholder="今いちばん伝えたいひとこと" onChange={(value) => update("status", value)} className="mt-4 rounded-full bg-[var(--story-soft)] px-3 py-2 text-xs font-medium text-[var(--story-ink)]" />
            </div>
          </div>
        </section>

        <EditorSection eyebrow="PHOTOS" title="写真（任意）" note="最大6枚。スマホの大きな写真も自動で軽くして保存します。">
          <div className={form.portfolio.length === 6 ? "grid aspect-[2/1] grid-cols-4 grid-rows-2 gap-2" : "grid grid-cols-3 gap-2"}>
            {form.portfolio.map((item, index) => <div key={item.id} className={`group relative overflow-hidden rounded-xl bg-black/5 ${editorPhotoItemClass(form.portfolio.length, index)}`}><img src={item.imageUrl} alt={item.caption || `写真 ${index + 1}`} className="h-full w-full object-cover" /><button type="button" aria-label="写真を削除" onClick={() => update("portfolio", form.portfolio.filter((candidate) => candidate.id !== item.id))} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><Trash2 size={13} /></button></div>)}
            {form.portfolio.length < 6 ? <FileButton label="写真を追加" className="flex aspect-square min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-black/20 bg-black/[0.02] text-xs font-medium text-black/45 shadow-none" busy={uploading === "portfolio"} onFile={(file) => requestImage(file, "portfolio")}><Plus size={21} /><span className="mt-1">写真を追加</span></FileButton> : null}
          </div>
        </EditorSection>

        <EditorSection eyebrow="KEYWORDS" title="あなたを表すキーワード" note="「、」またはカンマで区切って最大8個。空白を含む言葉も入力できます。">
          <input aria-label="キーワード" value={tagsInput} onChange={(event) => { const value = event.target.value; setTagsInput(value); update("tags", parseStoryTags(value)); }} placeholder="焼き菓子、イベント出店、東京" className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[var(--story-accent)]" />
          {form.tags.length ? <div className="mt-3 flex flex-wrap gap-2">{form.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--story-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--story-ink)]">#{tag}</span>)}</div> : null}
        </EditorSection>

        <EditorSection eyebrow="PICK UP" title="いま伝えたいこと" note="イベント、募集、最近の活動など。空欄なら表示しません。">
          <InlineTextarea label="いま伝えたいこと" value={form.pickupText} placeholder="いま見てほしい活動やお知らせを入力" onChange={(value) => update("pickupText", value)} className="min-h-24 rounded-2xl border-solid border-black/10 px-4 py-3 text-sm leading-7" />
        </EditorSection>

        <EditorSection eyebrow="LINKS" title="SNSとリンク" note="未入力のものは公開画面に表示されません。">
          <div className="space-y-2">{fixedSns.map((item) => <UrlInput key={item.key} label={item.label} value={item.url} onChange={(value) => updateSns(form, update, { ...item, url: value })} />)}</div>
          <div className="mt-3 space-y-2"><NamedUrlInput label={form.websiteLabel} defaultLabel="Webサイト" value={form.websiteUrl} onLabelChange={(value) => update("websiteLabel", value)} onChange={(value) => update("websiteUrl", value)} /><NamedUrlInput label={form.shopLabel} defaultLabel="ショップ" value={form.shopUrl} onLabelChange={(value) => update("shopLabel", value)} onChange={(value) => update("shopUrl", value)} /></div>
          {customLinks.map((item) => <div key={item.key} className="mt-2 grid grid-cols-[1fr_1.4fr_auto] gap-2"><input aria-label="リンク名" value={item.label} onChange={(event) => updateSns(form, update, { ...item, label: event.target.value })} placeholder="リンク名" className="min-w-0 rounded-xl border border-black/10 px-3 py-2 text-sm" /><input aria-label={`${item.label || "追加リンク"} URL`} value={item.url} onChange={(event) => updateSns(form, update, { ...item, url: event.target.value })} placeholder="https://" inputMode="url" className="min-w-0 rounded-xl border border-black/10 px-3 py-2 text-sm" /><button type="button" aria-label="リンクを削除" onClick={() => update("sns", form.sns.filter((candidate) => candidate.key !== item.key))} className="grid h-10 w-10 place-items-center rounded-xl border border-black/10"><Trash2 size={14} /></button></div>)}
          <button type="button" onClick={() => update("sns", [...form.sns, { key: `custom-${crypto.randomUUID()}`, label: "", url: "" }])} className="mt-3 inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-medium"><Plus size={14} />リンクを追加</button>
        </EditorSection>

        <EditorSection eyebrow="COLOR" title="カードの色" note="mikkeの基本5色から選べます。">
          <div className="flex gap-3">{(Object.keys(storyThemes) as StoryThemeKey[]).map((key) => <button key={key} type="button" aria-label={storyThemes[key].label} onClick={() => update("themeKey", key)} className={`grid h-11 w-11 place-items-center rounded-full border-2 ${form.themeKey === key ? "border-black" : "border-transparent"}`}><span className="h-8 w-8 rounded-full" style={{ backgroundColor: storyThemes[key].accent }} /></button>)}</div>
        </EditorSection>

        <EditorSection eyebrow="MIKKE ID" title="あなたのmikke ID" note="すべてのmikkeアプリで共通の、人に教えるためのIDです。ログインには使いません。">
          {idEditing ? (
            <div>
              <label className="flex min-w-0 overflow-hidden rounded-2xl border border-black/10"><span className="bg-black/[0.03] px-3 py-3 text-sm font-extrabold text-black/45">@</span><input aria-label="mikke ID" value={form.handle} onChange={(event) => update("handle", normalizeStoryHandleInput(event.target.value))} className="min-w-0 flex-1 px-3 py-3 text-sm font-bold outline-none" /></label>
               <p className="mt-2 text-xs font-bold leading-5 text-amber-700">英小文字・数字・「-」「_」で3文字以上。入力後、画面下の保存ボタンを押してください。変更すると前のURLは使えなくなります。</p>
              <button type="button" onClick={() => { update("handle", profile.handle); setIdEditing(false); }} className="mt-2 text-xs font-bold text-black/45 underline underline-offset-4">変更をやめる</button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--story-soft)] px-4 py-4">
              <div className="min-w-0"><p className="truncate text-lg font-extrabold text-[var(--story-ink)]">@{form.handle}</p><p className="mt-1 truncate text-[11px] text-black/45">mikke-os.com/story/@{form.handle}</p></div>
              <button type="button" onClick={() => setIdEditing(true)} className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold">IDを変更する</button>
            </div>
          )}
        </EditorSection>

        <footer className="border-t border-black/5 py-5 text-center text-[11px] font-normal text-black/30">STORY by mikke</footer>
      </article>}

      <div className="sticky bottom-[58px] z-20 mt-4 border-t border-black/10 bg-white/95 px-3 py-3 backdrop-blur min-[900px]:bottom-0"><div className="mx-auto flex max-w-[430px] gap-2"><button type="button" disabled={saving !== null || !!uploading} onClick={() => requestSave(false)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-black/10 px-3 py-3 text-sm font-medium disabled:opacity-50"><Save size={16} />{saving === "draft" ? "保存中" : form.isPublished ? "変更を保存" : "下書き保存"}</button><button type="button" disabled={saving !== null || !!uploading} onClick={() => form.isPublished ? void persist(true) : requestSave(true)} className="flex-1 rounded-2xl bg-[var(--story-accent)] px-3 py-3 text-sm font-medium text-white disabled:opacity-50">{saving === "publish" ? "保存中" : form.isPublished ? "保存して確認" : "公開する"}</button></div></div>

      {cropDraft ? <StoryCropDialog draft={cropDraft} onChange={(crop) => setCropDraft((current) => current ? { ...current, crop } : current)} onCancel={closeCrop} onConfirm={confirmCrop} /> : null}

      {confirmOpen ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-[24px] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-extrabold tracking-[0.18em] text-[var(--story-accent)]">PUBLIC STORY</p><h2 className="mt-2 text-xl font-extrabold">この内容を公開しますか？</h2></div><button type="button" aria-label="閉じる" onClick={() => setConfirmOpen(false)}><X size={20} /></button></div><p className="mt-3 text-sm leading-6 text-black/55">URLを知っている人は、ログインせずに写真・自己紹介・リンクを見ることができます。</p><p className="mt-3 break-all rounded-xl bg-black/[0.03] p-3 text-xs font-bold">{getStoryPublicUrl(form.handle)}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-black/10 py-3 text-sm font-bold">戻る</button><button type="button" onClick={() => void persist(true)} className="rounded-xl bg-[var(--story-accent)] py-3 text-sm font-bold text-white">公開する</button></div></div></div> : null}
    </div>
  );
}

function parseStoryTags(value: string) {
  return value.split(/[,、\n]/).map((item) => item.trim().replace(/^#/, "")).filter(Boolean).slice(0, 8);
}

function StoryCropDialog({ draft, onChange, onCancel, onConfirm }: { draft: CropDraft; onChange: (crop: StoryImageCrop) => void; onCancel: () => void; onConfirm: () => void }) {
  const isAvatar = draft.kind === "avatar";
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 sm:items-center"><div role="dialog" aria-modal="true" aria-label="写真の位置を調整" className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-medium tracking-[0.18em] text-[var(--story-accent)]">PHOTO POSITION</p><h2 className="mt-1 text-lg font-semibold">写真の位置を調整</h2><p className="mt-1 text-xs leading-5 text-black/50">見せたい部分が枠の中に入るように調整してください。</p></div><button type="button" aria-label="閉じる" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full border border-black/10"><X size={17} /></button></div><div className={`mx-auto mt-5 overflow-hidden bg-black/5 ${isAvatar ? "h-64 w-64 rounded-full" : "aspect-[3/1] w-full rounded-2xl"}`}><img src={draft.objectUrl} alt="切り抜き位置の確認" className="h-full w-full object-cover" style={{ objectPosition: `${draft.crop.x}% ${draft.crop.y}%` }} /></div><label className="mt-5 block text-xs font-medium">左右の位置<input type="range" min="0" max="100" value={draft.crop.x} onChange={(event) => onChange({ ...draft.crop, x: Number(event.target.value) })} className="mt-2 w-full accent-[var(--story-accent)]" /></label><label className="mt-4 block text-xs font-medium">上下の位置<input type="range" min="0" max="100" value={draft.crop.y} onChange={(event) => onChange({ ...draft.crop, y: Number(event.target.value) })} className="mt-2 w-full accent-[var(--story-accent)]" /></label><div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="rounded-2xl border border-black/10 py-3 text-sm font-medium">選び直す</button><button type="button" onClick={onConfirm} className="rounded-2xl bg-[var(--story-accent)] py-3 text-sm font-medium text-white">この位置で使う</button></div></div></div>;
}

function StoryIntro({ step, onStep, onBegin }: { step: number; onStep: (value: number) => void; onBegin: () => void }) {
  return <section className="mx-auto flex min-h-[680px] max-w-[430px] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white"><header className="flex justify-between px-5 py-4"><p className="text-xs font-semibold tracking-[0.2em] text-[var(--mikke-blue)]">WELCOME TO STORY</p><p className="text-xs font-medium text-black/45">{step + 1} / 2</p></header><div className="flex flex-1 flex-col px-5 pb-5">{step === 0 ? <><IntroCard rich={false} /><div className="mt-7"><p className="text-xs font-medium text-[var(--mikke-blue)]">01　あなたを一枚で伝える</p><h1 className="mt-3 text-[28px] font-semibold leading-[1.15]">会ったあとも、<br />あなたの活動が伝わる。</h1><p className="mt-4 text-sm leading-7 text-black/55">プロフィール、写真、リンク、QRコードを、ひとつの名刺にまとめます。</p></div></> : <><IntroCard rich /><div className="mt-7"><p className="text-xs font-medium text-[var(--mikke-blue)]">02　完成形を見ながら編集</p><h1 className="mt-3 text-[28px] font-semibold leading-[1.15]">入力しながら、<br />見え方を確認できます。</h1><p className="mt-4 text-sm leading-7 text-black/55">編集と見え方を同じ画面で切り替えます。写真や色もすぐに確認できます。</p></div></>}<div className="mt-auto pt-7"><div className="mb-4 flex justify-center gap-2"><span className={`h-1.5 rounded-full ${step === 0 ? "w-7 bg-[var(--mikke-blue)]" : "w-1.5 bg-black/10"}`} /><span className={`h-1.5 rounded-full ${step === 1 ? "w-7 bg-[var(--mikke-blue)]" : "w-1.5 bg-black/10"}`} /></div>{step === 0 ? <button type="button" onClick={() => onStep(1)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--mikke-blue)] py-4 text-sm font-medium text-white">次へ<ChevronRight size={17} /></button> : <div className="grid grid-cols-[52px_1fr] gap-2"><button type="button" aria-label="前へ" onClick={() => onStep(0)} className="grid place-items-center rounded-2xl border border-black/10"><ChevronLeft size={18} /></button><button type="button" onClick={onBegin} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--mikke-blue)] py-4 text-sm font-medium text-white"><Sparkles size={17} />自分のSTORYをつくる</button></div>}</div></div></section>;
}

function IntroCard({ rich }: { rich: boolean }) {
  return <div className="overflow-hidden rounded-[22px] border border-black/10 bg-white"><div className="h-24 bg-[var(--mikke-yellow)]">{rich ? <div className="flex h-full items-center justify-center gap-2"><Palette size={20} /><span className="text-xs font-medium">写真と色を選ぶ</span></div> : null}</div><div className="relative px-5 pb-5"><div className="absolute -top-10 grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-[var(--mikke-pink)] text-xs font-medium">写真</div><div className="pt-12"><p className="text-xs font-medium text-[var(--mikke-blue)]">肩書き・活動内容</p><p className="mt-1 text-2xl font-semibold">表示名</p><p className="mt-3 text-sm leading-6 text-black/45">ここに自己紹介が表示されます。</p>{rich ? <div className="mt-4 grid grid-cols-3 gap-2"><span className="aspect-square rounded-xl bg-[var(--mikke-blue)]" /><span className="aspect-square rounded-xl bg-[var(--mikke-orange)]" /><span className="aspect-square rounded-xl bg-[var(--mikke-green)]" /></div> : <p className="mt-3 text-xs text-black/35">活動エリア</p>}</div></div></div>;
}

function EditorSection({ eyebrow, title, note, children }: { eyebrow: string; title: string; note: string; children: React.ReactNode }) {
  return <section className="border-t border-black/5 px-5 py-6"><p className="text-[10px] font-medium tracking-[0.18em] text-[var(--story-accent)]">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-black/45">{note}</p><div className="mt-4">{children}</div></section>;
}

function InlineInput({ label, value, placeholder, onChange, className }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; className: string }) {
  return <label className="block min-w-0 flex-1"><span className="mb-1 block px-1 text-[10px] font-bold text-black/45">{label}</span><input aria-label={label} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`block w-full min-w-0 rounded-xl border border-black/10 bg-black/[0.025] px-3 py-2 outline-none focus:border-[var(--story-accent)] focus:bg-white ${className}`} /></label>;
}

function InlineTextarea({ label, value, placeholder, onChange, className }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; className: string }) {
  return <label className="block"><span className="mb-1 block px-1 text-[10px] font-bold text-black/45">{label}</span><textarea aria-label={label} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} rows={3} className={`block w-full resize-none rounded-xl border border-black/10 bg-black/[0.025] px-3 py-2 outline-none focus:border-[var(--story-accent)] focus:bg-white ${className}`} /></label>;
}

function FileButton({ label, className, busy, onFile, children }: { label: string; className: string; busy: boolean; onFile: (file?: File) => void; children: React.ReactNode }) {
  return <label aria-label={label} className={`inline-flex cursor-pointer items-center justify-center gap-1.5 border border-black/10 px-3 py-2 text-xs font-bold shadow-sm ${className}`}><input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} />{busy ? "…" : children}</label>;
}

function UrlInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-black/10 px-3 py-2.5"><span className="w-20 shrink-0 text-xs font-medium">{label}</span><input aria-label={`${label} URL`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://" inputMode="url" className="min-w-0 flex-1 text-sm outline-none" /><LinkIcon size={14} className="text-black/25" /></label>;
}

function NamedUrlInput({ label, defaultLabel, value, onLabelChange, onChange }: { label: string; defaultLabel: string; value: string; onLabelChange: (value: string) => void; onChange: (value: string) => void }) {
  return <div className="grid gap-2 rounded-2xl border border-black/10 p-3 min-[390px]:grid-cols-[110px_1fr]"><input aria-label={`${defaultLabel}の表示名`} value={label} onChange={(event) => onLabelChange(event.target.value)} placeholder={defaultLabel} className="min-w-0 rounded-lg bg-black/[0.025] px-3 py-2 text-xs font-medium outline-none" /><label className="flex min-w-0 items-center gap-2"><input aria-label={`${label || defaultLabel} URL`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://" inputMode="url" className="min-w-0 flex-1 px-1 py-2 text-sm outline-none" /><LinkIcon size={14} className="shrink-0 text-black/25" /></label></div>;
}

function editorPhotoItemClass(count: number, index: number) {
  if (count === 6) return index === 0 || index === 5 ? "col-span-2" : "";
  return index === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square";
}

function safeStoryNextPath(value: string | null) {
  if (!value || !value.startsWith("/story/") || value.startsWith("//")) return null;
  return value;
}

function updateSns(form: StoryProfileView, update: <K extends keyof StoryProfileView>(key: K, value: StoryProfileView[K]) => void, item: StoryProfileLink) {
  const exists = form.sns.some((candidate) => candidate.key === item.key);
  update("sns", exists ? form.sns.map((candidate) => candidate.key === item.key ? item : candidate) : [...form.sns, item]);
}

function storyMediaPaths(story: StoryProfileView) {
  return [story.avatarStoragePath, story.bannerStoragePath, ...story.portfolio.map((item) => item.storagePath)].filter(Boolean);
}
