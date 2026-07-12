import { getAppFinancialRows, getDeskSummary } from "@/lib/mikkeos/selectors";
import type { UnifiedActivityLog } from "@/lib/mikkeos/types";
import { formatDate, formatYen } from "@/lib/format";
import { MetricCard } from "./MetricCard";

export function DeskSummary({ logs }: { logs: UnifiedActivityLog[] }) {
  const summary = getDeskSummary(logs);
  const appRows = getAppFinancialRows(logs).filter((row) => row.count > 0 || row.income > 0 || row.expense > 0);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="今月の売上" value={formatYen(summary.income)} helper="売上として集計された記録" />
        <MetricCard label="今月の経費" value={formatYen(summary.expense)} helper="経費として集計された記録" tone="navy" />
        <MetricCard label="利益" value={formatYen(summary.profit)} helper="売上から経費を引いた金額" tone="green" />
        <MetricCard label="未入金" value={formatYen(summary.unpaid)} helper="未入金の記録を表示" tone="gray" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-normal">アプリ別の流れ</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {appRows.map((row) => (
            <article key={row.app.key} className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[var(--mikke-accent)]">{row.app.name}</p>
                  <h3 className="mt-1 font-bold text-[var(--mikke-text)]">{row.app.role}</h3>
                </div>
                <p className="rounded-full bg-[var(--mikke-success-soft)] px-3 py-1 text-sm font-bold text-[var(--mikke-success)]">{formatYen(row.profit)}</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <MoneyCell label="売上" value={row.income} />
                <MoneyCell label="経費" value={row.expense} />
                <MoneyCell label="件数" value={row.count} plain />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-normal">最近のお金の記録</h2>
        <div className="space-y-3">
          {summary.rows.map((log) => (
            <article key={log.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--mikke-muted)]">{formatDate(log.occurredAt)} / {log.metadata?.deskGroup ?? "DESK"}</p>
                <h3 className="mt-1 truncate font-bold">{log.title}</h3>
              </div>
              <p className={`shrink-0 font-bold ${log.amountType === "expense" ? "text-[var(--mikke-primary)]" : "text-[var(--mikke-success)]"}`}>
                {log.amountType === "expense" ? "-" : "+"}{formatYen(log.amount)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MoneyCell({ label, value, plain = false }: { label: string; value: number; plain?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-2">
      <p className="text-xs font-bold text-[var(--mikke-muted)]">{label}</p>
      <p className="mt-1 font-bold text-[var(--mikke-text)]">{plain ? `${value}件` : formatYen(value)}</p>
    </div>
  );
}
