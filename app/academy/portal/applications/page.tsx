"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Package, X } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { APPLICATION_STATUS_LABELS } from "@/lib/academy/applications";
import { getCoursesByIds, getMyInstructorRecords, listMyApplications } from "@/lib/academy/instructor-portal";
import { KIT_STATUS_LABELS, createKitOrder, listMyKitOrders } from "@/lib/academy/kits";
import { listInstructorAddresses } from "@/lib/academy/instructor-addresses";
import { formatDate } from "@/lib/format";
import type {
  AcademyApplication,
  AcademyCourse,
  AcademyInstructor,
  AcademyInstructorAddress,
  AcademyKitOrder,
  Profile
} from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

// Wave E (AC-E5): 「受講日を確定してキットを仕入れる」— 二度手間だったWave Dのpickerを
// この1操作に統合。送り先は対面=講師の登録住所から選択／オンライン=申込のapplicant_shipping_addressを
// 自動採用（表示のみ・変更不要）。application.applicant_name/applicant_phoneはcreateKitOrderへ渡さない。
function KitIntakeModal({
  application,
  course,
  instructor,
  profile,
  onClose,
  onCreated
}: {
  application: AcademyApplication;
  course: AcademyCourse | undefined;
  instructor: AcademyInstructor;
  profile: Profile;
  onClose: () => void;
  onCreated: (order: AcademyKitOrder) => void;
}) {
  const [desiredDate, setDesiredDate] = useState(application.event_date ?? "");
  const [addresses, setAddresses] = useState<AcademyInstructorAddress[]>([]);
  const [addressLoading, setAddressLoading] = useState(application.format === "in_person");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (application.format !== "in_person") return;
    let mounted = true;
    listInstructorAddresses(instructor.id).then((list) => {
      if (!mounted) return;
      setAddresses(list);
      if (list.length === 1) setSelectedAddressId(list[0].id);
      setAddressLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [application.format, instructor.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!desiredDate) return setError("受講日を入力してください。");

    let shippingAddress: string | null = null;
    if (application.format === "in_person") {
      const addr = addresses.find((a) => a.id === selectedAddressId);
      if (!addr) return setError("送り先の住所を選択してください（未登録の場合は先に配送先住所帳へ登録してください）。");
      shippingAddress = `${addr.label}: ${addr.address_text}`;
    } else if (application.format === "online") {
      shippingAddress = application.applicant_shipping_address;
    }

    setSaving(true);
    try {
      const order = await createKitOrder(profile, instructor, {
        title: `${course?.code ?? ""} ${course?.name ?? "講座"} キット`.trim(),
        amount: course?.kit_price ?? 0,
        paymentUrl: course?.kit_payment_url ?? null,
        courseId: application.course_id,
        applicationId: application.id,
        shippingAddress,
        desiredDate,
        diplomaNameEn: application.diploma_name_en,
        contactEmail: application.applicant_email,
        instructorNote: note || null
      });
      onCreated(order);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "キットの仕入れに失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--mikke-text)]">受講日を確定してキットを仕入れる</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[var(--mikke-muted)] hover:bg-[var(--mikke-surface-soft)]"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">
          {application.applicant_name}さんの申込です。受講者の氏名・電話番号・申込備考は本部には送られません。
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className={labelClass}>受講日*</label>
            <input
              type="date"
              required
              className={inputClass}
              value={desiredDate}
              onChange={(e) => setDesiredDate(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>送り先</label>
            {application.format === "in_person" ? (
              addressLoading ? (
                <p className="text-xs text-[var(--mikke-muted)]">読み込み中…</p>
              ) : addresses.length === 0 ? (
                <p className="rounded-xl bg-[var(--mikke-accent-soft)] px-3 py-2 text-[11px] text-[var(--mikke-accent-strong)]">
                  配送先住所が未登録です。先に「営業用URL」画面の配送先住所帳から登録してください。
                </p>
              ) : (
                <select className={inputClass} value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)}>
                  <option value="">選択してください</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              )
            ) : application.format === "online" ? (
              <div className="rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-2 text-xs text-[var(--mikke-text-soft)]">
                {application.applicant_shipping_address || "受講者からの配送先情報が未登録です。"}
                <p className="mt-1 text-[10px] text-[var(--mikke-muted)]">受講者が申込時に入力した配送先です（自動採用・変更不要）。</p>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--mikke-muted)]">受講形式が未設定のため、送り先を自動判定できません。本部にご相談ください。</p>
            )}
          </div>

          <div>
            <label className={labelClass}>講師からの備考</label>
            <textarea
              className={`${inputClass} min-h-16`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="本部への連絡事項（任意）"
            />
          </div>

          {error ? <p className="text-xs font-bold text-[var(--mikke-danger)]">{error}</p> : null}

          <button type="submit" disabled={saving} className="w-full rounded-xl bg-[var(--mikke-accent)] py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "送信中…" : "キットを仕入れる"}
          </button>
        </form>
      </div>
    </div>
  );
}

function MyApplicationsContent() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AcademyInstructor[]>([]);
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [kitOrders, setKitOrders] = useState<AcademyKitOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalApp, setModalApp] = useState<AcademyApplication | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const myRecords = await getMyInstructorRecords(profile.user_id);
    setRecords(myRecords);
    const [myApps, courses, myKits] = await Promise.all([
      listMyApplications(myRecords.map((r) => r.id)),
      getCoursesByIds(myRecords.map((r) => r.course_id)),
      listMyKitOrders(myRecords.map((r) => r.id))
    ]);
    setApps(myApps);
    setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
    setKitOrders(myKits);
    setLoading(false);
  }, [profile.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  function instructorForApp(app: AcademyApplication) {
    return records.find((r) => r.id === app.instructor_id) ?? records.find((r) => r.course_id === app.course_id) ?? null;
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (records.length === 0) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">まだ講師登録されていません。</p>;

  const modalInstructor = modalApp ? instructorForApp(modalApp) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-xs text-[var(--mikke-muted)]">
        あなたの営業用URLから入った申込（担当申込）の一覧です。ステータスの更新は本部が行います。
        受講日が決まったら「受講日を確定してキットを仕入れる」から本部にキットを注文してください（1申込につき1回）。
      </p>

      {apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-10 text-center">
          <ClipboardList size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ担当申込がありません。</p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {apps.map((a) => {
            const existingOrder = kitOrders.find((o) => o.application_id === a.id);
            const inst = instructorForApp(a);
            // Wave F (AC-F5e): キットを販売しない講座(requires_kit=false)ではキット仕入れ導線を出さない。
            const requiresKit = courseMap[a.course_id]?.requires_kit ?? true;
            return (
              <li key={a.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{a.applicant_name}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--mikke-muted)]">
                      {courseMap[a.course_id]?.code ?? ""}
                      {a.event_date ? ` ・ ${formatDate(a.event_date)}` : ""} ・ {a.price.toLocaleString()}円
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                    {APPLICATION_STATUS_LABELS[a.status]}
                  </span>
                </div>
                {!requiresKit ? null : existingOrder ? (
                  <p className="mt-2 text-[11px] font-bold text-[var(--mikke-accent-strong)]">
                    キット仕入れ済み（{KIT_STATUS_LABELS[existingOrder.status]}）
                  </p>
                ) : inst ? (
                  <button
                    type="button"
                    onClick={() => setModalApp(a)}
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] px-2.5 py-1 text-[11px] font-bold text-[var(--mikke-accent-strong)]"
                  >
                    <Package size={12} /> 受講日を確定してキットを仕入れる
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {modalApp && modalInstructor ? (
        <KitIntakeModal
          application={modalApp}
          course={courseMap[modalApp.course_id]}
          instructor={modalInstructor}
          profile={profile}
          onClose={() => setModalApp(null)}
          onCreated={(order) => setKitOrders((prev) => [order, ...prev])}
        />
      ) : null}
    </div>
  );
}

export default function MyApplicationsPage() {
  return (
    <KoushiShell title="申込管理">
      <MyApplicationsContent />
    </KoushiShell>
  );
}
