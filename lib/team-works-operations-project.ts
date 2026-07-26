import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStaffOrganizationIds } from "@/lib/team-works-operations";

export type OperationsProject = {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  contractStartedOn: string | null;
  contractEndedOn: string | null;
  clientVisible: boolean;
  payoutsEnabled: boolean;
  invoicesEnabled: boolean;
  clientPartnerContactVisible: boolean;
};

export type OperationsGroup = {
  id: string;
  name: string;
  status: string;
};

export type OperationsParticipant = {
  id: string;
  groupId: string | null;
  name: string;
  level: string | null;
  cautions: string | null;
  memo: string | null;
  currentManualNo: number;
  status: string;
};

export type OperationsManual = {
  id: string;
  no: number;
  title: string;
  materialType: "none" | "link" | "file";
  materialUrl: string | null;
  questions: unknown[];
  expressions: unknown[];
  cautions: string | null;
  status: string;
  sourceTemplateManualId: string | null;
};

export type OperationsPartner = {
  memberId: string;
  displayName: string;
  projectRole: string;
};

export type OperationsScheduleRule = {
  id: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  status: string;
  partnerMemberId: string | null;
  partnerName: string | null;
};

export type OperationsProjectSession = {
  id: string;
  sessionDate: string;
  startTime: string;
  durationMin: number;
  status: string;
  partnerMemberId: string | null;
  partnerName: string | null;
  roster: {
    id: string;
    participantId: string;
    participantName: string;
    orderIndex: number;
    attendanceStatus: string;
  }[];
};

export type OperationsProjectHoliday = {
  id: string;
  holidayDate: string;
  memo: string | null;
};

export type OperationsProjectComment = {
  id: string;
  authorMemberId: string;
  recipientMemberId: string | null;
  authorName: string;
  audience: string;
  body: string;
  createdAt: string;
};

export type OperationsProjectReport = {
  id: string;
  formName: string;
  submitterName: string;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
};

export type OperationsProjectPayout = {
  id: string;
  payeeMemberId: string;
  payeeName: string;
  amount: number;
  status: string;
  dueOn: string | null;
  note: string | null;
};

export type OperationsProjectInvoice = {
  id: string;
  billedName: string;
  amount: number;
  status: string;
  dueOn: string | null;
  note: string | null;
};

export type OperationsProjectDetailData = {
  project: OperationsProject;
  groups: OperationsGroup[];
  participants: OperationsParticipant[];
  manuals: OperationsManual[];
  partners: OperationsPartner[];
  rules: OperationsScheduleRule[];
  sessions: OperationsProjectSession[];
  holidays: OperationsProjectHoliday[];
  comments: OperationsProjectComment[];
  reports: OperationsProjectReport[];
  payouts: OperationsProjectPayout[];
  invoices: OperationsProjectInvoice[];
};

export type OperationsPartnerDirectoryEntry = {
  id: string;
  organizationId: string;
  displayName: string;
  email: string;
  note: string | null;
  status: string;
};

type ProjectRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: string;
  style: string;
  contract_started_on: string | null;
  contract_ended_on: string | null;
  client_visible: boolean;
  payouts_enabled: boolean;
  invoices_enabled: boolean;
  client_partner_contact_visible: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDatabaseProjectId(projectId: string): boolean {
  return uuidPattern.test(projectId);
}

function asUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function loadOperationsProjectDetail(
  client: SupabaseClient,
  projectId: string
): Promise<OperationsProjectDetailData | null> {
  if (!isDatabaseProjectId(projectId)) return null;

  const projectResult = await client
    .from("team_works_projects")
    .select(
      "id,organization_id,title,description,status,style,contract_started_on,contract_ended_on,client_visible,payouts_enabled,invoices_enabled,client_partner_contact_visible"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (projectResult.error) throw projectResult.error;
  const projectRow = projectResult.data as ProjectRow | null;
  if (!projectRow || projectRow.style !== "operations") return null;
  const staffOrganizationIds = await resolveStaffOrganizationIds(client);
  if (!staffOrganizationIds.includes(projectRow.organization_id)) {
    throw new Error("この運営型プロジェクトの本部画面を開く権限がありません。");
  }

  const [
    groupResult,
    participantResult,
    manualResult,
    projectMemberResult,
    ruleResult,
    sessionResult,
    holidayResult,
    commentResult,
    formResult,
    submissionResult,
    payoutResult,
    invoiceResult
  ] = await Promise.all([
    client
      .from("team_works_groups")
      .select("id,name,status")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("name"),
    client
      .from("team_works_participants")
      .select("id,group_id,name,level,cautions,memo,current_manual_no,status")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("name"),
    client
      .from("team_works_manuals")
      .select("id,no,title,material_type,material_url,questions,expressions,cautions,status,source_template_manual_id")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("no"),
    client
      .from("team_works_project_members")
      .select("organization_member_id,project_role")
      .eq("project_id", projectId),
    client
      .from("team_works_schedule_rules")
      .select("id,weekday,start_time,duration_min,status,partner_member_id")
      .eq("project_id", projectId)
      .neq("status", "archived")
      .order("weekday")
      .order("start_time"),
    client
      .from("team_works_op_sessions")
      .select("id,session_date,start_time,duration_min,status,partner_member_id")
      .eq("project_id", projectId)
      .gte("session_date", dateKey(addDays(new Date(), -14)))
      .lte("session_date", dateKey(addDays(new Date(), 90)))
      .order("session_date")
      .order("start_time"),
    client
      .from("team_works_holidays")
      .select("id,holiday_date,memo")
      .eq("project_id", projectId)
      .gte("holiday_date", dateKey(addDays(new Date(), -14)))
      .lte("holiday_date", dateKey(addDays(new Date(), 90)))
      .order("holiday_date"),
    client
      .from("team_works_project_comments")
      .select("id,author_member_id,recipient_member_id,audience,body,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(30),
    client
      .from("team_works_project_forms")
      .select("id,name")
      .eq("project_id", projectId)
      .is("archived_at", null),
    client
      .from("team_works_form_submissions")
      .select("id,form_id,submitted_by_member_id,status,submitted_at,updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(30),
    client
      .from("team_works_project_payouts")
      .select("id,payee_member_id,amount,status,due_on,note")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    client
      .from("team_works_project_invoices")
      .select("id,billed_member_id,amount,status,due_on,note")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
  ]);

  for (const result of [
    groupResult,
    participantResult,
    manualResult,
    projectMemberResult,
    ruleResult,
    sessionResult,
    holidayResult,
    commentResult,
    formResult,
    submissionResult,
    payoutResult,
    invoiceResult
  ]) {
    if (result.error) throw result.error;
  }

  const projectMemberRows = (projectMemberResult.data ?? []) as {
    organization_member_id: string;
    project_role: string;
  }[];
  const memberIds = projectMemberRows.map((row) => row.organization_member_id);
  const memberNameById = new Map<string, string>();
  // Archived members keep their historical name resolution (past sessions,
  // comments, payouts should still show who was involved) but must not be
  // offered as an assignable "担当" — assignOperationsMemberIds below is the
  // filtered set for that.
  const activeMemberIds = new Set<string>();
  if (memberIds.length > 0) {
    const memberResult = await client
      .from("team_works_organization_members")
      .select("id,display_name,status")
      .in("id", memberIds);
    if (memberResult.error) throw memberResult.error;
    for (const row of (memberResult.data ?? []) as { id: string; display_name: string; status: string }[]) {
      memberNameById.set(row.id, row.display_name);
      if (row.status !== "archived") activeMemberIds.add(row.id);
    }
  }

  const sessionRows = (sessionResult.data ?? []) as {
    id: string;
    session_date: string;
    start_time: string;
    duration_min: number;
    status: string;
    partner_member_id: string | null;
  }[];
  const sessionIds = sessionRows.map((row) => row.id);
  const rosterRows: {
    id: string;
    session_id: string;
    participant_id: string;
    order_index: number;
    attendance_status: string;
  }[] = [];
  if (sessionIds.length > 0) {
    const rosterResult = await client
      .from("team_works_session_roster")
      .select("id,session_id,participant_id,order_index,attendance_status")
      .in("session_id", sessionIds)
      .order("order_index");
    if (rosterResult.error) throw rosterResult.error;
    rosterRows.push(...((rosterResult.data ?? []) as typeof rosterRows));
  }

  const participants = ((participantResult.data ?? []) as {
    id: string;
    group_id: string | null;
    name: string;
    level: string | null;
    cautions: string | null;
    memo: string | null;
    current_manual_no: number;
    status: string;
  }[]).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    level: row.level,
    cautions: row.cautions,
    memo: row.memo,
    currentManualNo: row.current_manual_no,
    status: row.status
  }));
  const participantNameById = new Map(participants.map((participant) => [participant.id, participant.name]));
  const formNameById = new Map(
    ((formResult.data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name])
  );

  return {
    project: {
      id: projectRow.id,
      organizationId: projectRow.organization_id,
      title: projectRow.title,
      description: projectRow.description,
      status: projectRow.status,
      contractStartedOn: projectRow.contract_started_on,
      contractEndedOn: projectRow.contract_ended_on,
      clientVisible: projectRow.client_visible,
      payoutsEnabled: projectRow.payouts_enabled,
      invoicesEnabled: projectRow.invoices_enabled,
      clientPartnerContactVisible: projectRow.client_partner_contact_visible
    },
    groups: ((groupResult.data ?? []) as { id: string; name: string; status: string }[]).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status
    })),
    participants,
    manuals: ((manualResult.data ?? []) as {
      id: string;
      no: number;
      title: string;
      material_type: "none" | "link" | "file";
      material_url: string | null;
      questions: unknown;
      expressions: unknown;
      cautions: string | null;
      status: string;
      source_template_manual_id: string | null;
    }[]).map((row) => ({
      id: row.id,
      no: row.no,
      title: row.title,
      materialType: row.material_type,
      materialUrl: row.material_url,
      questions: asUnknownArray(row.questions),
      expressions: asUnknownArray(row.expressions),
      cautions: row.cautions,
      status: row.status,
      sourceTemplateManualId: row.source_template_manual_id
    })),
    partners: projectMemberRows
      .filter((row) => row.project_role === "worker" && activeMemberIds.has(row.organization_member_id))
      .map((row) => ({
        memberId: row.organization_member_id,
        displayName: memberNameById.get(row.organization_member_id) ?? "パートナー",
        projectRole: row.project_role
      })),
    rules: ((ruleResult.data ?? []) as {
      id: string;
      weekday: number;
      start_time: string;
      duration_min: number;
      status: string;
      partner_member_id: string | null;
    }[]).map((row) => ({
      id: row.id,
      weekday: row.weekday,
      startTime: row.start_time.slice(0, 5),
      durationMin: row.duration_min,
      status: row.status,
      partnerMemberId: row.partner_member_id,
      partnerName: row.partner_member_id ? memberNameById.get(row.partner_member_id) ?? "パートナー" : null
    })),
    sessions: sessionRows.map((row) => ({
      id: row.id,
      sessionDate: row.session_date,
      startTime: row.start_time.slice(0, 5),
      durationMin: row.duration_min,
      status: row.status,
      partnerMemberId: row.partner_member_id,
      partnerName: row.partner_member_id ? memberNameById.get(row.partner_member_id) ?? "パートナー" : null,
      roster: rosterRows
        .filter((roster) => roster.session_id === row.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((roster) => ({
          id: roster.id,
          participantId: roster.participant_id,
          participantName: participantNameById.get(roster.participant_id) ?? "対象者",
          orderIndex: roster.order_index,
          attendanceStatus: roster.attendance_status
        }))
    })),
    holidays: ((holidayResult.data ?? []) as {
      id: string;
      holiday_date: string;
      memo: string | null;
    }[]).map((row) => ({
      id: row.id,
      holidayDate: row.holiday_date,
      memo: row.memo
    })),
    comments: ((commentResult.data ?? []) as {
      id: string;
      author_member_id: string;
      recipient_member_id: string | null;
      audience: string;
      body: string;
      created_at: string;
    }[]).map((row) => ({
      id: row.id,
      authorMemberId: row.author_member_id,
      recipientMemberId: row.recipient_member_id,
      authorName: memberNameById.get(row.author_member_id) ?? "メンバー",
      audience: row.audience,
      body: row.body,
      createdAt: row.created_at
    })),
    reports: ((submissionResult.data ?? []) as {
      id: string;
      form_id: string;
      submitted_by_member_id: string;
      status: string;
      submitted_at: string | null;
      updated_at: string;
    }[]).map((row) => ({
      id: row.id,
      formName: formNameById.get(row.form_id) ?? "報告",
      submitterName: memberNameById.get(row.submitted_by_member_id) ?? "メンバー",
      status: row.status,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at
    })),
    payouts: ((payoutResult.data ?? []) as {
      id: string;
      payee_member_id: string;
      amount: number | string;
      status: string;
      due_on: string | null;
      note: string | null;
    }[]).map((row) => ({
      id: row.id,
      payeeMemberId: row.payee_member_id,
      payeeName: memberNameById.get(row.payee_member_id) ?? "パートナー",
      amount: Number(row.amount),
      status: row.status,
      dueOn: row.due_on,
      note: row.note
    })),
    invoices: ((invoiceResult.data ?? []) as {
      id: string;
      billed_member_id: string;
      amount: number | string;
      status: string;
      due_on: string | null;
      note: string | null;
    }[]).map((row) => ({
      id: row.id,
      billedName: memberNameById.get(row.billed_member_id) ?? "クライアント",
      amount: Number(row.amount),
      status: row.status,
      dueOn: row.due_on,
      note: row.note
    }))
  };
}

