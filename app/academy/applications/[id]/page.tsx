"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import {
  APPLICATION_STATUS_LABELS,
  getApplication,
  listApplicationNotifications,
  promoteCertifiedApplicationToInstructor,
  retryApplicationNotifications,
  updateApplication,
  visibleStatusOptions
} from "@/lib/academy/applications";
import { KIT_STATUS_LABELS, listKitOrdersByApplication } from "@/lib/academy/kits";
import { findProfileByHandle } from "@/lib/academy/instructors";
import { ACADEMY_PAYMENT_PROVIDER_LABELS } from "@/lib/academy/payments";
import { formatDate } from "@/lib/format";
import type {
  AcademyApplication,
  AcademyApplicationNotification,
  AcademyCourse,
  AcademyHeadquarters,
  AcademyKitOrder
} from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-[var(--mikke-muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--mikke-text)]">{value || "—"}</span>
    </div>
  );
}

function DetailContent({ appId }: { appId: string }) {
  const { profile } = useAuth();
  const router = useRouter();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [app, setApp] = useState<AcademyApplication | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [kitOrders, setKitOrders] = useState<AcademyKitOrder[]>([]);
  const [notifications, setNotifications] = useState<AcademyApplicationNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instructorHandle, setInstructorHandle] = useState("");
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [promotionDone, setPromotionDone] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoadError(null);
      try {
        const foundHq = await getOwnedHeadquarters(profile.user_id);
        setHq(foundHq);
        if (foundHq) {
          const found = await getApplication(foundHq.id, appId);
          setApp(found);
          setCourse(await getCourse(foundHq.id, found.course_id).catch(() => null as unknown as AcademyCourse));
          setKitOrders(await listKitOrdersByApplication(foundHq.id, appId));
          if (found.intake_source === "honbu") {
            setNotifications(await listApplicationNotifications(appId).catch(() => []));
          }
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "申込詳細を読み込めませんでした。");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile.user_id, appId]);

  async function apply(patch: Parameters<typeof updateApplication>[3]) {
    if (!hq || !app) return;
    setSaving(true);
    try {
      const next = await updateApplication(profile, hq.id, app, patch);
      setApp(next);
    } finally {
      setSaving(false);
    }
  }

  async function retryNotifications() {
    setSaving(true);
    setNotificationMessage("");
    try {
      const result = await retryApplicationNotifications(appId);
      setNotificationMessage(result.sent_count > 0 ? "未送信メールを再送しました。" : "再送が必要なメールはありません。" );
      setNotifications(await listApplicationNotifications(appId));
    } catch (error) {
      setNotificationMessage(error instanceof Error ? error.message : "メールを再送できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  async function promoteToInstructor() {
    if (!app || !instructorHandle.trim()) return;
    setSaving(true);
    setPromotionError(null);
    try {
      const target = await findProfileByHandle(instructorHandle);
      if (!target) throw new Error("指定したmikke IDが見つかりません。");
      await promoteCertifiedApplicationToInstructor(app.id, target.id);
      setApp({ ...app, status: "instructor_added" });
      setPromotionDone(true);
    } catch (err) {
      setPromotionError(err instanceof Error ? err.message : "講師登録に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (loadError) {
    return (
      <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
        <p className="text-sm font-bold text-[var(--mikke-text)]">申込詳細を開けませんでした</p>
        <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">
          権限または通信状態を確認し、もう一度お試しください。{loadError}
        </p>
        <button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white">
          もう一度読み込む
        </button>
      </div>
    );
  }
  if (!hq || !app) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">申込が見つかりません。</p>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div className="flex items-center gap-2">
          {course ? <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course.code}</span> : null}
          <h2 className="text-base font-bold text-[var(--mikke-text)]">{app.applicant_name}</h2>
        </div>
        <div className="mt-2 divide-y divide-[var(--mikke-line-soft)]">
          <Row label="講座" value={course?.name ?? ""} />
          <Row label="受付元" value={app.intake_source === "koushi" ? "講師受付" : "本部受付"} />
          <Row label="開催日" value={app.event_date ? formatDate(app.event_date) : ""} />
          <Row label="受講形式" value={app.format === "in_person" ? "対面" : app.format === "online" ? "オンライン" : ""} />
          <Row label="受講料" value={`${app.price.toLocaleString()}円`} />
          <Row label="キット仕入れ" value={`${app.kit_cost.toLocaleString()}円`} />
          <Row label="本部売上 / 講師売上" value={`${app.honbu_revenue.toLocaleString()} / ${app.instructor_revenue.toLocaleString()}円`} />
          <Row label="決済方式" value={ACADEMY_PAYMENT_PROVIDER_LABELS[app.payment_provider ?? "manual"]} />
          <Row label="入金日" value={app.paid_at ? formatDate(app.paid_at) : ""} />
          <Row label="メール" value={app.applicant_email ?? ""} />
          <Row label="電話" value={app.applicant_phone ?? ""} />
        </div>
      </section>

      {app.intake_source === "honbu" ? (
        <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[var(--mikke-accent)]">受付メール</p>
              <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">申込者と本部への送信状況です。送信済みメールは重複再送しません。</p>
            </div>
            {notifications.some((item) => item.status === "failed") ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void retryNotifications()}
                className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                失敗分を再送
              </button>
            ) : null}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-[var(--mikke-muted)]">送信記録はまだありません。</p>
          ) : (
            <div className="divide-y divide-[var(--mikke-line-soft)]">
              {notifications.map((item) => (
                <div key={item.recipient_kind} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-bold">{item.recipient_kind === "applicant" ? "申込者向け" : "本部向け"}</p>
                    {item.status === "failed" && item.last_error ? (
                      <p className="mt-1 text-[11px] text-[var(--mikke-danger)]">{item.last_error}</p>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "sent" ? "bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]" : item.status === "failed" ? "bg-[var(--mikke-danger-soft)] text-[var(--mikke-danger)]" : "bg-[var(--mikke-surface-soft)]"}`}>
                    {item.status === "sent" ? "送信済み" : item.status === "failed" ? "送信失敗" : "送信中"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {notificationMessage ? <p className="text-xs font-bold text-[var(--mikke-text-soft)]">{notificationMessage}</p> : null}
        </section>
      ) : null}

      {app.certification_status === "certified" ? (
        <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          <div>
            <p className="text-xs font-bold text-[var(--mikke-accent)]">認定済みから講師登録</p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">
              本人のmikke IDを指定し、講師番号の採番と申込ステータス更新を一度に行います。初期状態は非掲載・受付OFFです。
            </p>
          </div>
          {app.status === "instructor_added" || promotionDone ? (
            <p className="text-sm font-bold text-[var(--mikke-success)]">講師登録済みです。</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={inputClass}
                value={instructorHandle}
                onChange={(e) => setInstructorHandle(e.target.value)}
                placeholder="mikke ID（例: neon）"
              />
              <button
                type="button"
                disabled={saving || !instructorHandle.trim()}
                onClick={promoteToInstructor}
                className="shrink-0 rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "登録中…" : "講師にする"}
              </button>
            </div>
          )}
          {promotionError ? <p className="text-xs font-bold text-[var(--mikke-danger)]">{promotionError}</p> : null}
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">ステータス管理</p>
        <div>
          <label className={labelClass}>申込ステータス</label>
          <select
            className={inputClass}
            value={app.status}
            disabled={saving}
            onChange={(e) => apply({ status: e.target.value as AcademyApplication["status"] })}
          >
            {visibleStatusOptions(course?.requires_kit ?? true).map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>入金状況</label>
            <select
              className={inputClass}
              value={app.payment_status}
              disabled={saving}
              onChange={(e) => apply({ payment_status: e.target.value as AcademyApplication["payment_status"] })}
            >
              <option value="unpaid">未入金</option>
              <option value="paid">入金済み</option>
              <option value="not_required">不要</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>認定状況</label>
            <select
              className={inputClass}
              value={app.certification_status}
              disabled={saving}
              onChange={(e) => apply({ certification_status: e.target.value as AcademyApplication["certification_status"] })}
            >
              <option value="not_yet">未認定</option>
              <option value="pending">認定待ち</option>
              <option value="certified">認定済み</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-[var(--mikke-muted)]">
          入金・受講完了・認定は、mikke連携用のイベントとして記録されます（Storyへは個人情報を含めず後で反映）。
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">キット注文</p>
        {kitOrders.length === 0 ? (
          <div className="py-6 text-center">
            <Package size={22} className="mx-auto text-[var(--mikke-muted)]" />
            <p className="mt-2 text-xs text-[var(--mikke-muted)]">まだキット注文はありません。</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--mikke-line-soft)]">
            {kitOrders.map((o) => (
              <li key={o.id} className="py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{o.title}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--mikke-muted)]">
                      {formatDate(o.ordered_at)} ・ {o.amount.toLocaleString()}円
                      {o.shipping_address ? ` ・ 送り先: ${o.shipping_address}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                    {KIT_STATUS_LABELS[o.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/academy/applications" className="inline-block text-xs font-bold text-[var(--mikke-accent-strong)]">
          申込管理（講師受付タブ）で見る →
        </Link>
      </section>

      <button
        type="button"
        onClick={() => router.push(toCurrentAcademyContextHref("/academy/applications"))}
        className="w-full rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--mikke-text-soft)]"
      >
        一覧に戻る
      </button>
    </div>
  );
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <HonbuShell title="申込詳細">
      <div className="mx-auto max-w-2xl">
        <DetailContent appId={id} />
      </div>
    </HonbuShell>
  );
}
