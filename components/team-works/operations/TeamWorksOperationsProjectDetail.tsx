"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FolderKanban,
  GraduationCap,
  Landmark,
  MessageSquare,
  Plus,
  Settings2,
  Send,
  Trash2,
  Users,
  Video,
  WalletCards
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { TeamWorksProjectDetail } from "@/components/team-works/projects/TeamWorksProjectDetail";
import { TeamWorksDeliveryProjectDetail } from "@/components/team-works/projects/TeamWorksDeliveryProjectDetail";
import { isDatabaseProjectId as isDeliveryDatabaseProjectId } from "@/lib/team-works-operations-project";
import {
  TeamWorksProjectField,
  TeamWorksProjectsShell,
  teamWorksProjectInputClass
} from "@/components/team-works/projects/TeamWorksProjectsShell";
import { supabase } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/supabase-schema-compat";
import { getJapanDayOff } from "@/lib/japanese-calendar";
import { useTeamWorksLabels } from "@/components/team-works/useTeamWorksLabels";
import type { TeamWorksLabels } from "@/lib/team-works-labels";
import {
  addOperationsClientToProject,
  addOperationsPartnerToProject,
  archiveOperationsScheduleRuleAndCancelFutureSessions,
  cancelOperationsSession,
  createOperationsHoliday,
  createOperationsManual,
  createOperationsParticipant,
  createOperationsScheduleRule,
  createOperationsSession,
  deleteOperationsHoliday,
  loadOperationsClientDirectory,
  loadOperationsPartnerDirectory,
  loadOperationsProjectPartnerSettings,
  loadOperationsProjectPartnerOffers,
  loadOperationsProjectDetail,
  loadOperationsProjectMembers,
  revokeOperationsProjectInvite,
  sendOperationsDirectMessage,
  updateOperationsProjectPartnerSetting,
  updateOperationsProjectPartnerOffer,
  updateOperationsManual,
  updateOperationsSession,
  updateOperationsParticipantProgress,
  updateOperationsProjectContract,
  updateOperationsProjectDescription,
  updateOperationsProjectTitle,
  updateOperationsProjectZoom,
  updateOperationsProjectVisibility,
  updateOperationsSessionZoom,
  type OperationsClientDirectoryEntry,
  type OperationsPartnerDirectoryEntry,
  type OperationsPendingInvite,
  type OperationsProjectDetailData,
  type OperationsProjectPartnerSetting,
  type OperationsProjectPartnerOffer,
  type OperationsProjectMember
} from "@/lib/team-works-operations-project";
import { generateSessionsForProject } from "@/lib/team-works-operations";
import { TeamWorksOperationsShell } from "./TeamWorksOperationsShell";

type ProjectTab =
  | "overview"
  | "schedule"
  | "messages"
  | "partners"
  | "roster"
  | "reports"
  | "manuals"
  | "portal"
  | "settings";

function buildTabs(labels: TeamWorksLabels): { id: ProjectTab; label: string }[] {
  return [
    { id: "overview", label: "概要" },
    { id: "schedule", label: "スケジュール" },
    { id: "messages", label: "メッセージ" },
    { id: "partners", label: labels.workers },
    { id: "roster", label: "名簿" },
    { id: "reports", label: "報告" },
    { id: "manuals", label: "マニュアル" },
    { id: "portal", label: "ポータル設定" },
    { id: "settings", label: "プロジェクト設定" }
  ];
}

async function checkDeliveryProjectExists(client: typeof supabase, projectId: string): Promise<boolean> {
  if (!isDeliveryDatabaseProjectId(projectId)) return false;
  const { data, error } = await client.from("team_works_projects").select("id").eq("id", projectId).eq("style", "delivery").maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export function TeamWorksProjectDetailRoute({ projectId }: { projectId: string }) {
  const [data, setData] = useState<OperationsProjectDetailData | null | undefined>(undefined);
  const [isDeliveryProject, setIsDeliveryProject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const operationsData = await loadOperationsProjectDetail(supabase, projectId);
      if (operationsData) {
        setIsDeliveryProject(false);
        setData(operationsData);
        return;
      }
      // 運営型として見つからなかった場合、Supabase上の納品型プロジェクトかどうかを確認する。
      // 存在すれば新しいSupabase接続版の詳細画面へ、無ければ従来のlocalStorage版へ落とす。
      const deliveryExists = await checkDeliveryProjectExists(supabase, projectId);
      setIsDeliveryProject(deliveryExists);
      setData(null);
    } catch (loadError) {
      setError(supabaseErrorMessage(loadError, "プロジェクト詳細の読み込みに失敗しました。"));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timerId = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timerId);
  }, [load]);

  if (error) {
    return (
      <TeamWorksOperationsShell title="プロジェクト詳細">
        <MikkeEmptyState title="読み込みに失敗しました" helper={error} />
      </TeamWorksOperationsShell>
    );
  }

  if (data === undefined) {
    return (
      <TeamWorksOperationsShell title="プロジェクト詳細">
        <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
      </TeamWorksOperationsShell>
    );
  }

  if (data === null) {
    return (
      <TeamWorksProjectsShell title="プロジェクト詳細" subtitle="工程・タスク・成果物・メンバーを確認する">
        {isDeliveryProject ? <TeamWorksDeliveryProjectDetail projectId={projectId} /> : <TeamWorksProjectDetail projectId={projectId} />}
      </TeamWorksProjectsShell>
    );
  }

  return <OperationsProjectDetail data={data} onReload={load} />;
}

