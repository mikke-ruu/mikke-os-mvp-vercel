"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, ExternalLink, Menu, NotebookTabs, Sparkles, X } from "lucide-react";
import { useState } from "react";

const apps = [
  {
    name: "MarketNote",
    href: "/home",
    mark: "M",
    tone: "text-[#f46a14]",
    description: "出店予定、チェック、収支を管理",
    status: "現在開いています",
    linked: true,
    icon: NotebookTabs
  },
  {
    name: "STORY",
    href: "/story",
    mark: "S",
    tone: "text-[#f46a14]",
    description: "プロフィール、リンク集、活動記録を表示",
    status: "連携済み",
    linked: true,
    icon: Sparkles
  },
  {
    name: "DESK",
    href: "/desk",
    mark: "D",
    tone: "text-[#16833b]",
    description: "収支、領収書、請求書をまとめて管理",
    status: "連携済み",
    linked: true,
    icon: BriefcaseBusiness
  }
];

export function MikkeAppSwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-full text-[#1f1b18]"
        aria-label="アプリを切り替える"
      >
        <Menu size={21} strokeWidth={1.8} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-[#1f1b18]/20" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="閉じる" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[22px] border border-[#eee9e4] bg-[#fffdfb] px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(45,33,22,0.12)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#f46a14]">Mikke OS</p>
                <h2 className="text-lg font-extrabold tracking-normal text-[#1f1b18]">アプリ切り替え</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full border border-[#e7e1dc] bg-white text-[#5f5a55]" aria-label="閉じる">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <div className="space-y-2">
              {apps.map((app) => {
                const Icon = app.icon;
                const active = app.name === "MarketNote"
                  ? pathname === "/home" || pathname.startsWith("/marketnote")
                  : pathname === app.href || pathname.startsWith(`${app.href}/`);

                return (
                  <Link
                    key={app.name}
                    href={app.href}
                    onClick={() => setOpen(false)}
                    className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 shadow-[0_3px_12px_rgba(45,33,22,0.035)] ${
                      active ? "border-[#f3d0be] bg-[#fff6f1]" : app.linked ? "border-[#eee9e4] bg-white" : "border-[#eee9e4] bg-[#f7f5f2]"
                    }`}
                  >
                    <span className={`grid h-10 w-10 place-items-center rounded-full bg-white text-2xl font-semibold ${app.tone}`}>
                      {app.mark}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-extrabold text-[#1f1b18]">{app.name}</span>
                        <Icon size={14} strokeWidth={1.8} className={active ? "text-[#f46a14]" : "text-[#8a817a]"} />
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-[#6f6862]">{app.description}</span>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-[#ff5a1f] text-white" : app.linked ? "bg-[#eaf8ee] text-[#16833b]" : "bg-[#f1eeea] text-[#8a817a]"}`}>
                        {active ? "現在開いています" : app.status}
                      </span>
                    </span>
                    <ExternalLink size={16} strokeWidth={1.8} className={active ? "text-[#f46a14]" : "text-[#8a817a]"} />
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 rounded-2xl border border-dashed border-[#e7e1dc] bg-white px-3 py-3">
              <p className="text-xs font-extrabold text-[#3b3530]">今後追加予定</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#8a817a]">Item Studio / Order / Event / Studio / Connect などを、同じ切り替え画面へ追加します。</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
