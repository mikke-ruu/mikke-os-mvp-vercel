"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import {
  createTeamWorksProjectId,
  projectStatusLabels,
  useTeamWorksProjectStore,
  type Project,
  type ProjectMember,
  type ProjectRole,
  type ProjectStatus
} from "@/lib/team-works-projects";
import {
  createTeamWorksTemplateVersion,
  instantiateTeamWorksProjectTemplate
} from "@/lib/team-works-project-templates";
import { teamWorksInitialState, teamWorksTemplate } from "@/lib/team-works";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

const statuses = Object.keys(projectStatusLabels) as ProjectStatus[];

export function TeamWorksProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projectState, templateState, saveProjectState, saveTemplateState } = useTeamWorksProjectStore();
  const clients = teamWorksInitialState.clients;
  const workers = teamWorksInitialState.workers;
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [budget, setBudget] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("draft");
  const [leaderWorkerId, setLeaderWorkerId] = useState(workers[0]?.id ?? "");
  const [memberWorkerIds, setMemberWorkerIds] = useState<string[]>(workers[0]?.id ? [workers[0].id] : []);
  const [clientVisible, setClientVisible] = useState(true);
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(searchParams.get("templateId") ?? "empty");
  const [appliedTemplateId, setAppliedTemplateId] = useState("");
  const availableTemplates = templateState.templates.filter((template) => template.status === "active" || template.id === selectedTemplateId);
  const selectedTemplate = templateState.templates.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedVersion = selectedTemplate
    ? templateState.versions.find((version) => version.id === selectedTemplate.currentVersionId) ?? null
    : null;

  useEffect(() => {
    if (!selectedTemplate || appliedTemplateId === selectedTemplate.id) return;
    setName(`${selectedTemplate.name}の新しいプロジェクト`);
    setDescription(selectedTemplate.description);
    setGoal(selectedTemplate.phases.at(-1)?.completionCondition ?? "テンプレートの完了条件を満たす");
    setClientVisible(selectedTemplate.featureSettings.clientPortal);
    setStatus("preparing");
    setAppliedTemplateId(selectedTemplate.id);
  }, [selectedTemplate, appliedTemplateId]);

  function toggleMember(workerId: string) {
    if (workerId === leaderWorkerId) return;
    setMemberWorkerIds((current) =>
      current.includes(workerId) ? current.filter((id) => id !== workerId) : [...current, workerId]
    );
  }

  function changeLeader(workerId: string) {
    setLeaderWorkerId(workerId);
    setMemberWorkerIds((current) => (current.includes(workerId) ? current : [...current, workerId]));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    if (startDate && dueDate && dueDate < startDate) {
      setMessage("納期は開始日以降の日付を選んでください。");
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    if (selectedTemplate) {
      let templateVersion = selectedVersion;
      if (!templateVersion) {
        const versionResult = createTeamWorksTemplateVersion({
          template: selectedTemplate,
          versions: templateState.versions,
          createdByMemberId: leaderWorkerId,
          now,
          createId: createTeamWorksProjectId
        });
        templateVersion = versionResult.version;
        saveTemplateState({
          templates: templateState.templates.map((template) => template.id === selectedTemplate.id ? versionResult.template : template),
          versions: versionResult.versions
        });
      }
      const selectedWorkerIds = Array.from(new Set([leaderWorkerId, ...memberWorkerIds].filter(Boolean)));
      const generated = instantiateTeamWorksProjectTemplate({
        template: selectedTemplate,
        templateVersion,
        input: {
          organizationId: teamWorksTemplate.organizationId,
          clientId,
          name: name.trim(),
          description: description.trim(),
          goal: goal.trim(),
          status,
          startDate,
          dueDate,
          budget: budget ? Number(budget) : null,
          leaderWorkerId,
          selectedWorkers: selectedWorkerIds.map((workerId) => ({
            id: workerId,
            name: workers.find((worker) => worker.id === workerId)?.name ?? "担当メンバー"
          })),
          clientVisible,
          memo: memo.trim()
        },
        now,
        createId: createTeamWorksProjectId
      });
      saveProjectState({
        ...projectState,
        projects: [generated.project, ...projectState.projects],
        projectRoles: [...projectState.projectRoles, ...generated.projectRoles],
        projectMembers: [...projectState.projectMembers, ...generated.projectMembers],
        phases: [...projectState.phases, ...generated.phases],
        tasks: [...projectState.tasks, ...generated.tasks],
        taskCheckItems: [...projectState.taskCheckItems, ...generated.taskCheckItems],
        forms: [...projectState.forms, ...generated.forms],
        resources: [...projectState.resources, ...generated.resources],
        deliverables: [...projectState.deliverables, ...generated.deliverables]
      });
      router.push(`/apps/team-works/projects/${generated.project.id}`);
      return;
    }
    const projectId = createTeamWorksProjectId("team_works_project");
    const leaderRoleId = createTeamWorksProjectId("team_works_project_role_leader");
    const memberRoleId = createTeamWorksProjectId("team_works_project_role_member");
    const selectedWorkerIds = Array.from(new Set([leaderWorkerId, ...memberWorkerIds].filter(Boolean)));
    const members: ProjectMember[] = selectedWorkerIds.map((workerId) => {
      const worker = workers.find((item) => item.id === workerId);
      return {
        id: createTeamWorksProjectId("team_works_project_member"),
        projectId,
        organizationMemberId: workerId,
        displayName: worker?.name ?? "担当メンバー",
        projectRoleId: workerId === leaderWorkerId ? leaderRoleId : memberRoleId,
        joinedAt: now
      };
    });
    const leader = members.find((member) => member.organizationMemberId === leaderWorkerId);
    const roles: ProjectRole[] = [
      {
        id: leaderRoleId,
        projectId,
        name: "プロジェクトリーダー",
        description: "全体の進行と確認を担当します。",
        createdAt: now
      },
      {
        id: memberRoleId,
        projectId,
        name: "プロジェクトメンバー",
        description: "割り当てられた工程とタスクを担当します。",
        createdAt: now
      }
    ];
    const project: Project = {
      id: projectId,
      organizationId: teamWorksTemplate.organizationId,
      clientId,
      name: name.trim(),
      description: description.trim(),
      goal: goal.trim(),
      status,
      startDate,
      dueDate,
      budget: budget ? Number(budget) : null,
      leaderMemberId: leader?.id ?? "",
      templateId: null,
      templateVersionId: null,
      progressPercent: 0,
      clientVisible,
      memo: memo.trim(),
      createdAt: now,
      updatedAt: now
    };

    saveProjectState({
      ...projectState,
      projects: [project, ...projectState.projects],
      projectRoles: [...projectState.projectRoles, ...roles],
      projectMembers: [...projectState.projectMembers, ...members]
    });
    router.push(`/apps/team-works/projects/${project.id}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl">
      <MikkeSection title="プロジェクトの基本情報">
        <div className="grid gap-4 sm:grid-cols-2">
          <TeamWorksProjectField label="プロジェクト名" required className="sm:col-span-2">
            <input value={name} onChange={(event) => setName(event.target.value)} className={teamWorksProjectInputClass} required />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="クライアント">
            <select value={clientId} onChange={(event) => setClientId(event.target.value)} className={teamWorksProjectInputClass}>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="状態">
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)} className={teamWorksProjectInputClass}>
              {statuses.map((item) => <option key={item} value={item}>{projectStatusLabels[item]}</option>)}
            </select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="概要" className="sm:col-span-2">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className={`${teamWorksProjectInputClass} resize-none`} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="目的・完成条件" className="sm:col-span-2">
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} className={`${teamWorksProjectInputClass} resize-none`} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="開始日">
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="納期">
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="予算（任意）">
            <input value={budget} onChange={(event) => setBudget(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="使用テンプレート" helper="作成時点のテンプレート版をコピーし、案件側の編集は元テンプレートへ自動反映しません。">
            <select
              value={selectedTemplateId}
              onChange={(event) => {
                setSelectedTemplateId(event.target.value);
                setAppliedTemplateId("");
              }}
              className={teamWorksProjectInputClass}
            >
              <option value="empty">空のプロジェクト</option>
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </TeamWorksProjectField>
          {selectedTemplate ? (
            <div className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-bg)] p-4 text-xs sm:col-span-2">
              <p className="font-bold">{selectedTemplate.name} {selectedVersion ? `Ver.${selectedVersion.version}` : "（初回作成時にVer.1を保存）"}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[var(--mikke-muted)] sm:grid-cols-4">
                <span>工程 {selectedTemplate.phases.length}件</span>
                <span>タスク {selectedTemplate.tasks.length}件</span>
                <span>役割 {selectedTemplate.roleNames.length}件</span>
                <span>フォーム {selectedTemplate.forms.length}件</span>
              </div>
            </div>
          ) : null}
        </div>
      </MikkeSection>

      <MikkeSection title="担当メンバー">
        <div className="grid gap-4 sm:grid-cols-2">
          <TeamWorksProjectField label="プロジェクトリーダー">
            <select value={leaderWorkerId} onChange={(event) => changeLeader(event.target.value)} className={teamWorksProjectInputClass}>
              {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
            </select>
          </TeamWorksProjectField>
          <div>
            <p className="text-xs font-bold text-[var(--mikke-text)]">参加メンバー</p>
            <div className="mt-2 space-y-2 rounded-lg border border-[var(--mikke-line)] p-3">
              {workers.map((worker) => (
                <label key={worker.id} className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={memberWorkerIds.includes(worker.id)}
                    disabled={worker.id === leaderWorkerId}
                    onChange={() => toggleMember(worker.id)}
                  />
                  {worker.name}
                  {worker.id === leaderWorkerId ? <span className="text-xs text-[var(--mikke-muted)]">リーダー</span> : null}
                </label>
              ))}
            </div>
          </div>
        </div>
      </MikkeSection>

      <MikkeSection title="共有設定">
        <label className="flex items-start gap-2 text-sm font-semibold">
          <input type="checkbox" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} className="mt-1" />
          <span>
            クライアント共有の対象にする
            <span className="mt-1 block text-xs font-normal leading-5 text-[var(--mikke-muted)]">実際のクライアント画面はTW-P4で追加します。</span>
          </span>
        </label>
        <TeamWorksProjectField label="内部メモ" className="mt-4" helper="クライアントには表示しません。">
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={3} className={`${teamWorksProjectInputClass} resize-none`} />
        </TeamWorksProjectField>
      </MikkeSection>

      {message ? <p className="mb-3 text-sm font-bold text-[var(--mikke-danger)]">{message}</p> : null}
      <button type="submit" disabled={saving || !name.trim()} className="w-full rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
        {saving ? "作成しています…" : selectedTemplate ? "テンプレートからプロジェクトを作成" : "プロジェクトを作成"}
      </button>
    </form>
  );
}
