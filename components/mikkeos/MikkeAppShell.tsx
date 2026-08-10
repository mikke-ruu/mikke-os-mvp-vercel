"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HousePlus, Share2, type LucideIcon } from "lucide-react";
import { getExternalBrowserShareUrl, mikkeInstallGuideUrl, shareSourceFromAppName } from "@/lib/mikkeos/share-targets";
import { AppHeader } from "./AppHeader";
import {
  MikkeAppsTileGrid,
  MikkeAccountMenu,
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
  mikkeId?: string;
  isGuest?: boolean;
  onSignOut?: () => void;
  footerLabel?: string;
  /**
   * 渡された時だけPC(≥900px)常時左サイドメニュー＋モバイルドロワーのナビ一覧を表示する。
   * 未指定の既存アプリ（STORY等）は従来通り＝後方互換。
   */
  navItems?: MikkeShellNavItem[];
  /** モバイル下部メニュー（アイコンのみ5枠想定）。navItems指定時のみ意味を持つ。 */
  bottomNavItems?: MikkeShellBottomNavItem[];
  /** 中央の主要操作だけ別の固定色にする。未指定時はthemeと同じ。 */
  primaryActionTone?: StatChipTone;
  /** 初見でも意味が分かるよう、モバイル下部メニューに短いラベルを表示する。 */
  showBottomNavLabels?: boolean;
  sidebarFooterAction?: {
    label: string;
    helper?: string;
    icon: LucideIcon;
    onClick: () => void;
  };
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
  mikkeId,
  isGuest = false,
  onSignOut,
  footerLabel,
  navItems,
  bottomNavItems,
  primaryActionTone,
  showBottomNavLabels = false,
  sidebarFooterAction,
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
  const primaryToneStyle = tileToneStyles[primaryActionTone ?? theme];
  const activeNavHref = navItems && navItems.length > 0 ? findActiveHref(pathname, navItems.map((item) => item.href)) : null;
  const activeBottomHref =
    bottomNavItems && bottomNavItems.length > 0
      ? findActiveHref(
          pathname,
          bottomNavItems.filter((item) => !item.primary).map((item) => item.href)
        )
      : null;
  const appTiles = [...(ownedApps ?? []), ...(otherApps ?? [])];
  const hasShareNavItem = navItems?.some((item) => item.href.startsWith("/share")) ?? false;
  const shareHref = `/share?from=${shareSourceFromAppName(appName)}`;
  const SidebarFooterIcon = sidebarFooterAction?.icon;

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
              mikkeId={mikkeId}
              isGuest={isGuest}
              onSignOut={onSignOut}
              onClose={closeMenu}
            />
            {sidebarFooterAction ? (
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  sidebarFooterAction.onClick();
                }}
                className="mt-5 flex w-full items-center gap-3 border-t border-[var(--mikke-line-soft)] px-1 pt-4 text-left text-sm font-bold text-[var(--mikke-muted)]"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--mikke-surface-soft)] text-[var(--mikke-text-soft)]">
                  {SidebarFooterIcon ? <SidebarFooterIcon size={16} strokeWidth={1.8} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{sidebarFooterAction.label}</span>
                  {sidebarFooterAction.helper ? (
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--mikke-muted-light)]">
                      {sidebarFooterAction.helper}
                    </span>
                  ) : null}
                </span>
              </button>
            ) : null}
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
              <div className="mt-3 border-t border-[var(--mikke-line)] pt-2">
                {!hasShareNavItem ? (
                  <Link href={shareHref} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold text-[var(--mikke-primary)]">
                    <Share2 size={17} strokeWidth={1.8} />
                    シェア・QR
                  </Link>
                ) : null}
                <a href={getExternalBrowserShareUrl(mikkeInstallGuideUrl)} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold text-[var(--mikke-primary)]">
                  <HousePlus size={17} strokeWidth={1.8} />
                  ホーム画面に追加
                </a>
              </div>
            </nav>

            {appTiles.length > 0 ? (
              <div className="mt-3.5 border-t border-[var(--mikke-line)] pt-4">
                <p className="mb-2 px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--mikke-muted-light)]">APPS</p>
                <MikkeAppsTileGrid apps={appTiles} />
              </div>
            ) : null}

            {isGuest || mikkeId || onSignOut ? (
              <div className="mt-auto pt-5">
                <MikkeAccountMenu mikkeId={mikkeId} isGuest={isGuest} onSignOut={onSignOut} />
              </div>
            ) : null}

            {sidebarFooterAction ? (
              <button
                type="button"
                onClick={sidebarFooterAction.onClick}
                className="mt-auto flex w-full items-center gap-2.5 border-t border-[var(--mikke-line)] px-2.5 pt-4 text-left text-[12.5px] font-semibold text-[var(--mikke-muted)]"
              >
                {SidebarFooterIcon ? <SidebarFooterIcon size={17} strokeWidth={1.8} /> : null}
                <span className="min-w-0">
                  <span className="block truncate">{sidebarFooterAction.label}</span>
                  {sidebarFooterAction.helper ? (
                    <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-[var(--mikke-muted-light)]">
                      {sidebarFooterAction.helper}
                    </span>
                  ) : null}
                </span>
              </button>
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
              className="sticky bottom-0 z-10 grid border-t border-[var(--mikke-line)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur min-[900px]:hidden"
              style={{ gridTemplateColumns: `repeat(${bottomNavItems.length}, minmax(0, 1fr))` }}
            >
              {bottomNavItems.map((item) => {
                const Icon = item.icon;
                const itemKey = `${item.label}:${item.href}`;
                if (item.primary) {
                  return (
                    <Link key={itemKey} href={item.href} aria-label={item.label} className="flex min-h-[58px] flex-col items-center justify-center gap-1 py-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: primaryToneStyle.background }}>
                        <Icon size={19} color={primaryToneStyle.foreground} strokeWidth={1.9} />
                      </span>
                      {showBottomNavLabels ? <span className="text-[10px] font-bold text-[var(--mikke-muted)]">{item.label}</span> : null}
                    </Link>
                  );
                }
                const isActive = item.href === activeBottomHref;
                return (
                  <Link
                    key={itemKey}
                    href={item.href}
                    aria-label={item.label}
                    className="flex min-h-[58px] flex-col items-center justify-center gap-1 py-2"
                    style={{ color: isActive ? toneStyle.background : "var(--mikke-muted-light)" }}
                  >
                    <Icon size={21} strokeWidth={1.8} />
                    {showBottomNavLabels ? <span className="text-[10px] font-bold">{item.label}</span> : null}
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
