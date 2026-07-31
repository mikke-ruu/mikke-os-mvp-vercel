"use client";

import { AlertCircle, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, GripVertical, MessageSquare, Plus, UsersRound } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { ClientMonthCalendar } from "@/components/team-works/operations/ClientMonthCalendar";
import { TeamWorksClientProjectsShell } from "@/components/team-works/client-projects/TeamWorksClientProjectsShell";
import { TeamWorksClientSelfProfile } from "@/components/team-works/operations/TeamWorksDirectorySelfProfile";
import { useTeamWorksLabels } from "@/components/team-works/useTeamWorksLabels";
import { TeamWorksViewAsBanner, useIsViewAs } from "@/components/team-works/TeamWorksViewAsContext";
import type { TeamWorksLabels } from "@/lib/team-works-labels";
import { supabase } from "@/lib/supabase/client";
import {
  approveOperationsClientProject,
  loadOperationsClientPendingProjects,
  loadOperationsClientPortal,
  loadOperationsClientPortalAs,
  loadOperationsClientPortalPreview,
  saveOperationsClientGroup,
  saveOperationsClientParticipant,
  saveOperationsClientSessionRoster,
  sendOperationsClientMessage,
  type OperationsClientPendingProject,
  type OperationsClientPortalData,
  type OperationsClientSession
} from "@/lib/team-works-operations-client";

type ProjectTab = "calendar" | "roster" | "messages";
type MutationNotice = { tone: "success" | "error"; text: string };

// 機能とポータルの設定(Phase L)に連動: lessons=falseでカレンダータブ、
// roster=falseで名簿タブを非表示にする。メッセージは常時表示。
function projectTabsFor(
  project: OperationsClientPortalData["projects"][number],
  labels: TeamWorksLabels
): { id: ProjectTab; label: string }[] {
  return [
    project.featureSettings.lessons ? { id: "calendar" as const, label: "カレンダー" } : null,
    project.featureSettings.roster ? { id: "roster" as const, label: labels.rosterNoun } : null,
    { id: "messages" as const, label: "メッセージ" }
  ].filter((tab): tab is { id: ProjectTab; label: string } => tab !== null);
}

