"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AppHeader } from "./AppHeader";
import {
  MikkeAppsTileGrid,
  MikkeOwnerMenu,
  tileToneStyles,
  type MikkeOwnerMenuItem,
  type MikkeOwnerMenuSuggestedApp
} from "./MikkeOwnerMenu";
import type { StatChipTone } from "./StatChip";

/** @deprecated ヘッダー右/下部の冗長ナビは撤去済み。型のみ後方互換で残す（呼び出し側の書き換え不要）。 */
type CurrentAppNav = {
  label: string;
  href: string;
  icon?: LucideIcon;
};

/** PC常時左サイドメニュー／モバイルドロワーの機能一覧に使うナビ項目（承認済みモック`.side` `.nav`準拠）。 */
export type MikkeShellNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** 小見出し（モックの`.cap`。例:「運営」「設定」）。前の項目と同じsectionなら見出しは繰り返さない。 */
  section?: string;
};

/** モバイル下部メニュー（アイコンのみ・モック`.bottom`準拠）の項目。 */
export type MikkeShellBottomNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** モック`.bottom a.plus`＝中央の塗りタイル「＋新規」に使う。 */
  primary?: boolean;
};

type MikkeAppShellProps = {
  appName: string;
  title?: string;
  subtitle?: string;
  currentApp?: CurrentAppNav;
  /** メニューのアクティブ囲い等に使うアプリ別アクセント色。タイトルは全アプリ共通で固定ブルーのまま変えない。 */
  theme?: StatChipTone;
  menuDescription?: string;
  menuEditItems?: MikkeOwnerMenuItem[];
  ownedApps?: MikkeOwnerMenuItem[];
  otherApps?: MikkeOwnerMenuItem[];
  suggestedApps?: MikkeOwnerMenuSuggestedApp[];
  footerLabel?: string;
  /**
   * 渡された時だけPC(≥900px)常時左サイドメニュー＋モバイルドロワーのナビ一覧を表示する。
   * 未指定の既存アプリ（STORY等）は従来通り＝後方互換。
   */
  navItems?: MikkeShellNavItem[];
  /** モバイル下部メニュー（アイコンのみ5枠想定）。navItems指定時のみ意味を持つ。 */
  bottomNavItems?: MikkeShellBottomNavItem[];
  children: React.ReactNode;
};

/** pathnameに対して最も長く前方一致するhrefを「現在地」とみなす（ホームが常時アクティブ化しないように）。 */
function findActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const normalized = href.endsWith("/") ? href : `${href}/`;
    const matches = pathname === href || pathname.startsWith(normalized);
    if (!matches) continue;
    if (!best || href.length > best.length) best = href;
  }
  return best;
}

export function MikkeAppShell({
  appName,
  title = appName,
  subtitle,
  currentApp,
  theme = "blue",
  menuDescription,
  menuEditItems,
  ownedApps,
  otherApps,
  suggestedApps,
  footerLabel,
  navItems,
  bottomNavItems,
  children
}: MikkeAppShellProps) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      setDrawerEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setDrawerEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const hasSidebar = Boolean(navItems && navItems.length > 0);
  const toneStyle = tileToneStyles[theme];
  const activeNavHref = navItems && navItems.length > 0 ? findActiveHref(pathname, navItems.map((item) => item.href)) : null;
  const activeBottomHref =
    bottomNavItems && bottomNavItems.length > 0
      ? findActiveHref(
          pathname,
          bottomNavItems.filter((item) => !item.primary).map((item) => item.href)
        )
      : null;
  const appTiles = [...(ownedApps ?? []), ...(otherApps ?? [])];

  let lastSection: string | undefined;

  return (
    <main className="min-h-screen bg-white text-[var(--mikke-text)]">
      {menuOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={closeMenu}
            className={`absolute inset-0 bg-[var(--mikke-backdrop)] transition-opacity duration-200 ${
              drawerEntered ? "opacity-100" : "opacity-0"
            }`}
          />
          <aside
            className={`absolute inset-y-0 left-0 w-[min(92vw,400px)] overflow-y-auto bg-white p-4 shadow-2xl transition-transform duration-200 ease-out ${
              drawerEntered ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <MikkeOwnerMenu
              appName={appName}
              theme={theme}
              editItems={menuEditItems ?? navItems?.map((item) => ({ title: item.label, href: item.href, icon: item.icon }))}
              ownedApps={ownedApps}
              otherApps={otherApps}
              suggestedApps={suggestedApps}
              onClose={closeMenu}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen">
        {navItems && navItems.length > 0 ? (
          <aside
            className="sticky top-0 hidden h-screen w-[230px] flex-none flex-col overflow-y-auto border-r border-[var(--mikke-line)] bg-[var(--mikke-side-bg)] px-3.5 pb-5 pt-6 min-[900px]:flex"
            aria-label={`${appName} メニュー`}
          >
            <p
              className="px-2.5 pb-4 text-[13px] font-bold uppercase text-[var(--mikke-primary)]"
              style={{ fontFamily: "var(--mikke-font-display)", letterSpacing: "0.26em" }}
            >
              {appName}
            </p>
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const showCap = Boolean(item.section) && item.section !== lastSection;
                lastSection = item.section ?? lastSection;
                const isActive = item.href === activeNavHref;
                const Icon = item.icon;
                return (
                  <div key={item.href}>
                    {showCap ? (
                      <p className="px-3 pb-1.5 pt-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--mikke-muted-light)]">
                        {item.section}
                      </p>
                    ) : null}
                    <Link
                      href={item.href}
                      className="mb-0.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold"
                      style={
                        isActive
                          ? { background: toneStyle.background, color: toneStyle.foreground }
                          : { color: "var(--mikke-muted)" }
                      }
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      {item.label}
                    </Link>
                  </div>
                );
              })}
            </nav>

            {appTiles.length > 0 ? (
              <div className="mt-3.5 border-t border-[var(--mikke-line)] pt-4">
                <p className="mb-2 px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--mikke-muted-light)]">APPS</p>
                <MikkeAppsTileGrid apps={appTiles} />
              </div>
            ) : null}
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader title={title} onMenuClick={() => setMenuOpen(true)} menuOpen={menuOpen} hideMenuOnDesktop={hasSidebar} />

          <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-10 md:py-8">{children}</div>

          <footer className="mx-auto w-full max-w-7xl px-4 pb-8 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">
            {footerLabel ?? `${appName} by mikke`}
          </footer>

          {bottomNavItems && bottomNavItems.length > 0 ? (
            <nav
              aria-label={`${appName} メニュー（モバイル）`}
              className="sticky bottom-0 z-10 grid border-t border-[var(--mikke-line)] bg-white/95 backdrop-blur min-[900px]:hidden"
              style={{ gridTemplateColumns: `repeat(${bottomNavItems.length}, minmax(0, 1fr))` }}
            >
              {bottomNavItems.map((item) => {
                const Icon = item.icon;
                if (item.primary) {
                  return (
                    <Link key={item.href} href={item.href} aria-label={item.label} className="grid place-items-center py-2.5">
                      <span className="grid h-[34px] w-[34px] place-items-center rounded-xl" style={{ background: toneStyle.background }}>
                        <Icon size={18} color={toneStyle.foreground} strokeWidth={1.8} />
                      </span>
                    </Link>
                  );
                }
                const isActive = item.href === activeBottomHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    className="grid place-items-center py-3"
                    style={{ color: isActive ? toneStyle.background : "var(--mikke-muted-light)" }}
                  >
                    <Icon size={21} strokeWidth={1.8} />
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
      </div>
    </main>
  );
}
