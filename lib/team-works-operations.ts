import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatChipTone } from "@/components/mikkeos/StatChip";
import { isJapanDayOffKey } from "@/lib/japanese-calendar";

/**
 * Team Works R2: 運営型プロジェクトのダッシュボード/スケジュール用データアクセス＋
 * 週次パターン→コマ自動生成ロジック。
 *
 * クエリは呼び出し元(ブラウザのsupabaseクライアント／APIルートのbearerトークン付きクライアント)
 * が渡す SupabaseClient に対して行う。RLSが認可の実体で、ここではRLSを前提に
 * 「本部(owner/manager)が所属する組織」だけを起点に辿る（P8-a/P8-cのポータル実装と同じ考え方）。
 */

export type OperationsProjectSummary = {
  id: string;
  organizationId: string;
  title: string;
  tone: StatChipTone;
  bg: string;
  fg: string;
};

export type OperationsCalendarEvent = {
  id: string;
  projectId: string;
  projectTitle: string;
  bg: string;
  fg: string;
  sessionDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMin: number;
  partnerName: string | null;
  participantCount: number;
  zoomUrl: string | null;
  zoomMeetingId: string | null;
  zoomPasscode: string | null;
  partnerPresenceStatus: "not_started" | "standby" | "in_progress" | "ended";
  status: "scheduled" | "completed" | "cancelled";
};

export type OperationsHoliday = {
  id: string;
  organizationId: string;
  projectId: string | null;
  date: string; // YYYY-MM-DD
  memo: string | null;
};

export type RecentOperationsComment = {
  id: string;
  projectId: string;
  projectTitle: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type OperationsDashboardData = {
  hasOperationsProjects: boolean;
  projects: OperationsProjectSummary[];
  activePresenceEvents: OperationsCalendarEvent[];
  monthEvents: OperationsCalendarEvent[];
  monthHolidayDates: Set<string>;
  monthHolidays: OperationsHoliday[];
  todayEvents: OperationsCalendarEvent[];
  needsAttentionUnassigned: OperationsCalendarEvent[];
  upcomingEvents: OperationsCalendarEvent[];
  recentComments: RecentOperationsComment[];
};

export type OperationsScheduleGroup = {
  dateKey: string;
  label: string;
  events: OperationsCalendarEvent[];
};

export type OperationsMessagesOverview = {
  projects: OperationsProjectSummary[];
  recentComments: RecentOperationsComment[];
};

export type GenerateSessionsSummary = {
  projectId: string;
  projectTitle: string;
  createdCount: number;
  consideredRuleCount: number;
  skippedHolidayDateCount: number;
  skippedExistingSlotCount: number;
};

export type GenerateSessionsResult = {
  organizationCount: number;
  projectCount: number;
  totalCreated: number;
  projects: GenerateSessionsSummary[];
};

/** 5色固定パレット・淡色(green/yellow/pink)は黒文字・濃色(blue/orange)は白文字（StatChipと同じ規則）。 */
const projectColorCycle: { tone: StatChipTone; bg: string; fg: string }[] = [
  { tone: "blue", bg: "var(--mikke-blue, #3f4eb5)", fg: "#ffffff" },
  { tone: "green", bg: "var(--mikke-green, #8bc7ad)", fg: "#1b1b1f" },
  { tone: "orange", bg: "var(--mikke-orange, #f75a3b)", fg: "#ffffff" },
  { tone: "pink", bg: "var(--mikke-pink, #f9d3d2)", fg: "#1b1b1f" },
  { tone: "yellow", bg: "var(--mikke-yellow, #ffd370)", fg: "#1b1b1f" }
];

// ---------- date helpers ----------

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** カレンダーグリッド用: 月の最初の週の日曜日〜最後の週の土曜日までの全日付。 */
export function buildCalendarGridDates(monthDate: Date): Date[] {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const dates: Date[] = [];
  let cursor = gridStart;
  while (cursor.getTime() <= gridEnd.getTime()) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function slotKey(dateKey: string, startTime: string, partnerMemberId: string | null): string {
  return `${dateKey}|${startTime}|${partnerMemberId ?? "none"}`;
}

// ---------- staff/org resolution ----------

/** ログインユーザーが本部(owner/manager)として所属する組織id一覧。プロジェクトを1つも持たない/未ログインなら空配列。 */
export async function resolveStaffOrganizationIds(client: SupabaseClient): Promise<string[]> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) return [];

  const [ownedOrganizations, staffMemberships] = await Promise.all([
    client.from("team_works_organizations").select("id").eq("owner_user_id", user.id),
    client
      .from("team_works_organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "manager"])
  ]);
  if (ownedOrganizations.error) throw ownedOrganizations.error;
  if (staffMemberships.error) throw staffMemberships.error;

  const ids = new Set<string>();
  for (const row of ownedOrganizations.data ?? []) ids.add(row.id as string);
  for (const row of staffMemberships.data ?? []) ids.add(row.organization_id as string);
  return [...ids];
}

async function fetchOperationsProjectRows(client: SupabaseClient, organizationIds: string[]) {
  if (organizationIds.length === 0) return [];
  const { data, error } = await client
    .from("team_works_projects")
    .select("id,organization_id,title")
    .in("organization_id", organizationIds)
    .eq("style", "operations")
    .is("archived_at", null)
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []) as { id: string; organization_id: string; title: string }[];
}

