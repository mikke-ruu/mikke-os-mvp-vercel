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
import { useTeamWorksLabels } from "@/components/team-works/useTeamWorksLabels";
import { TeamWorksViewAsBanner, useIsViewAs, useViewAs } from "@/components/team-works/TeamWorksViewAsContext";
import { TeamWorksPartnerSelfProfile } from "@/components/team-works/operations/TeamWorksDirectorySelfProfile";
import { TeamWorksPartnerShiftPanel } from "@/components/team-works/operations/TeamWorksPartnerShiftPanel";
import { supabase } from "@/lib/supabase/client";
import {
  DEFAULT_WORK_WINDOW_SETTINGS,
  type TeamWorksWorkWindowSettings
} from "@/lib/team-works-feature-settings";
import {
  loadOperationsPartnerPortal,
  loadOperationsPartnerPortalAs,
  loadOperationsPartnerPortalPreview,
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

// viewAsMemberId(O-3): 本部staffが「その人として」スタッフポータルを見るモード。
// 読み込みをloadOperationsPartnerPortalAsに切り替え、TeamWorksViewAsProviderで
// 配下の操作ボタンを止める。通常のログイン表示ではundefined=既存の挙動。
export function TeamWorksOperationsPartnerPortal({ viewAsMemberId }: { viewAsMemberId?: string } = {}) {
  const [data, setData] = useState<OperationsPartnerPortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(
        viewAsMemberId
          ? await loadOperationsPartnerPortalAs(supabase, viewAsMemberId)
          : await loadOperationsPartnerPortal(supabase)
      );
    } catch (loadError) {
      setError(toErrorMessage(loadError, "担当スケジュールを読み込めませんでした。"));
    }
  }, [viewAsMemberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const { hasClient } = useTeamWorksPortalRoles();
  const labels = useTeamWorksLabels();
  const navItems: MikkeShellNavItem[] = [
    { label: `${labels.workers}ポータル`, href: "/apps/team-works/portal/worker", icon: Users },
    ...(hasClient ? [{ label: "クライアントポータル", href: "/apps/team-works/portal/client", icon: FolderKanban }] : [])
  ];

  return (
    <MikkeAppShell
      appName="Team Works"
      title={`${labels.workers}ポータル`}
      subtitle={`担当${labels.sessionNoun}を、名簿とマニュアルを見ながら進行`}
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

      <TeamWorksViewAsBanner />
      {!data && !error ? <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込み中…</p> : null}
      {error ? <MikkeEmptyState title="読み込みに失敗しました" helper={error} /> : null}
      {data ? <PartnerPortalBody data={data} onRefresh={load} /> : null}
    </MikkeAppShell>
  );
}

// K-2運営型プレビュー: 本部staffがプロジェクト詳細の「機能とポータルの設定」タブから
// 「担当パートナーにはこう見えます」を確認するための埋め込み用コンポーネント。
// アプリ全体のシェルは使わず、PartnerPortalBodyだけを読み取り専用で描画する
// (納品型のDeliveryPortalPreviewと同じ考え方)。
export function TeamWorksOperationsPartnerPortalPreview({
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
  const [data, setData] = useState<OperationsPartnerPortalData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await loadOperationsPartnerPortalPreview(supabase, projectId, targetOrganizationMemberId, sampleDisplayName));
    } catch (loadError) {
      setError(toErrorMessage(loadError, "プレビューを読み込めませんでした。"));
    }
  }, [projectId, targetOrganizationMemberId, sampleDisplayName]);

  useEffect(() => { void load(); }, [load]);

  if (error) return <MikkeEmptyState title="読み込みに失敗しました" helper={error} />;
  if (data === undefined) return <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;
  if (!data || data.projectCount === 0) {
    return <MikkeEmptyState title="この担当者の表示を確認できません" helper="対象者がこのプロジェクトの担当メンバーか確認してください。" />;
  }

  return (
    <div className={readOnly ? "pointer-events-none select-none" : ""}>
      <PartnerPortalBody data={data} onRefresh={load} />
    </div>
  );
}

