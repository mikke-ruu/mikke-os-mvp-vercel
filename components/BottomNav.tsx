"use client";

import { Activity, AppWindow, BookOpenText, LayoutDashboard, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/os", label: "OS", icon: LayoutDashboard },
  { href: "/log", label: "Log", icon: Activity },
  { href: "/story", label: "Story", icon: BookOpenText },
  { href: "/desk", label: "DESK", icon: ListChecks },
  { href: "/apps", label: "Apps", icon: AppWindow }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eee9e4] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] font-bold"
              aria-label={item.label}
              title={item.label}
            >
              <span className={active ? "text-[#f46a14]" : "text-[#5f5a55]"}>
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <span className={active ? "mt-1 text-[#f46a14]" : "mt-1 text-[#5f5a55]"}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

