"use client";

import Link from "next/link";
import { ArrowRight, AppWindow, Database, Eye, WalletCards } from "lucide-react";
import { ActivityLogList } from "@/components/mikkeos/ActivityLogList";
import { AppCard } from "@/components/mikkeos/AppCard";
import { MetricCard } from "@/components/mikkeos/MetricCard";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { SupabaseOsSummaryTest } from "@/components/mikkeos/SupabaseOsSummaryTest";
import { formatYen } from "@/lib/format";
import { mikkeApps } from "@/lib/mikkeos/apps";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";
import { mockProfile } from "@/lib/mikkeos/mock-data";
import { getOsSummary, sortLogs } from "@/lib/mikkeos/selectors";

export default function OsPage() {
  const { logs } = useUnifiedActivityLogs();
  const summary = getOsSummary(logs);
  const recentLogs = sortLogs(logs).slice(0, 3);

  return (
    <MikkeAppShell
      appName="OS"
      title="OS Home"
      subtitle="Mikke IDとActivity Logを中心に、活動全体を見渡す入口です。"
      currentApp={{ label: "OS", href: "/os" }}
      footerLabel="OS by mikke"
    >
      <section className="mb-5 grid grid-cols-2 gap-3">
        <MetricCard label="今月の活動数" value={`${summary.totalLogs}件`} helper="各アプリの活動記録" />
        <MetricCard label="今月の売上" value={formatYen(summary.income)} helper="売上として集計された記録" tone="orange" />
        <MetricCard label="Story公開中" value={`${summary.storyLogs}件`} helper="Storyに公開中の活動" tone="green" />
        <MetricCard label="接続アプリ数" value={`${summary.activeApps}個`} helper="Activity Logにつながる入口" tone="navy" />
      </section>

      <section className="rounded-3xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mikke-accent)]">Mikke ID</p>
        <h2 className="mt-2 text-3xl font-bold tracking-normal">{mockProfile.displayName}</h2>
        <p className="mt-1 text-sm font-semibold text-[var(--mikke-muted)]">@{mockProfile.handle} / {mockProfile.brandName}</p>
        <p className="mt-4 text-sm leading-7 text-[var(--mikke-text)]">{mockProfile.bio}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <FlowCard icon={<Database size={20} />} title="Activity Log" body="すべての活動を共通台帳へ集めます。" href="/log" />
          <FlowCard icon={<Eye size={20} />} title="Story" body="公開できる活動をプロフィールへつなぎます。" href="/story" />
          <FlowCard icon={<WalletCards size={20} />} title="DESK" body="売上・経費・利益を軽く把握します。" href="/desk" />
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[var(--mikke-accent-soft)] p-3 text-[var(--mikke-accent)]">
              <AppWindow size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-normal">アプリはActivity Logへの入口</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">
                Story、DESK、MarketNote、Team Works、Academyなどの活動が、同じ台帳に集まります。
              </p>
            </div>
          </div>
          <Link href="/apps" className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white shadow-sm">
            Appsを見る <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-normal">最近のActivity Log 3件</h2>
            <p className="mt-1 text-sm text-[var(--mikke-muted)]">同じ活動記録が、公開ページと数字管理へ分かれて流れます。</p>
          </div>
          <Link href="/log" className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-sm font-bold text-[var(--mikke-accent)]">
            すべて見る <ArrowRight size={16} />
          </Link>
        </div>
        <ActivityLogList logs={recentLogs} />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-normal">接続するアプリ</h2>
            <p className="mt-1 text-sm text-[var(--mikke-muted)]">入口と役割を確認できます。作成操作は順に追加します。</p>
          </div>
          <Link href="/apps" className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-sm font-bold text-[var(--mikke-accent)]">
            Appsへ <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {mikkeApps.slice(0, 4).map((app) => (
            <AppCard key={app.key} app={app} />
          ))}
        </div>
      </section>

      <SupabaseOsSummaryTest />
    </MikkeAppShell>
  );
}

function FlowCard({ icon, title, body, href }: { icon: React.ReactNode; title: string; body: string; href: string }) {
  return (
    <Link href={href} className="block rounded-2xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-4 transition hover:border-[var(--mikke-primary-border)] hover:bg-[var(--mikke-accent-soft)]">
      <div className="text-[var(--mikke-accent)]">{icon}</div>
      <h3 className="mt-3 font-bold tracking-normal">{title}</h3>
      <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">{body}</p>
    </Link>
  );
}
