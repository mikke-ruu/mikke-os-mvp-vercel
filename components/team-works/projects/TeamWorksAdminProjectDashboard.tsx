"use client";

import { AlertCircle, CalendarDays, ChevronRight, FolderKanban, ListChecks } from "lucide-react";
import Link from "next/link";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { projectStatusLabels, useTeamWorksProjectStore } from "@/lib/team-works-projects";

export function TeamWorksAdminProjectDashboard() {
  const { hydrated, projectState } = useTeamWorksProjectStore();
  if (!hydrated) return <section aria-labelledby="team-works-project-dashboard"><h3 id="team-works-project-dashboard" className="text-lg font-bold">プロジェクト</h3><p className="mt-2 text-sm text-[var(--mikke-muted)]">プロジェクト状況を読み込んでいます。</p></section>;

  const projects = projectState.projects.filter((project) => project.status !== "cancelled").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activeCount = projects.filter((project) => !["draft", "completed"].includes(project.status)).length;
  const reviewCount = projects.filter((project) => ["client_review", "internal_review"].includes(project.status)).length
    + projectState.deliverables.filter((deliverable) => ["internal_review", "client_review", "revision_requested"].includes(deliverable.status)).length;
  const delayedTaskCount = projectState.tasks.filter((task) => task.dueDate && !["approved", "completed"].includes(task.status) && new Date(`${task.dueDate}T23:59:59`).getTime() < Date.now()).length;

  return (
    <section aria-labelledby="team-works-project-dashboard" className="border-t border-[var(--mikke-line)] pt-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--mikke-accent)]">Project work</p><h3 id="team-works-project-dashboard" className="mt-1 text-lg font-bold">プロジェクト</h3><p className="mt-1 text-sm text-[var(--mikke-muted)]">納期のある案件は、継続業務と分けて確認します。</p></div><Link href="/apps/team-works/projects" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">すべて見る <ChevronRight size={15} /></Link></div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3"><SummaryCard label="進行中" value={`${activeCount}件`} icon={FolderKanban} /><SummaryCard label="確認・修正待ち" value={`${reviewCount}件`} icon={AlertCircle} attention={reviewCount > 0} /><SummaryCard label="期限超過タスク" value={`${delayedTaskCount}件`} icon={CalendarDays} attention={delayedTaskCount > 0} /></div>
      {projects.length > 0 ? <div className="grid gap-3 lg:grid-cols-2">{projects.slice(0, 4).map((project) => { const tasks = projectState.tasks.filter((task) => task.projectId === project.id); const waiting = tasks.filter((task) => ["client_response_pending", "internal_review_pending", "revision_requested"].includes(task.status)).length; return <Link key={project.id} href={`/apps/team-works/projects/${project.id}`} className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 transition hover:border-[var(--mikke-primary-border)]"><div className="flex items-start justify-between gap-3"><div><MikkeStatusBadge tone={project.status === "completed" ? "success" : project.status === "draft" ? "muted" : "primary"} className="px-2 py-1">{projectStatusLabels[project.status]}</MikkeStatusBadge><h4 className="mt-2 text-base font-bold">{project.name}</h4></div><ChevronRight size={18} className="shrink-0 text-[var(--mikke-muted)]" /></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><Fact label="進捗" value={`${project.progressPercent}%`} icon={ListChecks} /><Fact label="期限" value={formatDate(project.dueDate)} icon={CalendarDays} /><Fact label="確認待ち" value={`${waiting}件`} icon={AlertCircle} /></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]"><div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${project.progressPercent}%` }} /></div></Link>; })}</div> : <MikkeEmptyState title="プロジェクトはまだありません" helper="新しいプロジェクトを作成すると、ここに状況が表示されます。" />}
    </section>
  );
}

function SummaryCard({ label, value, icon: Icon, attention = false }: { label: string; value: string; icon: typeof FolderKanban; attention?: boolean }) { return <div className={`rounded-2xl border p-4 ${attention ? "border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)] bg-[var(--mikke-surface)]"}`}><Icon size={18} className={attention ? "text-[var(--mikke-accent)]" : "text-[var(--mikke-primary)]"} /><p className="mt-2 text-xs font-bold text-[var(--mikke-muted)]">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>; }
function Fact({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FolderKanban }) { return <div><div className="flex items-center gap-1 text-[var(--mikke-muted)]"><Icon size={12} /><span className="font-bold">{label}</span></div><p className="mt-1 truncate font-bold">{value}</p></div>; }
function formatDate(value: string) { if (!value) return "未設定"; return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`)); }