function OperationsProjectDetail({
  data,
  onReload
}: {
  data: OperationsProjectDetailData;
  onReload: () => Promise<void>;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const labels = useTeamWorksLabels();
  const tabs = buildTabs(labels);
  const [activeTab, setActiveTab] = useState<ProjectTab>(
    tabs.some((tab) => tab.id === requestedTab) ? requestedTab as ProjectTab : "overview"
  );
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mutate = useCallback(
    async (action: () => Promise<void>, successMessage: string) => {
      setSaving(true);
      setMutationError(null);
      setNotice(null);
      try {
        await action();
        await onReload();
        setNotice(successMessage);
      } catch (actionError) {
        setMutationError(actionError instanceof Error ? actionError.message : "保存に失敗しました。");
      } finally {
        setSaving(false);
      }
    },
    [onReload]
  );

  return (
    <TeamWorksOperationsShell title={data.project.title}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/apps/team-works"
            aria-label="本部ダッシュボードへ戻る"
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"
          >
            <ArrowLeft size={17} />
          </Link>
          <h1 className="text-xl font-extrabold text-[var(--mikke-text)]">{data.project.title}</h1>
          <span className="rounded-full bg-[var(--mikke-primary-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--mikke-primary)]">
            運営型
          </span>
        </div>

        <nav
          aria-label={`${data.project.title}のメニュー`}
          className="-mx-4 overflow-x-auto border-b border-[var(--mikke-line)] px-4"
        >
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-3 py-2.5 text-xs font-bold transition ${
                  activeTab === tab.id
                    ? "border-[var(--mikke-accent)] text-[var(--mikke-primary)]"
                    : "border-transparent text-[var(--mikke-muted)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {mutationError ? (
          <p role="alert" className="rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">
            {mutationError}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-xl bg-[var(--mikke-primary-soft)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
            {notice}
          </p>
        ) : null}

        {activeTab === "overview" ? <OverviewTab data={data} saving={saving} mutate={mutate} onSelectTab={setActiveTab} /> : null}
        {activeTab === "schedule" ? <ScheduleTab data={data} saving={saving} mutate={mutate} /> : null}
        {activeTab === "roster" ? <RosterTab data={data} saving={saving} mutate={mutate} /> : null}
        {activeTab === "partners" ? <PartnersTab data={data} onSelectTab={setActiveTab} /> : null}
        {activeTab === "manuals" ? <ManualsTab data={data} saving={saving} mutate={mutate} /> : null}
        {activeTab === "reports" ? <ReportsTab data={data} /> : null}
        {activeTab === "portal" ? <PortalTab data={data} saving={saving} mutate={mutate} /> : null}
        {activeTab === "settings" ? <ProjectSettingsTab data={data} saving={saving} mutate={mutate} /> : null}
        {activeTab === "messages" ? <MessagesTab data={data} saving={saving} mutate={mutate} /> : null}
      </div>
    </TeamWorksOperationsShell>
  );
}

function OverviewTab({
  data,
  saving,
  mutate,
  onSelectTab
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
  onSelectTab: (tab: ProjectTab) => void;
}) {
  const labels = useTeamWorksLabels();
  const nowKey = toDateKey(new Date());
  const activeSessions = data.sessions.filter((session) => session.status !== "cancelled");
  const liveSessions = activeSessions
    .filter((session) => session.partnerPresenceStatus === "standby" || session.partnerPresenceStatus === "in_progress")
    .sort((a, b) => {
      if (a.partnerPresenceStatus !== b.partnerPresenceStatus) {
        return a.partnerPresenceStatus === "in_progress" ? -1 : 1;
      }
      return (a.sessionDate + a.startTime).localeCompare(b.sessionDate + b.startTime);
    });
  const upcoming = activeSessions.filter((session) => session.sessionDate >= nowKey);
  const todaySession = upcoming.find((session) => session.sessionDate === nowKey);
  const startOfWeek = startOfMonday(new Date());
  const endOfWeek = addDays(startOfWeek, 6);
  const weekCount = activeSessions.filter((session) => {
    const date = new Date(`${session.sessionDate}T00:00:00`);
    return date >= startOfWeek && date <= endOfWeek;
  }).length;

  return (
    <div className="space-y-6">
      {liveSessions.length > 0 ? (
        <section aria-live="polite" className="rounded-2xl border border-[var(--mikke-line)] border-l-4 border-l-[var(--tw-done)] bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 size={18} className="text-[var(--tw-on-tint)]" />
            <h2 className="text-sm font-extrabold">只今のレッスン状況</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {liveSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectTab("schedule")}
                className="flex items-center gap-3 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 text-left"
              >
                <PartnerPresenceBadge status={session.partnerPresenceStatus} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold">
                    {formatDate(session.sessionDate)} {session.startTime}〜{endTime(session.startTime, session.durationMin)}
                  </span>
                  <span className="block text-[11px] font-semibold text-[var(--mikke-muted)]">
                    担当 {session.partnerName ?? "未定"} · 名簿{session.roster.length}名
                  </span>
                </span>
                <span className="text-xs font-bold text-[var(--mikke-primary)]">確認</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => onSelectTab("schedule")}
        className="w-full rounded-2xl border border-[color-mix(in_srgb,var(--mikke-green)_55%,white)] bg-[color-mix(in_srgb,var(--mikke-green)_18%,white)] px-4 py-3 text-left transition hover:border-[var(--mikke-primary)]"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-[var(--mikke-text)]">
          <Clock3 size={16} className="text-[var(--mikke-primary)]" />
          {todaySession
            ? `今日 ${todaySession.startTime} ${data.project.title} · ${todaySession.partnerName ?? "担当未定"}`
            : "今日の予定はありません"}
        </span>
      </button>

      <ProjectCalendarPanel data={data} saving={saving} mutate={mutate} />

      <div className="grid grid-cols-3 gap-3">
        <MetricCard icon={CalendarDays} tone="blue" label="今週のコマ" value={String(weekCount)} onClick={() => onSelectTab("schedule")} />
        <MetricCard icon={Users} tone="green" label={labels.workers} value={`${data.partners.length}名`} onClick={() => onSelectTab("partners")} />
        <MetricCard icon={GraduationCap} tone="pink" label="対象者" value={`${data.participants.length}名`} onClick={() => onSelectTab("roster")} />
      </div>
      <p className="-mt-3 text-[11px] font-semibold text-[var(--mikke-muted)]">
        {labels.workers}はこのプロジェクトの参加人数、対象者はクライアント側の総登録者数です。
      </p>

      <OverviewListSection
        icon={CalendarDays}
        title="Upcoming"
        subtitle="今後のスケジュール"
        onViewAll={() => onSelectTab("schedule")}
      >
        {upcoming.length === 0 ? (
          <MikkeEmptyState title="今後の予定はありません" />
        ) : (
          upcoming.slice(0, 3).map((session) => (
            <ListRow
              key={session.id}
              title={`${formatDate(session.sessionDate)} ${session.startTime}〜${endTime(session.startTime, session.durationMin)}`}
              helper={`担当 ${session.partnerName ?? "未定"}${session.roster.length ? ` · ${session.roster.length}名` : ""} · Zoom ID ${session.zoomMeetingId ?? "未設定"}`}
              onClick={() => onSelectTab("schedule")}
            />
          ))
        )}
      </OverviewListSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <OverviewListSection
          icon={MessageSquare}
          title="Messages"
          subtitle="新着メッセージ"
          onViewAll={() => onSelectTab("messages")}
        >
          {data.comments.length === 0 ? (
            <MikkeEmptyState title="新着メッセージはありません" />
          ) : (
            data.comments.slice(0, 3).map((comment) => (
              <ListRow key={comment.id} title={comment.authorName} helper={comment.body} onClick={() => onSelectTab("messages")} />
            ))
          )}
        </OverviewListSection>

        <OverviewListSection
          icon={FileCheck2}
          title="Reports"
          subtitle="最近の報告"
          onViewAll={() => onSelectTab("reports")}
        >
          {data.reports.length === 0 ? (
            <MikkeEmptyState title="最近の報告はありません" />
          ) : (
            data.reports.slice(0, 3).map((report) => (
              <ListRow
                key={report.id}
                title={`${report.submitterName} · ${report.formName}`}
                helper={reportStatusLabel(report.status)}
                badge={reportStatusLabel(report.status)}
                onClick={() => onSelectTab("reports")}
              />
            ))
          )}
        </OverviewListSection>
      </div>

      <MikkeSection title="More" tone="editorial">
        <p className="mb-3 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">その他</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {[
            ["overview", "概要", CalendarDays],
            ["schedule", "スケジュール", CalendarDays],
            ["messages", "メッセージ", MessageSquare],
            ["partners", labels.workers, Clock3],
            ["roster", "名簿", Users],
            ["reports", "報告", FileCheck2],
            ["manuals", "マニュアル", BookOpen],
            ["portal", "ポータル設定", Settings2],
            ["settings", "プロジェクト設定", FileCheck2]
          ].map(([id, label, Icon]) => (
            <button
              key={String(id)}
              type="button"
              onClick={() => onSelectTab(id as ProjectTab)}
              className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-2 py-3 text-xs font-bold"
            >
              <Icon size={19} className="text-[var(--mikke-primary)]" />
              {String(label)}
            </button>
          ))}
        </div>
      </MikkeSection>
    </div>
  );
}

function ProjectCalendarPanel({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const labels = useTeamWorksLabels();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [adding, setAdding] = useState(false);
  const [startTime, setStartTime] = useState("13:00");
  const [finishTime, setFinishTime] = useState("14:00");
  const [partnerMemberId, setPartnerMemberId] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"once" | "weekly">("once");
  const [holidayMemo, setHolidayMemo] = useState("");
  const calendarDates = useMemo(() => monthCalendarDates(monthDate), [monthDate]);
  const sessionsByDate = useMemo(() => {
    const result = new Map<string, OperationsProjectDetailData["sessions"]>();
    data.sessions.filter((session) => session.status !== "cancelled").forEach((session) => {
      result.set(session.sessionDate, [...(result.get(session.sessionDate) ?? []), session]);
    });
    return result;
  }, [data.sessions]);
  const holidaysByDate = useMemo(() => new Map(data.holidays.map((holiday) => [holiday.holidayDate, holiday])), [data.holidays]);
  const selectedSessions = sessionsByDate.get(selectedDate) ?? [];
  const selectedHoliday = holidaysByDate.get(selectedDate);
  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const selectedJapanDayOff = getJapanDayOff(selectedDateObject);

  const selectDate = (date: Date) => {
    setSelectedDate(toDateKey(date));
    setAdding(false);
  };

  const addSession = async (event: FormEvent) => {
    event.preventDefault();
    const durationMin = durationBetweenTimes(startTime, finishTime);
    const firstDate = selectedDateObject;
    const contractEndDate = data.project.contractEndedOn
      ? new Date(`${data.project.contractEndedOn}T00:00:00`)
      : null;
    const weeksAhead = contractEndDate && contractEndDate >= firstDate
      ? Math.max(1, Math.ceil((contractEndDate.getTime() - firstDate.getTime() + 86_400_000) / (7 * 86_400_000)))
      : 12;
    await mutate(
      async () => {
        if (scheduleMode === "once") {
          await createOperationsSession(supabase, data.project.id, {
            sessionDate: selectedDate,
            startTime,
            durationMin,
            partnerMemberId: partnerMemberId || null
          });
          return;
        }
        await createOperationsScheduleRule(supabase, data.project.id, {
          weekday: firstDate.getDay(),
          startTime,
          durationMin,
          partnerMemberId: partnerMemberId || null
        });
        await generateSessionsForProject(
          supabase,
          {
            id: data.project.id,
            organizationId: data.project.organizationId,
            title: data.project.title
          },
          { fromDate: firstDate, weeksAhead }
        );
      },
      scheduleMode === "weekly"
        ? `毎週の予定を登録しました（${data.project.contractEndedOn ? "契約終了日まで" : "12週間分"}）。`
        : "予定を登録しました。"
    );
    setAdding(false);
  };

  const addHoliday = async () => {
    await mutate(
      () => createOperationsHoliday(supabase, {
        organizationId: data.project.organizationId,
        projectId: data.project.id,
        holidayDate: selectedDate,
        memo: holidayMemo
      }),
      "休講日に設定しました。同日の生成済み予定は取り消しました。"
    );
    setHolidayMemo("");
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--mikke-primary)]">Calendar</h2>
          <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">日付を押すと右側で予定詳細・登録・編集ができます。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)]">月</span>
          <span className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">週</span>
          <span className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">日</span>
        </div>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
          <div className="mb-3 flex items-center gap-2">
            <button type="button" aria-label="前の月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"><ChevronLeft size={15} /></button>
            <p className="text-sm font-extrabold">{monthDate.getFullYear()}年 {monthDate.getMonth() + 1}月</p>
            <button type="button" aria-label="次の月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"><ChevronRight size={15} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--mikke-muted)]">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDates.map((date) => {
              const key = toDateKey(date);
              const inMonth = date.getMonth() === monthDate.getMonth();
              const sessions = sessionsByDate.get(key) ?? [];
              const holiday = holidaysByDate.get(key);
              const japanDayOff = getJapanDayOff(date);
              return <button key={key} type="button" onClick={() => selectDate(date)} className={`min-h-16 rounded-lg border p-1.5 text-left ${
                key === selectedDate
                  ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)]"
                  : japanDayOff.isDayOff
                    ? "border-[var(--mikke-pink)] bg-[var(--mikke-pink)]"
                    : "border-[var(--mikke-line)] bg-white"
              } ${inMonth ? "" : "opacity-40"}`}>
                <span className="block text-[10px] font-bold">{date.getDate()}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {sessions.slice(0, 2).map((session) => (
                    <span
                      key={session.id}
                      className={`rounded px-1 py-0.5 text-[8px] font-bold ${
                        session.partnerPresenceStatus === "in_progress"
                          ? "bg-[var(--tw-done)] text-[var(--tw-on-tint)]"
                          : session.partnerPresenceStatus === "standby"
                            ? "bg-[var(--tw-planned)] text-[var(--tw-on-tint)]"
                            : "bg-[var(--mikke-primary)] text-white"
                      }`}
                    >
                      {session.startTime}
                      {session.partnerPresenceStatus === "standby"
                        ? " スタンバイ"
                        : session.partnerPresenceStatus === "in_progress"
                          ? " 実施中"
                          : ""}
                    </span>
                  ))}
                  {sessions.length >= 3 ? <span className="rounded bg-[var(--mikke-yellow)] px-1 py-0.5 text-[8px] font-extrabold text-[var(--tw-on-tint)]">全{sessions.length}件</span> : null}
                  {holiday ? <span className="rounded bg-[var(--mikke-pink)] px-1 py-0.5 text-[8px] font-bold">休講</span> : null}
                  {!holiday && japanDayOff.isDayOff ? <span title={japanDayOff.label ?? undefined} className="truncate rounded bg-[var(--mikke-pink)] px-1 py-0.5 text-[8px] font-bold text-[var(--tw-on-tint)]">{japanDayOff.isNationalHoliday ? japanDayOff.label : "休校"}</span> : null}
                </span>
              </button>;
            })}
          </div>
          <p className="mt-3 text-[10px] font-semibold text-[var(--mikke-muted)]"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[var(--mikke-primary)]" />予定 <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm border border-[var(--mikke-pink)] bg-[var(--mikke-pink)]" />休講・土日祝 <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-[var(--mikke-yellow)]" />{labels.workers}稼働可能日（接続準備中）</p>
        </div>
        <aside className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
          <h3 className="text-sm font-extrabold">{formatDate(selectedDate)} の予定詳細</h3>
          {selectedJapanDayOff.isDayOff ? (
            <p className="mt-3 rounded-xl bg-[var(--mikke-pink)] px-3 py-2 text-xs font-bold text-[var(--tw-on-tint)]">
              休校日{selectedJapanDayOff.isNationalHoliday && selectedJapanDayOff.label ? `（${selectedJapanDayOff.label}）` : ""}
            </p>
          ) : null}
          <div className="mt-3 space-y-2">
            {selectedSessions.map((session) => <CalendarSessionEditor key={session.id} session={session} partners={data.partners} saving={saving} mutate={mutate} />)}
            {selectedHoliday ? <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs"><span><b>休講</b>{selectedHoliday.memo ? `　${selectedHoliday.memo}` : ""}</span><button type="button" disabled={saving} onClick={() => void mutate(() => deleteOperationsHoliday(supabase, selectedHoliday.id), "休講日を削除しました。")} className="rounded-lg border border-[var(--tw-action)] px-2 py-1 font-bold text-[var(--tw-action)]">削除</button></div> : null}
          </div>
          {!selectedJapanDayOff.isDayOff && adding ? <form onSubmit={addSession} className="mt-3 space-y-2 rounded-xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
            <p className="text-xs font-extrabold">この日に予定を追加</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-bold text-[var(--mikke-muted)]">開始時間<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={teamWorksProjectInputClass} /></label>
              <label className="text-[11px] font-bold text-[var(--mikke-muted)]">終了時間<input type="time" value={finishTime} onChange={(event) => setFinishTime(event.target.value)} className={teamWorksProjectInputClass} /></label>
            </div>
            <fieldset>
              <legend className="mb-1 text-[11px] font-bold text-[var(--mikke-muted)]">繰り返し</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-xs font-bold ${scheduleMode === "once" ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]" : "border-[var(--mikke-line)] bg-white"}`}>
                  <input type="radio" name="schedule-mode" value="once" checked={scheduleMode === "once"} onChange={() => setScheduleMode("once")} className="sr-only" />
                  今回のみ
                </label>
                <label className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-xs font-bold ${scheduleMode === "weekly" ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]" : "border-[var(--mikke-line)] bg-white"}`}>
                  <input type="radio" name="schedule-mode" value="weekly" checked={scheduleMode === "weekly"} onChange={() => setScheduleMode("weekly")} className="sr-only" />
                  毎週
                </label>
              </div>
              {scheduleMode === "weekly" ? (
                <p className="mt-1.5 text-[10px] font-semibold text-[var(--mikke-muted)]">
                  毎週{weekdayLabel(selectedDateObject.getDay())}曜日として、{data.project.contractEndedOn ? `契約終了日（${formatDate(data.project.contractEndedOn)}）まで` : "12週間分"}を作成します。
                </p>
              ) : null}
            </fieldset>
            <select value={partnerMemberId} onChange={(event) => setPartnerMemberId(event.target.value)} className={teamWorksProjectInputClass}><option value="">担当未定</option>{data.partners.map((partner) => <option key={partner.memberId} value={partner.memberId}>{partner.displayName}</option>)}</select>
            <button disabled={saving} className="rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)]">{scheduleMode === "weekly" ? "毎週の予定を登録" : "登録"}</button>
          </form> : !selectedJapanDayOff.isDayOff ? <button type="button" onClick={() => setAdding(true)} className="mt-3 w-full rounded-xl border border-dashed border-[var(--mikke-line)] px-3 py-3 text-xs font-bold text-[var(--mikke-primary)]">＋ 予定追加</button> : null}
          {!selectedHoliday ? <div className="mt-2 flex gap-2"><input value={holidayMemo} onChange={(event) => setHolidayMemo(event.target.value)} placeholder="休講メモ（任意）" className={teamWorksProjectInputClass} /><button type="button" disabled={saving} onClick={() => void addHoliday()} className="shrink-0 rounded-lg border border-[var(--mikke-line)] px-2 text-xs font-bold">休講</button></div> : null}
        </aside>
      </div>
    </section>
  );
}

