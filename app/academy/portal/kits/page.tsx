"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Package } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { getCoursesByIds, getMyInstructorRecords } from "@/lib/academy/instructor-portal";
import { KIT_STATUS_LABELS, createKitOrder, listMyKitOrders } from "@/lib/academy/kits";
import { formatDate } from "@/lib/format";
import type { AcademyCourse, AcademyInstructor, AcademyKitOrder, Profile } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

// Wave E (AC-E5): 主導線は app/academy/portal/applications の
// 「受講日を確定してキットを仕入れる」モーダルに一本化した。この画面は
// 過去の注文履歴を見る一覧が中心。申込に紐付かない自由記述の単発注文
// （万一の例外対応用）だけ、目立たない折りたたみとして残す。
function OtherOrderForm({
  records,
  courseMap,
  profile,
  onCreated
}: {
  records: AcademyInstructor[];
  courseMap: Record<string, AcademyCourse>;
  profile: Profile;
  onCreated: (order: AcademyKitOrder) => void;
}) {
  const [instructorId, setInstructorId] = useState(records.length === 1 ? records[0].id : "");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [shippingNote, setShippingNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const rec = records.find((r) => r.id === instructorId);
    if (!rec) return setError("講座を選択してください。");
    if (!title.trim()) return setError("品目を入力してください。");
    setSaving(true);
    try {
      const order = await createKitOrder(profile, rec, {
        title,
        amount,
        courseId: rec.course_id,
        applicationId: null,
        shippingAddress: shippingNote.trim() || null
      });
      onCreated(order);
      setTitle("");
      setAmount(0);
      setShippingNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注文に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
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
      <div>
        <label className={labelClass}>送り先メモ（自由入力）</label>
        <input className={inputClass} value={shippingNote} onChange={(e) => setShippingNote(e.target.value)} placeholder="送付先住所や備考を入力" />
      </div>
      {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}
      <button type="submit" disabled={saving} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {saving ? "送信中…" : "注文する"}
      </button>
    </form>
  );
}

function MyKitsContent() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AcademyInstructor[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [orders, setOrders] = useState<AcademyKitOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const myRecords = await getMyInstructorRecords(profile.user_id);
    setRecords(myRecords);
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

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (records.length === 0) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">まだ講師登録されていません。</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <p className="text-xs text-[var(--mikke-muted)]">
        通常のキット仕入れは「申込管理」の各申込にある「受講日を確定してキットを仕入れる」から行ってください。
        ここでは過去の注文履歴を確認できます。
      </p>

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
                      {o.desired_date ? ` ・ 受講日: ${formatDate(o.desired_date)}` : ""}
                      {o.shipping_address ? ` ・ 送り先: ${o.shipping_address}` : ""}
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

      {/* 申込に紐付かない単発注文（例外対応用・目立たない導線） */}
      <details className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-4 md:p-6">
        <summary className="cursor-pointer text-xs font-bold text-[var(--mikke-muted)]">
          申込に紐づかない単発注文（例外対応・通常は使いません）
        </summary>
        <OtherOrderForm
          records={records}
          courseMap={courseMap}
          profile={profile}
          onCreated={(order) => setOrders((prev) => [order, ...prev])}
        />
      </details>
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