// viewAsMemberId(O-3): 作業窓こそ本部が一番確認したい画面(あゆみ「作業窓についても
// 見たいです」)。埋め込みプレビューはpointer-events-noneでコマを開けなかったため、
// ここを「〜として表示」で直接開けるようにした。
export function TeamWorksPartnerLessonWindow({ sessionId, viewAsMemberId }: { sessionId: string; viewAsMemberId?: string }) {
  const labels = useTeamWorksLabels();
  const [data, setData] = useState<OperationsPartnerPortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(
        viewAsMemberId
          ? await loadOperationsPartnerPortalAs(supabase, viewAsMemberId)
          : await loadOperationsPartnerPortal(supabase)
      );
    } catch (loadError) {
      setError(toErrorMessage(loadError, `${labels.sessionNoun}を読み込めませんでした。`));
    }
  }, [labels.sessionNoun, viewAsMemberId]);

  useEffect(() => { void load(); }, [load]);
  const session = data ? [...data.today, ...data.upcoming].find((item) => item.id === sessionId) ?? null : null;
  const workWindow = data && session ? data.projects.find((project) => project.id === session.projectId)?.featureSettings.workWindow ?? DEFAULT_WORK_WINDOW_SETTINGS : DEFAULT_WORK_WINDOW_SETTINGS;

  if (error) return <main className="grid h-dvh place-items-center bg-[var(--mikke-surface-soft)] p-4"><MikkeEmptyState title={`${labels.sessionNoun}を開けませんでした`} helper={error} /></main>;
  if (!data) return <main className="grid h-dvh place-items-center bg-[var(--mikke-surface-soft)]"><p className="text-sm font-bold text-[var(--mikke-muted)]">読み込み中…</p></main>;
  if (!session) return <main className="grid h-dvh place-items-center bg-[var(--mikke-surface-soft)] p-4"><MikkeEmptyState title={`この${labels.sessionNoun}は表示できません`} helper="担当変更または日程変更後の可能性があります。スケジュールから開き直してください。" /></main>;
  // 通常のスタッフ表示では従来どおり作業窓だけを全画面で出す(バナー用の枠も作らない)。
  if (!viewAsMemberId) {
    return <main className="h-dvh overflow-hidden bg-white"><TeamWorksPartnerLessonConsole session={session} onRefresh={load} standalone workWindow={workWindow} /></main>;
  }
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-white">
      <div className="shrink-0 px-3 pt-3"><TeamWorksViewAsBanner /></div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <TeamWorksPartnerLessonConsole session={session} onRefresh={load} standalone workWindow={workWindow} />
      </div>
    </main>
  );
}

