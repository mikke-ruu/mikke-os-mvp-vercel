"use client";

// mikke AI OFFICE — localStorageベースの状態ストア。
// 将来SupabaseやAPIに差し替えるときは、このファイルの load/save と
// useOfficeStore の各アクション内部だけを置き換えればよい構造にしてある。
//
// 注意: setStateのアップデータは非同期に実行されるため、
// ログ追加は必ず同じアップデータ内で行う（外の変数に書き出して後で読まない）

import { useCallback, useEffect, useRef, useState } from "react";
import { executeAgentTask } from "./agent-runtime";
import { employeeById, initialState } from "./data";
import type {
  ActivityLogEntry,
  Artifact,
  ArtifactType,
  CaseStatus,
  ExecutionMode,
  ExecutionStatus,
  JobType,
  OfficeCase,
  OfficeState,
  Priority
} from "./types";

const STORAGE_KEY = "mikke-ai-office-v1";

/** 旧データ（フェーズ1-2）に実行レイヤーのフィールドを補うマイグレーション */
function normalizeCase(c: OfficeCase): OfficeCase {
  return {
    ...c,
    executionMode: c.executionMode ?? "mock",
    executionStatus: c.executionStatus ?? "idle",
    artifacts: Array.isArray(c.artifacts) ? c.artifacts : [],
    reviewRequired: c.reviewRequired ?? true
  };
}

function load(): OfficeState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as OfficeState;
    if (!Array.isArray(parsed.cases) || !Array.isArray(parsed.logs)) return initialState;
    return { ...parsed, cases: parsed.cases.map(normalizeCase) };
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

