"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  ExternalLink,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Link2,
  LogOut,
  Package,
  PenSquare,
  Store,
  Users,
  type LucideIcon
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const honbuNav: NavItem[] = [
  { href: "/academy", label: "ダッシュボード", icon: LayoutDashboard, exact: true },
  { href: "/academy/courses", label: "講座管理", icon: BookOpen },
  { href: "/academy/instructors", label: "講師管理", icon: Users },
  { href: "/academy/applications", label: "申込管理", icon: ClipboardList },
  { href: "/academy/kits", label: "キット発送", icon: Package },
  { href: "/academy/materials", label: "教材・資料", icon: FolderOpen },
  { href: "/academy/front", label: "フロント編集", icon: Store },
  { href: "/academy/instructor-pages", label: "講師ページ編集", icon: PenSquare }
];

const koushiNav: NavItem[] = [
  { href: "/academy/portal", label: "ダッシュボード", icon: LayoutDashboard, exact: true },
  { href: "/academy/portal/study", label: "復習ページ", icon: GraduationCap },
  { href: "/academy/portal/url", label: "営業用URL", icon: Link2 },
  { href: "/academy/portal/applications", label: "申込管理", icon: ClipboardList },
  { href: "/academy/portal/kits", label: "キット発送", icon: Package }
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
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const nav = variant === "honbu" ? honbuNav : koushiNav;
  const switchHref = variant === "honbu" ? "/academy/portal" : "/academy";

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <MikkeAppShell
      appName="Academy"
      title={title}
      subtitle={variant === "honbu" ? "本部管理" : "講師ポータル"}
      currentApp={{ label: "Academy", href: variant === "honbu" ? "/academy" : "/academy/portal", icon: GraduationCap }}
      menuDescription="講座、講師、申込、教材などAcademy内の管理をまとめています。"
      menuEditItems={nav.map((item) => ({
        title: item.label,
        helper: item.href,
        href: item.href,
        icon: item.icon
      }))}
      footerLabel="Academy by mikke"
    >
      <div className="mb-5 space-y-3">
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${
                  active
                    ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                    : "border-[var(--mikke-line)] bg-[var(--mikke-surface)] text-[var(--mikke-text-soft)] hover:bg-[var(--mikke-surface-soft)]"
                }`}
              >
                <Icon size={14} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/academy/site"
            target="_blank"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
          >
            <ExternalLink size={14} />
            フロントを見る
          </Link>
          <Link
            href={switchHref}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
          >
            {variant === "honbu" ? <GraduationCap size={14} /> : <Store size={14} />}
            {variant === "honbu" ? "講師画面へ" : "本部画面へ"}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
          >
            <LogOut size={14} />
            {profile.display_name} からログアウト
          </button>
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
