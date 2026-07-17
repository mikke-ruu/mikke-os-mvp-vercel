"use client";

import { AlertTriangle, CheckCircle2, Database, Download, LoaderCircle, Upload } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import {
  readTeamWorksProjectStateFromDatabase,
  syncTeamWorksProjectStateToDatabase
} from "@/lib/team-works-database";
import type {
  TeamWorksProjectStoreState,
  TeamWorksProjectTemplateStoreState
} from "@/lib/team-works-projects";

type SyncState = {
  status: "idle" | "syncing" | "loading" | "success" | "error";
  message: string;
};

export function TeamWorksDatabaseSyncPanel({
  projectState,
  templateState,
  saveProjectState
}: {
  projectState: TeamWorksProjectStoreState;
  templateState: TeamWorksProjectTemplateStoreState;
  saveProjectState: (state: TeamWorksProjectStoreState) => void;
}) {
  const { profile } = useAuth();
  const [sync, setSync] = useState<SyncState>({ status: "idle", message: "" });
  const busy = sync.status === "syncing" || sync.status === "loading";

  async function pushToDatabase() {
    setSync({ status: "syncing", message: "" });
    try {
      const result = await syncTeamWorksProjectStateToDatabase({
        displayName: profile.display_name,
        projectState,
        templateState
      });
      const skipped = result.skippedResources > 0 ? ` 内容が空の資料${result.skippedResources}件は除外しました。` : "";
      setSync({
        status: "success",
        message: `案件${result.projects}件・タスク${result.tasks}件・資料${result.resources}件・フォーム${result.forms}件・成果物${result.deliverables}件をDBへ同期しました。${skipped}`
      });
    } catch (error) {
      setSync({ status: "error", message: databaseErrorMessage(error) });
    }
  }

  async function pullFromDatabase() {
    setSync({ status: "loading", message: "" });
    try {
      const result = await readTeamWorksProjectStateFromDatabase({
        localState: projectState
      });
      saveProjectState(result.state);
      setSync({
        status: "success",
        message: result.databaseProjects === 0
          ? "DBに同期済みの案件はまだありません。"
          : `DBの案件${result.databaseProjects}件を確認し、この端末の一致案件${result.matchedProjects}件を更新しました。`
      });
    } catch (error) {
      setSync({ status: "error", message: databaseErrorMessage(error) });
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 sm:p-5" aria-labelledby="team-works-database-sync-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-[var(--mikke-primary)]" />
            <h2 id="team-works-database-sync-title" className="text-sm font-bold">Supabase同期</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">
            ログイン中のオーナー組織へ、案件・タスク・内容のあるURL／メモ資料を同期します。
            工程・フォーム・成果物と、実ユーザーに未接続のデモ担当者は引き続きこの端末に保持します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={pullFromDatabase}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            {sync.status === "loading" ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
            DBから更新
          </button>
          <button
            type="button"
            onClick={pushToDatabase}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {sync.status === "syncing" ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
            この端末から同期
          </button>
        </div>
      </div>
      {sync.message ? (
        <p
          role="status"
          className={`mt-3 flex items-start gap-2 text-xs font-bold leading-5 ${sync.status === "error" ? "text-[var(--mikke-danger)]" : "text-[var(--mikke-success)]"}`}
        >
          {sync.status === "error" ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
          {sync.message}
        </p>
      ) : null}
    </section>
  );
}

function databaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return `同期できませんでした: ${error.message}`;
  return "同期できませんでした。ログイン状態と通信環境を確認してください。";
}
