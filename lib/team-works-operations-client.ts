import type { SupabaseClient } from "@supabase/supabase-js";
import { isJapanDayOffKey } from "@/lib/japanese-calendar";
import { isMissingSupabaseField } from "@/lib/supabase-schema-compat";
import {
  resolveOperationsFeatureSettings,
  type TeamWorksOperationsFeatureSettings
} from "@/lib/team-works-feature-settings";

export type OperationsClientParticipant = {
  id: string;
  projectId: string;
  groupId: string | null;
  name: string;
  level: string | null;
};

export type OperationsClientGroup = {
  id: string;
  projectId: string;
  name: string;
};

export type OperationsClientSession = {
  id: string;
  projectId: string;
  projectTitle: string;
  sessionDate: string;
  startTime: string;
  durationMin: number;
  status: string;
  partnerName: string | null;
  zoomUrl: string | null;
  zoomMeetingId: string | null;
  zoomPasscode: string | null;
  workDescription: string | null;
  roster: {
    id: string;
    participantId: string;
    orderIndex: number;
    participantName: string;
  }[];
};

export type OperationsClientMessageContact = {
  memberId: string;
  projectId: string;
  projectTitle: string;
  name: string;
  role: "staff" | "worker";
};

export type OperationsClientMessage = {
  id: string;
  projectId: string;
  authorMemberId: string;
  recipientMemberId: string | null;
  body: string;
  createdAt: string;
};

export type OperationsClientHoliday = {
  id: string;
  projectId: string | null;
  organizationId: string;
  date: string;
  memo: string | null;
};

export type OperationsClientPortalData = {
  memberName: string | null;
  projectCount: number;
  projects: {
    id: string;
    title: string;
    description: string | null;
    clientMemberId: string;
    organizationId: string;
    organizationName: string;
    featureSettings: TeamWorksOperationsFeatureSettings;
  }[];
  groups: OperationsClientGroup[];
  participants: OperationsClientParticipant[];
  sessions: OperationsClientSession[];
  holidays: OperationsClientHoliday[];
  contacts: OperationsClientMessageContact[];
  messages: OperationsClientMessage[];
};

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function loadOperationsClientPortal(client: SupabaseClient): Promise<OperationsClientPortalData> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("クライアントポータルの表示にはログインが必要です。");

  // Fixed-URL onboarding: if this account's email is in the client directory,
  // ensure a client_user membership exists before loading. Idempotent RPC.
  // Best effort: a failure here must not take down the whole portal (this
  // once broke both portals entirely — see 20260726180000's hotfix note).
  try {
    const { error: activateError } = await client.rpc("team_works_activate_portal_membership");
    if (activateError) throw activateError;
  } catch (activateError) {
    console.error("team_works_activate_portal_membership failed", activateError);
  }

  const memberResult = await client
    .from("team_works_organization_members")
    .select("id,display_name")
    .eq("user_id", userData.user.id)
    .eq("role", "client_user")
    .eq("status", "active");
  if (memberResult.error) throw memberResult.error;
  const members = (memberResult.data ?? []) as { id: string; display_name: string }[];
  const memberIds = members.map((member) => member.id);
  if (memberIds.length === 0) return emptyClientPortalData(null);

  const membershipResult = await client
    .from("team_works_project_members")
    .select("project_id,organization_member_id")
    .eq("project_role", "client")
    .in("organization_member_id", memberIds);
  if (membershipResult.error) throw membershipResult.error;
  const clientMemberships = (membershipResult.data ?? []) as { project_id: string; organization_member_id: string }[];
  return buildClientPortalData(client, members, clientMemberships);
}