function toProjectSummaries(rows: { id: string; organization_id: string; title: string }[]): OperationsProjectSummary[] {
  return rows.map((row, index) => ({
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    ...projectColorCycle[index % projectColorCycle.length]
  }));
}

/** 本部が担当する運営型プロジェクト（RLS配下でaccess可能な組織の分だけ）。 */
export async function fetchOperationsProjects(client: SupabaseClient): Promise<{ organizationIds: string[]; projects: OperationsProjectSummary[] }> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  const rows = await fetchOperationsProjectRows(client, organizationIds);
  return { organizationIds, projects: toProjectSummaries(rows) };
}

export async function loadOperationsMessagesOverview(client: SupabaseClient): Promise<OperationsMessagesOverview> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return { projects: [], recentComments: [] };
  const projectRows = await fetchOperationsProjectRows(client, organizationIds);
  const projects = toProjectSummaries(projectRows);
  if (projects.length === 0) return { projects, recentComments: [] };
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const [memberNameById, commentRows] = await Promise.all([
    fetchOrganizationMemberNames(client, organizationIds),
    fetchRecentCommentRows(client, projects.map((project) => project.id), 20)
  ]);
  const recentComments = commentRows.flatMap((row) => {
    const project = projectById.get(row.project_id);
    if (!project) return [];
    return [{
      id: row.id,
      projectId: row.project_id,
      projectTitle: project.title,
      authorName: memberNameById.get(row.author_member_id) ?? "メンバー",
      body: row.body,
      createdAt: row.created_at
    }];
  });
  return { projects, recentComments };
}

async function fetchOrganizationMemberNames(client: SupabaseClient, organizationIds: string[]): Promise<Map<string, string>> {
  if (organizationIds.length === 0) return new Map();
  const { data, error } = await client
    .from("team_works_organization_members")
    .select("id,display_name")
    .in("organization_id", organizationIds);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id as string, row.display_name as string]));
}

async function fetchSessionRows(client: SupabaseClient, projectIds: string[], fromKey: string, toKey: string) {
  if (projectIds.length === 0) return [];
  const { data, error } = await client
    .from("team_works_op_sessions")
    .select("id,project_id,session_date,start_time,duration_min,status,partner_member_id,zoom_url,zoom_meeting_id,zoom_passcode,partner_presence_status")
    .in("project_id", projectIds)
    .gte("session_date", fromKey)
    .lte("session_date", toKey)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    project_id: string;
    session_date: string;
    start_time: string;
    duration_min: number;
    status: "scheduled" | "completed" | "cancelled";
    partner_member_id: string | null;
    zoom_url: string | null;
    zoom_meeting_id: string | null;
    zoom_passcode: string | null;
    partner_presence_status: "not_started" | "standby" | "in_progress" | "ended";
  }[];
}

