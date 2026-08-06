"use client";

import { ArrowLeft, Eye, Save } from "lucide-react";
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

export function StoryProfileEditor({ mode }: { mode: "start" | "edit" }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [form, setForm] = useState<StoryProfileView>(defaultStoryProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");

  useEffect(() => {
    let cancelled = false;
    setForm(loadStoryProfileDraft());
    getMyStoryProfile(supabase)
      .then((remote) => {
        if (!cancelled && remote) {
          setForm(remote);
          saveStoryProfileDraft(remote);
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
    setConfirmed(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (publish: boolean) => {
    const validationError = getStoryProfileValidationError(form, publish);
    if (validationError) {
      setMessage(validationError);
      setMessageTone("error");
      return;
    }
    if (publish && !confirmed) {
      setMessage("公開内容の確認にチェックを入れてください。");
      setMessageTone("error");
      return;
    }

    if (!publish && (!form.displayName.trim() || !form.handle)) {
      saveStoryProfileDraft({ ...form, isPublished: false });
      setMessage("端末内に未公開の下書きを保存しました。サーバー保存には表示名とURL名が必要です。");
      setMessageTone("info");
      return;
    }

    const nextForm = { ...form, isPublished: publish };
    setSaving(publish ? "publish" : "draft");
    setMessage("");
    if (!publish) saveStoryProfileDraft(nextForm);

    try {
      const saved = await saveMyStoryProfile(supabase, profile, nextForm);
      saveStoryProfileDraft(saved);
      setForm(saved);
      setMessageTone("info");
      if (publish) {
        router.push(`/story/${saved.handle}`);
        return;
      }
      setMessage("下書きをサーバーと端末内に保存しました。");
    } catch (error) {
      saveStoryProfileDraft({ ...form, isPublished: false });
      setMessageTone("error");
      setMessage(`${getStorySaveErrorMessage(error)} 端末内には未公開の下書きとして保存しました。${publish ? "公開画面には移動していません。" : ""}`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <main className="min-h-screen bg-white" />;

  return (
    <main className="min-h-screen bg-white pb-28 text-[var(--mikke-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--mikke-line)] bg-white/95 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <Link href="/story" aria-label="STORYへ戻る" className="grid h-10 w-10 place-items-center rounded-lg"><ArrowLeft size={20} /></Link>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-bold uppercase tracking-[0.18em] text-[var(--mikke-primary)]">{mode === "start" ? "STORY START" : "EDIT STORY"}</p>
            <p className="mt-0.5 text-[10px] font-bold text-[var(--mikke-muted)]">{form.isPublished ? "公開中" : "未公開・下書き"}</p>
          </div>
          {form.handle ? <Link href={form.isPublished ? `/story/${form.handle}` : "/story"} aria-label="表示を確認" className="grid h-10 w-10 place-items-center rounded-lg"><Eye size={19} /></Link> : <span className="h-10 w-10" />}
        </div>
      </header>

      <div className="mx-auto w-full max-w-xl px-3 pt-5 sm:px-4">
        {message ? <p role={messageTone === "error" ? "alert" : "status"} className={`mb-4 rounded-xl px-4 py-3 text-xs font-bold leading-5 ${messageTone === "error" ? "bg-red-50 text-red-700" : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"}`}>{message}</p> : null}

        <section className="space-y-4">
          <SectionTitle title="公開名刺の基本情報" helper="表示名とURL名は公開時に必須です。肩書きか自己紹介のどちらかも入力してください。" />
          <TextInput label="表示名 *" value={form.displayName} onChange={(value) => update("displayName", value)} autoComplete="name" />
          <TextInput label="URL名 *" value={form.handle} onChange={(value) => update("handle", normalizeStoryHandle(value))} prefix="app.mikke-os.com/story/" autoCapitalize="none" />
          <TextInput label="肩書き" value={form.role} onChange={(value) => update("role", value)} />
          <TextArea label="自己紹介" value={form.bio} onChange={(value) => update("bio", value)} rows={5} />
          <TextInput label="活動エリア" value={form.area} onChange={(value) => update("area", value)} />
          <TextInput label="ひとこと" value={form.status} onChange={(value) => update("status", value)} />
          <TextInput label="タグ（カンマ区切り）" value={form.tags.join(", ")} onChange={(value) => update("tags", value.split(/[,、]/).map((item) => item.trim()).filter(Boolean))} />
        </section>

        <section className="mt-8 space-y-4 border-t border-[var(--mikke-line-soft)] pt-6">
          <SectionTitle title="画像とリンク" helper="画像登録は初回リリースではURL指定です。未入力の場合は表示名のイニシャルを表示します。" />
          <TextInput label="プロフィール画像URL" value={form.avatarUrl} onChange={(value) => update("avatarUrl", value)} inputMode="url" />
          <TextInput label="Web Site" value={form.websiteUrl} onChange={(value) => update("websiteUrl", value)} inputMode="url" />
          <TextInput label="Shop" value={form.shopUrl} onChange={(value) => update("shopUrl", value)} inputMode="url" />
          <TextInput label="Instagram" value={form.sns[0]?.url ?? ""} onChange={(value) => update("sns", [{ key: "instagram", label: "Instagram", url: value }])} inputMode="url" />
          <TextArea label="PICK UP メッセージ" value={form.pickupText} onChange={(value) => update("pickupText", value)} rows={4} />
        </section>

        <section className="mt-8 space-y-3 border-t border-[var(--mikke-line-soft)] pt-6">
          <SectionTitle title="公開確認" helper="公開すると、URLを知っている人はログインせずにプロフィールを閲覧できます。活動実績はまだ公開されません。" />
          <div className="rounded-xl border border-[var(--mikke-line)] p-4">
            <p className="text-xs font-bold text-[var(--mikke-muted)]">公開URL</p>
            <p className="mt-1 break-all text-sm font-bold">{form.handle ? getStoryPublicUrl(form.handle) : "app.mikke-os.com/story/あなたのURL名"}</p>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-[var(--mikke-line)] p-4 text-sm leading-6">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--mikke-primary)]" />
            <span>表示名、URL名、自己紹介・リンクを確認し、この内容を公開します。</span>
          </label>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--mikke-line)] bg-white/95 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          <button type="button" disabled={saving !== null} onClick={() => save(false)} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm font-bold disabled:opacity-50"><Save size={16} />{saving === "draft" ? "保存中" : "下書き保存"}</button>
          <button type="button" disabled={saving !== null} onClick={() => save(true)} className="min-w-0 flex-1 rounded-xl bg-[var(--mikke-primary)] px-3 py-3 text-sm font-bold text-white disabled:opacity-50">{saving === "publish" ? "公開中" : "公開する"}</button>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ title, helper }: { title: string; helper: string }) {
  return <div><h1 className="text-xl font-bold">{title}</h1><p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{helper}</p></div>;
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  inputMode?: "text" | "url";
  autoComplete?: string;
  autoCapitalize?: string;
};

function TextInput({ label, value, onChange, prefix, ...inputProps }: InputProps) {
  return <label className="block min-w-0"><span className="text-xs font-bold text-[var(--mikke-muted)]">{label}</span><span className="mt-1 flex min-w-0 overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-white">{prefix ? <span className="hidden shrink-0 bg-[var(--mikke-surface-soft)] px-3 py-3 text-xs font-bold text-[var(--mikke-muted)] min-[390px]:block">{prefix}</span> : null}<input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 px-3 py-3 text-sm outline-none" {...inputProps} /></span>{prefix ? <span className="mt-1 block break-all text-[10px] text-[var(--mikke-muted)] min-[390px]:hidden">{prefix}{value}</span> : null}</label>;
}

function TextArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return <label className="block"><span className="text-xs font-bold text-[var(--mikke-muted)]">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="mt-1 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm leading-6 outline-none" /></label>;
}
