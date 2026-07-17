"use client";

import { AlertCircle, CalendarClock, CheckCircle2, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MetricCard } from "@/components/mikkeos/MetricCard";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  projectStatusLabels,
  useTeamWorksProjectStore,
  type Project,
  type ProjectStatus
} from "@/lib/team-works-projects";
import { teamWorksInitialState } from "@/lib/team-works";
import { TeamWorksDatabaseSyncPanel } from "./TeamWorksDatabaseSyncPanel";

type ProjectFilter = "active" | "review" | "due" | "completed" | "on_hold" | "all";

const filters: { value: ProjectFilter; label: string }[] = [
  { value: "active", label: "進行中" },
  { value: "review", label: "確認待ち" },
  { value: "due", label: "納期が近い" },
  { value: "completed", label: "完了" },
  { value: "on_hold", label: "保留" },
  { value: "all", label: "すべて" }
];

const actionRequiredStatuses = new Set(["client_response_pending", "internal_review_pending", "revision_requested"]);

export function TeamWorksProjectsList() {
  const { hydrated, projectState, templateState, saveProjectState } = useTeamWorksProjectStore();
  const [filter, setFilter] = useState<ProjectFilter>("active");
  const sortedProjects = useMemo(
    () => [...projectState.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projectState.projects]
  );
  const filteredProjects = sortedProjects.filter((project) => matchesFilter(project, filter));
  const activeCount = sortedProjects.filter((project) => ["preparing", "in_progress", "delivery_preparation"].includes(project.status)).length;
  const reviewCount = sortedProjects.filter((project) => ["client_review", "internal_review"].includes(project.status)).length;
  const dueCount = sortedProjects.filter((project) => isDueSoon(project)).length;
  const actionCount = projectState.tasks.filter((task) => actionRequiredStatuses.has(task.status)).length;

  if (!hydrated) return <p className="text-sm text-[var(--mikke-muted)]">プロジェクトを読み込んでいます。</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-[var(--mikke-muted)]">
          案件ごとの工程・タスク・担当・納期をまとめます。テンプレートを使わない空のプロジェクトから始められます。
        </p>
        <Link
          href="/apps/team-works/projects/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white"
        >
          <Plus size={16} /> 新しいプロジェクト
        </Link>
      </div>

      <TeamWorksDatabaseSyncPanel
        projectState={projectState}
        templateState={templateState}
        saveProjectState={saveProjectState}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="プロジェクトの概要">
        <MetricCard label="進行中" value={`${activeCount}件`} helper="準備・納品準備を含む" tone="navy" />
        <MetricCard label="確認待ち" value={`${reviewCount}件`} helper="双方の確認待ち" tone="orange" />
        <MetricCard label="納期が近い" value={`${dueCount}件`} helper="14日以内" tone="gray" />
        <MetricCard label="対応が必要" value={`${actionCount}件`} helper="回答・確認・修正" tone="green" />
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="プロジェクトの絞り込み">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold ${
              filter === item.value
                ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white"
                : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filteredProjects.length > 0 ? (
        <div className="divide-y divide-[var(--mikke-line)] border-y border-[var(--mikke-line)]">
          {filteredProjects.map((project) => (
            <ProjectRow key={project.id} project={project} projectState={projectState} />
          ))}
        </div>
      ) : (
        <MikkeEmptyState title="この条件のプロジェクトはありません" helper="絞り込みを変えるか、新しいプロジェクトを作成してください。" />
      )}
    </div>
  );
}

function ProjectRow({
  project,
  projectState
}: {
  project: Project;
  projectState: ReturnType<typeof useTeamWorksProjectStore>["projectState"];
}) {
  const phases = projectState.phases.filter((phase) => phase.projectId === project.id).sort((a, b) => a.position - b.position);
  const currentPhase = phases.find((phase) => phase.status !== "completed") ?? phases.at(-1);
  const tasks = projectState.tasks.filter((task) => task.projectId === project.id);
  const actionCount = tasks.filter((task) => actionRequiredStatuses.has(task.status)).length;
  const leader = projectState.projectMembers.find((member) => member.id === project.leaderMemberId);

  return (
    <article className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <MikkeStatusBadge tone={statusTone(project.status)} className="px-2 py-1">
              {projectStatusLabels[project.status]}
            </MikkeStatusBadge>
            <span className="text-xs font-bold text-[var(--mikke-muted)]">{clientLabel(project.clientId)}</span>
          </div>
          <h2 className="mt-2 text-lg font-bold tracking-normal">{project.name}</h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{project.description || project.goal}</p>
        </div>
        <Link
          href={`/apps/team-works/projects/${project.id}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]"
        >
          <FolderKanban size={15} /> 詳細を開く
        </Link>
      </div>

      <div className="mt-4 grid gap-3 text-xs font-semibold text-[var(--mikke-muted)] sm:grid-cols-2 lg:grid-cols-4">
        <span>現在の工程: <strong className="text-[var(--mikke-text)]">{currentPhase?.name ?? "未設定"}</strong></span>
        <span>リーダー: <strong className="text-[var(--mikke-text)]">{leader?.displayName ?? "未設定"}</strong></span>
        <span className="inline-flex items-center gap-1"><CalendarClock size={14} /> 納期 {formatDate(project.dueDate)}</span>
        <span className={`inline-flex items-center gap-1 ${actionCount > 0 ? "text-[var(--mikke-accent)]" : ""}`}>
          {actionCount > 0 ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          対応が必要 {actionCount}件
        </span>
      </div>

      <div className="mt-4 max-w-3xl">
        <div className="flex items-center justify-between text-xs font-bold">
          <span>全体進捗</span>
          <span className="text-[var(--mikke-accent)]">{project.progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]">
          <div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${project.progressPercent}%` }} />
        </div>
      </div>
    </article>
  );
}

function matchesFilter(project: Project, filter: ProjectFilter) {
  if (filter === "all") return true;
  if (filter === "active") return ["preparing", "in_progress", "delivery_preparation"].includes(project.status);
  if (filter === "review") return ["client_review", "internal_review"].includes(project.status);
  if (filter === "due") return isDueSoon(project);
  if (filter === "completed") return project.status === "completed";
  return project.status === "on_hold";
}

function isDueSoon(project: Project) {
  if (!project.dueDate || ["completed", "cancelled"].includes(project.status)) return false;
  const due = new Date(`${project.dueDate}T23:59:59`).getTime();
  const remainingDays = (due - Date.now()) / 86_400_000;
  return remainingDays >= 0 && remainingDays <= 14;
}

function statusTone(status: ProjectStatus): "success" | "primary" | "muted" {
  if (status === "completed") return "success";
  if (["draft", "cancelled", "on_hold"].includes(status)) return "muted";
  return "primary";
}

function clientLabel(clientId: string) {
  if (clientId === "client_demo") return "サンプル依頼元";
  return teamWorksInitialState.clients.find((client) => client.id === clientId)?.name ?? "クライアント未設定";
}

function formatDate(value: string) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
