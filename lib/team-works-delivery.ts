import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStaffOrganizationIds } from "@/lib/team-works-operations";
import { ensureStaffOrganizationContext, isDatabaseProjectId } from "@/lib/team-works-operations-project";
import { isMissingSupabaseField } from "@/lib/supabase-schema-compat";
import {
  resolveDeliveryFeatureSettings,
  type TeamWorksDeliveryFeatureSettings
} from "@/lib/team-works-feature-settings";

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
  // 作業指示。工程名だけでは担当者が何をどう作るか分からないため持たせる。
  description: string | null;
  purpose: string | null;
  method: string | null;
  deliverableNote: string | null;
  checklist: string[];
  outputs: string[];
};

// 工程の作業指示だけをまとめた型。編集UIとテンプレートで共有する。
export type DeliveryTaskInstruction = {
  description: string | null;
  purpose: string | null;
  method: string | null;
  deliverableNote: string | null;
  checklist: string[];
  outputs: string[];
};

export const emptyDeliveryTaskInstruction: DeliveryTaskInstruction = {
  description: null,
  purpose: null,
  method: null,
  deliverableNote: null,
  checklist: [],
  outputs: []
};

export type DeliveryProjectMember = {
  organizationMemberId: string;
  projectRole: "owner" | "manager" | "client" | "worker";
  displayName: string;
};

// team_works_project_commentsは運営型・納品型で共用のテーブル(RLSコメントに
// 「shared by delivery + operations projects」と明記されている)。差し戻し理由の
// 記録にも既に使っているので、メッセージタブ(K-1)でも新テーブルなしでそのまま使う。
export type DeliveryProjectComment = {
  id: string;
  authorMemberId: string;
  recipientMemberId: string | null;
  audience: string;
  body: string;
  createdAt: string;
};

export type DeliveryProjectDetail = {
  project: DeliveryProjectSummary & { featureSettings: TeamWorksDeliveryFeatureSettings };
  tasks: DeliveryTask[];
  members: DeliveryProjectMember[];
  comments: DeliveryProjectComment[];
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
    standardDays: (row.standard_days as number) ?? null,
    description: (row.description as string) ?? null,
    purpose: (row.purpose as string) ?? null,
    method: (row.method as string) ?? null,
    deliverableNote: (row.deliverable_note as string) ?? null,
    checklist: (row.checklist as string[]) ?? [],
    outputs: (row.outputs as string[]) ?? []
  };
}

