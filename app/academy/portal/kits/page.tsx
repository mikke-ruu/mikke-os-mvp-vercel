"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Package } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { getCoursesByIds, getMyInstructorRecords } from "@/lib/academy/instructor-portal";
import { KIT_STATUS_LABELS, createKitOrder, listMyKitOrders } from "@/lib/academy/kits";
import { formatDate } from "@/lib/format";
import type { AcademyCourse, AcademyInstructor, AcademyKitOrder } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function MyKitsContent() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AcademyInstructor[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [orders, setOrders] = useState<AcademyKitOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [instructorId, setInstructorId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const myRecords = await getMyInstructorRecords(profile.user_id);
    setRecords(myRecords);
    if (myRecords.length === 1) setInstructorId(myRecords[0].id);
    const [courses, myOrders] = await Promise.all([
      getCoursesByIds(myRecords.map((r) => r.course_id)),
      listMyKitOrders(myRecords.map((r) => r.id))
    ]);
    setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
    setOrders(myOrders);
    setLoading(false);
  }, [profile.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const rec = records.find((r) => r.id === instructorId);
    if (!rec) return setError("講座を選択してください。");
    if (!title.trim()) return setError("品目を入力してください。");
    setSaving(true);
    try {
      await createKitOrder(profile, rec, { title, amount, courseId: rec.course_id });
      setTitle("");
      setAmount(0);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注文に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (records.length === 0) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">まだ講師登録されていません。</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* 新規注文 */}
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6">
        <h2 className="text-sm font-bold text-[var(--mikke-text)]">本部にキットを注文する</h2>
        <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">
          講座キット・材料・ディプロマなどを本部に注文します。金額は本部からの案内に合わせて入力してください。
        </p>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {records.length > 1 ? (
            <div>
              <label className={labelClass}>講座</label>
              <select className={inputClass} value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
                <option value="">選択してください</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {courseMap[r.course_id]?.code} {courseMap[r.course_id]?.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className={labelClass}>品目*</label>
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="CACMキット ×2" />
            </div>
            <div>
              <label className={labelClass}>金額（円）</label>
              <input type="number" min={0} className={inputClass} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
            </div>
          </div>
          {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}
          <button type="submit" disabled={saving} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "送信中…" : "注文する"}
          </button>
        </form>
      </section>

      {/* 注文履歴 */}
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6">
        <h2 className="text-sm font-bold text-[var(--mikke-text)]">注文履歴</h2>
        {orders.length === 0 ? (
          <div className="py-8 text-center">
            <Package size={26} className="mx-auto text-[var(--mikke-accent)]" />
            <p className="mt-2 text-xs text-[var(--mikke-muted)]">まだ注文がありません。</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--mikke-surface-soft)]">
            {orders.map((o) => (
              <li key={o.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{o.title}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--mikke-muted)]">
                      {formatDate(o.ordered_at)} ・ {o.amount.toLocaleString()}円 ・ 入金
                      {o.payment_status === "paid" ? "済み" : o.payment_status === "unpaid" ? "前" : "不要"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                    {KIT_STATUS_LABELS[o.status]}
                  </span>
                </div>
                {o.payment_url && o.payment_status === "unpaid" ? (
                  <a
                    href={o.payment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent)]"
                  >
                    <ExternalLink size={12} /> お支払いはこちら
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function MyKitsPage() {
  return (
    <KoushiShell title="キット発注">
      <MyKitsContent />
    </KoushiShell>
  );
}
