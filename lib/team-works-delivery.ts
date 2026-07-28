import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStaffOrganizationIds } from "@/lib/team-works-operations";
import { ensureStaffOrganizationContext, isDatabaseProjectId } from "@/lib/team-works-operations-project";

// 納品型(style='delivery')プロジェクトのSupabase読み書き。
// テーブル自体はP8-a/P8-cで既に用意されていたが、UIはlocalStorageのままだった。
// RLSが行レベルで可視範囲を絞ってくれるため、クライアント側は素直にSELECTするだけでよい
// (本部staffは全件、worker/clientは自分が対象の行だけが返る)。

export type DeliveryTaskStatus =
  | "not_started"
  | "in_progress"
  | "review_pending"
  | "revising"
  | "completed"
  | "on_hold"
  | "cancelled"
  | "archived";

export const deliveryTaskStatusLabels: Record<DeliveryTaskStatus, string> = {
  not_started: "未着手",
  in_progress: "進行中",
  review_pending: "確認待ち",
  revising: "修正中",
  completed: "完了",
  on_hold: "保留",
  cancelled: "中止",
  archived: "アーカイブ"
};

export type DeliveryProjectSummary = {
  id: string;
  organizationId: string;
  title: string;
  status: string;
  clientVisible: boolean;
};

export type DeliveryTask = {
  id: string;
  projectId: string;
  title: string;
  status: DeliveryTaskStatus;
  assigneeMemberId: string | null;
  clientVisible: boolean;
  dueOn: string | null;
};

export type DeliveryProjectMember = {
  organizationMemberId: string;
  projectRole: "owner" | "manager" | "client" | "worker";
  displayName: string;
};

export type DeliveryProjectDetail = {
  project: DeliveryProjectSummary;
  tasks: DeliveryTask[];
  members: DeliveryProjectMember[];
};

function toTask(row: Record<string, unknown>): DeliveryTask {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    status: row.status as DeliveryTaskStatus,
    assigneeMemberId: (row.assignee_member_id as string) ?? null,
    clientVisible: Boolean(row.client_visible),
    dueOn: (row.due_on as string) ?? null
  };
}

export async function createDeliveryProject(
  client: SupabaseClient,
  input: { organizationName: string; title: string }
): Promise<string> {
  const { organizationId, organizationMemberId, projectRole } = await ensureStaffOrganizationContext(client, input.organizationName);

  const { data: project, error: projectError } = await client
    .from("team_works_projects")
    .insert({
      organization_id: organizationId,
      title: input.title.trim(),
      style: "delivery",
      status: "draft",
      client_visible: false,
      payouts_enabled: false,
      invoices_enabled: false
    })
    .select("id")
    .single();
  if (projectError) throw projectError;

  const projectId = project.id as string;
  const { error: projectMemberError } = await client.from("team_works_project_members").insert({
    project_id: projectId,
    organization_id: organizationId,
    organization_member_id: organizationMemberId,
    project_role: projectRole
  });
  if (projectMemberError) {
    await client.from("team_works_projects").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", projectId);
    throw projectMemberError;
  }

  return projectId;
}

export async function fetchDeliveryProjects(client: SupabaseClient): Promise<DeliveryProjectSummary[]> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return [];
  const { data, error } = await client
    .from("team_works_projects")
    .select("id,organization_id,title,status,client_visible")
    .in("organization_id", organizationIds)
    .eq("style", "delivery")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    title: row.title as string,
    status: row.status as string,
    clientVisible: Boolean(row.client_visible)
  }));
}

// ポータル(worker/client)向け。RLSが「本部staff or 自分がメンバーのプロジェクト」だけを
// 返すので、組織IDでの絞り込みは不要。
export async function fetchMyDeliveryProjects(client: SupabaseClient): Promise<DeliveryProjectSummary[]> {
  const { data, error } = await client
    .from("team_works_projects")
    .select("id,organization_id,title,status,client_visible")
    .eq("style", "delivery")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    title: row.title as string,
    status: row.status as string,
    clientVisible: Boolean(row.client_visible)
  }));
}

export async function loadDeliveryProjectDetail(client: SupabaseClient, projectId: string): Promise<DeliveryProjectDetail | null> {
  if (!isDatabaseProjectId(projectId)) return null;
  const { data: projectRow, error: projectError } = await client
    .from("team_works_projects")
    .select("id,organization_id,title,status,client_visible,style")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!projectRow || projectRow.style !== "delivery") return null;

  const [taskResult, memberResult] = await Promise.all([
    client
      .from("team_works_project_tasks")
      .select("id,project_id,title,status,assignee_member_id,client_visible,due_on")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("due_on", { ascending: true, nullsFirst: false }),
    client
      .from("team_works_project_members")
      .select("organization_member_id,project_role,team_works_organization_members(display_name)")
      .eq("project_id", projectId)
  ]);
  if (taskResult.error) throw taskResult.error;
  if (memberResult.error) throw memberResult.error;

  return {
    project: {
      id: projectRow.id as string,
      organizationId: projectRow.organization_id as string,
      title: projectRow.title as string,
      status: projectRow.status as string,
      clientVisible: Boolean(projectRow.client_visible)
    },
    tasks: (taskResult.data ?? []).map(toTask),
    members: (memberResult.data ?? []).map((row) => ({
      organizationMemberId: row.organization_member_id as string,
      projectRole: row.project_role as DeliveryProjectMember["projectRole"],
      displayName:
        (row.team_works_organization_members as { display_name?: string } | null)?.display_name ?? "メンバー"
    }))
  };
}

export async function createDeliveryTask(
  client: SupabaseClient,
  input: { projectId: string; title: string; assigneeMemberId: string | null; dueOn: string | null; clientVisible: boolean }
): Promise<void> {
  const { error } = await client.from("team_works_project_tasks").insert({
    project_id: input.projectId,
    title: input.title,
    assignee_member_id: input.assigneeMemberId,
    due_on: input.dueOn,
    client_visible: input.clientVisible
  });
  if (error) throw error;
}

export async function updateDeliveryTask(
  client: SupabaseClient,
  taskId: string,
  patch: Partial<{ title: string; status: DeliveryTaskStatus; assigneeMemberId: string | null; dueOn: string | null; clientVisible: boolean }>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.assigneeMemberId !== undefined) payload.assignee_member_id = patch.assigneeMemberId;
  if (patch.dueOn !== undefined) payload.due_on = patch.dueOn;
  if (patch.clientVisible !== undefined) payload.client_visible = patch.clientVisible;
  payload.updated_at = new Date().toISOString();
  const { error } = await client.from("team_works_project_tasks").update(payload).eq("id", taskId);
  if (error) throw error;
}

export type DeliveryCalendarTask = DeliveryTask & { projectTitle: string };

// 期日が設定されている自分の可視範囲のタスクを横断取得する。
// RLSが本部staff/worker/clientの可視範囲を自動で絞るため、フィルタ条件は
// 「期日がある」「アーカイブされていない」だけでよい。
export async function loadDeliveryCalendarTasks(client: SupabaseClient): Promise<DeliveryCalendarTask[]> {
  const { data, error } = await client
    .from("team_works_project_tasks")
    .select("id,project_id,title,status,assignee_member_id,client_visible,due_on,team_works_projects(title)")
    .not("due_on", "is", null)
    .is("archived_at", null)
    .order("due_on", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...toTask(row),
    projectTitle: (row.team_works_projects as { title?: string } | null)?.title ?? "プロジェクト"
  }));
}