function PartnerPortalBody({ data, onRefresh }: { data: OperationsPartnerPortalData; onRefresh: () => Promise<void> }) {
  const labels = useTeamWorksLabels();
  const sessions = useMemo(() => [...data.today, ...data.upcoming], [data.today, data.upcoming]);
  const projects = data.projects;
  // 担当プロジェクトが1件もshifts=trueで無ければ「希望シフトを提出」自体を隠す。
  // プロジェクトがまだ無い(新規パートナー等)場合は従来どおり表示する。
  const shiftsEnabled = projects.length === 0 || projects.some((project) => project.featureSettings.shifts);
  const [activeView, setActiveView] = useState("home");
  const [projectTab, setProjectTab] = useState<"calendar" | "schedule" | "manuals">("calendar");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [responding, setResponding] = useState<string | null>(null);
  const [responseNotice, setResponseNotice] = useState<SaveNotice>(null);

  useEffect(() => {
    if (activeView === "shifts" && !shiftsEnabled) {
      setActiveView("home");
      return;
    }
    if (!["home", "shifts"].includes(activeView) && !projects.some((project) => project.id === activeView)) {
      setActiveView("home");
    }
  }, [activeView, projects, shiftsEnabled]);

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

      <nav aria-label={`${labels.workers}ポータル内のページ`} className="flex gap-1 overflow-x-auto border-b border-[var(--mikke-line)]">
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

      {activeView === "shifts" && shiftsEnabled ? (
        <TeamWorksPartnerShiftPanel />
      ) : activeView === "home" ? (
        <PartnerHome
          data={data}
          sessions={sessions}
          shiftsEnabled={shiftsEnabled}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenProject={(projectId, tab) => { setActiveView(projectId); setProjectTab(tab); }}
          onOpenShifts={() => setActiveView("shifts")}
        />
      ) : projects.some((project) => project.id === activeView) ? (
        <PartnerProject
          project={projects.find((project) => project.id === activeView)!}
          projectId={activeView}
          sessions={sessions}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          tab={projectTab}
          onTabChange={setProjectTab}
        />
      ) : (
        <MikkeEmptyState
          title={`担当${labels.sessionNoun}はありません`}
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
  shiftsEnabled,
  selectedDate,
  onSelectDate,
  onOpenProject,
  onOpenShifts
}: {
  data: OperationsPartnerPortalData;
  sessions: OperationsPartnerSession[];
  shiftsEnabled: boolean;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenProject: (projectId: string, tab: "calendar" | "schedule" | "manuals") => void;
  onOpenShifts: () => void;
}) {
  const labels = useTeamWorksLabels();
  const daySessions = sessions.filter((session) => session.sessionDate === selectedDate);
  const nextSession = sessions[0] ?? null;
  const workWindowByProjectId = new Map(data.projects.map((project) => [project.id, project.featureSettings.workWindow]));
  const workWindowFor = (session: OperationsPartnerSession) => workWindowByProjectId.get(session.projectId) ?? DEFAULT_WORK_WINDOW_SETTINGS;
  return (
    <div className="space-y-7">
      <MikkeSection title="総合カレンダー" tone="editorial">
        <p className="-mt-2 mb-4 text-xs font-semibold text-[var(--mikke-muted)]">担当中の全プロジェクトをまとめて表示します。予定から{labels.sessionNoun}専用画面を別窓で開けます。</p>
        <ClientMonthCalendar sessions={sessions} holidays={[]} selectedDate={selectedDate} onSelectDate={onSelectDate} />
        <div className="mt-4 space-y-2">
          {daySessions.length ? daySessions.map((session) => <PartnerScheduleRow key={session.id} session={session} workWindow={workWindowFor(session)} />) : <MikkeEmptyState title="この日の担当はありません" />}
        </div>
      </MikkeSection>
      <MikkeSection title="本日のスケジュール" tone="editorial">
        {data.today.length ? <div className="space-y-2">{data.today.map((session) => <PartnerScheduleRow key={session.id} session={session} workWindow={workWindowFor(session)} />)}</div> : <MikkeEmptyState title="本日の担当はありません" />}
      </MikkeSection>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shiftsEnabled ? (
          <PartnerHomeAction
            icon={<CalendarCheck2 size={18} />}
            title="希望シフトを提出"
            detail="稼働できる日を本部へ共有"
            onClick={onOpenShifts}
            tone="yellow"
          />
        ) : null}
        <PartnerHomeAction
          icon={<CalendarDays size={18} />}
          title={`次回${labels.sessionNoun}`}
          detail={nextSession ? `${nextSession.projectTitle}・${formatDate(nextSession.sessionDate)} ${nextSession.startTime}` : "予定はありません"}
          onClick={nextSession ? () => onOpenProject(nextSession.projectId, "schedule") : undefined}
          tone="pink"
        />
        <PartnerHomeAction icon={<UsersRound size={18} />} title="本日の担当" detail={`${data.today.length}件`} tone="green" />
        <PartnerHomeAction icon={<List size={18} />} title="30日以内" detail={`${sessions.length}件`} onClick={nextSession ? () => onOpenProject(nextSession.projectId, "schedule") : undefined} tone="orange" />
      </div>
    </div>
  );
}