function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// viewAsMemberId(O-3): 指定すると「本部staffがその人として見ている」モードになる。
// 読み込みはloadOperationsClientPortalAsに切り替わり、書き込みはmutate/approveの
// 入口で全て止まる(どのボタンを押しても実行されない)。通常のログイン表示では
// undefinedのまま=既存の挙動。
export function TeamWorksOperationsClientPortal({ viewAsMemberId }: { viewAsMemberId?: string } = {}) {
  const labels = useTeamWorksLabels();
  const [data, setData] = useState<OperationsClientPortalData | null>(null);
  const [pending, setPending] = useState<OperationsClientPendingProject[]>([]);
  const [activeView, setActiveView] = useState<string>("home");
  const [projectTab, setProjectTab] = useState<ProjectTab>("calendar");
  const [selectedDate, setSelectedDate] = useState<string>(() => todayKey());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (viewAsMemberId) {
        // 承認待ちは「本人が承認する」ためのものなので、表示モードでは出さない。
        setData(await loadOperationsClientPortalAs(supabase, viewAsMemberId));
        setPending([]);
        return;
      }
      const [portal, pendingProjects] = await Promise.all([
        loadOperationsClientPortal(supabase),
        loadOperationsClientPendingProjects(supabase)
      ]);
      setData(portal);
      setPending(pendingProjects);
    } catch (loadError) {
      setError(toErrorMessage(loadError, "クライアントポータルを読み込めませんでした。"));
    }
  }, [viewAsMemberId]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(action: () => Promise<void>, message: string): Promise<MutationNotice> {
    // 表示モードの歯止め。ボタン側のdisabledは見た目のためで、実際に書き込みを
    // 止めているのはここ(どの操作経路から来ても必ずここを通る)。
    if (viewAsMemberId) return { tone: "error", text: "表示モードでは保存できません。" };
    setError(null);
    try {
      await action();
      await load();
      return { tone: "success", text: message };
    } catch (mutationError) {
      return { tone: "error", text: toErrorMessage(mutationError, "保存に失敗しました。") };
    }
  }

  async function approve(project: OperationsClientPendingProject) {
    if (viewAsMemberId) return;
    setApprovingId(project.projectId);
    setError(null);
    setNotice(null);
    try {
      await approveOperationsClientProject(supabase, project.projectId);
      await load();
      setNotice(`「${project.title}」に参加しました。`);
    } catch (approveError) {
      setError(toErrorMessage(approveError, "承認できませんでした。"));
    } finally {
      setApprovingId(null);
    }
  }

  function goToProjectTab(projectId: string, tab: ProjectTab, dateKey?: string) {
    setActiveView(projectId);
    setProjectTab(tab);
    if (dateKey) setSelectedDate(dateKey);
  }

  const showOrgLabel = Boolean(data && new Set(data.projects.map((project) => project.organizationId)).size > 1);

  return (
    <TeamWorksClientProjectsShell title={`${labels.clientNoun}ポータル`} subtitle={`総合ホームと各プロジェクトのカレンダー・${labels.rosterNoun}・メッセージを確認・更新できます。`} displayName={data?.memberName}>
      <TeamWorksViewAsBanner />
      {notice ? <p className="mb-4 rounded-xl bg-[var(--mikke-primary-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-primary)]">{notice}</p> : null}
      {error ? <div className="mb-4"><MikkeEmptyState title="操作できませんでした" helper={error} /></div> : null}
      {pending.length > 0 ? <PendingApprovals pending={pending} approvingId={approvingId} onApprove={approve} /> : null}
      {!data && !error ? <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込み中…</p> : null}
      {data && data.projectCount > 0 ? (
        <>
          <nav aria-label="ポータル内のページ" className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--mikke-line)]">
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${activeView === "home" ? "border-[var(--mikke-accent)] text-[var(--mikke-primary)]" : "border-transparent text-[var(--mikke-muted)]"}`}
            >
              総合ホーム
            </button>
            {data.projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => { setActiveView(project.id); setProjectTab("calendar"); }}
                className={`shrink-0 border-b-2 px-4 py-3 text-left text-sm font-bold ${activeView === project.id ? "border-[var(--mikke-accent)] text-[var(--mikke-primary)]" : "border-transparent text-[var(--mikke-muted)]"}`}
              >
                {showOrgLabel ? <span className="block text-[9px] font-semibold text-[var(--mikke-muted)]">{project.organizationName}</span> : null}
                {project.title}
              </button>
            ))}
          </nav>
          {activeView === "home" ? (
            <HomeView data={data} selectedDate={selectedDate} onSelectDate={setSelectedDate} onGoToProjectTab={goToProjectTab} />
          ) : (
            <ProjectView
              data={data}
              projectId={activeView}
              projectTab={projectTab}
              onProjectTabChange={setProjectTab}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              mutate={mutate}
            />
          )}
        </>
      ) : null}
      {data && data.projectCount === 0 && pending.length === 0 ? (
        <MikkeEmptyState title="参加中の運営型プロジェクトはありません" helper="本部からクライアントとして招待されると、ここに承認のお知らせが届きます。" />
      ) : null}
    </TeamWorksClientProjectsShell>
  );
}

// K-2運営型プレビュー: 本部staffがプロジェクト詳細の「機能とポータルの設定」タブから
// 「クライアントにはこう見えます」を確認するための埋め込み用コンポーネント。
// アプリ全体のシェル(サイドバー等)は使わず、対象プロジェクトのProjectViewだけを
// 読み取り専用で描画する(納品型のDeliveryPortalPreviewと同じ考え方)。
export function TeamWorksOperationsClientPortalPreview({
  projectId,
  targetOrganizationMemberId,
  sampleDisplayName,
  readOnly = true
}: {
  projectId: string;
  targetOrganizationMemberId: string;
  sampleDisplayName?: string;
  readOnly?: boolean;
}) {
  const [data, setData] = useState<OperationsClientPortalData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState<ProjectTab>("calendar");
  const [selectedDate, setSelectedDate] = useState<string>(() => todayKey());

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await loadOperationsClientPortalPreview(supabase, projectId, targetOrganizationMemberId, sampleDisplayName));
    } catch (loadError) {
      setError(toErrorMessage(loadError, "プレビューを読み込めませんでした。"));
    }
  }, [projectId, targetOrganizationMemberId, sampleDisplayName]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(): Promise<MutationNotice> {
    // プレビューは読み取り専用(readOnlyのpointer-events-noneで操作自体を封じている)。
    return { tone: "success", text: "" };
  }

  if (error) return <MikkeEmptyState title="読み込みに失敗しました" helper={error} />;
  if (data === undefined) return <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;
  const project = data?.projects[0];
  if (!data || !project) {
    return <MikkeEmptyState title="このクライアントの表示を確認できません" helper="対象者がこのプロジェクトの有効なクライアントメンバーか確認してください。" />;
  }

  return (
    <div className={readOnly ? "pointer-events-none select-none" : ""}>
      <ProjectView
        data={data}
        projectId={project.id}
        projectTab={projectTab}
        onProjectTabChange={setProjectTab}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        mutate={mutate}
      />
    </div>
  );
}

function PendingApprovals({
  pending,
  approvingId,
  onApprove
}: {
  pending: OperationsClientPendingProject[];
  approvingId: string | null;
  onApprove: (project: OperationsClientPendingProject) => void;
}) {
  return (
    <div className="mb-5 space-y-3">
      <MikkeSection title="承認のお知らせ" tone="editorial">
        <p className="-mt-2 text-xs leading-6 text-[var(--mikke-muted)]">本部からプロジェクトに招待されています。内容を確認して承認すると、参加が有効になります。</p>
        <div className="mt-4 space-y-3">
          {pending.map((project) => (
            <div key={project.projectId} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
              <p className="text-[11px] font-bold text-[var(--mikke-muted)]">{project.organizationName}</p>
              <p className="mt-0.5 text-base font-extrabold">{project.title}</p>
              {project.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text)]">{project.description}</p> : null}
              {project.contractStartedOn || project.contractEndedOn ? (
                <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">
                  契約期間：{project.contractStartedOn ?? "未設定"} 〜 {project.contractEndedOn ?? "未設定"}
                </p>
              ) : null}
              <button
                type="button"
                disabled={approvingId === project.projectId}
                onClick={() => onApprove(project)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <CheckCircle2 size={16} /> {approvingId === project.projectId ? "承認中…" : "承認して参加する"}
              </button>
            </div>
          ))}
        </div>
      </MikkeSection>
    </div>
  );
}

function HomeView({
  data,
  selectedDate,
  onSelectDate,
  onGoToProjectTab
}: {
  data: OperationsClientPortalData;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onGoToProjectTab: (projectId: string, tab: ProjectTab, dateKey?: string) => void;
}) {
  const labels = useTeamWorksLabels();
  const today = todayKey();
  const daySessions = data.sessions.filter((session) => session.sessionDate === selectedDate && session.status !== "cancelled");
  const todaySessions = data.sessions.filter((session) => session.sessionDate === today && session.status !== "cancelled");
  const nextSession = data.sessions.find((session) => session.status !== "cancelled") ?? null;
  const unresolvedRosterCount = data.sessions.filter((session) => session.status === "scheduled" && session.roster.length === 0).length;
  const unreadLikeCount = data.messages.filter((message) => !data.projects.some((project) => project.clientMemberId === message.authorMemberId)).length;
  // 最新メッセージのプロジェクト(=messagesは作成日時降順)を優先し、無ければ最初のプロジェクトへ。
  const messageTargetProjectId = data.messages[0]?.projectId ?? data.projects[0]?.id ?? null;

  return (
    <div className="space-y-7">
      <MikkeSection title="総合カレンダー" tone="editorial">
        <p className="-mt-2 mb-4 text-xs font-semibold text-[var(--mikke-muted)]">{`日付を選ぶと、下にその日の全プロジェクトの予定を表示します。予定を押すと、そのカレンダーで${labels.attendanceNoun}編集ができます。`}</p>
        <ClientMonthCalendar sessions={data.sessions} holidays={data.holidays} selectedDate={selectedDate} onSelectDate={onSelectDate} />
        <div className="mt-4 space-y-2">
          {daySessions.length ? daySessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onGoToProjectTab(session.projectId, "calendar", session.sessionDate)}
              className="w-full rounded-xl border border-[var(--mikke-line)] bg-white p-3 text-left"
            >
              <p className="text-xs font-bold text-[var(--mikke-primary)]">{session.projectTitle}</p>
              <p className="mt-1 text-sm font-extrabold">{session.startTime}〜{endTime(session.startTime, session.durationMin)} · 担当 {session.partnerName ?? "担当未定"}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{labels.attendanceNoun} {session.roster.length}名</p>
            </button>
          )) : <MikkeEmptyState title="この日の予定はありません" />}
        </div>
      </MikkeSection>
      <MikkeSection title="本日のスケジュール" tone="editorial">
        {todaySessions.length ? (
          <div className="space-y-2">
            {todaySessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onGoToProjectTab(session.projectId, "calendar", session.sessionDate)}
                className="w-full rounded-xl border border-[var(--mikke-line)] bg-white p-3 text-left"
              >
                <p className="text-xs font-bold text-[var(--mikke-primary)]">{session.projectTitle}</p>
                <p className="mt-1 text-sm font-extrabold">{session.startTime}〜{endTime(session.startTime, session.durationMin)} · 担当 {session.partnerName ?? "担当未定"}</p>
              </button>
            ))}
          </div>
        ) : <MikkeEmptyState title="本日の予定はありません" />}
      </MikkeSection>
      <div className="grid gap-4 md:grid-cols-3">
        <HomeAction
          title="次回実施日"
          detail={nextSession ? `${nextSession.projectTitle} · ${formatDate(nextSession.sessionDate)} ${nextSession.startTime}` : "予定はありません"}
          icon={<CalendarDays size={18} />}
          onClick={nextSession ? () => onGoToProjectTab(nextSession.projectId, "calendar", nextSession.sessionDate) : undefined}
        />
        <HomeAction title={`未確定の${labels.attendanceNoun}`} detail={`${unresolvedRosterCount}件`} icon={<UsersRound size={18} />} />
        <HomeAction
          title="メッセージ"
          detail={unreadLikeCount ? `${unreadLikeCount}件のメッセージ` : "新着メッセージはありません"}
          icon={<MessageSquare size={18} />}
          onClick={messageTargetProjectId ? () => onGoToProjectTab(messageTargetProjectId, "messages") : undefined}
        />
      </div>
      <details className="group rounded-2xl border border-[var(--mikke-line)] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-extrabold text-[var(--mikke-primary)]">
          <span>企業・担当者情報を確認／編集</span>
          <ChevronDown size={17} className="group-open:hidden" />
          <ChevronUp size={17} className="hidden group-open:block" />
        </summary>
        <div className="border-t border-[var(--mikke-line)] p-3 sm:p-4">
          <TeamWorksClientSelfProfile />
        </div>
      </details>
    </div>
  );
}

function HomeAction({ title, detail, icon, onClick }: { title: string; detail: string; icon: React.ReactNode; onClick?: () => void }) {
  const content = <><div className="flex items-center gap-2 text-[var(--mikke-primary)]">{icon}<p className="text-xs font-bold">{title}</p></div><p className="mt-3 text-sm font-extrabold text-[var(--mikke-text)]">{detail}</p></>;
  if (onClick) return <button type="button" onClick={onClick} className="h-full w-full rounded-2xl border border-[var(--mikke-line)] bg-white p-4 text-left">{content}</button>;
  return <div className="h-full rounded-2xl border border-[var(--mikke-line)] bg-white p-4">{content}</div>;
}

function ProjectView({
  data,
  projectId,
  projectTab,
  onProjectTabChange,
  selectedDate,
  onSelectDate,
  mutate
}: {
  data: OperationsClientPortalData;
  projectId: string;
  projectTab: ProjectTab;
  onProjectTabChange: (tab: ProjectTab) => void;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  mutate: (action: () => Promise<void>, message: string) => Promise<MutationNotice>;
}) {
  const labels = useTeamWorksLabels();
  const project = data.projects.find((item) => item.id === projectId);
  const tabs = project ? projectTabsFor(project, labels) : [];
  useEffect(() => {
    if (project && tabs.length && !tabs.some((tab) => tab.id === projectTab)) {
      onProjectTabChange(tabs[0].id);
    }
  }, [project, tabs, projectTab, onProjectTabChange]);
  if (!project) return <MikkeEmptyState title="このプロジェクトは表示できません" />;

  return (
    <div className="space-y-5">
      {project.description ? (
        <p className="whitespace-pre-wrap rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 text-xs font-semibold leading-6 text-[var(--mikke-muted)]">
          {project.description}
        </p>
      ) : null}
      <nav aria-label="校内のページ" className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--mikke-surface-soft)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onProjectTabChange(tab.id)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold ${projectTab === tab.id ? "bg-white text-[var(--mikke-primary)] shadow-sm" : "text-[var(--mikke-muted)]"}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {projectTab === "calendar" && project.featureSettings.lessons ? (
        <ProjectCalendarTab data={data} project={project} selectedDate={selectedDate} onSelectDate={onSelectDate} mutate={mutate} />
      ) : null}
      {projectTab === "roster" && project.featureSettings.roster ? <ProjectRosterTab data={data} project={project} mutate={mutate} /> : null}
      {projectTab === "messages" ? <ProjectMessagesTab data={data} project={project} mutate={mutate} /> : null}
    </div>
  );
}

function ProjectCalendarTab({
  data,
  project,
  selectedDate,
  onSelectDate,
  mutate
}: {
  data: OperationsClientPortalData;
  project: OperationsClientPortalData["projects"][number];
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  mutate: (action: () => Promise<void>, message: string) => Promise<MutationNotice>;
}) {
  const labels = useTeamWorksLabels();
  const projectSessions = data.sessions.filter((session) => session.projectId === project.id);
  const projectHolidays = data.holidays.filter((holiday) => holiday.projectId === project.id || (holiday.projectId === null && holiday.organizationId === project.organizationId));
  const daySessions = projectSessions.filter((session) => session.sessionDate === selectedDate && session.status !== "cancelled");
  const dayHoliday = projectHolidays.find((holiday) => holiday.date === selectedDate);
  const participants = data.participants.filter((participant) => participant.projectId === project.id);
  const groups = data.groups.filter((group) => group.projectId === project.id);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
      <MikkeSection title="カレンダー" tone="editorial">
        <p className="-mt-2 mb-4 text-xs font-semibold text-[var(--mikke-muted)]">{`日付を選ぶと、右側で予定の詳細と${labels.attendanceNoun}順を確認・編集できます。`}</p>
        <ClientMonthCalendar sessions={projectSessions} holidays={projectHolidays} selectedDate={selectedDate} onSelectDate={onSelectDate} />
      </MikkeSection>
      <MikkeSection title={`${formatDate(selectedDate)} の予定`} tone="editorial">
        {dayHoliday ? <p className="mb-3 rounded-xl bg-[var(--mikke-pink)] px-3 py-2 text-xs font-bold">休講{dayHoliday.memo ? `　${dayHoliday.memo}` : ""}</p> : null}
        {daySessions.length ? (
          <div className="space-y-5">
            {daySessions.map((session, index) => (
              <SessionRosterPanel
                key={session.id}
                session={session}
                participants={participants}
                groups={groups}
                mutate={mutate}
                initiallyOpen={index === 0}
                attendanceEnabled={project.featureSettings.attendance}
              />
            ))}
          </div>
        ) : !dayHoliday ? <MikkeEmptyState title="この日の予定はありません" /> : null}
      </MikkeSection>
    </div>
  );
}

function SessionRosterPanel({
  session,
  participants,
  groups,
  mutate,
  initiallyOpen,
  attendanceEnabled
}: {
  session: OperationsClientSession;
  participants: OperationsClientPortalData["participants"];
  groups: OperationsClientPortalData["groups"];
  mutate: (action: () => Promise<void>, message: string) => Promise<MutationNotice>;
  initiallyOpen: boolean;
  attendanceEnabled: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => setOpen(initiallyOpen), [initiallyOpen, session.id]);
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 bg-[var(--mikke-surface-soft)] p-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">{session.startTime}〜{endTime(session.startTime, session.durationMin)}</span>
          <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">担当：{session.partnerName ?? "担当未定"}</span>
        </span>
        <span className="shrink-0 rounded-full bg-[#ffd370]/30 px-2.5 py-1 text-[10px] font-bold">選択済み {session.roster.length}名</span>
        <ChevronDown size={18} className={`shrink-0 text-[var(--mikke-primary)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="border-t border-[var(--mikke-line)] p-3">
          {session.workDescription ? (
            <p className="mb-3 rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs font-semibold text-[var(--mikke-text)]">作業内容：{session.workDescription}</p>
          ) : null}
          {session.zoomUrl || session.zoomMeetingId ? (
            <div className="mb-3 rounded-xl bg-[var(--mikke-surface-soft)] p-3">
              <p className="text-xs font-extrabold text-[var(--mikke-primary)]">Zoom</p>
              <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{session.zoomMeetingId ? `ID ${session.zoomMeetingId}` : "参加URL"}{session.zoomPasscode ? ` ／ パスコード ${session.zoomPasscode}` : ""}</p>
              {session.zoomUrl ? <a href={session.zoomUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-xl bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white"><ExternalLink size={13} />Zoomを開く</a> : null}
            </div>
          ) : null}
          {attendanceEnabled ? <RosterEditor session={session} participants={participants} groups={groups} mutate={mutate} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function RosterEditor({
  session,
  participants,
  groups,
  mutate
}: {
  session: OperationsClientSession;
  participants: OperationsClientPortalData["participants"];
  groups: OperationsClientPortalData["groups"];
  mutate: (action: () => Promise<void>, message: string) => Promise<MutationNotice>;
}) {
  const labels = useTeamWorksLabels();
  const isViewAs = useIsViewAs();
  const [selectedIds, setSelectedIds] = useState(session.roster.map((item) => item.participantId));
  const [groupFilter, setGroupFilter] = useState("all");
  const [saveNotice, setSaveNotice] = useState<MutationNotice | null>(null);
  useEffect(() => { setSelectedIds(session.roster.map((item) => item.participantId)); }, [session.id, session.roster]);
  useEffect(() => {
    if (groupFilter !== "all" && !groups.some((group) => group.id === groupFilter)) setGroupFilter("all");
  }, [groupFilter, groups]);
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const selectedParticipants = selectedIds.flatMap((id) => {
    const participant = participantById.get(id);
    return participant ? [participant] : [];
  });
  const visibleParticipants = groupFilter === "all"
    ? participants
    : participants.filter((participant) => participant.groupId === groupFilter);
  function toggle(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function move(id: string, direction: -1 | 1) { setSelectedIds((current) => { const index = current.indexOf(id); const nextIndex = index + direction; if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current; const next = [...current]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next; }); }
  const filterTone = (index: number, active: boolean) => {
    const tones = [
      active ? "border-[#f75a3b] bg-[#f75a3b] text-white" : "border-[#f75a3b]/40 bg-[#f75a3b]/10",
      active ? "border-[#f9d3d2] bg-[#f9d3d2] text-[var(--mikke-text)]" : "border-[#f9d3d2] bg-[#f9d3d2]/25",
      active ? "border-[#ffd370] bg-[#ffd370] text-[var(--mikke-text)]" : "border-[#ffd370] bg-[#ffd370]/20",
      active ? "border-[#8bc7ad] bg-[#8bc7ad] text-[var(--mikke-text)]" : "border-[#8bc7ad] bg-[#8bc7ad]/20"
    ];
    return tones[index % tones.length];
  };
  return (
    <div className="rounded-2xl border border-[#f9d3d2] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[var(--mikke-muted)]">{labels.attendanceNoun}順を確定</p>
        <p className="rounded-full bg-[#ffd370]/25 px-2.5 py-1 text-[11px] font-bold">選択済み {selectedIds.length}名</p>
      </div>
      <div className="mb-4 rounded-2xl border border-[#ffd370] bg-[#ffd370]/15 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold">今回の{labels.attendanceNoun}順</p>
            <p className="mt-0.5 text-[10px] font-semibold text-[var(--mikke-muted)]">{`${labels.rosterNoun}で選んだ順に追加されます。ここで名前ごと上下に移動できます。`}</p>
          </div>
        </div>
        {selectedParticipants.length ? (
          <ol className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {selectedParticipants.map((participant, index) => (
              <li key={participant.id} className="flex items-center gap-2 rounded-xl border border-[#ffd370] bg-white p-2.5">
                <GripVertical size={15} className="shrink-0 text-[var(--mikke-muted)]" aria-hidden="true" />
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--mikke-primary)] text-xs font-extrabold text-white">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{participant.name}</span>
                <div className="flex shrink-0 gap-1">
                  <button type="button" disabled={index === 0} onClick={() => move(participant.id, -1)} aria-label={`${participant.name}さんを一つ前へ`} className="rounded-lg border border-[var(--mikke-line)] bg-white p-1.5 text-[var(--mikke-primary)] disabled:opacity-25"><ChevronUp size={16} /></button>
                  <button type="button" disabled={index === selectedParticipants.length - 1} onClick={() => move(participant.id, 1)} aria-label={`${participant.name}さんを一つ後ろへ`} className="rounded-lg border border-[var(--mikke-line)] bg-white p-1.5 text-[var(--mikke-primary)] disabled:opacity-25"><ChevronDown size={16} /></button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-[#ffd370] bg-white px-3 py-3 text-center text-xs font-bold text-[var(--mikke-muted)]">{`下の${labels.rosterNoun}から、${labels.attendanceNoun}する${labels.participantNoun}を順番に選んでください。`}</p>
        )}
      </div>
      <p className="mb-2 text-xs font-extrabold text-[var(--mikke-primary)]">{labels.rosterNoun}</p>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label={`${labels.rosterNoun}を${labels.groupNoun}で絞り込み`}>
        <button type="button" onClick={() => setGroupFilter("all")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${groupFilter === "all" ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white" : "border-[var(--mikke-line)] bg-white"}`}>すべて（{participants.length}）</button>
        {groups.map((group, index) => {
          const count = participants.filter((participant) => participant.groupId === group.id).length;
          return <button key={group.id} type="button" onClick={() => setGroupFilter(group.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filterTone(index, groupFilter === group.id)}`}>{group.name}（{count}）</button>;
        })}
      </div>
      <div className="space-y-2">
        {visibleParticipants.map((participant) => {
          const index = selectedIds.indexOf(participant.id);
          return (
            <label key={participant.id} htmlFor={`participant-${session.id}-${participant.id}`} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 ${index >= 0 ? "border-[#8bc7ad] bg-[#8bc7ad]/20" : "border-[var(--mikke-line)] bg-white"}`}>
              <input id={`participant-${session.id}-${participant.id}`} type="checkbox" checked={index >= 0} onChange={() => toggle(participant.id)} className="h-4 w-4" />
              <span className="min-w-0 flex-1 text-sm font-extrabold">{participant.name}</span>
              {index >= 0 ? <span className="rounded-full bg-[var(--mikke-primary)] px-2 py-1 text-[10px] font-extrabold text-white">{index + 1}番</span> : null}
            </label>
          );
        })}
        {!participants.length ? <MikkeEmptyState title={`${labels.rosterNoun}はまだありません`} helper={`${labels.rosterNoun}タブから${labels.participantNoun}を登録してください。`} /> : null}
        {participants.length && !visibleParticipants.length ? <MikkeEmptyState title={`この${labels.groupNoun}にはまだ登録がありません`} /> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void mutate(() => saveOperationsClientSessionRoster(supabase, { projectId: session.projectId, sessionId: session.id, participantIds: selectedIds }), `${labels.attendanceNoun}順を確定しました。本部と担当${labels.workers}に共有されます。`).then(setSaveNotice)} disabled={isViewAs} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">{labels.attendanceNoun}順を保存</button>
        <InlineMutationNotice notice={saveNotice} />
      </div>
    </div>
  );
}

function ProjectRosterTab({ data, project, mutate }: { data: OperationsClientPortalData; project: OperationsClientPortalData["projects"][number]; mutate: (action: () => Promise<void>, message: string) => Promise<MutationNotice> }) {
  const labels = useTeamWorksLabels();
  const isViewAs = useIsViewAs();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [groupId, setGroupId] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupNotice, setGroupNotice] = useState<MutationNotice | null>(null);
  const [participantNotice, setParticipantNotice] = useState<MutationNotice | null>(null);
  const groups = data.groups.filter((group) => group.projectId === project.id);
  const participants = data.participants.filter((participant) => participant.projectId === project.id);
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  function edit(participant?: typeof participants[number]) {
    setEditingId(participant?.id ?? null);
    setName(participant?.name ?? "");
    setLevel(participant?.level ?? "");
    setGroupId(participant?.groupId ?? "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await mutate(
      () => saveOperationsClientParticipant(supabase, { projectId: project.id, participantId: editingId ?? undefined, name, level, groupId: groupId || null }),
      editingId ? `${labels.rosterNoun}を更新しました。` : `${labels.participantNoun}を登録しました。`
    );
    setParticipantNotice(result);
    if (result.tone === "error") return;
    edit();
  }

  async function submitGroup(event: FormEvent) {
    event.preventDefault();
    const result = await mutate(
      () => saveOperationsClientGroup(supabase, { projectId: project.id, groupId: editingGroupId ?? undefined, name: groupName }),
      editingGroupId ? `${labels.groupNoun}名を更新しました。` : `${labels.groupNoun}を追加しました。`
    );
    setGroupNotice(result);
    if (result.tone === "error") return;
    setEditingGroupId(null);
    setGroupName("");
  }

  return (
    <div className="space-y-5">
      <MikkeSection title={labels.groupNoun} tone="editorial">
        <p className="-mt-2 mb-3 text-xs font-semibold text-[var(--mikke-muted)]">{`${labels.clientNoun}側でクラスや曜日などの${labels.groupNoun}を作成・変更します。`}</p>
        <form onSubmit={submitGroup} className="flex flex-col gap-2 rounded-2xl border border-[#ffd370] bg-[#ffd370]/15 p-4 sm:flex-row">
          <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder={`${labels.groupNoun}名`} required className="min-w-0 flex-1 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm" />
          <button disabled={isViewAs} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">{editingGroupId ? "名前を更新" : `${labels.groupNoun}追加`}</button>
          {editingGroupId ? <button type="button" onClick={() => { setEditingGroupId(null); setGroupName(""); }} className="rounded-xl border border-[var(--mikke-line)] px-4 py-2.5 text-sm font-bold">取消</button> : null}
          <InlineMutationNotice notice={groupNotice} />
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {groups.map((group, index) => {
            const tones = ["bg-[#f75a3b]/12", "bg-[#f9d3d2]/45", "bg-[#ffd370]/30", "bg-[#8bc7ad]/30"];
            return <button key={group.id} type="button" onClick={() => { setEditingGroupId(group.id); setGroupName(group.name); }} className={`rounded-full px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)] ${tones[index % tones.length]}`}>{group.name}・編集</button>;
          })}
          {!groups.length ? <p className="text-xs font-semibold text-[var(--mikke-muted)]">{labels.groupNoun}はまだありません。</p> : null}
        </div>
      </MikkeSection>

      <MikkeSection title={labels.rosterNoun} tone="editorial">
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-[#f9d3d2] bg-[#f9d3d2]/15 p-4 sm:grid-cols-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="対象者名" required className="rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm" />
          <input value={level} onChange={(event) => setLevel(event.target.value)} placeholder="補足（任意）" className="rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm" />
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm"><option value="">{labels.groupNoun}未設定</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          <div className="flex flex-wrap items-center gap-2"><button disabled={isViewAs} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">{editingId ? `${labels.rosterNoun}を更新` : <span className="inline-flex items-center gap-1"><Plus size={15} />{labels.rosterNoun}に登録</span>}</button><InlineMutationNotice notice={participantNotice} /></div>
        </form>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{participants.map((participant) => <button key={participant.id} type="button" onClick={() => edit(participant)} className="rounded-xl border border-[var(--mikke-line)] bg-white p-3 text-left"><p className="font-extrabold">{participant.name}</p><p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{participant.groupId ? groupNameById.get(participant.groupId) ?? labels.groupNoun : `${labels.groupNoun}未設定`}{participant.level ? ` ／ ${participant.level}` : ""}</p></button>)}</div>
        {!participants.length ? <MikkeEmptyState title={`${labels.rosterNoun}はまだありません`} helper={`上のフォームから${labels.participantNoun}を登録してください。`} /> : null}
      </MikkeSection>
    </div>
  );
}

function ProjectMessagesTab({ data, project, mutate }: { data: OperationsClientPortalData; project: OperationsClientPortalData["projects"][number]; mutate: (action: () => Promise<void>, message: string) => Promise<MutationNotice> }) {
  const labels = useTeamWorksLabels();
  const isViewAs = useIsViewAs();
  const contacts = data.contacts.filter((contact) => contact.projectId === project.id);
  const [contactId, setContactId] = useState(contacts[0]?.memberId ?? "");
  useEffect(() => { if (!contacts.some((contact) => contact.memberId === contactId)) setContactId(contacts[0]?.memberId ?? ""); }, [contacts, contactId]);
  const [body, setBody] = useState("");
  const [sendNotice, setSendNotice] = useState<MutationNotice | null>(null);
  const contact = contacts.find((item) => item.memberId === contactId) ?? null;
  const messages = contact ? data.messages.filter((message) => message.projectId === project.id && (message.authorMemberId === contact.memberId || message.recipientMemberId === contact.memberId)) : [];
  async function submit(event: FormEvent) { event.preventDefault(); if (!contact) return; const result = await mutate(() => sendOperationsClientMessage(supabase, { projectId: project.id, recipientMemberId: contact.memberId, body }), "メッセージを送信しました。"); setSendNotice(result); if (result.tone === "success") setBody(""); }
  return <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"><MikkeSection title="連絡先" tone="editorial"><div className="space-y-2">{contacts.map((item) => <button key={item.memberId} type="button" onClick={() => setContactId(item.memberId)} className={`w-full rounded-xl border p-3 text-left ${item.memberId === contactId ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)]" : "border-[var(--mikke-line)] bg-white"}`}><p className="font-extrabold">{item.name}</p><p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{item.role === "worker" ? `担当${labels.workers}` : "本部窓口"}</p></button>)}</div>{!contacts.length ? <MikkeEmptyState title="連絡先はまだありません" /> : null}</MikkeSection><MikkeSection title={contact ? `${contact.name}とのメッセージ` : "メッセージ"} tone="editorial">{contact ? <><div className="min-h-56 space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">{messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm font-semibold ${message.authorMemberId === project.clientMemberId ? "ml-auto bg-[var(--mikke-primary)] text-white" : "bg-white text-[var(--mikke-text)]"}`}>{message.body}</div>)}{!messages.length ? <p className="text-sm font-semibold text-[var(--mikke-muted)]">まだメッセージはありません。</p> : null}</div><form onSubmit={submit} className="mt-3 flex flex-wrap gap-2"><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={2} placeholder={`${contact.name}さんへメッセージを送る`} className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--mikke-line)] px-3 py-2.5 text-sm" /><button disabled={isViewAs} className="rounded-xl bg-[var(--mikke-primary)] px-4 text-sm font-bold text-white disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">送信</button><InlineMutationNotice notice={sendNotice} /></form></> : <MikkeEmptyState title="連絡先を選択してください" />}</MikkeSection></div>;
}

function InlineMutationNotice({ notice }: { notice: MutationNotice | null }) {
  if (!notice) return null;
  return <span role={notice.tone === "error" ? "alert" : "status"} className={`inline-flex items-center gap-1 text-xs font-bold ${notice.tone === "success" ? "text-[var(--tw-on-tint)]" : "text-[var(--tw-action)]"}`}>{notice.tone === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{notice.text}</span>;
}

function formatDate(dateKey: string): string { const date = new Date(`${dateKey}T00:00:00`); return `${date.getMonth() + 1}/${date.getDate()}（${"日月火水木金土"[date.getDay()]}）`; }

// Supabase-js throws plain PostgrestError objects (not Error instances) for
// most query failures, so `error instanceof Error` misses them and always
// falls back to the generic message. Same fix as TeamWorksInviteAccept.tsx.
function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}
function endTime(start: string, duration: number): string { const [hour, minute] = start.split(":").map(Number); const total = hour * 60 + minute + duration; return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
