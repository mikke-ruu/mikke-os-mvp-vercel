"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Check, CheckCircle2, CircleDashed, Clock3, ExternalLink, GitBranch, Loader2, MessageSquarePlus, RotateCw, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { createImplementationConsultation, loadImplementationCenter, updateImplementationItemStatus, type ImplementationGate, type ImplementationItem, type ImplementationProject } from "@/lib/implementation-center";

const statusLabel: Record<ImplementationProject["status"], string> = { planning: "企画中", active: "実装中", waiting: "確認待ち", release_waiting: "公開待ち", completed: "完了", paused: "停止" };
const publicLabel: Record<ImplementationProject["public_state"], string> = { not_public: "未公開", internal: "内部のみ", partial: "一部確認可", public: "公開中" };
const gateLabels: Record<string, string> = { product: "商品", ui: "UI", feature: "機能", shared: "共通", auth: "認証", database: "DB/RLS", billing: "課金", legal: "法務", checks: "検証", git: "PR", deployment: "配備", production: "本番", homepage: "ホーム", promotion: "告知", operations: "運用" };
const consultationStatusLabel: Record<ImplementationItem["status"], string> = { open: "自動受付待ち", in_progress: "Codex対応中", waiting_user: "確認待ち", approved: "承認済み", rejected: "見送り", completed: "完了", archived: "保管" };

function projectTone(status: ImplementationProject["status"]) {
  if (status === "active") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "waiting" || status === "release_waiting") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]";
}

function GateStrip({ gates }: { gates: ImplementationGate[] }) {
  if (!gates.length) return <p className="text-xs text-[var(--mikke-muted-light)]">ゲートの証拠は順次登録します。</p>;
  return <div className="flex flex-wrap gap-1.5">{gates.map((gate) => <span key={gate.id} title={gate.summary} className={`rounded-full border px-2 py-1 text-[10px] font-bold ${gate.status === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : gate.status === "blocked" ? "border-red-200 bg-red-50 text-red-700" : gate.status === "in_progress" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-[var(--mikke-line)] text-[var(--mikke-muted)]"}`}>{gateLabels[gate.gate_key] ?? gate.gate_key}</span>)}</div>;
}

