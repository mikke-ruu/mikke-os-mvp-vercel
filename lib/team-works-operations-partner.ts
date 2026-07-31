import type { SupabaseClient } from "@supabase/supabase-js";
import { isJapanDayOffKey } from "@/lib/japanese-calendar";
import { isMissingSupabaseField } from "@/lib/supabase-schema-compat";
import {
  resolveOperationsFeatureSettings,
  type TeamWorksOperationsFeatureSettings
} from "@/lib/team-works-feature-settings";

export type OperationsPartnerManual = {
  no: number;
  title: string;
  body: string | null;
  materialType: "none" | "link" | "file";
  materialUrl: string | null;
  questions: string[];
  expressions: string[];
  cautions: string | null;
};

export type OperationsPartnerRosterItem = {
  id: string;
  orderIndex: number;
  attendanceStatus: string;
  participantId: string;
  participantName: string;
  level: string | null;
  cautions: string | null;
  currentManualNo: number;
  manual: OperationsPartnerManual | null;
  assessment: OperationsPartnerAssessment;
  handoffNote: string;
  completedAt: string | null;
};

export type OperationsPartnerAssessment = {
  responseSmoothness: number;
  comprehension: number;
  speakingConfidence: number;
};

export type OperationsPartnerSession = {
  id: string;
  projectId: string;
  projectTitle: string;
  sessionDate: string;
  startTime: string;
  durationMin: number;
  status: string;
  zoomUrl: string | null;
  zoomMeetingId: string | null;
  zoomPasscode: string | null;
  zoomUsesProjectDefault: boolean;
  workDescription: string | null;
  partnerPresenceStatus: "not_started" | "standby" | "in_progress" | "ended";
  partnerStandbyAt: string | null;
  partnerEndedAt: string | null;
  reportSubmitted: boolean;
  manuals: OperationsPartnerManual[];
  roster: OperationsPartnerRosterItem[];
};

export type OperationsPartnerPortalData = {
  memberName: string | null;
  projectCount: number;
  projects: {
    id: string;
    title: string;
    description: string | null;
    manuals: OperationsPartnerManual[];
    featureSettings: TeamWorksOperationsFeatureSettings;
  }[];
  offers: { projectId: string; projectTitle: string; organizationMemberId: string; requestedAt: string }[];
  today: OperationsPartnerSession[];
  upcoming: OperationsPartnerSession[];
};