function CalendarSessionEditor({ session, partners, saving, mutate, dateLabel }: { session: OperationsProjectDetailData["sessions"][number]; partners: OperationsProjectDetailData["partners"]; saving: boolean; mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>; dateLabel?: string }) {
  const labels = useTeamWorksLabels();
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState(session.startTime);
  const [finishTime, setFinishTime] = useState(endTime(session.startTime, session.durationMin));
  const [partnerMemberId, setPartnerMemberId] = useState(session.partnerMemberId ?? "");
  const [useProjectDefault, setUseProjectDefault] = useState(session.zoomUsesProjectDefault);
  const [zoomUrl, setZoomUrl] = useState(session.zoomUrl ?? "");
  const [zoomMeetingId, setZoomMeetingId] = useState(session.zoomMeetingId ?? "");
  const [zoomPasscode, setZoomPasscode] = useState(session.zoomPasscode ?? "");
  const isPast = session.sessionDate < toDateKey(new Date());

  return (
    <div className="rounded-xl border border-[var(--mikke-line)] p-3">
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left text-xs font-bold">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2"><span><span className={dateLabel ? "mr-2 text-[var(--mikke-primary)] underline decoration-[var(--mikke-line)] underline-offset-4" : ""}>{dateLabel}</span>{session.startTime}〜{endTime(session.startTime, session.durationMin)}　担当 {session.partnerName ?? "未定"}　名簿{session.roster.length}名</span><PartnerPresenceBadge status={session.partnerPresenceStatus} /></span>
            <span className="mt-1 block text-[11px] font-semibold text-[var(--mikke-muted)]">Zoom ID：{session.zoomMeetingId ?? "未設定"}</span>
          </span>
          <span className="shrink-0 text-[var(--mikke-primary)]">{open ? "閉じる" : "編集"}</span>
        </button>
        {session.zoomUrl ? (
          <a
            href={session.zoomUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-[var(--mikke-primary)] px-2 py-1 text-[11px] font-bold text-[var(--mikke-primary)]"
          >
            Zoomを開く
          </a>
        ) : null}
        {session.status !== "completed" ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (!window.confirm(`${formatDate(session.sessionDate)} ${session.startTime}の予定を削除しますか？`)) return;
              void mutate(() => cancelOperationsSession(supabase, session.id), "予定を削除しました。");
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--tw-action)] px-2 py-1 text-[11px] font-bold text-[var(--tw-action)]"
          >
            <Trash2 size={13} />削除
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-3 space-y-4">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-bold text-[var(--mikke-muted)]">開始時間<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={teamWorksProjectInputClass} aria-label="開始時間" /></label>
              <label className="text-[11px] font-bold text-[var(--mikke-muted)]">終了時間<input type="time" value={finishTime} onChange={(event) => setFinishTime(event.target.value)} className={teamWorksProjectInputClass} aria-label="終了時間" /></label>
            </div>
            <select value={partnerMemberId} onChange={(event) => setPartnerMemberId(event.target.value)} className={teamWorksProjectInputClass} aria-label={`担当${labels.workers}`}><option value="">担当未定</option>{partners.map((partner) => <option key={partner.memberId} value={partner.memberId}>{partner.displayName}</option>)}</select>
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => void mutate(() => updateOperationsSession(supabase, session.id, { sessionDate: session.sessionDate, startTime, durationMin: durationBetweenTimes(startTime, finishTime), partnerMemberId: partnerMemberId || null }), "予定を更新しました。")} className="rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)]">予定を保存</button>
              {session.generatedFromRuleId ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (!window.confirm("この毎週設定を停止し、本日以降に生成済みの予定をまとめて削除しますか？過去の実施記録は残ります。")) return;
                    void mutate(
                      async () => { await archiveOperationsScheduleRuleAndCancelFutureSessions(supabase, session.generatedFromRuleId!, toDateKey(new Date())); },
                      "毎週設定を停止し、今後の予定をまとめて削除しました。"
                    );
                  }}
                  className="rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]"
                >
                  毎週分を一括削除
                </button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 border-t border-[var(--mikke-line)] pt-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--mikke-primary)]"><Video size={14} />この回のZoom</p>
            {session.zoomUrl ? <a href={session.zoomUrl} target="_blank" rel="noreferrer" className="block truncate text-xs font-bold text-[var(--mikke-primary)] underline underline-offset-2">現在のZoomを開く</a> : <p className="text-xs font-semibold text-[var(--mikke-muted)]">Zoomはまだ設定されていません。</p>}
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={useProjectDefault} disabled={isPast} onChange={(event) => setUseProjectDefault(event.target.checked)} />プロジェクト既定を使う</label>
            {!useProjectDefault ? (
              <div className="grid gap-2">
                <input type="url" value={zoomUrl} disabled={isPast} onChange={(event) => setZoomUrl(event.target.value)} placeholder="Zoom URL" className={teamWorksProjectInputClass} />
                <div className="grid gap-2 sm:grid-cols-2"><input value={zoomMeetingId} disabled={isPast} onChange={(event) => setZoomMeetingId(event.target.value)} placeholder="ミーティングID" className={teamWorksProjectInputClass} /><input value={zoomPasscode} disabled={isPast} onChange={(event) => setZoomPasscode(event.target.value)} placeholder="パスコード" className={teamWorksProjectInputClass} /></div>
              </div>
            ) : null}
            {isPast ? <p className="text-[11px] font-semibold text-[var(--mikke-muted)]">過去回のZoom情報は変更できません。</p> : <button type="button" disabled={saving} onClick={() => void mutate(() => updateOperationsSessionZoom(supabase, session.id, { useProjectDefault, zoomUrl, zoomMeetingId, zoomPasscode }), "この回のZoom設定を更新しました。")} className="rounded-lg border border-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">Zoom設定を保存</button>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleTab({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const upcoming = data.sessions.filter(
    (session) => session.status !== "cancelled" && session.sessionDate >= toDateKey(new Date())
  );
  return (
    <div className="space-y-5">
      <TabIntro icon={CalendarDays} title="スケジュール" description="このプロジェクト専用の予定です。週次パターンから生成されたコマもまとめて確認できます。" />
      <MikkeSection title="Weekly rules" tone="editorial">
        {data.rules.length === 0 ? (
          <MikkeEmptyState title="週次パターンはまだありません" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.rules.map((rule) => (
              <article key={rule.id} className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold">毎週 {weekdayLabel(rule.weekday)} {rule.startTime}〜{endTime(rule.startTime, rule.durationMin)}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">担当 {rule.partnerName ?? "未定"} ／ {rule.durationMin}分</p>
                  </div>
                  <span className="rounded-full bg-[var(--mikke-green)] px-2 py-1 text-[10px] font-bold">{rule.status === "active" ? "有効" : "一時停止"}</span>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (!window.confirm("この毎週設定を停止し、本日以降に生成済みの予定をまとめて削除しますか？過去の実施記録は残ります。")) return;
                    void mutate(
                      async () => { await archiveOperationsScheduleRuleAndCancelFutureSessions(supabase, rule.id, toDateKey(new Date())); },
                      "毎週設定を停止し、今後の予定をまとめて削除しました。"
                    );
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]"
                >
                  <Trash2 size={14} />毎週分を一括削除
                </button>
              </article>
            ))}
          </div>
        )}
      </MikkeSection>
      <MikkeSection title="Upcoming" tone="editorial">
        {upcoming.length === 0 ? (
          <MikkeEmptyState title="今後のコマはありません" />
        ) : (
          <div className="space-y-2">
            {upcoming.slice(0, 30).map((session) => (
              <CalendarSessionEditor
                key={session.id}
                session={session}
                partners={data.partners}
                saving={saving}
                mutate={mutate}
                dateLabel={formatDate(session.sessionDate)}
              />
            ))}
          </div>
        )}
      </MikkeSection>
    </div>
  );
}

