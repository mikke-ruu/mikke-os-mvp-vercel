"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  ExternalLink,
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

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  // 既定のprefixマッチ（pathname===href or startsWith(`${href}/`)）で足りない場合の個別判定。
  // AC-3: 講師ページ編集(/academy/courses/[id]/instructor-page)は物理的にはcourses配下だが、
  // 概念上は「講師ページ編集」タブの内容なので、講座管理タブ側では除外しこちら側で拾う。
  matches?: (pathname: string) => boolean;
};

// 講師専用ページのビルド編集画面。URL上は /academy/courses/[id]/instructor-page だが、
// ナビ上は「講師ページ編集」タブ（/academy/instructor-pages 一覧からたどる）の一部として扱う。
const INSTRUCTOR_PAGE_ROUTE_RE = /^\/academy\/courses\/[^/]+\/instructor-page(\/|$)/;

const honbuNav: NavItem[] = [
  { href: "/academy", label: "ダッシュボード", icon: LayoutDashboard, exact: true },
  {
    href: "/academy/courses",
    label: "講座管理",
    icon: BookOpen,
    matches: (pathname) =>
      pathname === "/academy/courses" ||
      (pathname.startsWith("/academy/courses/") && !INSTRUCTOR_PAGE_ROUTE_RE.test(pathname))
  },
  { href: "/academy/instructors", label: "講師管理", icon: Users },
  { href: "/academy/applications", label: "申込管理", icon: ClipboardList },
  { href: "/academy/kits", label: "キット発送", icon: Package },
  // AC-C4: 「教材・資料」は独立ナビから外し、講師専用ページビルダー内の導線
  // （/academy/materials?course=[id]）から編集する動線に統合した。
  // ページ自体（app/academy/materials/page.tsx）とデータ(academy_materials)は削除していない。
  { href: "/academy/front", label: "フロント編集", icon: Store },
  {
    href: "/academy/instructor-pages",
    label: "講師ページ編集",
    icon: PenSquare,
    matches: (pathname) =>
      pathname === "/academy/instructor-pages" ||
      pathname.startsWith("/academy/instructor-pages/") ||
      INSTRUCTOR_PAGE_ROUTE_RE.test(pathname)
  }
];

const koushiNav: NavItem[] = [
  { href: "/academy/portal", label: "ダッシュボード", icon: LayoutDashboard, exact: true },
  { href: "/academy/portal/study", label: "復習ページ", icon: GraduationCap },
  { href: "/academy/portal/url", label: "営業用URL", icon: Link2 },
  { href: "/academy/portal/applications", label: "申込管理", icon: ClipboardList },
  { href: "/academy/portal/kits", label: "キット発送", icon: Package }
];

// AC-1: モバイル下部ナビの最優先4項目（残りは横スクロールタブ／ハンバーガーメニューから）。
const HONBU_PRIORITY_HREFS = ["/academy", "/academy/courses", "/academy/instructors", "/academy/applications"];
const KOUSHI_PRIORITY_HREFS = [
  "/academy/portal",
  "/academy/portal/study",
  "/academy/portal/applications",
  "/academy/portal/kits"
];

function pickNav(list: NavItem[], hrefs: string[]): NavItem[] {
  return hrefs
    .map((href) => list.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
}

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
  const bottomNav = pickNav(nav, variant === "honbu" ? HONBU_PRIORITY_HREFS : KOUSHI_PRIORITY_HREFS);
  const switchHref = variant === "honbu" ? "/academy/portal" : "/academy";

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function isActive(item: NavItem) {
    if (item.matches) return item.matches(pathname);
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
      {/* AC-2: PC(md+)は左サイドバー固定リスト、モバイルは横スクロールタブのまま */}
      <div className="md:flex md:items-start md:gap-6">
        <aside className="hidden shrink-0 md:block md:w-56">
          <nav className="sticky top-20 space-y-1 rounded-2xl border border-[var(--mikke-line)] bg-white p-2">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                    active
                      ? "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                      : "text-[var(--mikke-text-soft)] hover:bg-[var(--mikke-surface-soft)]"
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-5 space-y-3">
            <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden">
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
        </div>
      </div>

      {/*
        AC-1: Academy専用モバイル下部ナビ。
        MikkeAppShell側の共通フッター（Academy/Manager/Apps）はOS共通部品のため
        components/academy配下からは変更できない。同じ fixed inset-x-0 bottom-0 の位置に
        z-indexを上げて重ね、Academy自身の最優先4項目に差し替えて見せる
        （OS共通ナビへの導線はハンバーガーメニュー側に残す）。
      */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--mikke-line)] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={`bottom-${item.href}`}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-bold ${
                  active ? "text-[var(--mikke-accent)]" : "text-[var(--mikke-muted)]"
                }`}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span className="mt-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
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
