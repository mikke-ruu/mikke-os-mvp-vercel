"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, BellRing, ClipboardList, History, Mail, PanelsTopLeft, Rocket } from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MikkeAppShell, type MikkeShellBottomNavItem, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";
import { getHqStaffMembership, type HqRole, type HqStaffMembership } from "@/lib/hq";
import { supabase } from "@/lib/supabase/client";

const roleLabels: Record<HqRole, string> = {
  owner: "本部オーナー",
  admin: "本部管理者",
  support: "お問い合わせ担当",
  editor: "お知らせ編集者",
  analyst: "分析担当"
};

function canSeeInquiries(role: HqRole) {
  return ["owner", "admin", "support"].includes(role);
}

function canEditContent(role: HqRole) {
  return ["owner", "admin", "editor", "analyst"].includes(role);
}

function canSeeAudit(role: HqRole) {
  return ["owner", "admin"].includes(role);
}

function buildNav(role: HqRole): MikkeShellNavItem[] {
  const items: MikkeShellNavItem[] = [
    { label: "ホーム", href: "/hq", icon: BarChart3, section: "本部運営" }
  ];
  if (canSeeAudit(role)) items.push({ label: "実装センター", href: "/hq/implementation", icon: PanelsTopLeft });
  if (canSeeInquiries(role)) items.push({ label: "お問い合わせ", href: "/hq/inquiries", icon: ClipboardList });
  if (canEditContent(role)) {
    items.push({ label: "お知らせ", href: "/hq/announcements", icon: BellRing, section: "発信" });
    items.push({ label: "メール配信", href: "/hq/email", icon: Mail });
    items.push({ label: "アップデート", href: "/hq/updates", icon: Rocket });
  }
  if (canSeeAudit(role)) items.push({ label: "操作履歴", href: "/hq/audit", icon: History, section: "安全管理" });
  return items;
}

function HqAccessGate({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [membership, setMembership] = useState<HqStaffMembership | null>(null);
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getHqStaffMembership(user.id)
      .then((result) => {
        if (!cancelled) setMembership(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "本部権限を確認できませんでした。");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const navItems = useMemo(() => (membership ? buildNav(membership.role) : []), [membership]);
  const bottomNavItems = useMemo<MikkeShellBottomNavItem[]>(
    () => navItems.slice(0, 5).map(({ label, href, icon }) => ({ label, href, icon })),
    [navItems]
  );

  if (checking) return <LoadingScreen />;

  if (!membership) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--mikke-surface-soft)] px-5">
        <section className="w-full max-w-md rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-bold tracking-[0.15em] text-[var(--mikke-primary)]">mikkeOS 本部</p>
          <h1 className="mt-3 text-xl font-bold text-[var(--mikke-text)]">本部スタッフ専用の画面です</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--mikke-muted)]">
            {loadError ? "本部機能の準備状況を確認できませんでした。" : "このアカウントには本部権限がありません。"}
          </p>
          {loadError ? <p className="mt-2 rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-left text-xs text-[var(--mikke-muted)]">{loadError}</p> : null}
          <Link href="/home" className="mt-5 inline-flex rounded-xl bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white">
            アプリへ戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <MikkeAppShell
      appName="mikkeOS 本部"
      title="mikkeOS 本部"
      subtitle={roleLabels[membership.role]}
      theme="blue"
      navItems={navItems}
      bottomNavItems={bottomNavItems}
      showBottomNavLabels
      showSharedUtilities={false}
      mikkeId={profile.handle}
      onSignOut={() => void supabase.auth.signOut()}
      footerLabel={`mikkeOS 本部 ・ ${roleLabels[membership.role]}`}
    >
      {children}
    </MikkeAppShell>
  );
}

export function HqShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <HqAccessGate>{children}</HqAccessGate>
    </AuthGate>
  );
}
