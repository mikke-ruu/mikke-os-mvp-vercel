import { supabase } from "@/lib/supabase/client";
import type { ProjectDeliverableStatus, ProjectFormAnswerValue, TeamWorksProjectStoreState } from "@/lib/team-works-projects";

export type TeamWorksPortalRole = "client" | "worker";

export type TeamWorksPortalMembership = {
  databaseProjectId: string;
  sourceProjectId: string;
  memberId: string;
  memberName: string;
  role: TeamWorksPortalRole;
};

export type TeamWorksDatabaseProjectMember = {
  memberId: string;
  memberName: string;
  projectRole: "owner" | "manager" | "client" | "worker";
};

export type ReviewedTeamWorksFormSubmission = {
  reviewerMemberId: string;
  approvedByMemberId: string;
};

export async function readTeamWorksPortalMemberships(role: TeamWorksPortalRole) {
  const user = await requireCurrentUser();
  const { data: members, error: memberError } = await supabase
    .from("team_works_organization_members")
    .select("id,display_name")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (memberError) throw memberError;
  if (!members?.length) return [];

  const memberNameById = new Map(members.map((member) => [member.id, member.display_name]));
  const { data: projectMembers, error: projectMemberError } = await supabase
    .from("team_works_project_members")
    .select("project_id,organization_member_id,project_role")
    .in("organization_member_id", members.map((member) => member.id))
    .eq("project_role", role);
  if (projectMemberError) throw projectMemberError;
  if (!projectMembers?.length) return [];

  const { data: projects, error: projectError } = await supabase
    .from("team_works_projects")
    .select("id,source_local_id")
    .in("id", projectMembers.map((member) => member.project_id))
    .not("source_local_id", "is", null);
  if (projectError) throw projectError;
  const sourceIdByProjectId = new Map((projects ?? []).map((project) => [project.id, project.source_local_id as string]));

  return projectMembers.flatMap<TeamWorksPortalMembership>((membership) => {
    const sourceProjectId = sourceIdByProjectId.get(membership.project_id);
    if (!sourceProjectId) return [];
    return [{
      databaseProjectId: membership.project_id,
      sourceProjectId,
      memberId: membership.organization_member_id,
      memberName: memberNameById.get(membership.organization_member_id) ?? "メンバー",
      role
    }];
  });
}

export async function readTeamWorksProjectDatabaseMembers(projectSourceId: string) {
  await requireCurrentUser();
  const { data: project, error: projectError } = await supabase
    .from("team_works_projects")
    .select("id")
    .eq("source_local_id", projectSourceId)
    .single();
  if (projectError) throw projectError;
  const { data: projectMembers, error: projectMemberError } = await supabase
    .from("team_works_project_members")
    .select("organization_member_id,project_role")
    .eq("project_id", project.id);
  if (projectMemberError) throw projectMemberError;
  if (!projectMembers?.length) return [];
  const { data: members, error: memberError } = await supabase
    .from("team_works_organization_members")
    .select("id,display_name")
    .in("id", projectMembers.map((member) => member.organization_member_id));
  if (memberError) throw memberError;
  const memberNameById = new Map((members ?? []).map((member) => [member.id, member.display_name]));
  return projectMembers.map<TeamWorksDatabaseProjectMember>((member) => ({
    memberId: member.organization_member_id,
    memberName: memberNameById.get(member.organization_member_id) ?? "メンバー",
    projectRole: member.project_role
  }));
}

export async function saveTeamWorksTaskAssignment(input: {
  projectSourceId: string;
  taskSourceId: string;
  assigneeMemberId: string | null;
}) {
  await requireCurrentUser();
  const { data: project, error: projectError } = await supabase
    .from("team_works_projects")
    .select("id")
    .eq("source_local_id", input.projectSourceId)
    .single();
  if (projectError) throw new Error("先にこの案件をDBへ同期してください。");
  const { error } = await supabase
    .from("team_works_project_tasks")
    .update({ assignee_member_id: input.assigneeMemberId, updated_at: new Date().toISOString() })
    .eq("project_id", project.id)
    .eq("source_local_id", input.taskSourceId)
    .select("id")
    .single();
  if (error) throw new Error("タスクをDBへ同期してから、実メンバーを割り当ててください。");
}

