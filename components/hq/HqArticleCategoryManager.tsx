"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Plus, Save } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { getHqStaffMembership } from "@/lib/hq";
import { createJournalCategory, listJournalCategories, normalizeJournalSlug, updateJournalCategory, type JournalCategory } from "@/lib/hq-articles";

const inputClass = "w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm";

export function HqArticleCategoryManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<JournalCategory[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const [membership, categories] = await Promise.all([getHqStaffMembership(user.id), listJournalCategories()]);
      setCanWrite(Boolean(membership && ["owner", "admin", "editor"].includes(membership.role)));
      setItems(categories);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "カテゴリーを読み込めませんでした。"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [user.id]);

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canWrite) return;
    const form = event.currentTarget; const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim(); const slug = normalizeJournalSlug(String(data.get("slug") ?? "")); const color = String(data.get("color") ?? "#3f4eb5");
    if (!name || !slug) { setError("カテゴリー名と英数字のURL名を入力してください。"); return; }
    setSaving("new"); setError("");
    try { await createJournalCategory({ name, slug, color }); form.reset(); setMessage("カテゴリーを追加しました。"); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "カテゴリーを追加できませんでした。"); }
    finally { setSaving(""); }
  }

  async function saveItem(item: JournalCategory) {
    setSaving(item.id); setError("");
    try { await updateJournalCategory(item.id, { name: item.name.trim(), slug: normalizeJournalSlug(item.slug), color: item.color, sort_order: item.sort_order, is_active: item.is_active }); setMessage("カテゴリーを保存しました。"); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "カテゴリーを保存できませんでした。"); }
    finally { setSaving(""); }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction; if (!canWrite || target < 0 || target >= items.length) return;
    setSaving("order"); setError("");
    try { await Promise.all([updateJournalCategory(items[index].id, { sort_order: items[target].sort_order }), updateJournalCategory(items[target].id, { sort_order: items[index].sort_order })]); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "表示順を変更できませんでした。"); }
    finally { setSaving(""); }
  }

  return <div className="mx-auto max-w-5xl space-y-5"><header><Link href="/hq/articles" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"><ArrowLeft size={14} />記事一覧</Link><h1 className="mt-2 text-2xl font-black">カテゴリー管理</h1><p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">カテゴリーは自由に追加できます。使用中のカテゴリーは削除せず、非表示にして記事とのつながりを残します。</p></header>
    {!canWrite && !loading ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">分析担当はカテゴリーを閲覧できますが、変更できません。</p> : null}
    {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}{message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
    {canWrite ? <form onSubmit={createItem} className="grid gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_90px_auto]"><input name="name" required maxLength={80} placeholder="カテゴリー名" className={inputClass} /><input name="slug" required placeholder="url-slug" className={inputClass} /><input name="color" type="color" defaultValue="#3f4eb5" className="h-10 w-full rounded-lg border border-[var(--mikke-line)] bg-white p-1" /><button disabled={saving === "new"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={15} />追加</button></form> : null}
    {loading ? <p className="py-12 text-center text-sm text-[var(--mikke-muted)]">読み込んでいます…</p> : <div className="space-y-3">{items.map((item, index) => <article key={item.id} className="grid gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_80px_auto]"><input aria-label="カテゴリー名" value={item.name} disabled={!canWrite} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))} className={inputClass} /><input aria-label="URL名" value={item.slug} disabled={!canWrite} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, slug: event.target.value } : entry))} className={inputClass} /><input aria-label="色" type="color" value={item.color} disabled={!canWrite} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, color: event.target.value } : entry))} className="h-10 w-full rounded-lg border border-[var(--mikke-line)] bg-white p-1" /><div className="flex flex-wrap justify-end gap-1"><button type="button" disabled={!canWrite || index === 0 || saving === "order"} onClick={() => void move(index, -1)} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30" aria-label="上へ"><ArrowUp size={14} /></button><button type="button" disabled={!canWrite || index === items.length - 1 || saving === "order"} onClick={() => void move(index, 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30" aria-label="下へ"><ArrowDown size={14} /></button><button type="button" disabled={!canWrite} onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_active: !entry.is_active } : entry))} className={`grid h-9 w-9 place-items-center rounded-lg border ${item.is_active ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-400"}`} aria-label={item.is_active ? "非表示にする" : "表示を戻す"}>{item.is_active ? <Eye size={14} /> : <EyeOff size={14} />}</button><button type="button" disabled={!canWrite || saving === item.id} onClick={() => void saveItem(item)} className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--mikke-primary)] text-white disabled:opacity-40" aria-label="保存"><Save size={14} /></button></div><p className="text-xs text-[var(--mikke-muted)] md:col-span-4">{item.is_active ? "公開記事のカテゴリー候補に表示中" : "非表示中（既存記事との関連は保持）"}</p></article>)}</div>}
  </div>;
}
