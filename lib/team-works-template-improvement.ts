import type {
  Project,
  ProjectForm,
  ProjectMember,
  ProjectPhase,
  ProjectRole,
  ProjectTask,
  ProjectTemplate,
  ProjectTemplateForm,
  ProjectTemplatePhase,
  ProjectTemplateTask,
  ProjectTemplateVersion,
  TeamWorksProjectStoreState
} from "@/lib/team-works-projects";

export type ProjectCompletionReadinessItem = {
  key: "phases" | "tasks" | "deliverables";
  label: string;
  detail: string;
  ready: boolean;
};

export type ProjectTemplateDifference = {
  key: string;
  label: string;
  detail: string;
};

function daysBetween(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 1;
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function roleNameForMember(memberId: string, members: ProjectMember[], roles: ProjectRole[], fallback: string) {
  const member = members.find((item) => item.id === memberId);
  return roles.find((role) => role.id === member?.projectRoleId)?.name ?? fallback;
}

function roleNameForRole(roleId: string, roles: ProjectRole[], fallback: string) {
  return roles.find((role) => role.id === roleId)?.name ?? fallback;
}

function sourcePhaseIdForProjectPhase(phase: ProjectPhase) {
  return phase.sourceTemplatePhaseId ?? null;
}

export function getProjectCompletionReadiness(state: TeamWorksProjectStoreState, projectId: string) {
  const phases = state.phases.filter((phase) => phase.projectId === projectId);
  const tasks = state.tasks.filter((task) => task.projectId === projectId);
  const deliverables = state.deliverables.filter((deliverable) => deliverable.projectId === projectId);
  const completedTasks = tasks.filter((task) => ["approved", "completed"].includes(task.status)).length;
  const delivered = deliverables.filter((deliverable) => deliverable.status === "delivered").length;
  const items: ProjectCompletionReadinessItem[] = [
    {
      key: "phases",
      label: "全工程の完了",
      detail: phases.length === 0 ? "工程は登録されていません" : `${phases.filter((phase) => phase.status === "completed").length}/${phases.length}工程`,
      ready: phases.length === 0 || phases.every((phase) => phase.status === "completed")
    },
    {
      key: "tasks",
      label: "全タスクの完了・承認",
      detail: tasks.length === 0 ? "タスクは登録されていません" : `${completedTasks}/${tasks.length}タスク`,
      ready: tasks.length === 0 || completedTasks === tasks.length
    },
    {
      key: "deliverables",
      label: "全成果物の納品",
      detail: deliverables.length === 0 ? "成果物は登録されていません" : `${delivered}/${deliverables.length}成果物`,
      ready: deliverables.length === 0 || delivered === deliverables.length
    }
  ];
  return { items, ready: items.every((item) => item.ready) };
}

export function projectHasExactTemplateMapping(project: Project) {
  return project.templateMappingVersion === 1;
}

export function buildTemplateFromProject({
  project,
  state,
  baseTemplate,
  now,
  createId,
  asNewTemplate = false
}: {
  project: Project;
  state: TeamWorksProjectStoreState;
  baseTemplate?: ProjectTemplate | null;
  now: string;
  createId: (prefix: string) => string;
  asNewTemplate?: boolean;
}) {
  const phases = state.phases.filter((phase) => phase.projectId === project.id).sort((a, b) => a.position - b.position);
  const tasks = state.tasks.filter((task) => task.projectId === project.id);
  const forms = state.forms.filter((form) => form.projectId === project.id);
  const resources = state.resources.filter((resource) => resource.projectId === project.id);
  const members = state.projectMembers.filter((member) => member.projectId === project.id);
  const roles = state.projectRoles.filter((role) => role.projectId === project.id);
  const fallbackRoleName = roles[0]?.name ?? "プロジェクトメンバー";
  const templateId = asNewTemplate || !baseTemplate ? createId("team_works_project_template") : baseTemplate.id;
  const templatePhaseIdByProjectId = new Map<string, string>();
  const templatePhases: ProjectTemplatePhase[] = phases.map((phase, position) => {
    const sourcePhase = baseTemplate?.phases.find((item) => item.id === phase.sourceTemplatePhaseId);
    const id = asNewTemplate ? createId("team_works_template_phase") : phase.sourceTemplatePhaseId ?? createId("team_works_template_phase");
    templatePhaseIdByProjectId.set(phase.id, id);
    return {
      id,
      name: phase.name,
      description: phase.description,
      position,
      standardDays: sourcePhase?.standardDays ?? daysBetween(phase.startDate, phase.dueDate),
      weight: phase.weight,
      required: true,
      ownerRoleName: roleNameForMember(phase.ownerMemberId, members, roles, fallbackRoleName),
      startCondition: phase.startCondition,
      completionCondition: phase.completionCondition,
      clientVisible: phase.clientVisible
    };
  });
  const taskIdByProjectId = new Map<string, string>();
  const templateTasks: ProjectTemplateTask[] = tasks.map((task) => {
    const phase = phases.find((item) => item.id === task.phaseId);
    const sourceTask = baseTemplate?.tasks.find((item) => item.id === task.sourceTemplateTaskId);
    const id = asNewTemplate ? createId("team_works_template_task") : task.sourceTemplateTaskId ?? createId("team_works_template_task");
    taskIdByProjectId.set(task.id, id);
    return {
      id,
      phaseId: templatePhaseIdByProjectId.get(task.phaseId) ?? "",
      title: task.title,
      description: task.description,
      position: tasks.filter((item) => item.phaseId === task.phaseId).findIndex((item) => item.id === task.id),
      standardOffsetDays: sourceTask?.standardOffsetDays ?? daysBetween(phase?.startDate ?? "", task.dueDate),
      priority: task.priority,
      required: sourceTask?.required ?? true,
      assigneeRoleName: roleNameForMember(task.assigneeMemberId, members, roles, fallbackRoleName),
      checklist: state.taskCheckItems.filter((item) => item.taskId === task.id).sort((a, b) => a.position - b.position).map((item) => item.label),
      requiresDeliverable: task.requiresDeliverable,
      requiresApproval: task.requiresApproval,
      requiresClientAction: task.requiresClientAction,
      clientVisible: task.clientVisible
    };
  });
  const templateForms: ProjectTemplateForm[] = forms.map((form: ProjectForm) => ({
    id: asNewTemplate ? createId("team_works_template_form") : form.sourceTemplateFormId ?? createId("team_works_template_form"),
    phaseId: templatePhaseIdByProjectId.get(form.phaseId) ?? "",
    taskId: form.taskId ? taskIdByProjectId.get(form.taskId) ?? null : null,
    name: form.name,
    inputRoleName: roleNameForRole(form.inputRoleId, roles, fallbackRoleName),
    reviewerRoleName: roleNameForRole(form.reviewerRoleId, roles, fallbackRoleName),
    approverRoleName: roleNameForRole(form.approverRoleId, roles, fallbackRoleName),
    required: form.required,
    dueOffsetDays: form.dueOffsetDays,
    clientVisible: form.clientVisible,
    editableAfterSubmit: form.editableAfterSubmit,
    fields: form.fields.map((field) => ({ ...field, options: [...field.options] }))
  }));
  const templateResources = resources.map((resource) => ({
    id: asNewTemplate ? createId("team_works_template_resource") : resource.sourceTemplateResourceId ?? createId("team_works_template_resource"),
    phaseId: templatePhaseIdByProjectId.get(resource.phaseId) ?? "",
    taskId: resource.taskId ? taskIdByProjectId.get(resource.taskId) ?? null : null,
    title: resource.title,
    type: resource.type,
    url: resource.url,
    memo: resource.memo,
    audience: resource.audience
  }));
  return {
    id: templateId,
    organizationId: project.organizationId,
    name: asNewTemplate || !baseTemplate ? `${project.name} テンプレート` : baseTemplate.name,
    description: asNewTemplate || !baseTemplate ? `${project.name}の完了内容から作成しました。` : baseTemplate.description,
    status: asNewTemplate || !baseTemplate ? "draft" : baseTemplate.status,
    standardDurationDays: templatePhases.reduce((sum, phase) => sum + phase.standardDays, 0),
    roleNames: roles.length > 0 ? roles.map((role) => role.name) : baseTemplate?.roleNames ?? [fallbackRoleName],
    phases: templatePhases,
    tasks: templateTasks,
    forms: templateForms,
    resources: templateResources,
    featureSettings: baseTemplate?.featureSettings ?? {
      clientPortal: project.clientVisible,
      deliverables: state.deliverables.some((item) => item.projectId === project.id),
      comments: state.comments.some((item) => item.projectId === project.id),
      payouts: false,
      invoices: false
    },
    currentVersionId: asNewTemplate ? null : baseTemplate?.currentVersionId ?? null,
    createdAt: asNewTemplate || !baseTemplate ? now : baseTemplate.createdAt,
    updatedAt: now
  } satisfies ProjectTemplate;
}

export function diffProjectFromTemplateVersion({
  project,
  state,
  sourceVersion
}: {
  project: Project;
  state: TeamWorksProjectStoreState;
  sourceVersion?: ProjectTemplateVersion | null;
}) {
  if (!sourceVersion) return [] as ProjectTemplateDifference[];
  if (!projectHasExactTemplateMapping(project)) {
    return [{ key: "legacy", label: "作成元の対応情報なし", detail: "既存案件のため安全な項目別差分は表示できません。別テンプレートとして保存できます。" }];
  }
  const differences: ProjectTemplateDifference[] = [];
  const phases = state.phases.filter((phase) => phase.projectId === project.id);
  const tasks = state.tasks.filter((task) => task.projectId === project.id);
  const forms = state.forms.filter((form) => form.projectId === project.id);
  for (const phase of phases) {
    const source = sourceVersion.snapshot.phases.find((item) => item.id === sourcePhaseIdForProjectPhase(phase));
    if (!source) differences.push({ key: `phase-added-${phase.id}`, label: "工程を追加", detail: phase.name });
    else if (source.name !== phase.name || source.weight !== phase.weight || source.clientVisible !== phase.clientVisible) {
      differences.push({ key: `phase-changed-${phase.id}`, label: "工程を変更", detail: phase.name });
    }
  }
  for (const source of sourceVersion.snapshot.phases) {
    if (!phases.some((phase) => phase.sourceTemplatePhaseId === source.id)) differences.push({ key: `phase-removed-${source.id}`, label: "工程を削除", detail: source.name });
  }
  for (const task of tasks) {
    const source = sourceVersion.snapshot.tasks.find((item) => item.id === task.sourceTemplateTaskId);
    if (!source) differences.push({ key: `task-added-${task.id}`, label: "タスクを追加", detail: task.title });
    else if (source.title !== task.title || source.priority !== task.priority || source.clientVisible !== task.clientVisible || source.requiresApproval !== task.requiresApproval || source.requiresDeliverable !== task.requiresDeliverable) {
      differences.push({ key: `task-changed-${task.id}`, label: "タスクを変更", detail: task.title });
    }
  }
  for (const source of sourceVersion.snapshot.tasks) {
    if (!tasks.some((task) => task.sourceTemplateTaskId === source.id)) differences.push({ key: `task-removed-${source.id}`, label: "タスクを削除", detail: source.title });
  }
  for (const form of forms) {
    const source = sourceVersion.snapshot.forms.find((item) => item.id === form.sourceTemplateFormId);
    if (!source) differences.push({ key: `form-added-${form.id}`, label: "フォームを追加", detail: form.name });
    else if (source.name !== form.name || source.required !== form.required || source.clientVisible !== form.clientVisible) differences.push({ key: `form-changed-${form.id}`, label: "フォームを変更", detail: form.name });
  }
  for (const source of sourceVersion.snapshot.forms) {
    if (!forms.some((form) => form.sourceTemplateFormId === source.id)) differences.push({ key: `form-removed-${source.id}`, label: "フォームを削除", detail: source.name });
  }
  return differences;
}
