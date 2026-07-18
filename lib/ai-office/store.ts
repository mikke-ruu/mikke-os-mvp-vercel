"use client";

// mikke AI OFFICE — localStorageベースの状態ストア。
// 将来SupabaseやAPIに差し替えるときは、このファイルの load/save と
// useOfficeStore の各アクション内部だけを置き換えればよい構造にしてある。

import { useCallback, useEffect, useState } from "react";
import { employeeById, initialState } from "./data";
import type { ActivityLogEntry, CaseStatus, JobType, OfficeCase, OfficeState, Priority } from "./types";

const STORAGE_KEY = "mikke-ai-office-v1";

function load(): OfficeState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as OfficeState;
    if (!Array.isArray(parsed.cases) || !Array.isArray(parsed.logs)) return initialState;
    return parsed;
  } catch {
    return initialState;
  }
}

function save(state: OfficeState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存失敗（容量超過など）はMVPでは無視
  }
}

function nowTime(): string {
  return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export type NewCaseInput = {
  title: string;
  description: string;
  jobType: JobType;
  priority: Priority;
  assigneeId: string;
  team?: string;
  dueDate?: string;
};

export function useOfficeStore() {
  const [state, setState] = useState<OfficeState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  // 初回マウント時にlocalStorageから復元（SSRとのhydration不一致を避ける）
  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  const update = useCallback((updater: (prev: OfficeState) => OfficeState) => {
    setState((prev) => {
      const next = updater(prev);
      save(next);
      return next;
    });
  }, []);

  const appendLog = useCallback(
    (employeeId: string, message: string) => {
      update((prev) => ({
        ...prev,
        logs: [
          { id: makeId("log"), time: nowTime(), employeeId, message, createdAt: new Date().toISOString() },
          ...prev.logs
        ].slice(0, 100)
      }));
    },
    [update]
  );

  const addCase = useCallback(
    (input: NewCaseInput) => {
      const now = new Date().toISOString();
      const newCase: OfficeCase = {
        id: makeId("case"),
        ...input,
        status: "reception",
        createdAt: now,
        updatedAt: now
      };
      update((prev) => ({ ...prev, cases: [newCase, ...prev.cases] }));
      const assignee = employeeById[input.assigneeId];
      appendLog(input.assigneeId, `案件を受付しました『${input.title}』（担当：${assignee?.name ?? "未定"}）`);
      return newCase;
    },
    [update, appendLog]
  );

  // 注意: setStateのアップデータは非同期に実行されるため、
  // ログ追加は必ず同じアップデータ内で行う（外の変数に書き出して後で読まない）
  const setCaseStatus = useCallback(
    (caseId: string, status: CaseStatus) => {
      update((prev) => {
        const target = prev.cases.find((c) => c.id === caseId);
        if (!target || target.status === status) return prev;
        const label = { reception: "受付に戻しました", working: "作業を開始しました", review: "確認待ちにしました", done: "完了しました" }[status];
        const entry: ActivityLogEntry = {
          id: makeId("log"),
          time: nowTime(),
          employeeId: target.assigneeId,
          message: `『${target.title}』${label}`,
          createdAt: new Date().toISOString()
        };
        return {
          cases: prev.cases.map((c) => (c.id === caseId ? { ...c, status, updatedAt: new Date().toISOString() } : c)),
          logs: [entry, ...prev.logs].slice(0, 100)
        };
      });
    },
    [update]
  );

  const setCaseAssignee = useCallback(
    (caseId: string, assigneeId: string) => {
      update((prev) => {
        const target = prev.cases.find((c) => c.id === caseId);
        if (!target || target.assigneeId === assigneeId) return prev;
        const entry: ActivityLogEntry = {
          id: makeId("log"),
          time: nowTime(),
          employeeId: assigneeId,
          message: `『${target.title}』の担当が${employeeById[assigneeId]?.name ?? "?"}に変わりました`,
          createdAt: new Date().toISOString()
        };
        return {
          cases: prev.cases.map((c) => (c.id === caseId ? { ...c, assigneeId, updatedAt: new Date().toISOString() } : c)),
          logs: [entry, ...prev.logs].slice(0, 100)
        };
      });
    },
    [update]
  );

  const resetOffice = useCallback(() => {
    save(initialState);
    setState(initialState);
  }, []);

  return { state, hydrated, addCase, setCaseStatus, setCaseAssignee, appendLog, resetOffice };
}

export type OfficeStore = ReturnType<typeof useOfficeStore>;
