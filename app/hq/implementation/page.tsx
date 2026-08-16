"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle2, CircleDashed,
  Copy, ExternalLink, FileCode2, FolderOpen, GitBranch, Lightbulb, ListTodo, Loader2, Map as MapIcon, MessageSquarePlus,
  MessageCircle, MonitorCog, MonitorPlay, PackageCheck, PlayCircle, Rocket, RotateCw, ShieldCheck, Square, X,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { ImplementationConversationPanel } from "@/components/hq/ImplementationConversationPanel";
import {
  loadImplementationCenter, requestLocalPreview, updateImplementationItemStatus,
  type ImplementationAttachment, type ImplementationConversation, type ImplementationGate,
  type ImplementationItem, type ImplementationLane, type ImplementationMessage, type ImplementationProject,
} from "@/lib/implementation-center";

const statusLabel: Record<ImplementationProject["status"], string> = { planning: "企画中", active: "実装中", waiting: "確認待ち", release_waiting: "公開待ち", completed: "完了", paused: "停止" };
const publicLabel: Record<ImplementationProject["public_state"], string> = { not_public: "未公開", internal: "内部のみ", partial: "限定確認", public: "本番公開中" };
const roadmapLabel: Record<ImplementationProject["roadmap_stage"], string> = { idea: "構想", prototype: "試作", local_build: "ローカル実装", local_ready: "ローカル完成", release_ready: "リリース準備完了", released: "リリース済み", operating: "公開・運用中", paused: "停止" };
const gateLabels: Record<string, string> = { product: "商品", ui: "UI", feature: "機能", shared: "連携", auth: "認証", database: "DB/RLS", billing: "課金", legal: "法務", checks: "テスト", git: "PR", deployment: "配備", production: "本番", homepage: "ホーム", promotion: "告知", operations: "運用" };
const menuLabel = { not_listed: "未掲載", planned: "掲載予定", ready: "掲載可", listed: "掲載済み" } as const;
const previewLabel: Record<ImplementationItem["preview_status"], string> = {
  not_started: "未起動", queued: "起動待ち", preparing: "環境準備中", starting: "起動中",
  ready: "確認できます", stale: "再起動が必要", stopping: "停止中", stopped: "停止済み", failed: "起動失敗",
};

const lanes: Array<{ key: ImplementationLane; title: string; description: string; icon: typeof ListTodo; tone: string }> = [
  { key: "request", title: "あなたがやりたいこと", description: "相談や依頼から確定した目的", icon: ListTodo, tone: "border-violet-200 bg-violet-50 text-violet-900" },
  { key: "proposal", title: "Codexからの提案", description: "現在地から見た次の選択肢", icon: Lightbulb, tone: "border-amber-200 bg-amber-50 text-amber-900" },
  { key: "local_result", title: "ローカル実装済み", description: "未公開を含む、確認できる成果", icon: MonitorCog, tone: "border-blue-200 bg-blue-50 text-blue-900" },
  { key: "production_result", title: "本番実装済み", description: "master・配備・本番確認まで完了", icon: PackageCheck, tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
];

function toneForProject(project: ImplementationProject) {
  if (project.public_state === "public") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (project.roadmap_stage === "release_ready") return "border-violet-200 bg-violet-50 text-violet-800";
  if (["local_build", "local_ready"].includes(project.roadmap_stage)) return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]";
}

type RoomActivity = {
  kind: "executing" | "responding" | "execution_queued" | "discussion_queued";
  label: string;
  count: number;
  active: boolean;
  tone: string;
};

function roomActivityForProject(projectId: string, conversations: ImplementationConversation[], messages: ImplementationMessage[]): RoomActivity | null {
  const conversationIds = new Set(conversations.filter((conversation) => conversation.project_id === projectId).map((conversation) => conversation.id));
  const activeMessages = messages.filter((message) => message.role === "user" && conversationIds.has(message.conversation_id) && ["pending", "in_progress"].includes(message.status));
  if (!activeMessages.length) return null;

  const definitions: Array<Omit<RoomActivity, "count"> & { matches: (message: ImplementationMessage) => boolean }> = [
    { kind: "executing", label: "実行中", active: true, tone: "border-violet-600 bg-violet-600 text-white shadow-sm", matches: (message) => message.mode === "execution" && message.status === "in_progress" },
    { kind: "responding", label: "回答作成中", active: true, tone: "border-blue-600 bg-blue-600 text-white shadow-sm", matches: (message) => message.mode === "discussion" && message.status === "in_progress" },
    { kind: "execution_queued", label: "実行待ち", active: false, tone: "border-amber-300 bg-amber-50 text-amber-950", matches: (message) => message.mode === "execution" && message.status === "pending" },
    { kind: "discussion_queued", label: "回答待ち", active: false, tone: "border-sky-300 bg-sky-50 text-sky-950", matches: (message) => message.mode === "discussion" && message.status === "pending" },
  ];
  const definition = definitions.find((candidate) => activeMessages.some(candidate.matches));
  return definition ? { ...definition, count: activeMessages.length } : null;
}

