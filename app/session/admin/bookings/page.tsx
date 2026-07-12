"use client";

import { useState } from "react";
import { ChevronDown, Mail } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatMonthDayWeekday } from "@/lib/format";
import { useSessionMenus } from "@/lib/session/store";
import { sessionBookingStatusLabels, type SessionBookingStatus } from "@/lib/session/types";

const statusOrder: SessionBookingStatus[] = ["requested", "confirmed", "completed", "cancelled"];
const statusTone: Record<SessionBookingStatus, "success" | "primary" | "muted"> = {
  requested: "primary",
  confirmed: "primary",
  completed: "success",
  cancelled: "muted"
};

function SessionAdminBookingsContent() {
  const { menus, bookings, updateBookingStatus, updateBooking } = useSessionMenus();
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = [...bookings].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
  const menuTitle = (menuId: string) => menus.find((menu) => menu.id === menuId)?.title ?? "（削除されたメニュー）";

  return (
    <MikkeAppShell appName="Session" title="予約一覧" currentApp={{ label: "Session", href: "/apps/session" }} footerLabel="Session by mikke">
      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((booking) => {
            const open = openId === booking.id;
            return (
              <div key={booking.id} className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : booking.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[var(--mikke-text)]">
                      {formatMonthDayWeekday(booking.bookingDate)}{booking.bookingTime ? ` ${booking.bookingTime}` : ""}　{booking.applicantName}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{menuTitle(booking.menuId)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <MikkeStatusBadge tone={statusTone[booking.status]} className="px-2 py-0.5 text-[10px]">
                      {sessionBookingStatusLabels[booking.status]}
                    </MikkeStatusBadge>
                    <ChevronDown size={16} className={`text-[var(--mikke-muted)] ${open ? "rotate-180" : ""} transition-transform`} />
                  </span>
                </button>

                {open ? (
                  <div className="mt-3 space-y-3 border-t border-[var(--mikke-line-soft)] pt-3">
                    <p className="flex items-center gap-1 text-xs font-semibold text-[var(--mikke-text-soft)]">
                      <Mail size={13} />
                      {booking.contactEmail}
                    </p>
                    {booking.contactNote ? <p className="text-xs font-semibold text-[var(--mikke-text-soft)]">連絡方法：{booking.contactNote}</p> : null}
                    {booking.requestDetail ? (
                      <p className="whitespace-pre-wrap text-xs leading-6 text-[var(--mikke-text-soft)]">{booking.requestDetail}</p>
                    ) : null}

                    <div>
                      <p className="mb-1.5 text-xs font-bold text-[var(--mikke-text)]">ステータス</p>
                      <div className="flex flex-wrap gap-1.5">
                        {statusOrder.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateBookingStatus(booking.id, status)}
                            className={`rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${
                              booking.status === status
                                ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                                : "border-[var(--mikke-line)] bg-[var(--mikke-surface)] text-[var(--mikke-muted)]"
                            }`}
                          >
                            {sessionBookingStatusLabels[status]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-xs font-bold text-[var(--mikke-text)]">主催者メモ（非公開）</span>
                      <textarea
                        defaultValue={booking.organizerMemo}
                        onBlur={(e) => updateBooking(booking.id, { organizerMemo: e.target.value })}
                        rows={2}
                        className="mt-1.5 w-full resize-none rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs outline-none focus:border-[var(--mikke-accent)]"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <MikkeEmptyState title="予約はまだありません" helper="公開ページから予約があると、ここに表示されます。" />
      )}
    </MikkeAppShell>
  );
}

export default function SessionAdminBookingsPage() {
  return (
    <AuthGate>
      <SessionAdminBookingsContent />
    </AuthGate>
  );
}
