"use client";

import styles from "./MediaCompact.module.css";
import { useAuth } from "@/components/AuthGate";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { FileText, LayoutDashboard, PenLine, Settings } from "lucide-react";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useMediaReviewNavigation } from "./MediaNavigation";

const navItems = [
  { label: "ホーム", href: "/apps/media", icon: LayoutDashboard, section: "MEDIA" },
  { label: "書く", href: "/apps/media/write", icon: PenLine },
  { label: "記事", href: "/apps/media/articles", icon: FileText },
  { label: "設定", href: "/apps/media/settings", icon: Settings, section: "設定" }
];

export function MediaAppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const router = useRouter();
  const { href, reviewing } = useMediaReviewNavigation();
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (!error) router.replace("/login?next=/apps/media");
  }
  return <MikkeAppShell appName="Media" title="Media" theme="blue" mikkeId={reviewing ? undefined : profile.handle} onSignOut={reviewing ? undefined : () => void signOut()} navItems={navItems.map((item) => ({ ...item, href: href(item.href) }))} bottomNavItems={navItems.map((item) => ({ label: item.label, href: href(item.href), icon: item.icon, primary: item.href.endsWith("/write") }))} primaryActionTone="orange" showSharedUtilities={!reviewing} showBottomNavLabels><div className={styles.content}>{reviewing ? <p className="mb-5 border-b border-[var(--mikke-line)] pb-3 text-xs leading-6 text-[var(--mikke-muted)]">デザイン確認用・このブラウザ内だけに保存します。外部には公開されません。</p> : null}{children}</div></MikkeAppShell>;
}
