import { supabase } from "@/lib/supabase/client";
import type {
  ProjectStatus,
  ProjectTaskStatus,
  TeamWorksProjectStoreState,
  TeamWorksProjectTemplateStoreState
} from "@/lib/team-works-projects";

const primaryOrganizationSourceId = "mikke-team-works-primary";

type TeamWorksDatabaseContext = {
  organizationId: string;
  ownerMemberId: string;
};

type DatabaseProjectRow = {
  id: string;
  source_local_id: string | null;
  title: string;
  status: "draft" | "active" | "on_hold" | "completed" | "cancelled" | "archived";
  client_visible: boolean;
  updated_at: string;
};

type DatabaseTaskRow = {
  source_local_id: string | null;
  title: string;
  status: "not_started" | "in_progress" | "review_pending" | "revising" | "completed" | "on_hold" | "cancelled" | "archived";
  client_visible: boolean;
  assignee_member_id: string | null;
  updated_at: string;
};

type DatabaseResourceRow = {
  source_local_id: string | null;
  title: string;
  resource_type: "url" | "note" | "file";
  audience: "admin" | "members" | "client" | "all";
  url: string | null;
  memo: string | null;
};

type DatabaseFormRow = {
  source_local_id: string | null;
  name: string;
  required: boolean;
  client_visible: boolean;
  editable_after_submit: boolean;
  fields: TeamWorksProjectStoreState["forms"][number]["fields"];
};

type DatabaseDeliverableRow = {
  source_local_id: string | null;
  title: string;
  deliverable_type: TeamWorksProjectStoreState["deliverables"][number]["type"];
  url: string;
  storage_path: string | null;
  version: number;
  status: TeamWorksProjectStoreState["deliverables"][number]["status"];
  client_visible: boolean;
  updated_at: string;
};

export type TeamWorksInviteRole = "manager" | "client_user" | "worker";

export type TeamWorksDatabaseSyncResult = {
  projects: number;
  tasks: number;
  resources: number;
  forms: number;
  deliverables: number;
  skippedResources: number;
};

async function requireCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Team Worksの同期にはログインが必要です。");
  return data.user;
}

async function ensureDatabaseContext(displayName: string): Promise<TeamWorksDatabaseContext> {
  const user = await requireCurrentUser();
  const { data: organization, error: organizationError } = await supabase
    .from("team_works_organizations")
    .upsert({
      owner_user_id: user.id,
      source_local_id: primaryOrganizationSourceId,
      name: `${displayName || "マイチーム"} Team Works`,
      status: "active",
      archived_at: null
    }, { onConflict: "owner_user_id,source_local_id" })
    .select("id")
    .single();
  if (organizationError) throw organizationError;

  const ownerSourceId = `owner:${user.id}`;
  const { data: ownerMember, error: memberError } = await supabase
    .from("team_works_organization_members")
    .upsert({
      organization_id: organization.id,
      user_id: user.id,
      source_local_id: ownerSourceId,
      display_name: displayName || "オーナー",
      role: "owner",
      status: "active",
      archived_at: null
    }, { onConflict: "organization_id,source_local_id" })
    .select("id")
    .single();
  if (memberError) throw memberError;

  return { organizationId: organization.id, ownerMemberId: ownerMember.id };
}

