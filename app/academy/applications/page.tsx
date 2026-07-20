"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Package, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { listInstructors } from "@/lib/academy/instructors";
import {
  APPLICATION_STATUS_LABELS,
  listApplications,
  updateApplication,
  visibleStatusOptions
} from "@/lib/academy/applications";
import { KIT_STATUS_LABELS, KIT_STATUS_ORDER, listKitOrders, updateKitOrder } from "@/lib/academy/kits";
import { formatDate } from "@/lib/format";
import type {
  AcademyApplication,
  AcademyCourse,
  AcademyHeadquarters,
  AcademyInstructor,
  AcademyKitOrder
} from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";

function StatusChip({ status }: { status: AcademyApplication["status"] }) {
  const tone =
    status === "cancelled"
      ? "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"
      : status === "closed" || status === "certified" || status === "instructor_added"
        ? "border-[var(--mikke-success)]/30 bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]"
        : "border-[var(--mikke-accent)]/30 bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

// AC-F1: 本部受付タブ = 既存のacademy_applications一覧（インラインステータス変更）。
function HonbuTab({ hq }: { hq: AcademyHeadquarters }) {
  const { profile } = useAuth();
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [applications, courses] = await Promise.all([listApplications(hq.id), listCourses(hq.id)]);
    setApps(applications);
    setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
    setLoading(false);
  }, [hq.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(app: AcademyApplication, status: AcademyApplication["status"]) {
    setBusyId(app.id);
    setStatusError(null);
    try {
      const next = await updateApplication(profile, hq.id, app, { status });
      setApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "ステータスの更新に失敗しました。");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--mikke-muted)]">本部が直接受け付けた申込の一覧です。</p>
        <Link href="/academy/applications/new" className="flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">
          <Plus size={16} /> 申込を追加
        </Link>
      </div>

      {statusError ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{statusError}</p> : null}

      {apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-8 text-center">
          <ClipboardList size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ申込がありません。</p>
          <Link href="/academy/applications/new" className="mt-3 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]">
            申込を手入力で追加
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const course = courseMap[app.course_id];
            return (
              <li key={app.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
                <Link href={`/academy/applications/${app.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{app.applicant_name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--mikke-muted)]">
                        {course ? `${course.code} ` : ""}
                        本部受付
                        {app.event_date ? ` ・ ${formatDate(app.event_date)}` : ""}
                      </p>
                    </div>
                    <StatusChip status={app.status} />
                  </div>
                </Link>
                <select
                  className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-xs font-bold text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] disabled:opacity-60"
                  value={app.status}
                  disabled={busyId === app.id}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateStatus(app, e.target.value as AcademyApplication["status"])}
                >
                  {visibleStatusOptions(course?.requires_kit ?? true).map((s) => (
                    <option key={s} value={s}>
                      {APPLICATION_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// AC-F1: 講師受付タブ = 旧app/academy/kits/page.tsxの中身をそのまま移植。
// RLS設計上、本部はkoushi申込の生データを見られないため、本部にとっての
// 「講師受付の申込」= academy_kit_orders（プライバシー安全な部分集合）がそのまま実体になる。
function KoushiTab({ hq }: { hq: AcademyHeadquarters }) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<AcademyKitOrder[]>([]);
  const [instructorMap, setInstructorMap] = useState<Record<string, AcademyInstructor>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, instructors] = await Promise.all([listKitOrders(hq.id), listInstructors(hq.id)]);
    setOrders(list);
    setInstructorMap(Object.fromEntries(instructors.map((i) => [i.id, i])));
    setLoading(false);
  }, [hq.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function apply(order: AcademyKitOrder, patch: Parameters<typeof updateKitOrder>[3]) {
    setBusyId(order.id);
    try {
      const next = await updateKitOrder(profile, hq.id, order, patch);
      setOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--mikke-muted)]">
        講師が営業用URLから受け付けた申込は、講師からのキット発注としてここに届きます（受講者の氏名・電話番号・申込備考は本部には送られません）。
        入金済みにすると、本部売上・講師経費が記録されます。
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
                    {order.desired_date ? (
                      <p className="mt-0.5 text-xs text-[var(--mikke-muted)]">受講日: {formatDate(order.desired_date)}</p>
                    ) : null}
                    {order.diploma_name_en ? (
                      <p className="mt-0.5 text-xs text-[var(--mikke-muted)]">ディプロマ名: {order.diploma_name_en}</p>
                    ) : null}
                    {order.contact_email ? (
                      <p className="mt-0.5 text-xs text-[var(--mikke-muted)]">連絡先: {order.contact_email}</p>
                    ) : null}
                    {order.shipping_address ? (
                      <p className="mt-0.5 text-xs text-[var(--mikke-muted)]">送り先: {order.shipping_address}</p>
                    ) : null}
                    {order.instructor_note ? (
                      <p className="mt-0.5 text-xs text-[var(--mikke-muted)]">講師からの備考: {order.instructor_note}</p>
                    ) : null}
                    {order.application_id ? (
                      <Link
                        href={`/academy/applications/${order.application_id}`}
                        className="mt-0.5 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]"
                      >
                        申込を見る →
                      </Link>
                    ) : null}
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

function ApplicationsContent() {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"honbu" | "koushi">("honbu");

  useEffect(() => {
    async function load() {
      setHq(await getOwnedHeadquarters(profile.user_id));
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-[var(--mikke-muted)]">{hq.name}</p>
        <h2 className="text-base font-bold text-[var(--mikke-text)]">申込管理</h2>
      </div>

      <div className="flex gap-2 border-b border-[var(--mikke-line)]">
        {(
          [
            { key: "honbu", label: "本部受付" },
            { key: "koushi", label: "講師受付" }
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-bold ${
              tab === t.key
                ? "border-b-2 border-[var(--mikke-accent)] text-[var(--mikke-accent-strong)]"
                : "text-[var(--mikke-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "honbu" ? <HonbuTab hq={hq} /> : <KoushiTab hq={hq} />}
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <HonbuShell title="申込管理">
      <ApplicationsContent />
    </HonbuShell>
  );
}
