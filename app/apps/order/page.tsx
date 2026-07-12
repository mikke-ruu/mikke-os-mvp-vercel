"use client";

import Link from "next/link";
import { ClipboardList, ExternalLink, Plus } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeListRow } from "@/components/mikkeos/MikkeListRow";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatYen } from "@/lib/format";
import { useOrderMenus } from "@/lib/order/store";

function OrderAdminDashboardContent() {
  const { menus, applications } = useOrderMenus();
  const newCount = applications.filter((application) => application.status === "new").length;

  return (
    <MikkeAppShell appName="Order" title="Order" subtitle="受付メニューと申込の管理" footerLabel="Order by mikke">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/order"
          target="_blank"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
        >
          <ExternalLink size={14} />
          公開ページを見る
        </Link>
        <Link
          href="/order/admin/new"
          className="inline-flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white shadow-sm"
        >
          <Plus size={14} />
          メニューを作成
        </Link>
      </div>

      <Link
        href="/order/admin/applications"
        className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-[var(--mikke-text)]">
          <ClipboardList size={18} className="text-[var(--mikke-muted)]" />
          申込一覧
        </span>
        {newCount > 0 ? (
          <MikkeStatusBadge tone="primary" className="px-2 py-0.5 text-[10px]">新規 {newCount}件</MikkeStatusBadge>
        ) : (
          <span className="text-xs font-semibold text-[var(--mikke-muted)]">{applications.length}件</span>
        )}
      </Link>

      {menus.length > 0 ? (
        <div className="space-y-2">
          {menus.map((menu) => (
            <MikkeListRow
              key={menu.id}
              href={`/order/admin/${menu.id}`}
              title={menu.title}
              helper={menu.priceLabel + (menu.price != null ? `：${formatYen(menu.price)}` : "")}
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

export default function OrderAdminDashboardPage() {
  return (
    <AuthGate>
      <OrderAdminDashboardContent />
    </AuthGate>
  );
}
