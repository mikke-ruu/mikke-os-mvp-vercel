"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  Link2,
  Package,
  PenSquare,
  Store,
  Users
} from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import {
  MikkeAppShell,
  type MikkeShellBottomNavItem,
  type MikkeShellNavItem
} from "@/components/mikkeos/MikkeAppShell";
import { useOwnedMikkeApps } from "@/components/mikkeos/useOwnedMikkeApps";
import { supabase } from "@/lib/supabase/client";

const honbuNav: MikkeShellNavItem[] = [
  { href: "/academy", label: "ダッシュボード", icon: LayoutDashboard, section: "本部" },
  { href: "/academy/courses", label: "講座管理", icon: BookOpen, section: "講座" },
  { href: "/academy/classes", label: "クラス・担当講師", icon: CalendarCheck, section: "講座" },
  { href: "/academy/instructors", label: "講師管理", icon: Users, section: "講座" },
  { href: "/academy/applications", label: "申込管理", icon: ClipboardList, section: "講座" },
  { href: "/academy/front", label: "ホームページ編集", icon: Store, section: "公開" },
  { href: "/academy/instructor-pages", label: "講師ページ編集", icon: PenSquare, section: "公開" }
];

const koushiNav: MikkeShellNavItem[] = [
  { href: "/academy/portal", label: "ダッシュボード", icon: LayoutDashboard, section: "講師ポータル" },
  { href: "/academy/portal/class-requests", label: "クラス担当依頼", icon: CalendarCheck, section: "講師ポータル" },
  { href: "/academy/portal/study", label: "講師ページ", icon: GraduationCap, section: "講師ポータル" },
  { href: "/academy/portal/url", label: "営業用URL", icon: Link2, section: "募集" },
  { href: "/academy/portal/applications", label: "申込管理", icon: ClipboardList, section: "募集" },
  { href: "/academy/portal/kits", label: "キット発注", icon: Package, section: "発注" }
];

const honbuBottomNav: MikkeShellBottomNavItem[] = [
  { href: "/academy", label: "ホーム", icon: LayoutDashboard },
  { href: "/academy/courses", label: "講座", icon: BookOpen },
  { href: "/academy/instructors", label: "講師", icon: Users },
  { href: "/academy/applications", label: "申込", icon: ClipboardList }
];

const koushiBottomNav: MikkeShellBottomNavItem[] = [
  { href: "/academy/portal", label: "ホーム", icon: LayoutDashboard },
  { href: "/academy/portal/study", label: "ページ", icon: GraduationCap },
  { href: "/academy/portal/applications", label: "申込", icon: ClipboardList },
  { href: "/academy/portal/kits", label: "発注", icon: Package }
];

function ShellInner({
  variant,
  title,
  children
}: {
  variant: "honbu" | "koushi";
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { ownedApps, suggestedApps } = useOwnedMikkeApps({ userId: user.id });
  const navItems = variant === "honbu" ? honbuNav : koushiNav;
  const bottomNavItems = variant === "honbu" ? honbuBottomNav : koushiBottomNav;
  const switchHref = variant === "honbu" ? "/academy/portal" : "/academy";

  async function signOut() {
    await supabase.auth.signOut();
    router.replace(`/login?next=${encodeURIComponent(variant === "honbu" ? "/academy" : "/academy/portal")}`);
  }

  return (
    <MikkeAppShell
      appName="Academy"
      title={title}
      subtitle={variant === "honbu" ? "本部管理" : "講師ポータル"}
      theme="blue"
      currentApp={{
        label: "Academy",
        href: variant === "honbu" ? "/academy" : "/academy/portal",
        icon: GraduationCap
      }}
      menuDescription="講座、講師、申込、教材などAcademy内の管理をまとめています。"
      menuEditItems={navItems.map((item) => ({ title: item.label, href: item.href, icon: item.icon }))}
      ownedApps={ownedApps}
      otherApps={[]}
      suggestedApps={suggestedApps}
      mikkeId={profile.handle}
      onSignOut={() => void signOut()}
      navItems={navItems}
      bottomNavItems={bottomNavItems}
      showSharedUtilities={variant === "koushi"}
      footerLabel="Academy by mikke"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[var(--mikke-muted)]">
          {variant === "honbu" ? "本部管理" : "講師ポータル"}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/academy/site"
            target="_blank"
            className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
          >
            <ExternalLink size={14} />
            ホームページを見る
          </Link>
          <Link
            href={switchHref}
            className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
          >
            {variant === "honbu" ? <GraduationCap size={14} /> : <Store size={14} />}
            {variant === "honbu" ? "講師ポータルへ" : "本部画面へ"}
          </Link>
        </div>
      </div>
      {children}
    </MikkeAppShell>
  );
}

export function HonbuShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AuthGate>
      <ShellInner variant="honbu" title={title}>
        {children}
      </ShellInner>
    </AuthGate>
  );
}

export function KoushiShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AuthGate>
      <ShellInner variant="koushi" title={title}>
        {children}
      </ShellInner>
    </AuthGate>
  );
}