// K-2運営型プレビュー: 本部staffが「機能とポータルの設定」タブから
// 「クライアントにはこう見える」を確認するための読み込み。通常のloadOperationsClientPortal
// はauth.getUser()で「今ログインしている本人」を解決するが、プレビューでは
// staffが対象のorganization_member_idを直接指定する。RLSはstaffに対して
// プロジェクトの全データ読み取りを許可しているため、自己解決とactivate RPCの
// 呼び出しをスキップしてもデータは取得できる(計画書§K-2実装状況の設計どおり)。
// sampleDisplayName(M-2): クライアントがまだ1人もいないプロジェクトでも
// 「今見える状態」を確認したい、というあゆみ要望への対応。呼び出し側が
// 実在しないIDを渡してこの引数を指定した場合のみ、架空メンバーとして
// 組み立てを続行する(見つかった実メンバーがあればそちらを優先)。
export async function loadOperationsClientPortalPreview(
  client: SupabaseClient,
  projectId: string,
  targetOrganizationMemberId: string,
  sampleDisplayName?: string
): Promise<OperationsClientPortalData> {
  const memberResult = await client
    .from("team_works_organization_members")
    .select("id,display_name")
    .eq("id", targetOrganizationMemberId)
    .maybeSingle();
  if (memberResult.error) throw memberResult.error;
  if (!memberResult.data && !sampleDisplayName) return emptyClientPortalData(null);
  const members = [
    (memberResult.data as { id: string; display_name: string } | null) ?? {
      id: targetOrganizationMemberId,
      display_name: sampleDisplayName as string
    }
  ];
  const clientMemberships = [{ project_id: projectId, organization_member_id: targetOrganizationMemberId }];
  return buildClientPortalData(client, members, clientMemberships);
}

// O-3(2026-08-01)「〜として表示」: 本部staffが、対象のクライアント担当者に
// 実際どう見えているかを本物のポータル画面のまま確認するための読み込み。
// loadOperationsClientPortalPreviewがprojectId固定なのに対し、こちらは対象者が
// 実際に持っている全プロジェクトを解決するので、本人がログインしたときと同じ姿になる。
// RLSは変更していない(staffは元々組織の全データを読める)。書き込みは
// TeamWorksViewAsContextで画面側が止める。
export async function loadOperationsClientPortalAs(
  client: SupabaseClient,
  organizationMemberId: string
): Promise<OperationsClientPortalData> {
  const memberResult = await client
    .from("team_works_organization_members")
    .select("id,display_name")
    .eq("id", organizationMemberId)
    .maybeSingle();
  if (memberResult.error) throw memberResult.error;
  if (!memberResult.data) return emptyClientPortalData(null);
  const members = [memberResult.data as { id: string; display_name: string }];

  const membershipResult = await client
    .from("team_works_project_members")
    .select("project_id,organization_member_id")
    .eq("project_role", "client")
    .eq("organization_member_id", organizationMemberId);
  if (membershipResult.error) throw membershipResult.error;
  const clientMemberships = (membershipResult.data ?? []) as { project_id: string; organization_member_id: string }[];
  return buildClientPortalData(client, members, clientMemberships);
}