type MemberRow = { id: string; display_name: string };
type ProjectMemberRow = { project_id: string; organization_member_id: string };
type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  style: string;
  status: string;
  feature_settings?: Partial<TeamWorksOperationsFeatureSettings> | null;
};
type SessionRow = {
  id: string;
  project_id: string;
  session_date: string;
  start_time: string;
  duration_min: number;
  status: string;
  zoom_url: string | null;
  zoom_meeting_id: string | null;
  zoom_passcode: string | null;
  zoom_uses_project_default: boolean;
  partner_presence_status: "not_started" | "standby" | "in_progress" | "ended";
  partner_standby_at: string | null;
  partner_ended_at: string | null;
  work_description?: string | null;
};
type RosterRow = {
  id: string;
  session_id: string;
  participant_id: string;
  order_index: number;
  attendance_status: string;
  partner_assessment: unknown;
  handoff_note: string | null;
  partner_completed_at: string | null;
};
type ParticipantRow = {
  id: string;
  project_id: string;
  name: string;
  level: string | null;
  cautions: string | null;
  current_manual_no: number;
};
type ManualRow = {
  project_id: string;
  no: number;
  title: string;
  body: string | null;
  material_type: "none" | "link" | "file";
  material_url: string | null;
  questions: unknown;
  expressions: unknown;
  cautions: string | null;
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function assessment(value: unknown): OperationsPartnerAssessment {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rating = (key: string) => {
    const numeric = Number(source[key]);
    return Number.isFinite(numeric) && numeric >= 1 && numeric <= 5 ? numeric : 3;
  };
  return {
    responseSmoothness: rating("responseSmoothness"),
    comprehension: rating("comprehension"),
    speakingConfidence: rating("speakingConfidence")
  };
}

export async function loadOperationsPartnerPortal(
  client: SupabaseClient
): Promise<OperationsPartnerPortalData> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("パートナーポータルの表示にはログインが必要です。");

  // Fixed-URL onboarding: if this account's email is in the partner directory,
  // ensure a worker membership exists before loading. Idempotent RPC. Best
  // effort: a failure here must not take down the whole portal (this once
  // broke both portals entirely — see 20260726180000's hotfix note).
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
    .eq("role", "worker")
    .eq("status", "active");
  if (memberResult.error) throw memberResult.error;
  const members = (memberResult.data ?? []) as MemberRow[];
  const memberIds = members.map((member) => member.id);
  if (memberIds.length === 0) {
    return { memberName: null, projectCount: 0, projects: [], offers: [], today: [], upcoming: [] };
  }

  const projectMemberResult = await client
    .from("team_works_project_members")
    .select("project_id,organization_member_id")
    .eq("project_role", "worker")
    .in("organization_member_id", memberIds);
  if (projectMemberResult.error) throw projectMemberResult.error;
  const projectMembers = (projectMemberResult.data ?? []) as ProjectMemberRow[];
  const offerResult = await client
    .from("team_works_project_partner_offers")
    .select("project_id,organization_member_id,status,requested_at")
    .in("organization_member_id", memberIds);
  if (offerResult.error) throw offerResult.error;
  const offerRows = (offerResult.data ?? []) as { project_id: string; organization_member_id: string; status: string; requested_at: string }[];
  const waitingOffers = offerRows.filter((offer) => offer.status === "pending");
  const offerRowsByMembership = new Map<string, typeof offerRows>();
  for (const offer of offerRows) {
    const key = `${offer.project_id}:${offer.organization_member_id}`;
    offerRowsByMembership.set(key, [...(offerRowsByMembership.get(key) ?? []), offer]);
  }
  const acceptedProjectMembers = projectMembers.filter((membership) => {
    const pairOffers = offerRowsByMembership.get(`${membership.project_id}:${membership.organization_member_id}`) ?? [];
    return pairOffers.length === 0 || pairOffers.some((offer) => offer.status === "accepted");
  });
  return buildPartnerPortalData(client, members, projectMembers, waitingOffers, acceptedProjectMembers);
}

// K-2運営型プレビュー: 本部staffが「機能とポータルの設定」タブから
// 「担当パートナーにはこう見える」を確認するための読み込み。通常のloadOperationsPartnerPortal
// と違い「今ログインしている本人」の自己解決・オファー状態は考慮せず、
// staffが指定したtargetOrganizationMemberIdをそのプロジェクトの確定済みメンバー
// として扱う(RLSはstaffに対してプロジェクトの全データ読み取りを許可しているため、
// クエリ自体はそのまま成立する。計画書§K-2実装状況の設計どおり)。
// sampleDisplayName(M-2): 担当パートナーがまだ1人もいないプロジェクトでも
// 「今見える状態」を確認したい、というあゆみ要望への対応。実在しないIDを渡して
// この引数を指定した場合のみ架空メンバーとして続行する(担当コマがpartner_member_id
// に紐づく都合上、サンプル時は予定0件の枠のみになる。実メンバーがいればそちらを優先)。
export async function loadOperationsPartnerPortalPreview(
  client: SupabaseClient,
  projectId: string,
  targetOrganizationMemberId: string,
  sampleDisplayName?: string
): Promise<OperationsPartnerPortalData> {
  const memberResult = await client
    .from("team_works_organization_members")
    .select("id,display_name")
    .eq("id", targetOrganizationMemberId)
    .maybeSingle();
  if (memberResult.error) throw memberResult.error;
  if (!memberResult.data && !sampleDisplayName) {
    return { memberName: null, projectCount: 0, projects: [], offers: [], today: [], upcoming: [] };
  }
  const members = [
    (memberResult.data as MemberRow | null) ?? { id: targetOrganizationMemberId, display_name: sampleDisplayName as string }
  ];
  const projectMembers: ProjectMemberRow[] = [{ project_id: projectId, organization_member_id: targetOrganizationMemberId }];
  return buildPartnerPortalData(client, members, projectMembers, [], projectMembers);
}