function makeLog(employeeId: string, message: string): ActivityLogEntry {
  return { id: makeId("log"), time: nowTime(), employeeId, message, createdAt: new Date().toISOString() };
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

export type CaseExecutionPatch = {
  executionMode?: ExecutionMode;
  instruction?: string;
  workDirectory?: string;
  reviewRequired?: boolean;
};

export function useOfficeStore() {
  const [state, setState] = useState<OfficeState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  // アンマウント後にsetStateしないためのフラグ（疑似実行のタイマー対策）
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setState(load());
    setHydrated(true);
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((updater: (prev: OfficeState) => OfficeState) => {
    if (!mounted.current) return;
    setState((prev) => {
      const next = updater(prev);
      save(next);
      return next;
    });
  }, []);

  const appendLog = useCallback(
    (employeeId: string, message: string) => {
      update((prev) => ({ ...prev, logs: [makeLog(employeeId, message), ...prev.logs].slice(0, 100) }));
    },
    [update]
  );

  /** 案件1件を更新し、必要ならログも同時に追加する共通ヘルパー */
  const patchCase = useCallback(
    (caseId: string, patcher: (c: OfficeCase) => { patch: Partial<OfficeCase>; log?: string } | null) => {
      update((prev) => {
        const target = prev.cases.find((c) => c.id === caseId);
        if (!target) return prev;
        const result = patcher(target);
        if (!result) return prev;
        const updated = { ...target, ...result.patch, updatedAt: new Date().toISOString() };
        return {
          cases: prev.cases.map((c) => (c.id === caseId ? updated : c)),
          logs: result.log ? [makeLog(updated.assigneeId, result.log), ...prev.logs].slice(0, 100) : prev.logs
        };
      });
    },
    [update]
  );

  const addCase = useCallback(
    (input: NewCaseInput) => {
      const now = new Date().toISOString();
      const newCase: OfficeCase = normalizeCase({
        id: makeId("case"),
        ...input,
        status: "reception",
        createdAt: now,
        updatedAt: now
      });
      const assignee = employeeById[input.assigneeId];
      update((prev) => ({
        cases: [newCase, ...prev.cases],
        logs: [
          makeLog(input.assigneeId, `案件を受付しました『${input.title}』（担当：${assignee?.name ?? "未定"}）`),
          ...prev.logs
        ].slice(0, 100)
      }));
      return newCase;
    },
    [update]
  );

  const setCaseStatus = useCallback(
    (caseId: string, status: CaseStatus) => {
      patchCase(caseId, (c) => {
        if (c.status === status) return null;
        const label = { reception: "受付に戻しました", working: "作業を開始しました", review: "確認待ちにしました", done: "完了しました" }[status];
        const patch: Partial<OfficeCase> = { status };
        if (status === "done") patch.executionStatus = "completed";
        return { patch, log: `『${c.title}』${label}` };
      });
    },
    [patchCase]
  );

  const setCaseAssignee = useCallback(
    (caseId: string, assigneeId: string) => {
      patchCase(caseId, (c) => {
        if (c.assigneeId === assigneeId) return null;
        return {
          patch: { assigneeId },
          log: `『${c.title}』の担当が${employeeById[assigneeId]?.name ?? "?"}に変わりました`
        };
      });
    },
    [patchCase]
  );

  /** 実行設定（モード・指示・作業フォルダなど）の更新 */
  const updateCaseExecution = useCallback(
    (caseId: string, execPatch: CaseExecutionPatch) => {
      patchCase(caseId, () => ({ patch: execPatch }));
    },
    [patchCase]
  );

  /** 成果物を追加する（manualモードの手動登録にも使う） */
  const addArtifact = useCallback(
    (caseId: string, artifact: { type: ArtifactType; title: string; content: string }) => {
      patchCase(caseId, (c) => {
        const entry: Artifact = { id: makeId("art"), createdAt: new Date().toISOString(), ...artifact };
        return {
          patch: { artifacts: [...(c.artifacts ?? []), entry] },
          log: `『${c.title}』に成果物「${artifact.title}」が登録されました`
        };
      });
    },
    [patchCase]
  );

  const setExecutionStatus = useCallback(
    (caseId: string, executionStatus: ExecutionStatus, log?: string) => {
      patchCase(caseId, () => ({ patch: { executionStatus }, log }));
    },
    [patchCase]
  );

  /**
   * 「作業開始」— 案件の実行モードに応じた疑似実行フロー。
   * queued → running → （成果物登録）→ waiting_review（案件は確認待ちへ）
   * 実際の外部実行は行わない。実行ポイントは agent-runtime.ts に集約。
   */
  const startCaseRun = useCallback(
    async (targetCase: OfficeCase) => {
      const employee = employeeById[targetCase.assigneeId];
      if (!employee) return;
      const mode = targetCase.executionMode ?? "mock";

      if (mode === "api") {
        appendLog(targetCase.assigneeId, `『${targetCase.title}』APIモードは未接続です（今後実装予定）`);
        return;
      }

      patchCase(targetCase.id, (c) => ({
        patch: { executionStatus: "queued", lastRunAt: new Date().toISOString() },
        log: `『${c.title}』を実行キューに入れました（${mode}モード）`
      }));

      await new Promise((resolve) => setTimeout(resolve, 800));
      patchCase(targetCase.id, (c) => ({
        patch: { executionStatus: "running", status: "working" },
        log: `『${c.title}』の作業を開始しました`
      }));

      const result = await executeAgentTask(
        { case: targetCase, employee, instruction: targetCase.instruction },
        mode
      );

      if (!result.ok) {
        patchCase(targetCase.id, () => ({
          patch: { executionStatus: "failed", lastRunSummary: result.message },
          log: result.message
        }));
        return;
      }

      patchCase(targetCase.id, (c) => {
        const artifacts = result.artifact
          ? [...(c.artifacts ?? []), { id: makeId("art"), createdAt: new Date().toISOString(), ...result.artifact }]
          : c.artifacts;
        return {
          patch: {
            executionStatus: "waiting_review",
            status: "review",
            artifacts,
            lastRunSummary: result.message
          },
          log: result.message
        };
      });
    },
    [patchCase, appendLog]
  );

  const resetOffice = useCallback(() => {
    save(initialState);
    setState(initialState);
  }, []);

  return {
    state,
    hydrated,
    addCase,
    setCaseStatus,
    setCaseAssignee,
    updateCaseExecution,
    addArtifact,
    setExecutionStatus,
    startCaseRun,
    appendLog,
    resetOffice
  };
}

export type OfficeStore = ReturnType<typeof useOfficeStore>;