async function findDatabaseOrganizationId() {
  const user = await requireCurrentUser();
  const { data, error } = await supabase
    .from("team_works_organizations")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("source_local_id", primaryOrganizationSourceId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function createTeamWorksMemberInvite(input: {
  displayName: string;
  projectSourceId: string;
  email: string;
  role: TeamWorksInviteRole;
}) {
  const user = await requireCurrentUser();
  const context = await ensureDatabaseContext(input.displayName);
  const { data: project, error: projectError } = await supabase
    .from("team_works_projects")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("source_local_id", input.projectSourceId)
    .single();
  if (projectError) throw new Error("先にこの端末の案件をDBへ同期してください。");

  const { data, error } = await supabase
    .from("team_works_member_invites")
    .insert({
      organization_id: context.organizationId,
      project_id: project.id,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      created_by_user_id: user.id
    })
    .select("id,organization_id,role,expires_at")
    .single();
  if (error) throw error;
  return data as { id: string; organization_id: string; role: TeamWorksInviteRole; expires_at: string };
}

export async function acceptTeamWorksMemberInvite(input: {
  inviteId: string;
  organizationId: string;
  role: TeamWorksInviteRole;
  displayName: string;
}) {
  const user = await requireCurrentUser();
  const { error } = await supabase.from("team_works_organization_members").insert({
    organization_id: input.organizationId,
    user_id: user.id,
    source_local_id: `invite:${input.inviteId}`,
    display_name: input.displayName || user.email || "メンバー",
    role: input.role,
    status: "active",
    invite_id: input.inviteId
  });
  if (error) throw error;
}

export async function syncTeamWorksProjectStateToDatabase(input: {
  displayName: string;
  projectState: TeamWorksProjectStoreState;
  templateState: TeamWorksProjectTemplateStoreState;
}): Promise<TeamWorksDatabaseSyncResult> {
  const context = await ensureDatabaseContext(input.displayName);
  const templateById = new Map(input.templateState.templates.map((template) => [template.id, template]));
  const projectRows = input.projectState.projects.map((project) => {
    const features = project.templateId ? templateById.get(project.templateId)?.featureSettings : undefined;
    return {
      organization_id: context.organizationId,
      source_local_id: project.id,
      title: project.name,
      status: toDatabaseProjectStatus(project.status),
      client_visible: project.clientVisible,
      archived_at: null,
      updated_at: project.updatedAt,
      ...(features ? {
        payouts_enabled: features.payouts,
        invoices_enabled: features.invoices
      } : {})
    };
  });

  if (projectRows.length === 0) return { projects: 0, tasks: 0, resources: 0, forms: 0, deliverables: 0, skippedResources: 0 };

  const { data: savedProjects, error: projectError } = await supabase
    .from("team_works_projects")
    .upsert(projectRows, { onConflict: "organization_id,source_local_id" })
    .select("id,source_local_id");
  if (projectError) throw projectError;

  const databaseProjectIdBySourceId = new Map(
    (savedProjects ?? []).flatMap((project) => project.source_local_id ? [[project.source_local_id, project.id] as const] : [])
  );
  const ownerProjectMemberRows = [...databaseProjectIdBySourceId.values()].map((projectId) => ({
    project_id: projectId,
    organization_id: context.organizationId,
    organization_member_id: context.ownerMemberId,
    project_role: "owner"
  }));
  if (ownerProjectMemberRows.length > 0) {
    const { error } = await supabase
      .from("team_works_project_members")
      .upsert(ownerProjectMemberRows, { onConflict: "project_id,organization_member_id" });
    if (error) throw error;
  }
  const { data: databaseProjectMembers, error: projectMemberError } = await supabase
    .from("team_works_project_members")
    .select("project_id,organization_member_id")
    .in("project_id", [...databaseProjectIdBySourceId.values()]);
  if (projectMemberError) throw projectMemberError;
  const databaseProjectMemberKeys = new Set((databaseProjectMembers ?? []).map((member) => `${member.project_id}:${member.organization_member_id}`));
  const taskRows = input.projectState.tasks.flatMap((task) => {
    const databaseProjectId = databaseProjectIdBySourceId.get(task.projectId);
    if (!databaseProjectId) return [];
    return [{
      project_id: databaseProjectId,
      source_local_id: task.id,
      title: task.title,
      status: toDatabaseTaskStatus(task.status),
      client_visible: task.clientVisible,
      archived_at: null,
      updated_at: task.updatedAt,
      ...(databaseProjectMemberKeys.has(`${databaseProjectId}:${task.assigneeMemberId}`) ? { assignee_member_id: task.assigneeMemberId } : {})
    }];
  });

  let savedTasks: { id: string; source_local_id: string | null }[] = [];
  if (taskRows.length > 0) {
    const { data, error } = await supabase
      .from("team_works_project_tasks")
      .upsert(taskRows, { onConflict: "project_id,source_local_id" })
      .select("id,source_local_id");
    if (error) throw error;
    savedTasks = data ?? [];
  }

  const databaseTaskIdBySourceId = new Map(
    savedTasks.flatMap((task) => task.source_local_id ? [[task.source_local_id, task.id] as const] : [])
  );
  let skippedResources = 0;
  const resourceRows = input.projectState.resources.flatMap((resource) => {
    const databaseProjectId = databaseProjectIdBySourceId.get(resource.projectId);
    const hasContent = resource.type === "url" ? Boolean(resource.url.trim()) : Boolean(resource.memo.trim());
    if (!databaseProjectId || !hasContent) {
      skippedResources += 1;
      return [];
    }
    return [{
      project_id: databaseProjectId,
      task_id: resource.taskId ? databaseTaskIdBySourceId.get(resource.taskId) ?? null : null,
      source_local_id: resource.id,
      title: resource.title,
      resource_type: resource.type,
      audience: resource.audience,
      url: resource.type === "url" ? resource.url : null,
      memo: resource.type === "note" ? resource.memo : null,
      storage_path: null,
      archived_at: null
    }];
  });

  if (resourceRows.length > 0) {
    const { error } = await supabase
      .from("team_works_project_resources")
      .upsert(resourceRows, { onConflict: "project_id,source_local_id" });
    if (error) throw error;
  }

  const roleNameById = new Map(input.projectState.projectRoles.map((role) => [role.id, role.name]));
  const formRows = input.projectState.forms.flatMap((form) => {
    const databaseProjectId = databaseProjectIdBySourceId.get(form.projectId);
    if (!databaseProjectId) return [];
    const inputRoleName = roleNameById.get(form.inputRoleId) ?? "";
    const inputActor = inputRoleName.includes("クライアント") ? "client" : inputRoleName.includes("管理") ? "admin" : "worker";
    return [{
      project_id: databaseProjectId,
      task_id: form.taskId ? databaseTaskIdBySourceId.get(form.taskId) ?? null : null,
      source_local_id: form.id,
      name: form.name,
      input_actor: inputActor,
      required: form.required,
      client_visible: form.clientVisible,
      editable_after_submit: form.editableAfterSubmit,
      fields: form.fields,
      archived_at: null
    }];
  });
  if (formRows.length > 0) {
    const { error } = await supabase
      .from("team_works_project_forms")
      .upsert(formRows, { onConflict: "project_id,source_local_id" });
    if (error) throw error;
  }

  const deliverableRows = input.projectState.deliverables.flatMap((deliverable) => {
    const databaseProjectId = databaseProjectIdBySourceId.get(deliverable.projectId);
    const databaseTaskId = databaseTaskIdBySourceId.get(deliverable.taskId);
    if (!databaseProjectId || !databaseTaskId) return [];
    return [{
      project_id: databaseProjectId,
      task_id: databaseTaskId,
      source_local_id: deliverable.id,
      title: deliverable.title,
      deliverable_type: deliverable.type,
      url: deliverable.type === "url" ? deliverable.url : "",
      storage_path: deliverable.storagePath ?? null,
      version: deliverable.version,
      status: deliverable.status,
      client_visible: deliverable.clientVisible,
      updated_at: deliverable.updatedAt
    }];
  });
  if (deliverableRows.length > 0) {
    const { error } = await supabase
      .from("team_works_project_deliverables")
      .upsert(deliverableRows, { onConflict: "project_id,source_local_id" });
    if (error) throw error;
  }

  return {
    projects: projectRows.length,
    tasks: taskRows.length,
    resources: resourceRows.length,
    forms: formRows.length,
    deliverables: deliverableRows.length,
    skippedResources
  };
}

export async function readTeamWorksProjectStateFromDatabase(input: {
  localState: TeamWorksProjectStoreState;
}) {
  const organizationId = await findDatabaseOrganizationId();
  if (!organizationId) {
    return { state: input.localState, matchedProjects: 0, databaseProjects: 0 };
  }
  const { data: projects, error: projectError } = await supabase
    .from("team_works_projects")
    .select("id,source_local_id,title,status,client_visible,updated_at")
    .eq("organization_id", organizationId);
  if (projectError) throw projectError;

  const projectRows = (projects ?? []) as DatabaseProjectRow[];
  const projectIds = projectRows.map((project) => project.id);
  let taskRows: DatabaseTaskRow[] = [];
  let resourceRows: DatabaseResourceRow[] = [];
  let formRows: DatabaseFormRow[] = [];
  let deliverableRows: DatabaseDeliverableRow[] = [];
  if (projectIds.length > 0) {
    const [tasks, resources, forms, deliverables] = await Promise.all([
      supabase
        .from("team_works_project_tasks")
        .select("source_local_id,title,status,client_visible,assignee_member_id,updated_at")
        .in("project_id", projectIds),
      supabase
        .from("team_works_project_resources")
        .select("source_local_id,title,resource_type,audience,url,memo")
        .in("project_id", projectIds),
      supabase
        .from("team_works_project_forms")
        .select("source_local_id,name,required,client_visible,editable_after_submit,fields")
        .in("project_id", projectIds),
      supabase
        .from("team_works_project_deliverables")
        .select("source_local_id,title,deliverable_type,url,storage_path,version,status,client_visible,updated_at")
        .in("project_id", projectIds)
    ]);
    if (tasks.error) throw tasks.error;
    if (resources.error) throw resources.error;
    if (forms.error) throw forms.error;
    if (deliverables.error) throw deliverables.error;
    taskRows = (tasks.data ?? []) as DatabaseTaskRow[];
    resourceRows = (resources.data ?? []) as DatabaseResourceRow[];
    formRows = (forms.data ?? []) as DatabaseFormRow[];
    deliverableRows = (deliverables.data ?? []) as DatabaseDeliverableRow[];
  }

  const projectBySourceId = new Map(projectRows.flatMap((row) => row.source_local_id ? [[row.source_local_id, row] as const] : []));
  const taskBySourceId = new Map(taskRows.flatMap((row) => row.source_local_id ? [[row.source_local_id, row] as const] : []));
  const resourceBySourceId = new Map(resourceRows.flatMap((row) => row.source_local_id ? [[row.source_local_id, row] as const] : []));
  const formBySourceId = new Map(formRows.flatMap((row) => row.source_local_id ? [[row.source_local_id, row] as const] : []));
  const deliverableBySourceId = new Map(deliverableRows.flatMap((row) => row.source_local_id ? [[row.source_local_id, row] as const] : []));

  const nextState: TeamWorksProjectStoreState = {
    ...input.localState,
    projects: input.localState.projects.map((project) => {
      const row = projectBySourceId.get(project.id);
      if (!row) return project;
      return {
        ...project,
        name: row.title,
        status: fromDatabaseProjectStatus(row.status, project.status),
        clientVisible: row.client_visible,
        updatedAt: row.updated_at
      };
    }),
    tasks: input.localState.tasks.map((task) => {
      const row = taskBySourceId.get(task.id);
      if (!row) return task;
      return {
        ...task,
        title: row.title,
        status: fromDatabaseTaskStatus(row.status, task.status),
        clientVisible: row.client_visible,
        assigneeMemberId: row.assignee_member_id ?? task.assigneeMemberId,
        updatedAt: row.updated_at
      };
    }),
    resources: input.localState.resources.map((resource) => {
      const row = resourceBySourceId.get(resource.id);
      if (!row || row.resource_type === "file") return resource;
      return {
        ...resource,
        title: row.title,
        type: row.resource_type,
        audience: row.audience,
        url: row.resource_type === "url" ? row.url ?? "" : "",
        memo: row.resource_type === "note" ? row.memo ?? "" : ""
      };
    }),
    forms: input.localState.forms.map((form) => {
      const row = formBySourceId.get(form.id);
      return row ? { ...form, name: row.name, required: row.required, clientVisible: row.client_visible, editableAfterSubmit: row.editable_after_submit, fields: row.fields } : form;
    }),
    deliverables: input.localState.deliverables.map((deliverable) => {
      const row = deliverableBySourceId.get(deliverable.id);
      return row ? { ...deliverable, title: row.title, type: row.deliverable_type, url: row.url, storagePath: row.storage_path ?? "", version: row.version, status: row.status, clientVisible: row.client_visible, updatedAt: row.updated_at } : deliverable;
    })
  };

  return {
    state: nextState,
    matchedProjects: input.localState.projects.filter((project) => projectBySourceId.has(project.id)).length,
    databaseProjects: projectRows.length
  };
}

function toDatabaseProjectStatus(status: ProjectStatus): DatabaseProjectRow["status"] {
  if (status === "draft" || status === "on_hold" || status === "completed" || status === "cancelled") return status;
  return "active";
}

function fromDatabaseProjectStatus(status: DatabaseProjectRow["status"], fallback: ProjectStatus): ProjectStatus {
  if (status === "draft" || status === "on_hold" || status === "completed" || status === "cancelled") return status;
  return fallback;
}

function toDatabaseTaskStatus(status: ProjectTaskStatus): DatabaseTaskRow["status"] {
  if (status === "not_started" || status === "in_progress" || status === "completed" || status === "on_hold") return status;
  if (status === "revision_requested") return "revising";
  if (status === "approved") return "completed";
  return "review_pending";
}

function fromDatabaseTaskStatus(status: DatabaseTaskRow["status"], fallback: ProjectTaskStatus): ProjectTaskStatus {
  if (status === "completed" && fallback === "approved") return fallback;
  if (status === "not_started" || status === "in_progress" || status === "completed" || status === "on_hold") return status;
  if (status === "revising") return "revision_requested";
  return fallback;
}
