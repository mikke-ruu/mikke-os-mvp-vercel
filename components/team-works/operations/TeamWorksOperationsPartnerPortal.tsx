"use client";

import {
  AlertCircle,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock,
  ExternalLink,
  FolderKanban,
  List,
  Pause,
  Play,
  RotateCcw,
  Square,
  Timer,
  Users,
  UsersRound
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MikkeAppShell, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { ClientMonthCalendar } from "@/components/team-works/operations/ClientMonthCalendar";
import { useTeamWorksPortalRoles } from "@/components/team-works/useTeamWorksPortalRoles";
import { TeamWorksPartnerSelfProfile } from "@/components/team-works/operations/TeamWorksDirectorySelfProfile";
import { TeamWorksPartnerShiftPanel } from "@/components/team-works/operations/TeamWorksPartnerShiftPanel";
import { supabase } from "@/lib/supabase/client";
import {
  loadOperationsPartnerPortal,
  respondToOperationsPartnerOffer,
  saveOperationsPartnerStudentHandoff,
  submitOperationsPartnerReport,
  updateOperationsPartnerPresence,
  updateOperationsPartnerSessionZoom,
  type OperationsPartnerAssessment,
  type OperationsPartnerManual,
  type OperationsPartnerPortalData,
  type OperationsPartnerRosterItem,
  type OperationsPartnerSession
} from "@/lib/team-works-operations-partner";

type SaveNotice = { tone: "success" | "error"; text: string } | null;

export function TeamWorksOperationsPartnerPortal() {
  const [data, setData] = useState<OperationsPartnerPortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await loadOperationsPartnerPortal(supabase));
    } catch (loadError) {
      setError(toErrorMessage(loadError, "担当スケジュールを読み込めませんでした。"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { hasClient } = useTeamWorksPortalRoles();
  const navItems: MikkeShellNavItem[] = [
    { label: "パートナーポータル", href: "/apps/team-works/portal/worker", icon: Users },
    ...(hasClient ? [{ label: "クライアントポータル", href: "/apps/team-works/portal/client", icon: FolderKanban }] : [])
  ];

  return (
    <MikkeAppShell
      appName="Team Works"
      title="パートナーポータル"
      subtitle="担当レッスンを、名簿とマニュアルを見ながら進行"
      currentApp={{ label: "Team", href: "/apps/team-works/portal/worker", icon: CalendarDays }}
      theme="green"
      footerLabel="Team Works by mikke"
      navItems={navItems}
      ownedApps={[]}
      otherApps={[]}
      suggestedApps={[]}
    >
      <div className="mb-5 flex items-center justify-between border-b border-[var(--mikke-line)] pb-4">
        <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">
          <FolderKanban size={15} /> 運営型プロジェクト
        </p>
        <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">
          <CircleUserRound size={16} />
          {data?.memberName ? `${data.memberName}として表示` : "ログイン中の担当範囲を表示"}
        </p>
      </div>

      {!data && !error ? <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込み中…</p> : null}
      {error ? <MikkeEmptyState title="読み込みに失敗しました" helper={error} /> : null}
      {data ? <PartnerPortalBody data={data} onRefresh={load} /> : null}
    </MikkeAppShell>
  );
}

export function TeamWorksPartnerLessonWindow({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<OperationsPartnerPortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await loadOperationsPartnerPortal(supabase));
    } catch (loadError) {
      setError(toErrorMessage(loadError, "レッスンを読み込めませんでした。"));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const session = data ? [...data.today, ...data.upcoming].find((item) => item.id === sessionId) ?? null : null;

  if (error) return <main className="grid h-dvh place-items-center bg-[var(--mikke-surface-soft)] p-4"><MikkeEmptyState title="レッスンを開けませんでした" helper={error} /></main>;
  if (!data) return <main className="grid h-dvh place-items-center bg-[var(--mikke-surface-soft)]"><p className="text-sm font-bold text-[var(--mikke-muted)]">読み込み中…</p></main>;
  if (!session) return <main className="grid h-dvh place-items-center bg-[var(--mikke-surface-soft)] p-4"><MikkeEmptyState title="このレッスンは表示できません" helper="担当変更または日程変更後の可能性があります。スケジュールから開き直してください。" /></main>;
  return <main className="h-dvh overflow-hidden bg-white"><TeamWorksPartnerLessonConsole session={session} onRefresh={load} standalone /></main>;
}

function PartnerPortalBody({ data, onRefresh }: { data: OperationsPartnerPortalData; onRefresh: () => Promise<void> }) {
  const sessions = useMemo(() => [...data.today, ...data.upcoming], [data.today, data.upcoming]);
  const projects = useMemo(
    () => [...new Map(sessions.map((session) => [session.projectId, { id: session.projectId, title: session.projectTitle }])).values()],
    [sessions]
  );
  const [activeView, setActiveView] = useState("home");
  const [projectTab, setProjectTab] = useState<"calendar" | "schedule">("calendar");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [responding, setResponding] = useState<string | null>(null);
  const [responseNotice, setResponseNotice] = useState<SaveNotice>(null);

  useEffect(() => {
    if (!["home", "shifts"].includes(activeView) && !projects.some((project) => project.id === activeView)) {
      setActiveView("home");
    }
  }, [activeView, projects]);

  async function respond(projectId: string, organizationMemberId: string, accept: boolean) {
    setResponding(projectId);
    setResponseNotice(null);
    try {
      await respondToOperationsPartnerOffer(supabase, { projectId, organizationMemberId, accept });
      setResponseNotice({ tone: "success", text: accept ? "参加しました。" : "辞退しました。" });
      await onRefresh();
    } catch (error) {
      setResponseNotice({ tone: "error", text: toErrorMessage(error, "参加依頼を更新できませんでした。") });
    } finally {
      setResponding(null);
    }
  }

  return (
    <div className="space-y-6">
      <PartnerOfferCards offers={data.offers} responding={responding} notice={responseNotice} onRespond={respond} />

      <nav aria-label="パートナーポータル内のページ" className="flex gap-1 overflow-x-auto border-b border-[var(--mikke-line)]">
        <button
          type="button"
          onClick={() => setActiveView("home")}
          className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${activeView === "home" ? "border-[var(--mikke-accent)] text-[var(--mikke-primary)]" : "border-transparent text-[var(--mikke-muted)]"}`}
        >
          総合ホーム
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => { setActiveView(project.id); setProjectTab("calendar"); }}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${activeView === project.id ? "border-[var(--mikke-accent)] text-[var(--mikke-primary)]" : "border-transparent text-[var(--mikke-muted)]"}`}
          >
            {project.title}
          </button>
        ))}
      </nav>

      {activeView === "shifts" ? (
        <TeamWorksPartnerShiftPanel />
      ) : activeView === "home" ? (
        <PartnerHome
          data={data}
          sessions={sessions}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenProject={(projectId, tab) => { setActiveView(projectId); setProjectTab(tab); }}
          onOpenShifts={() => setActiveView("shifts")}
        />
      ) : sessions.length ? (
        <PartnerProject
          projectId={activeView}
          sessions={sessions}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          tab={projectTab}
          onTabChange={setProjectTab}
        />
      ) : (
        <MikkeEmptyState
          title="担当レッスンはありません"
          helper={data.projectCount ? `${data.projectCount}件のプロジェクトに参加しています。` : "本部から参加依頼が届くと、ここで確認できます。"}
        />
      )}

      {activeView === "home" ? <PartnerProfileDetails /> : null}
    </div>
  );
}