export async function createOperationsProject(
  client: SupabaseClient,
  input: {
    organizationName: string;
    title: string;
    contractStartedOn: string;
    contractEndedOn: string;
  }
): Promise<string> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) throw new Error("運営型プロジェクトの作成にはログインが必要です。");

  const staffOrganizationIds = await resolveStaffOrganizationIds(client);
  let organizationId = staffOrganizationIds[0] ?? null;
  let organizationMemberId: string | null = null;
  let projectRole: "owner" | "manager" = "owner";

  if (organizationId) {
    // A user may now hold several active member rows (one per role), so this
    // must not assume a single row. Prefer the staff role (owner > manager)
    // as the creator's project role.
    const { data: currentMembers, error: memberLookupError } = await client
      .from("team_works_organization_members")
      .select("id,role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active");
    if (memberLookupError) throw memberLookupError;
    const rows = (currentMembers ?? []) as { id: string; role: string }[];
    const staffMember = rows.find((row) => row.role === "owner") ?? rows.find((row) => row.role === "manager") ?? rows[0];
    if (staffMember) {
      organizationMemberId = staffMember.id;
      projectRole = staffMember.role === "manager" ? "manager" : "owner";
    }
  }

  if (!organizationId || !organizationMemberId) {
    const ownerDisplayName = user.email?.split("@")[0] || "オーナー";
    const organizationName = input.organizationName.trim() || "マイチーム Team Works";
    const { data: organization, error: organizationError } = await client
      .from("team_works_organizations")
      .upsert(
        {
          owner_user_id: user.id,
          source_local_id: "mikke-team-works-primary",
          name: organizationName,
          status: "active",
          archived_at: null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "owner_user_id,source_local_id" }
      )
      .select("id")
      .single();
    if (organizationError) throw organizationError;
    organizationId = organization.id as string;

    const { data: ownerMember, error: ownerMemberError } = await client
      .from("team_works_organization_members")
      .upsert(
        {
          organization_id: organizationId,
          user_id: user.id,
          source_local_id: `owner:${user.id}`,
          display_name: ownerDisplayName,
          role: "owner",
          status: "active",
          archived_at: null,
          updated_at: new Date().toISOString()
        },
        // Arbiter must be a full (non-partial) unique constraint. Since roles
        // can now repeat per (org,user), key the owner row by its stable
        // source_local_id ("owner:<uid>"), which has a full unique constraint.
        { onConflict: "organization_id,source_local_id" }
      )
      .select("id")
      .single();
    if (ownerMemberError) throw ownerMemberError;
    organizationMemberId = ownerMember.id as string;
    projectRole = "owner";
  }

  const { data: project, error: projectError } = await client
    .from("team_works_projects")
    .insert({
      organization_id: organizationId,
      title: input.title.trim(),
      style: "operations",
      status: "active",
      contract_started_on: input.contractStartedOn || null,
      contract_ended_on: input.contractEndedOn || null,
      client_visible: false,
      payouts_enabled: false,
      invoices_enabled: false,
      client_partner_contact_visible: true
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
    await client
      .from("team_works_projects")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", projectId);
    throw projectMemberError;
  }

  return projectId;
}

async function resolveFirstStaffOrganizationId(client: SupabaseClient): Promise<string> {
  const staffOrganizationIds = await resolveStaffOrganizationIds(client);
  const organizationId = staffOrganizationIds[0];
  if (!organizationId) throw new Error("Team Worksの本部権限が見つかりません。");
  return organizationId;
}

export async function loadOperationsPartnerDirectory(client: SupabaseClient): Promise<OperationsPartnerDirectoryEntry[]> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return [];

  const { data, error } = await client
    .from("team_works_partners")
    .select("id,organization_id,display_name,email,note,status")
    .in("organization_id", organizationIds)
    .neq("status", "archived")
    .order("display_name");
  if (error) throw error;

  return ((data ?? []) as {
    id: string;
    organization_id: string;
    display_name: string;
    email: string;
    note: string | null;
    status: string;
  }[]).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    displayName: row.display_name,
    email: row.email,
    note: row.note,
    status: row.status
  }));
}

export async function createOperationsPartner(
  client: SupabaseClient,
  input: { displayName: string; email: string; note: string }
): Promise<string> {
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  if (!displayName) throw new Error("パートナー名を入力してください。");
  if (!email || !email.includes("@")) throw new Error("有効なメールアドレスを入力してください。");
  const organizationId = await resolveFirstStaffOrganizationId(client);

  const { data, error } = await client
    .from("team_works_partners")
    .upsert(
      {
        organization_id: organizationId,
        display_name: displayName,
        email,
        note: input.note.trim() || null,
        status: "active",
        archived_at: null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "organization_id,email" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateOperationsPartnerStatus(
  client: SupabaseClient,
  partnerId: string,
  status: "active" | "paused"
) {
  const { error } = await client
    .from("team_works_partners")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  if (error) throw error;
}

export async function archiveOperationsPartner(client: SupabaseClient, partnerId: string) {
  const { data, error } = await client
    .from("team_works_partners")
    .update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", partnerId)
    .select("organization_id,email")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("パートナー名簿をアーカイブできませんでした。権限と対象を確認してください。");
  const row = data as { organization_id: string; email: string };

  // Archiving only the directory row would leave any already-activated worker
  // membership in place: the fixed-URL self-activation RPC would just
  // recreate it on their next portal visit. Archive the matching active
  // membership too so the directory stays authoritative.
  const activeMemberResult = await client.rpc("team_works_find_active_member", {
    target_organization_id: row.organization_id,
    target_role: "worker",
    target_email: row.email
  });
  if (activeMemberResult.error) throw activeMemberResult.error;
  const activeMember = ((activeMemberResult.data ?? []) as { member_id: string; display_name: string }[])[0];
  if (activeMember) {
    await archiveOperationsOrganizationMember(client, activeMember.member_id);
  }
}

export type OperationsClientDirectoryEntry = {
  id: string;
  organizationId: string;
  displayName: string;
  email: string;
  note: string | null;
  status: string;
};

export async function loadOperationsClientDirectory(client: SupabaseClient): Promise<OperationsClientDirectoryEntry[]> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return [];

  const { data, error } = await client
    .from("team_works_clients")
    .select("id,organization_id,display_name,email,note,status")
    .in("organization_id", organizationIds)
    .neq("status", "archived")
    .order("display_name");
  if (error) throw error;

  return ((data ?? []) as {
    id: string;
    organization_id: string;
    display_name: string;
    email: string;
    note: string | null;
    status: string;
  }[]).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    displayName: row.display_name,
    email: row.email,
    note: row.note,
    status: row.status
  }));
}

