"use client";

import {
  Activity,
  BookOpenText,
  ChevronRight,
  Grid3X3,
  Link as LinkIcon,
  PlusCircle,
  Settings,
  X,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";

export type MikkeOwnerMenuItem = {
  title: string;
  helper: string;
  href: string;
  icon?: LucideIcon;
};

export type MikkeOwnerMenuSuggestedApp = {
  name: string;
  helper: string;
  href?: string;
};

export type MikkeOwnerMenuProps = {
  appName: string;
  description?: string;
  editItems?: MikkeOwnerMenuItem[];
  ownedApps?: MikkeOwnerMenuItem[];
  otherApps?: MikkeOwnerMenuItem[];
  suggestedApps?: MikkeOwnerMenuSuggestedApp[];
  onClose?: () => void;
};

const defaultEditItems: MikkeOwnerMenuItem[] = [
  { title: "表示設定", helper: "このアプリの見せ方を整える", href: "/settings", icon: Settings },
  { title: "Log", helper: "内部の活動記録を確認する", href: "/log", icon: Activity }
];

const defaultOwnedApps: MikkeOwnerMenuItem[] = [
  { title: "Story", helper: "公開プロフィールを見る", href: "/story", icon: BookOpenText },
  { title: "DESK", helper: "売上・経費を確認する", href: "/desk", icon: Grid3X3 },
  { title: "Apps", helper: "アプリ一覧へ戻る", href: "/apps", icon: Grid3X3 }
];

const defaultSuggestedApps: MikkeOwnerMenuSuggestedApp[] = [
  { name: "Order", helper: "依頼受付をつなげますか", href: "/apps/order" },
  { name: "Community", helper: "会員・投稿管理をつなげますか", href: "/apps/community" }
];

export function MikkeOwnerMenu({
  appName,
  description,
  editItems = defaultEditItems,
  ownedApps = defaultOwnedApps,
  otherApps = [],
  suggestedApps = defaultSuggestedApps,
  onClose
}: MikkeOwnerMenuProps) {
  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-normal">{appName}メニュー</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">
            {description ?? `${appName}の操作、使っているアプリ、これからつなげられるアプリをまとめています。`}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <MenuSection title={`${appName}を操作`} items={editItems} accent="orange" />
      <MenuSection title="使っているアプリ" items={ownedApps} />
      {otherApps.length > 0 ? <MenuSection title="他のアプリ" items={otherApps} /> : null}

      {suggestedApps.length > 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--mikke-primary-border)] bg-white p-3">
          <p className="text-xs font-bold text-[var(--mikke-primary)]">つなげられるアプリ</p>
          <div className="mt-2 grid gap-2">
            {suggestedApps.map((app) => {
              const content = (
                <>
                  <PlusCircle className="shrink-0 text-[var(--mikke-primary)]" size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{app.name}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{app.helper}</span>
                  </span>
                  <span className="shrink-0 rounded-lg border border-[var(--mikke-primary-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
                    つなげますか
                  </span>
                </>
              );

              return app.href ? (
                <Link key={app.name} href={app.href} className="flex items-center gap-3 rounded-lg bg-[var(--mikke-surface-soft)] p-3">
                  {content}
                </Link>
              ) : (
                <div key={app.name} className="flex items-center gap-3 rounded-lg bg-[var(--mikke-surface-soft)] p-3">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MenuSection({
  title,
  items,
  accent = "blue"
}: {
  title: string;
  items: MikkeOwnerMenuItem[];
  accent?: "blue" | "orange";
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-bold text-[var(--mikke-primary)]">{title}</p>
      <div className="grid gap-2">
        {items.map((item) => {
          const Icon = item.icon ?? LinkIcon;
          return (
            <Link key={`${item.title}-${item.href}`} href={item.href} className="flex items-center gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  accent === "orange"
                    ? "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                    : "bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]"
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{item.title}</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{item.helper}</span>
              </span>
              <ChevronRight className="ml-auto shrink-0 text-[var(--mikke-muted-light)]" size={16} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
