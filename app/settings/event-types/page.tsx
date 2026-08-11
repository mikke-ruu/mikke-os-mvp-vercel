"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, EyeOff, Plus, RotateCcw, Save } from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import {
  defaultMarketEventTypeSettings,
  loadMarketEventTypeSettings,
  saveMarketEventTypeSettings,
  type MarketEventTypeItem,
  type MarketEventTypeSettings
} from "@/lib/marketnote-event-types";

function EventTypesContent() {
  const { isGuest } = useAuth();
  const [settings, setSettings] = useState<MarketEventTypeSettings>(defaultMarketEventTypeSettings);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => setSettings(loadMarketEventTypeSettings()), []);

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
      items: [...current.items, {
        id: `event-type-custom-${Date.now()}`,
        name,
        isDefault: false,
        isActive: true,
        sortOrder: Math.max(0, ...current.items.map((item) => item.sortOrder)) + 1
      }]
    }));
    setNewName("");
  }

  function save() {
    saveMarketEventTypeSettings(settings);
    setMessage("予定の種類を保存しました。");
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
        <section className="mt-3 space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3">
          {activeItems.map((item, index) => (
            <div key={item.id} className="grid grid-cols-[1fr_36px_36px_36px] items-center gap-1 rounded-xl bg-[var(--mikke-surface-soft)] p-2">
              <input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} className="h-9 min-w-0 bg-transparent px-2 text-sm font-bold outline-none" />
              <button type="button" onClick={() => move(item.id, -1)} disabled={index === 0} className="grid h-9 place-items-center disabled:opacity-25" aria-label="上へ"><ArrowUp size={16} /></button>
              <button type="button" onClick={() => move(item.id, 1)} disabled={index === activeItems.length - 1} className="grid h-9 place-items-center disabled:opacity-25" aria-label="下へ"><ArrowDown size={16} /></button>
              <button type="button" onClick={() => updateItem(item.id, { isActive: false })} className="grid h-9 place-items-center text-[var(--mikke-muted)]" aria-label="非表示"><EyeOff size={16} /></button>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_42px] gap-2 rounded-xl border border-dashed border-[var(--mikke-line)] p-2">
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="予定の種類を追加" className="h-10 min-w-0 rounded-lg bg-[var(--mikke-surface-soft)] px-3 text-sm font-bold outline-none" />
            <button type="button" onClick={addItem} className="grid h-10 place-items-center rounded-lg bg-[var(--mikke-orange)] text-white" aria-label="追加"><Plus size={18} /></button>
          </div>
        </section>
        {hiddenItems.length ? <section className="mt-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3"><h2 className="text-sm font-bold">非表示</h2>{hiddenItems.map((item) => <button key={item.id} type="button" onClick={() => updateItem(item.id, { isActive: true })} className="mt-2 flex w-full justify-between rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-2 text-xs font-bold"><span>{item.name}</span><span className="text-[var(--mikke-orange)]">戻す</span></button>)}</section> : null}
        {message ? <p className="mt-3 rounded-xl bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold">{message}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSettings(defaultMarketEventTypeSettings)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--mikke-orange)] text-sm font-bold text-[var(--mikke-orange)]"><RotateCcw size={16} />初期値</button>
          <button type="button" onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--mikke-orange)] text-sm font-bold text-white"><Save size={16} />保存</button>
        </div>
      </div>
    </MarketNoteShell>
  );
}

export default function EventTypesPage() {
  return <AuthGate allowGuest><EventTypesContent /></AuthGate>;
}
