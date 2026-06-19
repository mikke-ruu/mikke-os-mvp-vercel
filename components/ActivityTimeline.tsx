import type { ActivityLog } from "@/types/database";
import { formatDate } from "@/lib/format";

export function ActivityTimeline({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e8e1da] bg-white p-5 text-sm text-[#79716b]">
        まだ活動ログがありません。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <article key={log.id} className="rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#d9643a]" />
            <div>
              <p className="text-xs font-semibold text-[#79716b]">{formatDate(log.occurred_at)}</p>
              <h3 className="mt-1 font-bold text-[#25211f]">{log.title}</h3>
              {log.description ? <p className="mt-1 text-sm leading-6 text-[#79716b]">{log.description}</p> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
