"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Languages,
  MessageCircle,
  RotateCcw,
  Save,
  Send,
  Timer,
  Type,
  UserRound,
  Video
} from "lucide-react";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import {
  createTeamWorksId,
  formatSessionTime,
  statusLabel,
  teamWorksInitialState,
  teamWorksNav,
  teamWorksSchemaPlan,
  teamWorksTemplate,
  teamWorksViews,
  type AdminStatus,
  type AttendanceEntry,
  type AttendanceStatus,
  type ClientStatus,
  type PartnerAvailability,
  type SessionStatus,
  type TeamWorksClient,
  type TeamWorksGuideItem,
  type TeamWorksParticipant,
  type TeamWorksReport,
  type TeamWorksSession,
  type TeamWorksState,
  type TeamWorksView,
  type TeamWorksWorker,
  type WorkerStatus
} from "@/lib/team-works";

const storageKey = "mikke-os-team-works-local-v3";
const oldStorageKey = "mikke-os-team-works-local-v2";
const textScaleKey = "mikke-os-text-scale";
const modeKey = "mikke-os-team-works-view-mode";
const weekDays = ["月", "火", "水", "木", "金", "土", "日"];
type TextScale = "standard" | "large";
type ViewMode = "admin" | "worker" | "client";

export function TeamWorksScreen({ view }: { view: TeamWorksView }) {
  const [mode, setMode] = useState<ViewMode>(() => modeForView(view));
  const effectiveView = allowedViewsForMode(mode).includes(view) ? view : defaultViewForMode(mode);
  const config = teamWorksViews[effectiveView];
  const Icon = config.icon;
  const [state, setState] = useState<TeamWorksState>(teamWorksInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [textScale, setTextScale] = useState<TextScale>("standard");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const savedTextScale = window.localStorage.getItem(textScaleKey);
    const savedMode = window.localStorage.getItem(modeKey);
    if (view === "workerPortal" || view === "clientPortal") {
      setMode(modeForView(view));
    } else if (savedMode === "admin" || savedMode === "worker" || savedMode === "client") {
      setMode(savedMode);
    }
    if (savedTextScale === "large" || savedTextScale === "standard") {
      setTextScale(savedTextScale);
      applyTextScale(savedTextScale);
    }
    if (saved) {
      try {
        setState(normalizeState(JSON.parse(saved)));
      } catch {
        setState(teamWorksInitialState);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(modeKey, mode);
    }
  }, [hydrated, mode]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [hydrated, state]);

  useEffect(() => {
    applyTextScale(textScale);
    if (hydrated) {
      window.localStorage.setItem(textScaleKey, textScale);
    }
  }, [hydrated, textScale]);

  const helpers = useMemo(() => createHelpers(state), [state]);
  const payoutRows = useMemo(() => createPayoutRows(state), [state]);
  const unassignedCount = state.sessions.filter((session) => session.status === "unassigned").length;
  const reportWaitingCount = state.reports.filter((report) => report.adminStatus !== "reviewed").length;
  const completedCount = state.sessions.filter((session) => session.status === "completed").length;
  const payoutTotal = payoutRows.reduce((sum, row) => sum + row.amount, 0);
  const visibleNav = getVisibleNav(effectiveView, mode);
  const metrics = createViewMetrics({
    view: effectiveView,
    state,
    payoutRows,
    payoutTotal,
    unassignedCount,
    reportWaitingCount,
    completedCount
  });

  function updateState(next: TeamWorksState) {
    setState(next);
  }

  function resetDemoData() {
    setState(teamWorksInitialState);
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(oldStorageKey);
  }

  const pageContent = (
    <>
      {effectiveView === "home" ? (
        <OperationsDashboardView state={state} helpers={helpers} payoutTotal={payoutTotal} reportWaitingCount={reportWaitingCount} />
      ) : null}
      {effectiveView === "dashboard" ? (
        <OperationsDashboardView state={state} helpers={helpers} payoutTotal={payoutTotal} reportWaitingCount={reportWaitingCount} />
      ) : null}
      {effectiveView === "clients" ? <ClientsView state={state} updateState={updateState} /> : null}
      {effectiveView === "participants" ? <ParticipantsView state={state} updateState={updateState} helpers={helpers} /> : null}
      {effectiveView === "workers" ? <WorkersView state={state} updateState={updateState} /> : null}
      {effectiveView === "sessions" ? <SessionsView state={state} updateState={updateState} helpers={helpers} /> : null}
      {effectiveView === "assignments" ? <AssignmentsView state={state} updateState={updateState} helpers={helpers} /> : null}
      {effectiveView === "guides" ? <GuidesView state={state} updateState={updateState} /> : null}
      {effectiveView === "reports" ? <ReportsView state={state} updateState={updateState} helpers={helpers} /> : null}
      {effectiveView === "payouts" ? <PayoutsView rows={payoutRows} /> : null}
      {effectiveView === "invoices" ? <InvoicesView state={state} helpers={helpers} /> : null}
      {effectiveView === "clientPortal" ? <ClientPortalView state={state} updateState={updateState} helpers={helpers} /> : null}
      {effectiveView === "workerPortal" ? <WorkerPortalView state={state} updateState={updateState} helpers={helpers} /> : null}
    </>
  );

  return (
    <MikkeAppShell appName="Team Works" title={config.title} subtitle={config.description} currentApp={{ label: "Team", href: "/apps/team-works" }}>
      <div className="tw-app" data-text-scale={textScale}>
        <div className="tw-workspace">
          <DesktopSidebar view={effectiveView} mode={mode} setMode={setMode} />
          <main className="tw-main tw-page-stack">
        <section className="tw-compact-header">
          <p className="tw-helper font-bold uppercase tracking-[0.14em] text-[var(--mikke-accent)]">Team Works</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]">
              <Icon size={21} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold tracking-normal text-[var(--mikke-primary)]">{config.title}</h2>
              <p className="tw-helper mt-0.5">{config.description}</p>
            </div>
          </div>
        </section>

        <div className="lg:hidden">
          <ModeSwitcher mode={mode} setMode={setMode} />
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metrics.map((metric) => (
            <Metric key={metric.label} {...metric} />
          ))}
        </section>

        <nav className="tw-tabs lg:hidden">
          <div className="flex gap-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 rounded-full px-3 py-2 text-center text-[length:var(--font-nav)] font-bold ${
                  item.view === effectiveView ? "tw-tab-active bg-[#07152f] text-white" : "text-[#5d6678] hover:bg-[#f4f7fb]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <section>{pageContent}</section>

        <CollapsibleSection title="この画面について" lead="設定・開発メモは通常利用の邪魔にならないよう閉じています。">
          <div className="grid gap-3">
            <FeatureSettingsPanel />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTextScale(textScale === "standard" ? "large" : "standard")}
                className="tw-secondary-button"
              >
                <Type size={17} />
                文字サイズ: {textScale === "standard" ? "標準" : "大きめ"}
              </button>
              <button type="button" onClick={resetDemoData} className="tw-secondary-button">
                <RotateCcw size={17} />
                デモデータを戻す
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetaLine label="template" value={teamWorksTemplate.templateKey} />
              <MetaLine label="organization_id" value={teamWorksTemplate.organizationId} />
              <MetaLine label="保存" value="localStorageのみ" />
            </div>
            <p className="tw-helper">将来DB化する想定の項目: {teamWorksSchemaPlan.join(" / ")}</p>
          </div>
        </CollapsibleSection>
          </main>
        </div>
      </div>
    </MikkeAppShell>
  );
}