function GateProgress({ project, gates }: { project: ImplementationProject; gates: ImplementationGate[] }) {
  const relevant = gates.filter((gate) => gate.project_id === project.id && gate.status !== "not_applicable");
  const verified = relevant.filter((gate) => gate.status === "verified").length;
  const percent = relevant.length ? Math.round((verified / relevant.length) * 100) : 0;
  return <div>
    <div className="flex items-center justify-between text-[10px] font-bold text-[var(--mikke-muted)]"><span>確認済みゲート</span><span>{verified}/{relevant.length}（{percent}%）</span></div>
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--mikke-primary)]" style={{ width: `${percent}%` }} /></div>
    <div className="mt-2 flex flex-wrap gap-1">{relevant.filter((gate) => gate.status !== "not_started").map((gate) => <span key={gate.id} title={gate.summary} className={`rounded-full border px-2 py-1 text-[9px] font-bold ${gate.status === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : gate.status === "blocked" ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{gateLabels[gate.gate_key] ?? gate.gate_key}</span>)}</div>
  </div>;
}

function WorkLane({ definition, items, projects, previewSaving, onPreview }: { definition: (typeof lanes)[number]; items: ImplementationItem[]; projects: ImplementationProject[]; previewSaving: string; onPreview: (item: ImplementationItem, action: "start" | "stop") => Promise<void> }) {
  const Icon = definition.icon;
  const visible = items.filter((item) => item.item_type === definition.key).slice(0, 12);
  return <section className={`rounded-2xl border p-4 ${definition.tone}`}>
    <div className="flex items-start gap-2"><Icon size={18} className="mt-0.5 shrink-0" /><div><h3 className="font-bold">{definition.title}</h3><p className="mt-0.5 text-[10px] opacity-75">{definition.description}</p></div><span className="ml-auto rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold">{visible.length}</span></div>
    {visible.length ? <div className="mt-3 space-y-2">{visible.map((item) => {
      const project = projects.find((candidate) => candidate.id === item.project_id);
      const verifyUrl = definition.key === "local_result" ? item.local_verify_url : definition.key === "production_result" ? item.production_url : "";
      const previewBusy = ["queued", "preparing", "starting", "stopping"].includes(item.preview_status);
      return <article key={item.id} className="rounded-xl border border-current/10 bg-white p-3 text-[var(--mikke-ink)] shadow-sm"><div className="flex items-start gap-2"><div className="min-w-0"><p className="text-xs font-bold leading-5">{item.title}</p><p className="mt-1 line-clamp-3 text-[10px] leading-5 text-[var(--mikke-muted)]">{item.result || item.body}</p></div>{project ? <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">{project.app_name}</span> : null}</div>
        {definition.key === "local_result" ? <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-2.5">
          <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-bold text-blue-800"><MonitorCog size={11} />{previewLabel[item.preview_status]}</span>{item.local_branch ? <span className="inline-flex min-w-0 items-center gap-1 truncate text-[9px] text-blue-800"><GitBranch size={10} />{item.local_branch}</span> : null}</div>
          {item.local_path ? <div className="mt-2 flex items-start gap-1 text-[9px] text-blue-950"><FolderOpen size={11} className="mt-0.5 shrink-0" /><span className="min-w-0 break-all">{item.local_path}</span><button type="button" title="ローカル保存先をコピー" onClick={() => void navigator.clipboard.writeText(item.local_path)} className="ml-auto shrink-0 rounded p-1 text-blue-700"><Copy size={11} /></button></div> : <p className="mt-2 text-[9px] text-blue-800">保存先は次の自動棚卸しで登録されます。</p>}
          {item.changed_files?.length ? <div className="mt-2"><p className="flex items-center gap-1 text-[9px] font-bold text-blue-900"><FileCode2 size={11} />変更ファイル（{item.changed_files.length}）</p><div className="mt-1 flex flex-wrap gap-1">{item.changed_files.slice(0, 6).map((file) => <span key={file} title={file} className="max-w-full truncate rounded bg-white px-1.5 py-1 text-[8px] text-blue-900">{file}</span>)}</div></div> : null}
          {item.preview_note ? <p className="mt-2 text-[9px] leading-4 text-blue-900">{item.preview_note}</p> : null}{item.preview_error ? <p className="mt-1 text-[9px] leading-4 text-red-700">{item.preview_error}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">{item.preview_status === "ready" && item.preview_url ? <><a href={item.preview_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-2.5 py-2 text-[10px] font-bold text-white"><MonitorPlay size={12} />ローカルUIを開く</a><button type="button" disabled={previewSaving === item.id} onClick={() => void onPreview(item, "stop")} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-[10px] font-bold text-blue-800"><Square size={11} />停止</button></> : <button type="button" disabled={!item.local_path || previewBusy || previewSaving === item.id} onClick={() => void onPreview(item, "start")} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-2.5 py-2 text-[10px] font-bold text-white disabled:opacity-50">{previewBusy || previewSaving === item.id ? <Loader2 size={12} className="animate-spin" /> : <MonitorPlay size={12} />}{previewBusy ? previewLabel[item.preview_status] : item.preview_status === "failed" ? "もう一度起動" : "ローカルUIを起動"}</button>}</div>
          <p className="mt-2 text-[8px] leading-4 text-blue-700">このPC上の専用worktreeを起動します。確認URLはこのPCでだけ開け、初回はローカル画面でもログインが必要です。</p>
        </div> : verifyUrl ? <a href={verifyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--mikke-primary)]">確認する <ExternalLink size={11} /></a> : item.evidence_ref ? <p className="mt-2 truncate text-[9px] text-[var(--mikke-muted-light)]">{item.evidence_ref}</p> : null}
      </article>;
    })}</div> : <p className="mt-3 rounded-xl border border-dashed border-current/20 bg-white/50 p-3 text-[10px] leading-5 opacity-70">このレーンはまだ登録されていません。相談と実装結果から自動で増えます。</p>}
  </section>;
}

export default function ImplementationCenterPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ImplementationProject[]>([]);
  const [gates, setGates] = useState<ImplementationGate[]>([]);
  const [items, setItems] = useState<ImplementationItem[]>([]);
  const [conversations, setConversations] = useState<ImplementationConversation[]>([]);
  const [messages, setMessages] = useState<ImplementationMessage[]>([]);
  const [attachments, setAttachments] = useState<ImplementationAttachment[]>([]);
  const [selected, setSelected] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [previewSaving, setPreviewSaving] = useState("");
  const [error, setError] = useState("");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await loadImplementationCenter();
      setProjects(data.projects); setGates(data.gates); setItems(data.items);
      setConversations(data.conversations); setMessages(data.messages); setAttachments(data.attachments);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "実装センターを読み込めませんでした。"); }
    finally { if (!silent) setLoading(false); }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 4_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedProject = projects.find((project) => project.app_key === selected) ?? null;
  const activityByProject = useMemo(() => new Map(projects.flatMap((project) => {
    const activity = roomActivityForProject(project.id, conversations, messages);
    return activity ? [[project.id, activity] as const] : [];
  })), [projects, conversations, messages]);
  const visibleProjects = selectedProject ? [selectedProject] : projects;
  const visibleItems = useMemo(() => selectedProject ? items.filter((item) => item.project_id === selectedProject.id) : items, [items, selectedProject]);
  const approvals = visibleItems.filter((item) => item.item_type === "approval" && item.status === "waiting_user");
  const handoffs = visibleItems.filter((item) => item.item_type === "handoff" && !["completed", "archived", "rejected"].includes(item.status));
  const published = projects.filter((project) => project.public_state === "public");
  const unreleased = projects.filter((project) => project.public_state !== "public" && project.roadmap_stage !== "paused");
  const releaseReady = projects.filter((project) => project.roadmap_stage === "release_ready");

  async function decide(item: ImplementationItem, status: "approved" | "rejected") {
    setSaving(item.id); setError("");
    try { await updateImplementationItemStatus(item.id, status, user.id); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "判断を保存できませんでした。"); }
    finally { setSaving(""); }
  }

  async function preview(item: ImplementationItem, action: "start" | "stop") {
    setPreviewSaving(item.id); setError("");
    try { await requestLocalPreview(item.id, action); await load(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ローカルUIを操作できませんでした。"); }
    finally { setPreviewSaving(""); }
  }

  if (loading) return <div className="grid min-h-[55vh] place-items-center text-sm text-[var(--mikke-muted)]"><span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} />mikkeOS全体の現在地を整理中…</span></div>;

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <header className="rounded-3xl border border-[var(--mikke-line)] bg-[linear-gradient(135deg,#132744_0%,#1d3b61_65%,#285377_100%)] p-5 text-white shadow-sm md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-3xl"><p className="text-xs font-bold tracking-[0.18em] text-blue-200">MIKKEOS DEVELOPMENT CONTROL ROOM</p><h1 className="mt-3 text-2xl font-bold md:text-3xl">mikkeOS 開発管制室</h1><p className="mt-3 text-sm leading-6 text-blue-100">全アプリの現在地、ローカル成果、本番成果、次の一手を一つに集約。相談から担当アプリへの連携と実行確認まで、この画面で進めます。</p></div><a href="#app-consultation-room" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#183353] shadow-sm"><MessageSquarePlus size={17} />相談する</a></div>
      <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-5">{[
        ["本番公開中", published.length], ["未リリース", unreleased.length], ["リリース準備完了", releaseReady.length], ["あなたの確認", approvals.length], ["アプリ間連携", handoffs.length],
      ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white/10 px-4 py-3"><p className="text-[11px] text-blue-200">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>
    </header>

    {error ? <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><AlertCircle size={16} />{error}<button type="button" onClick={() => void load()} className="ml-auto"><RotateCw size={16} /></button></p> : null}

    <div className="space-y-2">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="アプリ別の進捗"><button type="button" onClick={() => setSelected("all")} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${selected === "all" ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white" : "border-[var(--mikke-line)] bg-white"}`}>全体{activityByProject.size ? <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px]">動作中・待ち {activityByProject.size}</span> : null}</button>{projects.map((project) => {
        const activity = activityByProject.get(project.id);
        const isSelected = selected === project.app_key;
        const StatusIcon = activity?.kind === "executing" || activity?.kind === "execution_queued" ? PlayCircle : MessageCircle;
        return <button key={project.id} type="button" onClick={() => setSelected(project.app_key)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold transition ${activity?.tone ?? (isSelected ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white" : "border-[var(--mikke-line)] bg-white")} ${isSelected ? "ring-2 ring-[var(--mikke-primary)]/25 ring-offset-2" : ""}`}><span>{project.app_name}</span>{activity ? <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold text-slate-800"><StatusIcon size={11} className={activity.active ? "animate-pulse" : ""} />{activity.label}{activity.count > 1 ? ` ${activity.count}` : ""}</span> : null}</button>;
      })}</nav>
      {activityByProject.size ? <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] font-semibold text-[var(--mikke-muted)]"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 animate-pulse rounded-full bg-violet-600" />紫・青は処理中</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-300" />黄・水色は受付済み</span><span>完了すると通常色に戻ります</span></p> : null}
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div id="app-consultation-room" className="scroll-mt-5"><ImplementationConversationPanel project={selectedProject} conversations={conversations} messages={messages} attachments={attachments} userId={user.id} onChanged={() => load(true)} /></div>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-amber-950"><ShieldCheck size={18} /><h2 className="font-bold">あなたの確認・承認</h2></div>{approvals.length ? <div className="mt-3 space-y-3">{approvals.map((item) => <article key={item.id} className="rounded-xl border border-amber-200 bg-white p-3"><h3 className="text-sm font-bold">{item.title}</h3><p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">{item.question || item.body}</p><div className="mt-3 flex gap-2"><button type="button" disabled={saving === item.id} onClick={() => void decide(item, "approved")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Check size={14} />承認</button><button type="button" disabled={saving === item.id} onClick={() => void decide(item, "rejected")} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><X size={14} />見送り</button></div></article>)}</div> : <p className="mt-3 text-sm text-amber-800">この範囲に判断待ちはありません。</p>}</section>
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4"><div className="flex items-center gap-2"><ArrowRight size={18} className="text-[var(--mikke-primary)]" /><h2 className="font-bold">アプリ・部屋間の連携</h2></div>{handoffs.length ? <div className="mt-3 space-y-2">{handoffs.map((item) => <article key={item.id} className="rounded-xl bg-[var(--mikke-surface-soft)] p-3"><p className="text-xs font-bold">{item.title}</p><p className="mt-1 text-[10px] leading-5 text-[var(--mikke-muted)]">{item.body}</p>{item.task_ref ? <p className="mt-1 text-[9px] font-bold text-[var(--mikke-primary)]">担当: {item.task_ref}</p> : null}</article>)}</div> : <p className="mt-3 text-sm text-[var(--mikke-muted)]">相談から必要な担当が見つかると、ここへ自動登録されます。</p>}</section>
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-blue-900"><div className="flex items-center gap-2 font-bold"><Rocket size={17} />リリースの流れ</div><p className="mt-2">ローカル完成・テスト済み → リリース日を決定 → master・本番配備 → アプリメニューとホームページへ掲載 → 告知・運用へ進みます。</p></section>
      </aside>
    </div>

    <section><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.12em] text-[var(--mikke-primary)]">PORTFOLIO ROADMAP</p><h2 className="mt-1 text-xl font-bold">全体とアプリの現在地</h2></div><span className="text-xs text-[var(--mikke-muted)]">{visibleProjects.length}アプリ</span></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">{visibleProjects.map((project) => <article key={project.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{project.app_name}</h3><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${toneForProject(project)}`}>{roadmapLabel[project.roadmap_stage]}</span><span className="rounded-full border border-[var(--mikke-line)] px-2 py-1 text-[10px] font-bold text-[var(--mikke-muted)]">{publicLabel[project.public_state]}</span></div><p className="mt-2 text-sm text-[var(--mikke-muted)]">{project.summary}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{statusLabel[project.status]}</span></div>
        <div className="mt-4 grid gap-3 rounded-xl bg-[var(--mikke-surface-soft)] p-3 md:grid-cols-2"><div><p className="text-[10px] font-bold text-[var(--mikke-muted-light)]">現在地</p><p className="mt-1 text-sm font-semibold">{project.current_focus || project.phase}</p></div><div><p className="text-[10px] font-bold text-[var(--mikke-muted-light)]">次にやること</p><p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-primary)]">{project.next_action || "次の棚卸しで登録します。"}</p></div></div>
        <div className="mt-4"><GateProgress project={project} gates={gates} /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-800">ローカル</p><p className="mt-1 text-xs font-semibold text-blue-950">{project.local_state === "tested" ? "テスト済み" : project.local_state === "implemented" ? "実装あり" : project.local_state === "in_progress" ? "実装中" : "未確認"}</p>{project.local_verify_url ? <a href={project.local_verify_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">ローカルを確認 <ExternalLink size={11} /></a> : project.branch_ref ? <p className="mt-2 flex items-center gap-1 truncate text-[9px] text-blue-700"><GitBranch size={10} />{project.branch_ref}</p> : null}</div><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-800">本番</p><p className="mt-1 text-xs font-semibold text-emerald-950">{publicLabel[project.public_state]}</p>{project.production_url ? <a href={project.production_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">本番を確認 <ExternalLink size={11} /></a> : null}</div></div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] font-bold text-[var(--mikke-muted)]"><span className="rounded-full border px-2 py-1">アプリメニュー: {menuLabel[project.app_menu_state]}</span><span className="rounded-full border px-2 py-1">ホームページ: {menuLabel[project.homepage_state]}</span>{project.roadmap_stage === "release_ready" ? <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-violet-800"><CalendarDays size={10} />{project.release_target_date || "リリース日を決める"}</span> : null}</div>
      </article>)}</div>
    </section>

    <section><div className="flex items-center gap-2"><MapIcon size={19} className="text-[var(--mikke-primary)]" /><div><p className="text-xs font-bold tracking-[0.12em] text-[var(--mikke-primary)]">WORK MAP</p><h2 className="text-xl font-bold">何を直し、どこへ繋げるか</h2></div></div><div className="mt-3 grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">{lanes.map((lane) => <WorkLane key={lane.key} definition={lane} items={visibleItems} projects={projects} previewSaving={previewSaving} onPreview={preview} />)}</div></section>

  </div>;
}
