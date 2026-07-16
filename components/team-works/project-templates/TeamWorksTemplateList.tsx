"use client";

import { Archive, Layers3, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  createTeamWorksProjectId,
  useTeamWorksProjectStore,
  type ProjectTemplate
} from "@/lib/team-works-projects";
import { teamWorksTemplate } from "@/lib/team-works";

const templateStatusLabels: Record<ProjectTemplate["status"], string> = {
  draft: "下書き",
  active: "利用中",
  archived: "アーカイブ"
};

export function TeamWorksTemplateList() {
  const router = useRouter();
  const { hydrated, templateState, saveTemplateState } = useTeamWorksProjectStore();
  const activeCount = templateState.templates.filter((template) => template.status === "active").length;
  const draftCount = templateState.templates.filter((template) => template.status === "draft").length;
  const archivedCount = templateState.templates.filter((template) => template.status === "archived").length;

  function createEmptyTemplate() {
    const now = new Date().toISOString();
    const template: ProjectTemplate = {
      id: createTeamWorksProjectId("team_works_project_template"),
      organizationId: teamWorksTemplate.organizationId,
      name: "新しい自社テンプレート",
      description: "自社の仕事の流れに合わせて工程とタスクを追加してください。",
      status: "draft",
      standardDurationDays: 0,
      roleNames: ["プロジェクトリーダー", "担当者"],
      phases: [],
      tasks: [],
      forms: [],
      featureSettings: {
        clientPortal: false,
        deliverables: false,
        comments: false,
        payouts: false,
        invoices: false
      },
      currentVersionId: null,
      createdAt: now,
      updatedAt: now
    };
    saveTemplateState({
      ...templateState,
      templates: [template, ...templateState.templates]
    });
    router.push(`/apps/team-works/project-templates/${template.id}`);
  }

  if (!hydrated) {
    return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="テンプレートの概要">
        <Metric label="利用中" value={activeCount} note="新しい案件で使える" />
        <Metric label="下書き" value={draftCount} note="編集中の自社テンプレート" />
        <Metric label="アーカイブ" value={archivedCount} note="保存している過去の型" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Link
          href="/apps/team-works/project-templates/generator"
          className="rounded-xl border border-[var(--mikke-accent)] bg-[var(--mikke-surface)] p-5 transition hover:bg-[var(--mikke-bg)]"
        >
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]">
            <Sparkles size={18} /> 質問に答えて作る
          </span>
          <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">
            8つの質問から、工程・役割・タスク・使用機能の下書きを作ります。
          </p>
        </Link>
        <button
          type="button"
          onClick={createEmptyTemplate}
          className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5 text-left transition hover:bg-[var(--mikke-bg)]"
        >
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]">
            <Plus size={18} /> 空の状態から作る
          </span>
          <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">
            工程・タスク・役割をビルダーで一つずつ追加します。
          </p>
        </button>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Layers3 size={18} className="text-[var(--mikke-primary)]" />
          <h2 className="text-base font-bold">自社テンプレート</h2>
        </div>
        {templateState.templates.length === 0 ? (
          <MikkeEmptyState
            title="テンプレートはまだありません"
            helper="質問に答えて下書きを作るか、空の状態から始めてください。"
          />
        ) : (
          <div className="space-y-3">
            {templateState.templates.map((template) => (
              <article key={template.id} className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <MikkeStatusBadge tone={template.status === "active" ? "success" : template.status === "archived" ? "muted" : "primary"}>
                        {templateStatusLabels[template.status]}
                      </MikkeStatusBadge>
                      <span className="text-xs text-[var(--mikke-muted)]">自社専用</span>
                    </div>
                    <h3 className="mt-2 text-base font-bold">{template.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">{template.description || "説明はありません。"}</p>
                  </div>
                  <Link
                    href={`/apps/team-works/project-templates/${template.id}`}
                    className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]"
                  >
                    編集する
                  </Link>
                </div>
                <div className="mt-4 grid gap-2 text-xs text-[var(--mikke-muted)] sm:grid-cols-4">
                  <span>工程 {template.phases.length}件</span>
                  <span>タスク {template.tasks.length}件</span>
                  <span>役割 {template.roleNames.length}件</span>
                  <span>標準 {template.standardDurationDays || 0}日</span>
                </div>
                {template.status === "archived" ? (
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--mikke-muted)]"><Archive size={14} /> 新規案件には表示しません</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4">
      <p className="text-xs font-bold text-[var(--mikke-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}<span className="ml-1 text-sm">件</span></p>
      <p className="mt-1 text-xs text-[var(--mikke-muted)]">{note}</p>
    </div>
  );
}
