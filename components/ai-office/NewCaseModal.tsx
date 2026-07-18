"use client";

// mikke AI OFFICE — 新規案件作成モーダル：件名 / 概要 / 種類 / 優先度 / 担当（自動 or 指定） / 納期

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { defaultAssigneeByJobType, employees, jobTypeLabels, priorityLabels } from "@/lib/ai-office/data";
import type { NewCaseInput } from "@/lib/ai-office/store";
import type { JobType, Priority } from "@/lib/ai-office/types";

const fieldLabel = "mb-1 block text-xs font-bold text-[#4b5563]";
const fieldInput =
  "w-full rounded-lg border border-[#e3e6f0] bg-white px-3 py-2 text-sm text-[#1e2a4a] outline-none transition-shadow focus:border-[#e58f65] focus:ring-2 focus:ring-[#e58f65]/30";

export function NewCaseModal({
  open,
  onClose,
  onSubmit
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewCaseInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState<JobType>("course");
  const [priority, setPriority] = useState<Priority>("normal");
  const [assigneeId, setAssigneeId] = useState<string>("auto");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function submit() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      jobType,
      priority,
      assigneeId: assigneeId === "auto" ? defaultAssigneeByJobType[jobType] : assigneeId,
      dueDate: dueDate || undefined
    });
    setTitle("");
    setDescription("");
    setJobType("course");
    setPriority("normal");
    setAssigneeId("auto");
    setDueDate("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1e2a4a]/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#1e2a4a]">案件を新規作成</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#9aa3b2] transition-colors hover:bg-[#f6f7fb] hover:text-[#1e2a4a]"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className={fieldLabel}>件名</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：認定講座構築案件 / 第2章テキスト整形"
              className={fieldInput}
              autoFocus
            />
          </div>

          <div>
            <label className={fieldLabel}>案件概要</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="内容を簡単に記入してください"
              rows={3}
              className={fieldInput}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabel}>種類</label>
              <select value={jobType} onChange={(e) => setJobType(e.target.value as JobType)} className={fieldInput}>
                {Object.entries(jobTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>優先度</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={fieldInput}>
                {Object.entries(priorityLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={fieldLabel}>担当</label>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={fieldInput}>
              <option value="auto">自動（種類から選ぶ）</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}（{emp.role}）
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={fieldLabel}>納期（任意）</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldInput} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#e3e6f0] bg-white px-4 py-2 text-sm font-semibold text-[#4b5563] hover:bg-[#f6f7fb]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="rounded-full bg-[#e58f65] px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            作成する
          </button>
        </div>
      </div>
    </div>
  );
}
