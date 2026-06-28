"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ClipboardList, EyeOff, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import {
  defaultCheckTemplate,
  dueRuleOptions,
  getDueRuleLabel,
  loadCheckTemplate,
  saveCheckTemplate
} from "@/lib/check-templates";
import type { CheckDueRule, CheckTemplate, CheckTemplateItem } from "@/lib/check-templates";

function CheckTemplatesContent() {
  const [template, setTemplate] = useState<CheckTemplate>(defaultCheckTemplate);
  const [newTitle, setNewTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTemplate(loadCheckTemplate());
  }, []);

  const activeItems = useMemo(() => {
    return [...template.items]
      .filter((item) => item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [template.items]);

  const hiddenItems = useMemo(() => {
    return [...template.items]
      .filter((item) => !item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [template.items]);

  function updateItem(id: string, patch: Partial<CheckTemplateItem>) {
    setTemplate((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item)
    }));
    setMessage("");
  }

  function hideItem(id: string) {
    updateItem(id, { isActive: false });
  }

  function restoreItem(id: string) {
    updateItem(id, { isActive: true });
  }

  function addItem() {
    const title = newTitle.trim();
    if (!title) return;

    setTemplate((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: `custom-${Date.now()}`,
          title,
          isDefault: false,
          sortOrder: current.items.length + 1,
          dueRule: "event_day",
          isActive: true
        }
      ]
    }));
    setNewTitle("");
    setMessage("");
  }

  function resetTemplate() {
    setTemplate(defaultCheckTemplate);
    setMessage("初期テンプレートに戻しました。保存すると反映されます。");
  }

  function save() {
    saveCheckTemplate(template);
    setMessage("チェックテンプレートを保存しました。新規出店予定のチェック項目に反映されます。");
  }

  return (
    <AppShell title="チェックテンプレート" hideHeader hideBottomNav>
      <div className="pb-5">
        <header className="mb-4 grid grid-cols-[40px_1fr_40px] items-center pt-1">
          <Link href="/settings" className="grid h-9 w-9 place-items-center rounded-full text-[#1f1b18]" aria-label="戻る">
            <ArrowLeft size={22} strokeWidth={1.7} />
          </Link>
          <h1 className="text-center text-xl font-semibold tracking-normal text-[#1f1b18]">チェックテンプレート</h1>
          <span />
        </header>

        <p className="mb-3 rounded-2xl border border-[#eee9e4] bg-white px-4 py-3 text-xs font-bold leading-5 text-[#6f6862] shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
          出店準備・当日確認など、よく使うチェック項目を管理します。保存した内容は新規出店予定の初期チェック項目に使われます。
        </p>

        <section className="rounded-[18px] border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
          <div className="border-b border-[#f1ece7] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-[#eaf8ee] px-2 py-0.5 text-[10px] font-extrabold text-[#16833b]">使用中</span>
                <input
                  value={template.name}
                  onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 w-full bg-transparent text-lg font-extrabold tracking-normal text-[#1f1b18] outline-none"
                />
                <p className="mt-1 text-xs font-bold text-[#8a817a]">項目 {activeItems.length}件</p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff6f1] text-[#ff5a1f]">
                <ClipboardList size={20} strokeWidth={1.8} />
              </span>
            </div>
          </div>

          <div className="space-y-2.5 p-3.5">
            {activeItems.map((item) => (
              <TemplateItemRow key={item.id} item={item} onChange={updateItem} onHide={hideItem} />
            ))}

            <div className="grid grid-cols-[1fr_40px] gap-2 rounded-xl border border-dashed border-[#f3d0be] bg-[#fffdfb] p-2">
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="項目を追加"
                className="h-10 min-w-0 rounded-lg bg-white px-3 text-sm font-bold text-[#1f1b18] outline-none placeholder:text-[#b4aaa2]"
              />
              <button type="button" onClick={addItem} className="grid h-10 w-10 place-items-center rounded-lg bg-[#ff5a1f] text-white" aria-label="項目を追加">
                <Plus size={18} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </section>

        {hiddenItems.length > 0 ? (
          <section className="mt-3 rounded-2xl border border-[#eee9e4] bg-white p-3.5 shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
            <h2 className="mb-2 text-sm font-extrabold text-[#1f1b18]">非表示の項目</h2>
            <div className="space-y-2">
              {hiddenItems.map((item) => (
                <button key={item.id} type="button" onClick={() => restoreItem(item.id)} className="flex w-full items-center justify-between rounded-xl bg-[#fbfaf8] px-3 py-2 text-left">
                  <span className="text-xs font-bold text-[#6f6862]">{item.title}</span>
                  <span className="text-xs font-extrabold text-[#f46a14]">戻す</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-3 rounded-2xl border border-[#eee9e4] bg-white p-3.5 shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
          <h2 className="text-sm font-extrabold text-[#1f1b18]">今後の接続</h2>
          <div className="mt-2 space-y-2 text-xs font-bold leading-5 text-[#6f6862]">
            <p>追加ページ: 保存したテンプレートを初期チェック項目として表示します。</p>
            <p>詳細ページ: 作成済みチェック項目をサマリーで完了切り替えします。</p>
            <p>ホーム: 期限ルールをもとに「やること（期限順）」へ接続します。</p>
          </div>
        </section>

        {message ? <p className="mt-3 rounded-xl bg-[#fff0e9] px-4 py-3 text-sm font-bold text-[#8f3d22]">{message}</p> : null}

        <div className="mt-4 space-y-2.5">
          <button type="button" onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] px-4 py-3 text-base font-extrabold text-white shadow-[0_8px_18px_rgba(255,90,31,0.16)]">
            <Save size={17} strokeWidth={1.8} />
            保存
          </button>
          <button type="button" onClick={resetTemplate} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#ff8a5c] bg-white px-4 py-3 text-sm font-extrabold text-[#ff5a1f]">
            <RotateCcw size={16} strokeWidth={1.8} />
            初期テンプレートに戻す
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function TemplateItemRow({
  item,
  onChange,
  onHide
}: {
  item: CheckTemplateItem;
  onChange: (id: string, patch: Partial<CheckTemplateItem>) => void;
  onHide: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[#eee9e4] bg-white px-2.5 py-2 shadow-[0_2px_8px_rgba(45,33,22,0.025)]">
      <div className="grid grid-cols-[22px_1fr_32px] items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full border border-[#5fb878] bg-[#eaf8ee] text-[#16833b]">
          <Check size={12} strokeWidth={2} />
        </span>
        <input
          value={item.title}
          onChange={(event) => onChange(item.id, { title: event.target.value })}
          className="min-w-0 bg-transparent text-sm font-extrabold text-[#1f1b18] outline-none"
        />
        <button type="button" onClick={() => onHide(item.id)} className="grid h-8 w-8 place-items-center rounded-full text-[#8a817a]" aria-label="非表示">
          {item.isDefault ? <EyeOff size={16} strokeWidth={1.7} /> : <Trash2 size={16} strokeWidth={1.7} />}
        </button>
      </div>
      <label className="mt-2 grid grid-cols-[76px_1fr] items-center gap-2 text-xs font-bold text-[#6f6862]">
        <span>期限ルール</span>
        <span className="relative">
          <select
            value={item.dueRule}
            onChange={(event) => onChange(item.id, { dueRule: event.target.value as CheckDueRule })}
            className="h-8 w-full appearance-none rounded-lg border border-[#e7e1dc] bg-[#fbfaf8] px-2 pr-7 text-xs font-bold text-[#3b3530] outline-none"
          >
            {dueRuleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#f46a14]" />
        </span>
      </label>
      <p className="mt-1 text-[11px] font-bold text-[#b8aaa0]">{getDueRuleLabel(item.dueRule)}</p>
    </div>
  );
}

export default function CheckTemplatesPage() {
  return (
    <AuthGate>
      <CheckTemplatesContent />
    </AuthGate>
  );
}