// O-3(2026-08-01)「〜として表示」: 本部staffが、対象スタッフに実際どう見えているかを
// 本物のポータル画面のまま確認するための読み込み。Preview版がprojectId固定なのに対し、
// こちらは対象者が実際に担当している全プロジェクトを解決する(本人がログインしたときと同じ姿)。
// オファーの絞り込みもloadOperationsPartnerPortalと同じ扱いにする。
// RLSは変更していない(staffは元々組織の全データを読める)。
export async function loadOperationsPartnerPortalAs(
  client: SupabaseClient,
  organizationMemberId: string
): Promise<OperationsPartnerPortalData> {
  const memberResult = await client
    .from("team_works_organization_members")
    .select("id,display_name")
    .eq("id", organizationMemberId)
    .maybeSingle();
  if (memberResult.error) throw memberResult.error;
  if (!memberResult.data) {
    return { memberName: null, projectCount: 0, projects: [], offers: [], today: [], upcoming: [] };
  }
  const members = [memberResult.data as MemberRow];

  const projectMemberResult = await client
    .from("team_works_project_members")
    .select("project_id,organization_member_id")
    .eq("project_role", "worker")
    .eq("organization_member_id", organizationMemberId);
  if (projectMemberResult.error) throw projectMemberResult.error;
  const projectMembers = (projectMemberResult.data ?? []) as ProjectMemberRow[];

  const offerResult = await client
    .from("team_works_project_partner_offers")
    .select("project_id,organization_member_id,status,requested_at")
    .eq("organization_member_id", organizationMemberId);
  if (offerResult.error) throw offerResult.error;
  const offerRows = (offerResult.data ?? []) as { project_id: string; organization_member_id: string; status: string; requested_at: string }[];
  const waitingOffers = offerRows.filter((offer) => offer.status === "pending");
  const offerRowsByMembership = new Map<string, typeof offerRows>();
  for (const offer of offerRows) {
    const key = `${offer.project_id}:${offer.organization_member_id}`;
    offerRowsByMembership.set(key, [...(offerRowsByMembership.get(key) ?? []), offer]);
  }
  const acceptedProjectMembers = projectMembers.filter((membership) => {
    const pairOffers = offerRowsByMembership.get(`${membership.project_id}:${membership.organization_member_id}`) ?? [];
    return pairOffers.length === 0 || pairOffers.some((offer) => offer.status === "accepted");
  });
  return buildPartnerPortalData(client, members, projectMembers, waitingOffers, acceptedProjectMembers);
}

