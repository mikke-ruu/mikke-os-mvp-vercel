"use client";

import { useEffect, useState } from "react";
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
import { marketNoteApp } from "@/lib/mikkeos/released-apps";
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

const loggedInSuggestedApps: MikkeOwnerMenuSuggestedApp[] = [
  { name: "Story", helper: "MarketNoteの実績掲載は、本人が選んだあとに開通します", href: "/story" }
];

const installGuideUrl = "https://mikke-os.com/install.html";

function detectInAppBrowser() {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const inLine = /Line\//i.test(ua);
  const inInstagram = /Instagram/i.test(ua);
  const inFacebook = /FBAN|FBAV|FB_IAB/i.test(ua);
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return inLine || inInstagram || inFacebook || isIOS && (inInstagram || inFacebook);
}

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
  const { profile } = useAuth();
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
      ownedApps={[marketNoteApp]}
      otherApps={[]}
      suggestedApps={isGuest ? guestSuggestedApps : loggedInSuggestedApps}
      mikkeId={isGuest ? undefined : profile.handle}
      isGuest={isGuest}
      onSignOut={isGuest ? undefined : () => void signOut()}
      navItems={marketNoteNavItems}
      bottomNavItems={hideBottomNav ? undefined : contextualBottomNavItems}
      footerLabel="MarketNote by mikke"
    >
      <InAppBrowserNotice />
      {children}
    </MikkeAppShell>
  );
}

function InAppBrowserNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(detectInAppBrowser());
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-2xl border border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] px-4 py-3 text-xs font-bold leading-5 text-[var(--mikke-accent-strong)]">
      <p>Instagram、LINE、Facebookの中で開いている可能性があります。</p>
      <p className="mt-1 text-[var(--mikke-text-soft)]">
        ゲスト記録を安全に続けるには、SafariやChromeなど普段使うブラウザで開いてください。
      </p>
      <a href={installGuideUrl} className="mt-2 inline-flex text-[var(--mikke-accent)] underline">
        通常ブラウザで開く・インストール手順を見る
      </a>
    </div>
  );
}
