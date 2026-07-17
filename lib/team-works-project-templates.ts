import type {
  Project,
  ProjectDeliverable,
  ProjectForm,
  ProjectMember,
  ProjectPhase,
  ProjectRole,
  ProjectStatus,
  ProjectTask,
  ProjectTaskCheckItem,
  ProjectTemplate,
  ProjectTemplateVersion
} from "@/lib/team-works-projects";

export type TeamWorksIdFactory = (prefix: string) => string;

export type TeamWorksProjectMemberInput = {
  id: string;
  name: string;
};

export type TeamWorksProjectCreationInput = {
  organizationId: string;
  clientId: string;
  name: string;
  description: string;
  goal: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
  budget: number | null;
  leaderWorkerId: string;
  selectedWorkers: TeamWorksProjectMemberInput[];
  clientVisible: boolean;
  memo: string;
};

export type InstantiatedTeamWorksProject = {
  project: Project;
  projectRoles: ProjectRole[];
  projectMembers: ProjectMember[];
  phases: ProjectPhase[];
  tasks: ProjectTask[];
  taskCheckItems: ProjectTaskCheckItem[];
  forms: ProjectForm[];
  deliverables: ProjectDeliverable[];
};

function copyTemplateSnapshot(template: ProjectTemplate): ProjectTemplateVersion["snapshot"] {
  const { currentVersionId: _currentVersionId, createdAt: _createdAt, updatedAt: _updatedAt, ...snapshot } = template;
  return {
    ...snapshot,
    roleNames: [...snapshot.roleNames],
    phases: snapshot.phases.map((phase) => ({ ...phase })),
    tasks: snapshot.tasks.map((task) => ({ ...task, checklist: [...task.checklist] })),
    forms: snapshot.forms.map((form) => ({ ...form })),
    featureSettings: { ...snapshot.featureSettings }
  };
}

export function createTeamWorksTemplateVersion({
  template,
  versions,
  createdByMemberId,
  now,
  createId
}: {
  template: ProjectTemplate;
  versions: ProjectTemplateVersion[];
  createdByMemberId: string;
  now: string;
  createId: TeamWorksIdFactory;
}) {
  const nextNumber = versions
    .filter((version) => version.templateId === template.id)
    .reduce((maximum, version) => Math.max(maximum, version.version), 0) + 1;
  const version: ProjectTemplateVersion = {
    id: createId("team_works_project_template_version"),
    templateId: template.id,
    version: nextNumber,
    snapshot: copyTemplateSnapshot(template),
    createdByMemberId,
    createdAt: now
  };
  return {
    template: { ...template, currentVersionId: version.id, updatedAt: now },
    version,
    versions: [...versions, version]
  };
}

export function overwriteTeamWorksTemplateVersion({
  template,
  versions,
  createdByMemberId,
  now,
  createId
}: {
  template: ProjectTemplate;
  versions: ProjectTemplateVersion[];
  createdByMemberId: string;
  now: string;
  createId: TeamWorksIdFactory;
}) {
  const current = versions.find((version) => version.id === template.currentVersionId);
  if (!current) {
    return createTeamWorksTemplateVersion({ template, versions, createdByMemberId, now, createId });
  }
  const updatedVersion: ProjectTemplateVersion = {
    ...current,
    snapshot: copyTemplateSnapshot(template),
    createdByMemberId,
    createdAt: now
  };
  return {
    template: { ...template, updatedAt: now },
    version: updatedVersion,
    versions: versions.map((version) => version.id === current.id ? updatedVersion : version)
  };
}

