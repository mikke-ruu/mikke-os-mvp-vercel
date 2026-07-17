"use client";

import { AlertCircle, CalendarDays, CheckCircle2, ChevronRight, FolderKanban, ListChecks } from "lucide-react";
import Link from "next/link";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { projectStatusLabels, useTeamWorksProjectStore } from "@/lib/team-works-projects";
import { createTeamWorksWorkerProjectList, TEAM_WORKS_WORKER_PORTAL_DEMO_WORKER_ID } from "@/lib/team-works-worker-projects";
import { useTeamWorksPortalActor } from "@/components/team-works/useTeamWorksPortalActor";

export function TeamWorksWorkerProjectList() {
  const { hydrated, projectState, saveProjectState } = useTeamWorksProjectStore();
  const actor = useTeamWorksPortalActor("worker", { projectState, saveProjectState });
  const actorMemberships = new Map(actor.memberships.map((membership) => [membership.sourceProjectId, { memberId: membership.memberId, memberName: membership.memberName }]));
  const projects = createTeamWorksWorkerProjectList(projectState, TEAM_WORKS_WORKER_PORTAL_DEMO_WORKER_ID, { memberships: actorMemberships });
  const taskCount = projects.reduce((sum, item) => sum + item.project.assignedTaskCount, 0);
  const actionCount = projects.reduce((sum, item) => sum + item.project.actionCount, 0);

  if (!hydrated || actor.status === "loading") return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">担当プロジェクトを読み込んでいます。</p>;
  if (actor.status === "error") return <MikkeEmptyState title="案件所属を確認できません" helper={actor.errorMessage} />;

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-bg)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">
        ログイン中の実アカウントに割り当てられた案件だけを表示しています。
      </p>
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="担当プロジェクト" value={`${projects.length}件`} icon={FolderKanban} />
        <SummaryCard label="担当タスク" value={`${taskCount}件`} icon={ListChecks} />
        <SummaryCard label="今やること" value={`${actionCount}件`} icon={AlertCircle} attention={actionCount > 0} />
      </section>

      <section>
        <div className="mb-4"><h2 className="text-lg font-bold">担当プロジェクト</h2><p className="mt-1 text-sm text-[var(--mikke-muted)]">自分が参加している案件だけを表示しています。</p></div>
        {projects.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {projects.map(({ project }) => (
              <Link key={project.id} href={`/apps/team-works/portal/worker/projects/${project.id}`} className="group rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5 transition hover:border-[var(--mikke-primary-border)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><MikkeStatusBadge tone={project.status === "completed" ? "success" : "primary"} className="px-2 py-1">{projectStatusLabels[project.status]}</MikkeStatusBadge><h3 className="mt-3 text-lg font-bold">{project.name}</h3>{project.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{project.description}</p> : null}</div>
                  <ChevronRight size={20} className="shrink-0 text-[var(--mikke-muted)] transition group-hover:translate-x-0.5" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs"><ProjectFact label="現在の工程" value={project.currentPhaseName} /><ProjectFact label="担当タスク" value={`${project.assignedTaskCount}件`} /><ProjectFact label="期限" value={formatDate(project.dueDate)} /></div>
                <div className="mt-4 flex items-center justify-between text-xs font-bold"><span>全体進捗</span><span className="text-[var(--mikke-accent)]">{project.progressPercent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]"><div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${project.progressPercent}%` }} /></div>
                {project.actionCount > 0 || project.delayedTaskCount > 0 ? <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[var(--mikke-accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--mikke-accent)]">今やること {project.actionCount}件</span>{project.delayedTaskCount > 0 ? <span className="rounded-full border border-[var(--mikke-line)] px-2.5 py-1 text-xs font-bold text-[var(--mikke-danger)]">期限超過 {project.delayedTaskCount}件</span> : null}</div> : <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[var(--mikke-success)]"><CheckCircle2 size={15} /> 現在の対応事項はありません</div>}
              </Link>
            ))}
          </div>
        ) : <MikkeEmptyState title="担当プロジェクトはありません" helper="プロジェクトへ参加すると、担当の工程とタスクがここに表示されます。" />}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, attention = false }: { label: string; value: string; icon: typeof FolderKanban; attention?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${attention ? "border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)] bg-[var(--mikke-surface)]"}`}><Icon size={18} className={attention ? "text-[var(--mikke-accent)]" : "text-[var(--mikke-primary)]"} /><p className="mt-3 text-xs font-bold text-[var(--mikke-muted)]">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function ProjectFact({ label, value }: { label: string; value: string }) { return <div><p className="font-bold text-[var(--mikke-muted)]">{label}</p><p className="mt-1 truncate font-bold text-[var(--mikke-text)]">{value}</p></div>; }
function formatDate(value: string) { if (!value) return "未設定"; return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`)); }