function PartnerHome({
  data,
  sessions,
  selectedDate,
  onSelectDate,
  onOpenProject,
  onOpenShifts
}: {
  data: OperationsPartnerPortalData;
  sessions: OperationsPartnerSession[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenProject: (projectId: string, tab: "calendar" | "schedule") => void;
  onOpenShifts: () => void;
}) {
  const daySessions = sessions.filter((session) => session.sessionDate === selectedDate);
  const nextSession = sessions[0] ?? null;
  return (
    <div className="space-y-7">
      <MikkeSection title="総合カレンダー" tone="editorial">
        <p className="-mt-2 mb-4 text-xs font-semibold text-[var(--mikke-muted)]">担当中の全プロジェクトをまとめて表示します。予定からレッスン専用画面を別窓で開けます。</p>
        <ClientMonthCalendar sessions={sessions} holidays={[]} selectedDate={selectedDate} onSelectDate={onSelectDate} />
        <div className="mt-4 space-y-2">
          {daySessions.length ? daySessions.map((session) => <PartnerScheduleRow key={session.id} session={session} />) : <MikkeEmptyState title="この日の担当はありません" />}
        </div>
      </MikkeSection>
      <MikkeSection title="本日のスケジュール" tone="editorial">
        {data.today.length ? <div className="space-y-2">{data.today.map((session) => <PartnerScheduleRow key={session.id} session={session} />)}</div> : <MikkeEmptyState title="本日の担当はありません" />}
      </MikkeSection>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PartnerHomeAction
          icon={<CalendarCheck2 size={18} />}
          title="希望シフトを提出"
          detail="稼働できる日を本部へ共有"
          onClick={onOpenShifts}
          emphasized
        />
        <PartnerHomeAction
          icon={<CalendarDays size={18} />}
          title="次回レッスン"
          detail={nextSession ? `${nextSession.projectTitle}・${formatDate(nextSession.sessionDate)} ${nextSession.startTime}` : "予定はありません"}
          onClick={nextSession ? () => onOpenProject(nextSession.projectId, "schedule") : undefined}
        />
        <PartnerHomeAction icon={<UsersRound size={18} />} title="本日の担当" detail={`${data.today.length}件`} />
        <PartnerHomeAction icon={<List size={18} />} title="30日以内" detail={`${sessions.length}件`} onClick={nextSession ? () => onOpenProject(nextSession.projectId, "schedule") : undefined} />
      </div>
    </div>
  );
}

function PartnerProject({
  projectId,
  sessions,
  selectedDate,
  onSelectDate,
  tab,
  onTabChange
}: {
  projectId: string;
  sessions: OperationsPartnerSession[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  tab: "calendar" | "schedule";
  onTabChange: (tab: "calendar" | "schedule") => void;
}) {
  const projectSessions = sessions.filter((session) => session.projectId === projectId);
  const title = projectSessions[0]?.projectTitle ?? "プロジェクト";
  const daySessions = projectSessions.filter((session) => session.sessionDate === selectedDate);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-extrabold">{title}</p>
        <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">担当レッスンだけを表示しています。</p>
      </div>
      <nav className="flex gap-1 rounded-xl bg-[var(--mikke-surface-soft)] p-1" aria-label={`${title}内のページ`}>
        <button type="button" onClick={() => onTabChange("calendar")} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold ${tab === "calendar" ? "bg-white text-[var(--mikke-primary)] shadow-sm" : "text-[var(--mikke-muted)]"}`}><CalendarDays size={14} />カレンダー</button>
        <button type="button" onClick={() => onTabChange("schedule")} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold ${tab === "schedule" ? "bg-white text-[var(--mikke-primary)] shadow-sm" : "text-[var(--mikke-muted)]"}`}><List size={14} />スケジュール</button>
      </nav>
      {tab === "calendar" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
          <MikkeSection title="カレンダー" tone="editorial">
            <ClientMonthCalendar sessions={projectSessions} holidays={[]} selectedDate={selectedDate} onSelectDate={onSelectDate} />
          </MikkeSection>
          <MikkeSection title={`${formatDate(selectedDate)} の担当`} tone="editorial">
            {daySessions.length ? <div className="space-y-2">{daySessions.map((session) => <PartnerScheduleRow key={session.id} session={session} />)}</div> : <MikkeEmptyState title="この日の担当はありません" />}
          </MikkeSection>
        </div>
      ) : (
        <MikkeSection title="スケジュール" tone="editorial">
          <p className="-mt-2 mb-4 text-xs font-semibold text-[var(--mikke-muted)]">「レッスン画面」を押すと、Zoomの横に置ける専用窓で開きます。</p>
          <div className="space-y-2">{projectSessions.map((session) => <PartnerScheduleRow key={session.id} session={session} />)}</div>
        </MikkeSection>
      )}
    </div>
  );
}

