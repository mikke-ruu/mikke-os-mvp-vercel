"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, Mail, Phone } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { useMikkeEvents } from "@/lib/event/store";
import { applicationStatusLabels, paymentStatusLabels, type ApplicationStatus } from "@/lib/event/types";

const statusOrder: ApplicationStatus[] = ["submitted", "reviewing", "confirmed", "declined", "cancelled"];
const statusTone: Record<ApplicationStatus, "success" | "primary" | "muted"> = {
  submitted: "muted",
  reviewing: "primary",
  confirmed: "success",
  declined: "muted",
  cancelled: "muted"
};

function EventAdminApplicationsContent() {
  const params = useParams<{ id: string }>();
  const { events, applications, updateApplicationStatus, updateApplication } = useMikkeEvents();
  const event = events.find((item) => item.id === params.id);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!event) {
    return (
      <MikkeAppShell appName="Event" title="Event" currentApp={{ label: "Event", href: "/apps/event" }} footerLabel="Event by mikke">
        <p className="text-sm text-[var(--mikke-muted)]">このイベントは見つかりませんでした。</p>
      </MikkeAppShell>
    );
  }

  const eventApplications = applications
    .filter((application) => application.eventId === event.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <MikkeAppShell appName="Event" title="申込一覧" subtitle={event.title} currentApp={{ label: "Event", href: "/apps/event" }} footerLabel="Event by mikke">
      {eventApplications.length > 0 ? (
        <div className="space-y-2">
          {eventApplications.map((application) => {
            const open = openId === application.id;
            return (
              <div key={application.id} className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : application.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[var(--mikke-text)]">{application.applicantName}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{application.contactEmail}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <MikkeStatusBadge tone={statusTone[application.status]} className="px-2 py-0.5 text-[10px]">
                      {applicationStatusLabels[application.status]}
                    </MikkeStatusBadge>
                    <ChevronDown size={16} className={`text-[var(--mikke-muted)] ${open ? "rotate-180" : ""} transition-transform`} />
                  </span>
                </button>

                {open ? (
                  <div className="mt-3 space-y-3 border-t border-[var(--mikke-line-soft)] pt-3">
                    <div className="flex flex-wrap gap-3 text-xs font-semibold text-[var(--mikke-text-soft)]">
                      <span className="flex items-center gap-1"><Mail size={13} />{application.contactEmail}</span>
                      {application.phone ? <span className="flex items-center gap-1"><Phone size={13} />{application.phone}</span> : null}
                    </div>
                    {application.genre ? <p className="text-xs font-semibold text-[var(--mikke-text-soft)]">ジャンル：{application.genre}</p> : null}
                    {application.instagram ? <p className="text-xs font-semibold text-[var(--mikke-text-soft)]">Instagram：{application.instagram}</p> : null}
                    {application.websiteUrl ? <p className="text-xs font-semibold text-[var(--mikke-text-soft)]">URL：{application.websiteUrl}</p> : null}
                    {application.applicationNote ? (
                      <p className="whitespace-pre-wrap text-xs leading-6 text-[var(--mikke-text-soft)]">{application.applicationNote}</p>
                    ) : null}
                    {application.feeAmount ? (
                      <p className="text-xs font-semibold text-[var(--mikke-text-soft)]">
                        参加費：{application.feeAmount}円（{paymentStatusLabels[application.paymentStatus]}）
                      </p>
                    ) : null}

                    <div>
                      <p className="mb-1.5 text-xs font-bold text-[var(--mikke-text)]">ステータス</p>
                      <div className="flex flex-wrap gap-1.5">
                        {statusOrder.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateApplicationStatus(application.id, status)}
                            className={`rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${
                              application.status === status
                                ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                                : "border-[var(--mikke-line)] bg-[var(--mikke-surface)] text-[var(--mikke-muted)]"
                            }`}
                          >
                            {applicationStatusLabels[status]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-xs font-bold text-[var(--mikke-text)]">主催者メモ（非公開）</span>
                      <textarea
                        defaultValue={application.organizerMemo}
                        onBlur={(e) => updateApplication(application.id, { organizerMemo: e.target.value })}
                        rows={2}
                        className="mt-1.5 w-full resize-none rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs outline-none focus:border-[var(--mikke-accent)]"
                      />
                    </label>

                    {application.status === "confirmed" ? (
                      <label className="block">
                        <span className="text-xs font-bold text-[var(--mikke-text)]">確定後メモ（申込者への案内内容）</span>
                        <textarea
                          defaultValue={application.confirmedMemo}
                          onBlur={(e) => updateApplication(application.id, { confirmedMemo: e.target.value })}
                          rows={2}
                          placeholder="集合時間、持ち物、支払い方法など"
                          className="mt-1.5 w-full resize-none rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs outline-none focus:border-[var(--mikke-accent)]"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <MikkeEmptyState title="申込はまだありません" helper="公開ページから申込があると、ここに表示されます。" />
      )}
    </MikkeAppShell>
  );
}

export default function EventAdminApplicationsPage() {
  return (
    <AuthGate>
      <EventAdminApplicationsContent />
    </AuthGate>
  );
}
