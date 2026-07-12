"use client";

import { useCallback, useEffect, useState } from "react";
import { Package } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listInstructors } from "@/lib/academy/instructors";
import { KIT_STATUS_LABELS, KIT_STATUS_ORDER, listKitOrders, updateKitOrder } from "@/lib/academy/kits";
import { formatDate } from "@/lib/format";
import type { AcademyHeadquarters, AcademyInstructor, AcademyKitOrder } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";

function KitsContent() {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [orders, setOrders] = useState<AcademyKitOrder[]>([]);
  const [instructorMap, setInstructorMap] = useState<Record<string, AcademyInstructor>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const foundHq = await getOwnedHeadquarters(profile.user_id);
    setHq(foundHq);
    if (foundHq) {
      const [list, instructors] = await Promise.all([listKitOrders(foundHq.id), listInstructors(foundHq.id)]);
      setOrders(list);
      setInstructorMap(Object.fromEntries(instructors.map((i) => [i.id, i])));
    }
    setLoading(false);
  }, [profile.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  async function apply(order: AcademyKitOrder, patch: Parameters<typeof updateKitOrder>[3]) {
    if (!hq) return;
    setBusyId(order.id);
    try {
      const next = await updateKitOrder(profile, hq.id, order, patch);
      setOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--mikke-muted)]">
        講師からのキット・資材注文です。入金済みにすると、本部売上・講師経費が記録されます。
      </p>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-10 text-center">
          <Package size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ注文がありません。</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {orders.map((order) => {
            const ins = instructorMap[order.instructor_id];
            return (
              <li key={order.id} className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{order.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--mikke-muted)]">
                      {ins?.business_name || "講師"} ・ {formatDate(order.ordered_at)} ・{" "}
                      <span className="font-bold text-[var(--mikke-text)]">{order.amount.toLocaleString()}円</span>
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                    {KIT_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--mikke-muted)]">ステータス</label>
                    <select
                      className={inputClass}
                      value={order.status}
                      disabled={busyId === order.id}
                      onChange={(e) => apply(order, { status: e.target.value as AcademyKitOrder["status"] })}
                    >
                      {KIT_STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {KIT_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--mikke-muted)]">入金状況</label>
                    <select
                      className={inputClass}
                      value={order.payment_status}
                      disabled={busyId === order.id}
                      onChange={(e) => apply(order, { payment_status: e.target.value as AcademyKitOrder["payment_status"] })}
                    >
                      <option value="unpaid">未入金</option>
                      <option value="paid">入金済み</option>
                      <option value="not_required">不要</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--mikke-muted)]">外部決済URL（講師に案内）</label>
                  <input
                    className={inputClass}
                    defaultValue={order.payment_url ?? ""}
                    placeholder="https://…"
                    onBlur={(e) => e.target.value !== (order.payment_url ?? "") && apply(order, { payment_url: e.target.value || null })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function KitsPage() {
  return (
    <HonbuShell title="キット発注管理">
      <KitsContent />
    </HonbuShell>
  );
}
