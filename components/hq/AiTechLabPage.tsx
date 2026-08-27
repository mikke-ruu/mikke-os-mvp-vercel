"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Beaker,
  BookCheck,
  Check,
  ExternalLink,
  FlaskConical,
  Loader2,
  Newspaper,
  Pause,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import {
  approveAiTechCandidate,
  decideAiTechExperiment,
  loadAiTechLab,
  type AiTechCandidate,
  type AiTechExperiment,
  type AiTechLabData,
  type AiTechNews,
  type AiTechNewsCategory
} from "@/lib/ai-tech-lab";

export type AiTechLabMode = "news" | "for-mikkeos" | "lab" | "adopted";

const tabs: { mode: AiTechLabMode; label: string; href: string; icon: typeof Newspaper }[] = [
  { mode: "news", label: "NEWS", href: "/hq/ai-tech", icon: Newspaper },
  { mode: "for-mikkeos", label: "mikkeOSで活用", href: "/hq/ai-tech/for-mikkeos", icon: Sparkles },
  { mode: "lab", label: "LAB", href: "/hq/ai-tech/lab", icon: FlaskConical },
  { mode: "adopted", label: "ADOPTED", href: "/hq/ai-tech/adopted", icon: BookCheck }
];

const categoryLabels: Record<AiTechNewsCategory, string> = {
  ai_general: "AI全般",
  openai_codex: "OpenAI / Codex",
  claude: "Claude / Claude Code",
  google: "Google",
  image: "IMAGE",
  web_ui: "WEB / UI",
  video: "VIDEO",
  automation: "AUTOMATION",
  new_tools: "NEW TOOLS"
};

const candidateLabels: Record<AiTechCandidate["category"], string> = {
  image: "IMAGE",
  web_ui: "WEB / UI",
  video: "VIDEO",
  development: "DEVELOPMENT",
  automation: "AUTOMATION",
  content: "CONTENT",
  new_feature: "NEW FEATURE"
};

const experimentLabels: Record<AiTechExperiment["status"], string> = {
  approved: "テスト承認済み",
  running: "テスト中",
  result_ready: "結果確認待ち",
  adopted: "採用",
  held: "保留",
  rejected: "不採用"
};

const star = (score: number) => `${"★".repeat(score)}${"☆".repeat(Math.max(0, 5 - score))}`;

function formatDate(value: string | null) {
  if (!value) return "公開日未確認";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(value));
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-[var(--mikke-line)] bg-white px-5 py-10 text-center">
      <Beaker className="mx-auto text-[var(--mikke-primary)]" size={28} />
      <h2 className="mt-3 font-bold text-[var(--mikke-text)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--mikke-muted)]">{body}</p>
    </section>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[var(--mikke-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold tracking-wide text-amber-500" aria-label={`${label} ${value}/5`}>
        {star(value)}
      </p>
    </div>
  );
}