function PartnerScheduleRow({ session }: { session: OperationsPartnerSession }) {
  const targetMinutes = session.roster.length ? Math.floor(session.durationMin / session.roster.length) : null;
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--mikke-line)] bg-white p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-[var(--mikke-primary)]">{formatDate(session.sessionDate)}・{session.projectTitle}</p>
        <p className="mt-1 text-sm font-extrabold">{session.startTime}〜{endTime(session.startTime, session.durationMin)}　{session.roster.length}名</p>
        <p className="mt-1 text-[11px] font-semibold text-[var(--mikke-muted)]">{targetMinutes ? `1人あたり目安 ${targetMinutes}分` : "名簿未設定"}{session.zoomMeetingId ? ` ／ Zoom ID ${session.zoomMeetingId}` : ""}</p>
      </div>
      <button type="button" onClick={() => openLessonWindow(session.id)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--mikke-primary)] px-4 py-2 text-xs font-bold text-white">
        <ExternalLink size={14} />レッスン画面
      </button>
    </article>
  );
}

function PartnerHomeAction({ icon, title, detail, onClick, emphasized = false }: { icon: React.ReactNode; title: string; detail: string; onClick?: () => void; emphasized?: boolean }) {
  const content = <><div className="flex items-center gap-2 text-[var(--mikke-primary)]">{icon}<span className="text-xs font-bold">{title}</span></div><p className="mt-3 text-sm font-extrabold">{detail}</p></>;
  return onClick ? <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left ${emphasized ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)]" : "border-[var(--mikke-line)] bg-white"}`}>{content}</button> : <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">{content}</div>;
}

function PartnerProfileDetails() {
  return (
    <details className="rounded-2xl border border-[var(--mikke-line)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold">パートナー情報<ChevronDown size={16} /></summary>
      <div className="border-t border-[var(--mikke-line)] p-4"><TeamWorksPartnerSelfProfile /></div>
    </details>
  );
}

