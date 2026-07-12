"use client";

import Link from "next/link";
import { CalendarDays, ExternalLink, Plus, Users } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeListRow } from "@/components/mikkeos/MikkeListRow";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatMonthDayWeekday } from "@/lib/format";
import { useMikkeEvents } from "@/lib/event/store";
import { eventStatusLabels } from "@/lib/event/types";

function EventAdminDashboardContent() {
  const { events, applications } = useMikkeEvents();
  const sorted = [...events].sort((a, b) => b.eventDate.localeCompare(a.eventDate));

  return (
    <MikkeAppShell appName="Event" title="Event" subtitle="イベント作成と申込管理" footerLabel="Event by mikke">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/event"
          target="_blank"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
        >
          <ExternalLink size={14} />
          公開ページを見る
        </Link>
        <Link
          href="/event/admin/new"
          className="inline-flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white shadow-sm"
        >
          <Plus size={14} />
          イベントを作成
        </Link>
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((event) => {
            const eventApplications = applications.filter((application) => application.eventId === event.id);
            return (
              <MikkeListRow
                key={event.id}
                href={`/event/admin/${event.id}`}
                icon={CalendarDays}
                title={event.title}
                label={formatMonthDayWeekday(event.eventDate)}
                helper={event.venueName || "会場未設定"}
                right={
                  <div className="flex shrink-0 items-center gap-2">
                    {eventApplications.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--mikke-muted)]">
                        <Users size={13} />
                        {eventApplications.length}
                      </span>
                    ) : null}
                    <MikkeStatusBadge tone={event.status === "published" ? "primary" : "muted"} className="px-2 py-0.5 text-[10px]">
                      {eventStatusLabels[event.status]}
                    </MikkeStatusBadge>
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <MikkeEmptyState title="イベントはまだありません" helper="「イベントを作成」から最初のイベントを作れます。" />
      )}
    </MikkeAppShell>
  );
}

export default function EventAdminDashboardPage() {
  return (
    <AuthGate>
      <EventAdminDashboardContent />
    </AuthGate>
  );
}