function DesktopSidebar({ view, mode, setMode }: { view: TeamWorksView; mode: ViewMode; setMode: (mode: ViewMode) => void }) {
  const navGroups = navGroupsForMode(mode);

  return (
    <aside className="tw-sidebar">
      <div className="tw-sidebar-brand">
        <div className="tw-sidebar-logo">TW</div>
        <div>
          <p className="tw-card-title">Team Works</p>
          <p className="tw-helper">{modeLabel(mode)}</p>
        </div>
      </div>
      <div className="mt-4">
        <ModeSwitcher mode={mode} setMode={setMode} compact />
      </div>
      <nav className="tw-sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="tw-sidebar-group">
            <p className="tw-sidebar-group-title">{group.title}</p>
            {group.views.map((navView) => {
              const item = teamWorksNav.find((navItem) => navItem.view === navView);
              if (!item) return null;
              const config = teamWorksViews[item.view];
              const Icon = config.icon;
              const active = item.view === view;
              return (
                <Link key={item.href} href={item.href} className={`tw-sidebar-link ${active ? "tw-sidebar-link-active" : ""}`}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="tw-sidebar-footer">
        <p className="tw-helper font-bold">次に整える場所</p>
        <p className="tw-helper mt-1">PCは左メニュー、スマホは行動導線を優先します。</p>
      </div>
    </aside>
  );
}

function ModeSwitcher({ mode, setMode, compact = false }: { mode: ViewMode; setMode: (mode: ViewMode) => void; compact?: boolean }) {
  const modes: { value: ViewMode; label: string; helper: string }[] = [
    { value: "admin", label: "管理者", helper: "全体管理" },
    { value: "worker", label: "パートナー", helper: "授業実施" },
    { value: "client", label: "学校", helper: "学校画面" }
  ];

  return (
    <section className={compact ? "" : "tw-card p-3"}>
      {!compact ? <p className="tw-form-label">表示モード</p> : null}
      <div className={compact ? "grid gap-2" : "grid grid-cols-3 gap-2"}>
        {modes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setMode(item.value)}
            className={`rounded-2xl border px-3 py-2 text-left ${
              mode === item.value ? "border-[#f46a14] bg-[#fff6f1] text-[#f46a14]" : "border-[#e7ebf2] bg-white text-[#07152f]"
            }`}
          >
            <span className="block text-[length:var(--font-body)] font-extrabold">{item.label}</span>
            {!compact ? <span className="tw-helper block">{item.helper}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function HomeView({
  state,
  helpers,
  payoutTotal,
  reportWaitingCount
}: {
  state: TeamWorksState;
  helpers: Helpers;
  payoutTotal: number;
  reportWaitingCount: number;
}) {
  const unassignedSessions = state.sessions.filter((session) => session.status === "unassigned");
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_360px]">
      <Panel title="今日やること">
        <div className="grid gap-2.5">
          {state.sessions.map((session) => (
            <SessionCard key={session.id} session={session} helpers={helpers} compact />
          ))}
        </div>
      </Panel>
      <div className="grid gap-3">
        <Panel title="対応が必要" tone="urgent">
          <SummaryLine label="未割当" value={`${unassignedSessions.length}件`} tone="orange" />
          <SummaryLine label="未確認報告" value={`${reportWaitingCount}件`} tone="orange" />
          <SummaryLine label="今月の報酬予定" value={`${payoutTotal.toLocaleString()}円`} tone="green" />
        </Panel>
        <Panel title="RIN RING運用の流れ">
          <FlowStep label="学校が生徒名簿を準備" />
          <FlowStep label="管理者が授業と担当者を設定" />
          <FlowStep label="パートナーが名簿から生徒を選ぶ" />
          <FlowStep label="カルテに沿ってテーマを表示" />
          <FlowStep label="報告で次回へ引き継ぎ" />
        </Panel>
      </div>
    </div>
  );
}

function DashboardView({
  state,
  helpers,
  payoutTotal,
  reportWaitingCount
}: {
  state: TeamWorksState;
  helpers: Helpers;
  payoutTotal: number;
  reportWaitingCount: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_360px]">
      <Panel title="今日の授業一覧">
        <div className="grid gap-2.5">
          {state.sessions.map((session) => (
            <SessionCard key={session.id} session={session} helpers={helpers} compact />
          ))}
        </div>
      </Panel>
      <div className="grid gap-3">
        <Panel title="対応が必要" tone="urgent">
          <SummaryLine label="未割当授業" value={`${state.sessions.filter((session) => session.status === "unassigned").length}件`} tone="orange" />
          <SummaryLine label="確認待ち報告" value={`${reportWaitingCount}件`} tone="orange" />
          <SummaryLine label="報酬予定額" value={`${payoutTotal.toLocaleString()}円`} tone="green" />
        </Panel>
        <Panel title="次に開く画面">
          <LinkButton href="/apps/team-works/guides" label="テーマライブラリを整える" />
          <LinkButton href="/apps/team-works/participants" label="生徒カルテを確認" />
          <LinkButton href="/apps/team-works/portal/worker" label="レッスン実施画面を見る" />
        </Panel>
      </div>
    </div>
  );
}

function OperationsDashboardView({
  state,
  helpers,
  payoutTotal,
  reportWaitingCount
}: {
  state: TeamWorksState;
  helpers: Helpers;
  payoutTotal: number;
  reportWaitingCount: number;
}) {
  const unassignedSessions = state.sessions.filter((session) => session.status === "unassigned");
  const pendingMessages = state.messages.slice(0, 3);
  const completedSessions = state.sessions.filter((session) => session.status === "completed");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_390px]">
      <div className="grid gap-4">
        <Panel title="今日の運営ボード" lead="授業、Zoom、担当、次に使う資料をここで確認します。">
          <div className="grid gap-2.5">
            {state.sessions.map((session) => (
              <SessionCard key={session.id} session={session} helpers={helpers} compact />
            ))}
          </div>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="学校サマリー">
            <div className="grid gap-2">
              {state.clients.map((client) => (
                <SummaryLine
                  key={client.id}
                  label={client.name}
                  value={`${state.participants.filter((participant) => participant.clientId === client.id).length}名 / ${languageLabel(client.preferredLanguage)}`}
                />
              ))}
            </div>
          </Panel>
          <Panel title="締め処理">
            <div className="grid gap-2">
              <SummaryLine label="報酬予定" value={`${payoutTotal.toLocaleString()}円`} tone="green" />
              <SummaryLine label="確認待ち報告" value={`${reportWaitingCount}件`} tone={reportWaitingCount ? "orange" : "green"} />
              <SummaryLine label="請求対象授業" value={`${completedSessions.length}件`} />
            </div>
          </Panel>
        </div>
      </div>
      <div className="grid gap-3">
        <Panel title="対応が必要" tone="urgent">
          <SummaryLine label="未割当授業" value={`${unassignedSessions.length}件`} tone="orange" />
          <SummaryLine label="確認待ち報告" value={`${reportWaitingCount}件`} tone="orange" />
          <SummaryLine label="学校・パートナー連絡" value={`${pendingMessages.length}件`} tone="orange" />
        </Panel>
        <Panel title="すぐ開く">
          <LinkButton href="/apps/team-works/assignments" label="未割当を処理する" />
          <LinkButton href="/apps/team-works/reports" label="報告を確認する" />
          <LinkButton href="/apps/team-works/guides" label="マニュアル資料を確認する" />
          <LinkButton href="/apps/team-works/portal/worker" label="レッスン実施画面を見る" />
        </Panel>
        <Panel title="最近の連絡">
          <div className="grid gap-2">
            {pendingMessages.length ? pendingMessages.map((message) => (
              <div key={message.id} className="tw-card-soft p-3">
                <p className="tw-body">{message.body}</p>
                <p className="tw-helper mt-1">{languageLabel(message.language)}</p>
              </div>
            )) : <Empty text="新しい連絡はありません。" />}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ClientsView({ state, updateState }: ScreenProps) {
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    contact: "",
    memo: "",
    status: "active" as ClientStatus,
    preferredLanguage: "en" as TeamWorksClient["preferredLanguage"]
  });

  function addClient() {
    if (!form.name.trim()) return;
    const next: TeamWorksClient = {
      id: createTeamWorksId("client"),
      organizationId: teamWorksTemplate.organizationId,
      ...form
    };
    updateState({ ...state, clients: [next, ...state.clients] });
    setForm({ name: "", contactName: "", contact: "", memo: "", status: "active", preferredLanguage: "en" });
  }

  return (
    <TwoColumn
      main={
        <Panel title="学校一覧">
          <DataList
            empty="学校がまだありません。"
            items={state.clients.map((client) => ({
              id: client.id,
              title: client.name,
              meta: `${client.contactName} / ${client.contact} / 表示言語: ${languageLabel(client.preferredLanguage)}`,
              detail: client.memo,
              status: statusLabel(client.status)
            }))}
          />
        </Panel>
      }
      side={
        <Panel title="学校を追加">
          <TextInput label="学校名" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <TextInput label="担当者名" value={form.contactName} onChange={(contactName) => setForm({ ...form, contactName })} />
          <TextInput label="連絡先" value={form.contact} onChange={(contact) => setForm({ ...form, contact })} />
          <SelectInput label="ステータス" value={form.status} onChange={(status) => setForm({ ...form, status: status as ClientStatus })} options={clientStatusOptions} />
          <SelectInput label="学校側の表示言語" value={form.preferredLanguage} onChange={(preferredLanguage) => setForm({ ...form, preferredLanguage: preferredLanguage as TeamWorksClient["preferredLanguage"] })} options={languageOptions} />
          <TextArea label="メモ" value={form.memo} onChange={(memo) => setForm({ ...form, memo })} />
          <ActionButton label="学校を追加" onClick={addClient} icon="save" />
        </Panel>
      }
    />
  );
}

function ParticipantsView({ state, updateState, helpers }: ScreenProps & { helpers: Helpers }) {
  const firstClientId = state.clients[0]?.id ?? "";
  const firstGuideId = state.guideItems[0]?.id ?? "";
  const [form, setForm] = useState({
    name: "",
    clientId: firstClientId,
    level: "N4",
    cautions: "",
    memo: "",
    currentGuideItemId: firstGuideId
  });

  useEffect(() => {
    if (!form.clientId && firstClientId) setForm((current) => ({ ...current, clientId: firstClientId }));
    if (!form.currentGuideItemId && firstGuideId) setForm((current) => ({ ...current, currentGuideItemId: firstGuideId }));
  }, [firstClientId, firstGuideId, form.clientId, form.currentGuideItemId]);

  function addParticipant() {
    if (!form.name.trim() || !form.clientId) return;
    const next: TeamWorksParticipant = {
      id: createTeamWorksId("participant"),
      organizationId: teamWorksTemplate.organizationId,
      clientId: form.clientId,
      name: form.name,
      level: form.level,
      cautions: form.cautions,
      memo: form.memo,
      currentGuideItemId: form.currentGuideItemId,
      lastGuideItemId: "",
      lastMemo: "",
      nextMemo: ""
    };
    updateState({ ...state, participants: [next, ...state.participants] });
    setForm({ name: "", clientId: firstClientId, level: "N4", cautions: "", memo: "", currentGuideItemId: firstGuideId });
  }

  return (
    <TwoColumn
      main={
        <Panel title="生徒カルテ一覧" lead="前回どこまで進んだか、次に出すテーマをここで見ます。">
          <div className="grid gap-3">
            {state.participants.map((participant) => {
              const currentGuide = helpers.guide(participant.currentGuideItemId);
              const lastGuide = helpers.guide(participant.lastGuideItemId);
              return (
                <article key={participant.id} className="tw-card p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="tw-card-title">{participant.name} / {participant.level}</p>
                      <p className="tw-helper mt-1">{helpers.clientName(participant.clientId)}</p>
                    </div>
                    <StatusChip status="assigned" label={`次: ${currentGuide ? `${currentGuide.number}. ${currentGuide.title}` : "未設定"}`} />
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <SummaryLine label="前回内容" value={lastGuide ? `${lastGuide.number}. ${lastGuide.title}` : "未記録"} />
                    <SummaryLine label="次回テーマ" value={currentGuide ? `${currentGuide.number}. ${currentGuide.title}` : "未設定"} tone="orange" />
                  </div>
                  <p className="tw-body mt-3">{participant.cautions}</p>
                  <p className="tw-helper mt-2">{participant.lastMemo || participant.memo}</p>
                  <p className="tw-helper mt-1 font-bold text-[#07152f]">{participant.nextMemo}</p>
                </article>
              );
            })}
          </div>
        </Panel>
      }
      side={
        <Panel title="生徒を追加">
          <TextInput label="生徒名" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <SelectInput label="所属学校" value={form.clientId} onChange={(clientId) => setForm({ ...form, clientId })} options={state.clients.map((client) => ({ value: client.id, label: client.name }))} />
          <TextInput label="レベル" value={form.level} onChange={(level) => setForm({ ...form, level })} />
          <SelectInput label="開始テーマ" value={form.currentGuideItemId} onChange={(currentGuideItemId) => setForm({ ...form, currentGuideItemId })} options={state.guideItems.map((guide) => ({ value: guide.id, label: `${guide.number}. ${guide.title}` }))} />
          <TextArea label="注意事項" value={form.cautions} onChange={(cautions) => setForm({ ...form, cautions })} />
          <TextArea label="メモ" value={form.memo} onChange={(memo) => setForm({ ...form, memo })} />
          <ActionButton label="生徒を追加" onClick={addParticipant} icon="save" />
        </Panel>
      }
    />
  );
}

function WorkersView({ state, updateState }: ScreenProps) {
  const [form, setForm] = useState({
    name: "",
    availabilityStatus: "available" as WorkerStatus,
    availableDays: ["月", "水"],
    rate: "2500",
    memo: ""
  });

  function toggleDay(day: string) {
    setForm((current) => ({
      ...current,
      availableDays: current.availableDays.includes(day)
        ? current.availableDays.filter((item) => item !== day)
        : [...current.availableDays, day]
    }));
  }

  function addWorker() {
    if (!form.name.trim()) return;
    const next: TeamWorksWorker = {
      id: createTeamWorksId("worker"),
      organizationId: teamWorksTemplate.organizationId,
      name: form.name,
      availabilityStatus: form.availabilityStatus,
      availableDays: form.availableDays,
      rate: Number(form.rate) || 0,
      memo: form.memo
    };
    updateState({ ...state, workers: [next, ...state.workers] });
    setForm({ name: "", availabilityStatus: "available", availableDays: ["月", "水"], rate: "2500", memo: "" });
  }

  return (
    <TwoColumn
      main={
        <Panel title="会話パートナー一覧">
          <DataList
            empty="会話パートナーがまだありません。"
            items={state.workers.map((worker) => ({
              id: worker.id,
              title: worker.name,
              meta: `${statusLabel(worker.availabilityStatus)} / ${worker.availableDays.join("・")} / ${worker.rate.toLocaleString()}円`,
              detail: worker.memo,
              status: statusLabel(worker.availabilityStatus)
            }))}
          />
        </Panel>
      }
      side={
        <Panel title="会話パートナーを追加">
          <TextInput label="名前" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <SelectInput label="稼働ステータス" value={form.availabilityStatus} onChange={(availabilityStatus) => setForm({ ...form, availabilityStatus: availabilityStatus as WorkerStatus })} options={workerStatusOptions} />
          <div>
            <p className="tw-form-label">対応可能曜日</p>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`min-h-11 rounded-xl border px-2 py-2 text-[length:var(--font-helper)] font-bold ${
                    form.availableDays.includes(day) ? "border-[#07152f] bg-[#07152f] text-white" : "border-[#e7ebf2] bg-white text-[#5d6678]"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <TextInput label="時給または報酬単価" value={form.rate} onChange={(rate) => setForm({ ...form, rate })} />
          <TextArea label="メモ" value={form.memo} onChange={(memo) => setForm({ ...form, memo })} />
          <ActionButton label="パートナーを追加" onClick={addWorker} icon="save" />
        </Panel>
      }
    />
  );
}

function SessionsView({ state, updateState, helpers }: ScreenProps & { helpers: Helpers }) {
  const [form, setForm] = useState({
    clientId: state.clients[0]?.id ?? "",
    participantId: state.participants[0]?.id ?? "",
    className: "クラスA",
    startsAt: "2026-07-09T17:00",
    durationMinutes: "60",
    zoomUrl: "https://zoom.example.com/new-class",
    workerId: ""
  });

  function addSession() {
    if (!form.clientId || !form.participantId || !form.startsAt) return;
    const next: TeamWorksSession = {
      id: createTeamWorksId("session"),
      organizationId: teamWorksTemplate.organizationId,
      clientId: form.clientId,
      participantId: form.participantId,
      className: form.className,
      startsAt: form.startsAt,
      durationMinutes: Number(form.durationMinutes) || 60,
      zoomUrl: form.zoomUrl,
      workerId: form.workerId,
      status: form.workerId ? "assigned" : "unassigned"
    };
    updateState({ ...state, sessions: [next, ...state.sessions] });
  }

  return (
    <TwoColumn
      main={
        <Panel title="授業一覧">
          <div className="grid gap-3">
            {state.sessions.map((session) => (
              <SessionCard key={session.id} session={session} helpers={helpers} />
            ))}
          </div>
        </Panel>
      }
      side={
        <Panel title="授業を追加">
          <SelectInput label="学校" value={form.clientId} onChange={(clientId) => setForm({ ...form, clientId })} options={state.clients.map((client) => ({ value: client.id, label: client.name }))} />
          <SelectInput label="生徒またはクラス" value={form.participantId} onChange={(participantId) => setForm({ ...form, participantId })} options={state.participants.map((participant) => ({ value: participant.id, label: participant.name }))} />
          <TextInput label="クラス名" value={form.className} onChange={(className) => setForm({ ...form, className })} />
          <TextInput label="日時" value={form.startsAt} onChange={(startsAt) => setForm({ ...form, startsAt })} type="datetime-local" />
          <TextInput label="授業時間（分）" value={form.durationMinutes} onChange={(durationMinutes) => setForm({ ...form, durationMinutes })} />
          <TextInput label="Zoom URL" value={form.zoomUrl} onChange={(zoomUrl) => setForm({ ...form, zoomUrl })} />
          <SelectInput label="担当パートナー" value={form.workerId} onChange={(workerId) => setForm({ ...form, workerId })} options={[{ value: "", label: "未割当" }, ...state.workers.map((worker) => ({ value: worker.id, label: worker.name }))]} />
          <ActionButton label="授業を追加" onClick={addSession} icon="save" />
        </Panel>
      }
    />
  );
}

function AssignmentsView({ state, updateState, helpers }: ScreenProps & { helpers: Helpers }) {
  function assignWorker(sessionId: string, workerId: string) {
    updateState({
      ...state,
      sessions: state.sessions.map((session) =>
        session.id === sessionId ? { ...session, workerId, status: workerId ? "assigned" : "unassigned" } : session
      )
    });
  }

  function autoAssignFirstWorker() {
    const workerId = state.workers[0]?.id ?? "";
    if (!workerId) return;
    updateState({
      ...state,
      sessions: state.sessions.map((session) =>
        session.status === "unassigned" ? { ...session, workerId, status: "assigned" } : session
      )
    });
  }

  return (
    <Panel title="未割当の授業" lead="オレンジのカードから担当者を割り当てます。">
      <div className="grid gap-3">
        {state.sessions.map((session) => (
          <article key={session.id} className={`tw-card p-4 ${session.status === "unassigned" ? "tw-attention-card" : ""}`}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
              <div>
                <p className="tw-card-title">{formatSessionTime(session.startsAt)} / {helpers.clientName(session.clientId)}</p>
                <p className="tw-helper mt-1">{session.className} / {helpers.participantName(session.participantId)}</p>
                <p className="tw-helper mt-1">現在の担当: {helpers.workerName(session.workerId) || "未割当"}</p>
              </div>
              <div className="grid gap-2">
                <SelectInput
                  label="担当パートナー"
                  value={session.workerId}
                  onChange={(workerId) => assignWorker(session.id, workerId)}
                  options={[{ value: "", label: "未割当" }, ...state.workers.map((worker) => ({ value: worker.id, label: worker.name }))]}
                />
                <button type="button" onClick={() => assignWorker(session.id, state.workers[0]?.id ?? "")} className={session.status === "unassigned" ? "tw-primary-button" : "tw-secondary-button"}>
                  担当者を割り当てる
                </button>
              </div>
            </div>
          </article>
        ))}
        <button type="button" onClick={autoAssignFirstWorker} className="tw-primary-button w-full">
          担当者を一括割り当てる
        </button>
      </div>
    </Panel>
  );
}

function GuidesView({ state, updateState }: ScreenProps) {
  const [form, setForm] = useState({
    number: String((state.guideItems.at(-1)?.number ?? 0) + 1),
    title: "",
    targetLevel: "N4",
    materialType: "google_doc" as NonNullable<TeamWorksGuideItem["materialType"]>,
    materialTitle: "",
    materialUrl: "",
    materialNote: "",
    questions: "",
    expressions: "",
    cautions: "",
    genericUse: ""
  });

  function addGuide() {
    if (!form.title.trim()) return;
    const next: TeamWorksGuideItem = {
      id: createTeamWorksId("guide"),
      organizationId: teamWorksTemplate.organizationId,
      number: Number(form.number) || state.guideItems.length + 1,
      title: form.title,
      targetLevel: form.targetLevel,
      materialType: form.materialType,
      materialTitle: form.materialTitle || form.title,
      materialUrl: form.materialUrl,
      materialNote: form.materialNote,
      questions: splitLines(form.questions),
      expressions: splitLines(form.expressions),
      cautions: form.cautions,
      genericUse: form.genericUse
    };
    updateState({ ...state, guideItems: [...state.guideItems, next].sort((a, b) => a.number - b.number) });
    setForm({ number: String(next.number + 1), title: "", targetLevel: "N4", materialType: "google_doc", materialTitle: "", materialUrl: "", materialNote: "", questions: "", expressions: "", cautions: "", genericUse: "" });
  }

  return (
    <TwoColumn
      main={
        <Panel title="テーマライブラリ" lead="RIN RINGではトークテーマ、他業種では進行表やマニュアルとして使えます。">
          <div className="grid gap-3 md:grid-cols-2">
            {state.guideItems.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </Panel>
      }
      side={
        <Panel title="テーマを追加">
          <TextInput label="テーマ番号" value={form.number} onChange={(number) => setForm({ ...form, number })} />
          <TextInput label="タイトル" value={form.title} onChange={(title) => setForm({ ...form, title })} />
          <TextInput label="対象レベル" value={form.targetLevel} onChange={(targetLevel) => setForm({ ...form, targetLevel })} />
          <SelectInput label="資料の種類" value={form.materialType} onChange={(materialType) => setForm({ ...form, materialType: materialType as NonNullable<TeamWorksGuideItem["materialType"]> })} options={materialTypeOptions} />
          <TextInput label="資料名" value={form.materialTitle} onChange={(materialTitle) => setForm({ ...form, materialTitle })} />
          <TextInput label="資料URL" value={form.materialUrl} onChange={(materialUrl) => setForm({ ...form, materialUrl })} />
          <TextArea label="資料メモ" value={form.materialNote} onChange={(materialNote) => setForm({ ...form, materialNote })} />
          <TextArea label="質問例（1行に1つ）" value={form.questions} onChange={(questions) => setForm({ ...form, questions })} />
          <TextArea label="使う表現（1行に1つ）" value={form.expressions} onChange={(expressions) => setForm({ ...form, expressions })} />
          <TextArea label="注意点" value={form.cautions} onChange={(cautions) => setForm({ ...form, cautions })} />
          <TextInput label="他業種での使い方" value={form.genericUse} onChange={(genericUse) => setForm({ ...form, genericUse })} />
          <ActionButton label="テーマを追加" onClick={addGuide} icon="save" />
        </Panel>
      }
    />
  );
}

function WorkerPortalView({ state, updateState, helpers }: ScreenProps & { helpers: Helpers }) {
  const worker = state.workers[0];
  const workerSessions = state.sessions.filter((session) => !worker || session.workerId === worker.id || session.status === "unassigned");
  const [selectedSessionId, setSelectedSessionId] = useState(workerSessions[0]?.id ?? state.sessions[0]?.id ?? "");
  const firstSession = workerSessions.find((session) => session.id === selectedSessionId) ?? workerSessions[0] ?? state.sessions[0];
  const roster = state.attendanceEntries.filter((entry) => entry.sessionId === firstSession?.id);
  const rosterParticipants = roster.length
    ? roster.map((entry) => helpers.participant(entry.participantId)).filter(Boolean) as TeamWorksParticipant[]
    : state.participants.filter((participant) => participant.clientId === firstSession?.clientId);
  const [selectedParticipantId, setSelectedParticipantId] = useState(firstSession?.participantId ?? rosterParticipants[0]?.id ?? "");
  const selectedParticipant = helpers.participant(selectedParticipantId) ?? helpers.participant(firstSession?.participantId ?? "");
  const selectedGuide = helpers.guide(selectedParticipant?.currentGuideItemId ?? "");
  const selectedReport = state.reports.find((report) => report.sessionId === firstSession?.id && report.participantId === selectedParticipant?.id);
  const currentClocked = firstSession ? state.clockedInSessionIds.includes(firstSession.id) : false;

  useEffect(() => {
    if (!selectedParticipantId && (firstSession?.participantId || rosterParticipants[0]?.id)) {
      setSelectedParticipantId(firstSession?.participantId ?? rosterParticipants[0]?.id ?? "");
    }
  }, [firstSession?.participantId, rosterParticipants, selectedParticipantId]);

  useEffect(() => {
    if (firstSession?.participantId) {
      setSelectedParticipantId(firstSession.participantId);
    }
  }, [firstSession?.id, firstSession?.participantId]);

  function toggleClock(sessionId: string) {
    const clocked = state.clockedInSessionIds.includes(sessionId);
    updateState({
      ...state,
      clockedInSessionIds: clocked
        ? state.clockedInSessionIds.filter((id) => id !== sessionId)
        : [...state.clockedInSessionIds, sessionId]
    });
  }

  function saveAvailability(next: PartnerAvailability) {
    updateState({ ...state, partnerAvailability: [next, ...state.partnerAvailability] });
  }

  if (!firstSession || !selectedParticipant) {
    return <Empty text="表示できる授業がまだありません。" />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
      <Panel title="今日の授業">
        <div className="grid gap-3">
          {workerSessions.map((session) => {
            const clocked = state.clockedInSessionIds.includes(session.id);
            return (
              <article key={session.id} className={`tw-card-soft p-3 ${session.id === firstSession.id ? "border-[#f46a14] bg-[#fff6f1]" : ""}`}>
                <p className="tw-card-title">{formatSessionTime(session.startsAt)}</p>
                <p className="tw-helper mt-1">{helpers.clientName(session.clientId)} / {session.className}</p>
                <p className="tw-helper mt-1">担当: {helpers.workerName(session.workerId) || "未割当"} / {statusLabel(session.status)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={session.zoomUrl} className="tw-secondary-button">
                    <Video size={17} />
                    Zoomを開く
                  </a>
                  <button type="button" onClick={() => setSelectedSessionId(session.id)} className={session.id === firstSession.id ? "tw-primary-button" : "tw-secondary-button"}>
                    開く
                  </button>
                </div>
                <button type="button" onClick={() => toggleClock(session.id)} className={`${clocked ? "tw-secondary-button" : "tw-primary-button"} mt-2 w-full`}>
                  <Timer size={17} />
                  {clocked ? "退勤" : "出勤"}
                </button>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="レッスン実施" lead="学校の名簿から生徒を選ぶと、その子のカルテと次のテーマが出ます。">
        <div className="mb-4 grid gap-3 rounded-2xl border border-[#e7ebf2] bg-[#f8fafc] p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="tw-card-title">{helpers.clientName(firstSession.clientId)} / {firstSession.className}</p>
            <p className="tw-helper mt-1">{formatSessionTime(firstSession.startsAt)} / {firstSession.durationMinutes}分 / {statusLabel(firstSession.status)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <a href={firstSession.zoomUrl} className="tw-secondary-button">
              <Video size={17} />
              Zoom
            </a>
            <button type="button" onClick={() => toggleClock(firstSession.id)} className={currentClocked ? "tw-secondary-button" : "tw-primary-button"}>
              <Timer size={17} />
              {currentClocked ? "退勤" : "出勤"}
            </button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <p className="tw-form-label">今日の名簿</p>
            <div className="grid gap-2">
              {rosterParticipants.map((participant) => (
                <button
                  type="button"
                  key={participant.id}
                  onClick={() => setSelectedParticipantId(participant.id)}
                  className={`rounded-2xl border px-3 py-3 text-left ${
                    selectedParticipantId === participant.id ? "border-[#f46a14] bg-[#fff6f1]" : "border-[#e7ebf2] bg-white"
                  }`}
                >
                  <span className="block text-[length:var(--font-body)] font-extrabold text-[#07152f]">{participant.name}</span>
                  <span className="tw-helper block">{participant.level} / 次: {helpers.guide(participant.currentGuideItemId)?.number ?? "-"}番</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <ParticipantChart participant={selectedParticipant} helpers={helpers} />
            <div className="tw-card p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff6f1] text-[#f46a14]">
                  <BookOpenCheck size={19} />
                </span>
                <div>
                  <p className="tw-section-title">今この子に出す内容</p>
                  <p className="tw-helper mt-1">
                    {selectedGuide ? `${selectedGuide.number}. ${selectedGuide.title}` : "テーマ未設定"} / {selectedParticipant.name}
                  </p>
                </div>
              </div>
            </div>
            {selectedGuide ? <GuideCard guide={selectedGuide} compact /> : <Empty text="次に表示するテーマが未設定です。" />}
            <ReportEditor state={state} updateState={updateState} session={firstSession} participant={selectedParticipant} report={selectedReport} />
          </div>
        </div>
      </Panel>

      <div className="grid gap-3">
        <AvailabilityBox state={state} workerId={worker?.id ?? ""} onSave={saveAvailability} />
        <MessageBox state={state} targetId={worker?.id ?? ""} role="worker" updateState={updateState} />
      </div>
    </div>
  );
}

function ReportsView({ state, updateState, helpers }: ScreenProps & { helpers: Helpers }) {
  function updateReportStatus(reportId: string, adminStatus: AdminStatus) {
    updateState({
      ...state,
      reports: state.reports.map((report) => report.id === reportId ? { ...report, adminStatus } : report)
    });
  }

  return (
    <Panel title="授業報告一覧" lead="本部用メモと学校向けコメントを分けて確認します。">
      <div className="grid gap-3">
        {state.reports.map((report) => {
          const session = state.sessions.find((item) => item.id === report.sessionId);
          const participant = helpers.participant(report.participantId);
          return (
            <article key={report.id} className="tw-card p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="tw-card-title">{participant?.name ?? "未設定"} / {session ? formatSessionTime(session.startsAt) : "授業未設定"}</p>
                  <p className="tw-helper mt-1">{session ? helpers.clientName(session.clientId) : "-"} / {statusLabel(report.attendanceStatus)}</p>
                </div>
                <StatusChip status={report.adminStatus} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <SummaryLine label="実施内容" value={report.content || "-"} />
                <SummaryLine label="次回メモ" value={report.nextMemo || "-"} tone="orange" />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="tw-card-soft p-3">
                  <p className="tw-form-label">本部・次回担当者用</p>
                  <p className="tw-body">{report.internalNote || report.studentMood || "-"}</p>
                </div>
                <div className="tw-card-soft p-3">
                  <p className="tw-form-label">学校向け一言</p>
                  <p className="tw-body">{report.clientComment || "-"}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => updateReportStatus(report.id, "reviewed")} className="tw-primary-button">
                  確認済みにする
                </button>
                <button type="button" onClick={() => updateReportStatus(report.id, "needs_revision")} className="tw-secondary-button">
                  要確認にする
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function ReportEditor({
  state,
  updateState,
  session,
  participant,
  report
}: ScreenProps & { session: TeamWorksSession; participant: TeamWorksParticipant; report?: TeamWorksReport }) {
  const [form, setForm] = useState({
    attendanceStatus: report?.attendanceStatus ?? "present" as AttendanceStatus,
    content: report?.content ?? "",
    studentMood: report?.studentMood ?? "",
    nextMemo: report?.nextMemo ?? participant.nextMemo,
    internalNote: report?.internalNote ?? "",
    clientComment: report?.clientComment ?? ""
  });

  useEffect(() => {
    setForm({
      attendanceStatus: report?.attendanceStatus ?? "present",
      content: report?.content ?? "",
      studentMood: report?.studentMood ?? "",
      nextMemo: report?.nextMemo ?? participant.nextMemo,
      internalNote: report?.internalNote ?? "",
      clientComment: report?.clientComment ?? ""
    });
  }, [participant.id, participant.nextMemo, report]);

  function saveReport() {
    const guideIndex = state.guideItems.findIndex((guide) => guide.id === participant.currentGuideItemId);
    const nextGuide = state.guideItems[guideIndex + 1] ?? state.guideItems[guideIndex] ?? state.guideItems[0];
    const nextReport: TeamWorksReport = {
      id: report?.id ?? createTeamWorksId("report"),
      organizationId: teamWorksTemplate.organizationId,
      sessionId: session.id,
      participantId: participant.id,
      guideItemId: participant.currentGuideItemId,
      attendanceStatus: form.attendanceStatus,
      content: form.content,
      studentMood: form.studentMood,
      nextMemo: form.nextMemo,
      internalNote: form.internalNote,
      clientComment: form.clientComment,
      adminStatus: "submitted"
    };
    const nextReports = report
      ? state.reports.map((item) => item.id === report.id ? nextReport : item)
      : [nextReport, ...state.reports];
    updateState({
      ...state,
      reports: nextReports,
      participants: state.participants.map((item) =>
        item.id === participant.id
          ? {
              ...item,
              lastGuideItemId: participant.currentGuideItemId,
              currentGuideItemId: nextGuide?.id ?? participant.currentGuideItemId,
              lastMemo: form.content,
              nextMemo: form.nextMemo
            }
          : item
      ),
      sessions: state.sessions.map((item) => item.id === session.id ? { ...item, status: "completed" } : item)
    });
  }

  return (
    <div className="tw-card-soft p-3">
      <p className="tw-section-title">出席・授業報告</p>
      <div className="mt-3 grid gap-3">
        <SelectInput label="出席状況" value={form.attendanceStatus} onChange={(attendanceStatus) => setForm({ ...form, attendanceStatus: attendanceStatus as AttendanceStatus })} options={attendanceOptions} />
        <TextArea label="実施内容（本部用）" value={form.content} onChange={(content) => setForm({ ...form, content })} />
        <TextArea label="生徒の様子（次回担当者用）" value={form.studentMood} onChange={(studentMood) => setForm({ ...form, studentMood })} />
        <TextArea label="次回メモ" value={form.nextMemo} onChange={(nextMemo) => setForm({ ...form, nextMemo })} />
        <TextArea label="本部だけに共有するメモ" value={form.internalNote} onChange={(internalNote) => setForm({ ...form, internalNote })} />
        <TextArea label="学校向け一言コメント" value={form.clientComment} onChange={(clientComment) => setForm({ ...form, clientComment })} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="tw-secondary-button">
          出席入力
        </button>
        <ActionButton label="報告を送信" onClick={saveReport} icon="send" />
      </div>
    </div>
  );
}

function PayoutsView({ rows }: { rows: PayoutRow[] }) {
  return (
    <Panel title="パートナー別集計">
      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.workerId} className="tw-card p-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <SummaryLine label="対象パートナー" value={row.workerName} />
              <SummaryLine label="実施回数" value={`${row.count}回`} />
              <SummaryLine label="実施時間" value={`${row.hours}時間`} />
              <SummaryLine label="報酬予定額" value={`${row.amount.toLocaleString()}円`} tone="green" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="tw-helper">単価: {row.rate.toLocaleString()}円 / 時間</p>
              <button type="button" className="tw-secondary-button">
                確認済みにする
              </button>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function InvoicesView({ state, helpers }: { state: TeamWorksState; helpers: Helpers }) {
  const rows = state.clients.map((client) => {
    const sessions = state.sessions.filter((session) => session.clientId === client.id && session.status === "completed");
    return { client, count: sessions.length, minutes: sessions.reduce((sum, session) => sum + session.durationMinutes, 0) };
  });

  return (
    <Panel title="学校別の請求元データ">
      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.client.id} className="tw-card p-4">
            <div className="grid gap-2 md:grid-cols-3">
              <SummaryLine label="学校" value={row.client.name} />
              <SummaryLine label="実施回数" value={`${row.count}回`} />
              <SummaryLine label="実施時間" value={`${Math.round((row.minutes / 60) * 10) / 10}時間`} />
            </div>
            <p className="tw-helper mt-2">担当者: {row.client.contactName} / 生徒: {state.participants.filter((participant) => participant.clientId === row.client.id).map((participant) => helpers.participantName(participant.id)).join("、") || "-"}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ClientPortalView({ state, updateState, helpers }: ScreenProps & { helpers: Helpers }) {
  function setAttendance(entry: AttendanceEntry, status: AttendanceStatus) {
    updateState({
      ...state,
      attendanceEntries: state.attendanceEntries.map((item) => item.id === entry.id ? { ...item, status } : item)
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_360px]">
      <Panel title="学校ポータル" lead="学校担当者がスケジュール、生徒名簿、出席予定、連絡を確認します。">
        <div className="grid gap-3">
          {state.clients.map((client) => (
            <article key={client.id} className="tw-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="tw-card-title">{client.name}</p>
                  <p className="tw-helper mt-1">{client.contactName} / 表示言語: {languageLabel(client.preferredLanguage)}</p>
                </div>
                <StatusChip status={client.status} />
              </div>
              <div className="mt-3 grid gap-2">
                {state.sessions.filter((session) => session.clientId === client.id).map((session) => (
                  <div key={session.id} className="tw-card-soft p-3">
                    <p className="tw-card-title">{formatSessionTime(session.startsAt)} / {session.className}</p>
                    <p className="tw-helper mt-1 break-all text-[#2e7d46]">{session.zoomUrl}</p>
                    <div className="mt-3 grid gap-2">
                      {state.attendanceEntries.filter((entry) => entry.sessionId === session.id).map((entry) => (
                        <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e7ebf2] px-3 py-2">
                          <p className="text-[length:var(--font-body)] font-bold text-[#07152f]">{helpers.participantName(entry.participantId)}</p>
                          <div className="flex gap-1">
                            {(["present", "absent", "late"] as AttendanceStatus[]).map((status) => (
                              <button key={status} type="button" onClick={() => setAttendance(entry, status)} className={entry.status === status ? "tw-primary-button min-h-8 px-3" : "tw-secondary-button min-h-8 px-3"}>
                                {statusLabel(status)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <div className="grid gap-3">
        <Panel title="表示言語">
          <div className="grid gap-2">
            {state.clients.map((client) => (
              <div key={client.id} className="tw-card-soft p-3">
                <div className="flex items-center gap-2">
                  <Languages size={17} className="text-[#f46a14]" />
                  <p className="tw-card-title">{languageLabel(client.preferredLanguage)}</p>
                </div>
                <p className="tw-helper mt-1">{client.name} の学校画面・連絡文はこの言語で表示する想定です。</p>
              </div>
            ))}
          </div>
        </Panel>
        <MessageBox state={state} targetId={state.clients[0]?.id ?? ""} role="client" updateState={updateState} />
      </div>
    </div>
  );
}

function FeatureSettingsPanel() {
  const features = [
    ["カルテ連動", teamWorksTemplate.featureSettings.participantChart],
    ["名簿式出席簿", teamWorksTemplate.featureSettings.rosterBasedAttendance],
    ["テーマライブラリ", teamWorksTemplate.featureSettings.guideLibrary],
    ["資料進捗リンク", teamWorksTemplate.featureSettings.guideProgressLink],
    ["進行表だけ表示", teamWorksTemplate.featureSettings.procedureOnlyMode],
    ["Team Works内メッセージ", teamWorksTemplate.featureSettings.inAppMessages],
    ["レスポンシブビルダー", teamWorksTemplate.featureSettings.responsiveBuilder],
    ["翻訳表示", teamWorksTemplate.featureSettings.translationDisplay]
  ];
  return (
    <div className="tw-card-soft p-3">
      <p className="tw-section-title">業態別に切り替える機能</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(([label, enabled]) => (
          <div key={String(label)} className="flex items-center gap-2 rounded-xl border border-[#e7ebf2] bg-white px-3 py-2">
            <CheckCircle2 size={16} className={enabled ? "text-[#f46a14]" : "text-[#9aa3b2]"} />
            <span className="text-[length:var(--font-helper)] font-bold text-[#07152f]">{label}</span>
          </div>
        ))}
      </div>
      <p className="tw-helper mt-3">翻訳対象: フロント / フォーム / 学校画面 / 学校連絡。内部データは後から他画面にも広げられる構造です。</p>
    </div>
  );
}

function ParticipantChart({ participant, helpers }: { participant: TeamWorksParticipant; helpers: Helpers }) {
  const currentGuide = helpers.guide(participant.currentGuideItemId);
  const lastGuide = helpers.guide(participant.lastGuideItemId);
  return (
    <article className="tw-card-soft p-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f7fb] text-[#07152f]">
          <UserRound size={19} />
        </span>
        <div>
          <p className="tw-card-title">{participant.name} / {participant.level}</p>
          <p className="tw-helper mt-1">{helpers.clientName(participant.clientId)}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SummaryLine label="前回" value={lastGuide ? `${lastGuide.number}. ${lastGuide.title}` : "未記録"} />
        <SummaryLine label="次に表示" value={currentGuide ? `${currentGuide.number}. ${currentGuide.title}` : "未設定"} tone="orange" />
      </div>
      <p className="tw-body mt-3">{participant.cautions}</p>
      <p className="tw-helper mt-2">{participant.nextMemo || participant.memo}</p>
    </article>
  );
}

function AvailabilityBox({ state, workerId, onSave }: { state: TeamWorksState; workerId: string; onSave: (next: PartnerAvailability) => void }) {
  const [form, setForm] = useState({ date: "2026-07-11", status: "available", timeRange: "13:00-17:00", memo: "" });
  const workerRows = state.partnerAvailability.filter((item) => item.workerId === workerId).slice(0, 3);
  function save() {
    if (!workerId || !form.date) return;
    onSave({
      id: createTeamWorksId("availability"),
      organizationId: teamWorksTemplate.organizationId,
      workerId,
      date: form.date,
      status: form.status as PartnerAvailability["status"],
      timeRange: form.timeRange,
      memo: form.memo
    });
  }
  return (
    <Panel title="シフト提出">
      <div className="grid gap-2">
        <TextInput label="日付" value={form.date} onChange={(date) => setForm({ ...form, date })} type="date" />
        <SelectInput label="区分" value={form.status} onChange={(status) => setForm({ ...form, status })} options={[{ value: "available", label: "入れる" }, { value: "unavailable", label: "入れない" }]} />
        <TextInput label="時間帯" value={form.timeRange} onChange={(timeRange) => setForm({ ...form, timeRange })} />
        <TextInput label="メモ" value={form.memo} onChange={(memo) => setForm({ ...form, memo })} />
        <ActionButton label="提出する" onClick={save} icon="save" />
        {workerRows.map((row) => (
          <SummaryLine key={row.id} label={row.date} value={`${row.status === "available" ? "入れる" : "入れない"} / ${row.timeRange}`} />
        ))}
      </div>
    </Panel>
  );
}

function MessageBox({ state, targetId, role, updateState }: { state: TeamWorksState; targetId: string; role: "client" | "worker"; updateState: (next: TeamWorksState) => void }) {
  const [body, setBody] = useState("");
  const rows = state.messages.filter((message) => message.role === role && message.targetId === targetId).slice(0, 4);
  function send() {
    if (!body.trim() || !targetId) return;
    updateState({
      ...state,
      messages: [
        {
          id: createTeamWorksId("message"),
          organizationId: teamWorksTemplate.organizationId,
          role,
          targetId,
          body,
          language: role === "client" ? "en" : "ja",
          createdAt: new Date().toISOString()
        },
        ...state.messages
      ]
    });
    setBody("");
  }
  return (
    <Panel title={role === "client" ? "学校との連絡" : "本部との連絡"}>
      <div className="grid gap-2">
        {rows.map((message) => (
          <div key={message.id} className="tw-card-soft p-3">
            <p className="tw-body">{message.body}</p>
            <p className="tw-helper mt-1">表示言語: {languageLabel(message.language)}</p>
          </div>
        ))}
        <TextArea label="メッセージ" value={body} onChange={setBody} />
        <button type="button" onClick={send} className="tw-primary-button w-full">
          <MessageCircle size={17} />
          送信
        </button>
      </div>
    </Panel>
  );
}

function GuideCard({ guide, compact = false }: { guide: TeamWorksGuideItem; compact?: boolean }) {
  const materialUrl = guide.materialUrl || `https://docs.google.com/document/d/team-works-guide-${guide.number}`;
  const materialTitle = guide.materialTitle || `${guide.number}. ${guide.title} 資料`;
  return (
    <article className="tw-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tw-card-title">{guide.number}. {guide.title}</p>
          <p className="tw-helper mt-1">対象: {guide.targetLevel} / 他業種: {guide.genericUse}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff6f1] text-[#f46a14]">
          <BookOpenCheck size={18} />
        </span>
      </div>
      <div className="mt-3 rounded-2xl border border-[#e7ebf2] bg-[#f8fafc] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="tw-form-label">資料</p>
            <p className="text-[length:var(--font-body)] font-extrabold text-[#07152f]">{materialTitle}</p>
            <p className="tw-helper mt-1">{materialTypeLabel(guide.materialType)} / {guide.materialNote || "Google Docs、PDF、Word、Excelなどを登録できます。"}</p>
          </div>
          <a href={materialUrl} target="_blank" rel="noreferrer" className="tw-secondary-button shrink-0">
            資料を開く
          </a>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="tw-form-label">質問例</p>
          <ul className="tw-helper list-disc space-y-1 pl-5">
            {guide.questions.slice(0, compact ? 4 : 6).map((question) => <li key={question}>{question}</li>)}
          </ul>
        </div>
        <div>
          <p className="tw-form-label">使う表現</p>
          <ul className="tw-helper list-disc space-y-1 pl-5">
            {guide.expressions.slice(0, compact ? 4 : 6).map((expression) => <li key={expression}>{expression}</li>)}
          </ul>
        </div>
      </div>
      <p className="tw-body mt-3">{guide.cautions}</p>
    </article>
  );
}

function SessionCard({ session, helpers, compact = false }: { session: TeamWorksSession; helpers: Helpers; compact?: boolean }) {
  const participant = helpers.participant(session.participantId);
  const guide = helpers.guide(participant?.currentGuideItemId ?? "");
  return (
    <article className={`tw-card p-3.5 md:p-4 ${session.status === "unassigned" ? "tw-attention-card" : ""}`}>
      <div className="flex flex-col gap-2.5">
        <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-start">
          <div>
            <p className="text-[20px] font-extrabold leading-tight text-[#07152f]">{formatSessionTime(session.startsAt).replace(" ", "\n")}</p>
            <p className="tw-helper mt-1">{session.durationMinutes}分</p>
          </div>
          <div className="min-w-0">
            <p className="tw-card-title">{helpers.clientName(session.clientId)}</p>
            <p className="tw-helper mt-1">{session.className} / {helpers.participantName(session.participantId)}</p>
            <p className="tw-helper mt-1">担当: {helpers.workerName(session.workerId) || "未割当"}</p>
            <p className="tw-helper mt-1">次のテーマ: {guide ? `${guide.number}. ${guide.title}` : "未設定"}</p>
          </div>
          <div className="flex shrink-0 flex-row flex-wrap gap-1 sm:flex-col sm:items-end">
            <StatusChip status={session.workerId ? "assigned" : "unassigned"} label={helpers.workerName(session.workerId) || "未割当"} />
            <StatusChip status={session.status} />
          </div>
        </div>
        {!compact ? <p className="tw-helper break-all font-bold text-[#2e7d46]">{session.zoomUrl}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <a href={session.zoomUrl} className="tw-secondary-button">
            <Video size={17} />
            Zoom
          </a>
          <Link href={session.status === "unassigned" ? "/apps/team-works/assignments" : "/apps/team-works/portal/worker"} className={session.status === "unassigned" ? "tw-primary-button" : "tw-secondary-button"}>
            {session.status === "unassigned" ? "担当者を割り当てる" : "実施画面へ"}
          </Link>
        </div>
      </div>
    </article>
  );
}

function DataList({
  items,
  empty
}: {
  items: { id: string; title: string; meta: string; detail: string; status: string }[];
  empty: string;
}) {
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="tw-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="tw-card-title">{item.title}</p>
              <p className="tw-helper mt-1">{item.meta}</p>
              <p className="tw-body mt-2">{item.detail}</p>
            </div>
            <StatusChip status="assigned" label={item.status} />
          </div>
        </article>
      ))}
    </div>
  );
}

type MetricTone = "orange" | "warn" | "green" | "navy";
type MetricProps = { label: string; value: string; helper?: string; tone?: MetricTone };

function Metric({ label, value, helper, tone = "orange" }: MetricProps) {
  const classes = {
    orange: "border-[#ffd8c4] bg-white",
    warn: "border-[#ffd8c4] bg-[#fff6f1]",
    green: "border-[#d6dde5] bg-[#f4f7fb]",
    navy: "border-[#d6dde5] bg-[#f4f7fb]"
  };
  return (
    <div className={`tw-card tw-summary-card border p-4 ${classes[tone]}`}>
      <p className={tone === "warn" ? "tw-helper font-bold text-[#f46a14]" : "tw-helper font-bold text-[#07152f]"}>{label}</p>
      <p className="mt-1 text-[22px] font-extrabold tracking-normal text-[#07152f] md:text-[24px]">{value}</p>
      {helper ? <p className="tw-helper mt-1">{helper}</p> : null}
    </div>
  );
}

function Panel({
  title,
  lead,
  children,
  tone = "default"
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  tone?: "default" | "urgent";
}) {
  return (
    <section className={`tw-card p-4 sm:p-[18px] md:p-5 ${tone === "urgent" ? "tw-urgent-panel" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="tw-section-title">{title}</h3>
          {lead ? <p className="tw-helper mt-1">{lead}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TwoColumn({ main, side }: { main: ReactNode; side: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">{main}{side}</div>;
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="tw-form-label">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="tw-form-input" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="tw-form-label">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="tw-form-input min-h-[96px] resize-none" />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="tw-form-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="tw-form-input">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: "save" | "send" }) {
  const Icon = icon === "save" ? Save : Send;
  return (
    <button type="button" onClick={onClick} className="tw-primary-button w-full">
      <Icon size={17} />
      {label}
    </button>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-2 flex min-h-11 items-center justify-between rounded-xl border border-[#e7ebf2] bg-white px-3 py-2 text-[length:var(--font-body)] font-bold text-[#07152f]">
      {label}
      <ArrowRight size={16} />
    </Link>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-3 py-2">
      <p className="tw-helper truncate font-bold">{label}</p>
      <p className="mt-1 truncate text-[length:var(--font-body)] font-bold text-[#07152f]">{value}</p>
    </div>
  );
}

function SummaryLine({ label, value, tone = "gray" }: { label: string; value: string; tone?: "gray" | "orange" | "green" }) {
  const toneClass = tone === "orange" ? "border-[#ffd8c4] bg-[#fff6f1]" : tone === "green" ? "border-[#d6dde5] bg-[#f4f7fb]" : "border-[#e7ebf2] bg-[#f8fafc]";
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className={tone === "orange" ? "tw-helper font-bold text-[#f46a14]" : "tw-helper font-bold text-[#07152f]"}>{label}</p>
      <p className="mt-1 text-[length:var(--font-body)] font-extrabold text-[#07152f]">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="tw-card-soft border-dashed p-5 text-[length:var(--font-body)] font-bold text-[#6f6862]">{text}</div>;
}

function StatusChip({ status, label }: { status: string; label?: string }) {
  const greenStatuses = ["assigned", "completed", "reviewed", "present", "active", "available"];
  const orangeStatuses = ["unassigned", "submitted", "late", "trial", "limited", "needs_revision"];
  const tone = greenStatuses.includes(status) ? "green" : orangeStatuses.includes(status) ? "orange" : "gray";
  return <span className={`tw-status-chip tw-status-${tone}`}>{label ?? statusLabel(status as never)}</span>;
}

function FlowStep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#e7ebf2] bg-white px-3 py-2">
      <ClipboardCheck size={16} className="text-[#f46a14]" />
      <p className="text-[length:var(--font-body)] font-bold text-[#07152f]">{label}</p>
    </div>
  );
}

function CollapsibleSection({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <section className="tw-card p-4 sm:p-[18px]">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-3 text-left">
        <span>
          <span className="tw-section-title block">{title}</span>
          {lead ? <span className="tw-helper mt-1 block">{lead}</span> : null}
        </span>
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-[#07152f]">
          <Icon size={18} />
        </span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

type ScreenProps = {
  state: TeamWorksState;
  updateState: (next: TeamWorksState) => void;
};

type Helpers = ReturnType<typeof createHelpers>;

function createHelpers(state: TeamWorksState) {
  return {
    clientName: (id: string) => state.clients.find((client) => client.id === id)?.name ?? "未設定",
    participantName: (id: string) => state.participants.find((participant) => participant.id === id)?.name ?? "未設定",
    workerName: (id: string) => state.workers.find((worker) => worker.id === id)?.name ?? "",
    participant: (id: string) => state.participants.find((participant) => participant.id === id),
    guide: (id: string) => state.guideItems.find((guide) => guide.id === id),
    reportForSession: (id: string) => state.reports.find((report) => report.sessionId === id)
  };
}

type PayoutRow = {
  workerId: string;
  workerName: string;
  count: number;
  hours: number;
  rate: number;
  amount: number;
};

function createPayoutRows(state: TeamWorksState): PayoutRow[] {
  return state.workers.map((worker) => {
    const sessions = state.sessions.filter((session) => session.workerId === worker.id && session.status === "completed");
    const minutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    const hours = Math.round((minutes / 60) * 10) / 10;
    return {
      workerId: worker.id,
      workerName: worker.name,
      count: sessions.length,
      hours,
      rate: worker.rate,
      amount: Math.round(hours * worker.rate)
    };
  });
}

function allowedViewsForMode(mode: ViewMode): TeamWorksView[] {
  if (mode === "worker") return ["workerPortal"];
  if (mode === "client") return ["clientPortal"];
  return ["home", "dashboard", "sessions", "assignments", "participants", "clients", "workers", "guides", "reports", "payouts", "invoices"];
}

function defaultViewForMode(mode: ViewMode): TeamWorksView {
  if (mode === "worker") return "workerPortal";
  if (mode === "client") return "clientPortal";
  return "home";
}

function modeForView(view: TeamWorksView): ViewMode {
  if (view === "workerPortal") return "worker";
  if (view === "clientPortal") return "client";
  return "admin";
}

function modeLabel(mode: ViewMode) {
  if (mode === "worker") return "パートナー画面";
  if (mode === "client") return "学校画面";
  return "管理者画面";
}

function navGroupsForMode(mode: ViewMode): { title: string; views: TeamWorksView[] }[] {
  if (mode === "worker") return [{ title: "パートナー", views: ["workerPortal"] }];
  if (mode === "client") return [{ title: "学校", views: ["clientPortal"] }];
  return [
    { title: "全体確認", views: ["home", "dashboard"] },
    { title: "授業運営", views: ["sessions", "assignments", "guides", "reports"] },
    { title: "学校・人", views: ["clients", "participants", "workers"] },
    { title: "締め処理", views: ["payouts", "invoices"] }
  ];
}

function getVisibleNav(view: TeamWorksView, mode: ViewMode) {
  const primaryViews = allowedViewsForMode(mode);
  const currentIsPrimary = primaryViews.includes(view);
  const navViews = currentIsPrimary ? primaryViews.slice(0, 5) : [view, ...primaryViews.slice(0, 4)];
  return navViews.map((navView) => teamWorksNav.find((item) => item.view === navView)).filter(Boolean) as typeof teamWorksNav[number][];
}

function createViewMetrics({
  view,
  state,
  payoutRows,
  payoutTotal,
  unassignedCount,
  reportWaitingCount,
  completedCount
}: {
  view: TeamWorksView;
  state: TeamWorksState;
  payoutRows: PayoutRow[];
  payoutTotal: number;
  unassignedCount: number;
  reportWaitingCount: number;
  completedCount: number;
}): MetricProps[] {
  if (view === "workerPortal") {
    const firstWorkerId = state.workers[0]?.id ?? "";
    const workerSessions = state.sessions.filter((session) => session.workerId === firstWorkerId || session.status === "unassigned");
    const missingReports = workerSessions.filter((session) => !state.reports.some((report) => report.sessionId === session.id)).length;
    return [
      { label: "今日の授業", value: `${workerSessions.length}件`, tone: "orange" },
      { label: "未提出報告", value: `${missingReports}件`, tone: missingReports ? "warn" : "green" },
      { label: "出勤中", value: `${state.clockedInSessionIds.length}件`, tone: "green" },
      { label: "名簿", value: `${state.attendanceEntries.length}名`, helper: "クリックでカルテ表示", tone: "navy" }
    ];
  }

  if (view === "guides") {
    return [
      { label: "テーマ数", value: `${state.guideItems.length}件`, tone: "navy" },
      { label: "カルテ連動", value: teamWorksTemplate.featureSettings.guideProgressLink ? "ON" : "OFF", tone: "orange" },
      { label: "進行表だけ", value: teamWorksTemplate.featureSettings.procedureOnlyMode ? "ON" : "OFF", tone: "navy" },
      { label: "翻訳表示", value: teamWorksTemplate.featureSettings.translationDisplay ? "ON" : "OFF", tone: "green" }
    ];
  }

  if (view === "participants") {
    return [
      { label: "生徒", value: `${state.participants.length}名`, tone: "navy" },
      { label: "次テーマ設定", value: `${state.participants.filter((participant) => participant.currentGuideItemId).length}名`, tone: "orange" },
      { label: "学校", value: `${state.clients.length}校`, tone: "navy" },
      { label: "カルテ連動", value: "ON", tone: "green" }
    ];
  }

  if (view === "assignments" || view === "sessions") {
    return [
      { label: "未割当", value: `${unassignedCount}件`, tone: unassignedCount ? "warn" : "green" },
      { label: "割当済み", value: `${state.sessions.filter((session) => session.status === "assigned").length}件`, tone: "green" },
      { label: "実施済み", value: `${completedCount}件`, tone: "green" },
      { label: "授業", value: `${state.sessions.length}件`, tone: "navy" }
    ];
  }

  if (view === "reports") {
    return [
      { label: "未確認報告", value: `${reportWaitingCount}件`, tone: reportWaitingCount ? "warn" : "green" },
      { label: "確認済み", value: `${state.reports.filter((report) => report.adminStatus === "reviewed").length}件`, tone: "green" },
      { label: "学校向けコメント", value: `${state.reports.filter((report) => report.clientComment).length}件`, tone: "navy" },
      { label: "報告数", value: `${state.reports.length}件`, tone: "navy" }
    ];
  }

  if (view === "payouts") {
    return [
      { label: "対象パートナー", value: `${payoutRows.length}名`, tone: "navy" },
      { label: "実施回数", value: `${payoutRows.reduce((sum, row) => sum + row.count, 0)}回`, tone: "green" },
      { label: "実施時間", value: `${payoutRows.reduce((sum, row) => sum + row.hours, 0)}時間`, tone: "green" },
      { label: "報酬予定", value: `${payoutTotal.toLocaleString()}円`, tone: "green" }
    ];
  }

  return [
    { label: "今日の授業", value: `${state.sessions.length}件`, tone: "orange" },
    { label: "未割当", value: `${unassignedCount}件`, tone: unassignedCount ? "warn" : "green" },
    { label: "未確認報告", value: `${reportWaitingCount}件`, tone: reportWaitingCount ? "warn" : "green" },
    { label: "報酬予定", value: `${payoutTotal.toLocaleString()}円`, tone: "green" }
  ];
}

function normalizeState(saved: Partial<TeamWorksState>): TeamWorksState {
  const fallbackGuideId = teamWorksInitialState.guideItems[0]?.id ?? "";
  return {
    ...teamWorksInitialState,
    ...saved,
    clients: (saved.clients ?? teamWorksInitialState.clients).map((client) => ({
      ...client,
      preferredLanguage: client.preferredLanguage ?? "en"
    })),
    participants: (saved.participants ?? teamWorksInitialState.participants).map((participant) => ({
      ...participant,
      currentGuideItemId: participant.currentGuideItemId ?? fallbackGuideId,
      lastGuideItemId: participant.lastGuideItemId ?? "",
      lastMemo: participant.lastMemo ?? "",
      nextMemo: participant.nextMemo ?? ""
    })),
    guideItems: (saved.guideItems?.length ? saved.guideItems : teamWorksInitialState.guideItems).map((guide) => ({
      ...guide,
      materialType: guide.materialType ?? "google_doc",
      materialTitle: guide.materialTitle ?? `${guide.number}. ${guide.title} 資料`,
      materialUrl: guide.materialUrl ?? `https://docs.google.com/document/d/team-works-guide-${guide.number}`,
      materialNote: guide.materialNote ?? "Google Docsで共有しながら作る資料をここから開く想定です。"
    })),
    attendanceEntries: saved.attendanceEntries ?? teamWorksInitialState.attendanceEntries,
    partnerAvailability: saved.partnerAvailability ?? teamWorksInitialState.partnerAvailability,
    messages: saved.messages ?? teamWorksInitialState.messages,
    reports: (saved.reports ?? teamWorksInitialState.reports).map((report) => ({
      ...report,
      participantId: report.participantId ?? saved.sessions?.find((session) => session.id === report.sessionId)?.participantId ?? teamWorksInitialState.participants[0]?.id ?? "",
      guideItemId: report.guideItemId ?? fallbackGuideId,
      internalNote: report.internalNote ?? "",
      clientComment: report.clientComment ?? ""
    })),
    clockedInSessionIds: saved.clockedInSessionIds ?? []
  };
}