async function buildPartnerPortalData(
  client: SupabaseClient,
  members: MemberRow[],
  projectMembers: ProjectMemberRow[],
  waitingOffers: { project_id: string; organization_member_id: string; status: string; requested_at: string }[],
  acceptedProjectMembers: ProjectMemberRow[]
): Promise<OperationsPartnerPortalData> {
  const memberIds = members.map((member) => member.id);
  const projectIds = [...new Set(projectMembers.map((row) => row.project_id))];
  if (projectIds.length === 0) {
    return { memberName: members[0]?.display_name ?? null, projectCount: 0, projects: [], offers: [], today: [], upcoming: [] };
  }

  let projectResult = await client
    .from("team_works_projects")
    .select("id,title,description,style,status,feature_settings")
    .in("id", projectIds)
    .eq("style", "operations")
    .eq("status", "active");
  if (projectResult.error && isMissingSupabaseField(projectResult.error, ["feature_settings"])) {
    projectResult = await client
      .from("team_works_projects")
      .select("id,title,description,style,status")
      .in("id", projectIds)
      .eq("style", "operations")
      .eq("status", "active") as typeof projectResult;
  }
  if (projectResult.error) throw projectResult.error;
  const projects = (projectResult.data ?? []) as ProjectRow[];
  const projectTitleById = new Map(projects.map((project) => [project.id, project.title]));
  const acceptedProjectIds = new Set(acceptedProjectMembers.map((membership) => membership.project_id));
  const portalProjects = projects
    .filter((project) => acceptedProjectIds.has(project.id))
    .map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      manuals: [] as OperationsPartnerManual[],
      featureSettings: resolveOperationsFeatureSettings(project.feature_settings ?? null)
    }));
  const operationsProjectIds = portalProjects.map((project) => project.id);
  const offers = waitingOffers.flatMap((offer) => {
    const projectTitle = projectTitleById.get(offer.project_id);
    return projectTitle ? [{ projectId: offer.project_id, projectTitle, organizationMemberId: offer.organization_member_id, requestedAt: offer.requested_at }] : [];
  });
  if (operationsProjectIds.length === 0) {
    return { memberName: members[0]?.display_name ?? null, projectCount: 0, projects: [], offers, today: [], upcoming: [] };
  }

  let manualResult = await client
    .from("team_works_manuals")
    .select("project_id,no,title,body,material_type,material_url,questions,expressions,cautions")
    .in("project_id", operationsProjectIds)
    .eq("status", "active")
    .is("archived_at", null)
    .order("no");
  if (manualResult.error && isMissingSupabaseField(manualResult.error, ["body"])) {
    manualResult = await client
      .from("team_works_manuals")
      .select("project_id,no,title,material_type,material_url,questions,expressions,cautions")
      .in("project_id", operationsProjectIds)
      .eq("status", "active")
      .is("archived_at", null)
      .order("no") as typeof manualResult;
  }
  if (manualResult.error) throw manualResult.error;
  const manuals = (manualResult.data ?? []) as ManualRow[];
  const mapManual = (manual: ManualRow): OperationsPartnerManual => ({
    no: manual.no,
    title: manual.title,
    body: manual.body ?? null,
    materialType: manual.material_type,
    materialUrl: manual.material_url,
    questions: stringArray(manual.questions),
    expressions: stringArray(manual.expressions),
    cautions: manual.cautions
  });
  const projectsWithManuals = portalProjects.map((project) => ({
    ...project,
    // manuals=falseのプロジェクトはスタッフのマニュアル閲覧も非表示にする(§L-2)。
    manuals: project.featureSettings.manuals ? manuals.filter((manual) => manual.project_id === project.id).map(mapManual) : []
  }));

  // N-1(2026-07-31): 予定(スケジュール)は本部が組む以上、担当者には常に見える
  // べきもの。以前はlessons=falseのプロジェクトをここで丸ごと除外していたが、
  // それは「レッスン画面(作業窓)の中身」の話であって「予定が見えるか」とは
  // 別の軸だったため撤回した(あゆみ指摘)。作業窓の部品出し分けはworkWindow設定
  // (TeamWorksPartnerLessonConsole側)で行う。
  const today = dateKey(new Date());
  const through = dateKey(addDays(new Date(), 30));
  let sessionResult = await client
    .from("team_works_op_sessions")
    .select("id,project_id,session_date,start_time,duration_min,status,zoom_url,zoom_meeting_id,zoom_passcode,zoom_uses_project_default,partner_presence_status,partner_standby_at,partner_ended_at,work_description")
    .in("project_id", operationsProjectIds)
    .in("partner_member_id", memberIds)
    .gte("session_date", today)
    .lte("session_date", through)
    .neq("status", "cancelled")
    .order("session_date")
    .order("start_time");
  if (sessionResult.error && isMissingSupabaseField(sessionResult.error, ["zoom_url", "zoom_meeting_id", "zoom_passcode", "zoom_uses_project_default", "work_description"])) {
    sessionResult = await client
      .from("team_works_op_sessions")
      .select("id,project_id,session_date,start_time,duration_min,status")
      .in("project_id", operationsProjectIds)
      .in("partner_member_id", memberIds)
      .gte("session_date", today)
      .lte("session_date", through)
      .neq("status", "cancelled")
      .order("session_date")
      .order("start_time") as typeof sessionResult;
  }
  if (sessionResult.error) throw sessionResult.error;
  const sessions = ((sessionResult.data ?? []) as SessionRow[]).filter(
    (session) => !isJapanDayOffKey(session.session_date)
  );
  if (sessions.length === 0) {
    return {
      memberName: members[0]?.display_name ?? null,
      projectCount: operationsProjectIds.length,
      projects: projectsWithManuals,
      offers,
      today: [],
      upcoming: []
    };
  }

  const sessionIds = sessions.map((session) => session.id);
  const rosterResult = await client
    .from("team_works_session_roster")
    .select("id,session_id,participant_id,order_index,attendance_status,partner_assessment,handoff_note,partner_completed_at")
    .in("session_id", sessionIds)
    .order("order_index");
  if (rosterResult.error) throw rosterResult.error;
  const rosterRows = (rosterResult.data ?? []) as RosterRow[];
  const reportResult = await client
    .from("team_works_ops_session_reports")
    .select("session_id")
    .in("session_id", sessionIds);
  if (reportResult.error) throw reportResult.error;
  const reportedSessionIds = new Set(
    ((reportResult.data ?? []) as { session_id: string }[]).map((row) => row.session_id)
  );
  const participantIds = [...new Set(rosterRows.map((row) => row.participant_id))];

  let participants: ParticipantRow[] = [];
  if (participantIds.length > 0) {
    const participantResult = await client
      .from("team_works_participants")
      .select("id,project_id,name,level,cautions,current_manual_no")
      .in("id", participantIds);
    if (participantResult.error) throw participantResult.error;
    participants = (participantResult.data ?? []) as ParticipantRow[];
  }

  const participantById = new Map(participants.map((participant) => [participant.id, participant]));

  const mapped = sessions.map<OperationsPartnerSession>((session) => ({
    id: session.id,
    projectId: session.project_id,
    projectTitle: projectTitleById.get(session.project_id) ?? "運営プロジェクト",
    sessionDate: session.session_date,
    startTime: session.start_time.slice(0, 5),
    durationMin: session.duration_min,
    status: session.status,
    zoomUrl: session.zoom_url ?? null,
    zoomMeetingId: session.zoom_meeting_id ?? null,
    zoomPasscode: session.zoom_passcode ?? null,
    zoomUsesProjectDefault: session.zoom_uses_project_default ?? true,
    workDescription: session.work_description ?? null,
    partnerPresenceStatus: session.partner_presence_status ?? "not_started",
    partnerStandbyAt: session.partner_standby_at ?? null,
    partnerEndedAt: session.partner_ended_at ?? null,
    reportSubmitted: reportedSessionIds.has(session.id),
    manuals: projectsWithManuals.find((project) => project.id === session.project_id)?.manuals ?? [],
    roster: rosterRows
      .filter((row) => row.session_id === session.id)
      .sort((left, right) => left.order_index - right.order_index)
      .flatMap((row) => {
        const participant = participantById.get(row.participant_id);
        if (!participant) return [];
        const manualRow = manuals.find(
          (manual) =>
            manual.project_id === participant.project_id && manual.no === participant.current_manual_no
        );
        return [{
          id: row.id,
          orderIndex: row.order_index,
          attendanceStatus: row.attendance_status,
          participantId: participant.id,
          participantName: participant.name,
          level: participant.level,
          cautions: participant.cautions,
          currentManualNo: participant.current_manual_no,
          assessment: assessment(row.partner_assessment),
          handoffNote: row.handoff_note ?? "",
          completedAt: row.partner_completed_at ?? null,
          manual: manualRow
            ? {
            no: manualRow.no,
            title: manualRow.title,
            body: manualRow.body ?? null,
                materialType: manualRow.material_type,
                materialUrl: manualRow.material_url,
                questions: stringArray(manualRow.questions),
                expressions: stringArray(manualRow.expressions),
                cautions: manualRow.cautions
              }
            : null
        }];
      })
  }));

  return {
    memberName: members[0]?.display_name ?? null,
    projectCount: operationsProjectIds.length,
    projects: projectsWithManuals,
    offers,
    today: mapped.filter((session) => session.sessionDate === today),
    upcoming: mapped.filter((session) => session.sessionDate !== today)
  };
}

