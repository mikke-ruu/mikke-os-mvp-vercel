"use client";

import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FileText,
  ListChecks,
  Plus,
  ReceiptText,
  Settings,
  Store
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { MikkeAppShell, type MikkeShellBottomNavItem, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";
import type { MikkeOwnerMenuItem, MikkeOwnerMenuSuggestedApp } from "@/components/mikkeos/MikkeOwnerMenu";
import { useOwnedMikkeApps } from "@/components/mikkeos/useOwnedMikkeApps";
import { supabase } from "@/lib/supabase/client";

const marketNoteNavItems: MikkeShellNavItem[] = [
  { label: "カレンダー", href: "/marketnote", icon: CalendarDays, section: "MarketNote" },
  { label: "出店予定を追加", href: "/marketnote/new", icon: Plus, section: "MarketNote" },
  { label: "会計", href: "/marketnote/finance", icon: ReceiptText, section: "MarketNote" },
  { label: "設定", href: "/marketnote/settings", icon: Settings, section: "Settings" }
];

const marketNoteBottomNavItems: MikkeShellBottomNavItem[] = [
  { label: "予定", href: "/marketnote", icon: CalendarDays },
  { label: "追加", href: "/marketnote/new", icon: Plus, primary: true },
  { label: "会計", href: "/marketnote/finance", icon: ReceiptText },
  { label: "設定", href: "/marketnote/settings", icon: Settings }
];

const marketNoteEditItems: MikkeOwnerMenuItem[] = [
  { title: "カレンダー", href: "/marketnote", icon: CalendarDays },
  { title: "出店予定を追加", href: "/marketnote/new", icon: Plus },
  { title: "会計", href: "/marketnote/finance", icon: ReceiptText },
  { title: "MarketNote設定", href: "/marketnote/settings", icon: Settings }
];

const guestSuggestedApps: MikkeOwnerMenuSuggestedApp[] = [
  { name: "Story", helper: "ログイン後にプロフィール機能を使えます", href: "/login?next=/story" }
];

export function MarketNoteShell({
  title = "MarketNote",
  subtitle = "Events and finance",
  isGuest = false,
  addHref = "/marketnote/new",
  hideBottomNav = false,
  children
}: {
  title?: string;
  subtitle?: string;
  isGuest?: boolean;
  addHref?: string;
  hideBottomNav?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { ownedApps, suggestedApps } = useOwnedMikkeApps({ userId: user.id, currentApp: "marketnote", isGuest });
  const contextualBottomNavItems = marketNoteBottomNavItems.map((item) => (
    item.primary ? { ...item, href: addHref } : item
  ));

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login?next=/marketnote");
  }

  return (
    <MikkeAppShell
      appName="MarketNote"
      title={title}
      subtitle={subtitle}
      currentApp={{ label: "MarketNote", href: "/marketnote", icon: Store }}
      theme="blue"
      primaryActionTone="orange"
      showBottomNavLabels
      menuEditItems={marketNoteEditItems}
      ownedApps={ownedApps}
      otherApps={[]}
      suggestedApps={isGuest ? guestSuggestedApps : suggestedApps}
      mikkeId={isGuest ? undefined : profile.handle}
      isGuest={isGuest}
      onSignOut={isGuest ? undefined : () => void signOut()}
      navItems={marketNoteNavItems}
      bottomNavItems={hideBottomNav ? undefined : contextualBottomNavItems}
      footerLabel="MarketNote by mikke"
    >
      {children}
    </MikkeAppShell>
  );
}
