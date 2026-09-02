"use client";

import { FileText, LayoutDashboard, PenLine, Settings } from "lucide-react";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";

const navItems = [
  { label: "TODAY", href: "/apps/media", icon: LayoutDashboard, section: "MEDIA" },
  { label: "書く", href: "/apps/media/write", icon: PenLine },
  { label: "記事", href: "/apps/media/articles", icon: FileText },
  { label: "設定", href: "/apps/media/settings", icon: Settings, section: "設定" }
];

export function MediaAppShell({ children }: { children: React.ReactNode }) {
  return <MikkeAppShell appName="Media" title="Media" theme="blue" navItems={navItems} bottomNavItems={navItems.map((item) => ({ label: item.label, href: item.href, icon: item.icon, primary: item.href.endsWith("/write") }))} primaryActionTone="orange" showBottomNavLabels>{children}</MikkeAppShell>;
}