export function AiTechLabPage({ mode }: { mode: AiTechLabMode }) {
  const [data, setData] = useState<AiTechLabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function reload(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      setData(await loadAiTechLab());
    } catch (cause) {
      console.error("AI TECH LAB load failed", cause);
      setError("AI TECH LABのデータ準備を確認できませんでした。本番DBへはまだ何も変更していません。");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const sourceById = useMemo(() => new Map((data?.sources ?? []).map((source) => [source.id, source])), [data]);
  const newsById = useMemo(() => new Map((data?.news ?? []).map((news) => [news.id, news])), [data]);
  const candidateById = useMemo(() => new Map((data?.candidates ?? []).map((candidate) => [candidate.id, candidate])), [data]);
  const candidateByNewsId = useMemo(() => new Map((data?.candidates ?? []).map((candidate) => [candidate.news_id, candidate])), [data]);

  async function approve(candidate: AiTechCandidate) {
    setSaving(candidate.id);
    setNotice("");
    setError("");
    try {
      await approveAiTechCandidate(candidate.id);
      setNotice("LABでの小規模テストを承認しました。本番環境には導入されません。");
      await reload(true);
    } catch (cause) {
      console.error("AI TECH LAB approval failed", cause);
      setError("承認を保存できませんでした。ownerまたはadmin権限とDB準備状況を確認してください。");
    } finally {
      setSaving("");
    }
  }

  async function decide(experiment: AiTechExperiment, decision: "adopt" | "hold" | "reject") {
    if (decision === "adopt" && !window.confirm("この方法をmikkeOSの採用ノウハウとして登録しますか？")) return;
    setSaving(experiment.id);
    setNotice("");
    setError("");
    try {
      await decideAiTechExperiment(experiment.id, decision);
      setNotice(decision === "adopt" ? "採用しました。ADOPTEDへ登録されました。" : decision === "hold" ? "保留にしました。" : "今回は不採用にしました。");
      await reload(true);
    } catch (cause) {
      console.error("AI TECH LAB decision failed", cause);
      setError("判断を保存できませんでした。結果報告が完了しているか確認してください。");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-6">
      <header className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#172554_0%,#3730a3_58%,#6d28d9_100%)] p-5 text-white shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-bold tracking-[0.18em] text-indigo-200">MIKKEOS AI TECH LAB</p>
            <h1 className="mt-3 text-2xl font-bold md:text-3xl">世界のAI技術を、mikkeOSの力へ</h1>
            <p className="mt-3 text-sm leading-6 text-indigo-100">
              ニュースを読む → mikkeOSで活用できるものを選ぶ → 小さく試す → あなたが採用を決める、の順で進みます。
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
            <p className="font-bold">毎朝3分で確認</p>
            <p className="mt-1 text-xs text-indigo-100">本番導入は自動で行いません</p>
          </div>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="AI TECH LAB">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.mode === mode;
          return (
            <Link
              key={tab.mode}
              href={tab.href}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold ${active ? "border-indigo-700 bg-indigo-700 text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`}
            >
              <Icon size={15} /> {tab.label}
            </Link>
          );
        })}
      </nav>

      {notice ? <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><Check size={16} />{notice}</p> : null}
      {error ? <p className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900"><ShieldCheck size={16} />{error}<button type="button" onClick={() => void reload()} className="ml-auto"><RefreshCw size={16} /></button></p> : null}

      {loading ? (
        <div className="grid min-h-[35vh] place-items-center text-sm text-[var(--mikke-muted)]"><span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} />最新情報を整理しています…</span></div>
      ) : data ? (
        <>
          {mode === "news" ? <NewsView data={data} sourceById={sourceById} candidateByNewsId={candidateByNewsId} /> : null}
          {mode === "for-mikkeos" ? <CandidatesView data={data} newsById={newsById} saving={saving} onApprove={approve} /> : null}
          {mode === "lab" ? <LabView data={data} candidateById={candidateById} saving={saving} onDecide={decide} /> : null}
          {mode === "adopted" ? <AdoptedView data={data} /> : null}
        </>
      ) : null}
    </div>
  );
}

