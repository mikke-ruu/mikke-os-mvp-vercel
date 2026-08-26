"use client";

import { Bell, History, LayoutDashboard, Settings, UserRound } from "lucide-react";
import { MikkeAppShell, type MikkeShellBottomNavItem, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";

const managerNavItems: MikkeShellNavItem[] = [
  { href: "/manager", label: "今日", icon: LayoutDashboard },
  { href: "/manager/notifications", label: "お知らせ", icon: Bell },
  { href: "/manager/account", label: "基本情報", icon: UserRound },
  { href: "/manager/settings", label: "設定", icon: Settings },
  { href: "/manager/history", label: "履歴", icon: History }
];

const managerBottomNavItems: MikkeShellBottomNavItem[] = managerNavItems.map(({ label, href, icon }) => ({ label, href, icon }));

export function ManagerShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <MikkeAppShell
      appName="Manager"
      title={title}
      subtitle={subtitle}
      currentApp={{ label: "Manager", href: "/manager", icon: LayoutDashboard }}
      menuDescription="Managerは、今日の予定、お知らせ、履歴、基本情報、設定をまとめて確認する場所です。"
      footerLabel="Manager by mikke"
      navItems={managerNavItems}
      bottomNavItems={managerBottomNavItems}
      showBottomNavLabels
    >
      {children}
    </MikkeAppShell>
  );
}
