"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, EyeOff, Plus, RotateCcw, Save, Star, WalletCards } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import {
  defaultPaymentMethodSettings,
  getPaymentMethods,
  loadPaymentMethodSettings,
  savePaymentMethodSettings
} from "@/lib/payment-methods";
import type { PaymentMethodItem, PaymentMethodSettings } from "@/lib/payment-methods";

const renameWarning = [
  "支払い方法名を変更すると、今後の入力候補に反映されます。",
  "",
  "過去のデータや集計との見え方が変わる可能性があるため、意味が変わる場合は新しい支払い方法を追加してください。",
  "",
  "変更してもよろしいですか？"
].join("\n");

function PaymentMethodsContent() {
  const [settings, setSettings] = useState<PaymentMethodSettings>(defaultPaymentMethodSettings);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [confirmedRenameIds, setConfirmedRenameIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSettings(loadPaymentMethodSettings());
  }, []);

  const activeItems = useMemo(() => getPaymentMethods(settings), [settings]);
  const hiddenItems = useMemo(() => {
    return [...settings.items]
      .filter((item) => !item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [settings.items]);
  const favoriteCount = activeItems.filter((item) => item.isFavorite).length;

  function updateItem(id: string, patch: Partial<PaymentMethodItem>) {
    setSettings((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item)
    }));
    setMessage("");
  }

  function renameItem(item: PaymentMethodItem, nextName: string) {
    if (nextName !== item.name && !confirmedRenameIds.has(item.id)) {
      const ok = window.confirm(renameWarning);
      if (!ok) return;
      setConfirmedRenameIds((current) => new Set(current).add(item.id));
    }

    updateItem(item.id, { name: nextName });
  }

  function moveItem(id: string, direction: "up" | "down") {
    setSettings((current) => {
      const ordered = getPaymentMethods(current);
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

  function addItem() {
    const name = newName.trim();
    if (!name) return;

    const exists = settings.items.some((item) => item.name.trim() === name);
    if (exists) {
      setMessage("同じ名前の支払い方法がすでにあります。");
      return;
    }

    setSettings((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: `payment-custom-${Date.now()}`,
          name,
          isDefault: false,
          isActive: true,
          isFavorite: false,
          sortOrder: current.items.length + 1
        }
      ]
    }));
    setNewName("");
    setMessage("");
  }

  function hideItem(id: string) {
    updateItem(id, { isActive: false });
  }

  function restoreItem(id: string) {
    updateItem(id, { isActive: true });
  }

  function resetMethods() {
    setSettings(defaultPaymentMethodSettings);
    setConfirmedRenameIds(new Set());
    setMessage("初期支払い方法に戻しました。保存すると候補画面に反映されます。");
  }

  function save() {
    const normalizedItems = settings.items.map((item) => ({ ...item, name: item.name.trim() }));
    const names = normalizedItems.map((item) => item.name).filter(Boolean);
    const uniqueNames = new Set(names);

    if (names.length !== settings.items.length) {
      setMessage("支払い方法名は空にできません。");
      return;
    }

    if (uniqueNames.size !== names.length) {
      setMessage("同じ名前の支払い方法があります。名前を分けてください。");
      return;
    }

    const nextSettings = { ...settings, items: normalizedItems };
    setSettings(nextSettings);
    savePaymentMethodSettings(nextSettings);
    setMessage("支払い方法を保存しました。出店予定追加・詳細の支払い方法候補に反映されます。");
  }

  return (
    <AppShell title="支払い方法" hideHeader hideBottomNav>
      <div className="pb-5">
        <header className="mb-4 grid grid-cols-[40px_1fr_40px] items-center pt-1">
          <Link href="/settings" className="grid h-9 w-9 place-items-center rounded-full text-[#1f1b18]" aria-label="戻る">
            <ArrowLeft size={22} strokeWidth={1.7} />
          </Link>
          <h1 className="text-center text-xl font-semibold tracking-normal text-[#1f1b18]">支払い方法</h1>
          <span />
        </header>

        <p className="mb-3 rounded-2xl border border-[#eee9e4] bg-white px-4 py-3 text-xs font-bold leading-5 text-[#6f6862] shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
          出店予定や収支で使う支払い方法を管理します。使わない支払い方法は削除せず、非表示にします。
        </p>

        <section className="rounded-[18px] border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
          <div className="border-b border-[#f1ece7] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-[#fff6f1] px-2 py-0.5 text-[10px] font-extrabold text-[#f46a14]">支払い方法</span>
                <h2 className="mt-2 text-lg font-extrabold tracking-normal text-[#1f1b18]">支払い方法</h2>
                <p className="mt-1 text-xs font-bold text-[#8a817a]">よく使う {favoriteCount}件 / 表示中 {activeItems.length}件</p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff6f1] text-[#ff5a1f]">
                <WalletCards size={20} strokeWidth={1.8} />
              </span>
            </div>
          </div>

          <div className="space-y-2.5 p-3.5">
            {activeItems.map((item, index) => (
              <PaymentMethodRow
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
                placeholder="支払い方法を追加"
                className="h-10 min-w-0 rounded-lg bg-white px-3 text-sm font-bold text-[#1f1b18] outline-none placeholder:text-[#b4aaa2]"
              />
              <button type="button" onClick={addItem} className="grid h-10 w-10 place-items-center rounded-lg bg-[#ff5a1f] text-white" aria-label="支払い方法を追加">
                <Plus size={18} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </section>

        {hiddenItems.length > 0 ? (
          <section className="mt-3 rounded-2xl border border-[#eee9e4] bg-white p-3.5 shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
            <h2 className="mb-2 text-sm font-extrabold text-[#1f1b18]">非表示の支払い方法</h2>
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
            <p>完全削除はせず、使わなくなった支払い方法は非表示にします。</p>
            <p>名前を変えると候補や集計の見え方が変わる可能性があります。意味が変わる場合は新しい支払い方法を追加します。</p>
            <p>保存した並び順は、出店予定追加・詳細の支払い方法候補に反映されます。</p>
          </div>
        </section>

        {message ? <p className="mt-3 rounded-xl bg-[#fff0e9] px-4 py-3 text-sm font-bold text-[#8f3d22]">{message}</p> : null}

        <div className="mt-4 space-y-2.5">
          <button type="button" onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] px-4 py-3 text-base font-extrabold text-white shadow-[0_8px_18px_rgba(255,90,31,0.16)]">
            <Save size={17} strokeWidth={1.8} />
            保存
          </button>
          <button type="button" onClick={resetMethods} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#ff8a5c] bg-white px-4 py-3 text-sm font-extrabold text-[#ff5a1f]">
            <RotateCcw size={16} strokeWidth={1.8} />
            初期支払い方法に戻す
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function PaymentMethodRow({
  item,
  canMoveUp,
  canMoveDown,
  onRename,
  onChange,
  onHide,
  onMove
}: {
  item: PaymentMethodItem;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: (item: PaymentMethodItem, nextName: string) => void;
  onChange: (id: string, patch: Partial<PaymentMethodItem>) => void;
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
      <p className="mt-1 text-[11px] font-bold text-[#b8aaa0]">{item.isFavorite ? "よく使う支払い方法" : "通常の支払い方法"}</p>
    </div>
  );
}

export default function PaymentMethodsPage() {
  return (
    <AuthGate allowGuest>
      <PaymentMethodsContent />
    </AuthGate>
  );
}

