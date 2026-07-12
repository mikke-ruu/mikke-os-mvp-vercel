"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { StudioItemForm } from "@/components/item-studio/StudioItemForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatDate, formatYen } from "@/lib/format";
import { useItemStudio } from "@/lib/item-studio/store";
import { channelStatusLabels, type ChannelStatus } from "@/lib/item-studio/types";

const statusOrder: ChannelStatus[] = ["not_listed", "listed", "sold"];

function ItemStudioDetailContent() {
  const params = useParams<{ id: string }>();
  const { items, channels, sales, addChannel, updateChannelStatus, removeChannel, addSale } = useItemStudio();
  const item = items.find((entry) => entry.id === params.id);
  const [editing, setEditing] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [saleChannel, setSaleChannel] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState("");

  if (!item) {
    return (
      <MikkeAppShell appName="Item Studio" title="Item Studio" currentApp={{ label: "Item Studio", href: "/apps/item-studio" }} footerLabel="Item Studio by mikke">
        <p className="text-sm text-[var(--mikke-muted)]">この商品は見つかりませんでした。</p>
      </MikkeAppShell>
    );
  }

  const itemChannels = channels.filter((channel) => channel.itemId === item.id);
  const itemSales = sales.filter((sale) => sale.itemId === item.id).sort((a, b) => b.soldAt.localeCompare(a.soldAt));

  function submitChannel(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!newChannelName.trim() || !item) return;
    addChannel(item.id, newChannelName.trim());
    setNewChannelName("");
  }

  function submitSale(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!saleChannel.trim() || !salePrice || !item) return;
    addSale({
      itemId: item.id,
      channelName: saleChannel.trim(),
      soldPrice: Number(salePrice),
      soldAt: saleDate || new Date().toISOString().slice(0, 10),
      memo: ""
    });
    setSaleChannel("");
    setSalePrice("");
    setSaleDate("");
  }

  return (
    <MikkeAppShell appName="Item Studio" title={item.title} currentApp={{ label: "Item Studio", href: "/apps/item-studio" }} footerLabel="Item Studio by mikke">
      {editing ? (
        <div>
          <button type="button" onClick={() => setEditing(false)} className="mb-3 text-xs font-bold text-[var(--mikke-muted)]">
            ← 詳細に戻る
          </button>
          <StudioItemForm item={item} />
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <MikkeStatusBadge tone={item.published ? "primary" : "muted"}>
              {item.published ? "Story公開中" : "非公開"}
            </MikkeStatusBadge>
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold text-[var(--mikke-accent)]">
              編集する
            </button>
          </div>

          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={item.title} className="mt-4 aspect-square w-full rounded-2xl object-cover" />
          ) : null}

          <div className="mt-4 space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 text-sm text-[var(--mikke-text-soft)]">
            <p className="font-bold text-[var(--mikke-text)]">#{item.sku}</p>
            {item.category ? <p>カテゴリ：{item.category}</p> : null}
            {item.color ? <p>カラー：{item.color}</p> : null}
            {item.material ? <p>素材：{item.material}</p> : null}
            {item.condition ? <p>状態：{item.condition}</p> : null}
            <p>販売価格：{item.price != null ? formatYen(item.price) : "未設定"}</p>
            {item.cost != null ? <p>原価：{formatYen(item.cost)}</p> : null}
            <p>在庫：{item.stock}</p>
          </div>

          {item.description ? <p className="mt-4 text-sm leading-6 text-[var(--mikke-text-soft)]">{item.description}</p> : null}

          <section className="mt-6">
            <h2 className="text-sm font-bold text-[var(--mikke-text)]">出品先</h2>
            <div className="mt-2 space-y-2">
              {itemChannels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--mikke-text)]">{channel.channelName}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {statusOrder.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateChannelStatus(channel.id, status)}
                        className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                          channel.status === status
                            ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                            : "border-[var(--mikke-line)] bg-[var(--mikke-surface)] text-[var(--mikke-muted)]"
                        }`}
                      >
                        {channelStatusLabels[status]}
                      </button>
                    ))}
                    <button type="button" onClick={() => removeChannel(channel.id)} aria-label="出品先を削除" className="text-[var(--mikke-muted-light)]">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={submitChannel} className="mt-2 flex gap-2">
              <input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="出品先名（例：BASE）"
                className="flex-1 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--mikke-accent)]"
              />
              <button type="submit" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-accent)] text-white" aria-label="出品先を追加">
                <Plus size={16} />
              </button>
            </form>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-bold text-[var(--mikke-text)]">販売記録</h2>
            <div className="mt-2 space-y-2">
              {itemSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3 text-xs font-semibold text-[var(--mikke-text-soft)]">
                  <span>{formatDate(sale.soldAt)} / {sale.channelName}</span>
                  <span className="font-bold text-[var(--mikke-success)]">{formatYen(sale.soldPrice)}</span>
                </div>
              ))}
            </div>
            <form onSubmit={submitSale} className="mt-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <input
                value={saleChannel}
                onChange={(e) => setSaleChannel(e.target.value)}
                placeholder="どこで"
                className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-2 py-2 text-xs outline-none focus:border-[var(--mikke-accent)]"
              />
              <input
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="金額"
                className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-2 py-2 text-xs outline-none focus:border-[var(--mikke-accent)]"
              />
              <input
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                type="date"
                className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-2 py-2 text-xs outline-none focus:border-[var(--mikke-accent)]"
              />
              <button type="submit" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--mikke-accent)] text-white" aria-label="販売を記録">
                <Plus size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
    </MikkeAppShell>
  );
}

export default function ItemStudioDetailPage() {
  return (
    <AuthGate>
      <ItemStudioDetailContent />
    </AuthGate>
  );
}