const taskColumns =
  "id,project_id,title,status,assignee_member_id,assignee_label,client_visible,due_on,submit_due_on,position,owner_role,submission_type,needs_internal_review,needs_client_review,source_local_id,standard_days,description,purpose,method,deliverable_note,checklist,outputs";

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
  let projectResult = await client
    .from("team_works_projects")
    .select("id,organization_id,title,status,client_visible,style,delivery_due_on,feature_settings")
    .eq("id", projectId)
    .maybeSingle();
  if (projectResult.error && isMissingSupabaseField(projectResult.error, ["feature_settings"])) {
    projectResult = await client
      .from("team_works_projects")
      .select("id,organization_id,title,status,client_visible,style,delivery_due_on")
      .eq("id", projectId)
      .maybeSingle() as typeof projectResult;
  }
  const { data: projectRow, error: projectError } = projectResult;
  if (projectError) throw projectError;
  if (!projectRow || projectRow.style !== "delivery") return null;

  const [taskResult, memberResult, commentResult] = await Promise.all([
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
      .eq("project_id", projectId),
    client
      .from("team_works_project_comments")
      .select("id,author_member_id,recipient_member_id,audience,body,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);
  if (taskResult.error) throw taskResult.error;
  if (memberResult.error) throw memberResult.error;
  if (commentResult.error) throw commentResult.error;

  return {
    project: {
      id: projectRow.id as string,
      organizationId: projectRow.organization_id as string,
      title: projectRow.title as string,
      status: projectRow.status as string,
      clientVisible: Boolean(projectRow.client_visible),
      dueOn: (projectRow.delivery_due_on as string) ?? null,
      featureSettings: resolveDeliveryFeatureSettings(
        (projectRow as { feature_settings?: Partial<TeamWorksDeliveryFeatureSettings> | null }).feature_settings ?? null
      )
    },
    tasks: (taskResult.data ?? []).map(toTask),
    members: (memberResult.data ?? []).map((row) => ({
      organizationMemberId: row.organization_member_id as string,
      projectRole: row.project_role as DeliveryProjectMember["projectRole"],
      displayName:
        (row.team_works_organization_members as { display_name?: string } | null)?.display_name ?? "メンバー"
    })),
    comments: (commentResult.data ?? []).map((row) => ({
      id: row.id as string,
      authorMemberId: row.author_member_id as string,
      recipientMemberId: (row.recipient_member_id as string) ?? null,
      audience: row.audience as string,
      body: row.body as string,
      createdAt: row.created_at as string
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
    instruction?: Partial<DeliveryTaskInstruction>;
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
    standard_days: input.standardDays ?? null,
    description: input.instruction?.description ?? null,
    purpose: input.instruction?.purpose ?? null,
    method: input.instruction?.method ?? null,
    deliverable_note: input.instruction?.deliverableNote ?? null,
    checklist: input.instruction?.checklist ?? [],
    outputs: input.instruction?.outputs ?? []
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

export async function updateDeliveryProjectSettings(
  client: SupabaseClient,
  projectId: string,
  patch: Partial<{ title: string; clientVisible: boolean }>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.clientVisible !== undefined) payload.client_visible = patch.clientVisible;
  const { error } = await client.from("team_works_projects").update(payload).eq("id", projectId);
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
    description: string | null;
    purpose: string | null;
    method: string | null;
    deliverableNote: string | null;
    checklist: string[];
    outputs: string[];
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
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.purpose !== undefined) payload.purpose = patch.purpose;
  if (patch.method !== undefined) payload.method = patch.method;
  if (patch.deliverableNote !== undefined) payload.deliverable_note = patch.deliverableNote;
  if (patch.checklist !== undefined) payload.checklist = patch.checklist;
  if (patch.outputs !== undefined) payload.outputs = patch.outputs;
  payload.updated_at = new Date().toISOString();
  const { error } = await client.from("team_works_project_tasks").update(payload).eq("id", taskId);
  if (error) throw error;
}

export type DeliveryMemberAddResult =
  | { status: "assigned"; organizationMemberId: string; displayName: string; email: string }
  | { status: "invited"; displayName: string; email: string; expiresAt: string }
  | { status: "not_found" };

// 運営型の同等機能(addOperationsPartnerToProject)は、シフト承認前提の
// オファー/招待の仕組み(パートナーがポータルで承諾するまで保留)に深く
// 依存しているため納品型には転用しない。納品型はシフト調整という概念が
// 無いので「招待 → 相手がログインしたら自動でメンバー」のシンプルな形にする。
// 相手がすでにポータルにログイン済みなら即座にメンバーへ、まだなら
// team_works_member_invitesへ招待を作る(既存トリガーteam_works_mark_invite_accepted
// が、相手のログイン時に自動でteam_works_project_membersへ追加してくれる。P8-c)。
async function addDirectoryMemberToDeliveryProject(
  client: SupabaseClient,
  input: { projectId: string; organizationId: string; directoryTable: "team_works_partners" | "team_works_clients"; directoryId: string; projectRole: "worker" | "client" }
): Promise<DeliveryMemberAddResult> {
  const { data: directoryRow, error: directoryError } = await client
    .from(input.directoryTable)
    .select("id,display_name,email,status")
    .eq("id", input.directoryId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (directoryError) throw directoryError;
  if (!directoryRow || directoryRow.status === "archived") return { status: "not_found" };

  const normalizedEmail = (directoryRow.email as string).trim().toLowerCase();
  const displayName = directoryRow.display_name as string;
  const targetRole = input.projectRole === "worker" ? "worker" : "client_user";

  const activeMemberResult = await client.rpc("team_works_find_active_member", {
    target_organization_id: input.organizationId,
    target_role: targetRole,
    target_email: normalizedEmail
  });
  if (activeMemberResult.error) throw activeMemberResult.error;
  const activeMemberRow = ((activeMemberResult.data ?? []) as { member_id: string }[])[0];

  if (activeMemberRow) {
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
    return { status: "assigned", organizationMemberId: activeMemberRow.member_id, displayName, email: normalizedEmail };
  }

  const pendingInviteResult = await client
    .from("team_works_member_invites")
    .select("expires_at")
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .eq("email", normalizedEmail)
    .eq("role", targetRole)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingInviteResult.error) throw pendingInviteResult.error;
  if (pendingInviteResult.data) {
    return { status: "invited", displayName, email: normalizedEmail, expiresAt: pendingInviteResult.data.expires_at as string };
  }

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("ログイン情報を確認できませんでした。");

  const { data: inviteRow, error: inviteError } = await client
    .from("team_works_member_invites")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      email: normalizedEmail,
      role: targetRole,
      created_by_user_id: userData.user.id
    })
    .select("expires_at")
    .single();
  if (inviteError) throw inviteError;

  return { status: "invited", displayName, email: normalizedEmail, expiresAt: inviteRow.expires_at as string };
}

// メンバータブから、プロジェクト作成後にも名簿の相手を追加できるようにする公開版。
export async function addDeliveryProjectMember(
  client: SupabaseClient,
  input: { projectId: string; directoryTable: "team_works_partners" | "team_works_clients"; directoryId: string; projectRole: "worker" | "client" }
): Promise<DeliveryMemberAddResult> {
  const { data: projectRow, error: projectError } = await client
    .from("team_works_projects")
    .select("id,organization_id,style")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  const project = projectRow as { id: string; organization_id: string; style: string } | null;
  if (!project || project.style !== "delivery") throw new Error("納品型プロジェクトが見つかりませんでした。");
  return addDirectoryMemberToDeliveryProject(client, {
    projectId: project.id,
    organizationId: project.organization_id,
    directoryTable: input.directoryTable,
    directoryId: input.directoryId,
    projectRole: input.projectRole
  });
}

// 招待中(まだログインしていない相手)の一覧。承諾すると自動でmemberに
// なるため(トリガー)、statusが'pending'のものだけを対象にする。
export type DeliveryPendingInvite = {
  id: string;
  email: string;
  role: "worker" | "client_user";
  expiresAt: string;
};

export async function fetchDeliveryProjectPendingInvites(client: SupabaseClient, projectId: string): Promise<DeliveryPendingInvite[]> {
  const { data, error } = await client
    .from("team_works_member_invites")
    .select("id,email,role,expires_at")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    role: row.role as "worker" | "client_user",
    expiresAt: row.expires_at as string
  }));
}

