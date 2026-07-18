"use client";

// mikke AI OFFICE — 稼働モニター：部屋（チーム）ごとの稼働状況バー。

import { Gauge } from "lucide-react";
import type { OfficeCase } from "@/lib/ai-office/types";
import { monitorCategories, workloadFor } from "./office-helpers";

function barColor(value: number): string {
  if (value >= 70) return "#e58f65";
  if (value >= 40) return "#d9a441";
  return "#4caf6e";
}

export function WorkloadMonitor({ cases }: { cases: OfficeCase[] }) {
  return (
    <section className="rounded-2xl border border-[#e3e6f0] bg-white p-4">
      <div className="flex items-center gap-1.5">
        <Gauge className="h-4 w-4 text-[#e58f65]" />
        <h2 className="text-sm font-bold text-[#1e2a4a]">稼働モニター</h2>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {monitorCategories.map((category) => {
          const { value, openCount } = workloadFor(cases, category);
          return (
            <div key={category.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1e2a4a]">{category.label}</span>
                <span className="text-[10px] font-bold text-[#9aa3b2]">{openCount > 0 ? "稼働中" : "待機中"}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#f0f1f6]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${value}%`, background: barColor(value) }}
                />
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[10px] text-[#9aa3b2]">
                <span>未完了 {openCount}件</span>
                <span>{value}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
