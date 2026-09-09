"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { academyMonth, matchesApplication, matchesOrder, dashboardFilterLabels } from "@/lib/academy/dashboard-summary";
import { applicationIntakeCounts, matchesIntake } from "@/lib/academy/intake-summary";
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
  "min-w-0 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] sm:text-sm";

function countUnattendedInstructorOrders(orders: AcademyKitOrder[]) {
  return orders.filter((order) => order.status === "received").length;
}

function StatusChip({ status }: { status: AcademyApplication["status"] }) {
  const tone =
    status === "cancelled"
      ? "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"
      : status === "closed" || status === "certified" || status === "instructor_added"
        ? "border-[var(--mikke-success)]/30 bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]"
        : "border-[var(--mikke-accent)]/30 bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]";
  return (
    <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

// AC-F1: 本部受付タブ = 既存のacademy_applications一覧（インラインステータス変更）。
function HonbuTab({ hq, source }: { hq: AcademyHeadquarters; source: "all" | "honbu" | "koushi" }) {
  const query = useSearchParams();
  const filter = query.get("filter") || "";
  const month = query.get("month") || academyMonth(new Date());
  const { profile } = useAuth();
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [instructorMap, setInstructorMap] = useState<Record<string, AcademyInstructor>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [applications, courses, instructors] = await Promise.all([listApplications(hq.id), listCourses(hq.id), listInstructors(hq.id)]);
    setApps(applications);
    setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
    setInstructorMap(Object.fromEntries(instructors.map((i) => [i.id, i])));
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
  const visibleApps = apps.filter(a => matchesIntake(a, source) && matchesApplication(a, filter, month));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--mikke-muted)]">{source === "koushi" ? "講師の紹介ページなどで受け付けた受講申込です。教材の注文がない申込も含みます。" : source === "honbu" ? "本部で直接受け付けた受講申込です。" : "本部で閲覧できる受講申込を受付元にかかわらず表示しています。"}</p>
        <Link href={toCurrentAcademyContextHref("/academy/applications/new")} className="flex items-center gap-1 rounded-lg bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">
          <Plus size={16} /> 申込を追加
        </Link>
      </div>

      {statusError ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{statusError}</p> : null}

      <p role="status" className="text-sm font-bold">{dashboardFilterLabels[filter] || "受講申込"}：{visibleApps.length}件</p>
      {visibleApps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--mikke-line)] bg-white p-8 text-center">
          <ClipboardList size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">{filter ? "この条件に合う申込はありません。「すべて」で全件を確認できます。" : "まだ申込がありません。"}</p>
          <Link href={toCurrentAcademyContextHref("/academy/applications/new")} className="mt-3 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]">
            申込を手入力で追加
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {visibleApps.map((app) => {
            const course = courseMap[app.course_id];
            return (
              <li key={app.id} className="rounded-lg border border-[var(--mikke-line)] bg-white p-3">
                <Link href={toCurrentAcademyContextHref(`/academy/applications/${app.id}`)} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{app.applicant_name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--mikke-muted)]">
                        {course ? `${course.name} · ` : ""}
                        {app.intake_source === "koushi" ? `講師受付・${instructorMap[app.instructor_id ?? ""]?.business_name || "担当講師"}` : "本部受付"}
                        {app.event_date ? ` ・ ${formatDate(app.event_date)}` : ""}
                      </p>
                    </div>
                    <StatusChip status={app.status} />
                  </div>
                </Link>
                <select
                  aria-label={`${app.applicant_name}さんの対応状況（選ぶと保存）`}
                  className="mt-2 min-h-11 w-full border border-[var(--mikke-line)] bg-white px-2 py-2 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] disabled:opacity-60 sm:text-sm"
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
                <p className="mt-2 text-xs text-[var(--mikke-muted)]">対応状況は選ぶと保存されます。</p>
                <Link href={toCurrentAcademyContextHref(`/academy/applications/${app.id}`)} className="inline-flex min-h-11 items-center text-sm text-[var(--mikke-primary)]">申込内容・入金状況を確認 →</Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Material orders are separate from learner applications, regardless of intake source.
function KoushiTab({ hq, onPendingCountChange }: { hq: AcademyHeadquarters; onPendingCountChange: (count: number) => void }) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<AcademyKitOrder[]>([]);
  const query = useSearchParams();
  const filter = query.get("filter") || "";
  const orderId = query.get("order");
  const visibleOrders = orders.filter(k => (!orderId || k.id === orderId) && matchesOrder(k, filter));
  const [instructorMap, setInstructorMap] = useState<Record<string, AcademyInstructor>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, instructors] = await Promise.all([listKitOrders(hq.id), listInstructors(hq.id)]);
    setOrders(list);
    onPendingCountChange(countUnattendedInstructorOrders(list));
    setInstructorMap(Object.fromEntries(instructors.map((i) => [i.id, i])));
    setLoading(false);
  }, [hq.id, onPendingCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function apply(order: AcademyKitOrder, patch: Parameters<typeof updateKitOrder>[3]) {
    setBusyId(order.id);
    try {
      const next = await updateKitOrder(profile, hq.id, order, patch);
      setOrders((prev) => {
        const updated = prev.map((o) => (o.id === next.id ? next : o));
        onPendingCountChange(countUnattendedInstructorOrders(updated));
        return updated;
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--mikke-muted)]">
        講師から本部に届いた教材の注文です。受講申込そのものは「講師受付」で確認します。教材注文の件数と受講申込の件数は一致するとは限りません。
      </p>

      {(filter || orderId) ? <p role="status" className="text-sm font-bold">{orderId ? "選択した教材注文" : dashboardFilterLabels[filter] || "教材注文"}：{visibleOrders.length}件</p> : null}
      {visibleOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--mikke-line)] bg-white p-10 text-center">
          <Package size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">{filter || orderId ? "この条件に合う教材注文はありません。絞り込みを解除して確認できます。" : "まだ教材注文がありません。"}</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visibleOrders.map((order) => {
            const ins = instructorMap[order.instructor_id];
            return (
              <li key={order.id} className="space-y-3 rounded-lg border border-[var(--mikke-line)] bg-white p-4">
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
                        href={toCurrentAcademyContextHref(`/academy/applications/${order.application_id}`)}
                        className="mt-0.5 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]"
                      >
                        申込を見る →
                      </Link>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-lg bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
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
  const router = useRouter();
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [loading, setLoading] = useState(true);
  const query = useSearchParams();
  const readTab = () => { const value = query.get("tab"); return value === "honbu" || value === "koushi" || value === "instructor" ? value : "all"; };
  const [tab, setTab] = useState<"all" | "honbu" | "instructor" | "koushi">(readTab);
  useEffect(() => { setTab(readTab()); }, [query]);
  const [koushiPendingCount, setKoushiPendingCount] = useState(0);
  const [counts, setCounts] = useState({ all: 0, honbu: 0, instructor: 0, koushi: 0 });
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) {
        const [orders, apps] = await Promise.all([listKitOrders(foundHq.id), listApplications(foundHq.id)]);
        setKoushiPendingCount(countUnattendedInstructorOrders(orders));
        setCounts({ ...applicationIntakeCounts(apps), koushi: orders.length });
      }
      } catch { setLoadError(true); } finally { setLoading(false); }
    }
    load();
  }, [profile.user_id]);

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (loadError) return <p role="alert" className="py-6 text-sm">申込件数を取得できませんでした。0件ではありません。ページを再読み込みしてください。</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-[var(--mikke-muted)]">{hq.name}</p>
        <h2 className="mt-1 text-2xl font-bold text-[var(--mikke-text)]">申込・受注管理</h2>
        <p className="mt-2 text-sm text-[var(--mikke-muted)]">届いた申込を確認し、入金確認・教材発送などの対応を進めます。</p>
        {(query.get("filter") || query.get("order")) ? <Link className="inline-flex min-h-11 items-center text-sm text-[var(--mikke-primary)]" href={toCurrentAcademyContextHref(`/academy/applications?tab=${tab}`)}>絞り込みを解除 →</Link> : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            { key: "all", label: "すべての受講申込" },
            { key: "honbu", label: "本部受付" },
            { key: "instructor", label: "講師受付" },
            { key: "koushi", label: "教材注文" }
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => { const next = new URLSearchParams(query.toString()); next.set("tab", t.key); next.delete("filter"); next.delete("order"); setTab(t.key); router.push(toCurrentAcademyContextHref(`/academy/applications?${next}`)); }}
            className={`rounded-lg border px-2 py-2.5 text-sm font-bold ${
              tab === t.key
                ? "border-[var(--mikke-accent)] bg-white text-[var(--mikke-accent-strong)] shadow-sm"
                : "border-transparent text-[var(--mikke-muted)]"
            }`}
          >
            <span className="block">{t.label}</span><span className="mt-1 block text-xl">{counts[t.key]}<span className="ml-1 text-xs">件</span></span>
            {t.key === "koushi" && koushiPendingCount > 0 ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-lg bg-[var(--mikke-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {koushiPendingCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="text-xs leading-5 text-[var(--mikke-muted)]">
        件数は本部で閲覧できる全期間の記録です。「講師受付」は受講者から講師へ届いた申込、「教材注文」は講師から本部への発注です。
      </p>

      <nav aria-label="対応状況で絞り込み" className="flex flex-wrap gap-2 border-y border-[var(--mikke-line)] py-3">
        {(tab !== "koushi" ? [["", "すべて"], ["new", "新しい申込"], ["unpaid", "入金確認待ち"], ["month", "今月の申込"]] : [["", "すべて"], ["active", "対応中"], ["shipping", "発送待ち"], ["unpaid", "入金確認待ち"]]).map(([value, label]) => <Link key={value} aria-current={(query.get("filter") || "") === value && !query.get("order") ? "page" : undefined} href={toCurrentAcademyContextHref(`/academy/applications?tab=${tab}&filter=${value}`)} className="inline-flex min-h-11 items-center border border-[var(--mikke-line)] px-3 text-sm aria-[current=page]:border-[var(--mikke-primary)] aria-[current=page]:font-bold aria-[current=page]:text-[var(--mikke-primary)]">{label}</Link>)}
      </nav>
      {tab !== "koushi" ? <HonbuTab hq={hq} source={tab === "instructor" ? "koushi" : tab} /> : <KoushiTab hq={hq} onPendingCountChange={setKoushiPendingCount} />}
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <HonbuShell title="申込・受注管理">
      <ApplicationsContent />
    </HonbuShell>
  );
}