export async function readTeamWorksPortalCollaborationState(
  memberships: TeamWorksPortalMembership[],
  localState: TeamWorksProjectStoreState
) {
  if (memberships.length === 0) return localState;
  await requireCurrentUser();
  const projectIds = memberships.map((membership) => membership.databaseProjectId);
  const [forms, submissions, tasks, deliverables, comments] = await Promise.all([
    supabase.from("team_works_project_forms").select("id,project_id,source_local_id").in("project_id", projectIds),
    supabase.from("team_works_form_submissions").select("id,project_id,form_id,submitted_by_member_id,source_local_id,answers,status,review_memo,reviewed_by_member_id,approved_by_member_id,submitted_at,created_at,updated_at").in("project_id", projectIds),
    supabase.from("team_works_project_tasks").select("id,project_id,source_local_id,assignee_member_id").in("project_id", projectIds),
    supabase.from("team_works_project_deliverables").select("id,project_id,source_local_id,title,deliverable_type,url,version,status,submitted_by_member_id,reviewed_by_member_id,client_visible,updated_at").in("project_id", projectIds),
    supabase.from("team_works_project_comments").select("id,project_id,task_id,deliverable_id,author_member_id,source_local_id,audience,body,created_at,updated_at").in("project_id", projectIds)
  ]);
  for (const result of [forms, submissions, tasks, deliverables, comments]) if (result.error) throw result.error;

  const membershipByDatabaseProjectId = new Map(memberships.map((membership) => [membership.databaseProjectId, membership]));
  const formSourceById = new Map((forms.data ?? []).flatMap((row) => row.source_local_id ? [[row.id, row.source_local_id] as const] : []));
  const taskSourceById = new Map((tasks.data ?? []).flatMap((row) => row.source_local_id ? [[row.id, row.source_local_id] as const] : []));
  const deliverableSourceById = new Map((deliverables.data ?? []).flatMap((row) => row.source_local_id ? [[row.id, row.source_local_id] as const] : []));

  const databaseSubmissions = (submissions.data ?? []).flatMap((row) => {
    const membership = membershipByDatabaseProjectId.get(row.project_id);
    const formId = formSourceById.get(row.form_id);
    if (!membership || !formId) return [];
    return [{
      id: row.source_local_id ?? row.id,
      projectId: membership.sourceProjectId,
      formId,
      submittedByActor: membership.role,
      submittedById: row.submitted_by_member_id,
      answers: row.answers as Record<string, ProjectFormAnswerValue>,
      status: row.status,
      reviewMemo: row.review_memo,
      reviewedByMemberId: row.reviewed_by_member_id ?? "",
      approvedByMemberId: row.approved_by_member_id ?? "",
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }];
  });
  const submissionKeys = new Set(databaseSubmissions.map((submission) => `${submission.formId}:${submission.submittedById}`));

  const databaseComments = (comments.data ?? []).flatMap((row) => {
    const membership = membershipByDatabaseProjectId.get(row.project_id);
    if (!membership) return [];
    const taskId = row.task_id ? taskSourceById.get(row.task_id) ?? null : null;
    const deliverableId = row.deliverable_id ? deliverableSourceById.get(row.deliverable_id) ?? null : null;
    const localTask = taskId ? localState.tasks.find((task) => task.id === taskId) : null;
    const localDeliverable = deliverableId ? localState.deliverables.find((deliverable) => deliverable.id === deliverableId) : null;
    return [{
      id: row.source_local_id ?? row.id,
      projectId: membership.sourceProjectId,
      phaseId: localTask?.phaseId ?? localDeliverable?.phaseId ?? null,
      taskId,
      deliverableId,
      authorMemberId: row.author_member_id,
      audience: row.audience,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }];
  });
  const databaseCommentIds = new Set(databaseComments.map((comment) => comment.id));
  const taskAssigneeBySourceId = new Map((tasks.data ?? []).flatMap((row) => row.source_local_id ? [[row.source_local_id, row.assignee_member_id ?? ""] as const] : []));
  const deliverableBySourceId = new Map((deliverables.data ?? []).flatMap((row) => row.source_local_id ? [[row.source_local_id, row] as const] : []));

  return {
    ...localState,
    tasks: localState.tasks.map((task) => taskAssigneeBySourceId.has(task.id) ? { ...task, assigneeMemberId: taskAssigneeBySourceId.get(task.id) ?? "" } : task),
    deliverables: localState.deliverables.map((deliverable) => {
      const row = deliverableBySourceId.get(deliverable.id);
      return row ? {
        ...deliverable,
        title: row.title ?? deliverable.title,
        type: row.deliverable_type ?? deliverable.type,
        url: row.url ?? deliverable.url,
        version: row.version ?? deliverable.version,
        status: row.status,
        submittedByMemberId: row.submitted_by_member_id ?? "",
        reviewedByMemberId: row.reviewed_by_member_id ?? "",
        clientVisible: row.client_visible,
        updatedAt: row.updated_at
      } : deliverable;
    }),
    formSubmissions: [
      ...localState.formSubmissions.filter((submission) => !submissionKeys.has(`${submission.formId}:${submission.submittedById}`)),
      ...databaseSubmissions
    ],
    comments: [
      ...localState.comments.filter((comment) => !databaseCommentIds.has(comment.id)),
      ...databaseComments
    ]
  } satisfies TeamWorksProjectStoreState;
}