function NewsView({
  data,
  sourceById,
  candidateByNewsId
}: {
  data: AiTechLabData;
  sourceById: Map<string, AiTechLabData["sources"][number]>;
  candidateByNewsId: Map<string, AiTechCandidate>;
}) {
  const report = data.reports[0];
  return (
    <div className="space-y-4">
      {report ? (
        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 md:p-5">
          <p className="text-xs font-bold text-violet-700">WEEKLY AI REPORT</p>
          <h2 className="mt-2 font-bold text-violet-950">{report.title}</h2>
          <p className="mt-2 text-sm leading-6 text-violet-900">{report.summary}</p>
        </section>
      ) : null}

      {data.news.length ? data.news.map((item) => {
        const source = sourceById.get(item.source_id);
        const candidate = candidateByNewsId.get(item.id);
        return (
          <article key={item.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">{categoryLabels[item.category]}</span>
              <span className="text-[var(--mikke-muted)]">{source?.publisher ?? "公式情報"}｜{formatDate(item.published_at)}</span>
              {candidate ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">mikkeOSで活用できそう</span> : null}
            </div>
            <h2 className="mt-3 text-lg font-bold text-[var(--mikke-text)]">{item.title}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-3"><p className="text-[10px] font-bold text-[var(--mikke-muted)]">ざっくり</p><p className="mt-1 text-sm leading-6">{item.summary || "要約を準備中です。"}</p></div>
              <div className="rounded-xl bg-indigo-50 p-3"><p className="text-[10px] font-bold text-indigo-700">なぜ重要？</p><p className="mt-1 text-sm leading-6 text-indigo-950">{item.why_it_matters || "重要性を評価中です。"}</p></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Score label="注目度" value={item.importance_score} />
              <div className="flex flex-wrap gap-2">
                {candidate ? <Link href="/hq/ai-tech/for-mikkeos" className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">活用案を見る <ArrowRight size={14} /></Link> : null}
                <a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">元情報 <ExternalLink size={13} /></a>
              </div>
            </div>
          </article>
        );
      }) : (
        <EmptyState title="最初のニュース取得待ちです" body="公式3ソースを登録済みです。MVPでは手動取得結果を確認してから掲載し、未確認情報やダミーニュースは表示しません。" />
      )}

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <h2 className="text-sm font-bold">確認する公式ソース</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {data.sources.map((source) => <a key={source.id} href={source.official_url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-3 text-xs font-bold">{source.name}<ExternalLink size={13} /></a>)}
        </div>
      </section>
    </div>
  );
}

function CandidatesView({ data, newsById, saving, onApprove }: { data: AiTechLabData; newsById: Map<string, AiTechNews>; saving: string; onApprove: (candidate: AiTechCandidate) => Promise<void> }) {
  const candidates = data.candidates.filter((candidate) => candidate.status !== "dismissed");
  if (!candidates.length) return <EmptyState title="mikkeOSで活用できるものを選別中です" body="ニュースの新しさではなく、時間短縮・品質向上・自動化・費用・体験改善を基準に候補を出します。" />;

  return <div className="grid gap-4 lg:grid-cols-2">{candidates.map((candidate) => {
    const news = newsById.get(candidate.news_id);
    const approved = candidate.status === "approved_for_lab";
    return <article key={candidate.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{candidateLabels[candidate.category]}</span><Score label="活用期待度" value={candidate.impact_score} /></div>
      <h2 className="mt-3 text-lg font-bold">{news?.title ?? "活用候補"}</h2>
      <div className="mt-4 space-y-3 text-sm leading-6">
        <div><p className="text-[10px] font-bold text-[var(--mikke-muted)]">使えそうな場所</p><p className="font-semibold">{candidate.use_places.length ? candidate.use_places.join(" / ") : "mikkeOS開発・制作"}</p></div>
        <div><p className="text-[10px] font-bold text-[var(--mikke-muted)]">できそうなこと</p><p>{candidate.possible_use}</p></div>
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-700">期待</p><p className="mt-1 text-emerald-950">{candidate.expected_benefit || "小規模テストで効果を確認します。"}</p></div>
        <div><p className="text-[10px] font-bold text-[var(--mikke-muted)]">最初のテスト</p><p>{candidate.test_idea || "既存方式と同じ条件で、小さな比較サンプルを作ります。"}</p></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--mikke-line-soft)] pt-4"><p className="text-xs text-[var(--mikke-muted)]">リスク {candidate.risk === "low" ? "低" : candidate.risk === "medium" ? "中" : "高"} ・ 工数 {candidate.effort === "small" ? "小" : candidate.effort === "medium" ? "中" : "大"}</p>{approved ? <Link href="/hq/ai-tech/lab" className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">LABを見る <ArrowRight size={14} /></Link> : <button type="button" disabled={saving === candidate.id} onClick={() => void onApprove(candidate)} className="inline-flex items-center gap-1 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving === candidate.id ? <Loader2 className="animate-spin" size={14} /> : <FlaskConical size={14} />}LABで試す</button>}</div>
    </article>;
  })}</div>;
}

function LabView({ data, candidateById, saving, onDecide }: { data: AiTechLabData; candidateById: Map<string, AiTechCandidate>; saving: string; onDecide: (experiment: AiTechExperiment, decision: "adopt" | "hold" | "reject") => Promise<void> }) {
  if (!data.experiments.length) return <EmptyState title="承認されたテストはまだありません" body="「mikkeOSで活用」から試したい技術を承認すると、ここへ安全な小規模テストとして追加されます。" />;
  return <div className="space-y-4">{data.experiments.map((experiment) => {
    const candidate = candidateById.get(experiment.candidate_id);
    const canDecide = ["result_ready", "held"].includes(experiment.status);
    return <article key={experiment.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold tracking-[0.12em] text-indigo-700">EXPERIMENT #{String(experiment.experiment_number).padStart(3, "0")}</p><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{experimentLabels[experiment.status]}</span></div>
      <h2 className="mt-3 text-lg font-bold">{experiment.title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-[var(--mikke-surface-soft)] p-3"><p className="text-[10px] font-bold text-[var(--mikke-muted)]">目的</p><p className="mt-1 text-sm leading-6">{experiment.objective}</p></div><div className="rounded-xl bg-[var(--mikke-surface-soft)] p-3"><p className="text-[10px] font-bold text-[var(--mikke-muted)]">テスト</p><p className="mt-1 text-sm leading-6">{experiment.test_plan}</p></div></div>
      <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldCheck className="mt-0.5 shrink-0" size={15} />{experiment.safety_scope}</p>
      {experiment.result_summary ? <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">結果</p><p className="mt-2 text-sm leading-6 text-emerald-950">{experiment.result_summary}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">{[["品質", experiment.quality_result], ["スマホ", experiment.mobile_result], ["速度", experiment.speed_result], ["費用", experiment.cost_result], ["既存環境", experiment.environment_risk]].map(([label, value]) => <div key={label} className="rounded-lg bg-white p-2"><p className="font-bold text-[var(--mikke-muted)]">{label}</p><p className="mt-1 font-semibold">{value || "確認中"}</p></div>)}</div>{experiment.recommendation ? <p className="mt-3 text-sm font-bold text-emerald-900">結論：{experiment.recommendation}</p> : null}</section> : <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-sm text-[var(--mikke-muted)]">結果報告を準備中です。報告が揃うまで採用判断は表示しません。</p>}
      {canDecide ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={saving === experiment.id} onClick={() => void onDecide(experiment, "adopt")} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white"><Check size={14} />採用する</button><button type="button" disabled={saving === experiment.id} onClick={() => void onDecide(experiment, "hold")} className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900"><Pause size={14} />保留</button><button type="button" disabled={saving === experiment.id} onClick={() => void onDecide(experiment, "reject")} className="inline-flex items-center gap-1 rounded-xl border border-[var(--mikke-line)] px-4 py-2.5 text-xs font-bold"><X size={14} />不採用</button></div> : null}
      {candidate ? <p className="mt-3 text-[10px] text-[var(--mikke-muted)]">評価時の活用期待度 {candidate.impact_score}/5</p> : null}
    </article>;
  })}</div>;
}

function AdoptedView({ data }: { data: AiTechLabData }) {
  if (!data.adoptions.length) return <EmptyState title="採用ノウハウはこれから蓄積されます" body="LABの結果をあなたが「採用する」と判断したものだけが、Skill・ルール・テンプレート候補としてここへ残ります。" />;
  return <div className="grid gap-4 lg:grid-cols-2">{data.adoptions.map((adoption) => <article key={adoption.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5"><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase text-emerald-700">{adoption.area}</span><span className="text-xs font-bold text-[var(--mikke-muted)]">{adoption.integration_status === "integrated" ? "Codexへ反映済み" : adoption.integration_status === "documented" ? "手順化済み" : "反映待ち"}</span></div><h2 className="mt-3 text-lg font-bold">{adoption.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{adoption.summary}</p><div className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-3"><p className="text-[10px] font-bold text-[var(--mikke-muted)]">蓄積先</p><p className="mt-1 text-sm font-semibold">{adoption.codex_target_kind === "pending" ? "最適なSkill・ルール・テンプレートを選定中" : adoption.codex_target_kind.toUpperCase()}</p></div></article>)}</div>;
}
