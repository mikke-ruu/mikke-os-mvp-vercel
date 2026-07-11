import { getAppDefinition } from "@/lib/mikkeos/apps";
import { shouldCountTowardSummary } from "@/lib/mikkeos/activity-summary";
import type { UnifiedActivityLog } from "@/lib/mikkeos/types";
import { formatDate, formatYen } from "@/lib/format";

const text = {
  empty: "\u8868\u793a\u3067\u304d\u308bActivity Log\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
  income: "\u58f2\u4e0a",
  expense: "\u7d4c\u8cbb",
  public: "\u516c\u958b",
  private: "\u975e\u516c\u958b",
  storyOn: "Story\u306b\u516c\u958b",
  storyOff: "Story\u5bfe\u8c61\u5916",
  deskOn: "DESK\u306b\u96c6\u8a08",
  deskOff: "DESK\u5bfe\u8c61\u5916",
  summaryOn: "\u6d3b\u52d5\u5b9f\u7e3e\u306b\u542b\u3081\u308b",
  summaryOff: "\u6d3b\u52d5\u5b9f\u7e3e\u5bfe\u8c61\u5916"
};

export function ActivityLogList({ logs }: { logs: UnifiedActivityLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e8e1da] bg-white p-5 text-sm font-semibold text-[#79716b]">
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
          <article key={log.id} className="rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-xs font-bold text-[#d9643a]">{app.name}</span>
                  <span className="text-xs font-semibold text-[#79716b]">{formatDate(log.occurredAt)}</span>
                </div>
                <h2 className="mt-2 text-base font-bold tracking-normal text-[#25211f]">{log.title}</h2>
                {log.description ? <p className="mt-1 text-sm leading-6 text-[#5f5a55]">{log.description}</p> : null}
              </div>
              {typeof log.amount === "number" ? (
                <div className={`rounded-xl px-3 py-2 text-right ${log.amountType === "expense" ? "bg-[#f5f8fb] text-[#243447]" : "bg-[#f3fbf4] text-[#4f8a61]"}`}>
                  <p className="text-xs font-bold">{log.amountType === "expense" ? text.expense : text.income}</p>
                  <p className="font-bold">{formatYen(log.amount)}</p>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-[#e8e1da] px-2.5 py-1 text-[#5f5a55]">{log.metadata?.sourceLabel ?? log.eventType}</span>
              <StatusChip active={log.visibility === "public"} label={log.visibility === "public" ? text.public : text.private} activeClass="bg-[#eefaf1] text-[#4f8a61]" />
              <StatusChip active={log.storyEnabled} label={log.storyEnabled ? text.storyOn : text.storyOff} activeClass="bg-[#fff0e9] text-[#d9643a]" />
              <StatusChip active={log.deskEnabled} label={log.deskEnabled ? text.deskOn : text.deskOff} activeClass="bg-[#eef3f8] text-[#243447]" />
              <StatusChip active={countsTowardSummary} label={countsTowardSummary ? text.summaryOn : text.summaryOff} activeClass="bg-[#f8f1d8] text-[#826310]" />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StatusChip({ active, label, activeClass }: { active: boolean; label: string; activeClass: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 ${active ? activeClass : "bg-[#f3f0ed] text-[#6f6862]"}`}>
      {label}
    </span>
  );
}
