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
  dueOn: string | null;
};

export type DeliveryTaskOwnerRole = "admin" | "worker" | "client";
export const deliveryTaskOwnerRoleLabels: Record<DeliveryTaskOwnerRole, string> = {
  admin: "本部",
  worker: "担当メンバー",
  client: "クライアント"
};

export type DeliveryTaskSubmissionType = "none" | "form" | "file" | "url";
export const deliveryTaskSubmissionTypeLabels: Record<DeliveryTaskSubmissionType, string> = {
  none: "提出物なし",
  form: "フォーム",
  file: "ファイル",
  url: "URL"
};

export type DeliveryTask = {
  id: string;
  projectId: string;
  title: string;
  status: DeliveryTaskStatus;
  assigneeMemberId: string | null;
  assigneeLabel: string | null;
  clientVisible: boolean;
  dueOn: string | null;
  submitDueOn: string | null;
  position: number | null;
  ownerRole: DeliveryTaskOwnerRole | null;
  submissionType: DeliveryTaskSubmissionType;
  needsInternalReview: boolean;
  needsClientReview: boolean;
  // 成果物ストレージのパス(P8-g/P8-h)がsource_local_idをキーにしているため、
  // 作成時に発行して持たせておく。表示上の意味は持たない内部識別子。
  sourceLocalId: string | null;
  // 納期からの逆算配置に使う、この工程に要する標準日数。
  standardDays: number | null;
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
    assigneeLabel: (row.assignee_label as string) ?? null,
    clientVisible: Boolean(row.client_visible),
    dueOn: (row.due_on as string) ?? null,
    submitDueOn: (row.submit_due_on as string) ?? null,
    position: (row.position as number) ?? null,
    ownerRole: (row.owner_role as DeliveryTaskOwnerRole) ?? null,
    submissionType: (row.submission_type as DeliveryTaskSubmissionType) ?? "none",
    needsInternalReview: Boolean(row.needs_internal_review),
    needsClientReview: Boolean(row.needs_client_review),
    sourceLocalId: (row.source_local_id as string) ?? null,
    standardDays: (row.standard_days as number) ?? null
  };
}

const taskColumns =
  "id,project_id,title,status,assignee_member_id,assignee_label,client_visible,due_on,submit_due_on,position,owner_role,submission_type,needs_internal_review,needs_client_review,source_local_id,standard_days";

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
    .select("id,organization_id,title,status,client_visible,delivery_due_on")
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
    clientVisible: Boolean(row.client_visible),
    dueOn: (row.delivery_due_on as string) ?? null
  }));
}

// ポータル(worker/client)向け。RLSが「本部staff or 自分がメンバーのプロジェクト」だけを
// 返すので、組織IDでの絞り込みは不要。
export async function fetchMyDeliveryProjects(client: SupabaseClient): Promise<DeliveryProjectSummary[]> {
  const { data, error } = await client
    .from("team_works_projects")
    .select("id,organization_id,title,status,client_visible,delivery_due_on")
    .eq("style", "delivery")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    title: row.title as string,
    status: row.status as string,
    clientVisible: Boolean(row.client_visible),
    dueOn: (row.delivery_due_on as string) ?? null
  }));
}

