"use client";

import { Bell, History, LayoutDashboard, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";

const managerNavItems = [
  { href: "/manager", label: "今日", icon: LayoutDashboard },
  { href: "/manager/notifications", label: "お知らせ", icon: Bell },
  { href: "/manager/history", label: "履歴", icon: History },
  { href: "/manager/account", label: "基本情報", icon: UserRound },
  { href: "/manager/settings", label: "設定", icon: Settings }
];

export function ManagerShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <MikkeAppShell
      appName="Manager"
      title={title}
      subtitle={subtitle}
      currentApp={{ label: "Manager", href: "/manager", icon: LayoutDashboard }}
      menuDescription="Managerは、今日の予定、お知らせ、履歴、基本情報、設定をまとめて確認する場所です。"
      footerLabel="Manager by mikke"
    >
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {managerNavItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold ${
                active
                  ? "border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"
                  : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </MikkeAppShell>
  );
}
