"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { OrderPublicShell } from "@/components/order/OrderPublicShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { formatYen } from "@/lib/format";
import { useOrderMenus } from "@/lib/order/store";

export default function OrderMenuListPage() {
  const { menus } = useOrderMenus();
  const publicMenus = menus.filter((menu) => menu.published);

  return (
    <OrderPublicShell title="Order">
      <p className="text-sm leading-6 text-[var(--mikke-muted)]">
        ご依頼・ご相談を受け付けています。まずは気になるメニューをご覧ください。
      </p>

      {publicMenus.length > 0 ? (
        <div className="mt-4 space-y-3">
          {publicMenus.map((menu) => (
            <Link
              key={menu.id}
              href={`/order/${menu.id}`}
              className="block rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm"
            >
              <h2 className="text-lg font-bold tracking-normal text-[var(--mikke-text)]">{menu.title}</h2>
              {menu.summary ? <p className="mt-1 text-sm leading-6 text-[var(--mikke-text-soft)]">{menu.summary}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--mikke-muted)]">
                <span className="font-bold text-[var(--mikke-accent)]">
                  {menu.priceLabel}
                  {menu.price != null ? `：${formatYen(menu.price)}` : ""}
                </span>
                {menu.leadTimeLabel ? (
                  <span className="flex items-center gap-1">
                    <Clock3 size={13} />
                    {menu.leadTimeLabel}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <MikkeEmptyState title="受付中のメニューはまだありません" helper="メニューが公開されると、ここに表示されます。" />
        </div>
      )}
    </OrderPublicShell>
  );
}