async function buildClientPortalData(
  client: SupabaseClient,
  members: { id: string; display_name: string }[],
  clientMemberships: { project_id: string; organization_member_id: string }[]
): Promise<OperationsClientPortalData> {
  const projectIds = [...new Set(clientMemberships.map((row) => row.project_id))];
  if (projectIds.length === 0) return emptyClientPortalData(members[0]?.display_name ?? null);

  let projectResult = await client
    .from("team_works_projects")
    .select("id,title,description,organization_id,client_partner_contact_visible,feature_settings")
    .in("id", projectIds)
    .eq("style", "operations")
    .eq("status", "active");
  if (projectResult.error && isMissingSupabaseField(projectResult.error, ["feature_settings"])) {
    projectResult = await client
      .from("team_works_projects")
      .select("id,title,description,organization_id,client_partner_contact_visible")
      .in("id", projectIds)
      .eq("style", "operations")
      .eq("status", "active") as typeof projectResult;
  }
  if (projectResult.error) throw projectResult.error;
  const projectRows = (projectResult.data ?? []) as {
    id: string;
    title: string;
    description: string | null;
    organization_id: string;
    client_partner_contact_visible: boolean;
    feature_settings?: Partial<TeamWorksOperationsFeatureSettings> | null;
  }[];
  const operationsProjectIds = projectRows.map((project) => project.id);
  if (operationsProjectIds.length === 0) return emptyClientPortalData(members[0]?.display_name ?? null);

  const organizationIds = [...new Set(projectRows.map((project) => project.organization_id))];
  const organizationResult = await client.from("team_works_organizations").select("id,name").in("id", organizationIds);
  if (organizationResult.error) throw organizationResult.error;
  const organizationNameById = new Map(((organizationResult.data ?? []) as { id: string; name: string }[]).map((org) => [org.id, org.name]));

  const clientMemberIdByProject = new Map(clientMemberships.map((row) => [row.project_id, row.organization_member_id]));
  const projects = projectRows.flatMap((project) => {
    const clientMemberId = clientMemberIdByProject.get(project.id);
    return clientMemberId
      ? [{
          id: project.id,
          title: project.title,
          description: project.description,
          clientMemberId,
          organizationId: project.organization_id,
          organizationName: organizationNameById.get(project.organization_id) ?? "組織",
          featureSettings: resolveOperationsFeatureSettings(project.feature_settings ?? null)
        }]
      : [];
  });
  const today = dateKey(new Date());
  const through = dateKey(addDays(new Date(), 60));
  let [sessionResult, groupResult, participantResult, projectMemberResult, messageResult, holidayResult] = await Promise.all([
    client.from("team_works_op_sessions").select("id,project_id,session_date,start_time,duration_min,status,partner_member_id,zoom_url,zoom_meeting_id,zoom_passcode,work_description").in("project_id", operationsProjectIds).gte("session_date", today).lte("session_date", through).order("session_date").order("start_time"),
    client.from("team_works_groups").select("id,project_id,name").in("project_id", operationsProjectIds).neq("status", "archived").is("archived_at", null).order("name"),
    client.from("team_works_participants").select("id,project_id,group_id,name,level").in("project_id", operationsProjectIds).neq("status", "archived").is("archived_at", null).order("name"),
    client.from("team_works_project_members").select("project_id,organization_member_id,project_role").in("project_id", operationsProjectIds),
    client.from("team_works_project_comments").select("id,project_id,author_member_id,recipient_member_id,body,created_at").in("project_id", operationsProjectIds).eq("audience", "client").order("created_at", { ascending: false }).limit(100),
    client.from("team_works_holidays").select("id,project_id,organization_id,holiday_date,memo").in("organization_id", organizationIds).or(`project_id.in.(${operationsProjectIds.join(",")}),project_id.is.null`)
  ]);
  if (sessionResult.error && isMissingSupabaseField(sessionResult.error, ["zoom_url", "zoom_meeting_id", "zoom_passcode", "work_description"])) {
    sessionResult = await client
      .from("team_works_op_sessions")
      .select("id,project_id,session_date,start_time,duration_min,status,partner_member_id")
      .in("project_id", operationsProjectIds)
      .gte("session_date", today)
      .lte("session_date", through)
      .order("session_date")
      .order("start_time") as typeof sessionResult;
  }
  for (const result of [sessionResult, groupResult, participantResult, projectMemberResult, messageResult, holidayResult]) {
    if (result.error) throw result.error;
  }

  const sessions = (sessionResult.data ?? []) as { id: string; project_id: string; session_date: string; start_time: string; duration_min: number; status: string; partner_member_id: string | null; zoom_url: string | null; zoom_meeting_id: string | null; zoom_passcode: string | null; work_description?: string | null }[];
  const groups = (groupResult.data ?? []) as { id: string; project_id: string; name: string }[];
  const participants = (participantResult.data ?? []) as { id: string; project_id: string; group_id: string | null; name: string; level: string | null }[];
  const projectMembers = (projectMemberResult.data ?? []) as { project_id: string; organization_member_id: string; project_role: string }[];
  const otherMemberIds = [...new Set(projectMembers.map((row) => row.organization_member_id))];
  const namesResult = otherMemberIds.length
    ? await client.from("team_works_organization_members").select("id,display_name,status").in("id", otherMemberIds)
    : { data: [], error: null };
  if (namesResult.error) throw namesResult.error;
  const memberRowsById = new Map(((namesResult.data ?? []) as { id: string; display_name: string; status: string }[]).map((row) => [row.id, row]));
  const nameByMemberId = new Map([...memberRowsById.entries()].map(([id, row]) => [id, row.display_name]));
  const sessionIds = sessions.map((session) => session.id);
  const rosterResult = sessionIds.length
    ? await client.from("team_works_session_roster").select("id,session_id,participant_id,order_index").in("session_id", sessionIds).order("order_index")
    : { data: [], error: null };
  if (rosterResult.error) throw rosterResult.error;
  const rosterRows = (rosterResult.data ?? []) as { id: string; session_id: string; participant_id: string; order_index: number }[];
  const projectTitleById = new Map(projectRows.map((project) => [project.id, project.title]));
  const partnerContactVisibleByProject = new Map(projectRows.map((project) => [project.id, project.client_partner_contact_visible]));
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const contacts = projectMembers.flatMap((member) => {
    if (member.project_role === "client") return [];
    // Archiving a partner/staff org_member row doesn't delete their old
    // team_works_project_members link (see archiveOperationsPartner) — without
    // this check, archived duplicates keep showing up as selectable contacts.
    if (memberRowsById.get(member.organization_member_id)?.status !== "active") return [];
    const role: OperationsClientMessageContact["role"] = member.project_role === "worker" ? "worker" : "staff";
    // Portal setting (client_partner_contact_visible): some organizations want
    // clients talking only to staff, not partners directly.
    if (role === "worker" && partnerContactVisibleByProject.get(member.project_id) === false) return [];
    return [{
      memberId: member.organization_member_id,
      projectId: member.project_id,
      projectTitle: projectTitleById.get(member.project_id) ?? "プロジェクト",
      name: nameByMemberId.get(member.organization_member_id) ?? (role === "worker" ? "担当パートナー" : "本部窓口"),
      role
    }];
  });

  return {
    memberName: members[0]?.display_name ?? null,
    projectCount: projects.length,
    projects,
    groups: groups.map((group) => ({ id: group.id, projectId: group.project_id, name: group.name })),
    participants: participants.map((participant) => ({ id: participant.id, projectId: participant.project_id, groupId: participant.group_id, name: participant.name, level: participant.level })),
    sessions: sessions.map((session) => ({
      id: session.id,
      projectId: session.project_id,
      projectTitle: projectTitleById.get(session.project_id) ?? "プロジェクト",
      sessionDate: session.session_date,
      startTime: session.start_time.slice(0, 5),
      durationMin: session.duration_min,
      status: isJapanDayOffKey(session.session_date) ? "cancelled" : session.status,
      partnerName: session.partner_member_id ? nameByMemberId.get(session.partner_member_id) ?? "担当未定" : "担当未定",
      zoomUrl: session.zoom_url ?? null,
      zoomMeetingId: session.zoom_meeting_id ?? null,
      zoomPasscode: session.zoom_passcode ?? null,
      workDescription: session.work_description ?? null,
      roster: rosterRows.filter((row) => row.session_id === session.id).flatMap((row) => {
        const participant = participantById.get(row.participant_id);
        return participant ? [{ id: row.id, participantId: row.participant_id, orderIndex: row.order_index, participantName: participant.name }] : [];
      })
    })),
    holidays: ((holidayResult.data ?? []) as { id: string; project_id: string | null; organization_id: string; holiday_date: string; memo: string | null }[]).map((holiday) => ({
      id: holiday.id,
      projectId: holiday.project_id,
      organizationId: holiday.organization_id,
      date: holiday.holiday_date,
      memo: holiday.memo
    })),
    contacts,
    messages: ((messageResult.data ?? []) as { id: string; project_id: string; author_member_id: string; recipient_member_id: string | null; body: string; created_at: string }[]).map((message) => ({
      id: message.id,
      projectId: message.project_id,
      authorMemberId: message.author_member_id,
      recipientMemberId: message.recipient_member_id,
      body: message.body,
      createdAt: message.created_at
    }))
  };
}

