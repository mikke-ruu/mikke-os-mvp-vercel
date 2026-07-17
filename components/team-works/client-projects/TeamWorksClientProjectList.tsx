"use client";

import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, FolderKanban, PackageCheck } from "lucide-react";
import Link from "next/link";
import { MetricCard } from "@/components/mikkeos/MetricCard";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  createTeamWorksClientProjectList,
  TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID
} from "@/lib/team-works-client-projects";
import { projectStatusLabels, useTeamWorksProjectStore, type ProjectStatus } from "@/lib/team-works-projects";
import { useTeamWorksPortalActor } from "@/components/team-works/useTeamWorksPortalActor";

export function TeamWorksClientProjectList() {
  const { hydrated, projectState } = useTeamWorksProjectStore();
  const actor = useTeamWorksPortalActor("client");
  const actorMemberships = new Map(actor.memberships.map((membership) => [membership.sourceProjectId, { memberId: membership.memberId }]));
  const details = createTeamWorksClientProjectList(projectState, TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID, { memberships: actorMemberships });
  const actions = details.flatMap((detail) => detail.actions.map((action) => ({
    ...action,
    projectId: detail.project.id,
    projectName: detail.project.name
  })));
  const activeCount = details.filter((detail) => !["completed", "cancelled"].includes(detail.project.status)).length;
  const reviewCount = details.reduce((sum, detail) => sum + detail.project.reviewDeliverableCount, 0);
  const approvedCount = details.reduce((sum, detail) => sum + detail.project.approvedDeliverableCount, 0);

  if (!hydrated || actor.status === "loading") return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">共有プロジェクトを読み込んでいます。</p>;
  if (actor.status === "error") return <MikkeEmptyState title="案件所属を確認できません" helper={actor.errorMessage} />;

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-bg)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">
        ログイン中の実アカウントに共有された案件だけを表示しています。
      </p>
      <MikkeSection title="あなたが今やること">
        {actions.length > 0 ? (
          <div className="divide-y divide-[var(--mikke-line)]">
            {actions.slice(0, 5).map((action) => (
              <Link key={`${action.projectId}-${action.kind}-${action.id}`} href={`/apps/team-works/portal/client/projects/${action.projectId}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
                  <AlertCircle size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{action.title}</span>
                  <span className="mt-1 block text-xs text-[var(--mikke-muted)]">{action.projectName}・{action.helper}</span>
                </span>
                <ChevronRight size={17} className="shrink-0 text-[var(--mikke-muted)]" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-[var(--mikke-success-soft)] p-4 text-[var(--mikke-success)]">
            <CheckCircle2 size={20} />
            <p className="text-sm font-bold">現在、対応が必要な項目はありません。</p>
          </div>
        )}
      </MikkeSection>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="共有プロジェクトの概要">
        <MetricCard label="共有中" value={`${details.length}件`} helper="閲覧できるプロジェクト" tone="navy" />
        <MetricCard label="進行中" value={`${activeCount}件`} helper="完了前のプロジェクト" tone="gray" />
        <MetricCard label="あなたの対応" value={`${actions.length}件`} helper="確認・回答など" tone="orange" />
        <MetricCard label="承認済み成果物" value={`${approvedCount}件`} helper={`確認待ち ${reviewCount}件`} tone="green" />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-base font-bold">共有プロジェクト</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">進み具合と、次に確認する内容をプロジェクトごとにまとめています。</p>
        </div>
        {details.length > 0 ? (
          <div className="divide-y divide-[var(--mikke-line)] border-y border-[var(--mikke-line)]">
            {details.map(({ project }) => (
              <article key={project.id} className="py-5 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <MikkeStatusBadge tone={statusTone(project.status)} className="px-2 py-1">{projectStatusLabels[project.status]}</MikkeStatusBadge>
                    <h3 className="mt-2 text-lg font-bold tracking-normal">{project.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{project.description || project.goal}</p>
                  </div>
                  <Link href={`/apps/team-works/portal/client/projects/${project.id}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
                    <FolderKanban size={15} /> 詳細を見る
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 text-xs font-semibold text-[var(--mikke-muted)] sm:grid-cols-3">
                  <span>現在の工程: <strong className="text-[var(--mikke-text)]">{project.currentPhaseName}</strong></span>
                  <span className="inline-flex items-center gap-1"><CalendarClock size={14} /> 納期 {formatDate(project.dueDate)}</span>
                  <span className={project.actionCount > 0 ? "inline-flex items-center gap-1 text-[var(--mikke-accent)]" : "inline-flex items-center gap-1"}>
                    {project.actionCount > 0 ? <AlertCircle size={14} /> : <PackageCheck size={14} />} 対応事項 {project.actionCount}件
                  </span>
                </div>
                <div className="mt-4 max-w-3xl">
                  <div className="flex items-center justify-between text-xs font-bold"><span>全体進捗</span><span className="text-[var(--mikke-accent)]">{project.progressPercent}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]"><div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${project.progressPercent}%` }} /></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <MikkeEmptyState title="共有中のプロジェクトはありません" helper="プロジェクトが共有されると、ここに進捗と対応事項が表示されます。" />
        )}
      </section>
    </div>
  );
}

function statusTone(status: ProjectStatus): "success" | "primary" | "muted" {
  if (status === "completed") return "success";
  if (["cancelled", "on_hold"].includes(status)) return "muted";
  return "primary";
}

function formatDate(value: string) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
