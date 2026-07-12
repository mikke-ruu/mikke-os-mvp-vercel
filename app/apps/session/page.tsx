"use client";

import Link from "next/link";
import { ExternalLink, ListChecks, Plus } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeListRow } from "@/components/mikkeos/MikkeListRow";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatYen } from "@/lib/format";
import { useSessionMenus } from "@/lib/session/store";

function SessionAdminDashboardContent() {
  const { menus, bookings } = useSessionMenus();
  const requestedCount = bookings.filter((booking) => booking.status === "requested").length;

  return (
    <MikkeAppShell appName="Session" title="Session" subtitle="予約メニューと予約の管理" footerLabel="Session by mikke">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/session"
          target="_blank"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
        >
          <ExternalLink size={14} />
          公開ページを見る
        </Link>
        <Link
          href="/session/admin/new"
          className="inline-flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white shadow-sm"
        >
          <Plus size={14} />
          メニューを作成
        </Link>
      </div>

      <Link
        href="/session/admin/bookings"
        className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-[var(--mikke-text)]">
          <ListChecks size={18} className="text-[var(--mikke-muted)]" />
          予約一覧
        </span>
        {requestedCount > 0 ? (
          <MikkeStatusBadge tone="primary" className="px-2 py-0.5 text-[10px]">申込 {requestedCount}件</MikkeStatusBadge>
        ) : (
          <span className="text-xs font-semibold text-[var(--mikke-muted)]">{bookings.length}件</span>
        )}
      </Link>

      {menus.length > 0 ? (
        <div className="space-y-2">
          {menus.map((menu) => (
            <MikkeListRow
              key={menu.id}
              href={`/session/admin/${menu.id}`}
              title={menu.title}
              helper={`${menu.durationLabel}${menu.price != null ? ` / ${formatYen(menu.price)}` : ""}`}
              right={
                <MikkeStatusBadge tone={menu.published ? "primary" : "muted"} className="px-2 py-0.5 text-[10px]">
                  {menu.published ? "公開中" : "非公開"}
                </MikkeStatusBadge>
              }
            />
          ))}
        </div>
      ) : (
        <MikkeEmptyState title="メニューはまだありません" helper="「メニューを作成」から最初のメニューを作れます。" />
      )}
    </MikkeAppShell>
  );
}

export default function SessionAdminDashboardPage() {
  return (
    <AuthGate>
      <SessionAdminDashboardContent />
    </AuthGate>
  );
}