export async function respondToOperationsPartnerOffer(
  client: SupabaseClient,
  input: { projectId: string; organizationMemberId: string; accept: boolean }
) {
  const { data, error } = await client
    .from("team_works_project_partner_offers")
    .update({ status: input.accept ? "accepted" : "declined", responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("project_id", input.projectId)
    .eq("organization_member_id", input.organizationMemberId)
    .eq("status", "pending")
    .select("project_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("参加依頼を更新できませんでした。");

  // Keep the directory assignment in sync with the accepted/declined offer.
  // Portal visibility itself is based on the exact project membership +
  // offer pair above, but this status is what headquarters sees.
  const { data: userData } = await client.auth.getUser();
  const normalizedEmail = userData.user?.email?.trim().toLowerCase();
  if (!normalizedEmail) return;
  const memberResult = await client
    .from("team_works_organization_members")
    .select("organization_id")
    .eq("id", input.organizationMemberId)
    .maybeSingle();
  if (memberResult.error) throw memberResult.error;
  if (!memberResult.data) return;
  const partnerResult = await client
    .from("team_works_partners")
    .select("id")
    .eq("organization_id", memberResult.data.organization_id)
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (partnerResult.error) throw partnerResult.error;
  if (!partnerResult.data) return;
  const { error: linkError } = await client
    .from("team_works_project_partners")
    .update({
      status: input.accept ? "active" : "archived",
      updated_at: new Date().toISOString()
    })
    .eq("project_id", input.projectId)
    .eq("partner_id", partnerResult.data.id);
  if (linkError) throw linkError;
}

export async function submitOperationsPartnerReport(
  client: SupabaseClient,
  input: {
    projectId: string;
    sessionId: string;
    attendance: { rosterId: string; participantId: string; status: string }[];
    progress: { participantId: string; manualNo: number }[];
    body: string;
  }
) {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("報告の提出にはログインが必要です。");

  const memberResult = await client
    .from("team_works_organization_members")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("role", "worker")
    .eq("status", "active");
  if (memberResult.error) throw memberResult.error;
  const memberIds = (memberResult.data ?? []).map((row) => row.id as string);
  if (memberIds.length === 0) throw new Error("パートナー権限が見つかりません。");

  const projectMemberResult = await client
    .from("team_works_project_members")
    .select("organization_member_id")
    .eq("project_id", input.projectId)
    .eq("project_role", "worker")
    .in("organization_member_id", memberIds)
    .maybeSingle();
  if (projectMemberResult.error) throw projectMemberResult.error;
  if (!projectMemberResult.data) throw new Error("このコマを報告する権限がありません。");

  const { error } = await client.from("team_works_ops_session_reports").insert({
    project_id: input.projectId,
    session_id: input.sessionId,
    submitted_by_member_id: projectMemberResult.data.organization_member_id,
    attendance: input.attendance,
    progress: input.progress.map((item) => ({
      participantId: item.participantId,
      manualNo: Math.max(1, Math.round(item.manualNo))
    })),
    body: input.body.trim()
  });
  if (error) {
    if (error.code === "23505") throw new Error("このコマの報告はすでに提出済みです。");
    throw error;
  }
}

export async function updateOperationsPartnerSessionZoom(
  client: SupabaseClient,
  sessionId: string,
  input: {
    useProjectDefault: boolean;
    zoomUrl: string;
    zoomMeetingId: string;
    zoomPasscode: string;
  }
) {
  const { error } = await client.rpc("team_works_update_session_zoom", {
    p_session_id: sessionId,
    p_use_project_default: input.useProjectDefault,
    p_zoom_url: input.zoomUrl,
    p_zoom_meeting_id: input.zoomMeetingId,
    p_zoom_passcode: input.zoomPasscode
  });
  if (error) throw error;
}

export async function updateOperationsPartnerPresence(
  client: SupabaseClient,
  sessionId: string,
  status: "not_started" | "standby" | "in_progress" | "ended"
) {
  const { error } = await client.rpc("team_works_update_partner_presence", {
    p_session_id: sessionId,
    p_status: status
  });
  if (error) throw error;
}

export async function saveOperationsPartnerStudentHandoff(
  client: SupabaseClient,
  input: {
    rosterId: string;
    attendanceStatus: string;
    assessment: OperationsPartnerAssessment;
    handoffNote: string;
    complete: boolean;
  }
): Promise<{ currentManualNo: number; completedAt: string | null }> {
  const { data, error } = await client.rpc("team_works_save_partner_student_handoff", {
    p_roster_id: input.rosterId,
    p_attendance_status: input.attendanceStatus,
    p_assessment: input.assessment,
    p_handoff_note: input.handoffNote,
    p_complete: input.complete
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    currentManualNo: Number(row?.current_manual_no ?? 1),
    completedAt: typeof row?.completed_at === "string" ? row.completed_at : null
  };
}
