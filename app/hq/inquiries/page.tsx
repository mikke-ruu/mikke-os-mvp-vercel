"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Plus, RefreshCw } from "lucide-react";
import {
  createHqInquiry,
  listHqInquiries,
  updateHqInquiry,
  type HqInquiry,
  type HqInquiryPriority,
  type HqInquiryStatus
} from "@/lib/hq";

const statusLabels: Record<HqInquiryStatus, string> = {
  new: "新着",
  in_progress: "対応中",
  waiting: "回答待ち",
  resolved: "完了"
};

const priorityLabels: Record<HqInquiryPriority, string> = {
  low: "低",
  normal: "通常",
  high: "高",
  urgent: "至急"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function HqInquiriesPage() {
  const [items, setItems] = useState<HqInquiry[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const nextItems = await listHqInquiries();
      setItems(nextItems);
      setNotes(Object.fromEntries(nextItems.map((item) => [item.id, item.internal_note])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "お問い合わせを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving("new");
    setError("");
    const form = new FormData(formElement);
    try {
      await createHqInquiry({
        subject: String(form.get("subject") ?? "").trim(),
        body: String(form.get("body") ?? "").trim(),
        contact_name: String(form.get("contact_name") ?? "").trim(),
        contact_email: String(form.get("contact_email") ?? "").trim(),
        app_key: String(form.get("app_key") ?? "mikkeos"),
        category: String(form.get("category") ?? "other"),
        priority: String(form.get("priority") ?? "normal") as HqInquiryPriority
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

  async function saveItem(id: string, patch: Parameters<typeof updateHqInquiry>[1]) {
    setSaving(id);
    setError("");
    try {
      await updateHqInquiry(id, patch);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "更新できませんでした。");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.15em] text-[var(--mikke-primary)]">SUPPORT</p>
          <h1 className="mt-2 text-2xl font-bold">お問い合わせ</h1>
          <p className="mt-2 text-sm text-[var(--mikke-muted)]">新着から完了まで、対応状況を一か所で管理します。</p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white">
          <Plus size={16} /> 問い合わせを登録
        </button>
      </header>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {showForm ? (
        <form onSubmit={createInquiry} className="grid gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:grid-cols-2 md:p-5">
          <label className="text-sm font-bold md:col-span-2">件名<input name="subject" required maxLength={160} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-bold">お名前<input name="contact_name" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-bold">メールアドレス<input name="contact_email" type="email" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 font-normal" /></label>
          <label className="text-sm font-bold">アプリ<select name="app_key" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 font-normal"><option value="mikkeos">mikkeOS</option><option value="marketnote">MarketNote</option><option value="story">STORY</option><option value="community">Community</option><option value="academy">Academy</option></select></label>
          <label className="text-sm font-bold">優先度<select name="priority" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 font-normal"><option value="normal">通常</option><option value="high">高</option><option value="urgent">至急</option><option value="low">低</option></select></label>
          <input type="hidden" name="category" value="other" />
          <label className="text-sm font-bold md:col-span-2">内容<textarea name="body" rows={4} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 font-normal" /></label>
          <div className="md:col-span-2"><button disabled={saving === "new"} className="rounded-xl bg-[var(--mikke-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving === "new" ? "保存中…" : "登録する"}</button></div>
        </form>
      ) : null}

      {loading ? <p className="py-12 text-center text-sm text-[var(--mikke-muted)]">読み込んでいます…</p> : null}
      {!loading && items.length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white px-5 py-12 text-center text-sm text-[var(--mikke-muted)]">お問い合わせはまだありません。</p> : null}

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className={`rounded-full px-2 py-1 ${item.priority === "urgent" ? "bg-red-100 text-red-700" : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"}`}>{priorityLabels[item.priority]}</span>
                  <span className="rounded-full bg-[var(--mikke-primary-soft)] px-2 py-1 text-[var(--mikke-primary)]">{statusLabels[item.status]}</span>
                  <span className="rounded-full bg-[var(--mikke-surface-soft)] px-2 py-1 text-[var(--mikke-muted)]">{item.app_key}</span>
                </div>
                <h2 className="mt-3 text-lg font-bold">{item.subject}</h2>
                <p className="mt-1 text-xs text-[var(--mikke-muted)]">{item.contact_name || "名前未入力"} ・ {item.contact_email || "メール未入力"} ・ {formatDate(item.received_at)}</p>
              </div>
              {item.status === "resolved" ? <CheckCircle2 className="text-green-600" /> : null}
            </div>
            {item.body ? <p className="mt-4 whitespace-pre-wrap rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-sm leading-6">{item.body}</p> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
              <label className="text-xs font-bold text-[var(--mikke-muted)]">対応状況<select value={item.status} onChange={(event) => void saveItem(item.id, { status: event.target.value as HqInquiryStatus })} disabled={saving === item.id} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm text-[var(--mikke-text)]"><option value="new">新着</option><option value="in_progress">対応中</option><option value="waiting">回答待ち</option><option value="resolved">完了</option></select></label>
              <label className="text-xs font-bold text-[var(--mikke-muted)]">本部メモ<textarea value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-2.5 text-sm font-normal text-[var(--mikke-text)]" /></label>
              <button type="button" onClick={() => void saveItem(item.id, { internal_note: notes[item.id] ?? "" })} disabled={saving === item.id} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-[var(--mikke-primary)] disabled:opacity-50">{saving === item.id ? <RefreshCw size={15} className="animate-spin" /> : null}メモ保存</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
