"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Plus, Rocket } from "lucide-react";
import { createHqUpdate, listHqUpdates, updateHqUpdateStatus, type HqUpdate } from "@/lib/hq";

export default function HqUpdatesPage() {
  const [items, setItems] = useState<HqUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await listHqUpdates());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "アップデートを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving("new");
    setError("");
    try {
      await createHqUpdate({
        app_key: String(form.get("app_key") ?? "mikkeos"),
        version_label: String(form.get("version_label") ?? "").trim(),
        title: String(form.get("title") ?? "").trim(),
        summary: String(form.get("summary") ?? "").trim(),
        status: String(form.get("status") ?? "draft") as "draft" | "published"
      });
      formElement.reset();
      setShowForm(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存できませんでした。");
    } finally {
      setSaving("");
    }
  }

  async function togglePublished(item: HqUpdate) {
    setSaving(item.id);
    setError("");
    try {
      await updateHqUpdateStatus(item.id, item.status === "published" ? "draft" : "published");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "公開状態を変更できませんでした。");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.15em] text-[var(--mikke-primary)]">RELEASE NOTES</p>
          <h1 className="mt-2 text-2xl font-bold">アップデート情報</h1>
          <p className="mt-2 text-sm text-[var(--mikke-muted)]">各アプリの更新内容を、利用者向けの言葉で残します。</p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white"><Plus size={16} /> 更新情報を作成</button>
      </header>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {showForm ? (
        <form onSubmit={createItem} className="grid gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:grid-cols-2 md:p-5">
          <label className="text-sm font-bold">アプリ<select name="app_key" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 font-normal"><option value="mikkeos">mikkeOS共通</option><option value="marketnote">MarketNote</option><option value="story">STORY</option><option value="community">Community</option><option value="academy">Academy</option></select></label>
          <label className="text-sm font-bold">バージョン・日付メモ<input name="version_label" placeholder="例：2026年8月版" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-bold md:col-span-2">タイトル<input name="title" required maxLength={160} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-bold md:col-span-2">利用者向けの説明<textarea name="summary" required rows={5} placeholder="何が便利になったかを、専門用語を使わずに書きます。" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-bold">保存方法<select name="status" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 font-normal"><option value="draft">下書きにする</option><option value="published">すぐ公開する</option></select></label>
          <div className="flex items-end"><button disabled={saving === "new"} className="w-full rounded-xl bg-[var(--mikke-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving === "new" ? "保存中…" : "保存する"}</button></div>
        </form>
      ) : null}

      {loading ? <p className="py-12 text-center text-sm text-[var(--mikke-muted)]">読み込んでいます…</p> : null}
      {!loading && items.length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white px-5 py-12 text-center text-sm text-[var(--mikke-muted)]">アップデート情報はまだありません。</p> : null}

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="rounded-full bg-[var(--mikke-primary-soft)] px-2 py-1 text-[var(--mikke-primary)]">{item.app_key}</span>
                  {item.version_label ? <span className="rounded-full bg-[var(--mikke-surface-soft)] px-2 py-1 text-[var(--mikke-muted)]">{item.version_label}</span> : null}
                  <span className="rounded-full bg-[var(--mikke-surface-soft)] px-2 py-1 text-[var(--mikke-muted)]">{item.status === "published" ? "公開中" : "下書き"}</span>
                </div>
                <h2 className="mt-3 text-lg font-bold">{item.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-muted)]">{item.summary}</p>
              </div>
              <Rocket className="shrink-0 text-[var(--mikke-primary)]" />
            </div>
            <button type="button" onClick={() => void togglePublished(item)} disabled={saving === item.id} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-[var(--mikke-primary)] disabled:opacity-50">
              {item.status === "published" ? <><EyeOff size={15} /> 下書きへ戻す</> : <><Eye size={15} /> 公開する</>}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