export function duplicateTeamWorksProjectTemplate({
  template,
  now,
  createId
}: {
  template: ProjectTemplate;
  now: string;
  createId: TeamWorksIdFactory;
}) {
  const templateId = createId("team_works_project_template");
  const phaseIds = new Map(template.phases.map((phase) => [phase.id, createId("team_works_template_phase")]));
  const taskIds = new Map(template.tasks.map((task) => [task.id, createId("team_works_template_task")]));
  return {
    ...template,
    id: templateId,
    name: `${template.name}（複製）`,
    status: "draft" as const,
    phases: template.phases.map((phase) => ({ ...phase, id: phaseIds.get(phase.id) ?? phase.id })),
    tasks: template.tasks.map((task) => ({
      ...task,
      id: taskIds.get(task.id) ?? task.id,
      phaseId: phaseIds.get(task.phaseId) ?? task.phaseId,
      checklist: [...task.checklist]
    })),
    forms: template.forms.map((form) => ({
      ...form,
      id: createId("team_works_template_form"),
      phaseId: phaseIds.get(form.phaseId) ?? form.phaseId,
      taskId: form.taskId ? taskIds.get(form.taskId) ?? form.taskId : null
    })),
    featureSettings: { ...template.featureSettings },
    currentVersionId: null,
    createdAt: now,
    updatedAt: now
  } satisfies ProjectTemplate;
}

function addDays(dateValue: string, days: number) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function preferredMemberRole(roleNames: string[], leaderRoleName: string) {
  return roleNames.find((role) => role !== leaderRoleName && !role.includes("クライアント") && !role.includes("管理者"))
    ?? roleNames.find((role) => role !== leaderRoleName)
    ?? leaderRoleName;
}