export async function revokeDeliveryProjectInvite(client: SupabaseClient, inviteId: string): Promise<void> {
  const { error } = await client
    .from("team_works_member_invites")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw error;
}

// 注意: team_works_project_membersにはDELETE/アーカイブ用のRLSポリシーが
// 無く(P8-a時点で未整備)、この計画では新規ポリシーを追加しない方針のため、
// 「参加中メンバーをプロジェクトから外す」機能はここでは実装していない。
// 必要になったら別途RLSポリシーの追加を検討すること。

export type DeliveryStepTemplateStep = {
  title: string;
  defaultRole: "worker" | "client" | "manager" | null;
  // Phase 6以降の項目。旧テンプレート(この項目が無いもの)とも互換を保つため、
  // すべて省略可能にしている。
  submissionType?: DeliveryTaskSubmissionType;
  needsInternalReview?: boolean;
  needsClientReview?: boolean;
  standardDays?: number | null;
  // 名簿未登録の担当者名(例:「教材制作担当」「カメラマン(未定)」)。
  assigneeLabel?: string | null;
  // 作業指示。テンプレートに書いておくと案件作成時にそのまま入る。
  instruction?: Partial<DeliveryTaskInstruction>;
};

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
//
// 工程の担当は2通り: 名簿の相手を指定する(assigneeDirectoryId)か、
// 名簿にまだいない相手を名前だけで置く(assigneeLabel)。前者は
// メンバー追加の結果として得られるorganization_member_idへ解決する。
export async function createDeliveryProjectWithSetup(
  client: SupabaseClient,
  input: {
    organizationName: string;
    title: string;
    members: { directoryTable: "team_works_partners" | "team_works_clients"; directoryId: string; projectRole: "worker" | "client" }[];
    steps: {
      title: string;
      clientVisible: boolean;
      ownerRole?: DeliveryTaskOwnerRole | null;
      submissionType?: DeliveryTaskSubmissionType;
      needsInternalReview?: boolean;
      needsClientReview?: boolean;
      standardDays?: number | null;
      assigneeDirectoryId?: string | null;
      assigneeLabel?: string | null;
      instruction?: Partial<DeliveryTaskInstruction>;
    }[];
  }
): Promise<{ projectId: string; skippedMembers: string[]; invitedMembers: string[] }> {
  const projectId = await createDeliveryProject(client, { organizationName: input.organizationName, title: input.title });
  const { organizationId } = await ensureStaffOrganizationContext(client, input.organizationName);

  const skippedMembers: string[] = [];
  const invitedMembers: string[] = [];
  const memberIdByDirectoryId = new Map<string, string>();
  for (const member of input.members) {
    const result = await addDirectoryMemberToDeliveryProject(client, { projectId, organizationId, ...member });
    if (result.status === "assigned") memberIdByDirectoryId.set(member.directoryId, result.organizationMemberId);
    else if (result.status === "invited") invitedMembers.push(member.directoryId);
    else skippedMembers.push(member.directoryId);
  }

  await Promise.all(
    input.steps.map((step, index) => {
      const assigneeMemberId = step.assigneeDirectoryId ? memberIdByDirectoryId.get(step.assigneeDirectoryId) ?? null : null;
      return createDeliveryTask(client, {
        projectId,
        title: step.title,
        // 名簿の相手を解決できた場合のみ実メンバーに割り当て、それ以外は
        // 名前だけの仮担当として残す(後からプロジェクト詳細で差し替え可)。
        assigneeMemberId,
        assigneeLabel: assigneeMemberId ? null : step.assigneeLabel ?? null,
        dueOn: null,
        clientVisible: step.clientVisible,
        position: index,
        ownerRole: step.ownerRole ?? null,
        submissionType: step.submissionType ?? "none",
        needsInternalReview: step.needsInternalReview ?? false,
        needsClientReview: step.needsClientReview ?? false,
        standardDays: step.standardDays ?? null,
        instruction: step.instruction
      });
    })
  );

  return { projectId, skippedMembers, invitedMembers };
}

