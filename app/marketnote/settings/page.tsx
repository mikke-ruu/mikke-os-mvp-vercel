"use client";

import Link from "next/link";
import { BellRing, CalendarRange, ChevronRight, ClipboardCheck, Tag, type LucideIcon } from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";

type SettingsItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const settingsItems: SettingsItem[] = [
  {
    title: "予定の種類",
    description: "出店・営業日・制作などの種類を設定します。",
    href: "/settings/event-types",
    icon: CalendarRange
  },
  {
    title: "チェック項目",
    description: "予定で使うタスクと期限を設定します。",
    href: "/settings/check-templates",
    icon: ClipboardCheck
  },
  {
    title: "収支項目",
    description: "売上と経費の項目を設定します。",
    href: "/settings/finance-categories",
    icon: Tag
  },
  {
    title: "通知・リマインダー",
    description: "やることの表示と期限を設定します。",
    href: "/settings/reminders",
    icon: BellRing
  }
];

function MarketNoteSettingsContent() {
  const { isGuest } = useAuth();

  return (
    <MarketNoteShell title="設定" subtitle="MarketNote" isGuest={isGuest}>
      <section>
        <h1 className="text-xl font-bold tracking-normal text-[var(--mikke-text)]">MarketNoteの設定</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--mikke-muted)]">
          予定・タスク・収支に使う項目を、自分の仕事に合わせて整えられます。
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] shadow-sm">
          {settingsItems.map(({ icon: Icon, ...item }) => (
            <Link
              key={item.href}
              href={item.href}
              className="grid min-h-16 grid-cols-[40px_1fr_18px] items-center gap-3 border-b border-[var(--mikke-line-soft)] px-4 py-3 last:border-b-0"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
                <Icon size={19} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[var(--mikke-text)]">{item.title}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--mikke-muted)]">{item.description}</span>
              </span>
              <ChevronRight size={17} className="text-[var(--mikke-muted-light)]" />
            </Link>
          ))}
        </div>
      </section>
    </MarketNoteShell>
  );
}

export default function MarketNoteSettingsPage() {
  return (
    <AuthGate allowGuest>
      <MarketNoteSettingsContent />
    </AuthGate>
  );
}