function PartnerProject({
  project,
  projectId,
  sessions,
  selectedDate,
  onSelectDate,
  tab,
  onTabChange
}: {
  project: OperationsPartnerPortalData["projects"][number];
  projectId: string;
  sessions: OperationsPartnerSession[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  tab: "calendar" | "schedule" | "manuals";
  onTabChange: (tab: "calendar" | "schedule" | "manuals") => void;
}) {
  const labels = useTeamWorksLabels();
  const projectSessions = sessions.filter((session) => session.projectId === projectId);
  const title = project.title;
  const daySessions = projectSessions.filter((session) => session.sessionDate === selectedDate);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-extrabold">{title}</p>
        <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">担当{labels.sessionNoun}だけを表示しています。</p>
      </div>
      {project.description ? (
        <p className="whitespace-pre-wrap rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 text-xs font-semibold leading-6 text-[var(--mikke-muted)]">
          {project.description}
        </p>
      ) : null}
      <nav className="flex gap-1 rounded-xl bg-[var(--mikke-surface-soft)] p-1" aria-label={`${title}内のページ`}>
        <button type="button" onClick={() => onTabChange("calendar")} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold ${tab === "calendar" ? "bg-white text-[var(--mikke-primary)] shadow-sm" : "text-[var(--mikke-muted)]"}`}><CalendarDays size={14} />カレンダー</button>
        <button type="button" onClick={() => onTabChange("schedule")} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold ${tab === "schedule" ? "bg-white text-[var(--mikke-primary)] shadow-sm" : "text-[var(--mikke-muted)]"}`}><List size={14} />スケジュール</button>
        {project.featureSettings.manuals ? (
          <button type="button" onClick={() => onTabChange("manuals")} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold ${tab === "manuals" ? "bg-white text-[var(--mikke-primary)] shadow-sm" : "text-[var(--mikke-muted)]"}`}><BookOpen size={14} />{labels.manualNoun}</button>
        ) : null}
      </nav>
      {tab === "calendar" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
          <MikkeSection title="カレンダー" tone="editorial">
            <ClientMonthCalendar sessions={projectSessions} holidays={[]} selectedDate={selectedDate} onSelectDate={onSelectDate} />
          </MikkeSection>
          <MikkeSection title={`${formatDate(selectedDate)} の担当`} tone="editorial">
            {daySessions.length ? <div className="space-y-2">{daySessions.map((session) => <PartnerScheduleRow key={session.id} session={session} workWindow={project.featureSettings.workWindow} />)}</div> : <MikkeEmptyState title="この日の担当はありません" />}
          </MikkeSection>
        </div>
      ) : tab === "schedule" ? (
        <MikkeSection title="スケジュール" tone="editorial">
          <p className="-mt-2 mb-4 text-xs font-semibold text-[var(--mikke-muted)]">「{labels.sessionNoun}画面」を押すと、Zoomの横に置ける専用窓で開きます。</p>
          <div className="space-y-2">{projectSessions.map((session) => <PartnerScheduleRow key={session.id} session={session} workWindow={project.featureSettings.workWindow} />)}</div>
        </MikkeSection>
      ) : project.featureSettings.manuals ? (
        <PartnerManualLibrary manuals={project.manuals} />
      ) : null}
    </div>
  );
}

function PartnerManualLibrary({ manuals }: { manuals: OperationsPartnerManual[] }) {
  const labels = useTeamWorksLabels();
  const [selectedManualNo, setSelectedManualNo] = useState(manuals[0]?.no ?? 1);
  useEffect(() => {
    if (!manuals.some((manual) => manual.no === selectedManualNo)) {
      setSelectedManualNo(manuals[0]?.no ?? 1);
    }
  }, [manuals, selectedManualNo]);
  const manual = manuals.find((item) => item.no === selectedManualNo) ?? null;

  return (
    <MikkeSection title={labels.manualNoun} tone="editorial">
      <p className="-mt-2 mb-4 text-xs font-semibold text-[var(--mikke-muted)]">{`担当予定がない日も、プロジェクトの${labels.manualNoun}をいつでも確認できます。`}</p>
      {manuals.length ? (
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="space-y-2" aria-label={`${labels.manualNoun}一覧`}>
            {manuals.map((item) => (
              <button
                key={item.no}
                type="button"
                onClick={() => setSelectedManualNo(item.no)}
                className={`w-full rounded-xl border px-3 py-3 text-left text-sm font-bold ${item.no === selectedManualNo ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]" : "border-[var(--mikke-line)] bg-white"}`}
              >
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]">No.{item.no}</span>
                <span className="mt-1 block">{item.title}</span>
              </button>
            ))}
          </nav>
          {manual ? (
            <article className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-lg font-extrabold">No.{manual.no} {manual.title}</h3>
                {manual.materialUrl ? <a href={manual.materialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">教材 <ExternalLink size={12} /></a> : null}
              </div>
              {manual.body ? <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-7">{manual.body}</p> : <p className="mt-4 text-xs font-semibold text-[var(--mikke-muted)]">本文はまだ登録されていません。</p>}
              <ManualList label="質問" values={manual.questions} />
              <ManualList label="表現" values={manual.expressions} />
              {manual.cautions ? <p className="mt-3 rounded-xl bg-[var(--tw-deadline)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--tw-on-tint)]">指導上の注意：{manual.cautions}</p> : null}
            </article>
          ) : null}
        </div>
      ) : <MikkeEmptyState title={`${labels.manualNoun}はまだ共有されていません`} helper={`本部の${labels.manualNoun}管理で「組織共有」を有効にすると表示されます。`} />}
    </MikkeSection>
  );
}

