"use client";

import { BookOpenText, ContactRound, Pencil, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { releasedApps } from "@/lib/mikkeos/released-apps";
import { supabase } from "@/lib/supabase/client";
import { MikkeAppShell, type MikkeShellBottomNavItem, type MikkeShellNavItem } from "./MikkeAppShell";

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

export function StoryAppShell({ children, title = "STORY", subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  const router = useRouter();
  const { profile } = useAuth();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login?next=/story");
  }

  return (
    <MikkeAppShell
      appName="STORY"
      title={title}
      subtitle={subtitle}
      theme="blue"
      menuEditItems={storyNavItems.map((item) => ({ title: item.label, href: item.href, icon: item.icon }))}
      ownedApps={releasedApps}
      otherApps={[]}
      suggestedApps={[]}
      mikkeId={profile.handle}
      onSignOut={() => void signOut()}
      navItems={storyNavItems}
      bottomNavItems={storyBottomNavItems}
      showBottomNavLabels
      footerLabel="STORY by mikke"
    >
      {children}
    </MikkeAppShell>
  );
}
