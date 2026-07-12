"use client";

import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatYen } from "@/lib/format";
import { useItemStudio } from "@/lib/item-studio/store";

function ItemStudioDashboardContent() {
  const { items, channels } = useItemStudio();

  return (
    <MikkeAppShell appName="Item Studio" title="Item Studio" subtitle="作品・商品の台帳" footerLabel="Item Studio by mikke">
      <div className="mb-4 flex items-center justify-between gap-2">
        <a
          href="https://joesstylea-svg.github.io/item-studio/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
        >
          <ExternalLink size={14} />
          写真をきれいにする
        </a>
        <Link
          href="/item-studio/new"
          className="inline-flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white shadow-sm"
        >
          <Plus size={14} />
          商品を登録
        </Link>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => {
            const itemChannels = channels.filter((channel) => channel.itemId === item.id);
            const listedCount = itemChannels.filter((channel) => channel.status === "listed").length;
            return (
              <Link
                key={item.id}
                href={`/item-studio/${item.id}`}
                className="block overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] shadow-sm"
              >
                <div className="aspect-square bg-[var(--mikke-surface-soft)]">
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photoUrl} alt={item.title} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="text-[10px] font-bold text-[var(--mikke-muted-light)]">#{item.sku}</p>
                  <h3 className="mt-0.5 truncate text-sm font-bold text-[var(--mikke-text)]">{item.title}</h3>
                  <p className="mt-1 text-xs font-bold text-[var(--mikke-accent)]">
                    {item.price != null ? formatYen(item.price) : "価格未設定"}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-[var(--mikke-muted)]">
                    <span>在庫 {item.stock}</span>
                    {listedCount > 0 ? (
                      <MikkeStatusBadge tone="primary" className="px-1.5 py-0.5 text-[9px]">出品中 {listedCount}</MikkeStatusBadge>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <MikkeEmptyState title="商品はまだありません" helper="「商品を登録」から最初の商品を作れます。" />
      )}
    </MikkeAppShell>
  );
}

export default function ItemStudioDashboardPage() {
  return (
    <AuthGate>
      <ItemStudioDashboardContent />
    </AuthGate>
  );
}