export default function ImplementationCenterPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ImplementationProject[]>([]);
  const [gates, setGates] = useState<ImplementationGate[]>([]);
  const [items, setItems] = useState<ImplementationItem[]>([]);
  const [selected, setSelected] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [showConsultation, setShowConsultation] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true); setError("");
    try { const data = await loadImplementationCenter(); setProjects(data.projects); setGates(data.gates); setItems(data.items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "実装センターを読み込めませんでした。"); }
    finally { if (!silent) setLoading(false); }
  }
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedProject = projects.find((project) => project.app_key === selected) ?? null;
  const visibleProjects = selectedProject ? [selectedProject] : projects;
  const visibleItems = useMemo(() => selectedProject ? items.filter((item) => item.project_id === selectedProject.id) : items, [items, selectedProject]);
  const approvals = visibleItems.filter((item) => item.item_type === "approval" && item.status === "waiting_user");
  const results = visibleItems.filter((item) => item.item_type === "result" || item.status === "completed").slice(0, 6);
  const consultations = visibleItems.filter((item) => item.item_type === "consultation" && item.status !== "archived").slice(0, 8);

  async function submitConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setSaving("consultation"); setError("");
    try {
      await createImplementationConsultation({ projectId: String(data.get("project_id") || "") || null, title: String(data.get("title") || "").trim(), body: String(data.get("body") || "").trim(), priority: String(data.get("priority") || "normal") as ImplementationItem["priority"], userId: user.id });
      form.reset(); setShowConsultation(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "相談を保存できませんでした。"); }
    finally { setSaving(""); }
  }

  async function decide(item: ImplementationItem, status: "approved" | "rejected") {
    setSaving(item.id); setError("");
    try { await updateImplementationItemStatus(item.id, status, user.id); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "判断を保存できませんでした。"); }
    finally { setSaving(""); }
  }

  if (loading) return <div className="grid min-h-[55vh] place-items-center text-sm text-[var(--mikke-muted)]"><span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} />最新状態を整理中…</span></div>;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="rounded-3xl border border-[var(--mikke-line)] bg-[linear-gradient(135deg,#132744_0%,#1d3b61_65%,#285377_100%)] p-5 text-white shadow-sm md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-3xl"><p className="text-xs font-bold tracking-[0.18em] text-blue-200">MIKKEOS IMPLEMENTATION CENTER</p><h1 className="mt-3 text-2xl font-bold md:text-3xl">実装センター</h1><p className="mt-3 text-sm leading-6 text-blue-100">ここに相談すると、Codexが自動受付して対象アプリへ配車します。進捗・確認依頼・結果もこの画面へ戻ります。</p></div><button type="button" onClick={() => setShowConsultation((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#183353] shadow-sm"><MessageSquarePlus size={17} />新しい相談</button></div>
      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">{[["実装中", projects.filter((p) => p.status === "active").length], ["判断待ち", items.filter((i) => i.status === "waiting_user").length], ["公開中", projects.filter((p) => p.public_state === "public").length], ["相談メモ", items.filter((i) => i.item_type === "consultation" && i.status !== "completed").length]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white/10 px-4 py-3"><p className="text-[11px] text-blue-200">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>
    </header>

    {error ? <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><AlertCircle size={16} />{error}<button type="button" onClick={() => void load()} className="ml-auto"><RotateCw size={16} /></button></p> : null}
    {showConsultation ? <form onSubmit={submitConsultation} className="grid gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:grid-cols-2 md:p-5">
      <label className="text-sm font-bold">アプリ<select name="project_id" defaultValue={selectedProject?.id ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 font-normal"><option value="">mikkeOS全体</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.app_name}</option>)}</select></label>
      <label className="text-sm font-bold">優先度<select name="priority" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 font-normal"><option value="normal">通常</option><option value="high">高い</option><option value="urgent">急ぎ</option><option value="low">いつか</option></select></label>
      <label className="text-sm font-bold md:col-span-2">相談タイトル<input name="title" required maxLength={160} placeholder="例：申込み画面をもっとわかりやすくしたい" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 font-normal" /></label>
      <label className="text-sm font-bold md:col-span-2">どうしたいですか？<textarea name="body" required rows={4} placeholder="思いついたことをそのまま書いてください。" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 font-normal" /></label>
      <p className="text-xs leading-5 text-[var(--mikke-muted)] md:col-span-2">登録後は自動受付されます。公開・課金・法務・個人情報など判断が必要な操作は「あなたの確認・承認」で止まります。</p>
      <div className="flex gap-2 md:col-span-2"><button disabled={saving === "consultation"} className="rounded-xl bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">相談して自動受付</button><button type="button" onClick={() => setShowConsultation(false)} className="rounded-xl border border-[var(--mikke-line)] px-5 py-3 text-sm font-bold">閉じる</button></div>
    </form> : null}

    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="アプリ別の進捗"><button type="button" onClick={() => setSelected("all")} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${selected === "all" ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white" : "border-[var(--mikke-line)] bg-white"}`}>全体</button>{projects.map((project) => <button key={project.id} type="button" onClick={() => setSelected(project.app_key)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${selected === project.app_key ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white" : "border-[var(--mikke-line)] bg-white"}`}>{project.app_name}</button>)}</nav>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.12em] text-[var(--mikke-primary)]">APP WORKSTREAMS</p><h2 className="mt-1 text-xl font-bold">アプリの現在地</h2></div><span className="text-xs text-[var(--mikke-muted)]">{visibleProjects.length}アプリ</span></div>
        {visibleProjects.map((project) => <article key={project.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{project.app_name}</h3><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${projectTone(project.status)}`}>{statusLabel[project.status]}</span><span className="rounded-full border border-[var(--mikke-line)] px-2 py-1 text-[10px] font-bold text-[var(--mikke-muted)]">{publicLabel[project.public_state]}</span></div><p className="mt-2 text-sm text-[var(--mikke-muted)]">{project.summary}</p></div>{project.verify_path ? <a href={project.verify_path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">画面を確認 <ExternalLink size={14} /></a> : null}</div><div className="mt-4 grid gap-3 rounded-xl bg-[var(--mikke-surface-soft)] p-3 md:grid-cols-2"><div><p className="text-[10px] font-bold text-[var(--mikke-muted-light)]">NOW</p><p className="mt-1 text-sm font-semibold">{project.current_focus || project.phase}</p></div><div><p className="text-[10px] font-bold text-[var(--mikke-muted-light)]">PUBLIC / VERIFY</p><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{project.verification_note}</p></div></div>{project.branch_ref ? <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--mikke-muted)]"><GitBranch size={13} />{project.branch_ref}</p> : null}<div className="mt-3"><GateStrip gates={gates.filter((gate) => gate.project_id === project.id)} /></div></article>)}
      </section>
      <aside className="space-y-5">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-amber-900"><Clock3 size={18} /><h2 className="font-bold">あなたの確認・承認</h2></div>{approvals.length === 0 ? <p className="mt-3 text-sm text-amber-800">この範囲に判断待ちはありません。</p> : <div className="mt-3 space-y-3">{approvals.map((item) => <article key={item.id} className="rounded-xl border border-amber-200 bg-white p-3"><h3 className="text-sm font-bold">{item.title}</h3><p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">{item.question || item.body}</p><div className="mt-3 flex gap-2"><button type="button" disabled={saving === item.id} onClick={() => void decide(item, "approved")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Check size={14} />承認</button><button type="button" disabled={saving === item.id} onClick={() => void decide(item, "rejected")} className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><X size={14} />見送り</button></div></article>)}</div>}</section>
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><MessageSquarePlus size={18} className="text-[var(--mikke-primary)]" /><h2 className="font-bold">相談レーン</h2></div>{consultations.length === 0 ? <p className="mt-3 text-sm text-[var(--mikke-muted)]">まだ相談はありません。</p> : <div className="mt-3 space-y-2">{consultations.map((item) => <article key={item.id} className="rounded-xl bg-[var(--mikke-surface-soft)] p-3"><div className="flex items-center gap-2"><CircleDashed size={13} className={item.status === "in_progress" ? "animate-spin text-blue-600" : item.status === "completed" ? "text-emerald-600" : "text-[var(--mikke-primary)]"} /><p className="text-xs font-bold">{item.title}</p><span className="ml-auto rounded-full border border-[var(--mikke-line)] bg-white px-2 py-1 text-[9px] font-bold text-[var(--mikke-muted)]">{consultationStatusLabel[item.status]}</span></div><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--mikke-muted)]">{item.body}</p>{item.question && item.status === "waiting_user" ? <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-semibold text-amber-800">{item.question}</p> : null}</article>)}</div>}</section>
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /><h2 className="font-bold">結果・完了</h2></div>{results.length === 0 ? <p className="mt-3 text-sm text-[var(--mikke-muted)]">完了結果はここに蓄積されます。</p> : <div className="mt-3 space-y-2">{results.map((item) => <article key={item.id} className="border-b border-[var(--mikke-line-soft)] pb-3 last:border-0"><p className="text-xs font-bold">{item.title}</p><p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">{item.result || item.body}</p></article>)}</div>}</section>
        <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-5 text-blue-800"><ShieldCheck size={15} className="mb-1" />Codexの会話全文、トークン、顧客の非公開データは保存せず、進捗・判断・証拠参照だけを管理します。</p>
      </aside>
    </div>
  </div>;
}
