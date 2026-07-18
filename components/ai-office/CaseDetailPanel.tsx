"use client";

// mikke AI OFFICE — 案件詳細パネル（右スライドオーバー）。
// 案件情報＋実行設定（モード/指示/作業フォルダ）＋成果物＋実行ボタン。
// 機能配線はフェーズ3でFable側が実装済み。ここではUI（レイアウト・装飾・演出）を実装。

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Info, Play, PlugZap, Send, X } from "lucide-react";
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
import type { ArtifactType, CaseStatus, ExecutionMode, OfficeCase } from "@/lib/ai-office/types";
import { executionBadgeClass, formatTime } from "./office-helpers";

const executionModes: ExecutionMode[] = ["mock", "manual", "codex", "api"];

const statusChipClass: Record<CaseStatus, string> = {
  reception: "bg-[#eef4ff] text-[#2554c7]",
  working: "bg-[#fff3ea] text-[#c06a2e]",
  review: "bg-[#fffbe8] text-[#9c7d1a]",
  done: "bg-[#eefbf1] text-[#227a44]"
};

const artifactBadgeClass: Record<ArtifactType, string> = {
  text: "bg-[#eef4ff] text-[#2554c7]",
  html: "bg-[#fff3ea] text-[#c06a2e]",
  layout: "bg-[#f3effa] text-[#7d6b91]",
  "build-json": "bg-[#e9edf6] text-[#1e2a4a]",
  "image-brief": "bg-[#fdeef4] text-[#c76b98]",
  notes: "bg-[#eefbf1] text-[#227a44]"
};