export async function createOperationsClient(
  client: SupabaseClient,
  input: { displayName: string; email: string; note: string }
): Promise<string> {
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  if (!displayName) throw new Error("クライアント名を入力してください。");
  if (!email || !email.includes("@")) throw new Error("有効なメールアドレスを入力してください。");
  const organizationId = await resolveFirstStaffOrganizationId(client);

  const { data, error } = await client
    .from("team_works_clients")
    .upsert(
      {
        organization_id: organizationId,
        display_name: displayName,
        email,
        note: input.note.trim() || null,
        status: "active",
        archived_at: null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "organization_id,email" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateOperationsClientStatus(
  client: SupabaseClient,
  clientId: string,
  status: "active" | "paused"
) {
  const { error } = await client
    .from("team_works_clients")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", clientId);
  if (error) throw error;
}

export async function archiveOperationsClient(client: SupabaseClient, clientId: string) {
  const { data, error } = await client
    .from("team_works_clients")
    .update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .select("organization_id,email")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("クライアント名簿をアーカイブできませんでした。権限と対象を確認してください。");
  const row = data as { organization_id: string; email: string };

  // Same reasoning as archiveOperationsPartner: archive the matching active
  // client_user membership too, or self-activation would recreate it.
  const activeMemberResult = await client.rpc("team_works_find_active_member", {
    target_organization_id: row.organization_id,
    target_role: "client_user",
    target_email: row.email
  });
  if (activeMemberResult.error) throw activeMemberResult.error;
  const activeMember = ((activeMemberResult.data ?? []) as { member_id: string; display_name: string }[])[0];
  if (activeMember) {
    await archiveOperationsOrganizationMember(client, activeMember.member_id);
  }
}

export type OperationsOrganizationMemberEntry = {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
  status: string;
};

export async function loadOperationsOrganizationMembers(client: SupabaseClient): Promise<OperationsOrganizationMemberEntry[]> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return [];

  // Resolves email via auth.users server-side (self-activated members have
  // no invite row, so a plain client-side join to team_works_member_invites
  // would leave their email blank — exactly the ones staff most need to see
  // to tell duplicates apart).
  const results = await Promise.all(
    organizationIds.map((organizationId) =>
      client.rpc("team_works_list_organization_members", { target_organization_id: organizationId })
    )
  );
  const rows: { id: string; display_name: string; role: string; status: string; email: string | null }[] = [];
  for (const result of results) {
    if (result.error) throw result.error;
    rows.push(...((result.data ?? []) as { id: string; display_name: string; role: string; status: string; email: string | null }[]));
  }
  rows.sort((a, b) => a.display_name.localeCompare(b.display_name));

  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status
  }));
}

export async function archiveOperationsOrganizationMember(client: SupabaseClient, organizationMemberId: string) {
  const { data, error } = await client
    .from("team_works_organization_members")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", organizationMemberId)
    .neq("role", "owner")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("オーナーはアーカイブできません。");
}

export async function createOperationsGroup(client: SupabaseClient, projectId: string, name: string) {
  const { error } = await client.from("team_works_groups").insert({ project_id: projectId, name: name.trim() });
  if (error) throw error;
}

export async function createOperationsScheduleRule(
  client: SupabaseClient,
  projectId: string,
  input: { weekday: number; startTime: string; durationMin: number; partnerMemberId: string | null }
) {
  const { error } = await client.from("team_works_schedule_rules").insert({
    project_id: projectId,
    weekday: Math.min(6, Math.max(0, Math.round(input.weekday))),
    start_time: input.startTime,
    duration_min: Math.max(1, Math.round(input.durationMin)),
    partner_member_id: input.partnerMemberId || null,
    status: "active"
  });
  if (error) throw error;
}