function openLessonWindow(sessionId: string) {
  const url = `/apps/team-works/portal/worker/lesson/${sessionId}`;
  const popup = window.open(url, `team-works-lesson-${sessionId}`, "popup=yes,width=920,height=900,resizable=yes,scrollbars=no");
  if (!popup) window.location.href = url;
}

export function TeamWorksPartnerLessonConsole({ session, onRefresh, standalone = false }: { session: OperationsPartnerSession; onRefresh: () => Promise<void>; standalone?: boolean }) {
  const [presence, setPresence] = useState(session.partnerPresenceStatus);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [presenceNotice, setPresenceNotice] = useState<SaveNotice>(null);
  const [controlsCollapsed, setControlsCollapsed] = useState(session.partnerPresenceStatus !== "not_started");
  const firstOpen = session.roster.find((item) => !item.completedAt)?.id ?? session.roster[0]?.id ?? "";
  const [selectedRosterId, setSelectedRosterId] = useState(firstOpen);
  const [mobileRecordOpen, setMobileRecordOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const selectedStudent = session.roster.find((item) => item.id === selectedRosterId) ?? session.roster[0] ?? null;
  const [selectedManualNo, setSelectedManualNo] = useState(selectedStudent?.currentManualNo ?? session.manuals[0]?.no ?? 1);
  const targetMinutes = session.roster.length ? Math.max(1, Math.floor(session.durationMin / session.roster.length)) : null;

  useEffect(() => {
    if (selectedStudent) {
      setSelectedManualNo(selectedStudent.currentManualNo);
      setElapsedSeconds(0);
      setTimerRunning(false);
    }
  }, [selectedStudent?.id, selectedStudent?.currentManualNo]);

  useEffect(() => {
    if (!timerRunning) return;
    const timerId = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timerId);
  }, [timerRunning]);

  async function changePresence(next: "standby" | "in_progress" | "ended") {
    setPresenceBusy(true);
    setPresenceNotice(null);
    try {
      await updateOperationsPartnerPresence(supabase, session.id, next);
      setPresence(next);
      if (next === "standby") setControlsCollapsed(true);
      setPresenceNotice({
        tone: "success",
        text: next === "standby" ? "本部へスタンバイを通知しました。" : next === "ended" ? "レッスン終了を通知しました。" : "開始を通知しました。"
      });
      await onRefresh();
    } catch (error) {
      setPresenceNotice({ tone: "error", text: toErrorMessage(error, "状態を更新できませんでした。") });
    } finally {
      setPresenceBusy(false);
    }
  }

  function moveNext(currentId: string) {
    const currentIndex = session.roster.findIndex((item) => item.id === currentId);
    const next = session.roster.slice(currentIndex + 1).find((item) => !item.completedAt);
    if (next) setSelectedRosterId(next.id);
  }

  return (
    <article className={`flex min-h-0 flex-col overflow-hidden border border-[var(--mikke-line)] bg-white ${standalone ? "h-dvh rounded-none" : "rounded-2xl"}`}>
      <header className="shrink-0 border-b border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold">{session.projectTitle}</h2>
              <PresenceBadge status={presence} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-[var(--mikke-muted)]">
              <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{formatDate(session.sessionDate)}</span>
              <span className="inline-flex items-center gap-1"><Clock size={13} />{session.startTime}〜{endTime(session.startTime, session.durationMin)}</span>
              <span className="inline-flex items-center gap-1"><UsersRound size={13} />{session.roster.length}名</span>
              {!controlsCollapsed && session.zoomMeetingId ? <span>Zoom ID {session.zoomMeetingId}</span> : null}
              {!controlsCollapsed && session.zoomPasscode ? <span>パスコード {session.zoomPasscode}</span> : null}
            </p>
          </div>
          {controlsCollapsed ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <SaveFeedback notice={presenceNotice} />
              <button type="button" onClick={() => setControlsCollapsed(false)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-white px-3 text-[11px] font-bold text-[var(--mikke-primary)]">
                操作を表示 <ChevronDown size={13} />
              </button>
            </div>
          ) : (
          <div className="flex flex-wrap items-center gap-2">
            {presence === "not_started" ? (
              <button type="button" disabled={presenceBusy} onClick={() => void changePresence("standby")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--mikke-primary)] bg-white px-4 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50">
                <Check size={15} />スタンバイ
              </button>
            ) : null}
            {presence === "standby" ? (
              <button type="button" disabled={presenceBusy} onClick={() => void changePresence("in_progress")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--mikke-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                <Play size={14} />レッスン開始
              </button>
            ) : null}
            {session.zoomUrl ? (
              <a href={session.zoomUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#2d8cff] px-4 py-2 text-xs font-bold text-white">
                <ExternalLink size={14} />Zoomを開く
              </a>
            ) : (
              <span className="inline-flex min-h-10 items-center rounded-xl border border-dashed border-[var(--mikke-line)] px-3 text-xs font-bold text-[var(--mikke-muted)]">Zoomリンク未設定</span>
            )}
            {presence !== "ended" ? (
              <button type="button" disabled={presenceBusy} onClick={() => void changePresence("ended")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 disabled:opacity-50">
                <Square size={13} />レッスン終了
              </button>
            ) : null}
            <SaveFeedback notice={presenceNotice} />
            {presence !== "not_started" ? (
              <button type="button" onClick={() => setControlsCollapsed(true)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white px-3 text-xs font-bold text-[var(--mikke-primary)]">
                操作を畳む <ChevronDown size={13} className="rotate-180" />
              </button>
            ) : null}
          </div>
          )}
        </div>
        {!controlsCollapsed ? <PartnerZoomSettings session={session} onUpdated={onRefresh} /> : null}
      </header>

      {session.roster.length ? (
        <div className="relative flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(380px,1.05fr)_minmax(300px,0.95fr)]">
          <MobileStudentDock
            roster={session.roster}
            selectedStudent={selectedStudent}
            onSelectStudent={setSelectedRosterId}
            targetMinutes={targetMinutes}
            elapsedSeconds={elapsedSeconds}
            timerRunning={timerRunning}
            onToggleTimer={() => setTimerRunning((running) => !running)}
            onResetTimer={() => { setTimerRunning(false); setElapsedSeconds(0); }}
            onOpenRecord={() => setMobileRecordOpen(true)}
          />
          <section className="hidden min-h-0 flex-col border-r border-[var(--mikke-line)] lg:flex">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--mikke-line)] px-4 py-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--mikke-primary)]">出席順</p>
                <p className="mt-0.5 text-[11px] font-semibold text-[var(--mikke-muted)]">{targetMinutes ? `1人あたり目安 ${targetMinutes}分` : "生徒を押すと評価・引継ぎを開きます"}</p>
              </div>
              <span className="text-xs font-bold text-[var(--mikke-muted)]">{session.roster.filter((item) => item.completedAt).length}/{session.roster.length} 完了</span>
            </div>
            <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {session.roster.map((item) => (
                <StudentAccordion
                  key={item.id}
                  item={item}
                  open={selectedRosterId === item.id}
                  onOpen={() => setSelectedRosterId(item.id)}
                  onCompleted={() => moveNext(item.id)}
                  onRefresh={onRefresh}
                  targetMinutes={targetMinutes}
                  elapsedSeconds={elapsedSeconds}
                  timerRunning={timerRunning}
                  onToggleTimer={() => setTimerRunning((running) => !running)}
                  onResetTimer={() => { setTimerRunning(false); setElapsedSeconds(0); }}
                />
              ))}
            </ol>
            <LessonReport session={session} onSubmitted={onRefresh} />
          </section>
          <ManualPanel
            manuals={session.manuals}
            selectedManualNo={selectedManualNo}
            onSelectManual={setSelectedManualNo}
            student={selectedStudent}
            visible
          />
          {mobileRecordOpen && selectedStudent ? (
            <section className="absolute inset-x-0 bottom-0 z-30 flex max-h-[72%] flex-col overflow-hidden rounded-t-2xl border border-[var(--mikke-line)] bg-white shadow-2xl lg:hidden">
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--mikke-line)] bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-extrabold">{selectedStudent.participantName}の記録</p>
                  <p className="text-[11px] font-semibold text-[var(--mikke-muted)]">タイマーとマニュアルは背面上部に残ります</p>
                </div>
                <button type="button" onClick={() => setMobileRecordOpen(false)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">閉じる</button>
              </div>
              <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <StudentAccordion
                  item={selectedStudent}
                  open
                  onOpen={() => undefined}
                  onCompleted={() => { moveNext(selectedStudent.id); setMobileRecordOpen(false); }}
                  onRefresh={onRefresh}
                  targetMinutes={targetMinutes}
                  elapsedSeconds={elapsedSeconds}
                  timerRunning={timerRunning}
                  onToggleTimer={() => setTimerRunning((running) => !running)}
                  onResetTimer={() => { setTimerRunning(false); setElapsedSeconds(0); }}
                  showTimer={false}
                />
              </ol>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="p-5">
          <MikkeEmptyState title="名簿はまだ設定されていません" helper="本部が出席順を設定すると、この画面に表示されます。" />
        </div>
      )}

    </article>
  );
}