export function instantiateTeamWorksProjectTemplate({
  template,
  templateVersion,
  input,
  now,
  createId
}: {
  template: ProjectTemplate;
  templateVersion: ProjectTemplateVersion;
  input: TeamWorksProjectCreationInput;
  now: string;
  createId: TeamWorksIdFactory;
}): InstantiatedTeamWorksProject {
  const source = templateVersion.snapshot;
  const projectId = createId("team_works_project");
  const roleNames = source.roleNames.length > 0 ? source.roleNames : ["プロジェクトリーダー", "プロジェクトメンバー"];
  const projectRoles = roleNames.map((name) => ({
    id: createId("team_works_project_role"),
    projectId,
    name,
    description: `${template.name}からコピーしたプロジェクト内役割です。`,
    createdAt: now
  }));
  const leaderRoleName = roleNames.includes("プロジェクトリーダー") ? "プロジェクトリーダー" : roleNames[0];
  const memberRoleName = preferredMemberRole(roleNames, leaderRoleName);
  const roleIdByName = new Map(projectRoles.map((role) => [role.name, role.id]));
  const selectedWorkers = input.selectedWorkers.length > 0
    ? input.selectedWorkers
    : [{ id: input.leaderWorkerId, name: "担当メンバー" }];
  const projectMembers = selectedWorkers.map((worker) => ({
    id: createId("team_works_project_member"),
    projectId,
    organizationMemberId: worker.id,
    displayName: worker.name,
    projectRoleId: roleIdByName.get(worker.id === input.leaderWorkerId ? leaderRoleName : memberRoleName) ?? projectRoles[0].id,
    joinedAt: now
  }));
  const leader = projectMembers.find((member) => member.organizationMemberId === input.leaderWorkerId) ?? projectMembers[0];
  const firstWorker = projectMembers.find((member) => member.id !== leader.id) ?? leader;
  const memberIdByRoleName = new Map<string, string>();
  for (const role of projectRoles) {
    const isLeaderRole = role.name === leaderRoleName || role.name.includes("管理") || role.name.includes("確認") || role.name.includes("承認");
    memberIdByRoleName.set(role.name, isLeaderRole ? leader.id : firstWorker.id);
  }

  const phaseIdByTemplateId = new Map<string, string>();
  const phaseDates = new Map<string, { startDate: string; dueDate: string }>();
  let phaseStartDate = input.startDate;
  const phases: ProjectPhase[] = source.phases
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((phase, index) => {
      const id = createId("team_works_project_phase");
      phaseIdByTemplateId.set(phase.id, id);
      const standardDays = Math.max(1, phase.standardDays);
      const dueDate = phaseStartDate ? addDays(phaseStartDate, standardDays - 1) : "";
      phaseDates.set(phase.id, { startDate: phaseStartDate, dueDate });
      const result: ProjectPhase = {
        id,
        sourceTemplatePhaseId: phase.id,
        projectId,
        name: phase.name,
        description: phase.description,
        position: index,
        status: "not_started",
        weight: phase.weight,
        progressPercent: 0,
        startDate: phaseStartDate,
        dueDate,
        ownerMemberId: memberIdByRoleName.get(phase.ownerRoleName) ?? leader.id,
        startCondition: phase.startCondition,
        completionCondition: phase.completionCondition,
        clientVisible: input.clientVisible && phase.clientVisible
      };
      phaseStartDate = dueDate ? addDays(dueDate, 1) : "";
      return result;
    });

  const taskIdByTemplateId = new Map<string, string>();
  const tasks: ProjectTask[] = source.tasks.map((task) => {
    const id = createId("team_works_project_task");
    taskIdByTemplateId.set(task.id, id);
    const phaseDate = phaseDates.get(task.phaseId);
    return {
      id,
      sourceTemplateTaskId: task.id,
      projectId,
      phaseId: phaseIdByTemplateId.get(task.phaseId) ?? "",
      title: task.title,
      description: task.description,
      status: "not_started",
      priority: task.priority,
      assigneeMemberId: memberIdByRoleName.get(task.assigneeRoleName) ?? firstWorker.id,
      dueDate: phaseDate?.startDate ? addDays(phaseDate.startDate, Math.max(1, task.standardOffsetDays) - 1) : "",
      requiresDeliverable: task.requiresDeliverable,
      requiresApproval: task.requiresApproval,
      requiresClientAction: task.requiresClientAction,
      clientVisible: input.clientVisible && task.clientVisible,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };
  });

  const taskCheckItems: ProjectTaskCheckItem[] = source.tasks.flatMap((task) =>
    task.checklist.map((label, position) => ({
      id: createId("team_works_project_check_item"),
      taskId: taskIdByTemplateId.get(task.id) ?? "",
      label,
      completed: false,
      position
    }))
  );
  const forms: ProjectForm[] = source.forms.map((form) => ({
    id: createId("team_works_project_form"),
    sourceTemplateFormId: form.id,
    projectId,
    phaseId: phaseIdByTemplateId.get(form.phaseId) ?? "",
    taskId: form.taskId ? taskIdByTemplateId.get(form.taskId) ?? null : null,
    name: form.name,
    inputRoleId: roleIdByName.get(form.inputRoleName) ?? projectRoles[0].id,
    reviewerRoleId: roleIdByName.get(form.reviewerRoleName) ?? projectRoles[0].id,
    required: form.required,
    clientVisible: input.clientVisible && form.clientVisible
  }));
  const deliverables: ProjectDeliverable[] = tasks.filter((task) => task.requiresDeliverable).map((task) => ({
    id: createId("team_works_project_deliverable"),
    projectId,
    phaseId: task.phaseId,
    taskId: task.id,
    title: `${task.title}の成果物`,
    type: "file_placeholder",
    url: "",
    version: 1,
    status: "draft",
    submittedByMemberId: task.assigneeMemberId,
    reviewedByMemberId: "",
    clientVisible: task.clientVisible,
    createdAt: now,
    updatedAt: now
  }));
  const project: Project = {
    id: projectId,
    organizationId: input.organizationId,
    clientId: input.clientId,
    name: input.name,
    description: input.description,
    goal: input.goal,
    status: input.status,
    startDate: input.startDate,
    dueDate: input.dueDate || (phases.at(-1)?.dueDate ?? ""),
    budget: input.budget,
    leaderMemberId: leader.id,
    templateId: template.id,
    templateVersionId: templateVersion.id,
    templateMappingVersion: 1,
    progressPercent: 0,
    clientVisible: input.clientVisible && source.featureSettings.clientPortal,
    memo: input.memo,
    createdAt: now,
    updatedAt: now
  };

  return { project, projectRoles, projectMembers, phases, tasks, taskCheckItems, forms, deliverables };
}