export async function updateOperationsScheduleRule(
  client: SupabaseClient,
  ruleId: string,
  input: { weekday: number; startTime: string; durationMin: number; partnerMemberId: string | null }
) {
  const { data, error } = await client
    .from("team_works_schedule_rules")
    .update({
      weekday: Math.min(6, Math.max(0, Math.round(input.weekday))),
      start_time: input.startTime,
      duration_min: Math.max(1, Math.round(input.durationMin)),
      partner_member_id: input.partnerMemberId || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", ruleId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("週次パターンを更新できませんでした。権限と対象を確認してください。");
}

export async function createOperationsSession(
  client: SupabaseClient,
  projectId: string,
  input: { sessionDate: string; startTime: string; durationMin: number; partnerMemberId: string | null }
) {
  const { error } = await client.from("team_works_op_sessions").insert({
    project_id: projectId,
    session_date: input.sessionDate,
    start_time: input.startTime,
    duration_min: Math.max(1, Math.round(input.durationMin)),
    partner_member_id: input.partnerMemberId || null,
    status: "scheduled"
  });
  if (error) throw error;
}

export async function updateOperationsSession(
  client: SupabaseClient,
  sessionId: string,
  input: { sessionDate: string; startTime: string; durationMin: number; partnerMemberId: string | null }
) {
  const { data, error } = await client
    .from("team_works_op_sessions")
    .update({
      session_date: input.sessionDate,
      start_time: input.startTime,
      duration_min: Math.max(1, Math.round(input.durationMin)),
      partner_member_id: input.partnerMemberId || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", sessionId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("予定を更新できませんでした。権限と対象を確認してください。");
}

export async function cancelOperationsSession(client: SupabaseClient, sessionId: string) {
  const { data, error } = await client
    .from("team_works_op_sessions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("予定を削除できませんでした。権限と対象を確認してください。");
}

export async function updateOperationsScheduleRuleStatus(
  client: SupabaseClient,
  ruleId: string,
  status: "active" | "paused"
) {
  const { data, error } = await client
    .from("team_works_schedule_rules")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("週次パターンを更新できませんでした。権限と対象を確認してください。");
}

export async function createOperationsHoliday(
  client: SupabaseClient,
  input: { organizationId: string; projectId: string; holidayDate: string; memo: string }
) {
  const { error } = await client.from("team_works_holidays").insert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    holiday_date: input.holidayDate,
    memo: input.memo.trim() || null
  });
  if (error) throw error;

  const { error: sessionError } = await client
    .from("team_works_op_sessions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("project_id", input.projectId)
    .eq("session_date", input.holidayDate)
    .neq("status", "cancelled");
  if (sessionError) throw sessionError;
}

export async function deleteOperationsHoliday(client: SupabaseClient, holidayId: string) {
  const { data, error } = await client
    .from("team_works_holidays")
    .delete()
    .eq("id", holidayId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("休講日を削除できませんでした。権限と対象を確認してください。");
}

export async function sendOperationsDirectMessage(
  client: SupabaseClient,
  input: { projectId: string; recipientMemberId: string; audience: "internal" | "client"; body: string }
) {
  const body = input.body.trim();
  if (!body) throw new Error("メッセージを入力してください。");

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("メッセージ送信にはログインが必要です。");

  const memberResult = await client
    .from("team_works_organization_members")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("status", "active");
  if (memberResult.error) throw memberResult.error;
  const candidateIds = (memberResult.data ?? []).map((row) => row.id as string);
  if (candidateIds.length === 0) throw new Error("送信者の組織メンバー情報が見つかりません。");

  const projectMemberResult = await client
    .from("team_works_project_members")
    .select("organization_member_id")
    .eq("project_id", input.projectId)
    .in("organization_member_id", candidateIds)
    .maybeSingle();
  if (projectMemberResult.error) throw projectMemberResult.error;
  const authorMemberId = projectMemberResult.data?.organization_member_id as string | undefined;
  if (!authorMemberId) throw new Error("このプロジェクトの送信権限が見つかりません。");

  const { error } = await client.from("team_works_project_comments").insert({
    project_id: input.projectId,
    author_member_id: authorMemberId,
    recipient_member_id: input.recipientMemberId,
    audience: input.audience,
    body
  });
  if (error) throw error;
}

export async function createOperationsParticipant(
  client: SupabaseClient,
  projectId: string,
  input: { name: string; groupId: string | null; level: string; cautions: string }
) {
  const { error } = await client.from("team_works_participants").insert({
    project_id: projectId,
    name: input.name.trim(),
    group_id: input.groupId || null,
    level: input.level.trim() || null,
    cautions: input.cautions.trim() || null
  });
  if (error) throw error;
}

export async function updateOperationsParticipantProgress(
  client: SupabaseClient,
  participantId: string,
  currentManualNo: number
) {
  const { data, error } = await client
    .from("team_works_participants")
    .update({ current_manual_no: Math.max(1, Math.round(currentManualNo)), updated_at: new Date().toISOString() })
    .eq("id", participantId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("進捗を更新できませんでした。権限と対象者を確認してください。");
}

export async function addOperationsRosterEntry(
  client: SupabaseClient,
  input: { projectId: string; sessionId: string; participantId: string; orderIndex: number }
) {
  const { error } = await client.from("team_works_session_roster").insert({
    project_id: input.projectId,
    session_id: input.sessionId,
    participant_id: input.participantId,
    order_index: Math.max(1, Math.round(input.orderIndex))
  });
  if (error) throw error;
}

export async function updateOperationsRosterAttendance(
  client: SupabaseClient,
  rosterId: string,
  attendanceStatus: "scheduled" | "present" | "absent" | "late" | "excused"
) {
  const { data, error } = await client
    .from("team_works_session_roster")
    .update({ attendance_status: attendanceStatus, updated_at: new Date().toISOString() })
    .eq("id", rosterId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("出欠を更新できませんでした。権限と対象者を確認してください。");
}

export async function createOperationsManual(
  client: SupabaseClient,
  projectId: string,
  input: { no: number; title: string; materialUrl: string }
) {
  const materialUrl = input.materialUrl.trim();
  const { error } = await client.from("team_works_manuals").insert({
    project_id: projectId,
    no: Math.max(1, Math.round(input.no)),
    title: input.title.trim(),
    material_type: materialUrl ? "link" : "none",
    material_url: materialUrl || null
  });
  if (error) throw error;
}

export async function updateOperationsManual(
  client: SupabaseClient,
  manualId: string,
  input: {
    title: string;
    materialUrl: string;
    questions: string[];
    expressions: string[];
    cautions: string;
  }
) {
  const materialUrl = input.materialUrl.trim();
  const { data, error } = await client
    .from("team_works_manuals")
    .update({
      title: input.title.trim(),
      material_type: materialUrl ? "link" : "none",
      material_url: materialUrl || null,
      questions: input.questions.map((value) => value.trim()).filter(Boolean),
      expressions: input.expressions.map((value) => value.trim()).filter(Boolean),
      cautions: input.cautions.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", manualId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("マニュアルを更新できませんでした。権限と対象を確認してください。");
}

export async function updateOperationsProjectDescription(
  client: SupabaseClient,
  projectId: string,
  description: string
) {
  const { data, error } = await client
    .from("team_works_projects")
    .update({ description: description.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("プロジェクトの説明を更新できませんでした。権限とプロジェクトを確認してください。");
}

export async function updateOperationsProjectContract(
  client: SupabaseClient,
  projectId: string,
  input: { contractStartedOn: string; contractEndedOn: string }
) {
  const { data, error } = await client
    .from("team_works_projects")
    .update({
      contract_started_on: input.contractStartedOn || null,
      contract_ended_on: input.contractEndedOn || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("契約期間を更新できませんでした。権限とプロジェクトを確認してください。");
}

export async function updateOperationsProjectVisibility(
  client: SupabaseClient,
  projectId: string,
  input: { clientVisible: boolean; payoutsEnabled: boolean; invoicesEnabled: boolean; clientPartnerContactVisible: boolean }
) {
  const { data, error } = await client
    .from("team_works_projects")
    .update({
      client_visible: input.clientVisible,
      payouts_enabled: input.payoutsEnabled,
      invoices_enabled: input.invoicesEnabled,
      client_partner_contact_visible: input.clientPartnerContactVisible,
      updated_at: new Date().toISOString()
    })
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("ポータル設定を更新できませんでした。権限とプロジェクトを確認してください。");
}

// --- R5: 運営型プロジェクトへのメンバー招待・割当 -------------------------------
// 既存 P8-c 招待基盤（team_works_member_invites + accept トリガー）を流用する。
// 招待の accept 時に private.team_works_mark_invite_accepted トリガーが
// project style に関係なく team_works_project_members を自動作成するため、
// ここでは運営型プロジェクトの UUID を直接指定して招待行を作るだけでよい。

export type OperationsInviteRole = "worker" | "client_user";

export type OperationsProjectMember = {
  organizationMemberId: string;
  displayName: string;
  email: string | null;
  projectRole: string;
  status: string;
};

export type OperationsProjectPartnerSetting = {
  organizationMemberId: string;
  hourlyWage: number | null;
  status: "active" | "removed";
};

export type OperationsProjectPartnerOffer = {
  organizationMemberId: string;
  status: "pending" | "accepted" | "declined" | "removed";
  requestedAt: string;
  respondedAt: string | null;
};

export type OperationsPendingInvite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

export type OperationsProjectPartnerAddResult =
  | {
      status: "assigned";
      organizationMemberId: string;
      displayName: string;
      email: string;
    }
  | {
      status: "pending_approval";
      organizationMemberId: string;
      displayName: string;
      email: string;
    }
  | {
      status: "pending_activation";
      inviteId: string;
      organizationId: string;
      role: "worker";
      expiresAt: string;
      email: string;
    };

export type OperationsProjectClientAddResult =
  | {
      // Assigned to the project but waiting for the client to approve it in
      // their portal. project_members(client) is created only on approval.
      status: "invited";
      organizationMemberId: string;
      displayName: string;
      email: string;
    }
  | {
      status: "pending_activation";
      inviteId: string;
      organizationId: string;
      role: "client_user";
      expiresAt: string;
      email: string;
    };

export async function loadOperationsProjectMembers(
  client: SupabaseClient,
  projectId: string
): Promise<{ members: OperationsProjectMember[]; pendingInvites: OperationsPendingInvite[] }> {
  if (!isDatabaseProjectId(projectId)) return { members: [], pendingInvites: [] };

  const memberResult = await client
    .from("team_works_project_members")
    .select("organization_id,organization_member_id,project_role")
    .eq("project_id", projectId);
  if (memberResult.error) throw memberResult.error;
  const memberRows = (memberResult.data ?? []) as { organization_id: string; organization_member_id: string; project_role: string }[];

  const orgMemberIds = memberRows.map((row) => row.organization_member_id);
  const orgMemberById = new Map<string, { display_name: string; status: string; invite_id: string | null }>();
  if (orgMemberIds.length > 0) {
    const orgResult = await client
      .from("team_works_organization_members")
      .select("id,display_name,status,invite_id")
      .in("id", orgMemberIds);
    if (orgResult.error) throw orgResult.error;
    for (const row of (orgResult.data ?? []) as { id: string; display_name: string; status: string; invite_id: string | null }[]) {
      orgMemberById.set(row.id, { display_name: row.display_name, status: row.status, invite_id: row.invite_id });
    }
  }

  const inviteIds = [...orgMemberById.values()].map((row) => row.invite_id).filter((id): id is string => Boolean(id));
  const emailByInviteId = new Map<string, string>();
  if (inviteIds.length > 0) {
    const acceptedInviteResult = await client
      .from("team_works_member_invites")
      .select("id,email")
      .in("id", inviteIds);
    if (acceptedInviteResult.error) throw acceptedInviteResult.error;
    for (const row of (acceptedInviteResult.data ?? []) as { id: string; email: string }[]) {
      emailByInviteId.set(row.id, row.email);
    }
  }

  const organizationIds = [...new Set(memberRows.map((row) => row.organization_id))];
  const partnerNameByOrganizationEmail = new Map<string, string>();
  const clientNameByOrganizationEmail = new Map<string, string>();
  if (organizationIds.length > 0) {
    const [partnerResult, clientResult] = await Promise.all([
      client
        .from("team_works_partners")
        .select("organization_id,display_name,email")
        .in("organization_id", organizationIds)
        .neq("status", "archived"),
      client
        .from("team_works_clients")
        .select("organization_id,display_name,email")
        .in("organization_id", organizationIds)
        .neq("status", "archived")
    ]);
    if (partnerResult.error) throw partnerResult.error;
    if (clientResult.error) throw clientResult.error;
    for (const row of (partnerResult.data ?? []) as { organization_id: string; display_name: string; email: string }[]) {
      partnerNameByOrganizationEmail.set(`${row.organization_id}:${row.email.trim().toLowerCase()}`, row.display_name);
    }
    for (const row of (clientResult.data ?? []) as { organization_id: string; display_name: string; email: string }[]) {
      clientNameByOrganizationEmail.set(`${row.organization_id}:${row.email.trim().toLowerCase()}`, row.display_name);
    }
  }

  const members = memberRows.map((row) => {
    const email = orgMemberById.get(row.organization_member_id)?.invite_id
      ? emailByInviteId.get(orgMemberById.get(row.organization_member_id)?.invite_id ?? "") ?? null
      : null;
    const directoryName = email
      ? (row.project_role === "worker"
          ? partnerNameByOrganizationEmail.get(`${row.organization_id}:${email.trim().toLowerCase()}`)
          : row.project_role === "client"
            ? clientNameByOrganizationEmail.get(`${row.organization_id}:${email.trim().toLowerCase()}`)
            : null)
      : null;
    return {
      organizationMemberId: row.organization_member_id,
      displayName: directoryName ?? orgMemberById.get(row.organization_member_id)?.display_name ?? "メンバー",
      email,
      projectRole: row.project_role,
      status: orgMemberById.get(row.organization_member_id)?.status ?? "active"
    };
  });

  const inviteResult = await client
    .from("team_works_member_invites")
    .select("id,email,role,expires_at")
    .eq("project_id", projectId)
    .eq("status", "pending");
  if (inviteResult.error) throw inviteResult.error;
  const pendingInvites = ((inviteResult.data ?? []) as { id: string; email: string; role: string; expires_at: string }[]).map(
    (row) => ({ id: row.id, email: row.email, role: row.role, expiresAt: row.expires_at })
  );

  return { members, pendingInvites };
}

export async function loadOperationsProjectPartnerSettings(
  client: SupabaseClient,
  projectId: string
): Promise<OperationsProjectPartnerSetting[]> {
  if (!isDatabaseProjectId(projectId)) return [];
  const { data, error } = await client
    .from("team_works_project_partner_settings")
    .select("organization_member_id,hourly_wage,status")
    .eq("project_id", projectId);
  // The UI must remain usable while the additive migration is being applied to
  // an already-running linked environment. In that short interval, use the
  // pre-settings behaviour rather than failing the entire Partners page.
  if (error) {
    const code = "code" in error ? String(error.code ?? "") : "";
    if (code === "42P01" || code === "PGRST205" || error.message.includes("team_works_project_partner_settings")) {
      return [];
    }
    throw error;
  }
  return ((data ?? []) as { organization_member_id: string; hourly_wage: number | null; status: "active" | "removed" }[]).map((row) => ({
    organizationMemberId: row.organization_member_id,
    hourlyWage: row.hourly_wage,
    status: row.status
  }));
}

export async function updateOperationsProjectPartnerSetting(
  client: SupabaseClient,
  input: { projectId: string; organizationMemberId: string; hourlyWage: number | null; status?: "active" | "removed" }
) {
  const { error } = await client.from("team_works_project_partner_settings").upsert(
    {
      project_id: input.projectId,
      organization_member_id: input.organizationMemberId,
      hourly_wage: input.hourlyWage,
      status: input.status ?? "active",
      updated_at: new Date().toISOString()
    },
    { onConflict: "project_id,organization_member_id" }
  );
  if (error) throw error;
}

export async function loadOperationsProjectPartnerOffers(
  client: SupabaseClient,
  projectId: string
): Promise<OperationsProjectPartnerOffer[]> {
  const { data, error } = await client
    .from("team_works_project_partner_offers")
    .select("organization_member_id,status,requested_at,responded_at")
    .eq("project_id", projectId);
  if (error) {
    const code = "code" in error ? String(error.code ?? "") : "";
    if (code === "42P01" || code === "PGRST205" || error.message.includes("team_works_project_partner_offers")) return [];
    throw error;
  }
  return ((data ?? []) as { organization_member_id: string; status: OperationsProjectPartnerOffer["status"]; requested_at: string; responded_at: string | null }[]).map((row) => ({
    organizationMemberId: row.organization_member_id,
    status: row.status,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at
  }));
}

export async function updateOperationsProjectPartnerOffer(
  client: SupabaseClient,
  input: { projectId: string; organizationMemberId: string; status: OperationsProjectPartnerOffer["status"] }
) {
  const now = new Date().toISOString();
  const { error } = await client.from("team_works_project_partner_offers").upsert(
    {
      project_id: input.projectId,
      organization_member_id: input.organizationMemberId,
      status: input.status,
      requested_at: now,
      responded_at: input.status === "pending" || input.status === "removed" ? null : now,
      updated_at: now
    },
    { onConflict: "project_id,organization_member_id" }
  );
  if (error) throw error;
}

export async function revokeOperationsProjectInvite(client: SupabaseClient, inviteId: string) {
  const { data, error } = await client
    .from("team_works_member_invites")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("招待を削除できませんでした。権限と招待状態を確認してください。");
}

export async function createOperationsProjectInvite(
  client: SupabaseClient,
  input: { projectId: string; email: string; role: OperationsInviteRole }
): Promise<{ id: string; organizationId: string; role: string; expiresAt: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("有効なメールアドレスを入力してください。");
  if (!isDatabaseProjectId(input.projectId)) throw new Error("運営型プロジェクトが見つかりませんでした。");

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("ログイン情報を確認できませんでした。");

  const projectResult = await client
    .from("team_works_projects")
    .select("id,organization_id,style")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectResult.error) throw projectResult.error;
  const project = projectResult.data as { id: string; organization_id: string; style: string } | null;
  if (!project || project.style !== "operations") throw new Error("運営型プロジェクトが見つかりませんでした。");

  const { data, error } = await client
    .from("team_works_member_invites")
    .insert({
      organization_id: project.organization_id,
      project_id: project.id,
      email,
      role: input.role,
      created_by_user_id: userData.user.id
    })
    .select("id,organization_id,role,expires_at")
    .single();
  if (error) throw error;
  const row = data as { id: string; organization_id: string; role: string; expires_at: string };
  return { id: row.id, organizationId: row.organization_id, role: row.role, expiresAt: row.expires_at };
}

export async function createOperationsPartnerInvite(
  client: SupabaseClient,
  input: { projectId: string; partnerId: string }
): Promise<{ id: string; organizationId: string; role: "worker"; expiresAt: string }> {
  if (!isDatabaseProjectId(input.projectId)) throw new Error("運営型プロジェクトが見つかりませんでした。");
  if (!isDatabaseProjectId(input.partnerId)) throw new Error("パートナー名簿から招待先を選んでください。");

  const projectResult = await client
    .from("team_works_projects")
    .select("id,organization_id,style")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectResult.error) throw projectResult.error;
  const project = projectResult.data as { id: string; organization_id: string; style: string } | null;
  if (!project || project.style !== "operations") throw new Error("運営型プロジェクトが見つかりませんでした。");

  const partnerResult = await client
    .from("team_works_partners")
    .select("id,organization_id,email,status")
    .eq("id", input.partnerId)
    .eq("organization_id", project.organization_id)
    .maybeSingle();
  if (partnerResult.error) throw partnerResult.error;
  const partner = partnerResult.data as { id: string; organization_id: string; email: string; status: string } | null;
  if (!partner || partner.status === "archived") throw new Error("パートナー名簿に招待先が見つかりませんでした。");

  const invite = await createOperationsProjectInvite(client, {
    projectId: project.id,
    email: partner.email,
    role: "worker"
  });

  const { error: assignmentError } = await client
    .from("team_works_project_partners")
    .upsert(
      {
        project_id: project.id,
        organization_id: project.organization_id,
        partner_id: partner.id,
        status: "invited",
        updated_at: new Date().toISOString()
      },
      { onConflict: "project_id,partner_id" }
    );
  if (assignmentError) throw assignmentError;

  return { id: invite.id, organizationId: invite.organizationId, role: "worker", expiresAt: invite.expiresAt };
}

export async function addOperationsPartnerToProject(
  client: SupabaseClient,
  input: { projectId: string; partnerId: string }
): Promise<OperationsProjectPartnerAddResult> {
  if (!isDatabaseProjectId(input.projectId)) throw new Error("運営型プロジェクトが見つかりませんでした。");
  if (!isDatabaseProjectId(input.partnerId)) throw new Error("パートナー名簿から追加する相手を選んでください。");

  const projectResult = await client
    .from("team_works_projects")
    .select("id,organization_id,style")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectResult.error) throw projectResult.error;
  const project = projectResult.data as { id: string; organization_id: string; style: string } | null;
  if (!project || project.style !== "operations") throw new Error("運営型プロジェクトが見つかりませんでした。");

  const partnerResult = await client
    .from("team_works_partners")
    .select("id,organization_id,display_name,email,status")
    .eq("id", input.partnerId)
    .eq("organization_id", project.organization_id)
    .maybeSingle();
  if (partnerResult.error) throw partnerResult.error;
  const partner = partnerResult.data as {
    id: string;
    organization_id: string;
    display_name: string;
    email: string;
    status: string;
  } | null;
  if (!partner || partner.status === "archived") throw new Error("パートナー名簿に追加対象が見つかりませんでした。");

  const normalizedEmail = partner.email.trim().toLowerCase();
  // Finds an active worker membership for this email regardless of how it was
  // created — an accepted per-project invite, or fixed-URL self-activation
  // (which never creates an invite row at all, so checking invites alone
  // misses anyone who onboarded that way).
  const activeMemberResult = await client.rpc("team_works_find_active_member", {
    target_organization_id: project.organization_id,
    target_role: "worker",
    target_email: normalizedEmail
  });
  if (activeMemberResult.error) throw activeMemberResult.error;
  {
    const activeMemberRow = ((activeMemberResult.data ?? []) as { member_id: string; display_name: string }[])[0];
    const member = activeMemberRow ? { id: activeMemberRow.member_id } : null;

    if (member) {
      // Older email-link invitations used the email prefix as display_name.
      // Once a directory partner is chosen, the directory name becomes the
      // canonical human-facing name for both staff and portal screens.
      const { error: memberNameError } = await client
        .from("team_works_organization_members")
        .update({ display_name: partner.display_name, updated_at: new Date().toISOString() })
        .eq("id", member.id);
      if (memberNameError) throw memberNameError;

      // A pending per-project invite from before the directory pattern (or
      // before fixed-URL self-activation) is now moot: this person is
      // already active. Clear it so it stops showing as a ghost "Pending
      // invites" row in the staff UI.
      await client
        .from("team_works_member_invites")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("organization_id", project.organization_id)
        .eq("project_id", project.id)
        .eq("email", normalizedEmail)
        .eq("role", "worker")
        .eq("status", "pending");

      const { error: projectPartnerError } = await client
        .from("team_works_project_partners")
        .upsert(
          {
            project_id: project.id,
            organization_id: project.organization_id,
            partner_id: partner.id,
            status: "invited",
            updated_at: new Date().toISOString()
          },
          { onConflict: "project_id,partner_id" }
        );
      if (projectPartnerError) throw projectPartnerError;

      const { error: projectMemberError } = await client
        .from("team_works_project_members")
        .upsert(
          {
            project_id: project.id,
            organization_id: project.organization_id,
            organization_member_id: member.id,
            project_role: "worker"
          },
          { onConflict: "project_id,organization_member_id" }
        );
      if (projectMemberError) throw projectMemberError;

      await updateOperationsProjectPartnerSetting(client, {
        projectId: project.id,
        organizationMemberId: member.id,
        hourlyWage: null,
        status: "active"
      });

      await updateOperationsProjectPartnerOffer(client, {
        projectId: project.id,
        organizationMemberId: member.id,
        status: "pending"
      });

      return {
        status: "pending_approval",
        organizationMemberId: member.id,
        displayName: partner.display_name,
        email: normalizedEmail
      };
    }
  }

  const pendingInviteResult = await client
    .from("team_works_member_invites")
    .select("id,organization_id,role,expires_at")
    .eq("organization_id", project.organization_id)
    .eq("project_id", project.id)
    .eq("email", normalizedEmail)
    .eq("role", "worker")
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (pendingInviteResult.error) throw pendingInviteResult.error;

  const pendingInvite = ((pendingInviteResult.data ?? []) as {
    id: string;
    organization_id: string;
    role: "worker";
    expires_at: string;
  }[])[0];
  const invite = pendingInvite
    ? {
        id: pendingInvite.id,
        organizationId: pendingInvite.organization_id,
        role: "worker" as const,
        expiresAt: pendingInvite.expires_at
      }
    : await createOperationsProjectInvite(client, {
      projectId: project.id,
      email: normalizedEmail,
      role: "worker"
    });

  const { error: assignmentError } = await client
    .from("team_works_project_partners")
    .upsert(
      {
        project_id: project.id,
        organization_id: project.organization_id,
        partner_id: partner.id,
        status: "invited",
        updated_at: new Date().toISOString()
      },
      { onConflict: "project_id,partner_id" }
    );
  if (assignmentError) throw assignmentError;

  return {
    status: "pending_activation",
    inviteId: invite.id,
    organizationId: invite.organizationId,
    role: "worker",
    expiresAt: invite.expiresAt,
    email: normalizedEmail
  };
}

export async function addOperationsClientToProject(
  client: SupabaseClient,
  input: { projectId: string; clientId: string }
): Promise<OperationsProjectClientAddResult> {
  if (!isDatabaseProjectId(input.projectId)) throw new Error("運営型プロジェクトが見つかりませんでした。");
  if (!isDatabaseProjectId(input.clientId)) throw new Error("クライアント名簿から追加する相手を選んでください。");

  const projectResult = await client
    .from("team_works_projects")
    .select("id,organization_id,style")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectResult.error) throw projectResult.error;
  const project = projectResult.data as { id: string; organization_id: string; style: string } | null;
  if (!project || project.style !== "operations") throw new Error("運営型プロジェクトが見つかりませんでした。");

  const clientResult = await client
    .from("team_works_clients")
    .select("id,organization_id,display_name,email,status")
    .eq("id", input.clientId)
    .eq("organization_id", project.organization_id)
    .maybeSingle();
  if (clientResult.error) throw clientResult.error;
  const directoryClient = clientResult.data as {
    id: string;
    organization_id: string;
    display_name: string;
    email: string;
    status: string;
  } | null;
  if (!directoryClient || directoryClient.status === "archived") throw new Error("クライアント名簿に追加対象が見つかりませんでした。");

  const normalizedEmail = directoryClient.email.trim().toLowerCase();
  // Finds an active client_user membership for this email regardless of how
  // it was created — an accepted per-project invite, or fixed-URL
  // self-activation (which never creates an invite row at all).
  const activeMemberResult = await client.rpc("team_works_find_active_member", {
    target_organization_id: project.organization_id,
    target_role: "client_user",
    target_email: normalizedEmail
  });
  if (activeMemberResult.error) throw activeMemberResult.error;
  {
    const activeMemberRow = ((activeMemberResult.data ?? []) as { member_id: string; display_name: string }[])[0];
    const member = activeMemberRow ? { id: activeMemberRow.member_id } : null;

    if (member) {
      // Once a directory client is chosen, the directory name becomes the
      // canonical human-facing name for both staff and portal screens, same
      // as the partner directory does for workers.
      const { error: memberNameError } = await client
        .from("team_works_organization_members")
        .update({ display_name: directoryClient.display_name, updated_at: new Date().toISOString() })
        .eq("id", member.id);
      if (memberNameError) throw memberNameError;

      // A pending per-project invite from before the directory pattern (or
      // before fixed-URL self-activation) is now moot: this person is
      // already active. Clear it so it stops showing as a ghost "Pending
      // invites" row in the staff UI.
      await client
        .from("team_works_member_invites")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("organization_id", project.organization_id)
        .eq("project_id", project.id)
        .eq("email", normalizedEmail)
        .eq("role", "client_user")
        .eq("status", "pending");

      // Assign as pending: the client must approve in their portal before
      // project_members(client) is created and full access is granted. The
      // approval RPC (team_works_approve_client_project) does that step.
      const { error: projectClientError } = await client
        .from("team_works_project_clients")
        .upsert(
          {
            project_id: project.id,
            organization_id: project.organization_id,
            client_id: directoryClient.id,
            status: "invited",
            updated_at: new Date().toISOString()
          },
          { onConflict: "project_id,client_id" }
        );
      if (projectClientError) throw projectClientError;

      return {
        status: "invited",
        organizationMemberId: member.id,
        displayName: directoryClient.display_name,
        email: normalizedEmail
      };
    }
  }

  const pendingInviteResult = await client
    .from("team_works_member_invites")
    .select("id,organization_id,role,expires_at")
    .eq("organization_id", project.organization_id)
    .eq("project_id", project.id)
    .eq("email", normalizedEmail)
    .eq("role", "client_user")
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (pendingInviteResult.error) throw pendingInviteResult.error;

  const pendingInvite = ((pendingInviteResult.data ?? []) as {
    id: string;
    organization_id: string;
    role: "client_user";
    expires_at: string;
  }[])[0];
  const invite = pendingInvite
    ? {
        id: pendingInvite.id,
        organizationId: pendingInvite.organization_id,
        role: "client_user" as const,
        expiresAt: pendingInvite.expires_at
      }
    : await createOperationsProjectInvite(client, {
      projectId: project.id,
      email: normalizedEmail,
      role: "client_user"
    });

  const { error: assignmentError } = await client
    .from("team_works_project_clients")
    .upsert(
      {
        project_id: project.id,
        organization_id: project.organization_id,
        client_id: directoryClient.id,
        status: "invited",
        updated_at: new Date().toISOString()
      },
      { onConflict: "project_id,client_id" }
    );
  if (assignmentError) throw assignmentError;

  return {
    status: "pending_activation",
    inviteId: invite.id,
    organizationId: invite.organizationId,
    role: "client_user",
    expiresAt: invite.expiresAt,
    email: normalizedEmail
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
