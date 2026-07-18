"use client";

// mikke AI OFFICE — 左サイドバー：アプリアイコン / オンライン人数 / ナビ / チーム・スペース / mikkeOS同期カード

import { useState } from "react";
import { BookOpen, Gauge, KanbanSquare, LayoutGrid, MessageSquare, RefreshCw, Settings, Users } from "lucide-react";
import { teamSpaces } from "@/lib/ai-office/data";
import { AppBearIcon } from "./pixel-sprites";

const navItems = [
  { key: "floor", label: "オフィスフロア", icon: LayoutGrid },
  { key: "board", label: "案件ボード", icon: KanbanSquare },
  { key: "workload", label: "稼働モニター", icon: Gauge },
  { key: "comms", label: "コミュニケーション", icon: MessageSquare },
  { key: "knowledge", label: "ナレッジベース", icon: BookOpen },
  { key: "settings", label: "設定", icon: Settings }
] as const;

export function OfficeSidebar({ onlineCount }: { onlineCount: number }) {
  const [active, setActive] = useState<string>("floor");

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-[#e3e6f0] bg-white p-4 lg:flex">
      <div className="flex items-center gap-2.5 border-b border-[#e3e6f0] pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6f1]">
          <AppBearIcon pixel={3} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[#1e2a4a]">mikke AI OFFICE</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="ai-office-pulse h-1.5 w-1.5 rounded-full bg-[#4caf6e]" />
            <span className="text-[11px] text-[#6b7280]">オンライン: {onlineCount}名</span>
          </div>
        </div>
      </div>

      <nav className="mt-4 flex flex-col gap-1">
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                isActive ? "bg-[#fff6f1] text-[#e58f65]" : "text-[#4b5563] hover:bg-[#f6f7fb]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-5">
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold tracking-wide text-[#9aa3b2]">
          <Users className="h-3.5 w-3.5" />
          チーム・スペース
        </p>
        <ul className="mt-1.5 space-y-0.5">
          {teamSpaces.map((t) => (
            <li key={t}>
              <span className="block truncate rounded-lg px-3 py-1.5 text-xs text-[#4b5563] hover:bg-[#f6f7fb]">{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-[#e3e6f0] bg-[#f6f7fb] p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1e2a4a]">
            <RefreshCw className="h-3.5 w-3.5 text-[#e58f65]" />
            mikkeOSと同期中
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-[#9aa3b2]">案件・ログはこの端末に保存されています</p>
        </div>
      </div>
    </aside>
  );
}