function emptyClientPortalData(memberName: string | null): OperationsClientPortalData {
  return { memberName, projectCount: 0, projects: [], groups: [], participants: [], sessions: [], holidays: [], contacts: [], messages: [] };
}

export type OperationsClientPendingProject = {
  projectId: string;
  title: string;
  description: string | null;
  contractStartedOn: string | null;
  contractEndedOn: string | null;
  organizationName: string;
};

export async function loadOperationsClientPendingProjects(
  client: SupabaseClient
): Promise<OperationsClientPendingProject[]> {
  const { data, error } = await client.rpc("team_works_list_client_pending_projects");
  if (error) throw error;
  return ((data ?? []) as {
    project_id: string;
    title: string;
    description: string | null;
    contract_started_on: string | null;
    contract_ended_on: string | null;
    organization_name: string;
  }[]).map((row) => ({
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    contractStartedOn: row.contract_started_on,
    contractEndedOn: row.contract_ended_on,
    organizationName: row.organization_name
  }));
}

export async function approveOperationsClientProject(client: SupabaseClient, projectId: string) {
  const { error } = await client.rpc("team_works_approve_client_project", { target_project_id: projectId });
  if (error) throw error;
}

async function requireClientProjectMembership(client: SupabaseClient, projectId: string): Promise<string> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("ログインが必要です。");
  const memberResult = await client.from("team_works_organization_members").select("id").eq("user_id", userData.user.id).eq("role", "client_user").eq("status", "active");
  if (memberResult.error) throw memberResult.error;
  const memberIds = (memberResult.data ?? []).map((row) => row.id as string);
  const projectMemberResult = await client.from("team_works_project_members").select("organization_member_id").eq("project_id", projectId).eq("project_role", "client").in("organization_member_id", memberIds).maybeSingle();
  if (projectMemberResult.error) throw projectMemberResult.error;
  if (!projectMemberResult.data) throw new Error("このプロジェクトを編集する権限がありません。");
  return projectMemberResult.data.organization_member_id as string;
}

