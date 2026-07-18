"use client";

// mikke AI OFFICE — アクティビティログ：時刻＋社員のミニアイコン＋メッセージ。

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { employeeById } from "@/lib/ai-office/data";
import type { ActivityLogEntry } from "@/lib/ai-office/types";

const PREVIEW_COUNT = 8;

export function ActivityLogPanel({ logs }: { logs: ActivityLogEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? logs : logs.slice(0, PREVIEW_COUNT);

  return (
    <section className="rounded-2xl border border-[#e3e6f0] bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ScrollText className="h-4 w-4 text-[#e58f65]" />
          <h2 className="text-sm font-bold text-[#1e2a4a]">アクティビティログ</h2>
        </div>
        {logs.length > PREVIEW_COUNT && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-[11px] font-semibold text-[#e58f65] hover:underline"
          >
            {showAll ? "たたむ" : "すべて見る"}
          </button>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-2.5">
        {visible.length === 0 && <li className="text-xs text-[#9aa3b2]">まだログはありません</li>}
        {visible.map((log) => {
          const emp = employeeById[log.employeeId];
          return (
            <li key={log.id} className="flex items-start gap-2">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ background: emp?.color ?? "#9aa3b2" }}
                title={emp?.name}
              >
                {emp?.kind === "ai" ? "AI" : emp?.name?.slice(0, 1) ?? "?"}
              </span>
              <div className="min-w-0">
                <p className="text-xs leading-snug text-[#1e2a4a]">
                  <span className="font-bold">{emp?.name ?? "不明"}</span>
                  <span className="ml-1 text-[#4b5563]">{log.message}</span>
                </p>
                <p className="text-[10px] text-[#9aa3b2]">{log.time}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
