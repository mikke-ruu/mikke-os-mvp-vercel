"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BellRing, BookOpen, CalendarDays, ClipboardList, RefreshCw, Users } from "lucide-react";
import { HqDashboardCharts } from "@/components/hq/HqDashboardCharts";
import { getHqSummary, getHqTimeseries, type HqSummary, type HqTimeseriesPoint } from "@/lib/hq";

function StatCard({ label, value, note, icon: Icon }: { label: string; value: number; note: string; icon: typeof Users }) {
  return (
    <article className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[var(--mikke-primary)]">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--mikke-primary-soft)]"><Icon size={18} /></span>
        <p className="text-xs font-bold text-[var(--mikke-muted)]">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold text-[var(--mikke-text)]">{value.toLocaleString()}<span className="ml-1 text-xs text-[var(--mikke-muted)]">人</span></p>
      <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{note}</p>
    </article>
  );
}

export default function HqDashboardPage() {
  const [summary, setSummary] = useState<HqSummary | null>(null);
  const [timeseries, setTimeseries] = useState<HqTimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextSummary, nextTimeseries] = await Promise.all([getHqSummary(), getHqTimeseries()]);
      setSummary(nextSummary);
      setTimeseries(nextTimeseries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "集計を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">本部データを読み込んでいます…</p>;

  if (!summary) {
    return (
      <section className="mx-auto max-w-lg rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
        <AlertTriangle className="mx-auto text-[var(--mikke-accent)]" />
        <h1 className="mt-3 text-lg font-bold">集計を読み込めませんでした</h1>
        <p className="mt-2 text-sm text-[var(--mikke-muted)]">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white">
          <RefreshCw size={16} /> もう一度読み込む
        </button>
      </section>
    );
  }

  const tasks = [
    summary.inquiries_urgent > 0 ? { label: `至急のお問い合わせが${summary.inquiries_urgent}件あります`, href: "/hq/inquiries", tone: "urgent" } : null,
    summary.inquiries_open > 0 ? { label: `未完了のお問い合わせが${summary.inquiries_open}件あります`, href: "/hq/inquiries", tone: "normal" } : null,
    summary.announcement_drafts > 0 ? { label: `公開前のお知らせが${summary.announcement_drafts}件あります`, href: "/hq/announcements", tone: "normal" } : null,
    summary.updates_drafts > 0 ? { label: `公開前のアップデートが${summary.updates_drafts}件あります`, href: "/hq/updates", tone: "normal" } : null
  ].filter(Boolean) as { label: string; href: string; tone: string }[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-bold tracking-[0.15em] text-[var(--mikke-primary)]">OVERVIEW</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--mikke-text)]">本部ホーム</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">登録状況と、今日対応したいことをまとめています。</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Mikke ID" value={summary.profiles_total} note={`直近30日の新規登録 ${summary.profiles_new_30d}人`} icon={Users} />
        <StatCard label="STORY" value={summary.story_users} note="STORYを作成した人" icon={BookOpen} />
        <StatCard label="Community" value={summary.community_active_users} note="参加中の会員" icon={Users} />
        <StatCard label="MarketNote" value={summary.marketnote_users} note="予定を記録したことがある人" icon={CalendarDays} />
        <StatCard label="30日以内に記録あり" value={summary.active_users_30d} note="アプリを開いた人数ではなく、記録を残した人数" icon={RefreshCw} />
        <StatCard label="未完了のお問い合わせ" value={summary.inquiries_open} note={`うち至急 ${summary.inquiries_urgent}件`} icon={ClipboardList} />
      </section>

      <HqDashboardCharts summary={summary} timeseries={timeseries} />

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"><BellRing size={18} /></span>
          <div>
            <h2 className="font-bold text-[var(--mikke-text)]">今日やること</h2>
            <p className="text-xs text-[var(--mikke-muted)]">対応が必要なものを先に表示します。</p>
          </div>
        </div>
        {tasks.length === 0 ? (
          <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-4 text-sm font-semibold text-[var(--mikke-muted)]">現在、対応待ちの項目はありません。</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {tasks.map((task) => (
              <li key={task.label}>
                <Link href={task.href} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${task.tone === "urgent" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--mikke-line)] text-[var(--mikke-text)]"}`}>
                  {task.label}<ArrowRight size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3 text-xs leading-5 text-[var(--mikke-muted)]">
        利用数は個人のアクティビティ内容を表示せず、人数だけを集計しています。画面閲覧数やQRから登録までの動線分析は、次の段階で専用の計測を追加します。
      </p>
    </div>
  );
}