const fieldLabel = "mb-1 block text-xs font-bold text-[#4b5563]";
const fieldInput =
  "w-full rounded-lg border border-[#e3e6f0] bg-white px-3 py-2 text-sm text-[#1e2a4a] outline-none transition-shadow focus:border-[#e58f65] focus:ring-2 focus:ring-[#e58f65]/30";

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
  const artifacts = c.artifacts ?? [];

  function requestRun() {
    setConfirming(true);
  }

  function confirmRun() {
    setConfirming(false);
    if (c) onStartRun(c);
  }

  return (
    <div className="ai-office-fadein fixed inset-0 z-40 flex justify-end bg-[#1e2a4a]/30" onClick={onClose}>
      <aside
        className="ai-office-slidein flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[#e3e6f0] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="sticky top-0 z-10 border-b border-[#f0f1f6] bg-white/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-extrabold leading-snug text-[#1e2a4a]">{c.title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#9aa3b2] transition-colors hover:bg-[#f6f7fb] hover:text-[#1e2a4a]"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusChipClass[c.status]}`}>
              {statusLabels[c.status]}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${executionBadgeClass[execStatus]}`}>
              {execStatus === "running" && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />}
              実行：{executionStatusLabels[execStatus]}
            </span>
            <span className="rounded-full bg-[#f2f3f7] px-2 py-0.5 text-[10px] font-bold text-[#6b7280]">
              {jobTypeLabels[c.jobType]}
            </span>
          </div>
        </div>

        <div className="flex-1 px-5 pb-6">
          {/* 案件情報 */}
          <section className="mt-4 rounded-xl border border-[#f0f1f6] bg-[#fafbfd] p-3">
            <p className="text-xs leading-relaxed text-[#4b5563]">{c.description || "（概要は未入力です）"}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#4b5563]">
              <div className="flex items-center gap-1.5">
                <dt className="text-[#9aa3b2]">担当</dt>
                <dd className="flex items-center gap-1 font-semibold">
                  <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ background: assignee?.color ?? "#9aa3b2" }} />
                  {assignee?.name ?? "未定"}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-[#9aa3b2]">優先度</dt>
                <dd className="font-semibold">{priorityLabels[c.priority]}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-[#9aa3b2]">チーム</dt>
                <dd className="font-semibold">{c.team ?? "—"}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-[#9aa3b2]">納期</dt>
                <dd className="font-semibold">{c.dueDate ?? "—"}</dd>
              </div>
            </dl>
            {c.lastRunSummary && (
              <p className="mt-2 border-t border-[#f0f1f6] pt-2 text-[11px] text-[#6b7280]">
                前回実行{c.lastRunAt ? `（${formatTime(c.lastRunAt)}）` : ""}：{c.lastRunSummary}
              </p>
            )}
          </section>

          {/* 実行設定 */}
          <section className="mt-4">
            <h3 className="text-sm font-bold text-[#1e2a4a]">実行設定</h3>
            <div className="mt-2">
              <label className={fieldLabel}>実行モード</label>
              <select
                value={mode}
                onChange={(e) => onUpdateExecution(c.id, { executionMode: e.target.value as ExecutionMode })}
                className={fieldInput}
              >
                {executionModes.map((m) => (
                  <option key={m} value={m}>
                    {executionModeLabels[m]}
                  </option>
                ))}
              </select>
              <p className="mt-1 flex items-start gap-1 text-[11px] text-[#9aa3b2]">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                {executionModeDescriptions[mode]}
              </p>
            </div>

            {/* codex選択時の注意書き（目立たせる） */}
            {mode === "codex" && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-[#c7d2fe] bg-[#f5f7ff] p-3">
                <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-[#1e2a4a]" />
                <div>
                  <p className="text-xs font-bold text-[#1e2a4a]">これは将来Claude Code接続用のモードです</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#4b5563]">
                    現在は疑似実行のみ。実行の流れ（キュー待ち→実行中→レビュー待ち）と成果物登録を確認できます。
                  </p>
                </div>
              </div>
            )}

            {/* api未接続表示 */}
            {mode === "api" && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-[#e3e6f0] bg-[#f6f7fb] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9aa3b2]" />
                <div>
                  <p className="text-xs font-bold text-[#6b7280]">
                    APIモードは未接続です
                    <span className="ml-1.5 rounded-full bg-[#e3e6f0] px-1.5 py-0.5 text-[9px] font-bold text-[#6b7280]">未接続</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#9aa3b2]">接続されるまで実行ボタンは使えません。</p>
                </div>
              </div>
            )}

            <div className="mt-3">
              <label className={fieldLabel}>実行指示</label>
              <textarea
                value={c.instruction ?? ""}
                onChange={(e) => onUpdateExecution(c.id, { instruction: e.target.value })}
                placeholder="例：第1章の本文を読みやすく整形して構成案を作る"
                rows={3}
                className={fieldInput}
              />
            </div>
            <div className="mt-3">
              <label className={fieldLabel}>作業フォルダ（任意）</label>
              <input
                value={c.workDirectory ?? ""}
                onChange={(e) => onUpdateExecution(c.id, { workDirectory: e.target.value })}
                placeholder="将来のClaude Code接続用。今は保存のみ"
                className={fieldInput}
              />
            </div>
          </section>

          {/* 実行ボタン群 */}
          <section className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestRun}
              disabled={running || mode === "api"}
              className="flex items-center gap-1.5 rounded-full bg-[#e58f65] px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              <Play className="h-4 w-4" />
              {running ? "実行中…" : "作業を開始"}
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(c.id, "review")}
              disabled={c.status === "review" || c.status === "done"}
              className="flex items-center gap-1.5 rounded-full border border-[#e3e6f0] bg-white px-4 py-2 text-sm font-semibold text-[#1e2a4a] hover:bg-[#f6f7fb] disabled:opacity-40"
            >
              <Send className="h-4 w-4 text-[#d9a441]" />
              確認待ちに送る
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(c.id, "done")}
              disabled={c.status === "done"}
              className="flex items-center gap-1.5 rounded-full border border-[#e3e6f0] bg-white px-4 py-2 text-sm font-semibold text-[#1e2a4a] hover:bg-[#f6f7fb] disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4 text-[#4caf6e]" />
              完了にする
            </button>
          </section>

          {/* 成果物 */}
          <section className="mt-5">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#1e2a4a]">
              <FileText className="h-4 w-4 text-[#e58f65]" />
              成果物（{artifacts.length}件）
            </h3>
            {artifacts.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-[#e3e6f0] p-3 text-center text-xs text-[#9aa3b2]">
                まだ成果物はありません。「作業を開始」で実行すると、ここに成果物が届きます。
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {artifacts.map((a) => (
                  <li key={a.id} className="rounded-xl border border-[#e3e6f0] bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1.5">
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${artifactBadgeClass[a.type]}`}>
                          {artifactTypeLabels[a.type]}
                        </span>
                        <span className="truncate text-xs font-bold text-[#1e2a4a]">{a.title}</span>
                      </p>
                      <span className="shrink-0 text-[10px] text-[#9aa3b2]">{formatTime(a.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#fafbfd] p-2 text-[11px] leading-relaxed text-[#4b5563]">
                      {a.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 実行前確認ダイアログ（安全策：自動で外部実行はしない） */}
        {confirming && (
          <div
            className="ai-office-fadein absolute inset-0 z-20 flex items-center justify-center bg-[#1e2a4a]/25 p-6"
            onClick={() => setConfirming(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-[#f3caa4] bg-white p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <p className="flex items-center gap-2 text-sm font-extrabold text-[#1e2a4a]">
                <Play className="h-4 w-4 text-[#e58f65]" />
                この案件の作業を開始しますか？
              </p>
              <div className="mt-2 rounded-lg bg-[#fff3ea] p-2.5">
                <p className="text-[11px] font-bold text-[#c06a2e]">
                  {executionModeLabels[mode]}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#4b5563]">{executionModeDescriptions[mode]}</p>
              </div>
              {c.instruction && (
                <p className="mt-2 truncate text-[11px] text-[#6b7280]">指示：{c.instruction}</p>
              )}
              <p className="mt-2 text-[10px] text-[#9aa3b2]">外部への自動実行は行われません。</p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-full border border-[#e3e6f0] bg-white px-4 py-1.5 text-xs font-semibold text-[#4b5563] hover:bg-[#f6f7fb]"
                >
                  やめる
                </button>
                <button
                  type="button"
                  onClick={confirmRun}
                  className="rounded-full bg-[#e58f65] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.03]"
                >
                  開始する
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