function applyTextScale(textScale: TextScale) {
  document.documentElement.dataset.textScale = textScale;
  document.body.classList.toggle("text-scale-large", textScale === "large");
  document.body.classList.toggle("text-scale-standard", textScale === "standard");
}

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function languageLabel(value: string) {
  const labels: Record<string, string> = {
    ja: "日本語",
    en: "英語",
    id: "インドネシア語",
    vi: "ベトナム語"
  };
  return labels[value] ?? value;
}

function materialTypeLabel(value: TeamWorksGuideItem["materialType"]) {
  const labels: Record<string, string> = {
    google_doc: "Google Docs",
    pdf: "PDF",
    word: "Word",
    excel: "Excel",
    sheet: "Google Sheets",
    slide: "Google Slides",
    internal: "アプリ内メモ"
  };
  return labels[value ?? "internal"] ?? "資料";
}

const clientStatusOptions = [
  { value: "active", label: "契約中" },
  { value: "trial", label: "面談中" },
  { value: "paused", label: "休止中" }
];

const workerStatusOptions = [
  { value: "available", label: "稼働中" },
  { value: "limited", label: "一部稼働" },
  { value: "inactive", label: "停止中" }
];

const attendanceOptions = [
  { value: "present", label: "出席" },
  { value: "late", label: "遅刻" },
  { value: "absent", label: "欠席" },
  { value: "makeup", label: "振替" },
  { value: "unset", label: "未入力" }
];

const languageOptions = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "英語" },
  { value: "id", label: "インドネシア語" },
  { value: "vi", label: "ベトナム語" }
];

const materialTypeOptions = [
  { value: "google_doc", label: "Google Docs" },
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "excel", label: "Excel" },
  { value: "sheet", label: "Google Sheets" },
  { value: "slide", label: "Google Slides" },
  { value: "internal", label: "アプリ内メモ" }
];
