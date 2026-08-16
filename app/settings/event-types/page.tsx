"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, Plus, RotateCcw, Save } from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import {
  defaultMarketEventTypeSettings,
  loadMarketEventTypeSettingsForProfile,
  marketEventTypePalette,
  normalizeMarketEventTypeColor,
  saveMarketEventTypeSettingsForProfile,
  type MarketEventTypeItem,
  type MarketEventTypeSettings
} from "@/lib/marketnote-event-types";

function EventTypesContent() {
  const { isGuest, profile } = useAuth();
  const [settings, setSettings] = useState<MarketEventTypeSettings>(defaultMarketEventTypeSettings);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadMarketEventTypeSettingsForProfile(profile)
      .then((nextSettings) => {
        if (active) setSettings(nextSettings);
      })
      .catch(() => {
        if (active) setMessage("予定の種類を読み込めませんでした。通信状態を確認してください。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [profile]);

  const activeItems = useMemo(() => [...settings.items].filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [settings]);
  const hiddenItems = useMemo(() => [...settings.items].filter((item) => !item.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [settings]);

  function updateItem(id: string, patch: Partial<MarketEventTypeItem>) {
    setSettings((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    setMessage("");
  }

  function move(id: string, diff: number) {
    setSettings((current) => {
      const ordered = [...current.items].filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
      const index = ordered.findIndex((item) => item.id === id);
      const target = ordered[index + diff];
      if (index < 0 || !target) return current;
      const source = ordered[index];
      return {
        ...current,
        items: current.items.map((item) => item.id === source.id
          ? { ...item, sortOrder: target.sortOrder }
          : item.id === target.id ? { ...item, sortOrder: source.sortOrder } : item)
      };
    });
  }

  function addItem() {
    const name = newName.trim();
    if (!name) return;
    setSettings((current) => ({
      ...current,
      items: current.items.some((item) => item.name.trim().toLocaleLowerCase("ja-JP") === name.toLocaleLowerCase("ja-JP"))
        ? current.items.map((item) => item.name.trim().toLocaleLowerCase("ja-JP") === name.toLocaleLowerCase("ja-JP")
          ? { ...item, isActive: true }
          : item)
        : [...current.items, {
            id: `event-type-custom-${Date.now()}`,
            name,
            color: marketEventTypePalette[current.items.length % marketEventTypePalette.length],
            isDefault: false,
            isActive: true,
            countsTowardSummary: false,
            sortOrder: Math.max(0, ...current.items.map((item) => item.sortOrder)) + 1
          }]
    }));
    setNewName("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const saved = await saveMarketEventTypeSettingsForProfile(profile, settings);
      setSettings(saved);
      setMessage(isGuest ? "予定の種類をこの端末に保存しました。" : "予定の種類を保存しました。別の端末にも反映されます。");
    } catch (error) {
      setMessage(error instanceof Error && error.message.includes("同じ名前")
        ? error.message
        : "予定の種類を保存できませんでした。通信状態を確認してください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MarketNoteShell title="予定の種類" subtitle="MarketNote" isGuest={isGuest} hideBottomNav>
      <div className="pb-6">
        <header className="mb-4 grid grid-cols-[40px_1fr_40px] items-center">
          <Link href="/marketnote/settings" className="grid h-10 w-10 place-items-center" aria-label="戻る"><ArrowLeft size={21} /></Link>
          <h1 className="text-center text-xl font-semibold">予定の種類</h1><span />
        </header>
        <p className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-4 py-3 text-xs font-bold leading-5 text-[var(--mikke-muted)]">
          予定入力で使う種類を追加・並べ替え・非表示にできます。過去の予定はそのまま残ります。
        </p>
        <section className="mt-3 space-y-2.5 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3.5">
          {loading ? <p className="px-2 py-6 text-center text-sm font-bold text-[var(--mikke-muted)]">予定の種類を読み込んでいます…</p> : activeItems.map((item, index) => (
            <div key={item.id} className="rounded-xl border border-[var(--mikke-line)] bg-white px-2.5 py-2 shadow-[0_2px_8px_rgba(45,33,22,0.025)]">
              <div className="grid grid-cols-[1fr_30px_30px_30px] items-center gap-1.5">
                <input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} className="min-w-0 bg-transparent text-sm font-extrabold outline-none" />
                <button type="button" onClick={() => move(item.id, -1)} disabled={index === 0} className="grid h-8 w-8 place-items-center rounded-full text-[var(--mikke-muted)] disabled:opacity-25" aria-label="上へ"><ArrowUp size={15} strokeWidth={1.7} /></button>
                <button type="button" onClick={() => move(item.id, 1)} disabled={index === activeItems.length - 1} className="grid h-8 w-8 place-items-center rounded-full text-[var(--mikke-muted)] disabled:opacity-25" aria-label="下へ"><ArrowDown size={15} strokeWidth={1.7} /></button>
                <button type="button" onClick={() => updateItem(item.id, { isActive: false })} className="grid h-8 w-8 place-items-center rounded-full text-[var(--mikke-muted)]" aria-label="非表示"><Eye size={15} strokeWidth={1.7} /></button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 pb-0.5" aria-label={`${item.name}の色`}>
                {marketEventTypePalette.map((color) => (
                  <button key={color} type="button" onClick={() => updateItem(item.id, { color })} aria-label={`${item.name}を${color}にする`} className={`h-7 w-7 rounded-full border-2 ${normalizeMarketEventTypeColor(item.color) === color ? "border-[var(--mikke-text)]" : "border-white"}`} style={{ backgroundColor: color }} />
                ))}
                <label className="ml-auto flex min-h-9 items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-2 text-[10px] font-bold text-[var(--mikke-muted)]">
                  自由色
                  <input type="color" value={normalizeMarketEventTypeColor(item.color)} onChange={(event) => updateItem(item.id, { color: event.target.value })} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" aria-label={`${item.name}の自由カラー`} />
                </label>
              </div>
              <label className="mt-2 flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg bg-[var(--mikke-surface-soft)] px-3 py-2">
                <span>
                  <span className="block text-xs font-extrabold">実績数に加える</span>
                  <span className="mt-0.5 block text-[10px] font-bold text-[var(--mikke-muted)]">キャンセル以外の記録を実績集計の対象にします</span>
                </span>
                <input
                  type="checkbox"
                  checked={item.countsTowardSummary}
                  onChange={(event) => updateItem(item.id, { countsTowardSummary: event.target.checked })}
                  className="h-5 w-5 shrink-0 accent-[var(--mikke-orange)]"
                  aria-label={`${item.name}を実績数に加える`}
                />
              </label>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_42px] gap-2 rounded-xl border border-dashed border-[var(--mikke-line)] p-2">
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="予定の種類を追加" className="h-10 min-w-0 rounded-lg bg-[var(--mikke-surface-soft)] px-3 text-sm font-bold outline-none" />
            <button type="button" onClick={addItem} className="grid h-10 place-items-center rounded-lg bg-[var(--mikke-orange)] text-white" aria-label="追加"><Plus size={18} /></button>
          </div>
        </section>
        {hiddenItems.length ? <section className="mt-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3.5"><h2 className="mb-2 text-sm font-extrabold">非表示の項目</h2>{hiddenItems.map((item) => <button key={item.id} type="button" onClick={() => updateItem(item.id, { isActive: true })} className="mt-2 flex w-full items-center justify-between rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-2 text-left"><span className="text-xs font-bold text-[var(--mikke-muted)]">{item.name}</span><span className="text-xs font-extrabold text-[var(--mikke-orange)]">戻す</span></button>)}</section> : null}
        {message ? <p className="mt-3 rounded-xl bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold">{message}</p> : null}
        <div className="mt-4 space-y-2.5">
          <button type="button" onClick={() => void save()} disabled={loading || saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--mikke-orange)] text-base font-extrabold text-white disabled:opacity-50"><Save size={17} />{saving ? "保存中…" : "保存"}</button>
          <button type="button" onClick={() => setSettings(defaultMarketEventTypeSettings)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--mikke-orange)] text-sm font-extrabold text-[var(--mikke-orange)]"><RotateCcw size={16} />初期項目に戻す</button>
        </div>
      </div>
    </MarketNoteShell>
  );
}

export default function EventTypesPage() {
  return <AuthGate allowGuest><EventTypesContent /></AuthGate>;
}
