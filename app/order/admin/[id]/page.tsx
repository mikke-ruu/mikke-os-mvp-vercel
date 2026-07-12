"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipboardList, ExternalLink } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { OrderMenuForm } from "@/components/order/OrderMenuForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatYen } from "@/lib/format";
import { useOrderMenus } from "@/lib/order/store";

function OrderAdminMenuDetailContent() {
  const params = useParams<{ id: string }>();
  const { menus, applications } = useOrderMenus();
  const menu = menus.find((item) => item.id === params.id);
  const [editing, setEditing] = useState(false);

  if (!menu) {
    return (
      <MikkeAppShell appName="Order" title="Order" currentApp={{ label: "Order", href: "/apps/order" }} footerLabel="Order by mikke">
        <p className="text-sm text-[var(--mikke-muted)]">このメニューは見つかりませんでした。</p>
      </MikkeAppShell>
    );
  }

  const menuApplications = applications.filter((application) => application.menuId === menu.id);

  return (
    <MikkeAppShell appName="Order" title={menu.title} currentApp={{ label: "Order", href: "/apps/order" }} footerLabel="Order by mikke">
      {editing ? (
        <div>
          <button type="button" onClick={() => setEditing(false)} className="mb-3 text-xs font-bold text-[var(--mikke-muted)]">
            ← 詳細に戻る
          </button>
          <OrderMenuForm menu={menu} />
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <MikkeStatusBadge tone={menu.published ? "primary" : "muted"}>{menu.published ? "公開中" : "非公開"}</MikkeStatusBadge>
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold text-[var(--mikke-accent)]">
              編集する
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/order/${menu.id}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
            >
              <ExternalLink size={14} />
              公開ページを見る
            </Link>
            <Link
              href="/order/admin/applications"
              className="inline-flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white shadow-sm"
            >
              <ClipboardList size={14} />
              このメニューの申込（{menuApplications.length}）
            </Link>
          </div>

          <div className="mt-5 space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 text-sm text-[var(--mikke-text-soft)]">
            <p>料金：{menu.priceLabel}{menu.price != null ? `（${formatYen(menu.price)}）` : ""}</p>
            {menu.leadTimeLabel ? <p>納期の目安：{menu.leadTimeLabel}</p> : null}
            {menu.recommendedFor ? <p>おすすめ対象：{menu.recommendedFor}</p> : null}
          </div>

          {menu.summary ? <p className="mt-4 text-sm leading-6 text-[var(--mikke-text-soft)]">{menu.summary}</p> : null}
        </div>
      )}
    </MikkeAppShell>
  );
}

export default function OrderAdminMenuDetailPage() {
  return (
    <AuthGate>
      <OrderAdminMenuDetailContent />
    </AuthGate>
  );
}
