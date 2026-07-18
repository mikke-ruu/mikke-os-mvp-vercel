"use client";

// mikke AI OFFICE — 案件ボード：受付 / 作業中 / 確認待ち / 完了 の4列カンバン。

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { employeeById, employees, priorityLabels, statusLabels, statusOrder } from "@/lib/ai-office/data";
import type { CaseStatus, OfficeCase, Priority } from "@/lib/ai-office/types";
import { formatTime } from "./office-helpers";

const columnStyle: Record<CaseStatus, { bg: string; border: string; text: string; dot: string }> = {
  reception: { bg: "#eef4ff", border: "#c7d7fb", text: "#2554c7", dot: "#4d7cf2" },
  working: { bg: "#fff3ea", border: "#f3caa4", text: "#c06a2e", dot: "#e58f65" },
  review: { bg: "#fffbe8", border: "#f0dfa0", text: "#9c7d1a", dot: "#d9a441" },
  done: { bg: "#eefbf1", border: "#bfe3c8", text: "#227a44", dot: "#4caf6e" }
};

const priorityStyle: Record<Priority, string> = {
  low: "bg-[#f2f3f7] text-[#6b7280]",
  normal: "bg-[#eef4ff] text-[#2554c7]",
  high: "bg-[#fdeceb] text-[#c93f2d]"
};

function CaseCard({
  c,
  onStatusChange,
  onAssigneeChange
}: {
  c: OfficeCase;
  onStatusChange: (caseId: string, status: CaseStatus) => void;
  onAssigneeChange: (caseId: string, assigneeId: string) => void;
}) {
  const assignee = employeeById[c.assigneeId];
  const idx = statusOrder.indexOf(c.status);

  return (
    <div className="rounded-xl border border-[#e3e6f0] bg-white p-2.5 shadow-sm">
      <p className="text-xs font-bold leading-snug text-[#1e2a4a]">{c.title}</p>

      <div className="mt-1.5 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-white shadow-sm"
            style={{ background: assignee?.color ?? "#9aa3b2" }}
          />
          <span className="truncate text-[11px] text-[#4b5563]">{assignee?.name ?? "未定"}</span>
        </div>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${priorityStyle[c.priority]}`}>
          優先度{priorityLabels[c.priority]}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-[#9aa3b2]">
        <span>{c.team ?? "—"}</span>
        <span>{formatTime(c.updatedAt)} 更新</span>
      </div>

      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          disabled={idx <= 0}
          onClick={() => idx > 0 && onStatusChange(c.id, statusOrder[idx - 1])}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#e3e6f0] text-[#6b7280] disabled:opacity-30"
          aria-label="前のステータスへ"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <select
          value={c.status}
          onChange={(e) => onStatusChange(c.id, e.target.value as CaseStatus)}
          className="h-6 flex-1 rounded-md border border-[#e3e6f0] bg-white px-1 text-[10px] text-[#1e2a4a]"
        >
          {statusOrder.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={idx >= statusOrder.length - 1}
          onClick={() => idx < statusOrder.length - 1 && onStatusChange(c.id, statusOrder[idx + 1])}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#e3e6f0] text-[#6b7280] disabled:opacity-30"
          aria-label="次のステータスへ"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <select
        value={c.assigneeId}
        onChange={(e) => onAssigneeChange(c.id, e.target.value)}
        className="mt-1.5 h-6 w-full rounded-md border border-[#e3e6f0] bg-white px-1 text-[10px] text-[#1e2a4a]"
      >
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            担当：{emp.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CaseBoard({
  cases,
  onStatusChange,
  onAssigneeChange,
  onNewCase
}: {
  cases: OfficeCase[];
  onStatusChange: (caseId: string, status: CaseStatus) => void;
  onAssigneeChange: (caseId: string, assigneeId: string) => void;
  onNewCase: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#e3e6f0] bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#1e2a4a]">案件ボード</h2>
        <button
          type="button"
          onClick={onNewCase}
          className="flex items-center gap-1 rounded-full bg-[#e58f65] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.03]"
        >
          <Plus className="h-3.5 w-3.5" />
          新規案件
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {statusOrder.map((status) => {
          const style = columnStyle[status];
          const columnCases = cases.filter((c) => c.status === status);
          return (
            <div key={status} className="rounded-xl border p-2" style={{ background: style.bg, borderColor: style.border }}>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: style.dot }} />
                  <span className="text-[11px] font-bold" style={{ color: style.text }}>
                    {statusLabels[status]}
                  </span>
                </div>
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold"
                  style={{ color: style.text }}
                >
                  {columnCases.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {columnCases.length === 0 ? (
                  <p className="px-1 text-[10px] text-[#9aa3b2]">案件なし</p>
                ) : (
                  columnCases.map((c) => (
                    <CaseCard key={c.id} c={c} onStatusChange={onStatusChange} onAssigneeChange={onAssigneeChange} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