export async function saveOperationsClientParticipant(client: SupabaseClient, input: { projectId: string; participantId?: string; groupId: string | null; name: string; level: string }) {
  await requireClientProjectMembership(client, input.projectId);
  const name = input.name.trim();
  if (!name) throw new Error("対象者名を入力してください。");
  if (input.participantId) {
    const { error } = await client.from("team_works_participants").update({ name, level: input.level.trim() || null, group_id: input.groupId || null }).eq("id", input.participantId).eq("project_id", input.projectId);
    if (error) throw error;
    return;
  }
  const { error } = await client.from("team_works_participants").insert({ project_id: input.projectId, name, level: input.level.trim() || null, group_id: input.groupId || null, status: "active" });
  if (error) throw error;
}

export async function saveOperationsClientGroup(
  client: SupabaseClient,
  input: { projectId: string; groupId?: string; name: string }
) {
  await requireClientProjectMembership(client, input.projectId);
  const name = input.name.trim();
  if (!name) throw new Error("グループ名を入力してください。");
  if (input.groupId) {
    const { error } = await client
      .from("team_works_groups")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", input.groupId)
      .eq("project_id", input.projectId);
    if (error) throw error;
    return;
  }
  const { error } = await client
    .from("team_works_groups")
    .insert({ project_id: input.projectId, name, status: "active" });
  if (error) throw error;
}

export async function saveOperationsClientSessionRoster(client: SupabaseClient, input: { projectId: string; sessionId: string; participantIds: string[] }) {
  await requireClientProjectMembership(client, input.projectId);
  const uniqueParticipantIds = [...new Set(input.participantIds)];
  const { error: deleteError } = await client.from("team_works_session_roster").delete().eq("session_id", input.sessionId).eq("project_id", input.projectId);
  if (deleteError) throw deleteError;
  if (!uniqueParticipantIds.length) return;
  const { error: insertError } = await client.from("team_works_session_roster").insert(uniqueParticipantIds.map((participantId, index) => ({ session_id: input.sessionId, project_id: input.projectId, participant_id: participantId, order_index: index + 1, attendance_status: "scheduled" })));
  if (insertError) throw insertError;
}

export async function sendOperationsClientMessage(client: SupabaseClient, input: { projectId: string; recipientMemberId: string; body: string }) {
  const authorMemberId = await requireClientProjectMembership(client, input.projectId);
  const body = input.body.trim();
  if (!body) throw new Error("メッセージを入力してください。");
  const { error } = await client.from("team_works_project_comments").insert({ project_id: input.projectId, author_member_id: authorMemberId, recipient_member_id: input.recipientMemberId, audience: "client", body });
  if (error) throw error;
}
