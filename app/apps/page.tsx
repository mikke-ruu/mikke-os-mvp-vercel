import { AppCard } from "@/components/mikkeos/AppCard";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MetricCard } from "@/components/mikkeos/MetricCard";
import { mikkeApps } from "@/lib/mikkeos/apps";

export default function AppsPage() {
  return (
    <MikkeAppShell
      appName="Apps"
      title="Apps"
      subtitle="各アプリが共通台帳へ送る内容を確認する入口"
      currentApp={{ label: "Apps", href: "/apps" }}
    >
      <section className="grid grid-cols-3 gap-3">
        <MetricCard label="見えるもの" value="一覧" helper="各アプリの役割" />
        <MetricCard label="次に追加予定" value="作品" helper="活動ログへ追加する操作" tone="green" />
        <MetricCard label="中心" value="台帳" helper="各アプリは入口" tone="navy" />
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold tracking-normal">今回の扱い</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--mikke-muted)]">
          ここでは各アプリを完成機能として作り込まず、どんな活動を共通台帳へ送るか、Storyで何が見えるか、
          DESKで何を集計するかを確認します。AcademyとCommunityは別アプリとして扱い、Roundは後続で検討します。
        </p>
      </section>

      <section className="mt-6 grid gap-3">
        {mikkeApps.map((app) => (
          <AppCard key={app.key} app={app} />
        ))}
      </section>
    </MikkeAppShell>
  );
}