export async function saveTeamWorksPortalFormSubmission(input: {
  membership: TeamWorksPortalMembership;
  formSourceId: string;
  submissionSourceId: string;
  answers: Record<string, ProjectFormAnswerValue>;
  status: "draft" | "submitted";
}) {
  await requireCurrentUser();
  const { data: form, error: formError } = await supabase
    .from("team_works_project_forms")
    .select("id")
    .eq("project_id", input.membership.databaseProjectId)
    .eq("source_local_id", input.formSourceId)
    .single();
  if (formError) throw formError;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("team_works_form_submissions")
    .upsert({
      project_id: input.membership.databaseProjectId,
      form_id: form.id,
      submitted_by_member_id: input.membership.memberId,
      source_local_id: input.submissionSourceId,
      answers: input.answers,
      status: input.status,
      submitted_at: input.status === "submitted" ? now : null,
      updated_at: now
    }, { onConflict: "form_id,submitted_by_member_id" });
  if (error) throw error;
}

export async function reviewTeamWorksPortalFormSubmission(input: {
  projectSourceId: string;
  formSourceId: string;
  submittedByMemberId: string;
  nextStatus: "revision_requested" | "approved";
  reviewMemo: string;
}): Promise<ReviewedTeamWorksFormSubmission> {
  await requireCurrentUser();
  const projectId = await findProjectIdBySource(input.projectSourceId);
  const [formId, reviewerMemberId] = await Promise.all([
    findSourceRowId("team_works_project_forms", projectId, input.formSourceId),
    findCurrentStaffProjectMemberId(projectId)
  ]);
  const now = new Date().toISOString();
  const approvedByMemberId = input.nextStatus === "approved" ? reviewerMemberId : null;
  const { data, error } = await supabase
    .from("team_works_form_submissions")
    .update({
      status: input.nextStatus,
      review_memo: input.reviewMemo.trim(),
      reviewed_by_member_id: reviewerMemberId,
      approved_by_member_id: approvedByMemberId,
      updated_at: now
    })
    .eq("project_id", projectId)
    .eq("form_id", formId)
    .eq("submitted_by_member_id", input.submittedByMemberId)
    .eq("status", "submitted")
    .select("reviewed_by_member_id,approved_by_member_id")
    .single();
  if (error) throw error;
  return {
    reviewerMemberId: data.reviewed_by_member_id ?? reviewerMemberId,
    approvedByMemberId: data.approved_by_member_id ?? ""
  };
}