// 作業窓(N-2): 部品が全てOFFなら「レッスン画面」を開く導線自体を隠す
// (開いても何も操作できる部品が無いため)。
function isWorkWindowAllOff(workWindow: TeamWorksWorkWindowSettings): boolean {
  return !workWindow.zoom && !workWindow.presence && !workWindow.timer && !workWindow.roster && !workWindow.manualLink;
}

function PartnerScheduleRow({ session, workWindow }: { session: OperationsPartnerSession; workWindow: TeamWorksWorkWindowSettings }) {
  const labels = useTeamWorksLabels();
  const viewAs = useViewAs();
  const targetMinutes = session.roster.length ? Math.floor(session.durationMin / session.roster.length) : null;
  const showLessonWindowLink = !isWorkWindowAllOff(workWindow);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--mikke-line)] bg-white p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-[var(--mikke-primary)]">{formatDate(session.sessionDate)}・{session.projectTitle}</p>
        <p className="mt-1 text-sm font-extrabold">{session.startTime}〜{endTime(session.startTime, session.durationMin)}　{session.roster.length}名</p>
        <p className="mt-1 text-[11px] font-semibold text-[var(--mikke-muted)]">{targetMinutes ? `1人あたり目安 ${targetMinutes}分` : `${labels.rosterNoun}未設定`}{session.zoomMeetingId ? ` ／ Zoom ID ${session.zoomMeetingId}` : ""}</p>
        {session.workDescription ? <p className="mt-1 text-[11px] font-semibold text-[var(--mikke-text)]">作業内容：{session.workDescription}</p> : null}
      </div>
      {showLessonWindowLink ? (
        <button type="button" onClick={() => openLessonWindow(session.id, viewAs?.organizationMemberId)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--tw-action)] px-4 py-2 text-xs font-bold text-[var(--tw-on-solid)]">
          <ExternalLink size={14} />{labels.sessionNoun}画面
        </button>
      ) : null}
    </article>
  );
}