export async function loadDeliveryProjectDetail(client: SupabaseClient, projectId: string): Promise<DeliveryProjectDetail | null> {
  if (!isDatabaseProjectId(projectId)) return null;
  const { data: projectRow, error: projectError } = await client
    .from("team_works_projects")
    .select("id,organization_id,title,status,client_visible,style,delivery_due_on")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!projectRow || projectRow.style !== "delivery") return null;

  const [taskResult, memberResult] = await Promise.all([
    client
      .from("team_works_project_tasks")
      .select(taskColumns)
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("position", { ascending: true, nullsFirst: false })
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
      clientVisible: Boolean(projectRow.client_visible),
      dueOn: (projectRow.delivery_due_on as string) ?? null
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
  input: {
    projectId: string;
    title: string;
    assigneeMemberId: string | null;
    assigneeLabel?: string | null;
    dueOn: string | null;
    submitDueOn?: string | null;
    clientVisible: boolean;
    position?: number | null;
    ownerRole?: DeliveryTaskOwnerRole | null;
    submissionType?: DeliveryTaskSubmissionType;
    needsInternalReview?: boolean;
    needsClientReview?: boolean;
    standardDays?: number | null;
  }
): Promise<void> {
  const { error } = await client.from("team_works_project_tasks").insert({
    project_id: input.projectId,
    source_local_id: crypto.randomUUID(),
    title: input.title,
    assignee_member_id: input.assigneeMemberId,
    assignee_label: input.assigneeLabel ?? null,
    due_on: input.dueOn,
    submit_due_on: input.submitDueOn ?? null,
    client_visible: input.clientVisible,
    position: input.position ?? null,
    owner_role: input.ownerRole ?? null,
    submission_type: input.submissionType ?? "none",
    needs_internal_review: input.needsInternalReview ?? false,
    needs_client_review: input.needsClientReview ?? false,
    standard_days: input.standardDays ?? null
  });
  if (error) throw error;
}

export async function updateDeliveryProjectDueOn(client: SupabaseClient, projectId: string, dueOn: string | null): Promise<void> {
  const { error } = await client
    .from("team_works_projects")
    .update({ delivery_due_on: dueOn, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw error;
}

function addDays(dateOn: string, days: number): string {
  const date = new Date(`${dateOn}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// 納期(project.dueOn)から逆算して、並び順(position)の最後の工程がその日に
// 完了するように各工程のdue_on/submit_due_onを埋める。標準日数が未設定の工程は
// 3日として扱う。確認が必要な工程は、確認の余裕として提出期日を完了期日の
// 1日前に置く(確認不要なら提出=完了と同日)。後から個別に調整できる。
export async function autoScheduleDeliveryTasks(client: SupabaseClient, input: { tasks: DeliveryTask[]; dueOn: string }): Promise<void> {
  const ordered = [...input.tasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const dueOnByTaskId = new Map<string, string>();
  let cursor = input.dueOn;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const task = ordered[index];
    dueOnByTaskId.set(task.id, cursor);
    cursor = addDays(cursor, -(task.standardDays ?? 3));
  }
  await Promise.all(
    ordered.map((task) => {
      const dueOn = dueOnByTaskId.get(task.id) as string;
      const submitDueOn = task.needsInternalReview || task.needsClientReview ? addDays(dueOn, -1) : dueOn;
      return client
        .from("team_works_project_tasks")
        .update({ due_on: dueOn, submit_due_on: submitDueOn, updated_at: new Date().toISOString() })
        .eq("id", task.id);
    })
  );
}

// 本部/worker/clientいずれでも使う共通ヘルパー。「今ログインしている人は
// このプロジェクトで誰か(organization_member_id・project_role)」を返す。
// team_works_project_membersのRLSはプロジェクトメンバー全員に全行を見せる
// (自分の行だけに絞られていない)ため、自分のorganization_members.idの
// 集合と突き合わせて自分の行を特定する。
export async function resolveMyDeliveryProjectMembership(
  client: SupabaseClient,
  projectId: string
): Promise<DeliveryProjectMember | null> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data: myMembers, error: memberError } = await client
    .from("team_works_organization_members")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("status", "active");
  if (memberError) throw memberError;
  const myMemberIds = new Set((myMembers ?? []).map((row) => row.id as string));
  if (myMemberIds.size === 0) return null;

  const { data: projectMembers, error: projectMemberError } = await client
    .from("team_works_project_members")
    .select("organization_member_id,project_role,team_works_organization_members(display_name)")
    .eq("project_id", projectId);
  if (projectMemberError) throw projectMemberError;
  const mine = (projectMembers ?? []).find((row) => myMemberIds.has(row.organization_member_id as string));
  if (!mine) return null;
  return {
    organizationMemberId: mine.organization_member_id as string,
    projectRole: mine.project_role as DeliveryProjectMember["projectRole"],
    displayName: (mine.team_works_organization_members as { display_name?: string } | null)?.display_name ?? "メンバー"
  };
}

export async function reorderDeliveryTasks(client: SupabaseClient, taskIdsInOrder: string[]): Promise<void> {
  await Promise.all(
    taskIdsInOrder.map((taskId, index) =>
      client.from("team_works_project_tasks").update({ position: index, updated_at: new Date().toISOString() }).eq("id", taskId)
    )
  );
}

export async function updateDeliveryTask(
  client: SupabaseClient,
  taskId: string,
  patch: Partial<{
    title: string;
    status: DeliveryTaskStatus;
    assigneeMemberId: string | null;
    assigneeLabel: string | null;
    dueOn: string | null;
    submitDueOn: string | null;
    clientVisible: boolean;
    ownerRole: DeliveryTaskOwnerRole | null;
    submissionType: DeliveryTaskSubmissionType;
    needsInternalReview: boolean;
    needsClientReview: boolean;
    standardDays: number | null;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.assigneeMemberId !== undefined) payload.assignee_member_id = patch.assigneeMemberId;
  if (patch.assigneeLabel !== undefined) payload.assignee_label = patch.assigneeLabel;
  if (patch.dueOn !== undefined) payload.due_on = patch.dueOn;
  if (patch.submitDueOn !== undefined) payload.submit_due_on = patch.submitDueOn;
  if (patch.clientVisible !== undefined) payload.client_visible = patch.clientVisible;
  if (patch.ownerRole !== undefined) payload.owner_role = patch.ownerRole;
  if (patch.submissionType !== undefined) payload.submission_type = patch.submissionType;
  if (patch.needsInternalReview !== undefined) payload.needs_internal_review = patch.needsInternalReview;
  if (patch.needsClientReview !== undefined) payload.needs_client_review = patch.needsClientReview;
  if (patch.standardDays !== undefined) payload.standard_days = patch.standardDays;
  payload.updated_at = new Date().toISOString();
  const { error } = await client.from("team_works_project_tasks").update(payload).eq("id", taskId);
  if (error) throw error;
}

// 運営型の同等機能(addOperationsPartnerToProject)は、シフト承認前提の
// オファー/招待の仕組み(パートナーがポータルで承諾するまで保留)に深く
// 依存しているため納品型には転用しない。納品型はシフト調整という概念が
// 無いので、既にポータンにログイン済みの名簿の相手を直接メンバーに
// 追加するだけのシンプルな形にする。
async function addDirectoryMemberToDeliveryProject(
  client: SupabaseClient,
  input: { projectId: string; organizationId: string; directoryTable: "team_works_partners" | "team_works_clients"; directoryId: string; projectRole: "worker" | "client" }
): Promise<{ organizationMemberId: string; displayName: string } | null> {
  const { data: directoryRow, error: directoryError } = await client
    .from(input.directoryTable)
    .select("id,display_name,email,status")
    .eq("id", input.directoryId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (directoryError) throw directoryError;
  if (!directoryRow || directoryRow.status === "archived") return null;

  const normalizedEmail = (directoryRow.email as string).trim().toLowerCase();
  const targetRole = input.projectRole === "worker" ? "worker" : "client_user";
  const activeMemberResult = await client.rpc("team_works_find_active_member", {
    target_organization_id: input.organizationId,
    target_role: targetRole,
    target_email: normalizedEmail
  });
  if (activeMemberResult.error) throw activeMemberResult.error;
  const activeMemberRow = ((activeMemberResult.data ?? []) as { member_id: string }[])[0];
  if (!activeMemberRow) return null;

  const { error: memberError } = await client.from("team_works_project_members").upsert(
    {
      project_id: input.projectId,
      organization_id: input.organizationId,
      organization_member_id: activeMemberRow.member_id,
      project_role: input.projectRole
    },
    { onConflict: "project_id,organization_member_id" }
  );
  if (memberError) throw memberError;

  return { organizationMemberId: activeMemberRow.member_id, displayName: directoryRow.display_name as string };
}

export type DeliveryStepTemplateStep = { title: string; defaultRole: "worker" | "client" | "manager" | null };

export type DeliveryStepTemplate = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  steps: DeliveryStepTemplateStep[];
};

export async function fetchStepTemplates(client: SupabaseClient): Promise<DeliveryStepTemplate[]> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return [];
  const { data, error } = await client
    .from("team_works_project_step_templates")
    .select("id,organization_id,name,description,steps")
    .in("organization_id", organizationIds)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    steps: (row.steps as DeliveryStepTemplateStep[]) ?? []
  }));
}

export async function createStepTemplate(
  client: SupabaseClient,
  input: { organizationName: string; name: string; description: string; steps: DeliveryStepTemplateStep[] }
): Promise<string> {
  const { organizationId } = await ensureStaffOrganizationContext(client, input.organizationName);
  const { data, error } = await client
    .from("team_works_project_step_templates")
    .insert({ organization_id: organizationId, name: input.name.trim(), description: input.description.trim() || null, steps: input.steps })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateStepTemplate(
  client: SupabaseClient,
  templateId: string,
  patch: Partial<{ name: string; description: string; steps: DeliveryStepTemplateStep[] }>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.description !== undefined) payload.description = patch.description || null;
  if (patch.steps !== undefined) payload.steps = patch.steps;
  const { error } = await client.from("team_works_project_step_templates").update(payload).eq("id", templateId);
  if (error) throw error;
}

export async function archiveStepTemplate(client: SupabaseClient, templateId: string): Promise<void> {
  const { error } = await client
    .from("team_works_project_step_templates")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", templateId);
  if (error) throw error;
}

// ジェネレーターの確定ボタンから呼ぶ一括作成。プロジェクト→メンバー→
// 並び順つきタスクの順で作る。メンバー追加に失敗しても(ポータン未ログイン等)
// プロジェクト自体は作成済みのまま返す。呼び出し側でエラーを個別表示する。
export async function createDeliveryProjectWithSetup(
  client: SupabaseClient,
  input: {
    organizationName: string;
    title: string;
    members: { directoryTable: "team_works_partners" | "team_works_clients"; directoryId: string; projectRole: "worker" | "client" }[];
    steps: { title: string; clientVisible: boolean }[];
  }
): Promise<{ projectId: string; skippedMembers: string[] }> {
  const projectId = await createDeliveryProject(client, { organizationName: input.organizationName, title: input.title });
  const { organizationId } = await ensureStaffOrganizationContext(client, input.organizationName);

  const skippedMembers: string[] = [];
  for (const member of input.members) {
    const result = await addDirectoryMemberToDeliveryProject(client, { projectId, organizationId, ...member });
    if (!result) skippedMembers.push(member.directoryId);
  }

  await Promise.all(
    input.steps.map((step, index) =>
      createDeliveryTask(client, {
        projectId,
        title: step.title,
        assigneeMemberId: null,
        dueOn: null,
        clientVisible: step.clientVisible,
        position: index
      })
    )
  );

  return { projectId, skippedMembers };
}

export type DeliveryCalendarTask = DeliveryTask & { projectTitle: string };

// 期日が設定されている自分の可視範囲のタスクを横断取得する。
// RLSが本部staff/worker/clientの可視範囲を自動で絞るため、フィルタ条件は
// 「期日がある」「アーカイブされていない」だけでよい。
export async function loadDeliveryCalendarTasks(client: SupabaseClient): Promise<DeliveryCalendarTask[]> {
  const { data, error } = await client
    .from("team_works_project_tasks")
    .select(`${taskColumns},team_works_projects(title)`)
    .not("due_on", "is", null)
    .is("archived_at", null)
    .order("due_on", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...toTask(row),
    projectTitle: (row.team_works_projects as { title?: string } | null)?.title ?? "プロジェクト"
  }));
}