export async function saveTeamWorksWorkerDeliverable(input: {
  membership: TeamWorksPortalMembership;
  taskSourceId: string;
  deliverableSourceId: string;
  title: string;
  type: "url" | "file_placeholder" | "note";
  url: string;
  version: number;
  status: Extract<ProjectDeliverableStatus, "draft" | "submitted">;
  clientVisible: boolean;
}) {
  await requireCurrentUser();
  const taskId = await findSourceRowId("team_works_project_tasks", input.membership.databaseProjectId, input.taskSourceId);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("team_works_project_deliverables")
    .upsert({
      project_id: input.membership.databaseProjectId,
      task_id: taskId,
      source_local_id: input.deliverableSourceId,
      title: input.title.trim(),
      deliverable_type: input.type,
      url: input.type === "url" ? input.url.trim() : input.url,
      version: input.version,
      status: input.status,
      submitted_by_member_id: input.membership.memberId,
      client_visible: input.clientVisible,
      updated_at: now
    }, { onConflict: "project_id,source_local_id" });
  if (error) throw error;
}

export async function saveTeamWorksPortalComment(input: {
  membership: TeamWorksPortalMembership;
  commentSourceId: string;
  taskSourceId?: string | null;
  deliverableSourceId?: string | null;
  audience: "internal" | "client";
  body: string;
}) {
  await requireCurrentUser();
  const [taskId, deliverableId] = await Promise.all([
    input.taskSourceId ? findSourceRowId("team_works_project_tasks", input.membership.databaseProjectId, input.taskSourceId) : null,
    input.deliverableSourceId ? findSourceRowId("team_works_project_deliverables", input.membership.databaseProjectId, input.deliverableSourceId) : null
  ]);
  const { error } = await supabase.from("team_works_project_comments").insert({
    project_id: input.membership.databaseProjectId,
    task_id: taskId,
    deliverable_id: deliverableId,
    author_member_id: input.membership.memberId,
    source_local_id: input.commentSourceId,
    audience: input.audience,
    body: input.body.trim()
  });
  if (error) throw error;
}

export async function reviewTeamWorksPortalDeliverable(input: {
  membership: TeamWorksPortalMembership;
  deliverableSourceId: string;
  nextStatus: Extract<ProjectDeliverableStatus, "revision_requested" | "approved">;
}) {
  await requireCurrentUser();
  const { error } = await supabase
    .from("team_works_project_deliverables")
    .update({ status: input.nextStatus, reviewed_by_member_id: input.membership.memberId, updated_at: new Date().toISOString() })
    .eq("project_id", input.membership.databaseProjectId)
    .eq("source_local_id", input.deliverableSourceId)
    .eq("status", "client_review")
    .select("id")
    .single();
  if (error) throw error;
}

async function findProjectIdBySource(projectSourceId: string) {
  const { data, error } = await supabase
    .from("team_works_projects")
    .select("id")
    .eq("source_local_id", projectSourceId)
    .single();
  if (error) throw error;
  return data.id as string;
}

async function findCurrentStaffProjectMemberId(projectId: string) {
  const user = await requireCurrentUser();
  const { data: projectMembers, error: projectMemberError } = await supabase
    .from("team_works_project_members")
    .select("organization_member_id")
    .eq("project_id", projectId)
    .in("project_role", ["owner", "manager"]);
  if (projectMemberError) throw projectMemberError;
  const staffMemberIds = (projectMembers ?? []).map((member) => member.organization_member_id);
  if (staffMemberIds.length === 0) throw new Error("Team Works staff member was not found.");
  const { data: member, error: memberError } = await supabase
    .from("team_works_organization_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("id", staffMemberIds)
    .single();
  if (memberError) throw memberError;
  return member.id as string;
}

async function findSourceRowId(table: "team_works_project_tasks" | "team_works_project_deliverables" | "team_works_project_forms", projectId: string, sourceId: string) {
  const { data, error } = await supabase.from(table).select("id").eq("project_id", projectId).eq("source_local_id", sourceId).single();
  if (error) throw error;
  return data.id as string;
}

async function requireCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Team Worksポータルの利用にはログインが必要です。");
  return data.user;
}