function MobileStudentDock({
  roster,
  selectedStudent,
  onSelectStudent,
  targetMinutes,
  elapsedSeconds,
  timerRunning,
  onToggleTimer,
  onResetTimer,
  onOpenRecord
}: {
  roster: OperationsPartnerRosterItem[];
  selectedStudent: OperationsPartnerRosterItem | null;
  onSelectStudent: (rosterId: string) => void;
  targetMinutes: number | null;
  elapsedSeconds: number;
  timerRunning: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onOpenRecord: () => void;
}) {
  if (!selectedStudent) return null;

  return (
    <section className="shrink-0 border-b border-[var(--mikke-line)] bg-white lg:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">{selectedStudent.participantName}</p>
          <p className="mt-0.5 text-[10px] font-bold text-[var(--mikke-muted)]">
            出席順 {selectedStudent.orderIndex}・進捗 No.{selectedStudent.currentManualNo}
            {targetMinutes ? `・目安 ${targetMinutes}分` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Timer size={14} className="text-[var(--mikke-primary)]" />
          <span className="font-mono text-sm font-extrabold tabular-nums">{formatElapsed(elapsedSeconds)}</span>
          <button type="button" onClick={onToggleTimer} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[var(--mikke-primary)] px-2.5 text-[11px] font-bold text-white">
            {timerRunning ? <Pause size={12} /> : <Play size={12} />}
            {timerRunning ? "停止" : elapsedSeconds ? "再開" : "開始"}
          </button>
          <button type="button" onClick={onResetTimer} aria-label="タイマーをリセット" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--mikke-line)] px-3 py-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5" aria-label="生徒を選択">
          {roster.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectStudent(item.id)}
              aria-pressed={item.id === selectedStudent.id}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold ${
                item.id === selectedStudent.id
                  ? "bg-[var(--mikke-primary)] text-white"
                  : item.completedAt
                    ? "bg-emerald-50 text-emerald-800"
                    : "border border-[var(--mikke-line)] bg-white text-[var(--mikke-ink)]"
              }`}
            >
              {item.completedAt ? "✓ " : ""}{item.orderIndex}. {item.participantName}
            </button>
          ))}
        </div>
        <button type="button" onClick={onOpenRecord} className="shrink-0 rounded-lg border border-[var(--mikke-primary)] bg-white px-3 py-1.5 text-xs font-extrabold text-[var(--mikke-primary)]">
          記録を開く
        </button>
      </div>
    </section>
  );
}

function StudentAccordion({
  item,
  open,
  onOpen,
  onCompleted,
  onRefresh,
  targetMinutes,
  elapsedSeconds,
  timerRunning,
  onToggleTimer,
  onResetTimer,
  showTimer = true
}: {
  item: OperationsPartnerRosterItem;
  open: boolean;
  onOpen: () => void;
  onCompleted: () => void;
  onRefresh: () => Promise<void>;
  targetMinutes: number | null;
  elapsedSeconds: number;
  timerRunning: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  showTimer?: boolean;
}) {
  const [assessment, setAssessment] = useState<OperationsPartnerAssessment>(item.assessment);
  const [handoffNote, setHandoffNote] = useState(item.handoffNote);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<SaveNotice>(null);
  async function save(complete: boolean) {
    setSaving(true);
    setNotice(null);
    try {
      await saveOperationsPartnerStudentHandoff(supabase, {
        rosterId: item.id,
        attendanceStatus: item.attendanceStatus,
        assessment,
        handoffNote,
        complete
      });
      setNotice({ tone: "success", text: complete ? "完了。次の生徒へ進みます。" : "保存しました。" });
      await onRefresh();
      if (complete) {
        onCompleted();
      }
    } catch (error) {
      setNotice({ tone: "error", text: toErrorMessage(error, "保存できませんでした。") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="border-b border-[var(--mikke-line)] last:border-b-0">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${item.completedAt ? "bg-emerald-100 text-emerald-800" : "bg-[var(--mikke-primary)] text-white"}`}>
          {item.completedAt ? <Check size={17} /> : item.orderIndex}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold">{item.participantName}</span>
          <span className="mt-0.5 block text-[11px] font-semibold text-[var(--mikke-muted)]">進捗 No.{item.currentManualNo}</span>
        </span>
        <ChevronDown size={17} className={`shrink-0 text-[var(--mikke-muted)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="space-y-3 bg-[var(--mikke-surface-soft)] px-4 pb-4 pt-1">
          {showTimer ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2">
              <Timer size={15} className="text-[var(--mikke-primary)]" />
              <span className="font-mono text-base font-extrabold tabular-nums">{formatElapsed(elapsedSeconds)}</span>
              <span className="mr-auto text-[11px] font-bold text-[var(--mikke-muted)]">{targetMinutes ? `目安 ${targetMinutes}分` : "目安時間未設定"}</span>
              <button type="button" onClick={onToggleTimer} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[var(--mikke-primary)] px-2.5 text-[11px] font-bold text-white">
              {timerRunning ? <Pause size={12} /> : <Play size={12} />}{timerRunning ? "一時停止" : elapsedSeconds ? "再開" : "スタート"}
              </button>
              <button type="button" onClick={onResetTimer} aria-label="タイマーをリセット" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"><RotateCcw size={13} /></button>
            </div>
          ) : null}
          {item.cautions ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">注意：{item.cautions}</p> : null}
          <div className="grid gap-2">
            <RatingRow label="受け答えのスムーズさ" value={assessment.responseSmoothness} onChange={(value) => setAssessment((current) => ({ ...current, responseSmoothness: value }))} />
            <RatingRow label="理解度" value={assessment.comprehension} onChange={(value) => setAssessment((current) => ({ ...current, comprehension: value }))} />
            <RatingRow label="発話の自信" value={assessment.speakingConfidence} onChange={(value) => setAssessment((current) => ({ ...current, speakingConfidence: value }))} />
          </div>
          <label className="block text-[11px] font-bold text-[var(--mikke-muted)]">
            次回担当への引継ぎ
            <textarea value={handoffNote} onChange={(event) => setHandoffNote(event.target.value)} rows={2} placeholder="できたこと、つまずいた点、次回試したいこと" className="mt-1 w-full resize-none rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs leading-5" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={saving} onClick={() => void save(false)} className="min-h-9 rounded-lg border border-[var(--mikke-primary)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50">
              {saving ? "保存中…" : "記録を保存"}
            </button>
            {!item.completedAt ? (
              <button type="button" disabled={saving} onClick={() => void save(true)} className="min-h-9 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                この生徒を完了して次へ
              </button>
            ) : <span className="text-xs font-bold text-emerald-700">対応済み</span>}
            <SaveFeedback notice={notice} />
          </div>
        </div>
      ) : null}
    </li>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold text-[var(--mikke-muted)]">{label}</span>
      <div className="flex gap-1" role="group" aria-label={`${label} 5段階評価`}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button key={rating} type="button" aria-pressed={value === rating} onClick={() => onChange(rating)} className={`grid h-7 w-7 place-items-center rounded-md text-[11px] font-extrabold ${value === rating ? "bg-[var(--mikke-primary)] text-white" : "border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"}`}>
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
}

function ManualPanel({
  manuals,
  selectedManualNo,
  onSelectManual,
  student,
  visible
}: {
  manuals: OperationsPartnerManual[];
  selectedManualNo: number;
  onSelectManual: (manualNo: number) => void;
  student: OperationsPartnerRosterItem | null;
  visible: boolean;
}) {
  const manual = manuals.find((item) => item.no === selectedManualNo) ?? null;
  return (
    <aside className={`${visible ? "flex" : "hidden"} min-h-0 flex-1 flex-col bg-white lg:flex`}>
      <div className="z-10 shrink-0 border-b border-[var(--mikke-line)] bg-white px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--mikke-primary)]"><BookOpen size={15} />進捗マニュアル</p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--mikke-muted)]">{student ? `${student.participantName}・現在 No.${student.currentManualNo}` : "生徒を選択してください"}</p>
          </div>
          {manual?.materialUrl ? <a href={manual.materialUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-2.5 py-1.5 text-xs font-bold text-[var(--mikke-primary)]">教材 <ExternalLink size={11} /></a> : null}
        </div>
        {manuals.length ? (
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="マニュアル番号">
            {manuals.map((item) => (
              <button key={item.no} type="button" onClick={() => onSelectManual(item.no)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-extrabold ${item.no === selectedManualNo ? "bg-[var(--mikke-primary)] text-white" : "border border-[var(--mikke-line)] bg-white text-[var(--mikke-primary)]"}`}>
                No.{item.no}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        {manual ? (
        <div className="py-4">
          <h3 className="text-base font-extrabold">No.{manual.no} {manual.title}</h3>
          {manual.body ? <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7">{manual.body}</p> : <p className="mt-3 text-xs font-semibold text-[var(--mikke-muted)]">本文はまだ登録されていません。</p>}
          <ManualList label="質問" values={manual.questions} />
          <ManualList label="表現" values={manual.expressions} />
          {manual.cautions ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">指導上の注意：{manual.cautions}</p> : null}
        </div>
        ) : <div className="py-4"><MikkeEmptyState title="この進捗のマニュアルは未登録です" /></div>}
      </div>
    </aside>
  );
}

