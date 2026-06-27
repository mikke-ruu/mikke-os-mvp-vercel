"use client";

import { Home, List, Plus, ReceiptText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/marketnote", label: "一覧", icon: List },
  { href: "/marketnote/new", label: "追加", icon: Plus, primary: true },
  { href: "/desk", label: "収支", icon: ReceiptText },
  { href: "/settings", label: "設定", icon: Settings }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eee9e4] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.primary
            ? pathname === item.href
            : item.href === "/marketnote"
              ? pathname === "/marketnote" || (pathname.startsWith("/marketnote/") && pathname !== "/marketnote/new")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-14 items-center justify-center rounded-xl px-2 py-2"
              aria-label={item.label}
              title={item.label}
            >
              <span
                className={
                  item.primary
                    ? "grid h-[52px] w-[52px] -translate-y-4 place-items-center rounded-full bg-[#f46a14] text-white shadow-[0_6px_14px_rgba(232,97,44,0.18)]"
                    : active
                      ? "text-[#f46a14]"
                      : "text-[#5f5a55]"
                }
              >
                <Icon size={item.primary ? 28 : 25} strokeWidth={item.primary ? 1.7 : 1.55} />
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