async function fetchActivePresenceSessionRows(client: SupabaseClient, projectIds: string[]) {
  if (projectIds.length === 0) return [];
  const { data, error } = await client
    .from("team_works_op_sessions")
    .select("id,project_id,session_date,start_time,duration_min,status,partner_member_id,zoom_url,zoom_meeting_id,zoom_passcode,partner_presence_status")
    .in("project_id", projectIds)
    .in("partner_presence_status", ["standby", "in_progress"])
    .neq("status", "cancelled")
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Awaited<ReturnType<typeof fetchSessionRows>>;
}

async function fetchHolidayRows(
  client: SupabaseClient,
  organizationIds: string[],
  projectIds: string[],
  fromKey: string,
  toKey: string
): Promise<OperationsHoliday[]> {
  const queries: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>[] = [];
  if (organizationIds.length > 0) {
    queries.push(
      client
        .from("team_works_holidays")
        .select("id,organization_id,project_id,holiday_date,memo")
        .in("organization_id", organizationIds)
        .is("project_id", null)
        .gte("holiday_date", fromKey)
        .lte("holiday_date", toKey)
    );
  }
  if (projectIds.length > 0) {
    queries.push(
      client
        .from("team_works_holidays")
        .select("id,organization_id,project_id,holiday_date,memo")
        .in("project_id", projectIds)
        .gte("holiday_date", fromKey)
        .lte("holiday_date", toKey)
    );
  }
  if (queries.length === 0) return [];
  const results = await Promise.all(queries);
  const rowsById = new Map<string, OperationsHoliday>();
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of (result.data ?? []) as { id: string; organization_id: string; project_id: string | null; holiday_date: string; memo: string | null }[]) {
      rowsById.set(row.id, {
        id: row.id,
        organizationId: row.organization_id,
        projectId: row.project_id,
        date: row.holiday_date,
        memo: row.memo
      });
    }
  }
  return [...rowsById.values()];
}

async function fetchRosterCounts(client: SupabaseClient, sessionIds: string[]): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();
  const { data, error } = await client.from("team_works_session_roster").select("session_id").in("session_id", sessionIds);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { session_id: string }[]) {
    counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  }
  return counts;
}

async function fetchRecentCommentRows(client: SupabaseClient, projectIds: string[], limit: number) {
  if (projectIds.length === 0) return [];
  const { data, error } = await client
    .from("team_works_project_comments")
    .select("id,project_id,author_member_id,body,created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as { id: string; project_id: string; author_member_id: string; body: string; created_at: string }[];
}

function assembleEvent(
  row: { id: string; project_id: string; session_date: string; start_time: string; duration_min: number; status: "scheduled" | "completed" | "cancelled"; partner_member_id: string | null; zoom_url: string | null; zoom_meeting_id: string | null; zoom_passcode: string | null; partner_presence_status: "not_started" | "standby" | "in_progress" | "ended" },
  projectById: Map<string, OperationsProjectSummary>,
  memberNameById: Map<string, string>,
  rosterCounts: Map<string, number>
): OperationsCalendarEvent | null {
  const project = projectById.get(row.project_id);
  if (!project) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    projectTitle: project.title,
    bg: project.bg,
    fg: project.fg,
    sessionDate: row.session_date,
    startTime: row.start_time.slice(0, 5),
    durationMin: row.duration_min,
    partnerName: row.partner_member_id ? memberNameById.get(row.partner_member_id) ?? "担当未設定" : null,
    participantCount: rosterCounts.get(row.id) ?? 0,
    zoomUrl: row.zoom_url,
    zoomMeetingId: row.zoom_meeting_id,
    zoomPasscode: row.zoom_passcode,
    partnerPresenceStatus: row.partner_presence_status ?? "not_started",
    status: row.status
  };
}

