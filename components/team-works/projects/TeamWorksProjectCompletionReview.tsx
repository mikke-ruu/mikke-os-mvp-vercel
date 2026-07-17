"use client";

import { AlertTriangle, CheckCircle2, GitBranch, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import {
  createTeamWorksProjectId,
  type Project,
  type ProjectTemplateImprovementAction,
  type TeamWorksProjectStoreState,
  type TeamWorksProjectTemplateStoreState
} from "@/lib/team-works-projects";
import {
  createTeamWorksTemplateVersion,
  overwriteTeamWorksTemplateVersion
} from "@/lib/team-works-project-templates";
import {
  buildTemplateFromProject,
  diffProjectFromTemplateVersion,
  getProjectCompletionReadiness,
  projectHasExactTemplateMapping
} from "@/lib/team-works-template-improvement";
import { teamWorksInitialState } from "@/lib/team-works";
import { teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

type Props = {
  project: Project;
  projectState: TeamWorksProjectStoreState;
  templateState: TeamWorksProjectTemplateStoreState;
  saveProjectState: (next: TeamWorksProjectStoreState) => void;
  saveTemplateState: (next: TeamWorksProjectTemplateStoreState) => void;
  onCancel: () => void;
  onCompleted: () => void;
};

const actionOptions: { value: ProjectTemplateImprovementAction; label: string; helper: string }[] = [
  { value: "none", label: "反映しない", helper: "案件だけを完了し、テンプレートは変更しません。" },
  { value: "overwrite", label: "元テンプレートを更新", helper: "案件作成時に使った現在版を上書きします。" },
  { value: "new_version", label: "新しいバージョンとして保存", helper: "元テンプレートへ新しい版を追加します。既存案件には反映しません。" },
  { value: "duplicate", label: "別テンプレートとして保存", helper: "今回の案件を新しい下書きテンプレートとして保存します。" }
];

export function TeamWorksProjectCompletionReview({
  project,
  projectState,
  templateState,
  saveProjectState,
  saveTemplateState,
  onCancel,
  onCompleted
}: Props) {
  const [memo, setMemo] = useState(project.completionReviewMemo ?? "");
  const [action, setAction] = useState<ProjectTemplateImprovementAction>("none");
  const [error, setError] = useState("");
  const readiness = useMemo(() => getProjectCompletionReadiness(projectState, project.id), [projectState, project.id]);
  const sourceTemplate = templateState.templates.find((template) => template.id === project.templateId) ?? null;
  const sourceVersion = templateState.versions.find((version) => version.id === project.templateVersionId) ?? null;
  const differences = useMemo(
    () => diffProjectFromTemplateVersion({ project, state: projectState, sourceVersion }),
    [project, projectState, sourceVersion]
  );
  const exactMapping = projectHasExactTemplateMapping(project);
  const canUpdateSource = Boolean(sourceTemplate && sourceVersion && exactMapping);
  const canOverwrite = canUpdateSource && sourceTemplate?.currentVersionId === project.templateVersionId;

  function actionDisabled(value: ProjectTemplateImprovementAction) {
    if (value === "overwrite") return !canOverwrite;
    if (value === "new_version") return !canUpdateSource;
    return false;
  }

  function finishProject() {
    if (!readiness.ready) {
      setError("未完了の工程・タスク・成果物があります。すべて完了してから確定してください。");
      return;
    }
    if (actionDisabled(action)) {
      setError("この反映方法は安全条件を満たしていません。別の方法を選んでください。");
      return;
    }
    const now = new Date().toISOString();
    const actorId = teamWorksInitialState.workers[0]?.id ?? "team_works_owner";
    if (action === "overwrite" && sourceTemplate) {
      const draft = buildTemplateFromProject({ project, state: projectState, baseTemplate: sourceTemplate, now, createId: createTeamWorksProjectId });
      const result = overwriteTeamWorksTemplateVersion({ template: draft, versions: templateState.versions, createdByMemberId: actorId, now, createId: createTeamWorksProjectId });
      saveTemplateState({
        templates: templateState.templates.map((template) => template.id === result.template.id ? result.template : template),
        versions: result.versions
      });
    }
    if (action === "new_version" && sourceTemplate) {
      const draft = buildTemplateFromProject({ project, state: projectState, baseTemplate: sourceTemplate, now, createId: createTeamWorksProjectId });
      const result = createTeamWorksTemplateVersion({ template: draft, versions: templateState.versions, createdByMemberId: actorId, now, createId: createTeamWorksProjectId });
      saveTemplateState({
        templates: templateState.templates.map((template) => template.id === result.template.id ? result.template : template),
        versions: result.versions
      });
    }
    if (action === "duplicate") {
      const draft = buildTemplateFromProject({ project, state: projectState, baseTemplate: sourceTemplate, now, createId: createTeamWorksProjectId, asNewTemplate: true });
      const result = createTeamWorksTemplateVersion({ template: draft, versions: templateState.versions, createdByMemberId: actorId, now, createId: createTeamWorksProjectId });
      saveTemplateState({ templates: [result.template, ...templateState.templates], versions: result.versions });
    }
    saveProjectState({
      ...projectState,
      projects: projectState.projects.map((item) => item.id === project.id ? {
        ...item,
        status: "completed",
        progressPercent: 100,
        completedAt: now,
        completionReviewMemo: memo.trim(),
        templateImprovementAction: action,
        updatedAt: now
      } : item)
    });
    onCompleted();
  }

  return (
    <MikkeSection title="プロジェクト完了レビュー">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold">完了条件と今回の改善内容を確認します</p>
            <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">テンプレートを変更しても、進行中・完了済みの他案件へは自動反映しません。</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-[var(--mikke-muted)] hover:bg-[var(--mikke-bg)]" aria-label="完了レビューを閉じる"><X size={18} /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {readiness.items.map((item) => (
            <div key={item.key} className={`rounded-xl border p-4 ${item.ready ? "border-[var(--mikke-success)] bg-[var(--mikke-success-soft)]" : "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)]"}`}>
              <div className="flex items-center gap-2 text-sm font-bold">{item.ready ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}{item.label}</div>
              <p className="mt-2 text-xs text-[var(--mikke-muted)]">{item.detail}</p>
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs font-bold">振り返りメモ</label>
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={4} placeholder="うまくいったこと、次回改善したいことを記録" className={`${teamWorksProjectInputClass} resize-y`} />
        </div>

        <div>
          <div className="flex items-center gap-2"><GitBranch size={17} /><p className="text-sm font-bold">作成元テンプレートとの差分</p></div>
          {!sourceVersion ? <p className="mt-3 rounded-lg bg-[var(--mikke-bg)] p-3 text-xs text-[var(--mikke-muted)]">作成元テンプレート版はありません。今回の内容を別テンプレートとして保存できます。</p> : differences.length === 0 ? <p className="mt-3 rounded-lg bg-[var(--mikke-bg)] p-3 text-xs text-[var(--mikke-muted)]">テンプレートへ反映する構造上の変更はありません。</p> : (
            <div className="mt-3 divide-y divide-[var(--mikke-line)] rounded-xl border border-[var(--mikke-line)] px-4">
              {differences.map((difference) => <div key={difference.key} className="py-3"><p className="text-xs font-bold">{difference.label}</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">{difference.detail}</p></div>)}
            </div>
          )}
          {sourceTemplate && sourceVersion && sourceTemplate.currentVersionId !== sourceVersion.id ? <p className="mt-3 text-xs font-bold text-[var(--mikke-accent-strong)]">作成後に元テンプレートが更新されています。現在版の上書きは選べません。</p> : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold">今回の変更をどう扱いますか？</legend>
          {actionOptions.map((option) => {
            const disabled = actionDisabled(option.value);
            return <label key={option.value} className={`flex gap-3 rounded-xl border p-4 ${action === option.value ? "border-[var(--mikke-primary-border)] bg-[var(--mikke-primary-soft)]" : "border-[var(--mikke-line)]"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}><input type="radio" name="template-improvement" value={option.value} checked={action === option.value} onChange={() => setAction(option.value)} disabled={disabled} className="mt-1" /><span><span className="block text-sm font-bold">{option.label}</span><span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">{option.helper}</span></span></label>;
          })}
        </fieldset>

        {error ? <p className="rounded-lg bg-[var(--mikke-accent-soft)] p-3 text-xs font-bold text-[var(--mikke-danger)]">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--mikke-line)] px-4 py-2.5 text-xs font-bold">キャンセル</button>
          <button type="button" onClick={finishProject} disabled={!readiness.ready} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">完了を確定</button>
        </div>
      </div>
    </MikkeSection>
  );
}
