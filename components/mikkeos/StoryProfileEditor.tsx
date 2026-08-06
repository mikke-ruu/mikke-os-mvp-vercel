"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe2,
  Instagram,
  Link as LinkIcon,
  MapPin,
  Pencil,
  Plus,
  Save,
  Sparkles,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { getMyStoryProfile, getStorySaveErrorMessage, saveMyStoryProfile } from "@/lib/mikkeos/story-profile-db";
import {
  defaultStoryProfile,
  getStoryProfileValidationError,
  getStoryPublicUrl,
  loadStoryProfileDraft,
  normalizeStoryHandle,
  saveStoryProfileDraft,
  type StoryProfileView
} from "@/lib/mikkeos/story-profile-store";
import { supabase } from "@/lib/supabase/client";

const storyIntroSeenKey = "mikkeos.story.intro.seen.v1";

export function StoryProfileEditor({ mode }: { mode: "start" | "edit" }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [form, setForm] = useState<StoryProfileView>(defaultStoryProfile);
  const [loading, setLoading] = useState(true);
  const [introStep, setIntroStep] = useState<number | null | undefined>(mode === "start" ? undefined : null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  useEffect(() => {
    if (mode === "start") {
      setIntroStep(window.localStorage.getItem(storyIntroSeenKey) === "1" ? null : 0);
    }
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    setForm(loadStoryProfileDraft());
    getMyStoryProfile(supabase)
      .then((remote) => {
        if (!cancelled && remote) {
          setForm(remote);
          saveStoryProfileDraft(remote);
          setIntroStep(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("サーバー上のプロフィールを読み込めなかったため、端末内の下書きを表示しています。");
          setMessageTone("info");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile.id]);

  const update = <K extends keyof StoryProfileView>(key: K, value: StoryProfileView[K]) => {
    setMessage("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const beginEditing = () => {
    window.localStorage.setItem(storyIntroSeenKey, "1");
    setIntroStep(null);
  };

  const requestSave = (publish: boolean) => {
    const validationError = getStoryProfileValidationError(form, publish);
    if (validationError) {
      setMessage(validationError);
      setMessageTone("error");
      return;
    }

    if (publish) {
      setPublishConfirmOpen(true);
      return;
    }

    void persist(false);
  };

  const persist = async (publish: boolean) => {
    if (!publish && (!form.displayName.trim() || !form.handle)) {
      saveStoryProfileDraft({ ...form, isPublished: false });
      setMessage("この端末に下書きを保存しました。表示名とURL名を決めると、サーバーにも保存できます。");
      setMessageTone("info");
      return;
    }

    const nextForm = { ...form, isPublished: publish };
    setPublishConfirmOpen(false);
    setSaving(publish ? "publish" : "draft");
    setMessage("");
    saveStoryProfileDraft({ ...nextForm, isPublished: false });

    try {
      const saved = await saveMyStoryProfile(supabase, nextForm);
      saveStoryProfileDraft(saved);
      setForm(saved);
      setMessageTone("info");
      if (publish) {
        router.push(`/story/${saved.handle}`);
        return;
      }
      setMessage("下書きを保存しました。まだ公開されていません。");
    } catch (error) {
      saveStoryProfileDraft({ ...form, isPublished: false });
      setMessageTone("error");
      setMessage(`${getStorySaveErrorMessage(error)} この端末には下書きを残しています。${publish ? "公開画面には移動していません。" : ""}`);
    } finally {
      setSaving(null);
    }
  };

  if (loading || introStep === undefined) return <main className="min-h-screen bg-white" />;

  if (introStep !== null) {
    return <StoryIntro step={introStep} onStep={setIntroStep} onBegin={beginEditing} />;
  }

  const displayName = form.displayName.trim() || "あなたの名前";
  const initials = form.displayName.trim() ? form.displayName.trim().slice(0, 2) : "ST";
  const instagramUrl = form.sns.find((item) => item.key === "instagram")?.url ?? "";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--mikke-surface-soft)] pb-28 text-[var(--mikke-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--mikke-line)] bg-white/95 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-2">
          <Link href="/story" aria-label="STORYへ戻る" className="grid h-10 w-10 place-items-center rounded-lg"><ArrowLeft size={20} /></Link>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-bold uppercase tracking-[0.18em] text-[var(--mikke-primary)]">{mode === "start" ? "CREATE STORY" : "EDIT STORY"}</p>
            <p className="mt-0.5 text-[10px] font-bold text-[var(--mikke-muted)]">{form.isPublished ? "公開中・タップして編集" : "未公開・タップして編集"}</p>
          </div>
          {form.handle && form.isPublished ? <Link href={`/story/${form.handle}`} aria-label="公開表示を確認" className="grid h-10 w-10 place-items-center rounded-lg"><Eye size={19} /></Link> : <span className="h-10 w-10" />}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[430px] bg-white sm:my-6 sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-[var(--mikke-line)]">
        {message ? <p role={messageTone === "error" ? "alert" : "status"} className={`mx-3 mt-3 rounded-xl px-4 py-3 text-xs font-bold leading-5 ${messageTone === "error" ? "bg-red-50 text-red-700" : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"}`}>{message}</p> : null}

        <section className="px-4 pb-6 pt-6 text-center">
          <div className="group relative mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-[var(--mikke-pink)] text-xl font-extrabold">
            <span>{initials}</span>
            {form.avatarUrl ? <img src={form.avatarUrl} alt={`${displayName}のプロフィール画像`} className="absolute inset-0 h-full w-full object-cover" /> : null}
            <button type="button" onClick={() => setOptionalOpen(true)} className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1.5 text-[10px] font-bold text-white"><Pencil size={10} />写真</button>
          </div>

          <InlineInput
            label="肩書き"
            value={form.role}
            placeholder="肩書き・活動内容を追加"
            onChange={(value) => update("role", value)}
            className="mx-auto mt-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-[var(--mikke-primary)]"
          />
          <InlineInput
            label="表示名"
            value={form.displayName}
            placeholder="あなたの名前"
            onChange={(value) => update("displayName", value)}
            className="mt-1 text-center text-2xl font-bold leading-tight"
            autoComplete="name"
          />
          <InlineTextarea
            label="自己紹介"
            value={form.bio}
            placeholder="どんな人なのか、短く紹介してみましょう"
            onChange={(value) => update("bio", value)}
            className="mx-auto mt-3 min-h-20 text-center text-sm leading-7 text-[var(--mikke-muted)]"
          />

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[var(--mikke-muted)]">
            <MapPin size={13} className="shrink-0" />
            <InlineInput label="活動エリア" value={form.area} placeholder="活動エリア" onChange={(value) => update("area", value)} className="max-w-48 text-center text-xs" />
          </div>

          <InlineInput
            label="ひとこと"
            value={form.status}
            placeholder="いま伝えたいひとこと"
            onChange={(value) => update("status", value)}
            className="mx-auto mt-3 w-fit max-w-full rounded-full bg-[var(--mikke-pink)] px-3 py-1.5 text-center text-xs font-bold"
          />
          <InlineInput
            label="タグ"
            value={form.tags.join("、")}
            placeholder="#好きなこと　#活動"
            onChange={(value) => update("tags", value.split(/[,、]/).map((item) => item.trim().replace(/^#/, "")).filter(Boolean))}
            className="mx-auto mt-3 text-center text-xs"
          />
        </section>

        <section className="border-t border-[var(--mikke-line-soft)] px-4 py-5">
          <div className="flex items-center gap-2">
            <Globe2 size={16} className="text-[var(--mikke-primary)]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-primary)]">YOUR STORY URL</p>
          </div>
          <label className="mt-3 flex min-w-0 items-center overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-white">
            <span className="hidden shrink-0 bg-[var(--mikke-surface-soft)] px-3 py-3 text-[11px] font-bold text-[var(--mikke-muted)] min-[390px]:block">app.mikke-os.com/story/</span>
            <input aria-label="URL名" value={form.handle} onChange={(event) => update("handle", normalizeStoryHandle(event.target.value))} placeholder="your-name" autoCapitalize="none" className="min-w-0 flex-1 px-3 py-3 text-sm font-bold outline-none" />
          </label>
          <p className="mt-1 break-all text-[10px] text-[var(--mikke-muted)] min-[390px]:hidden">app.mikke-os.com/story/{form.handle || "your-name"}</p>
        </section>

        <section className="border-t border-[var(--mikke-line-soft)] px-4 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-primary)]">PICK UP</p>
          <InlineTextarea label="PICK UPメッセージ" value={form.pickupText} placeholder="今いちばん伝えたいことを追加" onChange={(value) => update("pickupText", value)} className="mt-2 min-h-16 text-sm leading-7" />
        </section>

        <section className="border-t border-[var(--mikke-line-soft)] px-4 py-5">
          <button type="button" onClick={() => setOptionalOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
            <span><span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-primary)]">LINKS</span><span className="mt-1 block text-xs text-[var(--mikke-muted)]">InstagramやWebサイトは後からでも追加できます</span></span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--mikke-line)]"><Plus size={16} /></span>
          </button>

          {optionalOpen ? (
            <div className="mt-4 space-y-3">
              <LabeledInput icon={<Pencil size={15} />} label="プロフィール画像URL" value={form.avatarUrl} onChange={(value) => update("avatarUrl", value)} />
              <LabeledInput icon={<Instagram size={15} />} label="Instagram" value={instagramUrl} onChange={(value) => update("sns", [{ key: "instagram", label: "Instagram", url: value }])} />
              <LabeledInput icon={<Globe2 size={15} />} label="Web Site" value={form.websiteUrl} onChange={(value) => update("websiteUrl", value)} />
              <LabeledInput icon={<LinkIcon size={15} />} label="Shop" value={form.shopUrl} onChange={(value) => update("shopUrl", value)} />
            </div>
          ) : null}
        </section>

        <footer className="border-t border-[var(--mikke-line-soft)] py-4 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">Story by mikke</footer>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--mikke-line)] bg-white/95 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[430px] gap-2">
          <button type="button" disabled={saving !== null} onClick={() => requestSave(false)} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm font-bold disabled:opacity-50"><Save size={16} />{saving === "draft" ? "保存中" : "下書き保存"}</button>
          <button type="button" disabled={saving !== null} onClick={() => requestSave(true)} className="min-w-0 flex-1 rounded-xl bg-[var(--mikke-primary)] px-3 py-3 text-sm font-bold text-white disabled:opacity-50">{saving === "publish" ? "公開中" : "公開する"}</button>
        </div>
      </div>

      {publishConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 py-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="story-publish-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-primary)]">PUBLIC STORY</p><h2 id="story-publish-title" className="mt-2 text-xl font-bold">この内容を公開しますか？</h2></div><button type="button" aria-label="閉じる" onClick={() => setPublishConfirmOpen(false)} className="grid h-9 w-9 place-items-center"><X size={19} /></button></div>
            <p className="mt-3 text-sm leading-6 text-[var(--mikke-muted)]">公開後は、URLを知っている人がログインせずに閲覧できます。あとからいつでも編集できます。</p>
            <p className="mt-3 break-all rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-3 text-xs font-bold">{getStoryPublicUrl(form.handle)}</p>
            <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setPublishConfirmOpen(false)} className="rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm font-bold">戻る</button><button type="button" onClick={() => void persist(true)} className="rounded-xl bg-[var(--mikke-primary)] px-3 py-3 text-sm font-bold text-white">公開する</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StoryIntro({ step, onStep, onBegin }: { step: number; onStep: (step: number) => void; onBegin: () => void }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--mikke-surface-soft)] px-3 py-5 text-[var(--mikke-text)] sm:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-[var(--mikke-line)] bg-white sm:min-h-[720px]">
        <header className="flex items-center justify-between px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mikke-primary)]">WELCOME TO STORY</p><p className="text-xs font-bold text-[var(--mikke-muted)]">{step + 1} / 2</p></header>

        <div className="flex flex-1 flex-col px-5 pb-5">
          {step === 0 ? (
            <>
              <div className="rounded-2xl border border-[var(--mikke-line)] bg-white px-4 pb-5 pt-6 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted)]">表示イメージ</p>
                <div className="mx-auto mt-4 grid h-20 w-20 place-items-center rounded-full bg-[var(--mikke-pink)] text-lg font-extrabold">山田</div>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--mikke-primary)]">焼き菓子と小さなお店</p>
                <p className="mt-1 text-2xl font-bold">山田 はな</p>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-[var(--mikke-muted)]">季節のお菓子をつくっています。イベント出店とオンラインで活動中です。</p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--mikke-muted)]"><MapPin size={12} />東京・神奈川</p>
              </div>
              <div className="mt-6"><p className="text-xs font-bold text-[var(--mikke-primary)]">01　あなたを一枚で伝える</p><h1 className="mt-2 text-2xl font-bold leading-tight">会ったあとも、<br />あなたの活動が伝わる名刺。</h1><p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">プロフィール、リンク、QRコードをひとつにまとめて共有できます。</p></div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted)]">編集イメージ</p>
                <div className="mt-4 flex items-center gap-3"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--mikke-pink)] font-extrabold">ST</div><div className="min-w-0 flex-1 space-y-2"><div className="flex items-center justify-between rounded-lg border border-dashed border-[var(--mikke-primary)] px-3 py-2 text-xs text-[var(--mikke-muted)]"><span>肩書きをタップ</span><Pencil size={13} /></div><div className="flex items-center justify-between rounded-lg border border-dashed border-[var(--mikke-primary)] px-3 py-2 font-bold"><span>名前をタップ</span><Pencil size={13} /></div></div></div>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-[var(--mikke-primary)] px-3 py-3 text-sm text-[var(--mikke-muted)]"><span>自己紹介をタップして入力</span><Pencil size={13} /></div>
                <div className="mt-3 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-center text-sm font-bold text-white">完成形を見ながら編集</div>
              </div>
              <div className="mt-6"><p className="text-xs font-bold text-[var(--mikke-primary)]">02　見たまま編集</p><h1 className="mt-2 text-2xl font-bold leading-tight">長い入力フォームは、<br />もうありません。</h1><p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">Instagramのプロフィールのように、変えたい場所を直接タップ。必須なのは名前・URLと、肩書きか自己紹介だけです。</p></div>
            </>
          )}

          <div className="mt-auto pt-6">
            <div className="mb-4 flex justify-center gap-2"><span className={`h-1.5 rounded-full ${step === 0 ? "w-7 bg-[var(--mikke-primary)]" : "w-1.5 bg-[var(--mikke-line)]"}`} /><span className={`h-1.5 rounded-full ${step === 1 ? "w-7 bg-[var(--mikke-primary)]" : "w-1.5 bg-[var(--mikke-line)]"}`} /></div>
            {step === 0 ? <button type="button" onClick={() => onStep(1)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-3.5 text-sm font-bold text-white">次へ<ChevronRight size={17} /></button> : <div className="grid grid-cols-[auto_1fr] gap-2"><button type="button" aria-label="前へ" onClick={() => onStep(0)} className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--mikke-line)]"><ChevronLeft size={18} /></button><button type="button" onClick={onBegin} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-3.5 text-sm font-bold text-white"><Sparkles size={17} />STORYをつくる</button></div>}
          </div>
        </div>
      </section>
    </main>
  );
}

function InlineInput({ label, value, placeholder, onChange, className, autoComplete }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; className: string; autoComplete?: string }) {
  return <input aria-label={label} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className={`block w-full min-w-0 border border-dashed border-transparent bg-transparent px-2 py-1 outline-none transition placeholder:text-[var(--mikke-muted-light)] hover:border-[var(--mikke-line)] focus:border-[var(--mikke-primary)] ${className}`} />;
}

function InlineTextarea({ label, value, placeholder, onChange, className }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; className: string }) {
  return <textarea aria-label={label} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} rows={3} className={`block w-full resize-none rounded-lg border border-dashed border-transparent bg-transparent px-2 py-1 outline-none transition placeholder:text-[var(--mikke-muted-light)] hover:border-[var(--mikke-line)] focus:border-[var(--mikke-primary)] ${className}`} />;
}

function LabeledInput({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--mikke-line)] px-3 py-2.5"><span className="text-[var(--mikke-muted)]">{icon}</span><span className="sr-only">{label}</span><input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} inputMode="url" className="min-w-0 flex-1 text-sm outline-none" /></label>;
}
