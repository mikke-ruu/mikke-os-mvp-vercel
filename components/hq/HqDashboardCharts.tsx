"use client";

import type { HqSummary, HqTimeseriesPoint } from "@/lib/hq";

function AppUsageBars({ summary }: { summary: HqSummary }) {
  const base = Math.max(summary.profiles_total, 1);
  const apps = [
    { label: "STORY", value: summary.story_users, color: "#4956c8", note: "STORYを作成" },
    { label: "MarketNote", value: summary.marketnote_users, color: "#ff6648", note: "予定を記録" },
    { label: "Community", value: summary.community_active_users, color: "#e3a72f", note: "現在参加中" }
  ];

  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
      <p className="text-xs font-bold tracking-[0.12em] text-[var(--mikke-primary)]">アプリ別</p>
      <h2 className="mt-1 text-lg font-bold text-[var(--mikke-text)]">どのアプリが使われている？</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">Mikke ID登録者を100%とした利用の目安です。1人が複数のアプリを使うことがあります。</p>

      <div className="mt-5 space-y-4">
        {apps.map((app) => {
          const ratio = Math.min(100, Math.round((app.value / base) * 100));
          return (
            <div key={app.label}>
              <div className="mb-1.5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--mikke-text)]">{app.label}</p>
                  <p className="text-[11px] text-[var(--mikke-muted)]">{app.note}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-[var(--mikke-text)]">{app.value.toLocaleString()}人 <span className="text-xs text-[var(--mikke-muted)]">({ratio}%)</span></p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[var(--mikke-surface-soft)]" role="img" aria-label={`${app.label} ${app.value}人、${ratio}%`}>
                <div className="h-full rounded-full transition-[width]" style={{ width: `${ratio}%`, backgroundColor: app.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrendLines({ points }: { points: HqTimeseriesPoint[] }) {
  const width = 600;
  const height = 180;
  const insetX = 18;
  const insetY = 16;
  const plotWidth = width - insetX * 2;
  const plotHeight = height - insetY * 2;
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.active_users, point.new_profiles]));
  const x = (index: number) => insetX + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => insetY + plotHeight - (value / maxValue) * plotHeight;
  const activeLine = points.map((point, index) => `${x(index)},${y(point.active_users)}`).join(" ");
  const signupLine = points.map((point, index) => `${x(index)},${y(point.new_profiles)}`).join(" ");
  const activeTotal = points.reduce((total, point) => total + point.activity_records, 0);
  const signupTotal = points.reduce((total, point) => total + point.new_profiles, 0);
  const firstDay = points[0]?.day;
  const lastDay = points.at(-1)?.day;
  const formatDay = (day?: string) => day ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(`${day}T00:00:00`)) : "-";

  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
      <p className="text-xs font-bold tracking-[0.12em] text-[var(--mikke-primary)]">直近30日</p>
      <h2 className="mt-1 text-lg font-bold text-[var(--mikke-text)]">毎日の動き</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">個人名や活動内容は表示せず、日ごとの人数だけを集計しています。</p>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 text-[var(--mikke-text)]"><i className="h-2.5 w-2.5 rounded-full bg-[#4956c8]" />記録した人数</span>
        <span className="inline-flex items-center gap-1.5 text-[var(--mikke-text)]"><i className="h-2.5 w-2.5 rounded-full bg-[#ff6648]" />新規Mikke ID</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl bg-[var(--mikke-surface-soft)] p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="直近30日の記録人数と新規Mikke IDの推移">
          {[0, 0.5, 1].map((ratio) => (
            <line key={ratio} x1={insetX} x2={width - insetX} y1={insetY + plotHeight * ratio} y2={insetY + plotHeight * ratio} stroke="#dfe3eb" strokeWidth="1" />
          ))}
          <polyline points={activeLine} fill="none" stroke="#4956c8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={signupLine} fill="none" stroke="#ff6648" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="flex justify-between px-1 text-[10px] font-semibold text-[var(--mikke-muted)]">
          <span>{formatDay(firstDay)}</span><span>{formatDay(lastDay)}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--mikke-line)] px-3 py-3">
          <p className="text-[11px] text-[var(--mikke-muted)]">30日間の記録</p>
          <p className="mt-1 text-xl font-bold text-[var(--mikke-text)]">{activeTotal.toLocaleString()}件</p>
        </div>
        <div className="rounded-xl border border-[var(--mikke-line)] px-3 py-3">
          <p className="text-[11px] text-[var(--mikke-muted)]">30日間の新規登録</p>
          <p className="mt-1 text-xl font-bold text-[var(--mikke-text)]">{signupTotal.toLocaleString()}人</p>
        </div>
      </div>
    </section>
  );
}

export function HqDashboardCharts({ summary, timeseries }: { summary: HqSummary; timeseries: HqTimeseriesPoint[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AppUsageBars summary={summary} />
      <TrendLines points={timeseries} />
    </div>
  );
}