function PartnerZoomSettings({ session, onUpdated }: { session: OperationsPartnerSession; onUpdated: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [useProjectDefault, setUseProjectDefault] = useState(session.zoomUsesProjectDefault);
  const [zoomUrl, setZoomUrl] = useState(session.zoomUrl ?? "");
  const [zoomMeetingId, setZoomMeetingId] = useState(session.zoomMeetingId ?? "");
  const [zoomPasscode, setZoomPasscode] = useState(session.zoomPasscode ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<SaveNotice>(null);

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      await updateOperationsPartnerSessionZoom(supabase, session.id, { useProjectDefault, zoomUrl, zoomMeetingId, zoomPasscode });
      setNotice({ tone: "success", text: "Zoom設定を保存しました。" });
      await onUpdated();
    } catch (error) {
      setNotice({ tone: "error", text: toErrorMessage(error, "Zoom設定を保存できませんでした。") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="mt-3">
      <summary className="cursor-pointer text-[11px] font-bold text-[var(--mikke-primary)]">この回のZoom情報を変更</summary>
      <div className="mt-2 grid gap-2 rounded-xl border border-[var(--mikke-line)] bg-white p-3">
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={useProjectDefault} onChange={(event) => setUseProjectDefault(event.target.checked)} />プロジェクト既定を使う</label>
        {!useProjectDefault ? (
          <>
            <input type="url" value={zoomUrl} onChange={(event) => setZoomUrl(event.target.value)} placeholder="Zoom URL" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={zoomMeetingId} onChange={(event) => setZoomMeetingId(event.target.value)} placeholder="ミーティングID" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs" />
              <input value={zoomPasscode} onChange={(event) => setZoomPasscode(event.target.value)} placeholder="パスコード" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs" />
            </div>
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? "保存中…" : "Zoom設定を保存"}</button>
          <SaveFeedback notice={notice} />
        </div>
      </div>
    </details>
  );
}

function LessonReport({ session, onSubmitted }: { session: OperationsPartnerSession; onSubmitted: () => Promise<void> }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<SaveNotice>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await submitOperationsPartnerReport(supabase, {
        projectId: session.projectId,
        sessionId: session.id,
        attendance: session.roster.map((item) => ({ rosterId: item.id, participantId: item.participantId, status: item.attendanceStatus })),
        progress: session.roster.map((item) => ({ participantId: item.participantId, manualNo: item.currentManualNo })),
        body
      });
      setNotice({ tone: "success", text: "本部へ報告を提出しました。" });
      await onSubmitted();
    } catch (error) {
      setNotice({ tone: "error", text: toErrorMessage(error, "報告を提出できませんでした。") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="border-t border-[var(--mikke-line)]">
      <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-[var(--mikke-primary)]">レッスン全体の報告</summary>
      <form onSubmit={submit} className="border-t border-[var(--mikke-line)] p-4">
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={2} placeholder="クラス全体の様子、本部への連絡" className="w-full resize-none rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving || session.reportSubmitted} className="rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{session.reportSubmitted ? "提出済み" : saving ? "提出中…" : "報告を提出"}</button>
          <SaveFeedback notice={notice} />
        </div>
      </form>
    </details>
  );
}

function PartnerOfferCards({ offers, responding, notice, onRespond }: { offers: OperationsPartnerPortalData["offers"]; responding: string | null; notice: SaveNotice; onRespond: (projectId: string, organizationMemberId: string, accept: boolean) => void }) {
  if (offers.length === 0) return null;
  return (
    <MikkeSection title="参加依頼" tone="editorial">
      <div className="space-y-3">
        {offers.map((offer) => (
          <article key={offer.projectId} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
            <p className="font-extrabold">{offer.projectTitle}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" disabled={responding === offer.projectId} onClick={() => onRespond(offer.projectId, offer.organizationMemberId, true)} className="rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">参加する</button>
              <button type="button" disabled={responding === offer.projectId} onClick={() => onRespond(offer.projectId, offer.organizationMemberId, false)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">辞退する</button>
              <SaveFeedback notice={notice} />
            </div>
          </article>
        ))}
      </div>
    </MikkeSection>
  );
}

function SaveFeedback({ notice }: { notice: SaveNotice }) {
  if (!notice) return null;
  return (
    <span role={notice.tone === "error" ? "alert" : "status"} className={`inline-flex items-center gap-1 text-xs font-bold ${notice.tone === "success" ? "text-emerald-700" : "text-red-700"}`}>
      {notice.tone === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {notice.text}
    </span>
  );
}

function PresenceBadge({ status }: { status: OperationsPartnerSession["partnerPresenceStatus"] }) {
  const labels = {
    not_started: "未開始",
    standby: "スタンバイ",
    in_progress: "実施中",
    ended: "終了"
  };
  const className = status === "standby" ? "bg-amber-100 text-amber-800" : status === "in_progress" ? "bg-emerald-100 text-emerald-800" : status === "ended" ? "bg-slate-200 text-slate-700" : "bg-white text-[var(--mikke-muted)]";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${className}`}>{labels[status]}</span>;
}

function ManualList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return <div className="mt-3 text-xs leading-5"><span className="font-bold">{label}：</span><span className="font-semibold text-[var(--mikke-muted)]">{values.join("／")}</span></div>;
}

function formatDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}（${"日月火水木金土"[date.getDay()]}）`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

function endTime(startTime: string, durationMin: number) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const total = hours * 60 + minutes + durationMin;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
