import type { SupabaseClient } from "@supabase/supabase-js";

export type OperationsPartnerManual = {
  no: number;
  title: string;
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
};

export type OperationsPartnerSession = {
  id: string;
  projectId: string;
  projectTitle: string;
  sessionDate: string;
  startTime: string;
  durationMin: number;
  status: string;
  reportSubmitted: boolean;
  roster: OperationsPartnerRosterItem[];
};

export type OperationsPartnerPortalData = {
  memberName: string | null;
  projectCount: number;
  offers: { projectId: string; projectTitle: string; organizationMemberId: string; requestedAt: string }[];
  today: OperationsPartnerSession[];
  upcoming: OperationsPartnerSession[];
};

type MemberRow = { id: string; display_name: string };
type ProjectMemberRow = { project_id: string; organization_member_id: string };
type ProjectRow = { id: string; title: string; style: string; status: string };
type SessionRow = {
  id: string;
  project_id: string;
  session_date: string;
  start_time: string;
  duration_min: number;
  status: string;
};
type RosterRow = {
  id: string;
  session_id: string;
  participant_id: string;
  order_index: number;
  attendance_status: string;
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
    return { memberName: null, projectCount: 0, offers: [], today: [], upcoming: [] };
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
  const unavailableProjectIds = new Set(offerRows.filter((offer) => offer.status !== "accepted").map((offer) => offer.project_id));
  const projectIds = [...new Set(projectMembers.map((row) => row.project_id))];
  if (projectIds.length === 0) {
    return { memberName: members[0]?.display_name ?? null, projectCount: 0, offers: [], today: [], upcoming: [] };
  }

  const projectResult = await client
    .from("team_works_projects")
    .select("id,title,style,status")
    .in("id", projectIds)
    .eq("style", "operations")
    .eq("status", "active");
  if (projectResult.error) throw projectResult.error;
  const projects = (projectResult.data ?? []) as ProjectRow[];
  const projectTitleById = new Map(projects.map((project) => [project.id, project.title]));
  const operationsProjectIds = projects.map((project) => project.id).filter((projectId) => !unavailableProjectIds.has(projectId));
  const offers = waitingOffers.flatMap((offer) => {
    const projectTitle = projectTitleById.get(offer.project_id);
    return projectTitle ? [{ projectId: offer.project_id, projectTitle, organizationMemberId: offer.organization_member_id, requestedAt: offer.requested_at }] : [];
  });
  if (operationsProjectIds.length === 0) {
    return { memberName: members[0]?.display_name ?? null, projectCount: 0, offers, today: [], upcoming: [] };
  }

  const today = dateKey(new Date());
  const through = dateKey(addDays(new Date(), 30));
  const sessionResult = await client
    .from("team_works_op_sessions")
    .select("id,project_id,session_date,start_time,duration_min,status")
    .in("project_id", operationsProjectIds)
    .gte("session_date", today)
    .lte("session_date", through)
    .neq("status", "cancelled")
    .order("session_date")
    .order("start_time");
  if (sessionResult.error) throw sessionResult.error;
  const sessions = (sessionResult.data ?? []) as SessionRow[];
  if (sessions.length === 0) {
    return {
      memberName: members[0]?.display_name ?? null,
      projectCount: operationsProjectIds.length, offers,
      today: [],
      upcoming: []
    };
  }

  const sessionIds = sessions.map((session) => session.id);
  const rosterResult = await client
    .from("team_works_session_roster")
    .select("id,session_id,participant_id,order_index,attendance_status")
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

  const manualResult = await client
    .from("team_works_manuals")
    .select("project_id,no,title,material_type,material_url,questions,expressions,cautions")
    .in("project_id", operationsProjectIds)
    .eq("status", "active")
    .is("archived_at", null);
  if (manualResult.error) throw manualResult.error;
  const manuals = (manualResult.data ?? []) as ManualRow[];
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));

  const mapped = sessions.map<OperationsPartnerSession>((session) => ({
    id: session.id,
    projectId: session.project_id,
    projectTitle: projectTitleById.get(session.project_id) ?? "運営プロジェクト",
    sessionDate: session.session_date,
    startTime: session.start_time.slice(0, 5),
    durationMin: session.duration_min,
    status: session.status,
    reportSubmitted: reportedSessionIds.has(session.id),
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
          manual: manualRow
            ? {
                no: manualRow.no,
                title: manualRow.title,
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