// 「資料」タブ(J-5・あゆみ要望 2026-07-30「成果物前のファイル・URLをスタッフも
// 閲覧できるようにしたい」)。運営型の team_works_manuals テーブルをそのまま流用する。
// project_idは運営型に限定されておらず(team_works_projects全体を指すFK)、
// SELECT方針も「本部staff or このプロジェクトのworker」で、style列を見ていない
// ため、納品型プロジェクトでも新規テーブル・migrationなしでそのまま使える
// (調査結果。詳細はdocs/MIKKEOS_TEAM_WORKS_GENERALIZE_PLAN_2026-07-30.md §J-5)。
//
// 制限: 既存RLSにクライアント向けSELECTポリシーが無いため、クライアントには
// 出せない(本部・参加メンバーのみ)。ファイルアップロードは今回はURL入力のみ
// (Drive/Notion等の共有リンクを想定)。両方とも将来ちゃんと対応するなら
// Phase Lのmigrationにあわせて列・ポリシーを足すこと。
export type DeliveryMaterial = {
  id: string;
  no: number;
  title: string;
  materialUrl: string | null;
};

export async function fetchDeliveryMaterials(client: SupabaseClient, projectId: string): Promise<DeliveryMaterial[]> {
  const { data, error } = await client
    .from("team_works_manuals")
    .select("id,no,title,material_url")
    .eq("project_id", projectId)
    .eq("status", "active")
    .order("no");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    no: row.no as number,
    title: row.title as string,
    materialUrl: (row.material_url as string) ?? null
  }));
}

export async function createDeliveryMaterial(
  client: SupabaseClient,
  projectId: string,
  input: { title: string; materialUrl: string }
): Promise<void> {
  const title = input.title.trim();
  const materialUrl = input.materialUrl.trim();
  if (!title) throw new Error("資料のタイトルを入力してください。");
  const { data: lastRow, error: lastError } = await client
    .from("team_works_manuals")
    .select("no")
    .eq("project_id", projectId)
    .order("no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;
  const nextNo = ((lastRow?.no as number | undefined) ?? 0) + 1;
  const { error } = await client.from("team_works_manuals").insert({
    project_id: projectId,
    no: nextNo,
    title,
    material_type: materialUrl ? "link" : "none",
    material_url: materialUrl || null
  });
  if (error) throw error;
}

export async function archiveDeliveryMaterial(client: SupabaseClient, materialId: string): Promise<void> {
  const { data, error } = await client
    .from("team_works_manuals")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", materialId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("資料を削除できませんでした。権限と対象を確認してください。");
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
