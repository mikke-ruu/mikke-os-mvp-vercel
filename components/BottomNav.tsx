"use client";

import { BarChart3, Home, NotebookTabs, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/marketnote", label: "記録", icon: NotebookTabs },
  { href: "/story", label: "Story", icon: UserRound },
  { href: "/desk", label: "DESK", icon: BarChart3 },
  { href: "/settings", label: "設定", icon: Settings }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e8e1da] bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center rounded-xl px-2 py-2 text-[11px] font-semibold ${
                active ? "bg-[#fff0e9] text-[#d9643a]" : "text-[#79716b]"
              }`}
            >
              <Icon size={20} strokeWidth={2.2} />
              <span className="mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
