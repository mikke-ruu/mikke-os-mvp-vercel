"use client";

import { Activity, AppWindow, BookOpenText, LayoutDashboard, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/os", label: "OS", icon: LayoutDashboard },
  { href: "/log", label: "Log", icon: Activity },
  { href: "/story", label: "Story", icon: BookOpenText },
  { href: "/desk", label: "DESK", icon: ListChecks },
  { href: "/apps", label: "Apps", icon: AppWindow }
];

export function OsShell({
  title,
  subtitle,
  brandLabel = "mikkeOS",
  showGlobalNav = true,
  children
}: {
  title: string;
  subtitle?: string;
  brandLabel?: string;
  showGlobalNav?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-white text-[var(--mikke-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--mikke-line)] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/os" className="min-w-0">
            {brandLabel ? <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mikke-accent)]">{brandLabel}</p> : null}
            <h1 className="truncate text-lg font-bold tracking-normal sm:text-xl">{title}</h1>
            {subtitle ? <p className="mt-0.5 hidden text-xs text-[var(--mikke-muted)] sm:block">{subtitle}</p> : null}
          </Link>
          {showGlobalNav ? <nav className="hidden items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-white p-1 shadow-sm md:flex">
            {navItems.map((item) => {
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
          </nav> : null}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:py-8">{children}</div>

      {showGlobalNav ? <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--mikke-line)] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] font-bold ${
                  active ? "text-[var(--mikke-accent)]" : "text-[var(--mikke-muted)]"
                }`}
              >
                <Icon size={22} strokeWidth={1.8} />
                <span className="mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav> : null}
    </main>
  );
}
