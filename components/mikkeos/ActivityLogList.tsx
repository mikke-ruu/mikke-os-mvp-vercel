import { getAppDefinition } from "@/lib/mikkeos/apps";
import { shouldCountTowardSummary } from "@/lib/mikkeos/activity-summary";
import type { UnifiedActivityLog } from "@/lib/mikkeos/types";
import { formatDate, formatYen } from "@/lib/format";

const text = {
  empty: "表示できるActivity Logがありません。",
  income: "売上",
  expense: "経費",
  public: "公開",
  private: "非公開",
  storyOn: "Storyに公開",
  storyOff: "Story対象外",
  deskOn: "DESKに集計",
  deskOff: "DESK対象外",
  summaryOn: "活動実績に含める",
  summaryOff: "活動実績対象外"
};

export function ActivityLogList({ logs }: { logs: UnifiedActivityLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5 text-sm font-semibold text-[var(--mikke-muted)]">
        {text.empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const app = getAppDefinition(log.appKey);
        const countsTowardSummary = shouldCountTowardSummary(log);
        return (
          <article key={log.id} className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--mikke-accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--mikke-accent)]">{app.name}</span>
                  <span className="text-xs font-semibold text-[var(--mikke-muted)]">{formatDate(log.occurredAt)}</span>
                </div>
                <h2 className="mt-2 text-base font-bold tracking-normal text-[var(--mikke-text)]">{log.title}</h2>
                {log.description ? <p className="mt-1 text-sm leading-6 text-[var(--mikke-text-soft)]">{log.description}</p> : null}
              </div>
              {typeof log.amount === "number" ? (
                <div className={`rounded-xl px-3 py-2 text-right ${log.amountType === "expense" ? "bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]" : "bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]"}`}>
                  <p className="text-xs font-bold">{log.amountType === "expense" ? text.expense : text.income}</p>
                  <p className="font-bold">{formatYen(log.amount)}</p>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-[var(--mikke-line)] px-2.5 py-1 text-[var(--mikke-text-soft)]">{log.metadata?.sourceLabel ?? log.eventType}</span>
              <StatusChip active={log.visibility === "public"} label={log.visibility === "public" ? text.public : text.private} activeClass="bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]" />
              <StatusChip active={log.storyEnabled} label={log.storyEnabled ? text.storyOn : text.storyOff} activeClass="bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]" />
              <StatusChip active={log.deskEnabled} label={log.deskEnabled ? text.deskOn : text.deskOff} activeClass="bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]" />
              <StatusChip active={countsTowardSummary} label={countsTowardSummary ? text.summaryOn : text.summaryOff} activeClass="bg-[var(--mikke-surface-soft)] text-[var(--mikke-text)]" />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StatusChip({ active, label, activeClass }: { active: boolean; label: string; activeClass: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 ${active ? activeClass : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-text-soft)]"}`}>
      {label}
    </span>
  );
}
