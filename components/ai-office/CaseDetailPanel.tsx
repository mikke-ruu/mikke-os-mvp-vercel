"use client";

// TODO(sonnet): docs/MIKKEOS_AI_OFFICE_MVP_SPEC.md フェーズ3に従って見た目を実装する。
// 案件詳細パネル（右スライドオーバー）：案件情報＋実行設定＋成果物＋実行ボタン。
// このスタブは機能配線済み。UI（レイアウト・装飾・スライドイン演出）を仕上げること。

import { useState } from "react";
import {
  artifactTypeLabels,
  employeeById,
  executionModeDescriptions,
  executionModeLabels,
  executionStatusLabels,
  jobTypeLabels,
  priorityLabels,
  statusLabels
} from "@/lib/ai-office/data";
import type { CaseExecutionPatch } from "@/lib/ai-office/store";
import type { CaseStatus, ExecutionMode, OfficeCase } from "@/lib/ai-office/types";

const executionModes: ExecutionMode[] = ["mock", "manual", "codex", "api"];

export function CaseDetailPanel({
  c,
  onClose,
  onUpdateExecution,
  onStartRun,
  onStatusChange
}: {
  /** 表示する案件。nullなら非表示 */
  c: OfficeCase | null;
  onClose: () => void;
  onUpdateExecution: (caseId: string, patch: CaseExecutionPatch) => void;
  onStartRun: (c: OfficeCase) => void;
  onStatusChange: (caseId: string, status: CaseStatus) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!c) return null;
  const assignee = employeeById[c.assigneeId];
  const mode = c.executionMode ?? "mock";
  const execStatus = c.executionStatus ?? "idle";
  const running = execStatus === "queued" || execStatus === "running";

  function requestRun() {
    setConfirming(true);
  }

  function confirmRun() {
    setConfirming(false);
    if (c) onStartRun(c);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#1e2a4a]/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-extrabold text-[#1e2a4a]">{c.title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-[#9aa3b2]">
            閉じる
          </button>
        </div>

        <dl className="mt-3 space-y-1 text-xs text-[#4b5563]">
          <div>概要：{c.description || "—"}</div>
          <div>種類：{jobTypeLabels[c.jobType]} ／ 優先度：{priorityLabels[c.priority]}</div>
          <div>担当：{assignee?.name ?? "未定"} ／ 状態：{statusLabels[c.status]}</div>
          <div>実行状態：{executionStatusLabels[execStatus]}</div>
          {c.lastRunSummary ? <div>前回実行：{c.lastRunSummary}</div> : null}
        </dl>

        {/* 実行設定 */}
        <section className="mt-4">
          <h3 className="text-sm font-bold text-[#1e2a4a]">実行設定</h3>
          <select
            value={mode}
            onChange={(e) => onUpdateExecution(c.id, { executionMode: e.target.value as ExecutionMode })}
            className="mt-2 w-full rounded-lg border border-[#e3e6f0] p-2 text-sm"
          >
            {executionModes.map((m) => (
              <option key={m} value={m}>
                {executionModeLabels[m]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-[#9aa3b2]">{executionModeDescriptions[mode]}</p>
          <textarea
            value={c.instruction ?? ""}
            onChange={(e) => onUpdateExecution(c.id, { instruction: e.target.value })}
            placeholder="実行指示（例：第1章の本文を読みやすく整形して構成案を作る）"
            rows={3}
            className="mt-2 w-full rounded-lg border border-[#e3e6f0] p-2 text-sm"
          />
          <input
            value={c.workDirectory ?? ""}
            onChange={(e) => onUpdateExecution(c.id, { workDirectory: e.target.value })}
            placeholder="作業フォルダ（任意・将来のClaude Code接続用）"
            className="mt-2 w-full rounded-lg border border-[#e3e6f0] p-2 text-sm"
          />
        </section>

        {/* 実行ボタン群 */}
        <section className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={requestRun}
            disabled={running || mode === "api"}
            className="rounded-full bg-[#e58f65] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {running ? "実行中…" : "作業を開始"}
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(c.id, "review")}
            disabled={c.status === "review" || c.status === "done"}
            className="rounded-full border border-[#e3e6f0] px-4 py-2 text-sm disabled:opacity-40"
          >
            確認待ちに送る
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(c.id, "done")}
            disabled={c.status === "done"}
            className="rounded-full border border-[#e3e6f0] px-4 py-2 text-sm disabled:opacity-40"
          >
            完了にする
          </button>
        </section>

        {/* 実行前確認ダイアログ（安全策：自動で外部実行はしない） */}
        {confirming ? (
          <div className="mt-3 rounded-xl border border-[#f3caa4] bg-[#fff3ea] p-3 text-sm">
            <p className="font-bold text-[#c06a2e]">この案件の作業を開始しますか？</p>
            <p className="mt-1 text-[11px] text-[#4b5563]">{executionModeDescriptions[mode]}。外部への自動実行は行われません。</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={confirmRun} className="rounded-full bg-[#e58f65] px-3 py-1.5 text-xs font-bold text-white">
                開始する
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-[#e3e6f0] px-3 py-1.5 text-xs">
                やめる
              </button>
            </div>
          </div>
        ) : null}

        {/* 成果物 */}
        <section className="mt-4">
          <h3 className="text-sm font-bold text-[#1e2a4a]">成果物（{c.artifacts?.length ?? 0}件）</h3>
          {(c.artifacts ?? []).length === 0 ? (
            <p className="mt-1 text-xs text-[#9aa3b2]">まだ成果物はありません</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {(c.artifacts ?? []).map((a) => (
                <li key={a.id} className="rounded-xl border border-[#e3e6f0] p-2 text-xs">
                  <p className="font-bold">
                    {a.title}
                    <span className="ml-1 text-[10px] text-[#9aa3b2]">[{artifactTypeLabels[a.type]}]</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[#4b5563]">{a.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