function PartnerHomeAction({ icon, title, detail, onClick, tone = "green" }: { icon: React.ReactNode; title: string; detail: string; onClick?: () => void; tone?: "green" | "orange" | "pink" | "yellow" }) {
  const toneClass = {
    green: "border-[#8bc7ad] bg-[#8bc7ad]/20",
    orange: "border-[#f75a3b]/50 bg-[#f75a3b]/10",
    pink: "border-[#f9d3d2] bg-[#f9d3d2]/35",
    yellow: "border-[#ffd370] bg-[#ffd370]/25"
  }[tone];
  const content = <><div className="flex items-center gap-2 text-[var(--mikke-primary)]">{icon}<span className="text-xs font-bold">{title}</span></div><p className="mt-3 text-sm font-extrabold">{detail}</p></>;
  return onClick ? <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${toneClass}`}>{content}</button> : <div className={`rounded-2xl border p-4 ${toneClass}`}>{content}</div>;
}

function PartnerProfileDetails() {
  const labels = useTeamWorksLabels();
  return (
    <details className="rounded-2xl border border-[var(--mikke-line)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold">{labels.workers}情報<ChevronDown size={16} /></summary>
      <div className="border-t border-[var(--mikke-line)] p-4"><TeamWorksPartnerSelfProfile /></div>
    </details>
  );
}

// 表示モード中は作業窓のURLにも as= を引き継ぐ(引き継がないと別窓が
// 「本人=staff」として開いてしまい、担当コマが無いので何も出ない)。
function openLessonWindow(sessionId: string, viewAsMemberId?: string) {
  const url = viewAsMemberId
    ? `/apps/team-works/portal/worker/lesson/${sessionId}?as=${encodeURIComponent(viewAsMemberId)}`
    : `/apps/team-works/portal/worker/lesson/${sessionId}`;
  const popup = window.open(url, `team-works-lesson-${sessionId}`, "popup=yes,width=920,height=900,resizable=yes,scrollbars=no");
  if (!popup) window.location.href = url;
}

export function TeamWorksPartnerLessonConsole({
  session,
  onRefresh,
  standalone = false,
  workWindow = DEFAULT_WORK_WINDOW_SETTINGS
}: {
  session: OperationsPartnerSession;
  onRefresh: () => Promise<void>;
  standalone?: boolean;
  workWindow?: TeamWorksWorkWindowSettings;
}) {
  const labels = useTeamWorksLabels();
  const isViewAs = useIsViewAs();
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

  async function changePresence(next: "not_started" | "standby" | "in_progress" | "ended") {
    setPresenceBusy(true);
    setPresenceNotice(null);
    try {
      await updateOperationsPartnerPresence(supabase, session.id, next);
      setPresence(next);
      if (next === "standby") setControlsCollapsed(true);
      if (next === "not_started") setControlsCollapsed(false);
      if (next === "ended") setTimerRunning(false);
      setPresenceNotice({
        tone: "success",
        text: next === "not_started"
          ? `${labels.startAction}前に戻しました。`
          : next === "standby"
            ? `本部へ${labels.startAction}を通知しました。`
            : next === "ended"
              ? `${labels.endAction}を通知しました。`
              : `本部へ${labels.sessionNoun}開始を通知しました。`
      });
      await onRefresh();
      return true;
    } catch (error) {
      setPresenceNotice({ tone: "error", text: toErrorMessage(error, "状態を更新できませんでした。") });
      return false;
    } finally {
      setPresenceBusy(false);
    }
  }

  async function toggleTimer() {
    if (timerRunning) {
      setTimerRunning(false);
      return;
    }

    const isFirstParticipant = selectedStudent?.orderIndex === 1;
    if (isFirstParticipant && presence !== "in_progress") {
      const started = await changePresence("in_progress");
      if (!started) return;
    }
    setTimerRunning(true);
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
              {workWindow.zoom && !controlsCollapsed && session.zoomMeetingId ? <span>Zoom ID {session.zoomMeetingId}</span> : null}
              {workWindow.zoom && !controlsCollapsed && session.zoomPasscode ? <span>パスコード {session.zoomPasscode}</span> : null}
            </p>
            {session.workDescription ? (
              <p className="mt-1 text-xs font-bold text-[var(--mikke-text)]">作業内容：{session.workDescription}</p>
            ) : null}
          </div>
          {!workWindow.presence && !workWindow.zoom ? null : controlsCollapsed && workWindow.presence ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <SaveFeedback notice={presenceNotice} />
              <button type="button" onClick={() => setControlsCollapsed(false)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-white px-3 text-[11px] font-bold text-[var(--mikke-primary)]">
                操作を表示 <ChevronDown size={13} />
              </button>
            </div>
          ) : (
          <div className="flex flex-wrap items-center gap-2">
            {workWindow.presence ? (
              <>
                {presence === "not_started" ? (
                  <button type="button" disabled={presenceBusy || isViewAs} onClick={() => void changePresence("standby")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--mikke-primary)] bg-white px-4 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50">
                    <Check size={15} />{labels.startAction}
                  </button>
                ) : null}
                {presence === "standby" ? (
                  <>
                    <button type="button" disabled={presenceBusy || isViewAs} onClick={() => void changePresence("in_progress")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--tw-action)] px-4 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
                      <Play size={14} />{labels.sessionNoun}開始
                    </button>
                    <button type="button" disabled={presenceBusy || isViewAs} onClick={() => void changePresence("not_started")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50">
                      <RotateCcw size={13} />{labels.startAction}前に戻す
                    </button>
                  </>
                ) : null}
                {presence === "in_progress" ? (
                  <button type="button" disabled={presenceBusy || isViewAs} onClick={() => void changePresence("standby")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50">
                    <RotateCcw size={13} />{labels.startAction}に戻す
                  </button>
                ) : null}
              </>
            ) : null}
            {workWindow.zoom ? (
              session.zoomUrl ? (
                <a href={session.zoomUrl} target="_blank" rel="noreferrer" onClick={() => setControlsCollapsed(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#2d8cff] px-4 py-2 text-xs font-bold text-white">
                  <ExternalLink size={14} />Zoomを開く
                </a>
              ) : (
                <span className="inline-flex min-h-10 items-center rounded-xl border border-dashed border-[var(--mikke-line)] px-3 text-xs font-bold text-[var(--mikke-muted)]">Zoomリンク未設定</span>
              )
            ) : null}
            {workWindow.presence ? (
              <>
                {presence !== "ended" ? (
                  <button type="button" disabled={presenceBusy || isViewAs} onClick={() => void changePresence("ended")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--tw-action)] bg-white px-4 py-2 text-xs font-bold text-[var(--tw-action)] disabled:opacity-50">
                    <Square size={13} />{labels.endAction}
                  </button>
                ) : (
                  <button type="button" disabled={presenceBusy || isViewAs} onClick={() => void changePresence("in_progress")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--mikke-primary)] bg-white px-4 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50">
                    <RotateCcw size={13} />{labels.sessionNoun}中に戻す
                  </button>
                )}
                <SaveFeedback notice={presenceNotice} />
                {presence !== "not_started" ? (
                  <button type="button" onClick={() => setControlsCollapsed(true)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white px-3 text-xs font-bold text-[var(--mikke-primary)]">
                    操作を畳む <ChevronDown size={13} className="rotate-180" />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
          )}
        </div>
        {workWindow.zoom && !controlsCollapsed ? <PartnerZoomSettings session={session} onUpdated={onRefresh} /> : null}
      </header>

      {!workWindow.roster ? null : session.roster.length ? (
        <div className="relative flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(380px,1.05fr)_minmax(300px,0.95fr)]">
          <MobileStudentDock
            roster={session.roster}
            selectedStudent={selectedStudent}
            onSelectStudent={setSelectedRosterId}
            targetMinutes={targetMinutes}
            elapsedSeconds={elapsedSeconds}
            timerRunning={timerRunning}
            onToggleTimer={() => void toggleTimer()}
            onResetTimer={() => { setTimerRunning(false); setElapsedSeconds(0); }}
            onOpenRecord={() => setMobileRecordOpen(true)}
            showTimer={workWindow.timer}
          />
          <section className="hidden min-h-0 flex-col border-r border-[var(--mikke-line)] lg:flex">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--mikke-line)] px-4 py-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--mikke-primary)]">{labels.attendanceNoun}順</p>
                <p className="mt-0.5 text-[11px] font-semibold text-[var(--mikke-muted)]">{targetMinutes ? `1人あたり目安 ${targetMinutes}分` : `${labels.participantNoun}を押すと評価・引継ぎを開きます`}</p>
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
                  onToggleTimer={() => void toggleTimer()}
                  onResetTimer={() => { setTimerRunning(false); setElapsedSeconds(0); }}
                  showTimer={workWindow.timer}
                />
              ))}
            </ol>
            <LessonReport session={session} onSubmitted={onRefresh} />
          </section>
          {workWindow.manualLink ? (
            <ManualPanel
              manuals={session.manuals}
              selectedManualNo={selectedManualNo}
              onSelectManual={setSelectedManualNo}
              student={selectedStudent}
              visible
            />
          ) : null}
          {mobileRecordOpen && selectedStudent ? (
            <section className="absolute inset-x-0 bottom-0 z-30 flex max-h-[72%] flex-col overflow-hidden rounded-t-2xl border border-[var(--mikke-line)] bg-white shadow-2xl lg:hidden">
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--mikke-line)] bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-extrabold">{selectedStudent.participantName}の記録</p>
                  <p className="text-[11px] font-semibold text-[var(--mikke-muted)]">{`タイマーと${labels.manualNoun}は背面上部に残ります`}</p>
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
                  onToggleTimer={() => void toggleTimer()}
                  onResetTimer={() => { setTimerRunning(false); setElapsedSeconds(0); }}
                  showTimer={false}
                />
              </ol>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="p-5">
          <MikkeEmptyState title={`${labels.rosterNoun}はまだ設定されていません`} helper={`本部が${labels.attendanceNoun}順を設定すると、この画面に表示されます。`} />
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
  onOpenRecord,
  showTimer = true
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
  showTimer?: boolean;
}) {
  // フックは早期returnより前に呼ぶ必要があるためここで取得する。
  const labels = useTeamWorksLabels();
  if (!selectedStudent) return null;

  return (
    <section className="shrink-0 border-b border-[var(--mikke-line)] bg-white lg:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">{selectedStudent.participantName}</p>
          <p className="mt-0.5 text-[10px] font-bold text-[var(--mikke-muted)]">
            {labels.attendanceNoun}順 {selectedStudent.orderIndex}・進捗 No.{selectedStudent.currentManualNo}
            {targetMinutes ? `・目安 ${targetMinutes}分` : ""}
          </p>
        </div>
        {showTimer ? (
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
        ) : null}
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--mikke-line)] px-3 py-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5" aria-label={`${labels.participantNoun}を選択`}>
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
                    ? "bg-[var(--tw-done)] text-[var(--tw-on-tint)]"
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
  const isViewAs = useIsViewAs();
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
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${item.completedAt ? "bg-[var(--tw-done)] text-[var(--tw-on-tint)]" : "bg-[var(--mikke-primary)] text-white"}`}>
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
          {item.cautions ? <p className="rounded-xl bg-[var(--tw-deadline)] px-3 py-2 text-xs font-semibold text-[var(--tw-on-tint)]">注意：{item.cautions}</p> : null}
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
            <button type="button" disabled={saving || isViewAs} onClick={() => void save(false)} className="min-h-9 rounded-lg border border-[var(--mikke-primary)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50">
              {saving ? "保存中…" : "記録を保存"}
            </button>
            {!item.completedAt ? (
              <button type="button" disabled={saving || isViewAs} onClick={() => void save(true)} className="min-h-9 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
                この生徒を完了して次へ
              </button>
            ) : <span className="text-xs font-bold text-[var(--tw-on-tint)]">対応済み</span>}
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
          {manual.cautions ? <p className="mt-3 rounded-xl bg-[var(--tw-deadline)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--tw-on-tint)]">指導上の注意：{manual.cautions}</p> : null}
        </div>
        ) : <div className="py-4"><MikkeEmptyState title="この進捗のマニュアルは未登録です" /></div>}
      </div>
    </aside>
  );
}

