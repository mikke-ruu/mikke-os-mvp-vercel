"use client";

import { AppWindow, BookOpenText, Grid3X3, Home, ListChecks, Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MikkeOwnerMenu, type MikkeOwnerMenuItem, type MikkeOwnerMenuSuggestedApp } from "./MikkeOwnerMenu";

type CurrentAppNav = {
  label: string;
  href: string;
  icon?: LucideIcon;
};

type MikkeAppShellProps = {
  appName: string;
  title?: string;
  subtitle?: string;
  currentApp?: CurrentAppNav;
  menuDescription?: string;
  menuEditItems?: MikkeOwnerMenuItem[];
  ownedApps?: MikkeOwnerMenuItem[];
  otherApps?: MikkeOwnerMenuItem[];
  suggestedApps?: MikkeOwnerMenuSuggestedApp[];
  footerLabel?: string;
  children: React.ReactNode;
};

const baseNavItems = [
  { href: "/os", label: "OS", icon: Home },
  { href: "/story", label: "Story", icon: BookOpenText },
  { href: "/desk", label: "DESK", icon: ListChecks },
  { href: "/apps", label: "Apps", icon: AppWindow }
];

export function MikkeAppShell({
  appName,
  title = appName,
  subtitle,
  currentApp,
  menuDescription,
  menuEditItems,
  ownedApps,
  otherApps,
  suggestedApps,
  footerLabel,
  children
}: MikkeAppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = currentApp ?? { label: appName, href: pathname || "/apps", icon: Grid3X3 };
  const CurrentIcon = current.icon ?? Grid3X3;
  const mobileNavItems = baseNavItems.some((item) => item.href === current.href) ? baseNavItems : [...baseNavItems, current];

  return (
    <main className="min-h-screen bg-white text-[var(--mikke-text)]">
      {menuOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-[var(--mikke-backdrop)]"
          />
          <aside className="absolute inset-y-0 right-0 w-[min(92vw,430px)] overflow-y-auto bg-white p-4 shadow-2xl">
            <MikkeOwnerMenu
              appName={appName}
              description={menuDescription}
              editItems={menuEditItems}
              ownedApps={ownedApps}
              otherApps={otherApps}
              suggestedApps={suggestedApps}
              onClose={() => setMenuOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 border-b border-[var(--mikke-line)] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href={current.href} className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted)]">{appName}</p>
            <h1 className="truncate text-lg font-bold tracking-normal sm:text-xl">{title}</h1>
            {subtitle ? <p className="mt-0.5 hidden text-xs text-[var(--mikke-muted)] sm:block">{subtitle}</p> : null}
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-white p-1 shadow-sm md:flex">
              {baseNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${
                      active ? "bg-[var(--mikke-text)] text-white" : "text-[var(--mikke-muted)] hover:bg-[var(--mikke-primary-soft)]"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              aria-label={`${appName}メニュー`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((currentOpen) => !currentOpen)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-primary)]"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:py-8">{children}</div>

      <footer className="mx-auto max-w-7xl px-4 pb-24 text-center text-xs font-semibold text-[var(--mikke-muted-light)] md:pb-8">
        {footerLabel ?? `${appName} by mikke`}
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--mikke-line)] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item === current ? CurrentIcon : item.icon ?? Grid3X3;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] font-bold ${
                  active ? "text-[var(--mikke-accent)]" : "text-[var(--mikke-muted)]"
                }`}
              >
                <Icon size={22} strokeWidth={1.8} />
                <span className="mt-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
