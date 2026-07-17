import { supabase } from "@/lib/supabase/client";
import type { ProjectDeliverableStatus, ProjectFormAnswerValue } from "@/lib/team-works-projects";

export type TeamWorksPortalRole = "client" | "worker";

export type TeamWorksPortalMembership = {
  databaseProjectId: string;
  sourceProjectId: string;
  memberId: string;
  memberName: string;
  role: TeamWorksPortalRole;
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

async function findSourceRowId(table: "team_works_project_tasks" | "team_works_project_deliverables", projectId: string, sourceId: string) {
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
