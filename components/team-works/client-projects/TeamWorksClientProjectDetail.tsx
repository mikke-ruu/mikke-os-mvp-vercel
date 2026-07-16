"use client";

import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, FileCheck2, ListChecks } from "lucide-react";
import Link from "next/link";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  createTeamWorksClientProjectDetail,
  TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID,
  type ClientProjectDeliverableView
} from "@/lib/team-works-client-projects";
import {
  projectDeliverableStatusLabels,
  projectPhaseStatusLabels,
  projectStatusLabels,
  projectTaskStatusLabels,
  useTeamWorksProjectStore
} from "@/lib/team-works-projects";

export function TeamWorksClientProjectDetail({ projectId }: { projectId: string }) {
  const { hydrated, projectState } = useTeamWorksProjectStore();
  const detail = createTeamWorksClientProjectDetail(projectState, TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID, projectId);

  if (!hydrated) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">共有プロジェクトを読み込んでいます。</p>;
  if (!detail) {
    return (
      <div className="space-y-4">
        <MikkeEmptyState title="このプロジェクトは表示できません" helper="共有が終了したか、閲覧できるプロジェクトではありません。" />
        <Link href="/apps/team-works/portal/client/projects" className="mx-auto flex w-fit items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><ArrowLeft size={16} /> 一覧へ戻る</Link>
      </div>
    );
  }

  const { project, phases, tasks, actions, reviewDeliverables, approvedDeliverables } = detail;

  return (
    <div className="space-y-6">
      <Link href="/apps/team-works/portal/client/projects" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-primary)]"><ArrowLeft size={15} /> プロジェクト一覧</Link>

      <section className="border-b border-[var(--mikke-line)] pb-5">
        <MikkeStatusBadge tone={project.status === "completed" ? "success" : project.status === "on_hold" ? "muted" : "primary"} className="px-2 py-1">
          {projectStatusLabels[project.status]}
        </MikkeStatusBadge>
        <h2 className="mt-3 text-2xl font-bold tracking-normal">{project.name}</h2>
        {project.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mikke-text-soft)]">{project.description}</p> : null}
      </section>

      <MikkeSection title="あなたが今やること">
        {actions.length > 0 ? (
          <div className="space-y-2">
            {actions.map((action) => (
              <div key={`${action.kind}-${action.id}`} className="flex items-start gap-3 rounded-lg border border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] p-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--mikke-accent)]" />
                <div>
                  <p className="text-sm font-bold">{action.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{action.helper}{action.dueDate ? `・期限 ${formatDate(action.dueDate)}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-[var(--mikke-success-soft)] p-4 text-[var(--mikke-success)]"><CheckCircle2 size={20} /><p className="text-sm font-bold">現在、対応が必要な項目はありません。</p></div>
        )}
      </MikkeSection>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="全体進捗" value={`${project.progressPercent}%`} icon={CheckCircle2} />
        <SummaryCard label="現在の工程" value={project.currentPhaseName} icon={ListChecks} />
        <SummaryCard label="納期" value={formatDate(project.dueDate)} icon={CalendarDays} />
      </section>

      <MikkeSection title="目的・完成条件">
        <p className="text-sm leading-7 text-[var(--mikke-text-soft)]">{project.goal || "完成条件はまだ共有されていません。"}</p>
      </MikkeSection>

      <MikkeSection title="工程と対応内容">
        {phases.length > 0 ? (
          <div className="space-y-4">
            {phases.map((phase) => {
              const phaseTasks = tasks.filter((task) => task.phaseId === phase.id);
              return (
                <article key={phase.id} className="rounded-lg border border-[var(--mikke-line)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[var(--mikke-muted)]">工程 {phase.position + 1}</p>
                      <h3 className="mt-1 text-base font-bold">{phase.name}</h3>
                      {phase.description ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{phase.description}</p> : null}
                    </div>
                    <MikkeStatusBadge tone={phase.status === "completed" ? "success" : phase.status === "not_started" ? "muted" : "primary"} className="px-2 py-1">{projectPhaseStatusLabels[phase.status]}</MikkeStatusBadge>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-bold"><span>工程進捗</span><span>{phase.progressPercent}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]"><div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${phase.progressPercent}%` }} /></div>
                  {phaseTasks.length > 0 ? (
                    <div className="mt-4 divide-y divide-[var(--mikke-line)] border-t border-[var(--mikke-line)]">
                      {phaseTasks.map((task) => (
                        <div key={task.id} className="flex flex-col gap-2 py-3 first:pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-bold">{task.title}</p>
                            {task.description ? <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{task.description}</p> : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]"><span>{formatDate(task.dueDate)}</span><span className="rounded-full bg-[var(--mikke-bg)] px-2 py-1">{projectTaskStatusLabels[task.status]}</span></div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : <MikkeEmptyState title="共有中の工程はありません" />}
      </MikkeSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <DeliverableSection title="確認する成果物" items={reviewDeliverables} empty="確認待ちの成果物はありません。" />
        <DeliverableSection title="承認済み・納品済み" items={approvedDeliverables} empty="承認済みの成果物はまだありません。" />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CheckCircle2 }) {
  return <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4"><Icon size={18} className="text-[var(--mikke-primary)]" /><p className="mt-3 text-xs font-bold text-[var(--mikke-muted)]">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>;
}

function DeliverableSection({ title, items, empty }: { title: string; items: ClientProjectDeliverableView[]; empty: string }) {
  return (
    <MikkeSection title={title}>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-lg border border-[var(--mikke-line)] p-3">
              <div className="flex items-start gap-3">
                <FileCheck2 size={18} className="mt-0.5 shrink-0 text-[var(--mikke-primary)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-xs text-[var(--mikke-muted)]">Ver.{item.version}・{projectDeliverableStatusLabels[item.status]}</p>
                </div>
                {item.type === "url" && item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">開く <ExternalLink size={13} /></a> : null}
              </div>
            </article>
          ))}
        </div>
      ) : <p className="text-sm text-[var(--mikke-muted)]">{empty}</p>}
    </MikkeSection>
  );
}

function formatDate(value: string) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