/** #view-home 用: カレンダー月間分＋本日＋シフト未決定＋新着メッセージをまとめて取得。 */
export async function loadOperationsDashboardData(client: SupabaseClient, monthDate: Date): Promise<OperationsDashboardData> {
  const empty: OperationsDashboardData = {
    hasOperationsProjects: false,
    projects: [],
    activePresenceEvents: [],
    monthEvents: [],
    monthHolidayDates: new Set(),
    monthHolidays: [],
    todayEvents: [],
    needsAttentionUnassigned: [],
    upcomingEvents: [],
    recentComments: []
  };

  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return empty;

  const projectRows = await fetchOperationsProjectRows(client, organizationIds);
  if (projectRows.length === 0) return empty;

  const projects = toProjectSummaries(projectRows);
  const projectIds = projects.map((p) => p.id);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const gridDates = buildCalendarGridDates(monthDate);
  const gridStartKey = formatDateKey(gridDates[0]);
  const gridEndKey = formatDateKey(gridDates[gridDates.length - 1]);

  const today = new Date();
  const todayKey = formatDateKey(today);
  const attentionEndKey = formatDateKey(addDays(today, 6));
  const upcomingEndKey = formatDateKey(addDays(today, 60));

  const [memberNameById, sessionRows, activePresenceRows, holidayRows, unassignedRows, upcomingRows, commentRows] = await Promise.all([
    fetchOrganizationMemberNames(client, organizationIds),
    fetchSessionRows(client, projectIds, gridStartKey, gridEndKey),
    fetchActivePresenceSessionRows(client, projectIds),
    fetchHolidayRows(client, organizationIds, projectIds, gridStartKey, gridEndKey),
    fetchUnassignedUpcomingSessionRows(client, projectIds, todayKey, attentionEndKey),
    fetchSessionRows(client, projectIds, todayKey, upcomingEndKey),
    fetchRecentCommentRows(client, projectIds, 6)
  ]);

  const sessionIds = sessionRows.map((row) => row.id);
  const rosterCounts = await fetchRosterCounts(client, [...new Set([
    ...sessionIds,
    ...activePresenceRows.map((row) => row.id),
    ...unassignedRows.map((row) => row.id),
    ...upcomingRows.map((row) => row.id)
  ])]);

  const activePresenceEvents = activePresenceRows
    .flatMap((row) => {
      const event = assembleEvent(row, projectById, memberNameById, rosterCounts);
      return event ? [event] : [];
    })
    .sort((a, b) => {
      if (a.partnerPresenceStatus !== b.partnerPresenceStatus) {
        return a.partnerPresenceStatus === "in_progress" ? -1 : 1;
      }
      return (a.sessionDate + a.startTime).localeCompare(b.sessionDate + b.startTime);
    });

  const monthEvents = sessionRows
    .filter((row) => row.status !== "cancelled" && !isJapanDayOffKey(row.session_date))
    .flatMap((row) => {
      const event = assembleEvent(row, projectById, memberNameById, rosterCounts);
      return event ? [event] : [];
    });

  const todayEvents = monthEvents
    .filter((event) => event.sessionDate === todayKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const needsAttentionUnassigned = unassignedRows
    .filter((row) => !isJapanDayOffKey(row.session_date))
    .flatMap((row) => {
      const event = assembleEvent(row, projectById, memberNameById, rosterCounts);
      return event ? [event] : [];
    })
    .sort((a, b) => (a.sessionDate + a.startTime).localeCompare(b.sessionDate + b.startTime));

  const upcomingEvents = upcomingRows
    .filter((row) => row.status === "scheduled" && !isJapanDayOffKey(row.session_date))
    .flatMap((row) => {
      const event = assembleEvent(row, projectById, memberNameById, rosterCounts);
      return event ? [event] : [];
    })
    .slice(0, 3);

  const recentComments: RecentOperationsComment[] = commentRows.flatMap((row) => {
    const project = projectById.get(row.project_id);
    if (!project) return [];
    return [{
      id: row.id,
      projectId: row.project_id,
      projectTitle: project.title,
      authorName: memberNameById.get(row.author_member_id) ?? "メンバー",
      body: row.body,
      createdAt: row.created_at
    }];
  });

  return {
    hasOperationsProjects: true,
    projects,
    activePresenceEvents,
    monthEvents,
    monthHolidayDates: new Set(holidayRows.map((holiday) => holiday.date)),
    monthHolidays: holidayRows,
    todayEvents,
    needsAttentionUnassigned,
    upcomingEvents,
    recentComments
  };
}

async function fetchUnassignedUpcomingSessionRows(client: SupabaseClient, projectIds: string[], fromKey: string, toKey: string) {
  if (projectIds.length === 0) return [];
  const { data, error } = await client
    .from("team_works_op_sessions")
    .select("id,project_id,session_date,start_time,duration_min,status,partner_member_id,zoom_url,zoom_meeting_id,zoom_passcode,partner_presence_status")
    .in("project_id", projectIds)
    .is("partner_member_id", null)
    .eq("status", "scheduled")
    .gte("session_date", fromKey)
    .lte("session_date", toKey)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    project_id: string;
    session_date: string;
    start_time: string;
    duration_min: number;
    status: "scheduled" | "completed" | "cancelled";
    partner_member_id: string | null;
    zoom_url: string | null;
    zoom_meeting_id: string | null;
    zoom_passcode: string | null;
    partner_presence_status: "not_started" | "standby" | "in_progress" | "ended";
  }[];
}

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

function formatScheduleLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdayLabels[date.getDay()]}）`;
}

/** #view-schedule 用: 今日以降N日分の全プロジェクト予定を日付ヘッダーでグルーピング。 */
export async function loadOperationsScheduleGroups(
  client: SupabaseClient,
  options: { fromDate?: Date; days?: number } = {}
): Promise<{ hasOperationsProjects: boolean; groups: OperationsScheduleGroup[] }> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return { hasOperationsProjects: false, groups: [] };

  const projectRows = await fetchOperationsProjectRows(client, organizationIds);
  if (projectRows.length === 0) return { hasOperationsProjects: false, groups: [] };

  const projects = toProjectSummaries(projectRows);
  const projectIds = projects.map((p) => p.id);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const fromDate = options.fromDate ?? new Date();
  const days = options.days ?? 60;
  const fromKey = formatDateKey(fromDate);
  const toKey = formatDateKey(addDays(fromDate, days - 1));

  const [memberNameById, sessionRows] = await Promise.all([
    fetchOrganizationMemberNames(client, organizationIds),
    fetchSessionRows(client, projectIds, fromKey, toKey)
  ]);
  const activeRows = sessionRows.filter((row) => row.status !== "cancelled" && !isJapanDayOffKey(row.session_date));
  const rosterCounts = await fetchRosterCounts(client, activeRows.map((row) => row.id));

  const groupsByDate = new Map<string, OperationsCalendarEvent[]>();
  for (const row of activeRows) {
    const event = assembleEvent(row, projectById, memberNameById, rosterCounts);
    if (!event) continue;
    const list = groupsByDate.get(event.sessionDate) ?? [];
    list.push(event);
    groupsByDate.set(event.sessionDate, list);
  }

  const groups = [...groupsByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, events]) => ({
      dateKey,
      label: formatScheduleLabel(new Date(`${dateKey}T00:00:00`)),
      events: events.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }));

  return { hasOperationsProjects: true, groups };
}

async function insertSessionsSkippingConflicts(
  client: SupabaseClient,
  rows: { project_id: string; generated_from_rule_id: string; partner_member_id: string | null; session_date: string; start_time: string; duration_min: number }[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const bulkResult = await client.from("team_works_op_sessions").insert(rows).select("id");
  if (!bulkResult.error) return bulkResult.data?.length ?? rows.length;

  // 一括insertが競合(unique制約)で失敗した場合は1件ずつ試して衝突分だけ読み飛ばす。
  let created = 0;
  for (const row of rows) {
    const singleResult = await client.from("team_works_op_sessions").insert(row);
    if (!singleResult.error) created += 1;
    else if (singleResult.error.code !== "23505") throw singleResult.error;
  }
  return created;
}

/**
 * 1プロジェクト分の週次パターン→コマ自動生成。デフォルトは「本日から4週間(28日)」。
 * 休講日(組織全体+プロジェクト個別)はスキップ。同一 project/日付/開始時刻/担当 の枠が
 * 既に存在する場合もスキップ（DBのunique制約もフォールバックとして効く）。
 */
export async function generateSessionsForProject(
  client: SupabaseClient,
  project: { id: string; organizationId: string; title: string },
  options: { weeksAhead?: number; fromDate?: Date } = {}
): Promise<GenerateSessionsSummary> {
  const weeksAhead = options.weeksAhead ?? 4;
  const totalDays = weeksAhead * 7;
  const fromDate = options.fromDate ?? new Date();
  const fromKey = formatDateKey(fromDate);
  const toKey = formatDateKey(addDays(fromDate, totalDays - 1));

  const [rulesResult, holidayRows, existingResult] = await Promise.all([
    client
      .from("team_works_schedule_rules")
      .select("id,partner_member_id,weekday,start_time,duration_min")
      .eq("project_id", project.id)
      .eq("status", "active"),
    fetchHolidayRows(client, [project.organizationId], [project.id], fromKey, toKey),
    client
      .from("team_works_op_sessions")
      .select("session_date,start_time,partner_member_id")
      .eq("project_id", project.id)
      .gte("session_date", fromKey)
      .lte("session_date", toKey)
  ]);
  if (rulesResult.error) throw rulesResult.error;
  if (existingResult.error) throw existingResult.error;

  const rules = (rulesResult.data ?? []) as { id: string; partner_member_id: string | null; weekday: number; start_time: string; duration_min: number }[];
  const holidayDateSet = new Set(holidayRows.map((holiday) => holiday.date));
  const occupiedSlotKeys = new Set(
    ((existingResult.data ?? []) as { session_date: string; start_time: string; partner_member_id: string | null }[]).map((row) =>
      slotKey(row.session_date, row.start_time, row.partner_member_id)
    )
  );

  const rows: { project_id: string; generated_from_rule_id: string; partner_member_id: string | null; session_date: string; start_time: string; duration_min: number }[] = [];
  let skippedHolidayDateCount = 0;
  let skippedExistingSlotCount = 0;

  for (const rule of rules) {
    for (let offset = 0; offset < totalDays; offset += 1) {
      const date = addDays(fromDate, offset);
      if (date.getDay() !== rule.weekday) continue;
      const dateKey = formatDateKey(date);
      if (holidayDateSet.has(dateKey) || isJapanDayOffKey(dateKey)) {
        skippedHolidayDateCount += 1;
        continue;
      }
      const key = slotKey(dateKey, rule.start_time, rule.partner_member_id);
      if (occupiedSlotKeys.has(key)) {
        skippedExistingSlotCount += 1;
        continue;
      }
      occupiedSlotKeys.add(key);
      rows.push({
        project_id: project.id,
        generated_from_rule_id: rule.id,
        partner_member_id: rule.partner_member_id,
        session_date: dateKey,
        start_time: rule.start_time,
        duration_min: rule.duration_min
      });
    }
  }

  const createdCount = await insertSessionsSkippingConflicts(client, rows);
  return {
    projectId: project.id,
    projectTitle: project.title,
    createdCount,
    consideredRuleCount: rules.length,
    skippedHolidayDateCount,
    skippedExistingSlotCount
  };
}

/** ログインユーザーが本部として担当する全運営型プロジェクトに対してまとめて生成する。 */
export async function generateSessionsForReachableProjects(
  client: SupabaseClient,
  options: { weeksAhead?: number; fromDate?: Date; projectId?: string } = {}
): Promise<GenerateSessionsResult> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return { organizationCount: 0, projectCount: 0, totalCreated: 0, projects: [] };

  const projectRows = await fetchOperationsProjectRows(client, organizationIds);
  const targetRows = options.projectId ? projectRows.filter((row) => row.id === options.projectId) : projectRows;

  const summaries: GenerateSessionsSummary[] = [];
  for (const row of targetRows) {
    const summary = await generateSessionsForProject(
      client,
      { id: row.id, organizationId: row.organization_id, title: row.title },
      { weeksAhead: options.weeksAhead, fromDate: options.fromDate }
    );
    summaries.push(summary);
  }

  return {
    organizationCount: organizationIds.length,
    projectCount: targetRows.length,
    totalCreated: summaries.reduce((sum, summary) => sum + summary.createdCount, 0),
    projects: summaries
  };
}
