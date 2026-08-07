"use client";

import { BookOpenText, CalendarDays, ContactRound, Grid3X3, Library, Pencil, QrCode, Users } from "lucide-react";
import { MikkeAppShell, type MikkeShellBottomNavItem, type MikkeShellNavItem } from "./MikkeAppShell";
import type { MikkeOwnerMenuItem } from "./MikkeOwnerMenu";

const storyNavItems: MikkeShellNavItem[] = [
  { label: "マイSTORY", href: "/story", icon: BookOpenText, section: "STORY" },
  { label: "編集", href: "/story/edit", icon: Pencil, section: "STORY" },
  { label: "コレクション", href: "/story/collection", icon: ContactRound, section: "名刺帳" },
  { label: "QR・共有", href: "/story/share", icon: QrCode, section: "名刺帳" }
];

const storyBottomNavItems: MikkeShellBottomNavItem[] = [
  { label: "名刺", href: "/story", icon: BookOpenText },
  { label: "編集", href: "/story/edit", icon: Pencil },
  { label: "名刺帳", href: "/story/collection", icon: ContactRound },
  { label: "共有", href: "/story/share", icon: QrCode }
];

const ownedApps: MikkeOwnerMenuItem[] = [
  { title: "STORY", href: "/story", icon: BookOpenText, tone: "blue" }
];

const otherApps: MikkeOwnerMenuItem[] = [
  { title: "MarketNote", href: "/marketnote", icon: CalendarDays, tone: "orange" },
  { title: "Community", href: "/community", icon: Users, tone: "green" },
  { title: "Library", href: "/apps/library", icon: Library, tone: "yellow" },
  { title: "Apps", href: "/apps", icon: Grid3X3, tone: "pink" }
];

export function StoryAppShell({ children, title = "STORY", subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  return (
    <MikkeAppShell
      appName="STORY"
      title={title}
      subtitle={subtitle}
      theme="blue"
      menuEditItems={storyNavItems.map((item) => ({ title: item.label, href: item.href, icon: item.icon }))}
      ownedApps={ownedApps}
      otherApps={otherApps}
      suggestedApps={[]}
      navItems={storyNavItems}
      bottomNavItems={storyBottomNavItems}
      showBottomNavLabels
      footerLabel="STORY by mikke"
    >
      {children}
    </MikkeAppShell>
  );
}
