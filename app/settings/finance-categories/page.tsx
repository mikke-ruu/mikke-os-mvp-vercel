"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, EyeOff, Plus, RotateCcw, Save, Star, Tag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import {
  defaultFinanceCategorySettings,
  getFinanceCategories,
  loadFinanceCategorySettings,
  saveFinanceCategorySettings
} from "@/lib/finance-categories";
import type { FinanceCategory, FinanceCategorySettings, FinanceCategoryType } from "@/lib/finance-categories";

const renameWarning = [
  "このカテゴリはすでに収支データで使用されています。",
  "",
  "カテゴリ名を変更すると、過去にこのカテゴリで登録した収支データの表示名も変更されます。",
  "",
  "意味が変わる場合は、名前を変更せず、新しいカテゴリを追加してください。",
  "",
  "変更してもよろしいですか？"
].join("\n");

function FinanceCategoriesContent() {
  const [settings, setSettings] = useState<FinanceCategorySettings>(defaultFinanceCategorySettings);
  const [activeType, setActiveType] = useState<FinanceCategoryType>("revenue");
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [confirmedRenameIds, setConfirmedRenameIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSettings(loadFinanceCategorySettings());
  }, []);

  const activeItems = useMemo(() => getFinanceCategories(settings, activeType), [settings, activeType]);
  const hiddenItems = useMemo(() => {
    return [...settings.items]
      .filter((item) => item.type === activeType && !item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [settings, activeType]);

  const favoriteCount = activeItems.filter((item) => item.isFavorite).length;
  const title = activeType === "revenue" ? "売上カテゴリ" : "経費カテゴリ";

  function updateItem(id: string, patch: Partial<FinanceCategory>) {
    setSettings((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item)
    }));
    setMessage("");
  }

  function renameItem(item: FinanceCategory, nextName: string) {
    if (nextName !== item.name && !confirmedRenameIds.has(item.id)) {
      const ok = window.confirm(renameWarning);
      if (!ok) return;
      setConfirmedRenameIds((current) => new Set(current).add(item.id));
    }

    updateItem(item.id, { name: nextName });
  }

  function moveItem(id: string, direction: "up" | "down") {
    setSettings((current) => {
      const ordered = [...current.items]
        .filter((item) => item.type === activeType && item.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const index = ordered.findIndex((item) => item.id === id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return current;

      const currentItem = ordered[index];
      const targetItem = ordered[targetIndex];

      return {
        ...current,
        items: current.items.map((item) => {
          if (item.id === currentItem.id) return { ...item, sortOrder: targetItem.sortOrder };
          if (item.id === targetItem.id) return { ...item, sortOrder: currentItem.sortOrder };
          return item;
        })
      };
    });
    setMessage("");
  }

  function hideItem(id: string) {
    updateItem(id, { isActive: false });
  }

  function restoreItem(id: string) {
    updateItem(id, { isActive: true });
  }

  function addItem() {
    const name = newName.trim();
    if (!name) return;

    const typeItems = settings.items.filter((item) => item.type === activeType);
    setSettings((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: `${activeType}-custom-${Date.now()}`,
          type: activeType,
          name,
          isDefault: false,
          isActive: true,
          isFavorite: false,
          sortOrder: typeItems.length + 1
        }
      ]
    }));
    setNewName("");
    setMessage("");
  }

  function resetCategories() {
    setSettings(defaultFinanceCategorySettings);
    setConfirmedRenameIds(new Set());
    setMessage("初期カテゴリに戻しました。保存すると収支ページに反映されます。");
  }

  function save() {
    saveFinanceCategorySettings(settings);
    setMessage("収支カテゴリを保存しました。収支ページのカテゴリ候補に反映されます。");
  }

  return (
    <AppShell title="収支カテゴリ" hideHeader hideBottomNav>
      <div className="pb-5">
        <header className="mb-4 grid grid-cols-[40px_1fr_40px] items-center pt-1">
          <Link href="/settings" className="grid h-9 w-9 place-items-center rounded-full text-[#1f1b18]" aria-label="戻る">
            <ArrowLeft size={22} strokeWidth={1.7} />
          </Link>
          <h1 className="text-center text-xl font-semibold tracking-normal text-[#1f1b18]">収支カテゴリ</h1>
          <span />
        </header>

        <p className="mb-3 rounded-2xl border border-[#eee9e4] bg-white px-4 py-3 text-xs font-bold leading-5 text-[#6f6862] shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
          収支ページで使う売上カテゴリと経費カテゴリを管理します。よく使うカテゴリは目印として表示し、候補の順番は矢印で並び替えます。
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-[#eee9e4] bg-white p-1.5 shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
          <CategoryTab label="売上カテゴリ" active={activeType === "revenue"} onClick={() => setActiveType("revenue")} />
          <CategoryTab label="経費カテゴリ" active={activeType === "expense"} onClick={() => setActiveType("expense")} />
        </div>

        <section className="rounded-[18px] border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
          <div className="border-b border-[#f1ece7] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-[#fff6f1] px-2 py-0.5 text-[10px] font-extrabold text-[#f46a14]">{title}</span>
                <h2 className="mt-2 text-lg font-extrabold tracking-normal text-[#1f1b18]">{title}</h2>
                <p className="mt-1 text-xs font-bold text-[#8a817a]">よく使う {favoriteCount}件 / 表示中 {activeItems.length}件</p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff6f1] text-[#ff5a1f]">
                <Tag size={20} strokeWidth={1.8} />
              </span>
            </div>
          </div>

          <div className="space-y-2.5 p-3.5">
            {activeItems.map((item, index) => (
              <CategoryRow
                key={item.id}
                item={item}
                canMoveUp={index > 0}
                canMoveDown={index < activeItems.length - 1}
                onRename={renameItem}
                onChange={updateItem}
                onHide={hideItem}
                onMove={moveItem}
              />
            ))}

            <div className="grid grid-cols-[1fr_40px] gap-2 rounded-xl border border-dashed border-[#f3d0be] bg-[#fffdfb] p-2">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="カテゴリを追加"
                className="h-10 min-w-0 rounded-lg bg-white px-3 text-sm font-bold text-[#1f1b18] outline-none placeholder:text-[#b4aaa2]"
              />
              <button type="button" onClick={addItem} className="grid h-10 w-10 place-items-center rounded-lg bg-[#ff5a1f] text-white" aria-label="カテゴリを追加">
                <Plus size={18} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </section>

        {hiddenItems.length > 0 ? (
          <section className="mt-3 rounded-2xl border border-[#eee9e4] bg-white p-3.5 shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
            <h2 className="mb-2 text-sm font-extrabold text-[#1f1b18]">非表示カテゴリ</h2>
            <div className="space-y-2">
              {hiddenItems.map((item) => (
                <button key={item.id} type="button" onClick={() => restoreItem(item.id)} className="flex w-full items-center justify-between rounded-xl bg-[#fbfaf8] px-3 py-2 text-left">
                  <span className="text-xs font-bold text-[#6f6862]">{item.name}</span>
                  <span className="text-xs font-extrabold text-[#f46a14]">戻す</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-3 rounded-2xl border border-[#eee9e4] bg-white p-3.5 shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
          <h2 className="text-sm font-extrabold text-[#1f1b18]">運用メモ</h2>
          <div className="mt-2 space-y-1.5 text-xs font-bold leading-5 text-[#6f6862]">
            <p>カテゴリは完全削除せず、使わなくなったものは非表示にします。</p>
            <p>カテゴリ名を変えるときは、意味が変わらないか確認してください。意味が変わる場合は新しいカテゴリを追加します。</p>
            <p>保存した並び順は、収支ページのカテゴリ候補にも反映されます。</p>
          </div>
        </section>

        {message ? <p className="mt-3 rounded-xl bg-[#fff0e9] px-4 py-3 text-sm font-bold text-[#8f3d22]">{message}</p> : null}

        <div className="mt-4 space-y-2.5">
          <button type="button" onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] px-4 py-3 text-base font-extrabold text-white shadow-[0_8px_18px_rgba(255,90,31,0.16)]">
            <Save size={17} strokeWidth={1.8} />
            保存
          </button>
          <button type="button" onClick={resetCategories} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#ff8a5c] bg-white px-4 py-3 text-sm font-extrabold text-[#ff5a1f]">
            <RotateCcw size={16} strokeWidth={1.8} />
            初期カテゴリに戻す
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function CategoryTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-xl text-sm font-extrabold transition ${active ? "bg-[#ff5a1f] text-white shadow-[0_6px_14px_rgba(255,90,31,0.14)]" : "text-[#6f6862]"}`}
    >
      {label}
    </button>
  );
}

function CategoryRow({
  item,
  canMoveUp,
  canMoveDown,
  onRename,
  onChange,
  onHide,
  onMove
}: {
  item: FinanceCategory;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: (item: FinanceCategory, nextName: string) => void;
  onChange: (id: string, patch: Partial<FinanceCategory>) => void;
  onHide: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  return (
    <div className="rounded-xl border border-[#eee9e4] bg-white px-2.5 py-2 shadow-[0_2px_8px_rgba(45,33,22,0.025)]">
      <div className="grid grid-cols-[1fr_30px_30px_32px_30px] items-center gap-1.5">
        <input
          value={item.name}
          onChange={(event) => onRename(item, event.target.value)}
          className="min-w-0 bg-transparent text-sm font-extrabold text-[#1f1b18] outline-none"
        />
        <button
          type="button"
          onClick={() => onMove(item.id, "up")}
          disabled={!canMoveUp}
          className="grid h-8 w-8 place-items-center rounded-full text-[#8a817a] disabled:text-[#ddd5cf]"
          aria-label="上へ"
        >
          <ArrowUp size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={() => onMove(item.id, "down")}
          disabled={!canMoveDown}
          className="grid h-8 w-8 place-items-center rounded-full text-[#8a817a] disabled:text-[#ddd5cf]"
          aria-label="下へ"
        >
          <ArrowDown size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={() => onChange(item.id, { isFavorite: !item.isFavorite })}
          className={`grid h-8 w-8 place-items-center rounded-full ${item.isFavorite ? "bg-[#fff6f1] text-[#ff5a1f]" : "text-[#b8aaa0]"}`}
          aria-label="よく使う"
        >
          <Star size={15} strokeWidth={1.7} fill={item.isFavorite ? "currentColor" : "none"} />
        </button>
        <button type="button" onClick={() => onHide(item.id)} className="grid h-8 w-8 place-items-center rounded-full text-[#8a817a]" aria-label="非表示">
          <EyeOff size={15} strokeWidth={1.7} />
        </button>
      </div>
      <p className="mt-1 text-[11px] font-bold text-[#b8aaa0]">{item.isFavorite ? "よく使うカテゴリ" : "通常カテゴリ"}</p>
    </div>
  );
}

export default function FinanceCategoriesPage() {
  return (
    <AuthGate>
      <FinanceCategoriesContent />
    </AuthGate>
  );
}
