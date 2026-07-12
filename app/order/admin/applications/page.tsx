"use client";

import { useState } from "react";
import { ChevronDown, Mail } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { useOrderMenus } from "@/lib/order/store";
import { orderApplicationStatusLabels, type OrderApplicationStatus } from "@/lib/order/types";

const statusOrder: OrderApplicationStatus[] = ["new", "in_progress", "delivered", "declined"];
const statusTone: Record<OrderApplicationStatus, "success" | "primary" | "muted"> = {
  new: "primary",
  in_progress: "primary",
  delivered: "success",
  declined: "muted"
};

function OrderAdminApplicationsContent() {
  const { menus, applications, updateApplicationStatus, updateApplication } = useOrderMenus();
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const menuTitle = (menuId: string) => menus.find((menu) => menu.id === menuId)?.title ?? "（削除されたメニュー）";

  return (
    <MikkeAppShell appName="Order" title="申込一覧" currentApp={{ label: "Order", href: "/apps/order" }} footerLabel="Order by mikke">
      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((application) => {
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
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{menuTitle(application.menuId)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <MikkeStatusBadge tone={statusTone[application.status]} className="px-2 py-0.5 text-[10px]">
                      {orderApplicationStatusLabels[application.status]}
                    </MikkeStatusBadge>
                    <ChevronDown size={16} className={`text-[var(--mikke-muted)] ${open ? "rotate-180" : ""} transition-transform`} />
                  </span>
                </button>

                {open ? (
                  <div className="mt-3 space-y-3 border-t border-[var(--mikke-line-soft)] pt-3">
                    <p className="flex items-center gap-1 text-xs font-semibold text-[var(--mikke-text-soft)]">
                      <Mail size={13} />
                      {application.contactEmail}
                    </p>
                    {application.contactNote ? <p className="text-xs font-semibold text-[var(--mikke-text-soft)]">連絡方法：{application.contactNote}</p> : null}
                    {application.desiredDueDate ? <p className="text-xs font-semibold text-[var(--mikke-text-soft)]">希望納期：{application.desiredDueDate}</p> : null}
                    {application.requestDetail ? (
                      <p className="whitespace-pre-wrap text-xs leading-6 text-[var(--mikke-text-soft)]">{application.requestDetail}</p>
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
                            {orderApplicationStatusLabels[status]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-xs font-bold text-[var(--mikke-text)]">管理者メモ（非公開）</span>
                      <textarea
                        defaultValue={application.organizerMemo}
                        onBlur={(e) => updateApplication(application.id, { organizerMemo: e.target.value })}
                        rows={2}
                        className="mt-1.5 w-full resize-none rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs outline-none focus:border-[var(--mikke-accent)]"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-[var(--mikke-text)]">納品メモ</span>
                      <textarea
                        defaultValue={application.deliveryNote}
                        onBlur={(e) => updateApplication(application.id, { deliveryNote: e.target.value })}
                        rows={2}
                        placeholder="納品物の場所や連絡内容など"
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
        <MikkeEmptyState title="申込はまだありません" helper="公開ページから申込があると、ここに表示されます。" />
      )}
    </MikkeAppShell>
  );
}

export default function OrderAdminApplicationsPage() {
  return (
    <AuthGate>
      <OrderAdminApplicationsContent />
    </AuthGate>
  );
}
