"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, ClipboardList, Gift, GraduationCap, KeyRound, UserPlus, type LucideIcon } from "lucide-react";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { AuthGate } from "@/components/AuthGate";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const nav: NavItem[] = [
  { href: "/nintei-koza-admin", label: "問い合わせ一覧", icon: ClipboardList, exact: true },
  { href: "/nintei-koza-admin/conversions", label: "成約登録", icon: GraduationCap },
  { href: "/nintei-koza-admin/rewards", label: "お礼リスト", icon: Gift },
  { href: "/nintei-koza-admin/summary", label: "売れ行きサマリー", icon: BarChart3 },
  { href: "/nintei-koza-admin/referrers", label: "紹介者管理", icon: UserPlus },
  { href: "/nintei-koza-admin/codes", label: "購入コード", icon: KeyRound }
];

export function NinteiKozaShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <AuthGate>
      <MikkeAppShell
        appName="認定講座サイト管理"
        title={title}
        subtitle="nintei-koza-site 問い合わせ・紹介・成約"
        currentApp={{ label: "認定講座サイト管理", href: "/nintei-koza-admin", icon: GraduationCap }}
        menuDescription="認定講座構築サイト(nintei-koza-site)の問い合わせ・紹介コード・成約を管理します。"
        menuEditItems={nav.map((item) => ({
          title: item.label,
          helper: item.href,
          href: item.href,
          icon: item.icon
        }))}
      >
        <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[var(--mikke-line)] bg-white p-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${
                isActive(item) ? "bg-[var(--mikke-accent)] text-white" : "text-[var(--mikke-muted)] hover:bg-[var(--mikke-accent-soft)]"
              }`}
            >
              <item.icon size={13} />
              {item.label}
            </Link>
          ))}
        </div>
        {children}
      </MikkeAppShell>
    </AuthGate>
  );
}
