"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock3, Sparkles } from "lucide-react";
import { OrderPublicShell } from "@/components/order/OrderPublicShell";
import { formatYen } from "@/lib/format";
import { useOrderMenus } from "@/lib/order/store";

export default function OrderMenuDetailPage() {
  const params = useParams<{ id: string }>();
  const { menus } = useOrderMenus();
  const menu = menus.find((item) => item.id === params.id);

  if (!menu) {
    return (
      <OrderPublicShell title="Order" backHref="/order">
        <p className="text-sm text-[var(--mikke-muted)]">このメニューは見つかりませんでした。</p>
      </OrderPublicShell>
    );
  }

  return (
    <OrderPublicShell title="Order" backHref="/order">
      <h1 className="text-2xl font-bold tracking-normal text-[var(--mikke-text)]">{menu.title}</h1>
      {menu.summary ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{menu.summary}</p> : null}

      <div className="mt-4 space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--mikke-text)]">
          料金：{menu.priceLabel}
          {menu.price != null ? `（${formatYen(menu.price)}）` : ""}
        </p>
        {menu.leadTimeLabel ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--mikke-text)]">
            <Clock3 size={16} className="shrink-0 text-[var(--mikke-muted)]" />
            納期の目安：{menu.leadTimeLabel}
          </p>
        ) : null}
        {menu.recommendedFor ? (
          <p className="flex items-start gap-2 text-sm font-semibold text-[var(--mikke-text)]">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-[var(--mikke-muted)]" />
            こんな方におすすめ：{menu.recommendedFor}
          </p>
        ) : null}
      </div>

      {menu.description ? (
        <div className="mt-4">
          <h2 className="text-sm font-bold text-[var(--mikke-text)]">詳細</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)]">{menu.description}</p>
        </div>
      ) : null}

      <Link
        href={`/order/${menu.id}/apply`}
        className="mt-6 block rounded-full bg-[var(--mikke-accent)] px-4 py-3 text-center text-sm font-bold text-white shadow-sm"
      >
        このメニューをご依頼・ご相談する
      </Link>
    </OrderPublicShell>
  );
}