function RosterTab({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const [participantName, setParticipantName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [level, setLevel] = useState("");
  const [cautions, setCautions] = useState("");
  const groupNameById = new Map(data.groups.map((group) => [group.id, group.name]));
  const nextSession = data.sessions.find(
    (session) => session.status === "scheduled" && session.sessionDate >= toDateKey(new Date())
  );

  async function submitParticipant(event: FormEvent) {
    event.preventDefault();
    if (!participantName.trim()) return;
    await mutate(
      () =>
        createOperationsParticipant(supabase, data.project.id, {
          name: participantName,
          groupId: groupId || null,
          level,
          cautions
        }),
      "名簿に追加しました。"
    );
    setParticipantName("");
    setLevel("");
    setCautions("");
  }

  return (
    <div className="space-y-5">
      <TabIntro icon={Users} title="名簿" description="紙の名簿から対象者を追加し、グループと進捗を確認します。グループの作成・編集はクライアントポータルで行います。" />
      {nextSession ? (
        <MikkeSection title="Next roster" tone="editorial">
          <p className="mb-3 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">
            {formatDate(nextSession.sessionDate)} {nextSession.startTime} · {nextSession.partnerName ?? "担当未定"}
          </p>
          {nextSession.roster.length === 0 ? (
            <MikkeEmptyState title="このコマの名簿はまだありません" helper="出席順①②③は、コマ編集機能で設定予定です。" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {nextSession.roster.map((entry) => (
                <InfoCard
                  key={entry.id}
                  title={`${orderNumber(entry.orderIndex)} ${entry.participantName}`}
                  helper={attendanceLabel(entry.attendanceStatus)}
                />
              ))}
            </div>
          )}
        </MikkeSection>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <MikkeSection title="Participants" tone="editorial">
          <div className="mb-3 flex flex-wrap gap-2">
            {data.groups.map((group) => (
              <span key={group.id} className="rounded-full bg-[var(--mikke-primary-soft)] px-3 py-1 text-xs font-bold text-[var(--mikke-primary)]">
                {group.name}
              </span>
            ))}
          </div>
          {data.participants.length === 0 ? (
            <MikkeEmptyState title="名簿はまだ空です" />
          ) : (
            <div className="divide-y divide-[var(--mikke-line)] overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
              {data.participants.map((participant) => (
                <div key={participant.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]">
                    <GraduationCap size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{participant.name}</span>
                    <span className="block text-xs font-semibold text-[var(--mikke-muted)]">
                      {participant.groupId ? groupNameById.get(participant.groupId) ?? "グループ" : "グループ未設定"}
                      {participant.level ? ` ／ ${participant.level}` : ""}
                    </span>
                    {participant.cautions ? (
                      <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--mikke-orange)]">
                        <AlertTriangle size={12} /> {participant.cautions}
                      </span>
                    ) : null}
                  </span>
                  <label className="flex items-center gap-2 text-xs font-bold">
                    進捗
                    <input
                      type="number"
                      min={1}
                      defaultValue={participant.currentManualNo}
                      disabled={saving}
                      onBlur={(event) => {
                        const value = Number(event.currentTarget.value);
                        if (Number.isFinite(value) && value !== participant.currentManualNo) {
                          void mutate(
                            () => updateOperationsParticipantProgress(supabase, participant.id, value),
                            `${participant.name}さんの進捗を更新しました。`
                          );
                        }
                      }}
                      className="w-16 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-center text-sm"
                    />
                    番
                  </label>
                </div>
              ))}
            </div>
          )}
        </MikkeSection>

        <div className="space-y-4">
          <form onSubmit={submitParticipant} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-extrabold">
              <Plus size={16} className="text-[var(--mikke-primary)]" /> 名簿に追加
            </h3>
            <TeamWorksProjectField label="名前" required className="mt-3">
              <input value={participantName} onChange={(event) => setParticipantName(event.target.value)} className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
            <TeamWorksProjectField label="グループ" className="mt-3">
              <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className={teamWorksProjectInputClass}>
                <option value="">未設定</option>
                {data.groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </TeamWorksProjectField>
            <TeamWorksProjectField label="レベル" className="mt-3">
              <input value={level} onChange={(event) => setLevel(event.target.value)} className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
            <TeamWorksProjectField label="注意事項" className="mt-3">
              <textarea value={cautions} onChange={(event) => setCautions(event.target.value)} rows={2} className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
            <SaveButton saving={saving} label="名簿に追加" />
          </form>
        </div>
      </div>
    </div>
  );
}

function PartnersTab({ data, onSelectTab }: { data: OperationsProjectDetailData; onSelectTab: (tab: ProjectTab) => void }) {
  const labels = useTeamWorksLabels();
  const [members, setMembers] = useState<OperationsProjectMember[]>([]);
  const [allProjectMembers, setAllProjectMembers] = useState<OperationsProjectMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<OperationsPendingInvite[]>([]);
  const [directory, setDirectory] = useState<OperationsPartnerDirectoryEntry[]>([]);
  const [partnerSettings, setPartnerSettings] = useState<OperationsProjectPartnerSetting[]>([]);
  const [partnerOffers, setPartnerOffers] = useState<OperationsProjectPartnerOffer[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [pendingOpen, setPendingOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reloadMembers = useCallback(async () => {
    setError(null);
    try {
      const [memberResult, partnerDirectory, settings, offers] = await Promise.all([
        loadOperationsProjectMembers(supabase, data.project.id),
        loadOperationsPartnerDirectory(supabase),
        loadOperationsProjectPartnerSettings(supabase, data.project.id),
        loadOperationsProjectPartnerOffers(supabase, data.project.id)
      ]);
      const removedMemberIds = new Set(settings.filter((setting) => setting.status === "removed").map((setting) => setting.organizationMemberId));
      const waitingMemberIds = new Set(offers.filter((offer) => offer.status !== "accepted").map((offer) => offer.organizationMemberId));
      setAllProjectMembers(memberResult.members);
      setMembers(memberResult.members.filter((member) => member.projectRole === "worker" && member.status !== "archived" && !removedMemberIds.has(member.organizationMemberId) && !waitingMemberIds.has(member.organizationMemberId)));
      setPendingInvites(memberResult.pendingInvites.filter((invite) => invite.role === "worker"));
      setDirectory(partnerDirectory);
      setPartnerSettings(settings);
      setPartnerOffers(offers);
      setPartnerId((current) => current || partnerDirectory[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `${labels.workers}情報を読み込めませんでした。`);
    }
  }, [data.project.id]);

  useEffect(() => {
    void reloadMembers();
  }, [reloadMembers]);

  async function submitPartner(event: FormEvent) {
    event.preventDefault();
    if (!partnerId) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await addOperationsPartnerToProject(supabase, { projectId: data.project.id, partnerId });
      if (result.status === "pending_approval") {
        setMessage(`${result.displayName} さんへ参加依頼を送りました。${labels.workers}ポータルで承認されるまで Members には表示されません。`);
        setPendingOpen(true);
      } else if (result.status === "assigned") {
        setMessage(`${result.displayName} さんをこのプロジェクトに追加しました。${labels.workers}ポータルには、このプロジェクトが表示されます。`);
      } else {
        setMessage(`${result.email} さんはまだポータルにログインしていません。「${labels.workers}管理」の固定URLを渡してログインしてもらうと開通し、その後この追加が有効になります。`);
        setPendingOpen(true);
      }
      await reloadMembers();
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : `${labels.workers}をプロジェクトに追加できませんでした。`);
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(invite: OperationsPendingInvite) {
    setBusy(true);
    setMessage("");
    try {
      await revokeOperationsProjectInvite(supabase, invite.id);
      setMessage(`${invite.email} への参加依頼を削除しました。`);
      await reloadMembers();
    } catch (revokeError) {
      setMessage(revokeError instanceof Error ? revokeError.message : "参加依頼を削除できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function savePartnerSetting(member: OperationsProjectMember, hourlyWage: number | null) {
    setBusy(true);
    setMessage("");
    try {
      await updateOperationsProjectPartnerSetting(supabase, {
        projectId: data.project.id,
        organizationMemberId: member.organizationMemberId,
        hourlyWage,
        status: "active"
      });
      setMessage(`${member.displayName}さんのこのプロジェクト内の時給を保存しました。`);
      await reloadMembers();
    } catch (settingError) {
      setMessage(settingError instanceof Error ? settingError.message : `${labels.workers}設定を保存できませんでした。`);
    } finally {
      setBusy(false);
    }
  }

  async function removePartner(member: OperationsProjectMember) {
    if (!window.confirm(`${member.displayName}さんをこのプロジェクトから外しますか？ 過去の予定・メッセージは残ります。`)) return;
    setBusy(true);
    setMessage("");
    try {
      const current = partnerSettings.find((setting) => setting.organizationMemberId === member.organizationMemberId);
      await updateOperationsProjectPartnerOffer(supabase, {
        projectId: data.project.id,
        organizationMemberId: member.organizationMemberId,
        status: "removed"
      });
      await updateOperationsProjectPartnerSetting(supabase, {
        projectId: data.project.id,
        organizationMemberId: member.organizationMemberId,
        hourlyWage: current?.hourlyWage ?? null,
        status: "removed"
      });
      setMessage(`${member.displayName}さんをこのプロジェクトから外しました。`);
      await reloadMembers();
    } catch (removeError) {
      setMessage(removeError instanceof Error ? removeError.message : `${labels.workers}をプロジェクトから外せませんでした。`);
    } finally {
      setBusy(false);
    }
  }

  const currentMonthKey = toDateKey(new Date()).slice(0, 7);
  const assignedSessionsByMemberId = useMemo(() => {
    const map = new Map<string, OperationsProjectDetailData["sessions"]>();
    for (const session of data.sessions) {
      if (!session.partnerMemberId || session.status === "cancelled" || !session.sessionDate.startsWith(currentMonthKey)) continue;
      const list = map.get(session.partnerMemberId) ?? [];
      list.push(session);
      map.set(session.partnerMemberId, list);
    }
    return map;
  }, [data.sessions, currentMonthKey]);
  const payoutsByMemberId = useMemo(() => {
    const map = new Map<string, number>();
    for (const payout of data.payouts) {
      const dueOrCurrent = payout.dueOn ?? toDateKey(new Date());
      if (!dueOrCurrent.startsWith(currentMonthKey)) continue;
      map.set(payout.payeeMemberId, (map.get(payout.payeeMemberId) ?? 0) + payout.amount);
    }
    return map;
  }, [data.payouts, currentMonthKey]);
  // Offers for an archived member are dead ends the member can never respond
  // to (they no longer have portal access) — hide them instead of leaving a
  // "承認待ち" ghost that archiving the partner directory can't clear.
  const pendingOffers = partnerOffers.filter((offer) => {
    if (offer.status !== "pending") return false;
    const member = allProjectMembers.find((item) => item.organizationMemberId === offer.organizationMemberId);
    return member?.status !== "archived";
  });

  async function cancelOffer(organizationMemberId: string) {
    setBusy(true);
    setMessage("");
    try {
      await updateOperationsProjectPartnerOffer(supabase, { projectId: data.project.id, organizationMemberId, status: "removed" });
      setMessage("参加依頼をキャンセルしました。");
      await reloadMembers();
    } catch (cancelError) {
      setMessage(cancelError instanceof Error ? cancelError.message : "参加依頼をキャンセルできませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <TabIntro
        icon={Clock3}
        title={labels.workers}
        description={`登録済み${labels.workers}をプロジェクトに追加します。開通済みの人は招待リンクなしで参加、未開通の人だけ Pending invites に残します。`}
      />

      <MikkeSection title="Invite" tone="editorial">
        <form onSubmit={submitPartner} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <TeamWorksProjectField label={`追加する${labels.workers}`} required>
            <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)} className={teamWorksProjectInputClass}>
              {directory.filter((partner) => partner.status === "active").map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.displayName} / {partner.email}
                </option>
              ))}
            </select>
          </TeamWorksProjectField>
          <button
            type="submit"
            disabled={busy || !partnerId}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:opacity-50"
          >
            <Plus size={15} /> プロジェクトに追加
          </button>
        </form>
        {directory.length === 0 ? (
          <p className="mt-3 text-xs font-bold text-[var(--mikke-muted)]">
            先に左メニューの「{labels.workers}管理」で名簿登録してください。
          </p>
        ) : null}
        {message ? (
          <p role="status" className="mt-3 text-xs font-bold leading-5 text-[var(--mikke-muted)]">{message}</p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p>
        ) : null}
      </MikkeSection>

      <MikkeSection title="Pending invites" tone="editorial">
        <button
          type="button"
          onClick={() => setPendingOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-extrabold">ポータル未開通 / 参加依頼中</span>
            <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">
              {pendingInvites.length + pendingOffers.length === 0 ? `参加依頼中の${labels.workers}はいません` : `${pendingInvites.length + pendingOffers.length}件の参加依頼があります`}
            </span>
          </span>
          <span className="rounded-full bg-[var(--mikke-primary-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--mikke-primary)]">
            {pendingOpen ? "閉じる" : "展開"}
          </span>
        </button>
        {pendingOpen ? (
          pendingInvites.length + pendingOffers.length === 0 ? (
            <MikkeEmptyState title={`参加依頼中の${labels.workers}はいません`} />
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {pendingOffers.map((offer) => {
                const member = allProjectMembers.find((item) => item.organizationMemberId === offer.organizationMemberId) ?? data.partners.find((item) => item.memberId === offer.organizationMemberId);
                return (
                  <div key={offer.organizationMemberId} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--mikke-line)] bg-white px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{member?.displayName ?? labels.workers}</p>
                      <p className="text-[11px] font-semibold text-[var(--mikke-muted)]">{labels.workers}ポータルで承認待ち</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void cancelOffer(offer.organizationMemberId)}
                      className="shrink-0 rounded-lg border border-[var(--tw-action)] px-2 py-1 text-[11px] font-bold text-[var(--tw-action)] disabled:opacity-50"
                    >
                      キャンセル
                    </button>
                  </div>
                );
              })}
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--mikke-line)] bg-white px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{invite.email}</p>
                    <p className="text-[11px] font-semibold text-[var(--mikke-muted)]">未ログイン・「{labels.workers}管理」の固定URLでログインすると開通します</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revokeInvite(invite)}
                    className="shrink-0 rounded-lg border border-[var(--tw-action)] px-2 py-1 text-[11px] font-bold text-[var(--tw-action)] disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )
        ) : null}
      </MikkeSection>

      <MikkeSection title="Members" tone="editorial">
        {members.length === 0 ? (
          <MikkeEmptyState title="参加メンバーはまだいません" helper={`上のフォームから登録済み${labels.workers}を追加できます。`} />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {members.map((member) => (
              <PartnerMemberCard
                key={member.organizationMemberId}
                member={member}
                hourlyWage={partnerSettings.find((setting) => setting.organizationMemberId === member.organizationMemberId)?.hourlyWage ?? null}
                monthlyPayout={payoutsByMemberId.get(member.organizationMemberId) ?? 0}
                assignedSessions={assignedSessionsByMemberId.get(member.organizationMemberId) ?? []}
                onOpenMessages={() => onSelectTab("messages")}
                saving={busy}
                onSaveHourlyWage={(hourlyWage) => void savePartnerSetting(member, hourlyWage)}
                onRemove={() => void removePartner(member)}
              />
            ))}
          </div>
        )}
      </MikkeSection>

    </div>
  );
}

function PartnerMemberCard({
  member,
  hourlyWage,
  monthlyPayout,
  assignedSessions,
  onOpenMessages,
  saving,
  onSaveHourlyWage,
  onRemove
}: {
  member: OperationsProjectMember;
  hourlyWage: number | null;
  monthlyPayout: number;
  assignedSessions: OperationsProjectDetailData["sessions"];
  onOpenMessages: () => void;
  saving: boolean;
  onSaveHourlyWage: (hourlyWage: number | null) => void;
  onRemove: () => void;
}) {
  const labels = useTeamWorksLabels();
  const [open, setOpen] = useState(false);
  const [hourlyWageValue, setHourlyWageValue] = useState(hourlyWage === null ? "" : String(hourlyWage));

  useEffect(() => {
    setHourlyWageValue(hourlyWage === null ? "" : String(hourlyWage));
  }, [hourlyWage]);

  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold">{member.displayName}</span>
          <span className="mt-1 block text-[11px] font-semibold text-[var(--mikke-muted)]">{member.status === "active" ? "稼働中" : "停止中"}</span>
        </span>
        <span className="rounded-full bg-[var(--mikke-primary-soft)] px-2 py-1 text-[11px] font-bold text-[var(--mikke-primary)]">
          {open ? "閉じる" : "詳細"}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-[var(--mikke-line)] pt-3 text-xs font-semibold text-[var(--mikke-muted)]">
          <div className="grid gap-2 md:grid-cols-2">
            <p>メール：{member.email ?? "未登録"}</p>
            <p>当月報酬額：{formatCurrency(monthlyPayout)}</p>
            <p>締め日：企業設定で編集</p>
          </div>
          <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-3">
            <label className="block text-[11px] font-bold tracking-[0.16em] text-[var(--mikke-primary)]" htmlFor={`hourly-wage-${member.organizationMemberId}`}>このプロジェクト内の時給</label>
            <div className="mt-2 flex items-center gap-2"><input id={`hourly-wage-${member.organizationMemberId}`} type="number" min={0} value={hourlyWageValue} onChange={(event) => setHourlyWageValue(event.target.value)} placeholder="未設定" className={teamWorksProjectInputClass} /><span className="shrink-0">円 / 時間</span><button type="button" disabled={saving} onClick={() => onSaveHourlyWage(hourlyWageValue.trim() ? Number(hourlyWageValue) : null)} className="shrink-0 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:opacity-50">保存</button></div>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] text-[var(--mikke-primary)]">担当日1カ月分</p>
            {assignedSessions.length === 0 ? (
              <p className="mt-1">今月の担当日はありません。</p>
            ) : (
              <div className="mt-2 grid gap-1">
                {assignedSessions.map((session) => (
                  <p key={session.id} className="rounded-lg bg-[var(--mikke-surface)] px-2 py-1">
                    {formatDate(session.sessionDate)} {session.startTime}〜
                  </p>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] text-[var(--mikke-primary)]">稼働可能日1カ月分</p>
            <p className="mt-1">未接続です。後ほど{labels.workers}登録ページ側で整理します。</p>
          </div>
          <button
            type="button"
            onClick={onOpenMessages}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]"
          >
            <MessageSquare size={14} /> メッセージを見る
          </button>
          <button type="button" disabled={saving} onClick={onRemove} className="ml-2 inline-flex rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)] disabled:opacity-50">プロジェクトから外す</button>
        </div>
      ) : null}
    </div>
  );
}