function PartnerZoomSettings({ session, onUpdated }: { session: OperationsPartnerSession; onUpdated: () => Promise<void> }) {
  const isViewAs = useIsViewAs();
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
          <button type="button" disabled={saving || isViewAs} onClick={() => void save()} className="rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">{saving ? "保存中…" : "Zoom設定を保存"}</button>
          <SaveFeedback notice={notice} />
        </div>
      </div>
    </details>
  );
}

function LessonReport({ session, onSubmitted }: { session: OperationsPartnerSession; onSubmitted: () => Promise<void> }) {
  const labels = useTeamWorksLabels();
  const isViewAs = useIsViewAs();
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
      setNotice({ tone: "success", text: `本部へ${labels.reportNoun}を提出しました。` });
      await onSubmitted();
    } catch (error) {
      setNotice({ tone: "error", text: toErrorMessage(error, `${labels.reportNoun}を提出できませんでした。`) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="border-t border-[var(--mikke-line)]">
      <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-[var(--mikke-primary)]">{labels.sessionNoun}全体の報告</summary>
      <form onSubmit={submit} className="border-t border-[var(--mikke-line)] p-4">
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={2} placeholder="クラス全体の様子、本部への連絡" className="w-full resize-none rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving || isViewAs || session.reportSubmitted} className="rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">{session.reportSubmitted ? "提出済み" : saving ? "提出中…" : `${labels.reportNoun}を提出`}</button>
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
              <button type="button" disabled={responding === offer.projectId} onClick={() => onRespond(offer.projectId, offer.organizationMemberId, true)} className="rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">参加する</button>
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
    <span role={notice.tone === "error" ? "alert" : "status"} className={`inline-flex items-center gap-1 text-xs font-bold ${notice.tone === "success" ? "text-[var(--tw-on-tint)]" : "text-[var(--tw-action)]"}`}>
      {notice.tone === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {notice.text}
    </span>
  );
}

function PresenceBadge({ status }: { status: OperationsPartnerSession["partnerPresenceStatus"] }) {
  const orgLabels = useTeamWorksLabels();
  const statusLabels = {
    not_started: "未開始",
    standby: orgLabels.startAction,
    in_progress: "実施中",
    ended: "終了"
  };
  const className =
    status === "standby"
      ? "bg-[var(--tw-planned)] text-[var(--tw-on-tint)]"
      : status === "in_progress"
        ? "bg-[var(--tw-done)] text-[var(--tw-on-tint)]"
        : status === "ended"
          ? "border border-[var(--mikke-line)] text-[var(--mikke-muted)]"
          : "bg-white text-[var(--mikke-muted)]";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${className}`}>{statusLabels[status]}</span>;
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