function ManualsTab({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const labels = useTeamWorksLabels();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualNo, setManualNo] = useState(data.manuals.length ? Math.max(...data.manuals.map((manual) => manual.no)) + 1 : 1);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");

  function edit(manual?: OperationsProjectDetailData["manuals"][number]) {
    setEditingId(manual?.id ?? null);
    setManualNo(manual?.no ?? (data.manuals.length ? Math.max(...data.manuals.map((item) => item.no)) + 1 : 1));
    setTitle(manual?.title ?? "");
    setBody(manual?.body ?? "");
    setMaterialUrl(manual?.materialUrl ?? "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const editingManual = data.manuals.find((manual) => manual.id === editingId);
    if (editingManual) {
      await mutate(
        () => updateOperationsManual(supabase, editingManual.id, {
          title,
          body,
          materialUrl,
          questions: editingManual.questions.filter((value): value is string => typeof value === "string"),
          expressions: editingManual.expressions.filter((value): value is string => typeof value === "string"),
          cautions: editingManual.cautions ?? ""
        }),
        "マニュアルを更新しました。"
      );
    } else {
      await mutate(
        () => createOperationsManual(supabase, data.project.id, { no: manualNo, title, body, materialUrl }),
        "マニュアルを追加しました。"
      );
    }
    edit();
  }

  return (
    <div className="space-y-5">
      <TabIntro icon={BookOpen} title="マニュアル" description="共通雛形から複製した内容を、このプロジェクト専用に育てます。" />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <MikkeSection title="Manuals" tone="editorial">
          {data.manuals.length === 0 ? (
            <MikkeEmptyState title="マニュアルはまだありません" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.manuals.map((manual) => (
                <button
                  key={manual.id}
                  type="button"
                  onClick={() => edit(manual)}
                  className={`rounded-2xl border p-4 text-left ${editingId === manual.id ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)]" : "border-[var(--mikke-line)] bg-white"}`}
                >
                  <span className="text-sm font-extrabold">{manual.no}番 · {manual.title}</span>
                  <span className="mt-2 block text-xs font-semibold text-[var(--mikke-muted)]">{manual.body ? "本文あり" : "本文なし"} ／ {manual.materialUrl ? "教材リンクあり" : "教材なし"}</span>
                  <span className="mt-2 block text-[11px] font-bold text-[var(--mikke-primary)]">編集する</span>
                </button>
              ))}
            </div>
          )}
        </MikkeSection>
        <form onSubmit={submit} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold">
            <Plus size={16} className="text-[var(--mikke-primary)]" /> {editingId ? "マニュアル編集" : "マニュアル追加"}
          </h3>
          <TeamWorksProjectField label="番号" required className="mt-3">
            <input type="number" min={1} value={manualNo} disabled={Boolean(editingId)} onChange={(event) => setManualNo(Number(event.target.value))} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="タイトル" required className="mt-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="本文" helper={`${labels.workers}ポータルのセクションタブに表示します。`} className="mt-3">
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="教材リンク" helper="任意。ファイル教材はprivate storage対応時に追加します。" className="mt-3">
            <input type="url" value={materialUrl} onChange={(event) => setMaterialUrl(event.target.value)} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <SaveButton saving={saving} label={editingId ? "マニュアルを更新" : "マニュアルを追加"} />
          {editingId ? <button type="button" onClick={() => edit()} className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">編集を取り消す</button> : null}
        </form>
      </div>
    </div>
  );
}

function ReportsTab({ data }: { data: OperationsProjectDetailData }) {
  const labels = useTeamWorksLabels();
  return (
    <div className="space-y-5">
      <TabIntro icon={FileCheck2} title="報告" description="既存のフォーム提出を、運営型プロジェクトの報告としてまとめて表示します。" />
      {data.reports.length === 0 ? (
        <MikkeEmptyState title="報告はまだありません" helper={`R4の${labels.workers}ポータルから授業・業務報告を提出すると、ここに表示されます。`} />
      ) : (
        <div className="divide-y divide-[var(--mikke-line)] overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
          {data.reports.map((report) => (
            <ListRow
              key={report.id}
              title={`${report.submitterName} · ${report.formName}`}
              helper={formatDateTime(report.submittedAt ?? report.updatedAt)}
              badge={reportStatusLabel(report.status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PayoutsTab({ data }: { data: OperationsProjectDetailData }) {
  const labels = useTeamWorksLabels();
  const total = data.payouts.reduce((sum, payout) => sum + payout.amount, 0);
  return (
    <div className="space-y-5">
      <TabIntro icon={CircleDollarSign} title="報酬" description={`${labels.workers}への報酬記録です。本部だけが全体を確認できます。`} />
      <FinanceSummary label="記録合計" amount={total} enabled={data.project.payoutsEnabled} />
      {data.payouts.length === 0 ? (
        <MikkeEmptyState title="報酬記録はまだありません" />
      ) : (
        <div className="divide-y divide-[var(--mikke-line)] overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
          {data.payouts.map((payout) => (
            <ListRow
              key={payout.id}
              title={`${payout.payeeName} · ${formatCurrency(payout.amount)}`}
              helper={payout.dueOn ? `支払予定 ${formatDate(payout.dueOn)}` : payout.note ?? "支払日未設定"}
              badge={financeStatusLabel(payout.status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InvoicesTab({ data }: { data: OperationsProjectDetailData }) {
  const total = data.invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  return (
    <div className="space-y-5">
      <TabIntro icon={Landmark} title="請求" description="振込額ベースの請求記録です。会計ソフトではなく、現場確認に必要な範囲だけを扱います。" />
      <FinanceSummary label="請求合計" amount={total} enabled={data.project.invoicesEnabled} />
      {data.invoices.length === 0 ? (
        <MikkeEmptyState title="請求記録はまだありません" />
      ) : (
        <div className="divide-y divide-[var(--mikke-line)] overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
          {data.invoices.map((invoice) => (
            <ListRow
              key={invoice.id}
              title={`${invoice.billedName} · ${formatCurrency(invoice.amount)}`}
              helper={invoice.dueOn ? `期限 ${formatDate(invoice.dueOn)}` : invoice.note ?? "期限未設定"}
              badge={financeStatusLabel(invoice.status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContractTab({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const [startedOn, setStartedOn] = useState(data.project.contractStartedOn ?? "");
  const [endedOn, setEndedOn] = useState(data.project.contractEndedOn ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await mutate(
      () =>
        updateOperationsProjectContract(supabase, data.project.id, {
          contractStartedOn: startedOn,
          contractEndedOn: endedOn
        }),
      "契約期間を更新しました。"
    );
  }

  return (
    <div className="space-y-5">
      <TabIntro icon={FileCheck2} title="契約期間" description="運営型プロジェクトの開始・終了と、アーカイブ単位を管理します。" />
      <form onSubmit={submit} className="max-w-2xl rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TeamWorksProjectField label="契約開始日">
            <input type="date" value={startedOn} onChange={(event) => setStartedOn(event.target.value)} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="契約終了日">
            <input type="date" value={endedOn} min={startedOn || undefined} onChange={(event) => setEndedOn(event.target.value)} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
        </div>
        <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-3 text-xs leading-5 text-[var(--mikke-muted)]">
          終了後はプロジェクト単位でアーカイブします。誤操作防止のため、アーカイブ実行ボタンは本番の確認フローと合わせて追加します。
        </p>
        <SaveButton saving={saving} label="契約期間を保存" />
      </form>
    </div>
  );
}

function ProjectSettingsTab({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <TabIntro icon={Settings2} title="プロジェクト設定" description="プロジェクト登録時の情報、契約期間、クライアント連携をまとめて管理します。" />
      <ProjectNamePanel data={data} saving={saving} mutate={mutate} />
      <ProjectDescriptionPanel data={data} saving={saving} mutate={mutate} />
      <ProjectZoomPanel data={data} saving={saving} mutate={mutate} />
      <ContractTab data={data} saving={saving} mutate={mutate} />
      <ProjectClientInfoPanel data={data} />
      <ClientInvitePanel data={data} />
    </div>
  );
}

function ProjectNamePanel({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(data.project.title);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await mutate(() => updateOperationsProjectTitle(supabase, data.project.id, title), "プロジェクト名を保存しました。");
  }

  return (
    <MikkeSection title="プロジェクト名" tone="editorial">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <TeamWorksProjectField label="表示名" required>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={teamWorksProjectInputClass} required />
        </TeamWorksProjectField>
        <SaveButton saving={saving} label="プロジェクト名を保存" />
      </form>
    </MikkeSection>
  );
}

function ProjectClientInfoPanel({ data }: { data: OperationsProjectDetailData }) {
  const [clients, setClients] = useState<OperationsProjectMember[]>([]);
  const [directory, setDirectory] = useState<OperationsClientDirectoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadOperationsProjectMembers(supabase, data.project.id),
      loadOperationsClientDirectory(supabase)
    ]).then(([members, clientDirectory]) => {
      if (!active) return;
      setClients(members.members.filter((member) => member.projectRole === "client" && member.status === "active"));
      setDirectory(clientDirectory);
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "クライアント情報を読み込めませんでした。");
    });
    return () => { active = false; };
  }, [data.project.id]);

  return (
    <MikkeSection title="クライアント情報" tone="editorial">
      <p className="-mt-2 mb-3 text-xs leading-6 text-[var(--mikke-muted)]">このプロジェクトで現在有効な担当者のみ表示します。会社名の専用項目はまだないため、登録時の「会社・補足」を表示します。</p>
      {error ? <p role="alert" className="rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      {clients.length ? <div className="grid gap-3 sm:grid-cols-2">{clients.map((client) => {
        const directoryEntry = directory.find((entry) => entry.email.toLowerCase() === client.email?.toLowerCase());
        return <article key={client.organizationMemberId} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4"><div className="flex items-center justify-between gap-2"><p className="font-extrabold">{client.displayName}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${client.status === "active" ? "bg-[var(--mikke-green)]" : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"}`}>{client.status === "active" ? "有効" : "停止・アーカイブ"}</span></div><p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">メール：{client.email ?? "未登録"}</p><p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">会社・補足：{directoryEntry?.note ?? "未設定"}</p></article>;
      })}</div> : !error ? <MikkeEmptyState title="割り当て済みクライアントはいません" /> : null}
    </MikkeSection>
  );
}

function ProjectZoomPanel({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const [zoomUrl, setZoomUrl] = useState(data.project.zoomUrl ?? "");
  const [zoomMeetingId, setZoomMeetingId] = useState(data.project.zoomMeetingId ?? "");
  const [zoomPasscode, setZoomPasscode] = useState(data.project.zoomPasscode ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await mutate(
      () => updateOperationsProjectZoom(supabase, data.project.id, { zoomUrl, zoomMeetingId, zoomPasscode }),
      "プロジェクト既定のZoomを保存しました。今後の既定使用中の予定へ反映しました。"
    );
  }

  return (
    <MikkeSection title="Zoom設定" tone="editorial">
      <p className="-mt-2 text-xs leading-6 text-[var(--mikke-muted)]">通常使うZoomを1つ設定します。今後の各回へ反映され、必要な回だけ予定詳細から上書きできます。過去回は変更されません。</p>
      <form onSubmit={submit} className="mt-3 grid gap-3">
        <TeamWorksProjectField label="Zoom URL">
          <input type="url" value={zoomUrl} onChange={(event) => setZoomUrl(event.target.value)} placeholder="https://zoom.us/j/..." className={teamWorksProjectInputClass} />
        </TeamWorksProjectField>
        <div className="grid gap-3 md:grid-cols-2">
          <TeamWorksProjectField label="ミーティングID">
            <input value={zoomMeetingId} onChange={(event) => setZoomMeetingId(event.target.value)} placeholder="123 456 7890" className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="パスコード">
            <input value={zoomPasscode} onChange={(event) => setZoomPasscode(event.target.value)} placeholder="任意" className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
        </div>
        <div className="justify-self-start">
          <SaveButton saving={saving} label="Zoom既定を保存" />
        </div>
      </form>
    </MikkeSection>
  );
}

function ProjectDescriptionPanel({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const [description, setDescription] = useState(data.project.description ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await mutate(() => updateOperationsProjectDescription(supabase, data.project.id, description), "プロジェクトの説明を保存しました。");
  }

  return (
    <MikkeSection title="プロジェクトの説明" tone="editorial">
      <p className="-mt-2 text-xs leading-6 text-[var(--mikke-muted)]">クライアントが承認する時に見える説明文です。プロジェクトの目的・進め方などを書いておきます。</p>
      <form onSubmit={submit} className="mt-3">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className={teamWorksProjectInputClass}
          placeholder="例：週1回のオンライン日本語レッスンを、契約期間中つづけて実施します。"
        />
        <SaveButton saving={saving} label="説明を保存" />
      </form>
    </MikkeSection>
  );
}

function ClientInvitePanel({ data }: { data: OperationsProjectDetailData }) {
  const [pendingInvites, setPendingInvites] = useState<OperationsPendingInvite[]>([]);
  const [directory, setDirectory] = useState<OperationsClientDirectoryEntry[]>([]);
  const [clientId, setClientId] = useState("");
  const [pendingOpen, setPendingOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [memberResult, clientDirectory] = await Promise.all([
        loadOperationsProjectMembers(supabase, data.project.id),
        loadOperationsClientDirectory(supabase)
      ]);
      setPendingInvites(memberResult.pendingInvites.filter((invite) => invite.role === "client_user"));
      setDirectory(clientDirectory);
      setClientId((current) => current || clientDirectory[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "クライアント情報を読み込めませんでした。");
    }
  }, [data.project.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await addOperationsClientToProject(supabase, { projectId: data.project.id, clientId });
      if (result.status === "assigned") {
        setMessage(`${result.displayName} さんはすでにこのプロジェクトへ参加しています。重複招待は作成しませんでした。`);
      } else if (result.status === "invited") {
        setMessage(`${result.displayName} さんをこのプロジェクトに追加しました。クライアントのポータルに「承認のお知らせ」が届き、承認すると参加が有効になります。`);
      } else {
        setMessage(`${result.email} さんはまだポータルにログインしていません。「クライアント管理」の固定URLを渡してログインしてもらうと開通し、その後この追加が有効になります。`);
        setPendingOpen(true);
      }
      await reload();
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "クライアントをプロジェクトに追加できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(invite: OperationsPendingInvite) {
    setBusy(true);
    setMessage("");
    try {
      await revokeOperationsProjectInvite(supabase, invite.id);
      setMessage(`${invite.email} への招待を削除しました。`);
      await reload();
    } catch (revokeError) {
      setMessage(revokeError instanceof Error ? revokeError.message : "招待を削除できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MikkeSection title="クライアント招待" tone="editorial">
      <p className="-mt-2 text-xs leading-6 text-[var(--mikke-muted)]">
        登録済みクライアントをプロジェクトに追加します。開通済みの人は招待なしで参加、未開通の人だけ Pending invites に残します。
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <TeamWorksProjectField label="追加するクライアント" required>
          <select value={clientId} onChange={(event) => setClientId(event.target.value)} className={teamWorksProjectInputClass}>
            {directory.filter((client) => client.status === "active").map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName} / {client.email}
              </option>
            ))}
          </select>
        </TeamWorksProjectField>
        <button
          type="submit"
          disabled={busy || !clientId}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:opacity-50"
        >
          <Plus size={15} /> プロジェクトに追加
        </button>
      </form>
      {directory.length === 0 ? (
        <p className="mt-3 text-xs font-bold text-[var(--mikke-muted)]">
          先に左メニューの「クライアント管理」で名簿登録してください。
        </p>
      ) : null}
      {message ? <p role="status" className="mt-3 text-xs font-bold leading-5 text-[var(--mikke-muted)]">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}

      <button
        type="button"
        onClick={() => setPendingOpen((current) => !current)}
        className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-extrabold">ポータル未開通 / 招待中</span>
          <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">
            {pendingInvites.length === 0 ? "招待中のクライアントはいません" : `${pendingInvites.length}件の招待があります`}
          </span>
        </span>
        <span className="rounded-full bg-[var(--mikke-primary-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--mikke-primary)]">
          {pendingOpen ? "閉じる" : "展開"}
        </span>
      </button>
      {pendingOpen ? (
        pendingInvites.length === 0 ? (
          <MikkeEmptyState title="招待中のクライアントはいません" />
        ) : (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--mikke-line)] bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{invite.email}</p>
                  <p className="text-[11px] font-semibold text-[var(--mikke-muted)]">未ログイン・「クライアント管理」の固定URLでログインすると開通します</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void revokeInvite(invite)}
                  className="shrink-0 rounded-lg border border-[var(--tw-action)] px-2 py-1 text-[11px] font-bold text-[var(--tw-action)] disabled:opacity-50"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )
      ) : null}
    </MikkeSection>
  );
}

function PortalTab({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const labels = useTeamWorksLabels();
  const [clientVisible, setClientVisible] = useState(data.project.clientVisible);
  const [payoutsEnabled, setPayoutsEnabled] = useState(data.project.payoutsEnabled);
  const [invoicesEnabled, setInvoicesEnabled] = useState(data.project.invoicesEnabled);
  const [clientPartnerContactVisible, setClientPartnerContactVisible] = useState(data.project.clientPartnerContactVisible);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await mutate(
      () =>
        updateOperationsProjectVisibility(supabase, data.project.id, {
          clientVisible,
          payoutsEnabled,
          invoicesEnabled,
          clientPartnerContactVisible
        }),
      "ポータル設定を更新しました。"
    );
  }

  return (
    <div className="space-y-5">
      <TabIntro icon={Settings2} title="ポータル設定" description="このプロジェクトで使う機能をチェックリスト式で設定します。RLSによる認可はこの設定とは独立して常に適用されます。" />
      <form onSubmit={submit} className="max-w-3xl space-y-4">
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
          <PortalFeatureHeading title="クライアントに表示" helper="クライアント担当者が使う画面に表示する内容" />
          <div className="mt-3 space-y-3">
            <FeatureCheck checked={clientVisible} onChange={setClientVisible} title="クライアントポータル全体" helper="自プロジェクトのスケジュール・提出物・メッセージを表示する" />
            <FeatureCheck checked={clientPartnerContactVisible} onChange={setClientPartnerContactVisible} title={`担当${labels.workers}連絡先`} helper={`連絡先とメッセージに担当${labels.workers}を表示する。オフの場合は本部窓口のみ`} />
            <FeatureCheck checked={invoicesEnabled} onChange={setInvoicesEnabled} title="請求記録" helper="クライアントの請求先画面に必要な請求情報を表示する" />
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
          <PortalFeatureHeading title={`${labels.workers}に表示`} helper={`担当${labels.workers}が使う画面に表示する内容`} />
          <div className="mt-3 space-y-3">
            <FeatureCheck checked={payoutsEnabled} onChange={setPayoutsEnabled} title="報酬記録" helper={`対象${labels.workers}の報酬画面に必要な報酬情報を表示する`} />
            <FeatureCheck checked title="マニュアル" helper={`本部と担当${labels.workers}だけに常時表示し、クライアントには表示しない`} disabled />
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
          <PortalFeatureHeading title="共通・常時" helper="運営に必要なため両ポータルで常に使う内容" />
          <div className="mt-3">
            <FeatureCheck checked title="名簿・進捗" helper={`クライアントと担当${labels.workers}の名簿・進捗画面に常時表示する`} disabled />
          </div>
        </div>
        <div className="max-w-2xl">
          <SaveButton saving={saving} label="設定を保存" />
        </div>
      </form>
    </div>
  );
}

function MessagesTab({
  data,
  saving,
  mutate
}: {
  data: OperationsProjectDetailData;
  saving: boolean;
  mutate: (action: () => Promise<void>, successMessage: string) => Promise<void>;
}) {
  const labels = useTeamWorksLabels();
  const [members, setMembers] = useState<OperationsProjectMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const conversationRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    void loadOperationsProjectMembers(supabase, data.project.id)
      .then((result) => {
        if (!active) return;
        const conversationMembers = result.members.filter((member) => member.projectRole === "client" || member.projectRole === "worker");
        const firstActiveMember = conversationMembers.find((member) => member.status === "active");
        setMembers(conversationMembers);
        setSelectedMemberId((current) => current ?? firstActiveMember?.organizationMemberId ?? conversationMembers[0]?.organizationMemberId ?? null);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "宛先の読み込みに失敗しました。");
      });
    return () => {
      active = false;
    };
  }, [data.project.id]);

  const activeClients = members.filter((member) => member.projectRole === "client" && member.status === "active");
  const archivedClients = members.filter((member) => member.projectRole === "client" && member.status !== "active");
  const activePartners = members
    .filter((member) => member.projectRole === "worker" && member.status === "active")
    .sort((a, b) => latestConversationAt(data, b.organizationMemberId) - latestConversationAt(data, a.organizationMemberId));
  const archivedPartners = members
    .filter((member) => member.projectRole === "worker" && member.status !== "active")
    .sort((a, b) => latestConversationAt(data, b.organizationMemberId) - latestConversationAt(data, a.organizationMemberId));
  const selectedMember = members.find((member) => member.organizationMemberId === selectedMemberId) ?? null;
  const thread = selectedMember
    ? data.comments
        .filter((comment) => comment.authorMemberId === selectedMember.organizationMemberId || comment.recipientMemberId === selectedMember.organizationMemberId)
        .slice()
        .reverse()
    : [];

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMember) return;
    await mutate(
      () => sendOperationsDirectMessage(supabase, {
        projectId: data.project.id,
        recipientMemberId: selectedMember.organizationMemberId,
        audience: selectedMember.projectRole === "client" ? "client" : "internal",
        body: draft
      }),
      `${selectedMember.displayName}さんへメッセージを送りました。`
    );
    setDraft("");
  };

  const selectConversation = (memberId: string) => {
    setSelectedMemberId(memberId);
    window.setTimeout(() => {
      conversationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  return (
    <div className="space-y-5">
      <TabIntro icon={MessageSquare} title="メッセージ" description={`クライアントは上部に固定し、参加${labels.workers}は最新のやり取り順に表示します。カードを選ぶと会話を開けます。`} />
      {loadError ? <p role="alert" className="rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{loadError}</p> : null}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
        <aside className="space-y-4">
          <ConversationGroup title="クライアント" helper="プロジェクトの窓口" tone="client" members={activeClients} archivedMembers={archivedClients} data={data} selectedMemberId={selectedMemberId} onSelect={selectConversation} empty="アクティブなクライアントはまだいません" />
          <ConversationGroup title={`参加${labels.workers}`} helper="新着メッセージ順" tone="partner" members={activePartners} archivedMembers={archivedPartners} data={data} selectedMemberId={selectedMemberId} onSelect={selectConversation} empty={`アクティブな参加${labels.workers}はまだいません`} />
        </aside>
        <section ref={conversationRef} className="min-h-[420px] scroll-mt-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          {!selectedMember ? (
            <MikkeEmptyState title="会話する相手を選択してください" helper={`左の一覧からクライアントまたは参加${labels.workers}を選びます。`} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--mikke-line)] pb-3">
                <div><p className="text-sm font-extrabold">{selectedMember.displayName}</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--mikke-muted)]">{selectedMember.projectRole === "client" ? "クライアント" : labels.workers}{selectedMember.email ? ` ・ ${selectedMember.email}` : ""}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${selectedMember.projectRole === "client" ? "bg-[var(--mikke-pink)]" : "bg-[var(--mikke-green)]"}`}>{selectedMember.projectRole === "client" ? "クライアント" : labels.workers}</span>
              </div>
              <div className="max-h-[260px] space-y-3 overflow-y-auto py-4 lg:max-h-[420px]">
                {thread.length === 0 ? <p className="py-16 text-center text-xs font-semibold text-[var(--mikke-muted)]">まだやり取りはありません。最初のメッセージを送れます。</p> : thread.map((comment) => {
                  const received = comment.authorMemberId === selectedMember.organizationMemberId;
                  return <article key={comment.id} className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-6 ${received ? "mr-auto bg-[var(--mikke-surface-soft)]" : "ml-auto bg-[var(--mikke-primary-soft)]"}`}><p className="mb-1 text-[10px] font-bold text-[var(--mikke-muted)]">{received ? selectedMember.displayName : "こちら"} ・ {formatDateTime(comment.createdAt)}</p><p className="whitespace-pre-wrap">{comment.body}</p></article>;
                })}
              </div>
              <form onSubmit={send} className="border-t border-[var(--mikke-line)] pt-3">
                <label className="sr-only" htmlFor="operations-direct-message">メッセージ</label>
                <div className="flex items-end gap-2"><textarea id="operations-direct-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`${selectedMember.displayName}さんへメッセージを送る`} rows={3} className={`${teamWorksProjectInputClass} min-h-[78px] resize-y`} /><button disabled={saving || !draft.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--tw-action)] px-3 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:opacity-50"><Send size={14} />送信</button></div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationGroup({ title, helper, tone, members, archivedMembers, data, selectedMemberId, onSelect, empty }: { title: string; helper: string; tone: "client" | "partner"; members: OperationsProjectMember[]; archivedMembers: OperationsProjectMember[]; data: OperationsProjectDetailData; selectedMemberId: string | null; onSelect: (id: string) => void; empty: string }) {
  return <section><div className="mb-2 flex items-baseline gap-2"><h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--mikke-primary)]">{title}</h2><span className="text-[10px] font-semibold text-[var(--mikke-muted)]">{helper}</span></div>{members.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--mikke-line)] px-3 py-4 text-xs font-semibold text-[var(--mikke-muted)]">{empty}</div> : <div className="space-y-2"><ConversationButtons members={members} tone={tone} data={data} selectedMemberId={selectedMemberId} onSelect={onSelect} /></div>}{archivedMembers.length > 0 ? <details className="mt-2 rounded-xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-2"><summary className="cursor-pointer px-1 py-1 text-[11px] font-bold text-[var(--mikke-muted)]">アーカイブ済み（{archivedMembers.length}）</summary><div className="mt-2 space-y-2"><ConversationButtons members={archivedMembers} tone={tone} data={data} selectedMemberId={selectedMemberId} onSelect={onSelect} /></div></details> : null}</section>;
}

function ConversationButtons({ members, tone, data, selectedMemberId, onSelect }: { members: OperationsProjectMember[]; tone: "client" | "partner"; data: OperationsProjectDetailData; selectedMemberId: string | null; onSelect: (id: string) => void }) {
  return <>{members.map((member) => { const latest = latestConversation(data, member.organizationMemberId); return <button key={member.organizationMemberId} type="button" onClick={() => onSelect(member.organizationMemberId)} className={`w-full rounded-xl border p-3 text-left ${member.organizationMemberId === selectedMemberId ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)]" : "border-[var(--mikke-line)] bg-white"}`}><span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate text-sm font-extrabold">{member.displayName}</span><span className="mt-1 block truncate text-[11px] font-semibold text-[var(--mikke-muted)]">{latest ? `${latest.authorName}：${latest.body}` : "メッセージはまだありません"}</span></span><span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone === "client" ? "bg-[var(--mikke-pink)]" : "bg-[var(--mikke-green)]"}`} /></span></button>; })}</>;
}

function latestConversation(data: OperationsProjectDetailData, memberId: string) {
  return data.comments.find((comment) => comment.authorMemberId === memberId || comment.recipientMemberId === memberId) ?? null;
}

function latestConversationAt(data: OperationsProjectDetailData, memberId: string) {
  const value = latestConversation(data, memberId)?.createdAt;
  return value ? new Date(value).getTime() : 0;
}

function MetricCard({
  icon: Icon,
  tone,
  label,
  value,
  onClick
}: {
  icon: typeof CalendarDays;
  tone: "blue" | "green" | "pink" | "yellow";
  label: string;
  value: string;
  onClick: () => void;
}) {
  const colors = {
    blue: "var(--mikke-blue)",
    green: "var(--mikke-green)",
    pink: "var(--mikke-pink)",
    yellow: "var(--mikke-yellow)"
  };
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-3 text-left transition hover:border-[var(--mikke-primary)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: colors[tone] }}>
        <Icon size={19} color={tone === "blue" ? "#fff" : "#1b1b1f"} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-[var(--mikke-muted)]">{label}</span>
        <span className="mt-0.5 block truncate text-lg font-extrabold">{value}</span>
      </span>
    </button>
  );
}

function OverviewListSection({
  icon: Icon,
  title,
  subtitle,
  onViewAll,
  children
}: {
  icon: typeof CalendarDays;
  title: string;
  subtitle: string;
  onViewAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--mikke-primary)]">
          <Icon size={14} /> {title}
          <span className="normal-case tracking-normal text-[var(--mikke-muted)]">{subtitle}</span>
        </h2>
        <button type="button" onClick={onViewAll} className="text-[10px] font-bold text-[var(--mikke-muted)]">
          VIEW ALL
        </button>
      </div>
      <div className="divide-y divide-[var(--mikke-line)] overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
        {children}
      </div>
    </section>
  );
}

function ListRow({
  title,
  helper,
  badge,
  onClick
}: {
  title: string;
  helper: string;
  badge?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="h-8 w-1 shrink-0 rounded-full bg-[var(--mikke-green)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{title}</span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{helper}</span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-[var(--mikke-primary-soft)] px-2 py-1 text-[10px] font-bold text-[var(--mikke-primary)]">
          {badge}
        </span>
      ) : null}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--mikke-surface-soft)]">
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3">{content}</div>
  );
}

function InfoCard({ title, helper, badge }: { title: string; helper: string; badge?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-bold">{title}</span>
          <span className="mt-1 block text-xs leading-5 font-semibold text-[var(--mikke-muted)]">{helper}</span>
        </span>
        {badge ? (
          <span className="shrink-0 rounded-full bg-[var(--mikke-primary-soft)] px-2 py-1 text-[10px] font-bold text-[var(--mikke-primary)]">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TabIntro({
  icon: Icon,
  title,
  description
}: {
  icon: typeof CalendarDays;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-[var(--mikke-surface-soft)] p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-green)] text-[#1b1b1f]">
        <Icon size={19} />
      </span>
      <span>
        <span className="block text-sm font-extrabold">{title}</span>
        <span className="mt-1 block text-xs leading-5 font-semibold text-[var(--mikke-muted)]">{description}</span>
      </span>
    </div>
  );
}

function SaveButton({ saving, label }: { saving: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:opacity-50"
    >
      <CheckCircle2 size={15} /> {saving ? "保存中…" : label}
    </button>
  );
}

function FeatureCheck({
  checked,
  onChange,
  title,
  helper,
  disabled = false
}: {
  checked: boolean;
  onChange?: (value: boolean) => void;
  title: string;
  helper: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-[var(--mikke-line)] p-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--mikke-primary)]"
      />
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 font-semibold text-[var(--mikke-muted)]">{helper}</span>
      </span>
    </label>
  );
}

function PortalFeatureHeading({ title, helper }: { title: string; helper: string }) {
  return (
    <div className="border-b border-[var(--mikke-line)] pb-3">
      <h2 className="text-sm font-extrabold text-[var(--mikke-primary)]">{title}</h2>
      <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{helper}</p>
    </div>
  );
}

function FinanceSummary({ label, amount, enabled }: { label: string; amount: number; enabled: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--mikke-yellow)] text-[#1b1b1f]">
        <WalletCards size={22} />
      </span>
      <span className="flex-1">
        <span className="block text-xs font-semibold text-[var(--mikke-muted)]">{label}</span>
        <span className="mt-1 block text-xl font-extrabold">{formatCurrency(amount)}</span>
      </span>
      <span className="rounded-full bg-[var(--mikke-surface-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--mikke-muted)]">
        {enabled ? "有効" : "無効"}
      </span>
    </div>
  );
}

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

function weekdayLabel(weekday: number) {
  return weekdays[weekday] ?? "?";
}

function formatDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdayLabel(date.getDay())}）`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
}

function formatInviteExpiry(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(value));
}

function endTime(startTime: string, durationMin: number) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + durationMin;
  return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function PartnerPresenceBadge({ status }: { status: "not_started" | "standby" | "in_progress" | "ended" }) {
  if (status === "not_started") return null;
  const labels = { standby: "スタンバイ", in_progress: "実施中", ended: "終了" };
  const tone =
    status === "standby"
      ? "bg-[var(--tw-planned)] text-[var(--tw-on-tint)]"
      : status === "in_progress"
        ? "bg-[var(--tw-done)] text-[var(--tw-on-tint)]"
        : "border border-[var(--mikke-line)] text-[var(--mikke-muted)]";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${tone}`}>{labels[status]}</span>;
}

function durationBetweenTimes(startTime: string, finishTime: string) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [finishHours, finishMinutes] = finishTime.split(":").map(Number);
  const startTotal = startHours * 60 + startMinutes;
  let finishTotal = finishHours * 60 + finishMinutes;
  if (finishTotal <= startTotal) finishTotal += 24 * 60;
  return finishTotal - startTotal;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthCalendarDates(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function startOfMonday(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function daysUntil(dateKey: string | null) {
  if (!dateKey) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((new Date(`${dateKey}T00:00:00`).getTime() - start.getTime()) / 86_400_000);
}

function orderNumber(index: number) {
  const labels = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  return labels[index - 1] ?? `${index}.`;
}

function attendanceLabel(status: string) {
  return {
    scheduled: "出席予定",
    present: "出席",
    absent: "欠席",
    late: "遅刻",
    excused: "連絡済み欠席"
  }[status] ?? status;
}

function reportStatusLabel(status: string) {
  return {
    draft: "下書き",
    submitted: "承認待ち",
    revision_requested: "修正依頼",
    approved: "承認済み"
  }[status] ?? status;
}

function financeStatusLabel(status: string) {
  return {
    draft: "下書き",
    approved: "承認済み",
    scheduled: "支払予定",
    paid: "支払済み",
    issued: "発行済み",
    overdue: "期限超過",
    void: "無効"
  }[status] ?? status;
}
